import test from 'node:test';
import assert from 'node:assert/strict';
import {linkArrangementPatterns} from '../../public/art-atlas/profile-arrangement-links.mjs';
import {composeTasteSummary} from '../../public/art-atlas/profile-summary.mjs';

function fixture(){
  const pattern={id:'taste-source',qualityKey:'dramatic-light',title:'Light & drama',text:'A qualified observed quality.',attributes:['dramatic-light'],status:'qualified',summaryEligible:true,direction:1,supportingSetCount:3,opposingSetCount:1,eligibleSetCount:4,positiveWorkCount:6,evidence:['a','b','c','d'],support:[{roundId:'preference-source',workIds:['a','b']}],counter:[{roundId:'counter-source',workIds:['c','d']}]};
  const finding={id:'room-quality',module:'arrangement-quality',status:'descriptive-arrangement',notPreferenceEvidence:true,instrument:'museum',qualityKeys:['dramatic-light'],attributes:['dramatic-light'],relation:'grouped-by-shared-quality',direction:1,sourceRoundIds:['scenario:room'],sourceRecordIds:['room'],evidence:['a','b','other'],support:[{roundId:'scenario:room',workIds:['a','b'],detail:'Same room.'}],counter:[{roundId:'scenario:room',workIds:['b','other'],detail:'A grouping exception.'}],annotationEvidence:[{workId:'a',sourceUrl:'https://museum.example/a',image:'assets/a.jpg',previewSha256:'a'.repeat(64)}]};
  return {pattern,finding};
}

test('A source-bound grouping connects to an already qualified quality without changing preference counts or evidence roles',()=>{
  const {pattern,finding}=fixture(),before=structuredClone({pattern,finding}),linked=linkArrangementPatterns([pattern],[finding])[0];
  for(const field of ['supportingSetCount','opposingSetCount','eligibleSetCount','positiveWorkCount','support','counter'])assert.deepEqual(linked[field],pattern[field]);
  assert.equal(linked.arrangementConnections.length,1);assert.equal(linked.arrangementConnections[0].preferenceCountsUnchanged,true);assert.deepEqual(linked.arrangementConnections[0].sourceRoundIds,['scenario:room']);assert.equal(linked.arrangementConnections[0].counter.length,1);assert.deepEqual({pattern,finding},before);
  const summary=composeTasteSummary({tastePatterns:{patterns:[linked],readingSummary:{title:pattern.title,text:pattern.text,patternIds:[pattern.id],workIds:['a','b']}}});assert.deepEqual(summary.findingIds,[pattern.id,finding.id]);assert.match(summary.text,/rooms you arranged/);
});

test('A contrasting arrangement is context rather than a fabricated reversal of liking',()=>{
  const {pattern,finding}=fixture();finding.relation='grouped-by-quality-contrast';finding.direction=-1;const linked=linkArrangementPatterns([pattern],[finding])[0];assert.equal(linked.direction,1);assert.equal(linked.arrangementConnections[0].relation,'grouped-by-quality-contrast');assert.match(linked.arrangementSummary,/contrasting examples/);assert.equal(linked.opposingSetCount,1);
});

test('One component of a combination is labelled as partial and unqualified or unrelated findings stay separate',()=>{
  const {pattern,finding}=fixture();pattern.attributes=['dramatic-light','intimate-figures'];const linked=linkArrangementPatterns([pattern],[finding])[0];assert.equal(linked.arrangementConnections[0].scope,'one-component-of-combination');assert.match(linked.arrangementSummary,/one part of this connection/);
  for(const mutate of [p=>p.summaryEligible=false,p=>p.status='mixed',p=>p.attributes=['pattern-rhythm'],p=>p.evidence=['unrelated']]){const {pattern:next,finding:f}=fixture();mutate(next);if(next.evidence[0]==='unrelated')next.support=[];assert.equal(linkArrangementPatterns([next],[f])[0].arrangementConnections,undefined);}
});

test('Missing source reviews, unsupported arrangement roles and insufficient shared actual works cannot attach',()=>{
  for(const mutate of [f=>f.notPreferenceEvidence=false,f=>f.annotationEvidence=[],f=>f.sourceRoundIds=['preference-source'],f=>f.evidence=['a','different'],f=>f.module='one-off-neighbour']){const {pattern,finding}=fixture();mutate(finding);assert.equal(linkArrangementPatterns([pattern],[finding])[0].arrangementConnections,undefined);}
});
