import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {buildJourneyRounds,journeyCurationNotes} from '../../public/art-atlas/journey-bank.mjs';
import {buildStudyRounds} from '../../public/art-atlas/question-bank.mjs';
import {isDeferredEastAsianWork,isDeferredSouthAsianHimalayanWork,isWesternAmericasWork,isLaterCurationWork} from '../../public/art-atlas/curation-sequence.mjs';
import {reservationPoolKeys} from '../../public/art-atlas/stimulus-planner.mjs';
import {isFinalRefinementRound,bindFinalRefinementRound} from '../../public/art-atlas/final-refinement.mjs';
import {resolveArtworkAttributes} from '../../public/art-atlas/taste-patterns.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {createActiveStudyPersistence,loadActiveStudy} from '../../public/art-atlas/active-study-storage.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),reviews=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artwork-attribute-reviews.json',import.meta.url),'utf8'));
const notes=journeyCurationNotes(works),rounds=buildJourneyRounds(works),ids=round=>round.works.map(work=>work.id),main=rounds.filter(round=>round.kind==='spectrum'&&round.evidence.construct==='preference'&&round.evidence.role==='discovery'),eligible=works.filter(work=>work.eligibleForStudy!==false&&work.studyEligible!==false&&work.decorativeOnly!==true);

test('The actual expanded route keeps Western/Americas classics and requested anchors early while staging Asian collections accurately',()=>{
  assert.ok(eligible.length>=450);assert.equal(main.length,18);const first=main.flatMap(round=>round.works);assert.equal(new Set(first.map(work=>work.id)).size,72);
  assert.ok(first.filter(work=>isWesternAmericasWork(work,notes)).length>=68);assert.ok(first.every(work=>!isLaterCurationWork(work,notes)));assert.ok(first.some(work=>work.id==='study-hokusai-great-wave'));
  assert.equal(isDeferredEastAsianWork(works.find(work=>work.id==='green-tara'),notes),false,'Tibetan tradition is not labelled East Asian.');assert.equal(isDeferredSouthAsianHimalayanWork(works.find(work=>work.id==='green-tara'),notes),true);
  const imageQuestions=rounds.slice(0,45).filter(round=>round.kind!=='statements'&&!(round.kind==='exercise'&&round.exerciseKind==='curate'));
  assert.ok(imageQuestions.flatMap(round=>round.works).every(work=>!isLaterCurationWork(work,notes)),'Independent games, maps, source notes and sorting must follow the same early curation.');
  assert.deepEqual(rounds.filter(round=>round.symbolismProtocol).map(round=>round.works[0].id),['add-varo-harmony','add-watts-hope','holbein-ambassadors']);
  for(const batch of [2,3,4]){assert.equal(notes.reservePools['batch'+batch].length,64);assert.ok(notes.reservePools['batch'+batch].every(id=>!isLaterCurationWork(works.find(work=>work.id===id),notes)));}
  const first100=new Set([...first.map(work=>work.id),...notes.reservePools.batch2]),required=eligible.filter(work=>work.curationRole==='required-anchor');assert.ok(required.length>=16);assert.ok(required.every(work=>first100.has(work.id)),'Every eligible requested anchor gets an ordinary first-rating reservation by100.');
  const partition=[...first.map(work=>work.id),...reservationPoolKeys(notes.reservePools).flatMap(name=>notes.reservePools[name])];assert.equal(partition.length,eligible.length);assert.deepEqual(new Set(partition),new Set(eligible.map(work=>work.id)));
  assert.ok(works.filter(work=>work.eligibleForStudy===false||work.studyEligible===false).every(work=>!partition.includes(work.id)));
});

test('The fresh72 offer repeated source-bound quality contrasts, and admiration keeps five exact earlier painting sets',()=>{
  const attributes=new Map(main.flatMap(round=>round.works).map(work=>[work.id,resolveArtworkAttributes(work,{annotationReviews:reviews,currentWorks:works})]));
  const contrastCount=(questions,key)=>questions.filter(round=>{const statuses=round.works.map(work=>attributes.get(work.id)?.attributes?.[key]?.status);return statuses.includes('present')&&statuses.includes('absent');}).length;
  const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);assert.equal(keys.length,16);
  for(const key of keys)assert.ok(contrastCount(main,key)>=3,key+' requires several actual present/absent artwork sets.');
  const admiration=rounds.filter(round=>round.axis==='achievement');assert.equal(admiration.length,5);assert.equal(new Set(admiration.flatMap(ids)).size,20);assert.ok(keys.filter(key=>contrastCount(admiration,key)>=3).length>=12);
  for(const map of admiration){const source=main.find(round=>round.evidence.panelNumber===map.evidence.panelNumber);assert.ok(source);assert.ok(rounds.indexOf(source)<rounds.indexOf(map));assert.deepEqual(new Set(ids(map)),new Set(ids(source)));}
});

