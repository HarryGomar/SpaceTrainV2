import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planStimulusPanels} from '../../public/art-atlas/stimulus-planner.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {bindJourneyStimulusPlan,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound} from '../../public/art-atlas/deep-study.mjs';
import {CONTRAST_CONTENT_BANK,selectContrastContent} from '../../public/art-atlas/contrast-content.mjs';

const FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
// Artificial descriptors exercise allocation, not claims about actual paintings.
function allocationFixture(){
  const countries=['France','Mexico','China','India','Egypt','United States'],years=[1100,1500,1700,1820,1880,1920];
  return Array.from({length:165},(_,i)=>({id:'expanded-'+String(i).padStart(3,'0'),title:'Synthetic fixture '+i,artist:'Fixture artist '+i,artistKnown:true,sourceUrl:'https://institution.example/'+i,image:'fixture-'+i+'.jpg',country:countries[i%6],movement:'Tradition '+i%20,recognitionTier:i%4===0?'landmark':'established',features:Object.fromEntries(FEATURES.map((f,k)=>[f,((i*(k+3)+k)%11)/10])),analysis:{yearRange:[years[i%6],years[i%6]]}}));
}
const NOTES={panelSizes:Array(18).fill(4),maximumLandmarksPerPanel:3};
function responses(plan,works,batchIndex,offset){
  const byId=new Map(works.map(w=>[w.id,w]));
  const rounds=plan.panels.map((p,i)=>({id:'journey-'+String(offset+i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',title:p.promptSnapshot?.title||'Which do you prefer?',hint:p.promptSnapshot?.hint||'Equal positions are fine.',scale:p.promptSnapshot?.scale||{left:'Less preferred',right:'More preferred'},works:p.workIds.map(id=>byId.get(id)),evidence:{construct:'preference',family:'individual-choice',role:p.role==='repeat'?'repeat':p.role==='exploration'||p.role==='discovery'?'discovery':'probe',batchIndex,setId:'panel-'+offset+'-'+i,...(p.repeatOf?{repeatOf:p.repeatOf}:{})}}));
  return {rounds,answers:Object.fromEntries(rounds.map(r=>[r.id,{workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map(w=>[w.id,Math.round(w.features.abstraction*100)])),confirmed:true}]))};
}
let trajectoryCache;
function trajectory(){
  if(trajectoryCache)return trajectoryCache;
  const works=allocationFixture(),seed='expanded-hard-protected';
  const first=planStimulusPanels({works,curationNotes:NOTES,seed}),reservationPlan=structuredClone(first.reservations),seen=new Set(first.coverage.firstRatingWorkIds),results=[{batchIndex:0,plan:first}];
  let h=responses(first,works,0,0);
  for(let batchIndex=1;batchIndex<=3;batchIndex++){
    // Generate the protected comparisons with the real selector from rated
    // works only. None can consume the new-release pool to hide a slot shortage.
    const rated=works.filter(w=>seen.has(w.id));
    const adaptive=planAdaptivePanels({works:rated,...h,batchIndex,seed,...(batchIndex===2?{quotas:{exactRepeats:2,recontextualizations:1,challenges:4}}:{})});
    const before=structuredClone(adaptive),ratedBefore=new Set(seen);
    const plan=planStimulusPanels({works,...h,batchIndex,seed,curationNotes:NOTES,reservationPlan,adaptivePlan:adaptive});
    assert.deepEqual(adaptive,before,'Curating must not mutate the protected selector output');
    const protectedPanels=adaptive.panels.flatMap((p,i)=>p.role!=='exploration'?[{panel:p,index:i}]:[]);
    for(const p of protectedPanels){assert(p.panel.workIds.every(id=>ratedBefore.has(id)));assert.deepEqual(plan.panels[p.index],p.panel,'Protected evidence, prompt snapshots and identities must remain exact');}
    results.push({batchIndex,plan,ratedBefore,protectedPanels,adaptive});
    plan.coverage.firstRatingWorkIds.forEach(id=>seen.add(id));
    const added=responses(plan,works,batchIndex,batchIndex*50);h={rounds:[...h.rounds,...added.rounds],answers:{...h.answers,...added.answers}};
  }
  trajectoryCache={works,results,seen,reservationPlan};return trajectoryCache;
}

test('165-work allocation preserves a complete72/44/44/5 first-rating reservation partition',()=>{
  const {works,results,reservationPlan}=trajectory(),first=results[0].plan;
  assert(first.complete);assert.equal(first.coverage.selectedSlots,72);assert.equal(first.coverage.uniqueWorkCount,72);
  assert.deepEqual([reservationPlan.batch2.length,reservationPlan.batch3.length,reservationPlan.batch4.length],[44,44,5]);
  const partition=[...first.coverage.selectedWorkIds,...reservationPlan.batch2,...reservationPlan.batch3,...reservationPlan.batch4];
  assert.equal(partition.length,165);assert.equal(new Set(partition).size,165);assert.deepEqual([...new Set(partition)].sort(),works.map(w=>w.id).sort());
  const binding=bindJourneyStimulusPlan(first,[]);assert.deepEqual(binding.reservations.batch4,reservationPlan.batch4);
});

test('Eleven exploration quartets introduce44 released works without rewriting seven protected panels',()=>{
  const {results,reservationPlan}=trajectory();
  for(const batchIndex of [1,2]){
    const {plan,ratedBefore,protectedPanels}=results[batchIndex],released=batchIndex===1?reservationPlan.batch2:reservationPlan.batch3;
    assert.equal(protectedPanels.length,7);
    assert.equal(plan.panels.filter(p=>p.role==='exploration').length,11);
    assert(plan.panels.filter(p=>p.role==='exploration').every(p=>p.workIds.length===4));
    assert(released.every(id=>!ratedBefore.has(id)),'All44 release-pool identities are still awaiting a first rating');
    assert.equal(plan.coverage.firstRatingAvailable,44);
    assert.equal(plan.coverage.firstRatingTarget,44);assert.equal(plan.coverage.firstRatingTargetFeasible,true);
    assert.equal(plan.coverage.firstRatingWorkIds.length,44,JSON.stringify({batchIndex,actual:plan.coverage.firstRatingWorkIds.length,missing:released.filter(id=>!plan.coverage.firstRatingWorkIds.includes(id)),previouslyRatedExplorationIds:plan.panels.filter(p=>p.role==='exploration').flatMap(p=>p.workIds).filter(id=>ratedBefore.has(id))}));
    assert.equal(plan.coverage.firstRatingTargetMet,true);
    assert.deepEqual([...plan.coverage.firstRatingWorkIds].sort(),[...released].sort());
  }
});

test('The fourth block targets the remaining five, with all165 rated exactly by the release trajectory',()=>{
  const {results,seen,reservationPlan}=trajectory(),fourth=results[3].plan;
  assert.equal(fourth.coverage.firstRatingTarget,5);
  assert.equal(fourth.coverage.firstRatingWorkIds.length,5);
  assert.deepEqual([...fourth.coverage.firstRatingWorkIds].sort(),[...reservationPlan.batch4].sort());
  assert.equal(fourth.coverage.firstRatingTargetMet,true);assert.equal(seen.size,165);
});

test('An annotation-only fourth-block reservation survives saved-plan release filtering',()=>{
  const works=allocationFixture(),late=works.at(-1),notes={...NOTES,annotations:[{workId:late.id,reserveUntilBatch:3}]};
  const first=planStimulusPanels({works,curationNotes:notes,seed:'annotation-release'});
  assert(first.reservations.batch4?.includes(late.id),'A zero-based release at3 belongs to the fourth block');
  assert(!first.reservations.batch3.includes(late.id));
  const h=responses(first,works,0,0),rated=new Set(first.coverage.firstRatingWorkIds),restricted=works.filter(w=>rated.has(w.id)||w.id===late.id);
  const beforeRelease=planStimulusPanels({works:restricted,...h,batchIndex:2,seed:'annotation-release',curationNotes:notes,reservationPlan:first.reservations});
  assert(!beforeRelease.coverage.selectedWorkIds.includes(late.id),'Serialising the reservation must not release the work one block early');
});

test('Reviewed same-subject content recognises the fourth pool when its release block arrives',()=>{
  const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
  const entry=CONTRAST_CONTENT_BANK.find(e=>e.kind==='same-subject'&&e.workIds.every(id=>actual.some(w=>w.id===id)));
  assert(entry,'Use an existing source-reviewed content set rather than weakening content guards');
  const works=entry.workIds.map(id=>actual.find(w=>w.id===id)),first=actual.find(w=>!entry.workIds.includes(w.id));
  const notes={proposedFirst18Panels:[{panel:1,workIds:[first.id]}],reservePools:{batch2:[],batch3:[],batch4:[...entry.workIds]},annotations:entry.workIds.map(workId=>({workId,reserveUntilBatch:3}))};
  const early=selectContrastContent({works,notes,kind:'same-subject',batchIndex:2});
  assert.equal(early.status,'unavailable');assert(early.rejected.some(row=>row.contentId===entry.contentId&&/reserved/.test(row.reason)));
  const released=selectContrastContent({works,notes,kind:'same-subject',batchIndex:3});
  assert.equal(released.status,'ready');assert.deepEqual([...released.workIds].sort(),[...entry.workIds].sort());
});

test('An expanding v7 session retains recorded wording, answers, catalogue metadata and archived evidence',()=>{
  const live=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
  const original=live.slice(0,99),saved=prepareJourneySession(null,original,1000);
  saved.manifest.id='v7-expanded-regression';saved.manifest.journeyRevision='art-profile-50-v7';
  for(const p of saved.plan)p.evidence.journeyRevision='art-profile-50-v7';
  const shownRound=sessionJourneyRounds(saved).find(r=>r.kind==='spectrum'&&r.criterion==='preference'&&r.evidence.construct==='preference');
  shownRound.title='The exact wording the viewer answered in v7.';shownRound.hint='The captured instruction remains authoritative.';
  saved.shown[shownRound.id]=snapshotStudyRound(shownRound);saved.plan[saved.plan.findIndex(p=>p.id===shownRound.id)]=snapshotStudyRound(shownRound);
  saved.answers[shownRound.id]={workIds:shownRound.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(shownRound.works.map((w,i)=>[w.id,Math.round(i/(shownRound.works.length-1)*100)])),confirmed:true};
  const protectedMalformed=saved.plan.find(p=>p.id!==shownRound.id);saved.answers[protectedMalformed.id]=null;
  saved.manifest.catalogue[0].features.energy=.123;
  saved.archives=[{manifest:{id:'archived-v7',catalogue:structuredClone(saved.manifest.catalogue)},shown:structuredClone(saved.shown),answers:structuredClone(saved.answers),plan:structuredClone(saved.plan)}];
  const before=structuredClone(saved),current=structuredClone(original);
  current[0].features.energy=.999;
  const extras=live.length>=165?live.slice(99,165):Array.from({length:66},(_,i)=>({...structuredClone(original[i%original.length]),id:'metadata-addition-'+i,title:'Fixture addition '+i,coreQuiz:false}));
  const expanded=[...current,...extras],restored=prepareJourneySession(saved,expanded,2000);
  assert.deepEqual(saved,before,'Preparing a release must not mutate the supplied saved record');
  assert.equal(restored.manifest.journeyRevision,JOURNEY_REVISION);assert.equal(restored.manifest.catalogue.length,165);
  assert.deepEqual(restored.manifest.catalogue.slice(0,99),before.manifest.catalogue,'New live metadata must not relabel captured works');
  assert.deepEqual(restored.answers,before.answers);assert.deepEqual(restored.shown,before.shown);assert.deepEqual(restored.archives,before.archives);
  assert.deepEqual(restored.plan.find(p=>p.id===protectedMalformed.id),before.plan.find(p=>p.id===protectedMalformed.id),'A falsy recorded answer still protects its original definition');
  const actual=sessionJourneyRounds(restored).find(r=>r.id===shownRound.id);
  assert.equal(actual.title,shownRound.title);assert.equal(actual.hint,shownRound.hint);assert.deepEqual(actual.works.map(w=>w.id),shownRound.works.map(w=>w.id));
});

const legacyNotes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8')),legacyIds=new Set([...legacyNotes.proposedFirst18Panels.flatMap(panel=>panel.workIds),...legacyNotes.reservePools.batch2,...legacyNotes.reservePools.batch3]);
const liveCatalogue=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).filter(work=>legacyIds.has(work.id));
test('The merged expanded catalogue and reviewed notes meet their released first-rating pools across real descriptors',{
  skip:liveCatalogue.length<144?'The reviewed expansion has not been merged yet.':false
},()=>{
  const notes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
  assert.equal(notes.catalogueSize,liveCatalogue.length,'The allocation notes must describe the merged authority');
  assert.deepEqual(notes.panelSizes,Array(18).fill(4));assert.equal(notes.maximumLandmarksPerPanel,3);
  for(const seed of ['expanded-real-a','expanded-real-b','expanded-real-c']){
    const first=planStimulusPanels({works:liveCatalogue,curationNotes:notes,seed});
    assert(first.complete);assert.equal(first.coverage.uniqueWorkCount,72);
    const reservations=structuredClone(first.reservations),seen=new Set(first.coverage.firstRatingWorkIds);
    const poolNames=Object.keys(notes.reservePools).filter(name=>/^batch\d+$/.test(name));
    for(const name of poolNames)assert.deepEqual([...reservations[name]].sort(),[...notes.reservePools[name]].sort());
    const partition=[...first.coverage.selectedWorkIds,...poolNames.flatMap(name=>reservations[name])];
    assert.equal(partition.length,liveCatalogue.length);assert.equal(new Set(partition).size,liveCatalogue.length);
    let h=responses(first,liveCatalogue,0,0);
    const finalBatch=Math.max(...poolNames.map(name=>Number(name.slice(5))-1));
    for(let batchIndex=1;batchIndex<=finalBatch;batchIndex++){
      const adaptive=planAdaptivePanels({works:liveCatalogue.filter(w=>seen.has(w.id)),...h,batchIndex,seed,...(batchIndex===2?{quotas:{exactRepeats:2,recontextualizations:1,challenges:4}}:{})});
      const plan=planStimulusPanels({works:liveCatalogue,...h,batchIndex,seed,curationNotes:notes,reservationPlan:reservations,adaptivePlan:adaptive});
      assert(plan.complete,seed+' batch '+batchIndex);
      for(let i=0;i<adaptive.panels.length;i++)if(adaptive.panels[i].role!=='exploration')assert.deepEqual(plan.panels[i],adaptive.panels[i]);
      const expected=reservations['batch'+(batchIndex+1)]||[];
      assert.deepEqual([...plan.coverage.firstRatingWorkIds].sort(),[...expected].sort(),seed+' batch '+batchIndex+' must rate its released pool exactly');
      assert.equal(plan.coverage.firstRatingTargetMet,true);
      plan.coverage.firstRatingWorkIds.forEach(id=>seen.add(id));
      const added=responses(plan,liveCatalogue,batchIndex,batchIndex*50);h={rounds:[...h.rounds,...added.rounds],answers:{...h.answers,...added.answers}};
    }
    assert.equal(seen.size,liveCatalogue.length);
  }
});
