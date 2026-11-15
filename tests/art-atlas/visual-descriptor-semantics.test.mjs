import test from 'node:test';
import assert from 'node:assert/strict';
import {isReviewedVisualDescriptor,FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';

const FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
function fixture(feature,reviewed=true){
  const works=Array.from({length:60},(_,i)=>({id:'semantic-'+i,artist:'Artist '+i,artistKnown:true,country:'Region '+i%4,features:Object.fromEntries(FEATURES.map(key=>[key,key===feature?(i%3)/2:.5])),...(reviewed?{featureSemanticVersion:FEATURE_SEMANTIC_VERSION}:{})}));
  const rounds=Array.from({length:12},(_,i)=>({id:'prior-'+i,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Equal positions are fine.',works:works.slice(i*3,i*3+3),evidence:{construct:'preference',family:'individual-choice',role:'discovery',batchIndex:0,setId:'set-'+i}}));
  const answers=Object.fromEntries(rounds.map(r=>[r.id,{workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map(w=>[w.id,Math.round(w.features[feature]*100)])),confirmed:true}]));
  return {works,rounds,answers,batchIndex:1,seed:'semantic-regression'};
}

test('Literal action and setting require the exact semantic marker, including when the value is zero',()=>{
  for(const key of ['narrative','atmosphere']){
    assert.equal(isReviewedVisualDescriptor({features:{[key]:0}},key),false);
    assert.equal(isReviewedVisualDescriptor({features:{[key]:0},featureSemanticVersion:FEATURE_SEMANTIC_VERSION},key),true);
    assert.equal(isReviewedVisualDescriptor({features:{[key]:1},featureSemanticVersion:'old-or-unknown'},key),false);
    assert.equal(isReviewedVisualDescriptor({features:{[key]:.5},featureAnnotationVersion:'visible-action-setting-review-v1',featureSource:'Manually reviewed literal action'},key),false,'Free text and another revision cannot certify this semantic definition');
  }
});

test('The other five dimensions retain their original numeric-only requirements',()=>{
  for(const key of FEATURES.filter(k=>!['narrative','atmosphere'].includes(k))){
    for(const value of [0,.25,1])assert.equal(isReviewedVisualDescriptor({features:{[key]:value}},key),true);
    for(const value of [undefined,null,'0',NaN,Infinity,-.1,1.1])assert.equal(isReviewedVisualDescriptor({features:{[key]:value},featureSemanticVersion:FEATURE_SEMANTIC_VERSION},key),false);
  }
});

test('Untyped legacy action/setting values cannot supply new literal-feature predictions',()=>{
  for(const key of ['narrative','atmosphere']){
    const input=fixture(key,false),before=structuredClone(input),planned=planAdaptivePanels(input);
    assert(planned.panels.every(p=>!p.provisionalHypothesis));
    assert.deepEqual(input,before,'Saved descriptors and ratings must remain intact');
  }
});

test('New literal-feature probes freeze every training and proposed-work semantic version',()=>{
  for(const key of ['narrative','atmosphere']){
    const input=fixture(key),planned=planAdaptivePanels(input),probes=planned.panels.filter(p=>p.provisionalHypothesis);
    assert(probes.length>0);
    for(const p of probes){
      const h=p.provisionalHypothesis;assert.equal(h.feature,key);assert.equal(h.featureSemanticVersion,FEATURE_SEMANTIC_VERSION);
      for(const source of h.trainingEvidence){
        assert.deepEqual(Object.keys(source.featureSemanticVersions).sort(),[...source.workIds].sort());
        assert(Object.values(source.featureSemanticVersions).every(v=>v===FEATURE_SEMANTIC_VERSION));
      }
      assert.deepEqual(Object.keys(h.testFeatureSemanticVersions).sort(),[...p.workIds].sort());
      assert(Object.values(h.testFeatureSemanticVersions).every(v=>v===FEATURE_SEMANTIC_VERSION));
    }
    input.works.forEach(w=>{w.featureSemanticVersion='later-change';});
    assert(probes.every(p=>p.provisionalHypothesis.trainingEvidence.every(e=>Object.values(e.featureSemanticVersions).every(v=>v===FEATURE_SEMANTIC_VERSION))));
  }
});

test('A partly unreviewed source set cannot create an incomplete literal-feature training snapshot',()=>{
  const input=fixture('narrative');
  for(const round of input.rounds)delete round.works[0].featureSemanticVersion;
  const planned=planAdaptivePanels(input);assert(planned.panels.every(p=>!p.provisionalHypothesis));
});

test('Unreviewed artists cannot inflate the four-artist gate for a literal-feature hypothesis',()=>{
  const input=fixture('narrative');
  input.works.forEach((work,index)=>{if(index<9)work.artist='One reviewed artist';else delete work.featureSemanticVersion;});
  assert(planAdaptivePanels(input).panels.every(p=>!p.provisionalHypothesis));
});

test('Unreviewed proposed works cannot receive a literal-feature prediction learned elsewhere',()=>{
  const input=fixture('atmosphere');input.works.slice(36).forEach(w=>{delete w.featureSemanticVersion;});
  const byId=new Map(input.works.map(w=>[w.id,w])),planned=planAdaptivePanels(input);
  for(const p of planned.panels.filter(p=>p.provisionalHypothesis))assert(p.workIds.every(id=>isReviewedVisualDescriptor(byId.get(id),'atmosphere')));
});

test('Legacy numeric evidence for unchanged features still produces the same kind of prospective probe',()=>{
  const planned=planAdaptivePanels(fixture('abstraction',false)),probes=planned.panels.filter(p=>p.provisionalHypothesis);
  assert(probes.length>0);assert(probes.every(p=>p.provisionalHypothesis.feature==='abstraction'));
  assert(probes.every(p=>p.provisionalHypothesis.featureSemanticVersion===undefined));
});
