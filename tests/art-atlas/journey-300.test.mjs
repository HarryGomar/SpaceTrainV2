import {isDiagnosticRound,bindDiagnosticRound} from '../../public/art-atlas/explanation-followups.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound,prepareStudySession,sessionStudyRounds,createDeepStudy,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {buildJourneyRounds,createJourneyStimulusPlan,journeyAdaptiveQuotas,JOURNEY_MAX_LENGTH} from '../../public/art-atlas/journey-bank.mjs';
import {extendStimulusReservations,reservationPoolKeys} from '../../public/art-atlas/stimulus-planner.mjs';
import {bindFinalRefinementRound,isFinalRefinementRound} from '../../public/art-atlas/final-refinement.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {selectContrastContent,CONTRAST_CONTENT_BANK} from '../../public/art-atlas/contrast-content.mjs';
import {buildStudyRounds} from '../../public/art-atlas/question-bank.mjs';

const catalogue=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const foundation=catalogue.slice(0,164),ids=round=>round.works.map(work=>work.id);
function allocationCatalogue(size=450){
  // These additions are expressly synthetic allocation fixtures. Unknown visual
  // descriptors remain absent; no fixture image is treated as a real artwork.
  return [...foundation,...Array.from({length:size-foundation.length},(_,i)=>({id:'allocation-'+String(i).padStart(3,'0'),title:'Synthetic allocation '+i,artist:'Fixture artist '+i,artistKnown:true,image:'fixture-'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,country:['Mexico','China','France','Egypt'][i%4],movement:'Fixture tradition '+i%25,analysis:{yearRange:[1800+i%120,1800+i%120]},...(i<9?{curationRole:'required-anchor'}:{})}))];
}
const preferenceAnswer=round=>({workIds:ids(round),criterion:'preference',confirmed:true,positions:Object.fromEntries(round.works.map((work,i)=>[work.id,Number.isFinite(work.features?.energy)?Math.round(work.features.energy*100):Math.round(i*100/(round.works.length-1))]))});
function finish(data){
  const fixed=sessionJourneyRounds(data);
  for(let index=0;index<data.plan.length;index++){
    let round=fixed[index];if(data.shown[round.id]||round.unavailable&&!isFinalRefinementRound(round)&&!isDiagnosticRound(round))continue;
    if(isFinalRefinementRound(round))round=bindFinalRefinementRound({round:restoreStudyRound(data.plan[index],data.manifest.catalogue),works:data.manifest.catalogue,rounds:fixed.slice(0,index).filter(source=>data.shown[source.id]).map(source=>restoreStudyRound(data.shown[source.id],data.manifest.catalogue)),answers:data.answers});
    if(isDiagnosticRound(round)&&!data.shown[round.id])round=bindDiagnosticRound({round:restoreStudyRound(data.plan[index],data.manifest.catalogue),works:data.manifest.catalogue,rounds:Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,data.manifest.catalogue)).filter(Boolean),answers:data.answers});
    if(round.unavailable)continue;
    data.shown[round.id]=snapshotStudyRound(round);
    if(round.kind==='spectrum'&&round.evidence.construct==='preference')data.answers[round.id]=preferenceAnswer(round);
    else if(round.evidence.explicitFavourites)data.answers[round.id]={workIds:ids(round),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,confirmed:true,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}};
    else data.answers[round.id]={workIds:ids(round),skipped:true,...(round.kind==='exercise'?{record:{kind:round.exerciseKind,offeredIds:ids(round),presentedIds:[],placements:{}}}:{})};
    assert.ok(data.answers[round.id].skipped||validStudyAnswer(round,data.answers[round.id]),round.id);
  }
  data.index=data.plan.length-1;data.screen='reading';data.finishedAt=2000;return data;
}
let completed;
function trajectory(){
  if(completed)return completed;
  const works=allocationCatalogue(),first=prepareJourneySession(null,works,1000),initialPools=structuredClone(first.manifest.stimulusPlanning.reservations),stages=[];first.manifest.id='six-block-regression';let data=first;
  for(let batch=0;batch<6;batch++){
    finish(data);stages.push(structuredClone(data));
    if(batch===5)break;
    const before=structuredClone(data);data=extendJourneySession(data,works,3000+batch);
    assert.deepEqual(data.plan.slice(0,before.plan.length),before.plan);assert.deepEqual(data.shown,before.shown);assert.deepEqual(data.answers,before.answers);assert.deepEqual(data.manifest.catalogue,before.manifest.catalogue);assert.deepEqual(data.manifest.stimulusPlanning.reservations,initialPools);
  }
  return completed={works,data,stages,initialPools};
}

