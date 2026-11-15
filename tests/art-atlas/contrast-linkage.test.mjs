import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJourneyRounds,createJourneyStimulusPlan,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
import {sanitizeContrastDraft,validContrastAnswer} from '../../public/art-atlas/contrast-rounds.mjs';
import {buildContrastReadings} from '../../public/art-atlas/contrast-readings.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const notes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
const ids=round=>round.works.map(work=>work.id);
const ordinary=round=>round.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference';
const answerFor=round=>({workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.energy*100)])),confirmed:true});

function fixture(){
  const history=[],answers={},blocks=[],plans=[];let reservationPlan;
  for(let batchIndex=0;batchIndex<3;batchIndex++){
    const seed='editorial-release-audit-'+batchIndex;
    const plan=createJourneyStimulusPlan({works,rounds:history,answers,batchIndex,seed,reservationPlan});reservationPlan=plan.reservations;
    const block=buildJourneyRounds(works,answers,{offset:batchIndex*50,batchIndex,seed,history,panels:plan,reservationPlan});
    for(const round of block)if(ordinary(round)){const answer=answerFor(round);assert.equal(validAnswer(round,answer),true);answers[round.id]=answer;}
    plans.push(plan);blocks.push(block);history.push(...block);
  }
  return{history,answers,blocks,plans};
}

test('The real first150 plans deliberately provide genuine ordinary pair baselines without changing64/18/17 ratings',()=>{
  const {history,answers,blocks,plans}=fixture();
  assert.deepEqual(plans.map(plan=>plan.coverage.firstRatingWorkIds.length),[64,18,17]);
  for(const panel of notes.proposedFirst18Panels){const round=blocks[0].find(round=>ordinary(round)&&round.evidence.panelNumber===panel.panel);assert.deepEqual([...ids(round)].sort(),[...panel.workIds].sort());}
  const expected=[['journey-019','neighbour-great-wave','journey-005'],['journey-027','keep-six-landmarks-a','journey-001'],['journey-042','subject-adults-children','journey-007'],['journey-092','subject-mountains','journey-049'],['journey-142','subject-portraits','journey-099']];
  for(const [roundId,contentId,sourceId] of expected){
    const round=history.find(row=>row.id===roundId),source=history.find(row=>row.id===sourceId),link=round.evidence.baselineLinkPlan;
    assert.equal(round.contentId,contentId);assert.equal(ordinary(source),true);assert.equal(validAnswer(source,answers[source.id]),true);
    assert.ok(history.indexOf(source)<history.indexOf(round));assert.equal(round.evidence.baselineFallback,false);assert.ok(link.sourceRoundIds.includes(sourceId));
    assert.ok(link.pairs.some(pair=>pair.sourceRoundId===sourceId&&pair.workIds.every(id=>ids(source).includes(id)&&ids(round).includes(id))));assert.equal(link.numericRankingsInferred,false);
  }
  assert.equal(blocks[0][26].evidence.baselineLinkPlan.linkedPairCount,6);
  assert.equal(blocks[0][41].evidence.baselineLinkPlan.plannedPairCount,1);assert.equal(blocks[0][41].evidence.baselineLinkPlan.completedPairCount,0);
  assert.equal(blocks[1][41].evidence.baselineLinkPlan.completedPairCount,1);assert.equal(blocks[2][41].evidence.baselineLinkPlan.completedPairCount,1);
  for(const block of blocks){const bridge=block[48],preceding=history.slice(0,history.indexOf(bridge)).filter(ordinary);assert.ok(bridge.works.every(work=>preceding.some(source=>ids(source).includes(work.id))));assert.equal(bridge.evidence.role,'probe');assert.equal(bridge.evidence.panelNumber,undefined);assert.equal(bridge.brief,undefined);assert.equal(bridge.anchorWorks,undefined);}
  // An unused factual neighbour set can still lack a source pair. That is
  // explicit standalone data, never a manufactured link or ranking.
  const unlinked=blocks[2][18];assert.equal(unlinked.evidence.baselineFallback,true);assert.equal(unlinked.evidence.baselineLinkPlan.linkedPairCount,0);assert.match(unlinked.evidence.baselineFallbackReason,/standalone categorical/);
});

