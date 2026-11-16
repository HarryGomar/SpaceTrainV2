import {isDiagnosticRound,bindDiagnosticRound} from '../../public/art-atlas/explanation-followups.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound,validStudyAnswer,analyzeStudy} from '../../public/art-atlas/deep-study.mjs';
import {legacyV11Rounds} from './helpers/legacy-v11.mjs';
import {JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {validAnswer,sanitizeDraft,AXES} from '../../public/art-atlas/engine.mjs';
import {createGalleryRecord,gallerySlots,placePainting,validGallery} from '../../public/art-atlas/gallery-model.mjs';
import {createScenario} from '../../public/art-atlas/scenarios.mjs';
import {isFinalRefinementRound,bindFinalRefinementRound} from '../../public/art-atlas/final-refinement.mjs';
import {choiceGridExposure} from '../../public/art-atlas/discovery-grid.mjs';
import {allowsMultipleNeighbourReasons} from '../../public/art-atlas/contrast-rounds.mjs';

// Use the complete sourced catalogue, not a synthetic small pool.
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).slice(0,164);
const initial=prepareJourneySession(null,works,1000);
const ids=round=>round.works.map(work=>work.id);
function completeAnswer(round){
  const workIds=ids(round);
  if(round.kind==='spectrum')return {workIds,criterion:round.criterion,positions:Object.fromEntries(round.works.map((work,index)=>[work.id,Math.round(index/(round.works.length-1)*100)])),confirmed:true};
  if(round.kind==='grid')return {workIds,axis:round.axis,points:Object.fromEntries(round.works.map((work,index)=>[work.id,[10+index*20,90-index*20]])),confirmed:true};
  if(round.kind==='choice-grid'&&round.evidence.familiarityProtocol==='prior-encounter-v2')return {workIds,selectionMode:'familiarity',familiarity:Object.fromEntries(workIds.map((id,i)=>[id,i<2?'seen':'new'])),selectedIds:workIds.slice(0,2),explicitNone:false,unsure:false,confirmed:true};
  if(round.kind==='choice-grid')return {workIds,selectionMode:round.selectionMode,selectedIds:workIds.slice(0,Math.min(round.selectionMode==='familiarity'?2:round.maxChoices||3,round.evidence?.instrumentRevision==='paged-favourites-v1'?18:Infinity)),explicitNone:false,unsure:false,confirmed:true,...(round.evidence?.instrumentRevision==='paged-favourites-v1'?{presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}}:{})};
  if(round.kind==='statements')return {workIds,claims:Object.fromEntries(round.statements.map(statement=>[statement.id,3]))};
  if(round.kind==='match')return {workIds,field:round.field,...(round.evidence.instrumentRevision==='recognition-certainty-v1'?{certainty:Object.fromEntries(workIds.map(id=>[id,'recognised']))}:{}),guesses:Object.fromEntries(round.works.map(work=>[work.id,round.options.find(option=>option.label===work[round.field]).id])),confirmed:true};
  if(round.kind==='context'&&round.contextMode==='reported-context-change-v1')return {workIds,workId:workIds[0],contextProtocol:round.contextProtocol,contentId:round.contextNote.id,storySeen:true,reportedChange:50,uncertain:false,confirmed:true};
  if(round.kind==='context')return round.contextMode==='preference-before-after-v1'?{workIds,workId:workIds[0],before:25,after:75,storySeen:true}:{workIds,workId:workIds[0],change:'same'};
  if(round.kind==='contrast'){
    const base={workIds,contrastKind:round.contrastKind,confirmed:true};
    if(round.contrastKind==='chronology')return {...base,orderedIds:[...workIds],uncertainIds:[],orderReviewed:true};
    if(round.contrastKind==='neighbour')return {...base,neighbourId:workIds[0],noGoodNeighbour:false,...(allowsMultipleNeighbourReasons(round)?{relationshipIds:round.relationshipOptions?.length?[round.relationshipOptions[0].id]:[]}:round.relationshipOptions?.length?{relationshipId:round.relationshipOptions[0].id}:{})};
    if(round.contrastKind==='keep-leave')return {...base,keepId:workIds[0],leaveId:workIds.at(-1)};
    if(round.contrastKind==='same-subject')return {...base,preferredId:workIds[0],noPreference:false};
  }
  // Optional arrangement exercises can be explicitly skipped. Their skipped
  // records must survive extension without inventing a completed arrangement.
  if(round.kind==='exercise')return {workIds,skipped:true};
  throw Error('Unexpected round '+round.id);
}
function finish(data){const fixed=sessionJourneyRounds(data);for(let index=0;index<data.plan.length;index++){
  data.index=index;
  let round=fixed[index];
  if(isFinalRefinementRound(round)&&!data.shown[round.id])round=bindFinalRefinementRound({round:restoreStudyRound(data.plan[index],data.manifest.catalogue),works:data.manifest.catalogue,rounds:fixed.slice(0,index).filter(source=>data.shown[source.id]).map(source=>restoreStudyRound(data.shown[source.id],data.manifest.catalogue)).filter(Boolean),answers:data.answers});
  if(data.answers[round.id]?.skipped||validStudyAnswer(round,data.answers[round.id]))continue;
  if(isDiagnosticRound(round)&&!data.shown[round.id])round=bindDiagnosticRound({round:restoreStudyRound(data.plan[index],data.manifest.catalogue),works:data.manifest.catalogue,rounds:Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,data.manifest.catalogue)).filter(Boolean),answers:data.answers});
  if(round.unavailable){assert.ok(isFinalRefinementRound(round)||isDiagnosticRound(round),round.id);continue;}
  assert.equal(round.unavailable,undefined,round.id);
  data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);
  assert.ok(data.answers[round.id].skipped||validStudyAnswer(round,data.answers[round.id]),round.id);
}data.screen='reading';data.finishedAt=2000;return data;}
let adaptiveMigrationFixture;
function adaptiveMigrationSession(){
  if(!adaptiveMigrationFixture){
    const first=finish(structuredClone(initial));first.manifest.id='migration-regression-fixed';
    for(const round of sessionJourneyRounds(first)){
      if(round.kind==='exercise')first.answers[round.id].record=createScenario(round.exerciseKind,round.works,{},[],{id:'draft-'+round.id,now:2000,offeredIds:ids(round)});
      if(round.kind==='spectrum'&&round.evidence.construct==='preference')first.answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.energy*100)])),confirmed:true};
    }
    adaptiveMigrationFixture=extendJourneySession(first,works,3000);
    assert.ok(adaptiveMigrationFixture.batches[0].selection.panels.some(panel=>panel.role==='repeat'));
    assert.ok(adaptiveMigrationFixture.batches[0].selection.panels.some(panel=>panel.role==='challenge'));
  }
  return structuredClone(adaptiveMigrationFixture);
}