test('A450-work route partitions the initial72, five64-work releases and58 explicit overflow works',()=>{
  const works=allocationCatalogue(),plan=createJourneyStimulusPlan({works}),pools=plan.reservations;
  assert.equal(plan.complete,true);assert.equal(plan.coverage.firstRatingWorkIds.length,72);for(let batch=2;batch<=6;batch++)assert.equal(pools['batch'+batch].length,64);assert.equal(pools.batch7.length,58);
  const partition=[...plan.coverage.selectedWorkIds,...reservationPoolKeys(pools).flatMap(name=>pools[name])];assert.equal(partition.length,450);assert.equal(new Set(partition).size,450);assert.ok(works.filter(work=>work.curationRole==='required-anchor').every(work=>pools.batch2.includes(work.id)||pools.batch3.includes(work.id)));
  assert.deepEqual(journeyAdaptiveQuotas(1,pools),{exactRepeats:1,recontextualizations:0,challenges:1,minExplorationShare:16/18});
});

test('All six50-block extensions retain prior records, introduce64 newly rated works and keep protected comparisons',()=>{
  const {data,stages,initialPools}=trajectory();assert.equal(JOURNEY_MAX_LENGTH,300);assert.deepEqual(stages.map(stage=>stage.plan.length),[50,100,150,200,250,300]);assert.equal(new Set(data.plan.map(round=>round.id)).size,300);
  const initial=new Set(data.manifest.stimulusPlanning.boundMainWorkIds),rated=new Set(initial);
  for(const batch of data.batches){
    assert.equal(batch.selection.coverage.firstRatingTarget,64);assert.equal(batch.selection.coverage.firstRatingTargetMet,true);assert.equal(batch.selection.coverage.firstRatingTargetFeasible,true);const roles=batch.selection.coverage.actualRoles;assert.equal(roles.repeat,1);assert.equal(roles.recontextualization,0);assert.ok([0,1].includes(roles.challenge));assert.equal(roles.exploration,17-roles.challenge);if(!roles.challenge)assert.ok(batch.selection.coverage.fallbackReasons.some(reason=>reason.requestedRole==='challenge'&&reason.actualRole==='exploration'&&/did not support.*prediction/.test(reason.reason)));for(const panel of batch.selection.panels.filter(panel=>panel.role==='challenge'))assert.ok(panel.provisionalHypothesis&&panel.provisionalPrediction);
    assert.deepEqual(new Set(batch.selection.coverage.firstRatingWorkIds),new Set(initialPools['batch'+(batch.index+1)]));for(const id of batch.selection.coverage.firstRatingWorkIds){assert.equal(rated.has(id),false);rated.add(id);}
    const rounds=sessionJourneyRounds(data).slice(batch.offset,batch.offset+50);for(const round of rounds.filter(round=>round.evidence.role==='repeat'&&round.kind==='spectrum')){const source=sessionJourneyRounds(data).find(item=>item.id===round.evidence.repeatOf);assert.equal(round.title,source.title);assert.equal(round.hint,source.hint);assert.deepEqual(round.scale,source.scale);assert.deepEqual(new Set(ids(round)),new Set(ids(source)));}
  }
  assert.equal(rated.size,392);assert.ok(initialPools.batch7.every(id=>!rated.has(id)));assert.throws(()=>extendJourneySession(data,allocationCatalogue(),9000),/reached 300/);
});

