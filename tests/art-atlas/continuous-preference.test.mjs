import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTINUOUS_PROTOCOL,CONTINUOUS_SCOPE,CONTINUOUS_SCALE,isContinuousPreferenceRound,withContinuousPreference,continuousAppealValue,continuousPairSignal} from '../../public/art-atlas/continuous-preference.mjs';
import {isOverallAppealRound,withOverallAppeal,APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
import {isComparisonPreferenceRound,withComparisonPreference,COMPARISON_PROTOCOL,comparisonDirection} from '../../public/art-atlas/comparison-protocol.mjs';
import {preferenceMeasurementKey,summarizePreferenceHypotheses,planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {buildOrdinalPreferenceGraph} from '../../public/art-atlas/ordinal-preference-graph.mjs';
import {buildOrdinalRefinementRound,bindOrdinalRefinementRound,CONTINUOUS_REFINEMENT_PROTOCOL} from '../../public/art-atlas/ordinal-refinement.mjs';

const ids=round=>round.works.map(work=>work.id);
function fixture(groups=8){
  const works=Array.from({length:groups*4},(_,i)=>({id:'appeal-'+i,title:'Fixture work '+i,artist:'Artist '+i,artistKnown:true,image:'assets/fixture-'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,features:{humanity:i%4/3,color:.5,energy:.5,complexity:.5,abstraction:.5}}));
  const rounds=Array.from({length:groups},(_,i)=>withContinuousPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery',panelNumber:i+1,batchIndex:0,setId:'set-'+i}}));
  const answer=(round,values=[90,93,96,99])=>({workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]])),confirmed:true});
  return {works,rounds,answer,answers:Object.fromEntries(rounds.map(round=>[round.id,answer(round)]))};
}

test('The known continuous instrument retains all 101 personal-appeal levels and both shared capabilities',()=>{
  const input=fixture(),round=input.rounds[0];assert.equal(isContinuousPreferenceRound(round),true);assert.equal(isOverallAppealRound(round),true);assert.equal(isComparisonPreferenceRound(round),true);assert.equal(preferenceMeasurementKey(round),CONTINUOUS_PROTOCOL);assert.equal(round.evidence.measurementScope,CONTINUOUS_SCOPE);assert.equal(round.evidence.showNumericScale,true);assert.deepEqual(round.scale,CONTINUOUS_SCALE);
  for(let value=0;value<=100;value++){const answer=input.answer(round,[value,50,50,50]);assert.equal(continuousAppealValue(round,answer,ids(round)[0]),value);assert.equal(continuousPairSignal(round,answer,ids(round)[0],ids(round)[1]).gap,value-50);}
});

test('All-high and all-low groups have the same pair order but opposite personal-appeal levels',()=>{
  const input=fixture(1),round=input.rounds[0],low=input.answer(round,[1,4,7,10]),high=input.answers[round.id],a=ids(round)[0],b=ids(round)[3],positive=buildOrdinalPreferenceGraph(input),negative=buildOrdinalPreferenceGraph({...input,answers:{[round.id]:low}});
  assert.equal(comparisonDirection(round,high,a,b),comparisonDirection(round,low,a,b));assert.equal(continuousPairSignal(round,high,a,b).bothLiked,true);assert.equal(continuousPairSignal(round,low,a,b).bothDisliked,true);assert.ok(positive.appealRatings.every(item=>item.side==='liked'));assert.ok(negative.appealRatings.every(item=>item.side==='disliked'));assert.equal(positive.appealRatings.length,4);assert.equal(negative.appealRatings.length,4);assert.equal(positive.anchoredAppealAvailable,true);assert.equal(positive.globalAbsoluteRankingAvailable,true);assert.deepEqual(positive.recordedAppealLevels.map(level=>level.value),[99,96,93,90]);assert.deepEqual(positive.edges.map(edge=>[edge.aWins,edge.bWins,edge.ties]),negative.edges.map(edge=>[edge.aWins,edge.bWins,edge.ties]));
});

test('The same order with different gaps changes weights, fitted hypotheses and eligible checks',()=>{
  const input=fixture(),wide={...input,answers:Object.fromEntries(input.rounds.map(round=>[round.id,input.answer(round,[0,10,80,100])]))},narrow={...input,answers:Object.fromEntries(input.rounds.map(round=>[round.id,input.answer(round,[97,98,99,100])]))},a=ids(input.rounds[0])[0],b=ids(input.rounds[0])[3];
  assert.equal(continuousPairSignal(input.rounds[0],wide.answers['journey-001'],a,b).weight,1);assert.equal(continuousPairSignal(input.rounds[0],narrow.answers['journey-001'],a,b).weight,.03);
  const strong=summarizePreferenceHypotheses(wide),weak=summarizePreferenceHypotheses(narrow);assert.ok(strong.length>0);assert.equal(weak.length,0,'A tiny gap must not receive the strength of a wide separation.');assert.equal(strong[0].measurementScope,CONTINUOUS_PROTOCOL);assert.equal(strong[0].weightBasis,'continuous-personal-appeal-gap');assert.ok(strong[0].trainingEvidence.every(source=>source.measurementScope===CONTINUOUS_PROTOCOL));
  const query=source=>planAdaptivePanels({...source,batchIndex:1,seed:'gap-selection',quotas:{exactRepeats:0,recontextualizations:0,challenges:1}});assert.ok(query(wide).panels.some(panel=>panel.role==='challenge'));assert.equal(query(narrow).panels.some(panel=>panel.role==='challenge'),false);
});

