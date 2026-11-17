// Synthetic answers to real captured questions. Never load a person's answers.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import catalogue from '../public/art-atlas/artworks.json' with {type:'json'};
import reviews from '../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {prepareJourneySession,extendJourneySession,restoreStudyRound,snapshotStudyRound,validStudyAnswer,journeyInvestigationPool} from '../public/art-atlas/deep-study.mjs';
import {bindDiagnosticRound,isDiagnosticRound} from '../public/art-atlas/explanation-followups.mjs';
import {bindFinalRefinementRound,isFinalRefinementRound} from '../public/art-atlas/final-refinement.mjs';
import {freezeAppealForecast} from '../public/art-atlas/taste-inquiry.mjs';
import {buildTastePortrait} from '../public/art-atlas/taste-portrait.mjs';
import {bindContextChangeRound,isContextChangeRound} from '../public/art-atlas/context-change.mjs';
import {bindTasteAttribution,captureArtworkExposure} from '../public/art-atlas/recognition-evidence.mjs';
import {createSortingRecord,placeSortingWork} from '../public/art-atlas/sorting-table.mjs';
import {createGalleryRecord,gallerySlots} from '../public/art-atlas/gallery-model.mjs';
import {renderTastePortrait} from '../public/art-atlas/taste-portrait-view.mjs';

const ids=r=>r.works.map(w=>w.id),bounded=n=>Math.max(0,Math.min(100,Math.round(n)));
const v=(w,k)=>reviews.reviews[w.id]?.attributes[k]?.status==='present'?1:reviews.reviews[w.id]?.attributes[k]?.status==='absent'?0:null;
const trajectories={
  'layered-space':w=>25+60*(v(w,'layered-space')??.5)+8*(v(w,'material-detail')??.5),
  'landscapes-with-marks':w=>v(w,'landscape')===1?45+45*(v(w,'visible-paint-marks')??.5):65-40*(v(w,'visible-paint-marks')??.5),
  'sparse-and-organised':w=>v(w,'open-expanse')===1?90:v(w,'narrative-detail')===1&&v(w,'layered-space')===1?85:30,
  'unsettling-returns':w=>40+20*(v(w,'imagined-world')??.5)-10*(v(w,'expressive-distortion')??.5),
  'all-tied':()=>75,
  'isolated-and-reversing':(w,index)=>w.id==='monet-water-lilies'?(index<100?99:10):50+((w.id.length%5)-2)*2
};