test('Openness34 uses an already preferred panel with no duplicate two-axis reading map',()=>{
  const rounds=buildJourneyRounds(works,{}, {seed:'appraisal-linkage'}),appraisal=rounds[33],source=rounds[13];
  assert.equal(appraisal.evidence.construct,'interpretive-openness');assert.equal(appraisal.evidence.panelNumber,8);assert.equal(source.evidence.construct,'preference');
  assert.deepEqual([...ids(appraisal)].sort(),[...ids(source)].sort());assert.ok(appraisal.evidence.priorMeasureRoundIds.includes(source.id));
  const readingMaps=rounds.filter(round=>round.kind==='grid'&&round.axis==='reading');
  assert.ok(readingMaps.every(round=>JSON.stringify([...ids(round)].sort())!==JSON.stringify([...ids(appraisal)].sort())));
  assert.equal(appraisal.title,'How much does each painting leave open?');assert.equal(appraisal.scale.left,'One clear reading');
});

test('Captured old34 and49 remain exact even when the new unshown schedule would choose other sources',()=>{
  const rounds=buildJourneyRounds(works,{}, {seed:'frozen-linkage'}),panel12=rounds.find(round=>ordinary(round)&&round.evidence.panelNumber===12),panel17=rounds.find(round=>ordinary(round)&&round.evidence.panelNumber===17),panel18=rounds.find(round=>ordinary(round)&&round.evidence.panelNumber===18);
  const old34={...structuredClone(rounds[33]),works:structuredClone(panel12.works),title:'The openness wording already shown.',evidence:{...rounds[33].evidence,panelNumber:12,journeyRevision:'art-profile-50-v6'}};
  const old49={...structuredClone(rounds[48]),works:[structuredClone(panel17.works[0]),structuredClone(panel18.works[0])],hint:'The bridge instruction already shown.',evidence:{...rounds[48].evidence,journeyRevision:'art-profile-50-v6'}};
  delete old49.evidence.subjectBaselinePreparation;delete old49.evidence.preparesContrastContentId;
  const history=[old34,old49],before=structuredClone(history),rebuilt=buildJourneyRounds(works,{}, {seed:'frozen-linkage',history});
  assert.deepEqual(rebuilt[33],old34);assert.deepEqual(rebuilt[48],old49);assert.deepEqual(history,before);assert.equal(JOURNEY_REVISION,'art-profile-50-v7');
});

test('Prepared049 and099 snapshots remain exact when later planning has more completed source data',()=>{
  const {history,answers,blocks,plans}=fixture(),saved49=structuredClone(blocks[0][48]),saved99=structuredClone(blocks[1][48]);
  const retained=[...blocks[0],saved99],before=structuredClone(retained);
  const second=buildJourneyRounds(works,answers,{offset:50,batchIndex:1,seed:'different-refresh-seed',history:retained,panels:plans[1],reservationPlan:plans[1].reservations});
  assert.deepEqual(second[48],saved99);assert.deepEqual(retained,before);
  const first=buildJourneyRounds(works,answers,{seed:'another-refresh-seed',history:[saved49]});assert.deepEqual(first[48],saved49);
  assert.equal(saved49.evidence.preparesContrastContentId,'subject-mountains');assert.equal(saved99.evidence.preparesContrastContentId,'subject-portraits');
  assert.deepEqual(history[48],saved49);assert.deepEqual(history[98],saved99);
});

test('The actual first-block content can reach all three conditional cross-readings, and missing sources cannot',()=>{
  const rounds=buildJourneyRounds(works,{}, {seed:'editorial-release-audit-0'}),answers={};
  for(const round of rounds)if(ordinary(round))answers[round.id]={...answerFor(round),positions:Object.fromEntries(ids(round).map(id=>[id,50]))};
  // Deliberate synthetic reversals exercise the complete content→response→reading
  // path. They are not forecasts of what a participant will choose.
  for(const [roundId,high,low] of [['journey-005','hokusai-mount-fuji','japanese-waves'],['journey-001','van-gogh-starry-night','study-hokusai-great-wave'],['journey-007','study-cassatt-child-bath','cassatt-omnibus']]){answers[roundId].positions[high]=80;answers[roundId].positions[low]=20;}
  for(const [index,choice] of [[18,{neighbourId:'japanese-waves',noGoodNeighbour:false,relationshipId:'subject'}],[26,{keepId:'study-hokusai-great-wave',leaveId:'van-gogh-starry-night'}],[41,{preferredId:'cassatt-omnibus',noPreference:false}]]){
    const round=rounds[index];answers[round.id]={...sanitizeContrastDraft(round),...choice,confirmed:true};assert.equal(validContrastAnswer(round,answers[round.id]),true);
  }
  const targetIds=['contrast-keep-leave','contrast-neighbour','contrast-subject-reversal'],readings=buildContrastReadings({works,rounds,answers});
  for(const id of targetIds)assert.ok(readings.some(reading=>reading.id===id),id);
  for(const id of ['journey-001','journey-005','journey-007'])delete answers[id];
  assert.ok(buildContrastReadings({works,rounds,answers}).every(reading=>!targetIds.includes(reading.id)));
});