test('Journey extends 50 → 100 → 150 → 200 without rewriting prior responses, plans or catalogue',()=>{
  let data=structuredClone(initial);assert.equal(data.plan.length,50);assert.equal(data.manifest.catalogue.length,works.length);
  for(const target of [100,150,200]){
    finish(data);const before=structuredClone(data),prefixLength=before.plan.length,extended=extendJourneySession(data,works,3000+target);
    assert.deepEqual(data,before,'Extension must not mutate the supplied saved session');
    assert.equal(extended.target,target);assert.equal(extended.plan.length,target);assert.equal(extended.index,prefixLength);assert.equal(extended.screen,'question');assert.equal(extended.finishedAt,null);
    assert.equal(extended.manifest.id,before.manifest.id);assert.deepEqual(extended.manifest.catalogue,before.manifest.catalogue);assert.deepEqual(extended.plan.slice(0,prefixLength),before.plan);assert.deepEqual(extended.answers,before.answers);assert.deepEqual(extended.shown,before.shown);
    const resolved=sessionJourneyRounds(extended);assert.equal(resolved.length,target);assert.equal(new Set(resolved.map(round=>round.id)).size,target);assert.ok(resolved.filter(round=>round.unavailable).every(round=>isFinalRefinementRound(round)||isDiagnosticRound(round)),'Only future answer-bound refinement and diagnostic questions may remain deferred');assert.ok(resolved.every(round=>round.works.every(work=>extended.manifest.catalogueIds.includes(work.id))));
    const batch=extended.batches.at(-1);assert.equal(batch.offset,prefixLength);assert.equal(batch.index,prefixLength/50);assert.equal(batch.selection.panels.length,18);assert.ok(batch.selection.coverage.eligiblePreferenceRoundIds.length);
    for(const round of resolved.slice(prefixLength).filter(round=>round.kind==='spectrum'&&round.evidence.role==='repeat')){
      const source=resolved.find(previous=>previous.id===round.evidence.repeatOf);assert.ok(source);assert.ok(resolved.indexOf(source)<resolved.indexOf(round));if(!round.evidence.lateExactReturn)assert.ok(resolved.indexOf(source)<prefixLength);assert.equal(round.title,source.title);assert.equal(round.hint,source.hint);assert.deepEqual(round.scale,source.scale);assert.deepEqual([...ids(round)].sort(),[...ids(source)].sort());
    }
    data=extended;
  }
  assert.deepEqual(data.batches.map(batch=>batch.offset),[50,100,150]);
});

test('The fresh164 journey retains72/46/46 first-rating allocations and protected evidence roles',()=>{
  let data=structuredClone(initial);data.manifest.id='curated-trajectory';const planning=structuredClone(data.manifest.stimulusPlanning),rated=new Set();assert.equal(planning.bindingStatus,'exact-curated-plan');assert.equal(planning.boundMainWorkCount,72);assert.equal(planning.firstPlan.coverage.selectedSlots,72);assert.equal(planning.reservations.scope,'first-preference-ratings');
  assert.equal(planning.reservations.batch2.length,46);assert.equal(planning.reservations.batch3.length,46);assert.equal(new Set([...planning.boundMainWorkIds,...planning.reservations.batch2,...planning.reservations.batch3]).size,works.length);
  for(let batchIndex=0;batchIndex<3;batchIndex++){
    const previousRated=new Set(rated);finish(data);
    for(const round of sessionJourneyRounds(data).slice(batchIndex*50)){
      if(round.kind==='exercise')data.answers[round.id].record=createScenario(round.exerciseKind,round.works,{},[],{id:'known-empty-'+round.id,now:2000,offeredIds:ids(round)});
      if(round.kind==='spectrum'&&round.evidence.construct==='preference'&&round.evidence.family==='individual-choice'&&round.evidence.unconditional!==false){data.answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.energy*100)])),confirmed:true};assert.ok(validStudyAnswer(round,data.answers[round.id]));ids(round).forEach(id=>rated.add(id));}
    }
    const additions=[...rated].filter(id=>!previousRated.has(id));assert.equal(additions.length,[72,46,46][batchIndex]);if(batchIndex)assert.deepEqual(new Set(additions),new Set(planning.reservations[batchIndex===1?'batch2':'batch3']));
    assert.deepEqual(data.manifest.stimulusPlanning,planning,'The first design and reservations stay frozen');
    if(batchIndex<2){const before=structuredClone(data);data=extendJourneySession(data,works,3000+batchIndex);assert.deepEqual(data.plan.slice(0,before.plan.length),before.plan);assert.deepEqual(data.answers,before.answers);assert.deepEqual(data.shown,before.shown);const selection=data.batches.at(-1).selection;assert.deepEqual(selection.reservations.batch2,planning.reservations.batch2);assert.deepEqual(selection.reservations.batch3,planning.reservations.batch3);assert.equal(selection.coverage.firstRatingTargetMet,true);assert.equal(selection.coverage.firstRatingWorkIds.length,[46,46][batchIndex]);if(batchIndex===1){assert.deepEqual(selection.coverage.quotas.requested,{repeat:2,recontextualization:1,challenge:3});assert.deepEqual(selection.coverage.actualRoles,{exploration:12,repeat:2,recontextualization:1,challenge:3});for(const panel of selection.panels.filter(panel=>panel.role==='challenge'))assert.ok(panel.provisionalHypothesis.trainingEvidence.length>=3);}}
  }
  assert.equal(rated.size,164);assert.deepEqual(prepareJourneySession(data,works,9000),data);
});

