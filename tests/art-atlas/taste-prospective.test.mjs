import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {createGalleryRecord,gallerySlots,placePainting} from '../../public/art-atlas/gallery-model.mjs';
import {createSortingRecord,placeSortingWork} from '../../public/art-atlas/sorting-table.mjs';

const features=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
function fixture(){
  const works=Array.from({length:12},(_,i)=>({id:'w'+i,title:'Work '+i,artist:'Artist '+i,artistKnown:true,image:'assets/art/example.jpg',sourceUrl:'https://museum.example/'+i,features:Object.fromEntries(features.map(key=>[key,key==='abstraction'?(i%3)/2:.5]))}));
  const sources=[0,1,2].map(i=>({id:'source-'+i,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place the works by preference.',works:works.slice(i*3,i*3+3),evidence:{construct:'preference',family:'individual-choice',role:'discovery',setId:'set-'+i,batchIndex:0}}));
  const answer=round=>({workIds:round.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,i*50])),confirmed:true});
  const answers=Object.fromEntries(sources.map(round=>[round.id,answer(round)])),trainingEvidence=sources.map(round=>({...structuredClone(answers[round.id]),roundId:round.id,featureValues:Object.fromEntries(round.works.map(work=>[work.id,work.features.abstraction]))}));
  // Use two works that have not appeared together in any earlier set. They may
  // be familiar individually; the claimed holdout unit is their comparison.
  const check={id:'check',kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place both works by preference.',works:[works[9],works[11]],evidence:{construct:'preference',family:'individual-choice',role:'probe',selectionMethod:'adaptive-panel-plan',adaptivePanelRole:'challenge',batchIndex:1,evidenceRoundIds:sources.map(round=>round.id),adaptiveSelection:{comparisonNovel:true,holdoutUnit:'new-comparison',artworksMayBeFamiliar:true,provisionalPrediction:'w11',provisionalHypothesis:{feature:'abstraction',direction:1,score:.6666666666666666,sourceSetCount:3,artistCount:9,trainingRoundIds:sources.map(round=>round.id),supportingRoundIds:sources.map(round=>round.id),trainingEvidence,testFeatureValues:{w9:0,w11:1}}}}};
  answers.check={workIds:['w9','w11'],criterion:'preference',positions:{w9:10,w11:90},confirmed:true};
  return {works,sources,check,rounds:[...sources,check],answers};
}
const build=input=>buildTastePortrait(input);
const checks=input=>build(input).prospectiveChecks;

test('A completed new-comparison check reports the frozen prediction and its exact earlier evidence',()=>{
  const f=fixture(),p=build(f);assert.equal(p.prospectiveChecks.length,1);const check=p.prospectiveChecks[0];assert.equal(check.status,'matched');assert.equal(check.predictedWorkId,'w11');assert.equal(check.observedWorkId,'w11');assert.equal(check.sourceSetCount,3);assert.equal(check.namedArtistCount,9);assert.deepEqual(check.trainingRoundIds,['source-0','source-1','source-2']);assert.deepEqual(check.trainingEvidence,f.check.evidence.adaptiveSelection.provisionalHypothesis.trainingEvidence);assert.deepEqual(check.testFeatureValues,{w9:0,w11:1});
  const finding=p.observations.find(item=>item.module==='prospective-checks');assert.ok(finding);assert.deepEqual(finding.support.map(item=>item.roundId),['check','source-0','source-1','source-2']);assert.deepEqual(finding.support[0].workIds,['w11','w9']);assert.match(finding.alternatives.join(' '),/not an unseen-artwork test/);assert.equal(Object.hasOwn(check,'accuracy'),false);assert.equal(Object.hasOwn(check,'confidence'),false);assert.equal(p.coverage.distinctPreferenceSets,3);
});

test('A reversal and a near tie describe distinct outcomes without an accuracy percentage',()=>{
  const f=fixture();f.answers.check.positions={w9:90,w11:10};let result=checks(f)[0];assert.equal(result.status,'reversed');assert.equal(result.predictedWorkId,'w11');assert.equal(result.observedWorkId,'w9');assert.match(result.observation.text,/Work 9 clearly ahead/);
  f.answers.check.positions={w9:50,w11:55};result=checks(f)[0];assert.equal(result.status,'near-tie');assert.equal(result.observedWorkId,null);assert.equal(result.gap,5);assert.match(result.observation.text,/close or equal/);
  f.answers.check.positions={w9:40,w11:55};assert.equal(checks(f)[0].status,'matched');f.answers.check.positions={w9:55,w11:40};assert.equal(checks(f)[0].status,'reversed');
});

test('A valid frozen explanation can favour the lower end of an annotation',()=>{
  const f=fixture(),hypothesis=f.check.evidence.adaptiveSelection.provisionalHypothesis;hypothesis.direction=-1;f.check.evidence.adaptiveSelection.provisionalPrediction='w9';for(const snapshot of hypothesis.trainingEvidence)for(const id of snapshot.workIds)snapshot.positions[id]=100-snapshot.positions[id];f.answers.check.positions={w9:90,w11:10};const check=checks(f)[0];assert.ok(check);assert.equal(check.direction,-1);assert.equal(check.predictedWorkId,'w9');assert.equal(check.status,'matched');
});

test('Later answer and descriptor edits cannot refit a frozen prediction',()=>{
  const f=fixture(),original=checks(f)[0];for(const round of f.sources){for(const id of f.answers[round.id].workIds)f.answers[round.id].positions[id]=100-f.answers[round.id].positions[id];}
  for(const work of f.works)work.features.abstraction=1-work.features.abstraction;
  const changed=checks(f)[0];assert.ok(changed);assert.equal(changed.predictedWorkId,original.predictedWorkId);assert.equal(changed.status,original.status);assert.deepEqual(changed.trainingEvidence,original.trainingEvidence);assert.deepEqual(changed.testFeatureValues,original.testFeatureValues);
  for(const round of f.sources)delete f.answers[round.id];assert.equal(checks(f)[0].status,'matched','Complete earlier frozen responses remain readable even when current copies are missing');
});

test('The outcome is unavailable for a partial, skipped, wrong-identity or nonpreference challenge answer',()=>{
  for(const mutate of [f=>delete f.answers.check,f=>f.answers.check.confirmed=false,f=>f.answers.check.skipped=true,f=>delete f.answers.check.positions.w9,f=>f.answers.check.positions.w9=null,f=>f.answers.check.criterion='interest',f=>f.answers.check.workIds.reverse()]){const f=fixture();mutate(f);assert.deepEqual(checks(f),[]);assert.equal(build(f).observations.some(item=>item.module==='prospective-checks'),false);}
});

test('Challenge, probe, adaptive-plan and new-comparison provenance are all required',()=>{
  for(const mutate of [f=>f.check.evidence.role='discovery',f=>f.check.evidence.adaptivePanelRole='exploration',f=>f.check.evidence.selectionMethod='unknown',f=>f.check.evidence.family='contextual-choice',f=>f.check.evidence.construct='curiosity',f=>f.check.evidence.unconditional=false,f=>f.check.evidence.repeatOf='source-0',f=>f.check.anchorWorks=[f.works[0]],f=>f.check.evidence.adaptiveSelection.comparisonNovel=false,f=>f.check.evidence.adaptiveSelection.holdoutUnit='new-artwork',f=>delete f.check.evidence.adaptiveSelection.artworksMayBeFamiliar,f=>delete f.check.evidence.adaptiveSelection.provisionalHypothesis]){const f=fixture();mutate(f);assert.deepEqual(checks(f),[]);}
});

test('Only a two-work check with a known frozen feature contrast and an aligned in-pair prediction is admitted',()=>{
  for(const mutate of [f=>{f.check.works.push(f.works[10]);f.answers.check.workIds.push('w10');f.answers.check.positions.w10=50;},f=>f.check.evidence.adaptiveSelection.provisionalPrediction='w0',f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.feature='unknown',f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.direction=0,f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.direction=-1,f=>delete f.check.evidence.adaptiveSelection.provisionalHypothesis.testFeatureValues.w9,f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.testFeatureValues.w9=null,f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.testFeatureValues.w9=.9]){const f=fixture();mutate(f);assert.deepEqual(checks(f),[]);}
});

test('Frozen training records require complete valid values for the actual source question and artworks',()=>{
  for(const mutate of [snapshot=>delete snapshot.positions.w0,snapshot=>snapshot.positions.w0=NaN,snapshot=>snapshot.confirmed=false,snapshot=>snapshot.criterion='interest',snapshot=>snapshot.workIds.reverse(),snapshot=>delete snapshot.featureValues.w0,snapshot=>snapshot.featureValues.w0=null,snapshot=>snapshot.featureValues.w0=-1,snapshot=>snapshot.featureValues.unknown=.5,snapshot=>snapshot.positions={w0:50,w1:50,w2:50}]){const f=fixture();mutate(f.check.evidence.adaptiveSelection.provisionalHypothesis.trainingEvidence[0]);assert.deepEqual(checks(f),[]);}
});

test('Earlier actual source IDs must exist uniquely and cannot leak the check or future answers',()=>{
  for(const mutate of [f=>f.rounds.splice(0,1),f=>f.rounds.push(structuredClone(f.sources[0])),f=>{const first=f.rounds.shift();f.rounds.push(first);},f=>f.sources[0].evidence.construct='curiosity',f=>f.sources[0].evidence.family='contextual-choice',f=>f.sources[0].evidence.batchIndex=1,f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.trainingEvidence[0].roundId='check',f=>f.check.evidence.adaptiveSelection.provisionalHypothesis.trainingRoundIds[0]='check',f=>f.check.evidence.evidenceRoundIds=['source-0','source-1','missing']]){const f=fixture();mutate(f);assert.deepEqual(checks(f),[]);}
});

test('Three source records cannot manufacture three distinct sets or four named artists',()=>{
  const duplicate=fixture(),hypothesis=duplicate.check.evidence.adaptiveSelection.provisionalHypothesis;duplicate.sources[2].works=duplicate.sources[0].works;hypothesis.trainingEvidence[2]={...structuredClone(hypothesis.trainingEvidence[0]),roundId:'source-2'};assert.deepEqual(checks(duplicate),[]);
  const fewArtists=fixture();for(const work of fewArtists.works)work.artist='One Artist';assert.deepEqual(checks(fewArtists),[]);
  const unknown=fixture();for(const work of unknown.works.slice(3,9))work.artistKnown=false;assert.deepEqual(checks(unknown),[]);
  const tooFew=fixture();tooFew.check.evidence.adaptiveSelection.provisionalHypothesis.trainingEvidence.pop();tooFew.check.evidence.adaptiveSelection.provisionalHypothesis.trainingRoundIds.pop();tooFew.check.evidence.evidenceRoundIds.pop();assert.deepEqual(checks(tooFew),[]);
});

test('Frozen support must agree with its stored direction instead of trusting count fields',()=>{
  const f=fixture(),hypothesis=f.check.evidence.adaptiveSelection.provisionalHypothesis;for(const source of hypothesis.trainingEvidence)for(const id of source.workIds)source.positions[id]=100-source.positions[id];assert.deepEqual(checks(f),[]);
  const bogus=fixture();bogus.check.evidence.adaptiveSelection.provisionalHypothesis.supportingRoundIds=['source-0'];assert.deepEqual(checks(bogus),[]);
});

test('A prior co-presentation including anchors invalidates a claimed new comparison',()=>{
  const f=fixture(),prior={id:'earlier-pair',kind:'spectrum',criterion:'preference',works:[f.works[9]],anchorWorks:[f.works[11]],evidence:{construct:'companion',family:'contextual-choice'}};f.rounds.splice(2,0,prior);assert.deepEqual(checks(f),[]);
  prior.works=[f.works[9]];prior.anchorWorks=[];assert.equal(checks(f).length,1,'A single familiar work does not make a pair already compared');
});

test('A hidden statement reference does not count as earlier artwork co-presentation',()=>{
  const f=fixture();f.rounds.splice(0,0,{id:'hidden-reference',kind:'statements',works:[f.works[9],f.works[11]],evidence:{stimulusVisibility:'not-shown'}});assert.equal(checks(f).length,1);
});

function addMuseum(f){
  let record=createGalleryRecord(f.works,{}, {id:'museum',now:1});for(let i=0;i<6;i++){const slot=gallerySlots(record).find(slot=>slot.roomId===(i<3?'g1':'g3'));record=placePainting(record,'w'+i,slot.wallId,slot.t).record;}record.phase='walkthrough';record.roomResponses={entryId:'w0',lingerRoomId:'g1',bridgeIds:['w0','w3']};record.confirmed=true;record.finishedAt=2;
  const round={id:'museum-round',kind:'exercise',exerciseKind:'curate',works:f.works,evidence:{construct:'curate'}};f.rounds.splice(3,0,round);f.answers[round.id]={workIds:f.works.map(work=>work.id),record};return record;
}
test('Museum proof uses actual presentation and mounting rather than all offered paintings',()=>{
  const f=fixture(),record=addMuseum(f);assert.equal(checks(f).length,1,'Unpresented offered works were not presumed viewed together');record.presentedIds.push('w9');assert.deepEqual(checks(f),[],'Seen but unplaced museum work has unknown comparison exposure');
});

test('Missing imported exercise presentation metadata suppresses a novelty claim',()=>{
  const f=fixture();f.rounds.splice(3,0,{id:'imported',kind:'exercise',exerciseKind:'curate',works:f.works,evidence:{construct:'curate'}});f.answers.imported={skipped:true};assert.deepEqual(checks(f),[]);
});

test('Sorting proof respects actual presented IDs and catches an earlier viewed pair',()=>{
  const f=fixture(),offeredIds=['w0','w1','w2','w3','w4','w5','w9','w11'];let record=createSortingRecord(f.works,{},[],{id:'sorting',now:1,offeredIds});const positions=[[.12,.2],[.23,.2],[.7,.2],[.81,.2],[.12,.75],[.23,.75],[.7,.75],[.81,.75]];for(let i=0;i<8;i++)record=placeSortingWork(record,offeredIds[i],positions[i]).record;record.confirmed=true;record.finishedAt=2;const round={id:'sorting-round',kind:'exercise',exerciseKind:'sorting',works:offeredIds.map(id=>f.works.find(work=>work.id===id)),evidence:{construct:'sorting'}};f.rounds.splice(3,0,round);f.answers[round.id]={workIds:offeredIds,record};assert.deepEqual(checks(f),[]);
  delete record.positions.w9;delete record.positions.w11;record.stackOrder=record.stackOrder.filter(id=>!['w9','w11'].includes(id));record.presentedIds=record.presentedIds.filter(id=>!['w9','w11'].includes(id));assert.equal(checks(f).length,1,'Offered works without a presentation record do not invalidate a new pair');
});

test('An eligible earlier repeated set can supply one frozen source without counting as another set',()=>{
  const f=fixture();f.sources[0].evidence.role='repeat';f.sources[0].evidence.repeatOf='an-older-source';assert.equal(checks(f).length,1);assert.equal(checks(f)[0].sourceSetCount,3);
});

test('Actual adaptive-selector challenge snapshots satisfy the portrait contract without refitting',()=>{
  const f=fixture(),more=Array.from({length:48},(_,i)=>({...structuredClone(f.works[i%12]),id:'extra-'+i,artist:'Additional Artist '+i}));f.works.push(...more);const plan=planAdaptivePanels({works:f.works,rounds:f.sources,answers:f.answers,batchIndex:1,seed:'portrait-prospective',panelCount:18}),panel=plan.panels.find(panel=>panel.role==='challenge');assert.ok(panel);
  f.check.works=panel.workIds.map(id=>f.works.find(work=>work.id===id));f.check.evidence.evidenceRoundIds=panel.evidenceRoundIds;f.check.evidence.adaptiveSelection={provisionalHypothesis:panel.provisionalHypothesis,provisionalPrediction:panel.provisionalPrediction,holdoutUnit:panel.holdoutUnit,comparisonNovel:panel.comparisonNovel,artworksMayBeFamiliar:panel.artworksMayBeFamiliar};f.answers.check={workIds:panel.workIds,criterion:'preference',positions:Object.fromEntries(panel.workIds.map(id=>[id,id===panel.provisionalPrediction?90:10])),confirmed:true};const portrait=build(f);assert.equal(portrait.prospectiveChecks.length,1);assert.equal(portrait.prospectiveChecks[0].status,'matched');
});

test('Prospective output is independent copied data and never mutates frozen source records',()=>{
  const f=fixture(),before=structuredClone(f),portrait=build(f);assert.deepEqual(f,before);const check=portrait.prospectiveChecks[0];check.trainingEvidence[0].positions.w0=77;check.testFeatureValues.w9=.8;assert.deepEqual(f,before);for(const item of check.support)for(const id of item.workIds)assert.ok(f.works.some(work=>work.id===id));
});
