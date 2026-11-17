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

test('Admiration cannot name overall taste, even when its local evidence has highest priority',()=>{
  const pattern={id:'admiration',title:'Relationships between people',channel:'admiration-of-making',status:'qualified',summaryEligible:true,direction:1,priority:999};
  const result=composeTasteSummary({tastePatterns:{patterns:[pattern],readingSummary:{title:pattern.title,patternIds:[pattern.id],text:'An admiration finding.'}}});
  assert.equal(result.title,'Art profile');assert.deepEqual(result.findingIds,[]);
});

test('Existing qualified connections remain available without replacing them with one-off checks',()=>{
  const theme={id:'worlds',title:'Stories & imagined worlds',findingIds:['worlds'],workIds:['a','b']};
  const result=composeTasteSummary({themes:[theme],observations:[{id:'worlds',module:'curatorial-themes',text:'A shared quality across these choices. Here is the evidence.'},{id:'neighbour',module:'taste-and-neighbours',priority:999}],legacyBasis:'qualified-positive-patterns'});
  assert.equal(result.title,theme.title);assert.equal(result.text,'A shared quality across these choices.');assert.equal(result.basis,'qualified-positive-patterns');
});

const boundary=()=>({id:'boundary-source',status:'explicit-choice-contrast',summaryEligible:true,measurementScope:'explicit-favourite-dislike-choices',direction:1,title:'Detail with an encounter',text:'These explicit choices share fine detail but differ in their human exchanges.',highWorkIds:['f1','f2','f3'],lowWorkIds:['d1','d2','d3'],displayWorkIds:['f1','d1'],supportPairs:[{},{},{}],coverage:{favouriteArtists:3,dislikeArtists:3,distinctDiscoverySets:3},support:[{roundId:'fav',workIds:['f1','f2','f3']},{roundId:'dis',workIds:['d1','d2','d3']}]});
test('A qualified explicit boundary supplies the summary before a broad-axis fallback',()=>{
  const item=boundary(),axis={key:'colour',status:'leaning',direction:1,eligibleSetCount:5,supportingSetCount:5,opposingSetCount:0,summary:'Stronger colour.'},result=composeTasteSummary({tasteBoundaries:{findings:[item]},axesProfile:{axes:[axis]}});
  assert.equal(result.title,item.title);assert.equal(result.text,item.text);assert.deepEqual(result.findingIds,[item.id]);assert.equal(result.basis,'explicit-choice-contrast');assert.deepEqual(result.workIds,item.highWorkIds);
});
test('A stronger qualified ordinal quality keeps its heading and retains the supported conditional source',()=>{
  const item=boundary(),pattern={id:'story',qualityKey:'scenes-within-scenes',channel:'ordinal-choice',status:'qualified',summaryEligible:true,direction:1},result=composeTasteSummary({tastePatterns:{patterns:[pattern],readingSummary:{title:'Stories within scenes',text:'A comparison pattern.',patternIds:['story'],workIds:['f1','f2']}},tasteBoundaries:{findings:[item]},observations:[{id:'neighbour',module:'taste-and-neighbours',priority:999}]});
  assert.equal(result.title,'Stories within scenes');assert.match(result.text,/comparisons repeatedly favour/);assert.doesNotMatch(result.text,/overall ratings|neighbour/);assert.deepEqual(result.findingIds,['story',item.id]);
});
test('Descriptive, withheld or insufficient explicit boundaries cannot become the profile title',()=>{
  for(const change of [{status:'descriptive'},{summaryEligible:false},{coverage:{favouriteArtists:2,dislikeArtists:3,distinctDiscoverySets:3}}]){const result=composeTasteSummary({tasteBoundaries:{findings:[{...boundary(),...change}]},observations:[{id:'neighbour',module:'taste-and-neighbours',priority:999}]});assert.equal(result.title,'Art profile');assert.deepEqual(result.findingIds,[]);}
});
