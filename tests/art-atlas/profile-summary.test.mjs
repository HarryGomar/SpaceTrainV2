import test from 'node:test';
import assert from 'node:assert/strict';
import {composeTasteSummary} from '../../public/art-atlas/profile-summary.mjs';

test('An isolated neighbour reversal cannot become the headline at any priority',()=>{
  const item={id:'neighbour',module:'taste-and-neighbours',title:'Your chosen neighbour differed from your earlier preference.',text:'You chose B beside C after preferring A.',priority:999};
  const result=composeTasteSummary({observations:[item]});
  assert.equal(result.title,'Art profile');assert.deepEqual(result.findingIds,[]);assert.doesNotMatch(result.text,/neighbour|beside|preferr/i);
});

test('Only qualified, summary-eligible quality patterns can name the result',()=>{
  const readingSummary={title:'Dramatic light · Stories within scenes',text:'A connection across styles.',patternIds:['light','story'],workIds:['a','b','a']};
  const result=composeTasteSummary({tastePatterns:{patterns:[{id:'light',status:'qualified',summaryEligible:true},{id:'story',status:'qualified',summaryEligible:true}],readingSummary}});
  assert.equal(result.title,readingSummary.title);assert.deepEqual(result.workIds,['a','b']);
  for(const changed of [{status:'mixed',summaryEligible:true},{status:'qualified',summaryEligible:false}]){
    const withheld=composeTasteSummary({tastePatterns:{patterns:[{id:'light',...changed},{id:'story',status:'qualified',summaryEligible:true}],readingSummary}});
    assert.equal(withheld.title,'Art profile');
  }
});

test('A recurring axis can describe a direction without inventing a percentage or personality type',()=>{
  const axis={key:'representation-abstraction',status:'leaning',direction:-1,eligibleSetCount:5,supportingSetCount:4,opposingSetCount:1,summary:'Recognizable forms led across different subjects.',displayWorkIds:['a','b']};
  const result=composeTasteSummary({axesProfile:{axes:[axis]}});
  assert.equal(result.title,'Recognizable forms');assert.equal(result.text,axis.summary);assert.deepEqual(result.findingIds,['axis-representation-abstraction']);assert.doesNotMatch(JSON.stringify(result),/%|personality/i);
  assert.equal(composeTasteSummary({axesProfile:{axes:[{...axis,eligibleSetCount:1}]}}).title,'Art profile');
});

test('Mixed and missing axes cannot be promoted into a directional identity',()=>{
  for(const status of ['mixed','insufficient','not-tested'])assert.equal(composeTasteSummary({axesProfile:{axes:[{key:'colour',status,direction:1,eligibleSetCount:10,supportingSetCount:10,opposingSetCount:0}]}}).title,'Art profile');
});

test('Existing qualified connections remain available without replacing them with one-off checks',()=>{
  const theme={id:'worlds',title:'Stories & imagined worlds',findingIds:['worlds'],workIds:['a','b']};
  const result=composeTasteSummary({themes:[theme],observations:[{id:'worlds',module:'curatorial-themes',text:'A shared quality across these choices. Here is the evidence.'},{id:'neighbour',module:'taste-and-neighbours',priority:999}],legacyBasis:'qualified-positive-patterns'});
  assert.equal(result.title,theme.title);assert.equal(result.text,'A shared quality across these choices.');assert.equal(result.basis,'qualified-positive-patterns');
});
