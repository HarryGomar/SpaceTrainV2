import test from 'node:test';
import assert from 'node:assert/strict';
import {withComparisonPreference,COMPARISON_PROTOCOL,isComparisonPreferenceRound} from '../../public/art-atlas/comparison-protocol.mjs';
import {buildOrdinalClosingRounds,buildOrdinalRefinementRound,bindOrdinalRefinementRound,ordinalExposure} from '../../public/art-atlas/ordinal-refinement.mjs';
import {buildOrdinalPreferenceGraph} from '../../public/art-atlas/ordinal-preference-graph.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';

const ids=round=>round.works.map(work=>work.id);
function fixture(groups=8){
  const works=Array.from({length:groups*4},(_,i)=>({id:'source-'+i,title:'Fixture painting '+i,artist:'Different artist '+i,artistKnown:true,image:'assets/fixture-'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,features:{humanity:i%4/3,abstraction:.5,color:.5,energy:.5,complexity:.5}}));
  const rounds=Array.from({length:groups},(_,i)=>withComparisonPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery',panelNumber:i+1,setId:'set-'+i}}));
  const answer=(round,values=[97,98,99,100])=>({workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]])),confirmed:true});
  return {works,rounds,answer,answers:Object.fromEntries(rounds.map(round=>[round.id,answer(round)]))};
}
const definition=(input,role,id='journey-046',slot=1)=>buildOrdinalRefinementRound({works:input.works,id,role,slot});
const bind=(input,round)=>bindOrdinalRefinementRound({...input,round});
const anchorAnswer=(round,{selected=[],page=0,none=!selected.length,unsure=false}={})=>({workIds:ids(round),selectionMode:'shortlist',selectedIds:selected,explicitNone:none,unsure,confirmed:true,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:page?[0,page]:[0],activePage:page}});

test('Closing slots keep explicit positive and negative anchors plus two bridges and a prospective check',()=>{
  const input=fixture(),rounds=buildOrdinalClosingRounds(input);
  assert.deepEqual(rounds.map(round=>round.evidence.finalRefinement.role),['favourites','bridge-high-high','bridge-high-middle','dislikes','hypothesis-check']);
  assert.ok(rounds.every(round=>round.unavailable&&round.evidence.finalRefinement.binding==='deferred'));
  assert.equal(rounds[0].evidence.explicitFavourites,true);assert.equal(rounds[3].evidence.explicitDislikes,true);
  assert.ok(rounds.filter(round=>round.kind==='spectrum').every(isComparisonPreferenceRound));
});

test('Deferred questions need confirmed actual earlier comparisons and never borrow planned or future answers',()=>{
  const input=fixture(),round=definition(input,'favourites');
  assert.equal(bind({...input,rounds:[]},round).unavailable,true);
  assert.equal(bind({...input,answers:{}},round).unavailable,true);
  const future={...structuredClone(input.rounds[0]),id:'journey-099'},actual=bind(input,round),withFuture=bind({...input,rounds:[...input.rounds,future],answers:{...input.answers,[future.id]:input.answer(future,[100,0,0,0])}},round);
  assert.deepEqual(withFuture,actual);assert.equal(actual.works.length,32);assert.equal(actual.maxChoices,5);
  assert.deepEqual(actual.workIds,ids(actual));assert.ok(actual.evidence.finalRefinement.sourceRoundIds.every(id=>Number(id.slice(8))<46));
});

test('The final dislike selection reuses the exact captured favourite pool while recording its own page exposure',()=>{
  const input=fixture(),closing=buildOrdinalClosingRounds(input),favourite=bind(input,closing[0]);
  const before=structuredClone(favourite),answers={...input.answers,[favourite.id]:anchorAnswer(favourite,{selected:[favourite.works[0].id]})},negative=bind({...input,rounds:[...input.rounds,favourite],answers},closing[3]);
  assert.equal(negative.unavailable,undefined);assert.deepEqual(ids(negative),ids(favourite));assert.deepEqual(negative.works,favourite.works);assert.deepEqual(favourite,before);assert.equal(negative.maxChoices,32);assert.equal(negative.evidence.finalRefinement.anchorPoolRoundId,favourite.id);
  const response=anchorAnswer(negative,{page:1,selected:[negative.works[20].id]});assert.ok(validAnswer(negative,response));
  assert.deepEqual(ordinalExposure(favourite,answers[favourite.id]).presented,ids(favourite).slice(0,18));assert.deepEqual(ordinalExposure(negative,response).presented,ids(negative));
  assert.equal(bind(input,closing[3]).unavailable,true,'A planned placeholder is not a captured pool.');
  const replaced=structuredClone(favourite);replaced.works[0].image='assets/different-image.jpg';assert.equal(bind({...input,rounds:[...input.rounds,replaced]},closing[3]).unavailable,true);
});