export async function replay(name,rate=trajectories[name]){
  let data=prepareJourneySession(null,catalogue,1000);data.manifest.id='synthetic-'+name;
  const history=[],checkpoints=[],questions=[],records=[];
  for(let block=0;block<6;block++){
    for(let index=block*50;index<(block+1)*50;index++){
      data.index=index;
      let round=restoreStudyRound(data.plan[index],data.manifest.catalogue);
      if(isDiagnosticRound(round))round=bindDiagnosticRound({round,works:catalogue,rounds:history,answers:data.answers,selection:journeyInvestigationPool(data,index,history)});
      if(isFinalRefinementRound(round))round=bindFinalRefinementRound({round,works:catalogue,rounds:history,answers:data.answers});
      if(round.evidence?.bindFromShownAppeal)round=bindTasteAttribution(round,history,data.answers);
      if(isContextChangeRound(round))round=bindContextChangeRound({round,rounds:history,answers:data.answers});
      round=freezeAppealForecast({round,works:catalogue,rounds:history,answers:data.answers});
      round={...round,evidence:{...round.evidence,exposureHistory:captureArtworkExposure(round,history,data.answers)}};
      data.shown[round.id]=snapshotStudyRound(round);history.push(round);
      const base={workIds:ids(round),confirmed:true},level=w=>bounded(rate(w,index)),values=round.works.map(level);
      let answer;
      if(round.unavailable)answer={workIds:ids(round),skipped:true};
      else if(isContextChangeRound(round))answer={...base,workId:ids(round)[0],contextProtocol:round.contextProtocol,contentId:round.contextNote.id,storySeen:true,uncertain:false,reportedChange:index%2?100:50};
      else if(round.kind==='spectrum')answer={...base,criterion:round.criterion,positions:Object.fromEntries(round.works.map((w,i)=>[w.id,values[i]]))};
      else if(round.kind==='grid')answer={...base,axis:round.axis,points:Object.fromEntries(round.works.map(w=>[w.id,round.axis==='returnResponse'?[v(w,'expressive-distortion')===1?85:20,v(w,'imagined-world')===1?90:20]:round.axis==='achievement'?[level(w),85]:round.axis==='connection'?[30,level(w)]:[level(w),80]]))};
      else if(round.kind==='choice-grid'){
        const familiarity=round.selectionMode==='familiarity',selectedIds=round.selectionMode==='relatedness'?[ids(round)[0]]:round.works.filter(w=>level(w)>=80).slice(0,round.maxChoices||4).map(w=>w.id);
        answer={...base,selectionMode:round.selectionMode,selectedIds:familiarity?[]:selectedIds,explicitNone:familiarity?false:!selectedIds.length,unsure:false,...(familiarity?{familiarity:Object.fromEntries(ids(round).map((id,i)=>[id,i%3===0?'seen':'new']))}:{}),...(round.evidence?.instrumentRevision==='paged-favourites-v1'?{presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:Array.from({length:Math.ceil(round.works.length/18)},(_,i)=>i),activePage:0}}:{})};
        if(familiarity)answer.selectedIds=ids(round).filter((id,i)=>i%3===0);
      }else if(round.kind==='match')answer={...base,field:round.field,guesses:Object.fromEntries(round.works.map((w,i)=>[w.id,i%2?'unsure':round.options.find(o=>o.label===w[round.field])?.id||'unsure'])),certainty:Object.fromEntries(ids(round).map((id,i)=>[id,i%2?'unsure':'guessed'])),feedbackSeen:true};
      else if(round.kind==='statements')answer={...base,claims:Object.fromEntries(round.statements.map(s=>[s.id,3]))};
      else if(round.kind==='exercise'&&round.exerciseKind==='sorting'){
        let record=createSortingRecord(round.works,{},records,{id:'synthetic-'+round.id,now:1000+index,offeredIds:ids(round)});
        for(let i=0;i<round.works.length;i++)record=placeSortingWork(record,ids(round)[i],[.15+(i%4)*.22,.25+Math.floor(i/4)*.45]).record;
        record={...record,confirmed:true,finishedAt:2000+index};records.push(record);answer={...base,record};
      }else if(round.kind==='exercise'&&round.exerciseKind==='curate'){
        let record=createGalleryRecord(round.works,{}, {id:'synthetic-'+round.id,now:1000+index,roomStudy:false});
        for(let i=0;i<4;i++){const slot=gallerySlots(record)[0];record.placements[ids(round)[i]]={wallId:slot.wallId,t:slot.t};}
        record={...record,presentedIds:ids(round).slice(0,18),confirmed:true,finishedAt:2000+index};records.push(record);answer={...base,record};
      }else answer={workIds:ids(round),skipped:true};
      assert.ok(answer.skipped||validStudyAnswer(round,answer),name+' '+round.id+' '+round.kind);
      data.answers[round.id]=answer;
      if(round.evidence?.diagnostic||round.evidence?.tasteInquiry||round.evidence?.appealInvestigation)questions.push({roundId:round.id,kind:round.evidence.diagnostic?.kind,mode:round.evidence.diagnostic?.inquiryMode,workIds:ids(round),titles:round.works.map(w=>w.shortTitle||w.title),values,check:round.evidence.tasteInquiry?.predictions,earlier:round.evidence.appealInvestigation?.alternatives,reason:round.evidence.diagnostic?.reason});
    }
    data.screen='reading';data.finishedAt=2000+block;
    const profile=buildTastePortrait({works:catalogue,rounds:history,answers:data.answers,records});
    if(process.argv[1]?.endsWith('replay-art-atlas-intelligence.mjs')&&[50,100,150,300].includes((block+1)*50)){
      const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
      const markup=renderTastePortrait({portrait:profile,works:catalogue,rounds:history,answers:data.answers,esc,image:w=>`<img src="http://127.0.0.1:56124/art-atlas/${esc(w.image)}" alt="${esc(w.title)}">`});
      const styles=['style','deep-study','taste-portrait','profile-reading','taste-profile','task-signals','mobile-layout'];
      await fs.writeFile(new URL(`../artifacts/art-atlas/qa-${name}-${(block+1)*50}.html`,import.meta.url),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Simulated Art Atlas profile</title>${styles.map(s=>`<link rel="stylesheet" href="http://127.0.0.1:56124/art-atlas/${s}.css">`).join('')}<body><div class="site-shell"><p>SIMULATED ANSWERS · ${esc(name)} · ${(block+1)*50} rounds</p><main>${markup}</main></div></body></html>`);
    }
    const inquiry=profile.intelligence.inquiry;
    checkpoints.push({round:(block+1)*50,summary:profile.profileSummary,discoverySets:inquiry.discoverySets,discoveryWorks:inquiry.discoveryWorkIds.length,inquiryChecks:inquiry.checks.map(c=>({roundId:c.roundId,actual:c.actual,values:c.values,predictions:c.predictions.map(p=>({id:p.id,prediction:p.prediction})),outcome:c.outcome,sourceChanged:c.sourceChanged})),candidates:inquiry.candidates.slice(0,5).map(c=>({id:c.id,direction:c.direction,status:c.status,support:c.supportingSets,opposing:c.opposingSets,artists:c.artistCount,summaryEligible:c.summaryEligible,outside:c.outsideContext})),prediction:profile.intelligence.predictionEvaluation,sensitivity:profile.intelligence.sensitivity,categories:profile.intelligence.categories.map(c=>({id:c.id,status:c.status,conclusion:c.conclusion})),ordinaryPanels:history.filter(r=>r.evidence?.panelNumber&&r.evidence?.construct==='preference').length,sessionBytes:Buffer.byteLength(JSON.stringify(data))});
    assert.equal(data.plan.length,(block+1)*50);assert.ok(profile.intelligence.categories.length>=9);
    console.log(JSON.stringify({trajectory:name,round:(block+1)*50,discoverySets:inquiry.discoverySets,checks:inquiry.checks.length,title:profile.profileSummary.title}));
    if(block<5){const shownBefore=JSON.stringify(data.shown);data=extendJourneySession(data,catalogue,3000+block);assert.equal(JSON.stringify(data.shown),shownBefore);}
  }
  return {simulation:true,name,questions,checkpoints};
}

if(process.argv[1]?.endsWith('replay-art-atlas-intelligence.mjs')){
  await fs.mkdir(new URL('../artifacts/art-atlas/',import.meta.url),{recursive:true});
  const names=process.argv.slice(2).length?process.argv.slice(2):Object.keys(trajectories),reports=[];
  for(const name of names){assert.ok(trajectories[name],name);reports.push(await replay(name));}
  const filename=names.length===Object.keys(trajectories).length?'intelligence-replays.json':'intelligence-replay-'+names.join('-')+'.json';
  await fs.writeFile(new URL('../artifacts/art-atlas/'+filename,import.meta.url),JSON.stringify({simulation:true,reports},null,2)+'\n');
}