test('A partially shown v3 session keeps original questions, answers and artwork metadata without inheriting the curated64 audit',()=>{
  const data=structuredClone(initial),oldWorks=works.slice(0,4),oldEvidence={journeyRevision:'art-profile-50-v3',batchIndex:0,panelNumber:1,setId:'original-v3-panel-one'},preference={id:'journey-001',kind:'spectrum',format:'spectrum',criterion:'preference',title:'The v3 question actually shown.',hint:'The original v3 placement instruction.',scale:{left:'Original lower end',right:'Original upper end'},works:oldWorks,evidence:{...oldEvidence,construct:'preference',family:'individual-choice',role:'discovery'}},map={id:'journey-004',kind:'grid',format:'grid',axis:'response',axisDefinition:structuredClone(AXES.response),title:'The original response map.',hint:'The original involvement instruction.',works:[...oldWorks].reverse(),evidence:{...oldEvidence,construct:'response',family:'felt-response',role:'check'}};
  for(const round of [preference,map]){data.plan[Number(round.id.slice(-3))-1]=snapshotStudyRound(round);data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);}
  delete data.manifest.stimulusPlanning;data.manifest.journeyRevision='art-profile-50-v3';data.index=4;data.screen='question';const before=structuredClone(data),changed=works.map(work=>({...work,title:'Changed live title',features:{...work.features,energy:0}})),restored=prepareJourneySession(data,changed,6000),resolved=sessionJourneyRounds(restored);
  assert.deepEqual(data,before);assert.deepEqual(restored.shown,before.shown);assert.deepEqual(restored.answers,before.answers);assert.deepEqual(restored.manifest.catalogue,before.manifest.catalogue);assert.equal(restored.manifest.journeyRevision,JOURNEY_REVISION);assert.equal(restored.index,4);assert.equal(restored.screen,'question');
  for(const round of [preference,map]){assert.deepEqual(restored.plan[Number(round.id.slice(-3))-1],snapshotStudyRound(round));assert.deepEqual(snapshotStudyRound(resolved.find(item=>item.id===round.id)),snapshotStudyRound(round));assert.ok(validStudyAnswer(round,restored.answers[round.id]));}
  const audit=restored.manifest.stimulusPlanning,actual=resolved.filter(round=>round.evidence.construct==='preference'&&Number.isInteger(round.evidence.panelNumber));assert.equal(audit.bindingStatus,'saved-or-fallback-bindings');assert.equal(audit.firstPlan,null);assert.ok(audit.proposalMismatchPanels.includes(1));assert.equal(audit.boundMainWorkCount,new Set(actual.flatMap(ids)).size);assert.deepEqual(audit.boundPanels[0].workIds,ids(preference));const remainder=works.length-audit.boundMainWorkCount;assert.equal(audit.reservations.batch2.length,Math.ceil(remainder/2));assert.equal(audit.reservations.batch3.length,Math.floor(remainder/2));const partition=[...audit.boundMainWorkIds,...audit.reservations.batch2,...audit.reservations.batch3];assert.equal(partition.length,works.length);assert.equal(new Set(partition).size,works.length);assert.deepEqual(restored.plan,before.plan,'A started older block retains its pending schedule as well as captured questions');assert.deepEqual(restored.planRevisions.at(-1).previousUnshown,[]);assert.equal(restored.planRevisions.at(-1).batchNotes[0].status,'preserved');assert.deepEqual(prepareJourneySession(restored,changed,7000),restored);
});