test('A completed300-question saved plan resumes without rewriting any shown source or response',()=>{
  const {data,works}=trajectory(),before=structuredClone(data),live=works.map(work=>({...work,title:'Changed live title '+work.id,features:undefined})),restored=prepareJourneySession(data,live,10000),rounds=sessionJourneyRounds(restored);
  assert.deepEqual(data,before);assert.deepEqual(restored,before);assert.equal(rounds.length,300);for(const [id,snapshot]of Object.entries(data.shown))assert.deepEqual(snapshotStudyRound(rounds.find(round=>round.id===id)),snapshot);assert.deepEqual(restored.answers,before.answers);
});

test('Growth preserves existing42/46 cohorts and gives required new anchors only new future pools',()=>{
  const initial=createJourneyStimulusPlan({works:foundation}),existing=structuredClone(initial.reservations),works=allocationCatalogue(302),before=structuredClone(existing),expanded=extendStimulusReservations({works,firstWorkIds:initial.coverage.selectedWorkIds,reservationPlan:existing});
  assert.deepEqual(existing,before);assert.deepEqual(expanded.batch2,existing.batch2);assert.deepEqual(expanded.batch3,existing.batch3);assert.deepEqual([expanded.batch4.length,expanded.batch5.length,expanded.batch6.length],[46,46,46]);
  const newer=works.filter(work=>!foundation.some(original=>original.id===work.id)),allocated=reservationPoolKeys(expanded).filter(name=>Number(name.slice(5))>=4).flatMap(name=>expanded[name]);assert.deepEqual(new Set(allocated),new Set(newer.map(work=>work.id)));
  const old42={batch2:existing.batch2.slice(0,42),batch3:existing.batch3.slice(0,42)},legacy=extendStimulusReservations({works,firstWorkIds:[...initial.coverage.selectedWorkIds,...existing.batch2.slice(42),...existing.batch3.slice(42)],reservationPlan:old42});assert.deepEqual(legacy.batch2,old42.batch2);assert.deepEqual(legacy.batch3,old42.batch3);
});

test('A smaller growing catalogue keeps genuine new ratings for every later block instead of exhausting them at200',()=>{
  const plan=createJourneyStimulusPlan({works:allocationCatalogue(302)});assert.deepEqual([2,3,4,5,6].map(batch=>plan.reservations['batch'+batch].length),[46,46,46,46,46]);assert.equal(reservationPoolKeys(plan.reservations).flatMap(name=>plan.reservations[name]).length,230);
  const sixty=createJourneyStimulusPlan({works:allocationCatalogue(372)});assert.deepEqual([2,3,4,5,6].map(batch=>sixty.reservations['batch'+batch].length),[60,60,60,60,60]);assert.deepEqual(journeyAdaptiveQuotas(1,sixty.reservations),{exactRepeats:2,recontextualizations:0,challenges:1,minExplorationShare:15/18});
});

test('A single exact-repeat allocation rotates high, low and middle focus without changing the captured instrument',()=>{
  const {data}=trajectory(),repeats=data.batches.map(batch=>batch.selection.panels.find(panel=>panel.role==='repeat'));assert.ok(repeats.every(Boolean));assert.deepEqual(repeats.map(panel=>panel.focus.band),['relative-high','relative-low','middle','relative-high','relative-low']);for(const panel of repeats){assert.equal(panel.exactRepeat,true);assert.equal(panel.promptSnapshot.criterion,'preference');assert.ok(panel.evidenceRoundIds.includes(panel.repeatOf));}
});

