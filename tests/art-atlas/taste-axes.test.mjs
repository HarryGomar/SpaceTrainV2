import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteAxes,collectTastePatternSources,analyzeTasteDimension,TASTE_AXIS_DEFINITIONS} from '../../public/art-atlas/taste-axes.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';

function fixture(count=4){
  const works=Array.from({length:count*2},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/'+i,image:'assets/'+i+'.jpg',featureSemanticVersion:FEATURE_SEMANTIC_VERSION,features:Object.fromEntries(['humanity','abstraction','color','complexity','energy','narrative','atmosphere'].map(key=>[key,i%2?0:1]))}));
  const round=(id,indexes,overall=false,extra={})=>{
    const r={id,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Rate each work within this set.',works:indexes.map(i=>works[i]),evidence:{construct:'preference',family:'individual-choice',role:'discovery',...extra}};
    return overall?withOverallAppeal(r):r;
  };
  const answer=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:r.criterion,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true});
  const rounds=Array.from({length:count},(_,i)=>round('p'+i,[i*2,i*2+1]));
  return {works,rounds,round,answer,answers:Object.fromEntries(rounds.map(r=>[r.id,answer(r,[90,10])]))};
}
const axis=(profile,key='colour')=>profile.axes.find(row=>row.key===key);

test('All six axes are present, and a direction needs disjoint comparisons across artists and sets',()=>{
  const f=fixture(3),before=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers}),profile=buildTasteAxes(f);
  assert.deepEqual(profile.axes.map(row=>row.key),TASTE_AXIS_DEFINITIONS.map(row=>row.key));
  for(const row of profile.axes){assert.equal(row.status,'leaning');assert.equal(row.direction,1);assert.equal(row.supportingSetCount,3);assert.equal(row.eligibleSetCount,3);assert.equal(row.summaryEligible,true);assert.equal('percentile' in row,false);assert.ok(row.support.every(item=>f.answers[item.roundId]));}
  assert.deepEqual(f.works,before.works);assert.deepEqual(f.rounds,before.rounds);assert.deepEqual(f.answers,before.answers);
});

test('Repeated sets, changed set labels and one winning artist do not create replication',()=>{
  const f=fixture(3),again={...f.rounds[0],id:'again',works:[...f.rounds[0].works].reverse(),evidence:{...f.rounds[0].evidence,setId:'different-label'}};
  let profile=buildTasteAxes({...f,rounds:[f.rounds[0],again],answers:{p0:f.answers.p0,again:f.answer(again,[10,90])}});
  assert.equal(axis(profile).eligibleSetCount,1);assert.equal(axis(profile).status,'insufficient');
  for(const work of f.works.filter((_,i)=>i%2===0))work.artist='One painter';
  profile=buildTasteAxes(f);assert.equal(axis(profile).eligibleSetCount,3);assert.equal(axis(profile).status,'insufficient');assert.equal(axis(profile).direction,0);assert.equal(axis(profile).summaryEligible,false);
});

test('Shared works never become six independent supporting paintings',()=>{
  const f=fixture(4),rounds=[f.round('a',[0,1]),f.round('b',[0,3]),f.round('c',[0,5]),f.round('d',[0,7])],answers=Object.fromEntries(rounds.map(r=>[r.id,f.answer(r,[90,10])])),profile=buildTasteAxes({...f,rounds,answers});
  assert.equal(axis(profile).eligibleSetCount,1);assert.equal(axis(profile).summaryEligible,false);assert.equal(profile.coverage.preferenceScopes[0].dependentChecks,3);
});

test('Counterexamples and near ties keep an axis mixed rather than forcing a type',()=>{
  const f=fixture(4);f.answers.p2=f.answer(f.rounds[2],[10,90]);f.answers.p3=f.answer(f.rounds[3],[52,50]);const row=axis(buildTasteAxes(f));
  assert.equal(row.status,'mixed');assert.equal(row.presentationStatus,'balanced');assert.equal(row.direction,0);assert.equal(row.supportingSetCount,2);assert.equal(row.opposingSetCount,1);assert.equal(row.mixedSetCount,1);assert.equal(row.eligibleSetCount,4);assert.ok(row.counter.some(item=>item.roundId==='p2'));assert.equal(row.counter.some(item=>item.roundId==='p3'),false);
});