test('v2 throughv5 shown maps, appraisals and capped keep questions survive the v6 replacement slots unchanged',()=>{
  for(const revision of ['art-profile-50-v2','art-profile-50-v3','art-profile-50-v4','art-profile-50-v5']){
    const data=structuredClone(initial),rounds=sessionJourneyRounds(data),panel=number=>rounds.find(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber===number),evidence=(construct,family,number)=>({journeyRevision:revision,batchIndex:0,construct,family,role:'check',...(number?{panelNumber:number,setId:panel(number).evidence.setId}:{})});
    const map=(id,number)=>({id,kind:'grid',format:'grid',axis:'response',axisDefinition:structuredClone(AXES.response),title:'The saved tension and attention question.',hint:'The original instruction.',works:[...panel(number).works].reverse(),evidence:evidence('response','felt-response',number)}),keep=(id)=>({...structuredClone(rounds.find(round=>round.id==='journey-009')),id,maxChoices:3,title:'Which would you keep?',hint:'Choose up to three paintings.',evidence:{...evidence('capped-contextual-selection','selection-grid'),instrumentRevision:'familiarity-shortlist-grid-v1'}});
    const old=[map('journey-015',5),map('journey-019',8),{id:'journey-027',kind:'spectrum',format:'spectrum',criterion:'preference',title:'How unexpected is each painting?',hint:'This is separate from whether you prefer it.',scale:{left:'As expected',right:'Unexpected'},works:panel(10).works,evidence:evidence('reported-unexpectedness','looking-appraisal',10)},keep('journey-009'),keep('journey-042')];
    for(const round of old){data.plan[Number(round.id.slice(-3))-1]=snapshotStudyRound(round);data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);assert.ok(validStudyAnswer(round,data.answers[round.id]));}
    data.manifest.journeyRevision=revision;data.index=42;data.screen='question';const before=structuredClone(data),restored=prepareJourneySession(data,works,10000),actual=sessionJourneyRounds(restored);
    assert.deepEqual(data,before);assert.deepEqual(restored.shown,before.shown);assert.deepEqual(restored.answers,before.answers);assert.deepEqual(restored.manifest.catalogue,before.manifest.catalogue);assert.equal(restored.manifest.journeyRevision,JOURNEY_REVISION);assert.equal(restored.index,42);
    for(const round of old){const result=actual.find(item=>item.id===round.id);assert.deepEqual(snapshotStudyRound(result),snapshotStudyRound(round));assert.ok(validStudyAnswer(result,restored.answers[round.id]));if(result.kind==='choice-grid'){assert.equal(result.maxChoices,3);assert.equal(validStudyAnswer(result,{...restored.answers[round.id],selectedIds:ids(result).slice(0,4)}),false);}}
    assert.deepEqual(restored.plan,before.plan,'A started old block may not acquire a replacement liking/map schedule');assert.deepEqual(snapshotStudyRound(actual.find(round=>round.id==='journey-003')),before.plan[2]);assert.deepEqual(prepareJourneySession(restored,works,11000),restored);
  }
});

test('An unfinished or unconfirmed round gates extension; an explicit skip resolves it',()=>{
  const data=finish(structuredClone(initial)),round=sessionJourneyRounds(data).find(round=>round.kind==='spectrum'&&round.evidence.construct==='preference');
  const absent=structuredClone(data);delete absent.answers[round.id];const absentBefore=structuredClone(absent);assert.throws(()=>extendJourneySession(absent,works,3000),/Finish this set/);assert.deepEqual(absent,absentBefore);
  const partial=structuredClone(data);partial.answers[round.id].confirmed=false;assert.throws(()=>extendJourneySession(partial,works,3000),/Finish this set/);
  partial.answers[round.id]={workIds:ids(round),skipped:true};const extended=extendJourneySession(partial,works,3000);assert.equal(extended.plan.length,100);assert.deepEqual(extended.answers[round.id],partial.answers[round.id]);
});

test('New live metadata cannot rewrite the frozen catalogue or an existing shown work',()=>{
  const data=structuredClone(initial),round=sessionJourneyRounds(data)[0];data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);
  const changed=structuredClone(works);for(const work of changed){work.title='Changed current title';work.image='assets/art/a-later-reproduction.jpg';work.features={...work.features,energy:.99};}
  const before=structuredClone(data),restored=prepareJourneySession(data,changed,4000);assert.deepEqual(data,before);assert.deepEqual(restored.manifest.catalogue,before.manifest.catalogue);assert.deepEqual(restored.shown,before.shown);assert.deepEqual(restored.answers,before.answers);assert.deepEqual(sessionJourneyRounds(restored)[0],round);
  const complete=finish(restored),extended=extendJourneySession(complete,changed,5000);assert.deepEqual(extended.manifest.catalogue,initial.manifest.catalogue);assert.deepEqual(sessionJourneyRounds(extended)[0],round);assert.deepEqual(extended.plan.slice(0,50),initial.plan);
});

test('Extending may add a real new catalogue entry while preserving every existing source object',()=>{
  const withheld=works.at(-1),original=works.slice(0,-1),data=finish(prepareJourneySession(null,original,1000)),before=structuredClone(data),extended=extendJourneySession(data,works,3000);
  assert.equal(extended.manifest.catalogue.length,works.length);assert.deepEqual(extended.manifest.catalogue.slice(0,original.length),before.manifest.catalogue);assert.deepEqual(extended.manifest.catalogue.at(-1),withheld);assert.deepEqual(extended.plan.slice(0,50),before.plan);assert.deepEqual(extended.answers,before.answers);assert.deepEqual(extended.shown,before.shown);assert.deepEqual(data,before);
});

test('A design revision preserves a started block, including pending wording and malformed answer-owned definitions',()=>{
  const data=structuredClone(initial),first=data.plan[0],answerOnly=data.plan[1],pending=data.plan[2];
  first.title='Already shown wording';data.shown[first.id]=structuredClone(first);
  answerOnly.title='Answered definition without presentation metadata';data.answers[answerOnly.id]={workIds:[...answerOnly.workIds],points:{},confirmed:false};
  pending.title='Old pending wording';data.manifest.journeyRevision='earlier-test-revision';
  const before=structuredClone(data),updated=prepareJourneySession(data,works,6000);assert.deepEqual(data,before);assert.deepEqual(updated.plan,before.plan);assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.equal(updated.manifest.journeyRevision,JOURNEY_REVISION);assert.equal(updated.plan[2].title,'Old pending wording');
  const revision=updated.planRevisions.at(-1);assert.equal(revision.from,'earlier-test-revision');assert.equal(revision.to,JOURNEY_REVISION);assert.deepEqual(revision.previousUnshown,[]);assert.equal(revision.batchNotes[0].status,'preserved');assert.match(revision.batchNotes[0].reason,/already been started/);
  const rounds=sessionJourneyRounds(updated);assert.equal(rounds[0].title,'Already shown wording');assert.equal(rounds[1].unavailable,true);assert.deepEqual(updated.answers[answerOnly.id],before.answers[answerOnly.id]);
  const unchanged=prepareJourneySession(updated,works,7000);assert.deepEqual(unchanged,updated,'The same revision must not regenerate pending definitions again');
});