test('None and Not sure are valid anchors without declaring unselected paintings liked or disliked',()=>{
  const input=fixture(),round=bind(input,definition(input,'favourites'));
  for(const response of [anchorAnswer(round),anchorAnswer(round,{none:false,unsure:true})]){
    assert.ok(validAnswer(round,response));const graph=buildOrdinalPreferenceGraph({...input,rounds:[...input.rounds,round],answers:{...input.answers,[round.id]:response}});assert.deepEqual(graph.explicitPositive,[]);assert.deepEqual(graph.explicitNegative,[]);
  }
});

test('Bridge nominations depend on local ordinal bands and connect separate source groups without distance weights',()=>{
  const input=fixture(),round=definition(input,'bridge-high-middle','journey-047',2),bound=bind(input,round),rescaled={...input,answers:Object.fromEntries(input.rounds.map(source=>[source.id,input.answer(source,[0,1,2,100])]))},again=bind(rescaled,round),meta=bound.evidence.finalRefinement;
  assert.deepEqual(ids(bound),ids(again));assert.deepEqual(meta.sourceNominations.map(item=>item.actualBand),['high','middle','high','middle']);assert.equal(new Set(meta.sourceNominations.map(item=>item.sourceRoundId)).size,4);assert.equal(meta.selectedComponentIds.length,4);assert.equal(meta.newPreferencePairs.length,6);
  const before=buildOrdinalPreferenceGraph(input),after=buildOrdinalPreferenceGraph({...input,rounds:[...input.rounds,bound],answers:{...input.answers,[bound.id]:input.answer(bound,[0,1,2,3])}});assert.equal(after.components.length,before.components.length-3);assert.equal(after.explicitPositive.length,0);
});

test('A prospective check freezes only earlier order-based training and an actually new comparison',()=>{
  const input=fixture(),bound=bind(input,definition(input,'hypothesis-check','journey-050',5)),meta=bound.evidence.finalRefinement;
  assert.ok(['feature-check','rival-check'].includes(meta.role));assert.equal(bound.works.length,2);assert.equal(meta.hypothesisStatus,'frozen-before-this-answer');assert.equal(meta.checks[0].comparisonNovel,true);
  for(const cue of meta.hypotheses){assert.equal(cue.measurementScope,COMPARISON_PROTOCOL);assert.equal(cue.weightBasis,'within-set-order-only');assert.ok(cue.trainingRoundIds.length>=3);assert.ok(cue.trainingRoundIds.every(id=>meta.sourceRoundIds.includes(id)));assert.deepEqual(Object.keys(cue.testFeatureValues).sort(),ids(bound).sort());assert.deepEqual(Object.keys(cue.testFeatureSemanticVersions).sort(),ids(bound).sort());}
  assert.ok(!input.rounds.some(source=>ids(bound).every(id=>ids(source).includes(id))));
  const changed={...input,answers:{...input.answers,[bound.id]:input.answer(bound,[100,0])}};assert.deepEqual(bind(changed,bound),bound,'A captured hypothesis cannot refit itself from its own outcome.');
});

test('A changed-source None cannot withdraw an earlier favourite and uncertain exposure prevents a false spaced return',()=>{
  const input=fixture(),favourite=bind(input,definition(input,'favourites')),response=anchorAnswer(favourite,{selected:[favourite.works[0].id]}),changed={...structuredClone(favourite),id:'journey-049',works:favourite.works.map((work,i)=>i?work:{...work,image:'assets/replaced.jpg'}),evidence:{...favourite.evidence,construct:'overall-dislikes',explicitFavourites:undefined,explicitDislikes:true}},graph=buildOrdinalPreferenceGraph({...input,rounds:[...input.rounds,favourite,changed],answers:{...input.answers,[favourite.id]:response,[changed.id]:anchorAnswer(changed)}});
  assert.equal(graph.explicitPositive.length,1);
  const flat=fixture(3);flat.works.forEach(work=>Object.keys(work.features).forEach(key=>work.features[key]=.5));
  const hidden=Array.from({length:10},(_,i)=>({id:'journey-'+String(i+4).padStart(3,'0'),kind:'statements',works:[flat.works[0]],evidence:{stimulusVisibility:'not-shown'}})),closing=definition(flat,'hypothesis-check','journey-050',5),returned=bind({...flat,rounds:[...flat.rounds,...hidden]},closing);
  assert.equal(returned.evidence.exactRepeat,true);assert.equal(returned.evidence.repeatOf,'journey-002');
  const unknown={id:'journey-049',kind:'exercise',exerciseKind:'curate',works:flat.works,evidence:{}},fallback=bind({...flat,rounds:[...flat.rounds,...hidden,unknown]},closing);
  assert.notEqual(fallback.evidence.exactRepeat,true);assert.match(fallback.evidence.finalRefinement.hypothesisFallbackReason,/No eligible/);
});