function finish(data){
  const fixed=sessionJourneyRounds(data);
  for(let index=0;index<data.plan.length;index++){
    let round=fixed[index];if(data.shown[round.id])continue;
    if(isFinalRefinementRound(round))round=bindFinalRefinementRound({round:restoreStudyRound(data.plan[index],data.manifest.catalogue),works:data.manifest.catalogue,rounds:Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,data.manifest.catalogue)).filter(Boolean),answers:data.answers});
    if(round.unavailable)continue;
    data.shown[round.id]=snapshotStudyRound(round);
    if(round.kind==='spectrum'&&round.evidence.construct==='preference')data.answers[round.id]={confirmed:true,workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,Math.round(i*100/(round.works.length-1))]))};
    else if(round.evidence.explicitFavourites)data.answers[round.id]={workIds:ids(round),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,confirmed:true,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}};
    else data.answers[round.id]={workIds:ids(round),skipped:true,...(round.kind==='exercise'?{record:{kind:round.exerciseKind,offeredIds:ids(round),presentedIds:[],placements:{}}}:{})};
    assert.ok(data.answers[round.id].skipped||validStudyAnswer(round,data.answers[round.id]),round.id);
  }
  data.index=data.plan.length-1;data.screen='reading';data.finishedAt=2000;return data;
}

test('The actual460-eligible collection reaches300 with64 new ratings in every later block and saves full source records under a tiny local quota',async t=>{
  let data=prepareJourneySession(null,works,1000);const initialPools=structuredClone(data.manifest.stimulusPlanning.reservations),sizes={fresh:JSON.stringify(data).length};
  finish(data);sizes.at50=JSON.stringify(data).length;
  for(let batch=1;batch<6;batch++){
    const before=structuredClone(data);data=extendJourneySession(data,works,3000+batch);
    assert.deepEqual(data.plan.slice(0,before.plan.length),before.plan);assert.deepEqual(data.shown,before.shown);assert.deepEqual(data.answers,before.answers);assert.deepEqual(data.manifest.catalogue,before.manifest.catalogue);
    assert.deepEqual(data.manifest.stimulusPlanning.reservations,initialPools);
    const selection=data.batches.at(-1).selection;assert.equal(selection.coverage.firstRatingTarget,64);assert.equal(selection.coverage.firstRatingTargetMet,true);assert.equal(selection.coverage.firstRatingTargetFeasible,true);assert.deepEqual(new Set(selection.coverage.firstRatingWorkIds),new Set(initialPools['batch'+(batch+1)]));const roles=selection.coverage.actualRoles;assert.equal(roles.repeat,1);assert.equal(roles.recontextualization,0);assert.ok([0,1].includes(roles.challenge));assert.equal(roles.exploration,17-roles.challenge);if(!roles.challenge)assert.ok(selection.coverage.fallbackReasons.some(reason=>reason.requestedRole==='challenge'&&reason.actualRole==='exploration'&&/did not support.*prediction/.test(reason.reason)),'An unsupported direction must have an explicit exploration fallback, not an invented prediction.');for(const panel of selection.panels.filter(panel=>panel.role==='challenge'))assert.ok(panel.provisionalHypothesis&&panel.provisionalPrediction);finish(data);
  }
  assert.equal(data.plan.length,300);sizes.at300=JSON.stringify(data).length;t.diagnostic('Serialized active study characters: '+JSON.stringify(sizes));
  const values=new Map(),database=new Map(),storage={getItem:key=>values.get(key)||null,setItem(key,value){if(value.length>2048)throw Error('local quota');values.set(key,value);},removeItem:key=>values.delete(key)},store={async put(id,value){database.set(id,structuredClone(value));},async get(id){return structuredClone(database.get(id));},async remove(id){database.delete(id);}};
  const writer=createActiveStudyPersistence({storageKey:'art-profile-journey-v1',storage,store,external:true,delay:10000});const saved=writer.save(()=>JSON.stringify(data),{sessionId:data.manifest.id});await writer.flush();assert.equal(await saved,true);assert.ok(values.get('art-profile-journey-v1').length<500);assert.deepEqual(await loadActiveStudy('art-profile-journey-v1',{storage,store}),data);
});

test('Template-only source-bank selection keeps real instrument backlinks while unknown literal drafts cannot change new bindings',()=>{
  const full=buildStudyRounds(works.filter(work=>work.eligibleForStudy!==false&&work.studyEligible!==false),200),byId=new Map(full.map(round=>[round.id,round]));
  for(const round of rounds.filter(round=>round.bankRoundId)){const source=byId.get(round.bankRoundId);assert.ok(source);assert.equal(source.kind,round.kind);assert.equal(source.criterion,round.criterion);assert.equal(source.field,round.field);}
  const draft=works.slice(0,164).map(work=>{const value=structuredClone(work);delete value.featureSemanticVersion;value.features.narrative=0;value.features.atmosphere=0;return value;}),changed=draft.map(work=>({...structuredClone(work),features:{...work.features,narrative:1,atmosphere:1}}));
  const definitions=pool=>buildStudyRounds(pool,200).map(round=>({id:round.id,workIds:ids(round),contrastKey:round.evidence.contrastKey,contrast:round.evidence.contrast,prediction:round.evidence.provisionalPrediction}));assert.deepEqual(definitions(draft),definitions(changed),'Unreviewed0/1 drafts do not enter distances or contrast selection.');
  const a=buildJourneyRounds(draft),b=buildJourneyRounds(changed);assert.deepEqual(a.map(round=>ids(round)),b.map(round=>ids(round)),'Journey diversity also ignores unreviewed literal drafts.');
  for(const round of buildStudyRounds(draft,200).filter(round=>['narrative','atmosphere'].includes(round.evidence.contrastKey))){assert.equal(round.evidence.contrast,null);assert.equal(round.evidence.provisionalPrediction,null);assert.deepEqual(round.evidence.trainingRoundIds,[]);assert.equal(round.evidence.targetDescriptorUnavailable,true);}
});