test('A same-revision catalogue addition preserves existing metadata and recorded questions, including falsy malformed answers',()=>{
  const original=works.slice(0,59),data=prepareJourneySession(null,original,1000),round=sessionJourneyRounds(data)[0];data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);
  data.plan[1].title='The question associated with a retained null response';data.answers[data.plan[1].id]=null;
  const before=structuredClone(data),live=works.map(work=>({...work,title:'New live title '+work.id,features:{...work.features,energy:.99}})),updated=prepareJourneySession(data,[...live,structuredClone(live.at(-1))],6000);
  assert.equal(before.manifest.journeyRevision,JOURNEY_REVISION);assert.deepEqual(data,before);assert.equal(updated.manifest.catalogue.length,works.length);assert.equal(new Set(updated.manifest.catalogue.map(work=>work.id)).size,works.length);assert.deepEqual(updated.manifest.catalogue.slice(0,original.length),before.manifest.catalogue);
  const added=live.filter(work=>!original.some(old=>old.id===work.id));assert.deepEqual(updated.manifest.catalogue.slice(original.length),added);assert.deepEqual(updated.manifest.catalogueAdditions.at(-1).workIds,added.map(work=>work.id));assert.deepEqual(updated.plan.slice(0,2),before.plan.slice(0,2));assert.deepEqual(updated.answers,before.answers);assert.deepEqual(updated.shown,before.shown);
  const revision=updated.planRevisions.at(-1);assert.equal(revision.reason,'catalogue-growth');assert.equal(revision.from,JOURNEY_REVISION);assert.equal(revision.to,JOURNEY_REVISION);assert.ok(revision.previousUnshown.every(snapshot=>!Object.hasOwn(before.answers,snapshot.id)&&!Object.hasOwn(before.shown,snapshot.id)));
  assert.deepEqual(prepareJourneySession(updated,live,7000),updated,'Repeated reloads must not duplicate additions or regenerate the same plan again');
});

test('A partially completed older100-round study retains its entire pending adaptive block and frozen source evidence',()=>{
  const data=adaptiveMigrationSession(),rounds=sessionJourneyRounds(data);
  for(const original of rounds.slice(50,58)){const round=structuredClone(original);if(round.kind==='grid'){round.axis='response';round.axisDefinition=structuredClone(AXES.response);round.title='Already shown legacy involvement question';round.evidence={...round.evidence,construct:'response',family:'felt-response',journeyRevision:'art-profile-50-v2'};}data.plan[Number(round.id.slice(-3))-1]=snapshotStudyRound(round);data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);}
  const pendingMap=data.plan.slice(58).find(round=>round.kind==='grid');pendingMap.axis='response';pendingMap.axisDefinition=structuredClone(AXES.response);pendingMap.title='Unshown legacy involvement question';pendingMap.evidence={...pendingMap.evidence,construct:'response',family:'felt-response'};
  data.manifest.journeyRevision='art-profile-50-v2';data.index=58;data.screen='question';const before=structuredClone(data),updated=prepareJourneySession(data,works,7000),resolved=sessionJourneyRounds(updated),selection=before.batches[0].selection.panels;
  assert.deepEqual(data,before);assert.deepEqual(updated.plan.slice(0,58),before.plan.slice(0,58));assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.deepEqual(updated.batches,before.batches);assert.equal(updated.target,100);assert.equal(updated.index,58);assert.equal(updated.screen,'question');
  assert.equal(resolved.find(round=>round.title==='Already shown legacy involvement question').axisDefinition.top,'Absorbed');assert.equal(resolved.find(round=>round.id===pendingMap.id).axis,'response');assert.deepEqual(updated.plan,before.plan);
  for(const round of resolved.slice(58).filter(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber)){
    const panel=selection[round.evidence.panelNumber-1],role=panel.role==='repeat'?'repeat':['probe','recontextualization','challenge'].includes(panel.role)?'probe':'discovery';assert.equal(round.evidence.role,role);assert.equal(round.evidence.adaptivePanelRole,panel.role);assert.deepEqual(new Set(ids(round)),new Set(panel.workIds));
    if(panel.role==='repeat'){assert.equal(round.evidence.repeatOf,panel.repeatOf);const source=resolved.find(source=>source.id===panel.repeatOf);assert.equal(round.title,source.title);assert.equal(round.hint,source.hint);assert.deepEqual(round.scale,source.scale);}
    if(panel.role==='challenge'){assert.deepEqual(round.evidence.adaptiveSelection.provisionalHypothesis,panel.provisionalHypothesis);assert.equal(round.evidence.adaptiveSelection.provisionalPrediction,panel.provisionalPrediction);assert.equal(round.evidence.adaptiveSelection.comparisonNovel,panel.comparisonNovel);}
  }
  const revision=updated.planRevisions.at(-1);assert.deepEqual(revision.previousUnshown,[]);assert.equal(revision.batchNotes.find(note=>note.offset===50).status,'preserved');assert.match(revision.batchNotes.find(note=>note.offset===50).reason,/already been started/);assert.deepEqual(prepareJourneySession(updated,works,8000),updated);
  const completed=finish(updated),completedBefore=structuredClone(completed),extended=extendJourneySession(completed,works,9000);assert.equal(extended.target,150);assert.deepEqual(completed,completedBefore);assert.deepEqual(extended.answers,completedBefore.answers);assert.deepEqual(extended.plan.slice(0,100),completedBefore.plan);
});