test('Zero descriptors and zero response values are data; absent descriptors stay unknown',()=>{
  const f=fixture(3);for(const r of f.rounds)f.answers[r.id]=f.answer(r,[100,0]);let row=axis(buildTasteAxes(f));assert.equal(row.status,'leaning');assert.equal(row.exposureBaseline.low,3);
  delete f.works[1].features.color;row=axis(buildTasteAxes(f));assert.equal(row.eligibleSetCount,2);assert.equal(row.exposureBaseline.unknown,1);assert.equal(row.status,'insufficient');
  for(const work of f.works)delete work.features.color;row=axis(buildTasteAxes(f));assert.equal(row.knownWorkCount,0);assert.equal(row.exposureBaseline.unknown,6);assert.equal(row.summaryEligible,false);
});

test('Earlier action and setting meanings cannot silently inherit current literal annotations',()=>{
  const f=fixture(3);for(const work of f.works)delete work.featureSemanticVersion;const profile=buildTasteAxes(f);
  assert.equal(axis(profile,'action-stillness').knownWorkCount,0);assert.equal(axis(profile,'setting-atmosphere').knownWorkCount,0);assert.equal(axis(profile,'colour').status,'leaning');
});

test('Legacy comparisons and overall appeal stay separate even when their positions match',()=>{
  const f=fixture(4),overall=f.round('overall',[6,7],true),profile=buildTasteAxes({...f,rounds:[...f.rounds.slice(0,3),overall],answers:{...f.answers,overall:f.answer(overall,[10,90])}});
  assert.equal(profile.coverage.preferenceScopes.length,2);assert.equal(profile.coverage.activeChannel,'relative-choice');assert.equal(axis(profile).eligibleSetCount,3);assert.equal(axis(profile).comparisonBasis,'legacy-within-set-comparisons');assert.doesNotMatch(axis(profile).summary,/you like|favourites/);
});

test('Skipped, unconfirmed, contextual, identity-mismatched and malformed answers add no comparisons',()=>{
  const f=fixture(3);
  for(const mutate of [x=>x.answers.p1.confirmed=false,x=>x.answers.p1.skipped=true,x=>x.answers.p1.roundId='another-round',x=>x.answers.p1.positions.extra=80,x=>x.rounds[1].evidence.family='contextual-choice',x=>x.rounds[1].anchorWorks=[x.works[0]],x=>x.answers.p1.workIds.reverse(),x=>x.rounds[1].workIds=['another','identity']]){
    const next=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers});mutate(next);assert.equal(axis(buildTasteAxes(next)).eligibleSetCount,2);
  }
});

test('Detail and visual activity remain separate components, and opposing components do not become one direction',()=>{
  const f=fixture(3);for(const work of f.works)work.features.energy=1-work.features.complexity;const row=axis(buildTasteAxes(f),'detail-composition');
  assert.equal(row.components[0].direction,1);assert.equal(row.components[1].direction,-1);assert.equal(row.status,'mixed');assert.equal(row.direction,0);assert.equal(row.mixedSetCount,3);assert.equal(row.eligibleSetCount,row.supportingSetCount+row.opposingSetCount+row.mixedSetCount);
});

test('Admiration uses its own original vertical instrument, not liking or an altered label',()=>{
  const f=fixture(3),maps=f.rounds.map((r,i)=>({id:'a'+i,kind:'grid',axis:'achievement',axisDefinition:structuredClone(AXES.achievement),title:'How much do you admire the making?',works:r.works,evidence:{construct:'perceived-achievement',family:'appraisal-map',role:'check'}})),answers={...f.answers,...Object.fromEntries(maps.map(r=>[r.id,{workIds:r.works.map(w=>w.id),axis:'achievement',points:Object.fromEntries(r.works.map((w,i)=>[w.id,i?[90,10]:[10,90]])),confirmed:true}]))};
  let sources=collectTastePatternSources({...f,rounds:[...f.rounds,...maps],answers});assert.equal(sources.admiration.workCount,6);assert.equal(sources.admiration.sets.length,3);assert.deepEqual(sources.admiration.sets[0].items.map(item=>item.value),[90,10]);
  const changed=structuredClone(maps);changed[0].axisDefinition.yName='How familiar';sources=collectTastePatternSources({...f,rounds:changed,answers});assert.equal(sources.admiration.sets.length,2);
});