test('Research-only details stay in the catalogue but out of quiz proposals, matching games and reserved first ratings',()=>{
  const works=allocationCatalogue(),research={...foundation[0],id:'research-only-detail',title:'A documented monochrome detail',eligibleForStudy:false,curationRole:'required-anchor'},pool=[...works,research],plan=createJourneyStimulusPlan({works:pool}),rounds=buildJourneyRounds(pool);
  assert.equal(plan.coverage.excludedCatalogueEntries,1);assert.equal(plan.coverage.selectedWorkIds.includes(research.id),false);assert.equal(reservationPoolKeys(plan.reservations).some(name=>plan.reservations[name].includes(research.id)),false);assert.ok(rounds.every(round=>!ids(round).includes(research.id)));
  const source=rounds[0],adaptive=planAdaptivePanels({works:pool,rounds:[source],answers:{[source.id]:preferenceAnswer(source)},batchIndex:1});assert.ok(adaptive.panels.every(panel=>!panel.workIds.includes(research.id)));assert.ok(buildStudyRounds([...foundation,research],300).every(round=>!ids(round).includes(research.id)));
});

test('Reviewed contrast content respects fifth and sixth release pools without changing subject/date guards',()=>{
  const content=CONTRAST_CONTENT_BANK.find(item=>item.kind==='same-subject'&&item.workIds.every(id=>foundation.some(work=>work.id===id)));assert.ok(content);const pool=content.workIds.map(id=>foundation.find(work=>work.id===id)),notes={proposedFirst18Panels:[],reservePools:{batch2:[],batch3:[],batch4:[],batch5:[],batch6:[...content.workIds]}};
  const early=selectContrastContent({works:pool,notes,kind:'same-subject',batchIndex:4});assert.equal(early.status,'unavailable');assert.ok(early.rejected.some(item=>item.contentId===content.contentId&&/reserved/.test(item.reason)));const released=selectContrastContent({works:pool,notes,kind:'same-subject',batchIndex:5});assert.equal(released.status,'ready');assert.deepEqual(new Set(released.workIds),new Set(content.workIds));
});

test('Legacy200 snapshots survive extension to300, whose extra instruments stay relative and label-exposed',()=>{
  const legacy=prepareStudySession(null,foundation,1000);for(const snapshot of legacy.plan){legacy.shown[snapshot.id]=structuredClone(snapshot);legacy.answers[snapshot.id]={workIds:[...snapshot.workIds],skipped:true};}const before=structuredClone(legacy);legacy.target=300;const expanded=prepareStudySession(legacy,foundation,2000);
  assert.equal(expanded.plan.length,300);assert.deepEqual(expanded.plan.slice(0,200),before.plan);assert.deepEqual(expanded.shown,before.shown);assert.deepEqual(expanded.answers,before.answers);const rounds=sessionStudyRounds(expanded,300);assert.equal(rounds.length,300);assert.ok(rounds.slice(200).every(round=>round.evidence.labelExposure==='after-this-path-label-games'));assert.ok(rounds.slice(200).filter(round=>round.kind==='spectrum'&&round.criterion==='preference').every(round=>round.evidence.appealProtocol===undefined));
});

test('Later-question chrome reports global51/100 progress and a completed300 route offers gallery/new-quiz actions',t=>{
  const descriptors=Object.fromEntries(['localStorage','window','requestAnimationFrame','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));t.after(()=>{for(const [key,descriptor]of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const {stages}=trajectory(),storage=new Map(),app={innerHTML:'',addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};globalThis.window={addEventListener(){},scrollY:0,scrollTo(){},matchMedia:()=>({matches:false})};globalThis.requestAnimationFrame=()=>0;globalThis.document={activeElement:null};
  const input=structuredClone(stages[1]);input.screen='question';input.index=50;storage.set('art-profile-journey-v1',JSON.stringify(input));const study=createDeepStudy({app,getWorks:()=>input.manifest.catalogue,image:work=>'<img data-artwork="'+work.id+'">',esc:value=>String(value??''),keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});study.restore();study.render();assert.match(app.innerHTML,/<span>51 \/ 100<\/span>/);assert.doesNotMatch(app.innerHTML,/<span>1 \/ 50<\/span>/);
  const final=structuredClone(stages[5]);storage.set('art-profile-journey-v1',JSON.stringify(final));study.restore();study.render();assert.match(app.innerHTML,/data-action="collection">Explore your gallery/);assert.ok(!app.innerHTML.includes('data-action="deep-extend"'));assert.ok(app.innerHTML.includes('data-action="deep-retake"'));
});