test('A conflicting shown legacy map cannot rebind the retained preference definition or inherit its prediction',()=>{
  for(const role of ['repeat','challenge']){
    const data=adaptiveMigrationSession(),selection=data.batches[0].selection.panels,number=selection.findIndex(panel=>panel.role===role)+1;assert.ok(number);
    const available=sessionJourneyRounds(data).slice(50),originalMap=available.find(round=>round.kind==='grid'&&round.evidence.panelNumber===number),pref=available.find(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber===number);assert.ok(pref);
    // Earlier saved schedules can contain a map where the current schedule has
    // a contrast. The migration must honour that real, conflicting binding too.
    const replacement=works.filter(work=>!selection[number-1].workIds.includes(work.id)).slice(0,3),shown={id:originalMap?.id||'journey-054',kind:'grid',format:'grid',axis:'response',axisDefinition:structuredClone(AXES.response),title:'An actual saved map for this older panel.',hint:'Place its original works by tension and involvement.',works:replacement,evidence:{journeyRevision:'art-profile-50-v2',batchIndex:1,panelNumber:number,setId:pref.evidence.setId,construct:'response',family:'felt-response',role:'check'}};
    data.plan[Number(shown.id.slice(-3))-1]=snapshotStudyRound(shown);data.shown[shown.id]=snapshotStudyRound(shown);data.answers[shown.id]=completeAnswer(shown);data.manifest.journeyRevision='art-profile-50-v2';const before=structuredClone(data),updated=prepareJourneySession(data,works,7000),revised=sessionJourneyRounds(updated).find(round=>round.id===pref.id);
    assert.deepEqual(data,before);assert.deepEqual(updated.plan,before.plan);assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.deepEqual(updated.batches,before.batches);assert.deepEqual(new Set(ids(revised)),new Set(ids(pref)));assert.deepEqual(revised.evidence,pref.evidence);assert.notDeepEqual(new Set(ids(revised)),new Set(replacement.map(work=>work.id)));
    const retainedMap=sessionJourneyRounds(updated).find(round=>round.id===shown.id);assert.deepEqual(snapshotStudyRound(retainedMap),snapshotStudyRound(shown));assert.equal(retainedMap.evidence.adaptiveSelection,undefined);assert.equal(retainedMap.evidence.provisionalPrediction,undefined);assert.equal(updated.planRevisions.at(-1).batchNotes.find(note=>note.offset===50).status,'preserved');assert.deepEqual(updated.planRevisions.at(-1).previousUnshown,[]);
  }
});

test('A later batch without its saved selector retains pending definitions rather than inventing nonadaptive replacements',()=>{
  const data=adaptiveMigrationSession();data.batches=[];data.manifest.journeyRevision='earlier-without-selector';const before=structuredClone(data),updated=prepareJourneySession(data,works,7000);
  assert.deepEqual(data,before);assert.deepEqual(updated.plan,before.plan);assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.deepEqual(updated.batches,[]);assert.equal(updated.manifest.journeyRevision,JOURNEY_REVISION);const note=updated.planRevisions.at(-1).batchNotes.find(note=>note.offset===50);assert.equal(note.status,'preserved');assert.match(note.reason,/adaptive selection is unavailable/);assert.deepEqual(prepareJourneySession(updated,works,8000),updated);
});

test('Partially shownv2 questions keep responses, labels, catalogue and all still-pending source bindings',()=>{
  const savedCatalogue=works.slice(0,59),data=prepareJourneySession(null,savedCatalogue,1000),offered=savedCatalogue.slice(0,4),oldEvidence={journeyRevision:'art-profile-50-v2',batchIndex:0,panelNumber:1,setId:'journey-panel-01'};
  const preference={id:'journey-001',kind:'spectrum',format:'spectrum',criterion:'preference',title:'The v2 preference wording actually shown.',hint:'The original instruction actually shown.',scale:{left:'Less preferred',right:'More preferred'},works:offered,evidence:{...oldEvidence,construct:'preference',family:'individual-choice',role:'discovery'}},response={id:'journey-003',kind:'grid',format:'grid',axis:'response',axisDefinition:structuredClone(AXES.response),title:'Tension and attention.',hint:'The original tension and involvement instruction.',works:[...offered].reverse(),evidence:{...oldEvidence,construct:'response',family:'felt-response',role:'check'}},curiosity={id:'journey-009',kind:'spectrum',format:'spectrum',criterion:'interest',title:'How much do you want to understand each painting?',hint:'The original curiosity instruction.',scale:{left:'Little wish to investigate',right:'Strong wish to investigate'},works:[...offered].reverse(),evidence:{...oldEvidence,construct:'curiosity',family:'interest',role:'check'}};
  for(const round of [preference,response,curiosity]){const index=Number(round.id.slice(-3))-1;data.plan[index]=snapshotStudyRound(round);data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]=completeAnswer(round);assert.ok(validStudyAnswer(round,data.answers[round.id]));}
  data.manifest.journeyRevision='art-profile-50-v2';data.plan[4].title='An unshown older decision';
  const before=structuredClone(data),changed=works.map(work=>({...work,title:'Later live title',image:'assets/later-image.jpg',features:{...work.features,energy:.99}})),updated=prepareJourneySession(data,changed,7000),resolved=sessionJourneyRounds(updated);
  assert.deepEqual(data,before);assert.deepEqual(updated.manifest.catalogue.slice(0,savedCatalogue.length),before.manifest.catalogue);assert.deepEqual(updated.manifest.catalogue.slice(savedCatalogue.length),changed.filter(work=>!savedCatalogue.some(saved=>saved.id===work.id)));assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.equal(updated.manifest.journeyRevision,JOURNEY_REVISION);
  for(const round of [preference,response,curiosity]){assert.deepEqual(updated.plan[Number(round.id.slice(-3))-1],snapshotStudyRound(round));const actual=resolved.find(item=>item.id===round.id);assert.equal(actual.title,round.title);assert.equal(actual.hint,round.hint);assert.deepEqual(ids(actual),ids(round));assert.ok(validStudyAnswer(actual,updated.answers[round.id]));}
  const oldMap=resolved.find(round=>round.id===response.id);assert.equal(oldMap.axisDefinition.top,'Absorbed');assert.equal(oldMap.axisDefinition.bottom,'Unmoved');assert.equal(oldMap.axis,'response');
  const pendingMap=resolved.find(round=>round.id==='journey-004');assert.deepEqual(snapshotStudyRound(pendingMap),before.plan[3]);assert.deepEqual(updated.plan,before.plan);assert.equal(updated.plan[4].title,'An unshown older decision');assert.deepEqual(updated.planRevisions.at(-1).previousUnshown,[]);assert.equal(updated.planRevisions.at(-1).batchNotes[0].status,'preserved');
  const finding=analyzeStudy(updated.manifest.catalogue,resolved,updated.answers).findings.find(item=>item.id==='study-curiosity');assert.ok(finding);assert.deepEqual(new Set(finding.support.map(item=>item.roundId)),new Set([preference.id,curiosity.id]));
});