test('Later reversals remain dependent counterevidence without increasing the discovery denominator',()=>{
  const f=fixture(3),checks=f.rounds.slice(0,2).map((r,i)=>({...r,id:'repeat'+i,evidence:{...r.evidence,role:'repeat',repeatOf:r.id}})),answers={...f.answers,...Object.fromEntries(checks.map(r=>[r.id,f.answer(r,[10,90])]))},row=axis(buildTasteAxes({...f,rounds:[...f.rounds,...checks],answers}));
  assert.equal(row.eligibleSetCount,3);assert.equal(row.supportingSetCount,3);assert.equal(row.checkBalance.distinctOpposingSets,2);assert.equal(row.status,'tentative');assert.equal(row.presentationStatus,'tentative');assert.equal(row.direction,1);assert.equal(row.laterStatus,'later-exceptions');assert.equal(row.summaryEligible,false);assert.equal(row.counter.filter(item=>item.sourceRole==='repeated response').length,2);
  const composite=axis(buildTasteAxes({...f,rounds:[...f.rounds,...checks],answers}),'detail-composition');assert.equal(composite.eligibleSetCount,3,'Dependent checks cannot enlarge the composite discovery denominator');assert.equal(composite.summaryEligible,false);
});

test('A binary quality requires an actual present/absent opportunity, not prevalence alone',()=>{
  const f=fixture(3),scope=collectTastePatternSources(f).preferenceScopes[0],allPresent=analyzeTasteDimension(scope,()=>1,{descriptorGap:1});assert.equal(allPresent.eligibleSetCount,0);assert.equal(allPresent.status,'not-tested');
});

test('A5/1 directional split remains tentative when3 other sets are unresolved and later checks disagree',()=>{
  const f=fixture(9);f.answers.p5=f.answer(f.rounds[5],[10,90]);for(const r of f.rounds.slice(6))f.answers[r.id]=f.answer(r,[50,50]);
  const later=f.rounds.slice(0,2).map((r,i)=>({...r,id:'check-'+i,evidence:{...r.evidence,role:'probe'}})),answers={...f.answers,...Object.fromEntries(later.map(r=>[r.id,f.answer(r,[10,90])]))},row=axis(buildTasteAxes({...f,rounds:[...f.rounds,...later],answers}),'human-presence');
  assert.equal(row.presentationStatus,'tentative');assert.equal(row.direction,1);assert.equal(row.summaryEligible,false);assert.deepEqual(row.counts,{towardLower:1,towardHigher:5,unresolved:3,discoverySets:9});assert.equal(row.laterChecks.opposing,2);assert.equal(row.laterChecks.independentReplications,false);assert.equal(row.support.length,3);assert.equal(new Set(row.support.map(item=>item.roundId)).size,3);assert.equal(row.responseLedger.length,22);
});

test('An8/3 directional split with4 unresolved sets is an explicit tentative tendency, not a recurring headline',()=>{
  const f=fixture(15);for(const r of f.rounds.slice(8,11))f.answers[r.id]=f.answer(r,[10,90]);for(const r of f.rounds.slice(11))f.answers[r.id]=f.answer(r,[50,50]);const row=axis(buildTasteAxes(f),'setting-atmosphere');
  assert.equal(row.presentationStatus,'tentative');assert.equal(row.direction,1);assert.equal(row.supportingSetCount,8);assert.equal(row.opposingSetCount,3);assert.equal(row.mixedSetCount,4);assert.equal(row.summaryEligible,false);assert.equal(row.evidenceDiversity.disjointSupportingComparisons,3);
});

test('Low ratings and positions survive homogeneous sets without inventing descriptor directions',()=>{
  const f=fixture(2);for(const work of f.works){work.features.humanity=1;work.features.complexity=1;}
  const r=f.round('all-people',[0,1,2,3],true),answer=f.answer(r,[95,84,30,20]),p=buildTasteAxes({...f,rounds:[r],answers:{[r.id]:answer}}),human=axis(p,'human-presence'),detail=axis(p,'detail-composition').components.find(item=>item.feature==='complexity');
  for(const row of [human,detail]){assert.equal(row.eligibleSetCount,0);assert.equal(row.homogeneousSetCount,1);assert.equal(row.setAssessments[0].reason,'insufficient-descriptor-contrast');assert.deepEqual(row.responseLedger.map(item=>item.value),[95,84,30,20]);assert.ok(row.responseLedger.every(item=>item.descriptor===1));assert.deepEqual(row.lowRatingEvidence.map(item=>item.score),[30,20]);assert.equal(row.summaryEligible,false);}
  const legacy={...r,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}};delete legacy.scale;const old=axis(buildTasteAxes({...f,rounds:[legacy],answers:{[r.id]:answer}}),'human-presence');assert.equal(old.lowRatingEvidence.length,0);assert.deepEqual(old.responseLedger.map(item=>item.value),[95,84,30,20]);assert.ok(old.responseLedger.every(item=>item.responseBasis==='position-within-original-artwork-set'));
});