test('Anchored extremes affect repeat selection without inventing a low or middle from an all-high group',()=>{
  const input=fixture(8),answers=Object.fromEntries(input.rounds.map((round,index)=>[round.id,input.answer(round,index===0?[90,93,96,100]:[60,63,66,70])])),plan=planAdaptivePanels({...input,answers,batchIndex:1,seed:'anchored-extreme',quotas:{exactRepeats:1,recontextualizations:0,challenges:0}}),repeat=plan.panels.find(panel=>panel.role==='repeat');assert.ok(repeat);assert.equal(repeat.repeatOf,'journey-001');assert.equal(repeat.focus.anchorBand,'above-neutral');assert.equal(repeat.focus.positionWithinSource,100);assert.equal(repeat.promptSnapshot.evidence.continuousProtocol,CONTINUOUS_PROTOCOL);
  const allHigh=Object.fromEntries(input.rounds.map(round=>[round.id,input.answer(round,[90,93,96,99])])),lowBatch=planAdaptivePanels({...input,answers:allHigh,batchIndex:2,seed:'no-false-dislike',quotas:{exactRepeats:1,recontextualizations:0,challenges:0}}).panels.find(panel=>panel.role==='repeat');assert.equal(lowBatch.focus.band,'level-or-mixed','The low-focused return can retain a source, but no dislike is inferred from its local minimum.');
});

test('Old ordinal distances remain ignored, old overall anchors stay separate, and protocols never pool training',()=>{
  const input=fixture(),original=input.rounds[0],ordinal=withComparisonPreference(original),overall=withOverallAppeal(original);assert.equal(isOverallAppealRound(ordinal),false);assert.equal(isComparisonPreferenceRound(overall),false);assert.equal(preferenceMeasurementKey(ordinal),COMPARISON_PROTOCOL);assert.equal(preferenceMeasurementKey(overall),APPEAL_PROTOCOL);
  const ordinalRounds=input.rounds.map(round=>withComparisonPreference(round)),ordinalNarrow={...input,rounds:ordinalRounds,answers:Object.fromEntries(ordinalRounds.map(round=>[round.id,input.answer(round,[97,98,99,100])]))},ordinalWide={...ordinalNarrow,answers:Object.fromEntries(ordinalRounds.map(round=>[round.id,input.answer(round,[0,10,80,100])]))},meaning=source=>summarizePreferenceHypotheses(source).map(({trainingEvidence,...cue})=>cue);assert.deepEqual(meaning(ordinalNarrow),meaning(ordinalWide));
  const old=withOverallAppeal({...input.rounds[0],id:'old-overall'}),mixed={...input,rounds:[old,...input.rounds],answers:{...input.answers,[old.id]:input.answer(old,[0,10,80,100])}},cues=summarizePreferenceHypotheses({...mixed,answers:Object.fromEntries(mixed.rounds.map(round=>[round.id,input.answer(round,[0,10,80,100])]))});assert.ok(cues.every(cue=>cue.measurementScope===CONTINUOUS_PROTOCOL&&!cue.trainingRoundIds.includes(old.id)));
});

test('Malformed known markers, mismatched images and conflicting aliases fail closed instead of becoming legacy scores',()=>{
  const input=fixture(),source=input.rounds[0];for(const change of [round=>round.evidence.continuousProtocol='unknown',round=>delete round.evidence.continuousProtocol,round=>round.evidence.appealProtocol=APPEAL_PROTOCOL,round=>round.evidence.comparisonProtocol=COMPARISON_PROTOCOL,round=>round.scale.middle='Middle rank',round=>round.title='Which do you prefer?',round=>round.hint='Order only.']){const round=structuredClone(source);change(round);assert.equal(isContinuousPreferenceRound(round),false);assert.equal(isOverallAppealRound(round),false);assert.equal(isComparisonPreferenceRound(round),false);assert.equal(preferenceMeasurementKey(round),null);assert.equal(buildOrdinalPreferenceGraph({...input,rounds:[round]}).coverage.comparisonRoundCount,0);assert.equal(planAdaptivePanels({...input,rounds:[round]}).coverage.eligiblePreferenceRoundIds.length,0);}
  const changed=structuredClone(source);changed.works[0].image='assets/different.jpg';assert.equal(planAdaptivePanels({...input,rounds:[changed]}).coverage.eligiblePreferenceRoundIds.length,0);assert.equal(continuousAppealValue({...source,workIds:5},input.answers[source.id],ids(source)[0]),null);
});

test('Continuous closing checks freeze gap-weighted sources while the old ordinal closing keeps its original scope',()=>{
  const input=fixture(),answers=Object.fromEntries(input.rounds.map(round=>[round.id,input.answer(round,[0,10,80,100])])),definition=buildOrdinalRefinementRound({works:input.works,id:'journey-050',role:'hypothesis-check',slot:5,preferenceProtocol:CONTINUOUS_PROTOCOL}),bound=bindOrdinalRefinementRound({...input,answers,round:definition}),meta=bound.evidence.finalRefinement;assert.equal(meta.protocol,CONTINUOUS_REFINEMENT_PROTOCOL);assert.equal(meta.binding,'bound');assert.equal(isContinuousPreferenceRound(bound),true);assert.ok(meta.hypotheses.length);assert.ok(meta.hypotheses.every(cue=>cue.measurementScope===CONTINUOUS_PROTOCOL&&cue.weightBasis==='continuous-personal-appeal-gap'));assert.deepEqual(bindOrdinalRefinementRound({...input,answers:{...answers,[bound.id]:input.answer(bound,[100,0])},round:bound}),bound);
});