test('A story answer requires both exact five-point ratings, its actual work and seeing the story',()=>{
  const story=legacyV11Rounds().find(round=>round.contextMode==='preference-before-after-v1'),valid={workIds:ids(story),workId:ids(story)[0],before:0,after:100,storySeen:true};assert.ok(story);assert.ok(validAnswer(story,valid));assert.ok(validStudyAnswer(story,valid));
  for(const mutate of [answer=>delete answer.before,answer=>delete answer.after,answer=>answer.before=null,answer=>answer.before='25',answer=>answer.before=20,answer=>answer.after=NaN,answer=>answer.storySeen=false,answer=>answer.workId='another-work',answer=>answer.workIds=['another-work'],answer=>answer.skipped=true]){const answer=structuredClone(valid);mutate(answer);assert.equal(validAnswer(story,answer),false);assert.equal(validStudyAnswer(story,answer),false);}
  for(const value of [0,25,50,75,100])assert.ok(validAnswer(story,{...valid,before:value,after:value}));
});

test('Earlier generic before/after draft sanitising preserves zero, partial progress and source identity without fabricating a baseline',()=>{
  const story=structuredClone(legacyV11Rounds().find(round=>round.contextMode==='preference-before-after-v1'));delete story.symbolismProtocol;delete story.evidence.family;const workId=ids(story)[0],before=sanitizeDraft(story,{workId,before:0,after:100,storySeen:false});assert.equal(before.before,0);assert.equal(before.after,undefined);assert.equal(before.storySeen,false);assert.equal(before.stage,'before');assert.deepEqual(before.workIds,ids(story));assert.equal(validAnswer(story,before),false);
  const after=sanitizeDraft(story,{workId,before:0,after:100,storySeen:true});assert.equal(after.before,0);assert.equal(after.after,100);assert.equal(after.stage,'after');assert.equal(validAnswer(story,after),true);
  const missing=sanitizeDraft(story,{workId,after:75,storySeen:true});assert.equal(missing.before,undefined);assert.equal(missing.after,75);assert.equal(validAnswer(story,missing),false);
  const changed=sanitizeDraft(story,{workId:'another-work',before:25,after:75,storySeen:true});assert.equal(changed.workId,workId);assert.equal(changed.before,undefined);assert.equal(changed.after,undefined);assert.equal(changed.storySeen,false);assert.equal(changed.stage,'before');
});

test('Museum exposure preserves seen-but-unplaced uncertainty and does not presume all offered works were viewed',()=>{
  const data=finish(structuredClone(initial)),rounds=sessionJourneyRounds(data),museum=rounds.find(round=>round.kind==='exercise'&&round.exerciseKind==='curate'),otherExerciseIds=new Set(rounds.filter(round=>round.kind==='exercise'&&round.id!==museum.id).flatMap(ids));
  let record=createGalleryRecord(museum.works,{}, {id:'museum-exposure',now:1000});const mounted=museum.works.slice(0,6).map(work=>work.id);
  for(let i=0;i<mounted.length;i++){const slot=gallerySlots(record).find(slot=>slot.roomId===(i<3?'g1':'g3'));assert.ok(slot);const result=placePainting(record,mounted[i],slot.wallId,slot.t);assert.ok(result.ok);record=result.record;}
  const extra=museum.works.filter(work=>!mounted.includes(work.id)&&!otherExerciseIds.has(work.id)).slice(0,3).map(work=>work.id);assert.equal(extra.length,3);record.presentedIds=[...mounted,...extra];record.phase='walkthrough';record.roomResponses={entryId:mounted[0],lingerRoomId:'g1',bridgeIds:[mounted[0],mounted[3]]};record.confirmed=true;record.finishedAt=2000;assert.ok(validGallery(record,museum.works));
  data.answers[museum.id]={workIds:ids(museum),record};assert.ok(validStudyAnswer(museum,data.answers[museum.id]));
  const extended=extendJourneySession(data,works,3000),coverage=extended.batches.at(-1).selection.coverage;assert.ok(coverage.exposureUnknownRoundIds.includes(museum.id));for(const id of extra)assert.ok(coverage.exposureUnknownWorkIds.includes(id));
  const unpresented=museum.works.find(work=>!record.presentedIds.includes(work.id)&&!otherExerciseIds.has(work.id)&&!rounds.some(round=>round.kind==='statements'&&ids(round).includes(work.id)));assert.ok(unpresented);
  const expected=rounds.filter(round=>round.id!==museum.id&&round.evidence?.stimulusVisibility!=='not-shown'&&(round.evidence?.instrumentRevision==='paged-favourites-v1'?(choiceGridExposure(round,data.answers[round.id])?.presentedIds||[]):[...round.works,...(round.anchorWorks||[])].map(work=>work.id)).includes(unpresented.id)).length;assert.equal(coverage.exposureBefore[unpresented.id],expected,'The museum source tray is offered, but only recorded presentation increments exposure; actual neighbour anchors still count');
});

