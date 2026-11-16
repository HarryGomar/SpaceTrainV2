import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPARISON_PROTOCOL,COMPARISON_HINT,withComparisonPreference,isComparisonPreferenceRound,comparisonDirection,ordinalBands} from '../../public/art-atlas/comparison-protocol.mjs';
import {buildOrdinalPreferenceGraph} from '../../public/art-atlas/ordinal-preference-graph.mjs';
import {buildTasteAxes} from '../../public/art-atlas/taste-axes.mjs';
import {summarizePreferenceHypotheses,planAdaptivePanels,preferenceMeasurementKey} from '../../public/art-atlas/adaptive-selection.mjs';
import {FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {analyzeStudy} from '../../public/art-atlas/deep-study.mjs';

function fixture(groups=8){const works=Array.from({length:80},(_,i)=>({id:'ordinal-'+i,title:'Synthetic work '+i,artist:'Fixture artist '+i,sourceUrl:'https://fixture.invalid/'+i,image:'assets/ordinal-'+i+'.jpg',featureSemanticVersion:FEATURE_SEMANTIC_VERSION,features:{humanity:(i%4)/3,abstraction:.5,energy:.5,complexity:.5,narrative:0,atmosphere:0,color:.5}})),rounds=Array.from({length:groups},(_,i)=>withComparisonPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery',panelNumber:i+1,batchIndex:0,setId:'ordinal-set-'+i}}));const answer=(round,values=[97,98,99,100])=>({workIds:round.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]])),confirmed:true});return {works,rounds,answers:Object.fromEntries(rounds.map(round=>[round.id,answer(round)])),answer};}
const graphMeaning=model=>({components:model.components,edges:model.edges,coverage:model.coverage});
const axisMeaning=model=>model.axes.map(axis=>({key:axis.key,status:axis.status,direction:axis.direction,counts:axis.counts,sourceRoundIds:axis.sourceRoundIds,support:axis.support,counter:axis.counter,rangeEvidence:axis.rangeEvidence,setReasons:axis.setAssessments.map(set=>set.reason),components:axis.components.map(component=>({direction:component.direction,counts:component.counts,rangeEvidence:component.rangeEvidence}))}));

test('The new line records one-step orders and exact ties; no old overall instrument is upgraded',()=>{
  const input=fixture(),round=input.rounds[0],a=round.works[0].id,b=round.works[1].id;
  assert.equal(comparisonDirection(round,input.answers[round.id],a,b),-1);assert.equal(preferenceMeasurementKey(round),COMPARISON_PROTOCOL);assert.equal(round.evidence.showNumericScale,false);
  const tied=input.answer(round,[42,42,43,44]);assert.equal(comparisonDirection(round,tied,a,b),0);assert.deepEqual(ordinalBands(round,tied).low,[a,b]);
  const overall=withOverallAppeal({...round,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});assert.equal(isComparisonPreferenceRound(overall),false);assert.equal(comparisonDirection(overall,input.answers[round.id],a,b),0,'The former reporting threshold stays intact for its own scale.');
});

test('Wrong comparison versions, wording, scale or contradictory markers fail closed',()=>{
  const input=fixture();for(const change of [round=>round.evidence.comparisonProtocol='unknown-comparison-version',round=>round.hint=COMPARISON_HINT+' for your living room.',round=>round.title='How much do you like it?',round=>round.scale.left='Strongly dislike',round=>round.evidence.appealProtocol='overall-appeal-v1']){const round=structuredClone(input.rounds[0]);change(round);assert.equal(isComparisonPreferenceRound(round),false);assert.equal(preferenceMeasurementKey(round),null);assert.equal(buildOrdinalPreferenceGraph({...input,rounds:[round]}).coverage.comparisonRoundCount,0);assert.equal(buildTasteAxes({...input,rounds:[round]}).coverage.distinctSets,0);}
});

test('Monotone rescaling leaves graph, axis conclusions, leaders, feature hypotheses and query identities unchanged',()=>{
  const input=fixture(),changed={...input,answers:Object.fromEntries(input.rounds.map(round=>[round.id,input.answer(round,[0,10,50,100])]))};
  assert.deepEqual(graphMeaning(buildOrdinalPreferenceGraph(input)),graphMeaning(buildOrdinalPreferenceGraph(changed)));
  assert.deepEqual(axisMeaning(buildTasteAxes(input)),axisMeaning(buildTasteAxes(changed)));
  const hypotheses=source=>summarizePreferenceHypotheses(source).map(({trainingEvidence,...cue})=>cue);assert.deepEqual(hypotheses(input),hypotheses(changed));
  const queries=source=>planAdaptivePanels({...source,batchIndex:1,seed:'ordinal-invariance'}).panels.map(panel=>({workIds:panel.workIds,role:panel.role,band:panel.focus?.band,prediction:panel.provisionalPrediction,feature:panel.provisionalHypothesis?.feature}));assert.deepEqual(queries(input),queries(changed));
});

test('Disconnected local winners produce separate frontiers and no absolute favourites',()=>{
  const input=fixture(3),graph=buildOrdinalPreferenceGraph(input);assert.equal(graph.components.length,3);assert.equal(graph.explicitPositive.length,0);assert.equal(graph.explicitNegative.length,0);assert.equal(graph.globalAbsoluteRankingAvailable,false);assert.equal(graph.coverage.uniquePairCount,18);assert.ok(graph.edges.every(edge=>edge.observations.every(item=>item.independentPairMeasurement===false)));
});

test('A bridge joins components; contradictory returns retain cycles without a forced winner',()=>{
  const input=fixture(2),bridge=withComparisonPreference({id:'journey-019',kind:'spectrum',criterion:'preference',works:[input.works[3],input.works[7]],evidence:{construct:'preference',family:'individual-choice',role:'probe'}}),returned={...structuredClone(input.rounds[0]),id:'journey-020',evidence:{...input.rounds[0].evidence,role:'repeat',repeatOf:input.rounds[0].id}},answers={...input.answers,[bridge.id]:input.answer(bridge,[51,50]),[returned.id]:input.answer(returned,[100,99,98,97])},model=buildOrdinalPreferenceGraph({...input,rounds:[...input.rounds,bridge,returned],answers});assert.equal(model.components.length,1);assert.ok(model.coverage.contradictoryPairCount>0);assert.ok(model.components[0].cycles.length);assert.ok(model.edges.some(edge=>edge.sourceRoundIds.includes(returned.id)));
});

test('Malformed identity aliases, duplicate catalogue IDs and incomplete answers cannot blank or populate the graph',()=>{
  const input=fixture(1);for(const alias of [null,5,{}]){const round={...input.rounds[0],workIds:alias};assert.equal(buildOrdinalPreferenceGraph({...input,rounds:[round]}).coverage.comparedWorkCount,0);}assert.equal(buildOrdinalPreferenceGraph({...input,works:[...input.works,input.works[0]]}).coverage.comparedWorkCount,0);
  const answer=structuredClone(input.answers[input.rounds[0].id]);delete answer.positions[input.works[0].id];assert.equal(buildOrdinalPreferenceGraph({...input,answers:{[input.rounds[0].id]:answer}}).coverage.comparedWorkCount,0);
});

test('The old generic study reader retains answer counts but withholds its intensity heuristics for the new instrument',()=>{
  const input=fixture(),result=analyzeStudy(input.works,input.rounds,input.answers);assert.equal(result.answered,8);assert.equal(result.artworks,32);assert.deepEqual(result.findings,[]);assert.equal(result.predictionChecks,0);
});
