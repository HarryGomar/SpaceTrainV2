import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClosingReadings} from '../../public/art-atlas/closing-readings.mjs';
import {withComparisonPreference,COMPARISON_PROTOCOL,COMPARISON_SCOPE} from '../../public/art-atlas/comparison-protocol.mjs';
import {buildOrdinalRefinementRound,bindOrdinalRefinementRound,ORDINAL_REFINEMENT_PROTOCOL} from '../../public/art-atlas/ordinal-refinement.mjs';

const ids=r=>r.works.map(w=>w.id);
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]]))});
function fixture(values=[97,98,99,100]){
  const works=Array.from({length:32},(_,i)=>({id:'c'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/'+i,image:'assets/c'+i+'.jpg',features:{energy:(i%4)/3,complexity:.5,abstraction:.5,humanity:.5,color:.5,narrative:.5,atmosphere:.5}})),rounds=Array.from({length:8},(_,i)=>withComparisonPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r,values)])),template=buildOrdinalRefinementRound({works,id:'journey-050',role:'hypothesis-check',slot:5,seed:'ordinal-reading-contract'}),bound=bindOrdinalRefinementRound({round:template,works,rounds,answers});
  assert.equal(bound.evidence.finalRefinement.role,'feature-check');assert.equal(bound.works.length,2);const prediction=bound.evidence.finalRefinement.checks[0].prediction;answers[bound.id]=answer(bound,bound.works.map(work=>work.id===prediction?91:90));return{works,rounds:[...rounds,bound],answers,bound};
}
const build=f=>buildClosingReadings(f);
const metadata=f=>f.bound.evidence.finalRefinement;

test('The actual ordinal binder produces a frozen prospective check accepted with a one-step order',()=>{
  const f=fixture(),result=build(f),check=result.checks[0];assert.equal(metadata(f).protocol,ORDINAL_REFINEMENT_PROTOCOL);assert.equal(result.checks.length,1);assert.equal(check.status,'matched');assert.equal(check.gap,1);assert.equal(check.comparisonBasis,COMPARISON_SCOPE);assert.equal(check.tiePolicy,'exact-tie');assert.equal(check.primary.weightBasis,'within-set-order-only');assert.equal(check.primary.measurementScope,COMPARISON_PROTOCOL);assert.equal(check.primary.sourceSetCount,8);assert.ok(check.primary.trainingRoundIds.every(id=>metadata(f).sourceRoundIds.includes(id)));assert.equal(result.observations[0].comparisons[0].measures[0].valueMeaning,'order-only');assert.doesNotMatch(result.observations[0].alternatives.join(' '),/gap below 15|near tie/i);assert.equal('accuracyPercent' in check,false);
});

test('Ordinal outcomes distinguish an exact tie from a reversed one-step order',()=>{
  const f=fixture(),predicted=metadata(f).checks[0].prediction;f.answers[f.bound.id]=answer(f.bound,f.bound.works.map(work=>work.id===predicted?90:91));let result=build(f);assert.equal(result.checks[0].status,'reversed');assert.equal(result.checks[0].gap,-1);assert.ok(result.observations[0].counter.length);
  for(const position of [0,100]){f.answers[f.bound.id]=answer(f.bound,[position,position]);result=build(f);assert.equal(result.checks[0].status,'tie');assert.equal(result.checks[0].observedWorkId,null);assert.equal(result.observations[0].outcomeCounts.tied,1);assert.match(result.observations[0].text,/tied/);assert.doesNotMatch(result.observations[0].text,/near/);}
});

test('Monotone changes of training locations preserve the predicted comparison and its source support',()=>{
  const a=fixture([97,98,99,100]),b=fixture([0,25,70,100]),first=build(a).checks[0],second=build(b).checks[0];assert.ok(first&&second);assert.deepEqual(ids(a.bound),ids(b.bound));assert.equal(first.predictedWorkId,second.predictedWorkId);assert.equal(first.status,second.status);assert.equal(first.primary.direction,second.primary.direction);assert.deepEqual(first.primary.supportingRoundIds,second.primary.supportingRoundIds);assert.deepEqual(first.primary.trainingRoundIds,second.primary.trainingRoundIds);
});

test('Captured ordinal training is not refitted from later live answer edits',()=>{
  const f=fixture(),before=build(f);for(const r of f.rounds.slice(0,-1))for(const id of ids(r))f.answers[r.id].positions[id]=100-f.answers[r.id].positions[id];assert.deepEqual(build(f),before);assert.deepEqual(metadata(f).hypotheses[0].trainingEvidence[0].positions,{c0:97,c1:98,c2:99,c3:100});
});

test('Incomplete actual answers and wrong ordinal scope or weighting suppress the whole check',()=>{
  for(const mutate of [f=>delete f.answers[f.bound.id].positions[ids(f.bound)[0]],f=>f.answers[f.bound.id].confirmed=false,f=>f.answers[f.bound.id].skipped=true,f=>metadata(f).hypotheses[0].measurementScope='overall-appeal-v1',f=>delete metadata(f).hypotheses[0].weightBasis,f=>metadata(f).sourceRoundIds=metadata(f).sourceRoundIds.slice(0,1),f=>f.bound.scale.left='Strongly dislike',f=>metadata(f).hypotheses[0].trainingEvidence[0].positions.c0=null,f=>metadata(f).hypotheses[0].trainingEvidence[0].measurementScope='overall-appeal-v1',f=>metadata(f).hypotheses[0].testFeatureValues.missing=.5,f=>{for(const work of f.works)work.artist='One artist';}]){const f=fixture();mutate(f);assert.deepEqual(build(f).checks,[]);}
});

test('A previously co-presented pair cannot acquire a new-pair validation claim',()=>{
  const f=fixture(),seen={id:'seen-pair',kind:'choice-grid',selectionMode:'shortlist',maxChoices:2,works:f.bound.works,evidence:{construct:'unranked-subset-selection'}};f.rounds.splice(-1,0,seen);f.answers[seen.id]={confirmed:true,workIds:ids(seen),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false};assert.deepEqual(build(f).checks,[]);
});

function favouriteFixture(selected){
  const f=fixture(),history=f.rounds.slice(0,-1),template=buildOrdinalRefinementRound({works:f.works,id:'journey-046',role:'favourites',slot:1,seed:'ordinal-favourites-contract'}),grid=bindOrdinalRefinementRound({round:template,works:f.works,rounds:history,answers:f.answers});delete f.answers[f.bound.id];f.answers[grid.id]={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:selected,explicitNone:false,unsure:false,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}};return{...f,rounds:[...history,grid],grid};
}
test('Explicit favourites refine only a captured same-set order, never arbitrary positions from separate sets',()=>{
  const f=favouriteFixture(['c0']),result=build(f);assert.equal(result.favouriteRefinements.length,1);const reading=result.favouriteRefinements[0];assert.equal(reading.readingBasis,'explicit-favourite-after-local-order');assert.ok(reading.pairs.every(pair=>pair.sourceRoundIds.length===1));assert.ok(reading.support.some(item=>item.roundId==='journey-046'));assert.doesNotMatch(reading.text,/higher.*rating|changed your taste/i);
  const noWithin=favouriteFixture(['c0','c1','c2','c3']);assert.deepEqual(build(noWithin).favouriteRefinements,[],'Unselected works in other sets do not make a cross-set numeric favourite reversal');
});

test('A missing or altered full source snapshot suppresses ordinal favourite refinement without guessing its old order',()=>{
  const f=favouriteFixture(['c0']),meta=f.grid.evidence.finalRefinement;delete meta.sourceComparisons;assert.deepEqual(build(f).favouriteRefinements,[]);
});