test('A shown agreement question with an explicitly hidden artwork does not count as viewing that work',()=>{
  const data=structuredClone(initial),rounds=sessionJourneyRounds(data),claim=rounds.find(round=>round.kind==='statements'&&round.evidence.stimulusVisibility==='not-shown');assert.ok(claim);
  for(const round of rounds)data.answers[round.id]={workIds:ids(round),skipped:true};
  data.shown[claim.id]=snapshotStudyRound(claim);data.answers[claim.id]=completeAnswer(claim);assert.ok(validStudyAnswer(claim,data.answers[claim.id]));
  const extended=extendJourneySession(data,works,3000),coverage=extended.batches.at(-1).selection.coverage;
  for(const id of ids(claim))assert.equal(coverage.exposureBefore[id],0,'The work exists only as an unshown reference for strict answer identity');
});

test('Matching-protocol sessions retain malformed answer and presentation containers as unmapped originals',()=>{
  for(const value of [null,false,0,'',[{roundId:'old',original:{preserve:'nested data'}}],'an older answer format']){
    const saved=structuredClone(initial);saved.answers=structuredClone(value);saved.shown=structuredClone(value);const before=structuredClone(saved),restored=prepareJourneySession(saved,works,5000);
    assert.deepEqual(saved,before);assert.equal(restored.manifest.protocol,initial.manifest.protocol);assert.deepEqual(restored.plan,before.plan);assert.deepEqual(restored.manifest.catalogue,before.manifest.catalogue);
    assert.deepEqual(restored.answers,{});assert.deepEqual(restored.shown,{});assert.equal(Object.hasOwn(restored,'unmappedAnswers'),true);assert.equal(Object.hasOwn(restored,'unmappedShown'),true);assert.deepEqual(restored.unmappedAnswers,value);assert.deepEqual(restored.unmappedShown,value);
    const roundTrip=prepareJourneySession(JSON.parse(JSON.stringify(restored)),works,6000);assert.deepEqual(roundTrip.unmappedAnswers,value);assert.deepEqual(roundTrip.unmappedShown,value);assert.deepEqual(roundTrip.answers,{});assert.deepEqual(roundTrip.shown,{});
  }
});

test('An unmapped container does not erase the other valid saved container',()=>{
  const saved=structuredClone(initial),first=sessionJourneyRounds(saved)[0];saved.shown[first.id]=snapshotStudyRound(first);saved.answers='malformed answer container';const restored=prepareJourneySession(saved,works,5000);assert.deepEqual(restored.shown,saved.shown);assert.equal(Object.hasOwn(restored,'unmappedShown'),false);assert.equal(restored.unmappedAnswers,saved.answers);
  const savedAnswer={...completeAnswer(first),customPreservedField:{value:'retained'}};saved.answers={[first.id]:savedAnswer};saved.shown=['malformed presentation container'];const other=prepareJourneySession(saved,works,5000);assert.deepEqual(other.answers,saved.answers);assert.deepEqual(other.unmappedShown,saved.shown);assert.equal(Object.hasOwn(other,'unmappedAnswers'),false);
});

test('Study repeat analysis excludes changed titles, hints and scales even when the paintings and declared construct match',()=>{
  const first=sessionJourneyRounds(initial).find(round=>round.evidence.construct==='preference'),before={...structuredClone(first),id:'before',works:first.works.slice(0,2),title:'Which do you prefer?',hint:'Place the two works by preference.',scale:{left:'Less preferred',right:'More preferred'},evidence:{construct:'preference',family:'individual-choice',role:'discovery',setId:'same-works'}},repeat={...structuredClone(before),id:'after',works:[...before.works].reverse(),evidence:{...before.evidence,role:'repeat',repeatOf:'before'}},answers={before:completeAnswer(before),after:completeAnswer(repeat)};
  assert.ok(validStudyAnswer(before,answers.before));assert.ok(validStudyAnswer(repeat,answers.after));const exact=analyzeStudy(works,[before,repeat],answers);assert.equal(exact.repeatsCompared,1);assert.ok(exact.findings.some(finding=>finding.id==='study-repeat'));
  for(const mutate of [round=>round.title='Which would you choose for a quiet room?',round=>round.hint='Choose for a particular purpose.',round=>round.scale={left:'Less fitting',right:'More fitting'},round=>delete round.hint,round=>delete round.scale]){const changed=structuredClone(repeat);mutate(changed);assert.ok(validStudyAnswer(changed,answers.after),'The answer can remain valid for its changed question');const result=analyzeStudy(works,[before,changed],answers);assert.equal(result.repeatsCompared,0);assert.equal(result.repeatsWithClearReversal,0);assert.equal(result.findings.some(finding=>finding.id==='study-repeat'),false);}
});
