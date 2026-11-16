import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJourneyRounds as buildCurrentJourneyRounds,journeyCurationNotes,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
import {sanitizeContrastDraft,validContrastAnswer} from '../../public/art-atlas/contrast-rounds.mjs';
import {buildContrastReadings} from '../../public/art-atlas/contrast-readings.mjs';
import {auditTrajectory,works,ordinary,questionIds} from './helpers/repetition-audit.mjs';
import {legacyV8Rounds} from './helpers/legacy-v8.mjs';
import {APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
// This regression route deliberately preserves the earlier overall instrument.
// Fresh comparison-first scheduling is covered separately by journey-v12.
const buildJourneyRounds=(works,answers={},options={})=>buildCurrentJourneyRounds(works,answers,{...options,preferenceProtocol:APPEAL_PROTOCOL});

const ids=round=>round.works.map(work=>work.id),same=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());
let cached;const fixture=()=>cached||=auditTrajectory('editorial-release-audit');

test('The historical overall route retains72/46/46 through150 and every claimed ordinary baseline names a real earlier exact pair',()=>{
  const {rounds:history,answers,blocks}=fixture(),notes=journeyCurationNotes(works);assert.deepEqual(blocks.map(block=>block.plan.coverage.firstRatingWorkIds.length),[72,46,46]);
  for(const panel of notes.proposedFirst18Panels)same(ids(blocks[0].rounds.find(round=>ordinary(round)&&round.evidence.panelNumber===panel.panel)),panel.workIds);
  for(const round of history.filter(round=>round.kind==='contrast')){
    const link=round.evidence.baselineLinkPlan;assert.equal(link.numericRankingsInferred,false);
    for(const pair of link.pairs){const source=history.find(item=>item.id===pair.sourceRoundId);assert(source);assert(ordinary(source));assert(validAnswer(source,answers[source.id]));assert(history.indexOf(source)<history.indexOf(round));assert(pair.workIds.every(id=>ids(source).includes(id)&&ids(round).includes(id)));assert(link.sourceRoundIds.includes(source.id));}
    if(round.evidence.baselineFallback){assert.equal(link.linkedPairCount,0);assert.match(round.evidence.baselineFallbackReason,/standalone categorical/);}
  }
  for(const kind of ['neighbour','keep-leave','same-subject']){const round=blocks[0].rounds.find(round=>round.contrastKind===kind);assert(round.evidence.baselineLinkPlan.linkedPairCount>0,kind+' needs a real first-block comparison opportunity');assert.equal(round.evidence.baselineFallback,false);}
  assert.equal(blocks[0].rounds[26].evidence.baselineLinkPlan.linkedPairCount,6);
});

test('Two clarity/interpretation maps revisit their own earlier appeal sets without the former isolated label question',()=>{
  const rounds=buildJourneyRounds(works,{}, {seed:'appraisal-linkage'}),maps=rounds.filter(round=>round.kind==='grid'&&round.axis==='reading');assert.equal(maps.length,2);assert.deepEqual(maps.map(round=>round.evidence.panelNumber),[9,8]);assert.equal(rounds.some(round=>round.evidence.construct==='interpretive-openness'),false);
  for(const map of maps){const source=rounds.find(round=>ordinary(round)&&round.evidence.panelNumber===map.evidence.panelNumber);same(ids(map),ids(source));assert(map.evidence.priorMeasureRoundIds.includes(source.id));assert(rounds.indexOf(source)<rounds.indexOf(map));}
  const historical=legacyV8Rounds(works).find(round=>round.evidence.construct==='interpretive-openness');assert(historical);const rebuilt=buildJourneyRounds(works,{}, {history:[historical]});assert.deepEqual(rebuilt.find(round=>round.id===historical.id),historical);
});

test('Captured historical34 and49 stay exact where the fresh schedule now uses other instruments',()=>{
  const old=legacyV8Rounds(works),openness=old.find(round=>round.evidence.construct==='interpretive-openness'),panel12=old.find(round=>ordinary(round)&&round.evidence.panelNumber===12),old34={...structuredClone(openness),id:'journey-034',works:structuredClone(panel12.works),title:'The openness wording already shown.',evidence:{...openness.evidence,panelNumber:12,journeyRevision:'art-profile-50-v6'}},old49=structuredClone(old[48]);
  old49.hint='The bridge instruction already shown.';const history=[old34,old49],before=structuredClone(history),rebuilt=buildJourneyRounds(works,{}, {history,seed:'preserved-linkage'});assert.deepEqual(rebuilt[33],old34);assert.deepEqual(rebuilt[48],old49);assert.deepEqual(history,before);assert.equal(rebuilt[0].evidence.journeyRevision,JOURNEY_REVISION);assert(old49.evidence.bridgeComparison);
});

test('Captured closing049 and099 source snapshots survive changed later planning and answers',()=>{
  const {rounds:history,answers,blocks}=fixture(),saved49=structuredClone(blocks[0].rounds[48]),saved99=structuredClone(blocks[1].rounds[48]),retained=[...blocks[0].rounds,saved99],before=structuredClone(retained);
  const second=buildJourneyRounds(works,answers,{offset:50,batchIndex:1,seed:'changed-refresh-seed',history:retained,panels:blocks[1].plan,reservationPlan:blocks[1].plan.reservations});assert.deepEqual(second[48],saved99);assert.deepEqual(retained,before);assert.deepEqual(buildJourneyRounds(works,answers,{history:[saved49]})[48],saved49);
  assert.equal(saved49.evidence.finalRefinement.binding,'bound');assert.equal(saved99.evidence.finalRefinement.binding,'bound');for(const round of [saved49,saved99])for(const id of round.evidence.finalRefinement.sourceRoundIds)assert(Number(id.slice(8))<Number(round.id.slice(8)));assert.deepEqual(history[48],saved49);assert.deepEqual(history[98],saved99);
});

test('Actual fresh contrast content can reach three conditional readings, while missing source responses cannot',()=>{
  const rounds=buildJourneyRounds(works,{}, {seed:'editorial-release-audit-0'}),answers={};for(const round of rounds.filter(ordinary))answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(ids(round).map(id=>[id,50])),confirmed:true};
  const sourceIds=[];
  for(const kind of ['neighbour','keep-leave','same-subject']){
    const round=rounds.find(round=>round.contrastKind===kind),pair=round.evidence.baselineLinkPlan.pairs[0];assert(pair,kind+' requires the recorded baseline opportunity');const [chosen,other]=pair.workIds;sourceIds.push(pair.sourceRoundId);answers[pair.sourceRoundId].positions[chosen]=20;answers[pair.sourceRoundId].positions[other]=80;
    const choice=kind==='neighbour'?{neighbourId:chosen,noGoodNeighbour:false,relationshipIds:[round.relationshipOptions[0].id]}:kind==='keep-leave'?{keepId:chosen,leaveId:other}:{preferredId:chosen,noPreference:false};answers[round.id]={...sanitizeContrastDraft(round),...choice,confirmed:true};assert(validContrastAnswer(round,answers[round.id]));
  }
  const expected=['contrast-keep-leave','contrast-neighbour','contrast-subject-reversal'],readings=buildContrastReadings({works,rounds,answers});for(const id of expected)assert(readings.some(reading=>reading.id===id),id);
  for(const id of sourceIds)delete answers[id];assert(buildContrastReadings({works,rounds,answers}).every(reading=>!expected.includes(reading.id)));
});
