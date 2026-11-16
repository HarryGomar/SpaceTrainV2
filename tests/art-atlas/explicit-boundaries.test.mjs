import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteBoundaries} from '../../public/art-atlas/taste-boundaries.mjs';
import {withComparisonPreference,COMPARISON_PROTOCOL} from '../../public/art-atlas/comparison-protocol.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {composeTasteSummary} from '../../public/art-atlas/profile-summary.mjs';

function fixture(count=3){
  const works=Array.from({length:count*4},(_,i)=>({id:'e'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/e'+i,image:'assets/e'+i+'.jpg',sha256:(i+1).toString(16).padStart(64,'0')})),annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((work,i)=>[work.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:work.image,sha256:work.sha256,width:640,height:480,compositionMatch:'same-composition',mediaBinding:'source-matched'},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key==='precise-rendering'||key==='human-relationships'&&i%2===0?'present':'absent',reason:'Visually reviewed '+key,evidenceKind:'visual-review'}]))}]))};
  const rounds=Array.from({length:count},(_,i)=>withComparisonPreference({id:'p'+i,kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,{confirmed:true,criterion:'preference',workIds:r.works.map(w=>w.id),positions:Object.fromEntries(r.works.map((w,i)=>[w.id,i]))}]));
  const anchor=(id,negative,selectedIds,offered=works)=>{const r={id,kind:'choice-grid',selectionMode:'shortlist',maxChoices:negative?offered.length:Math.min(5,offered.length),allowUnsure:true,works:offered,evidence:{construct:negative?'overall-dislikes':'overall-favourites',[negative?'explicitDislikes':'explicitFavourites']:true,anchorComparisonProtocol:COMPARISON_PROTOCOL}};rounds.push(r);answers[id]={confirmed:true,workIds:offered.map(w=>w.id),selectionMode:'shortlist',selectedIds,explicitNone:!selectedIds.length,unsure:false};return r;};
  return{works,rounds,answers,annotationReviews,anchor};
}
function declared(count=3){const f=fixture(count);f.anchor('favourites',false,['e0','e4','e8']);f.anchor('dislikes',true,['e1','e5','e9']);return f;}
const result=f=>buildTasteBoundaries(f),main=model=>model.findings.find(item=>item.status==='explicit-choice-contrast');
const attr=(f,id,key,status)=>f.annotationReviews.reviews[id].attributes[key].status=status;

test('Three explicit favourites and dislikes yield a source-bound conditional contrast without invented rating values',()=>{
  const f=declared(),before=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews}),model=result(f),finding=main(model);
  assert.ok(finding);assert.equal(finding.sharedQuality,'precise-rendering');assert.equal(finding.contrastQuality,'human-relationships');assert.equal(finding.direction,1);assert.equal(finding.exploratory,true);assert.equal(finding.independentReplicationClaim,false);assert.equal(finding.supportPairs.length,3);assert.deepEqual(finding.highWorkIds,['e0','e4','e8']);assert.deepEqual(finding.lowWorkIds,['e1','e5','e9']);assert.equal(finding.coverage.distinctDiscoverySets,3);assert.equal(finding.coverage.favouriteArtists,3);assert.equal(finding.coverage.dislikeArtists,3);
  for(const pair of finding.supportPairs){assert.equal(pair.highLabel,'Favourite');assert.equal(pair.lowLabel,'Disliked');assert.equal('highValue' in pair,false);assert.equal('lowValue' in pair,false);assert.equal(pair.favouriteRoundId,'favourites');assert.equal(pair.dislikeRoundId,'dislikes');assert.ok(pair.comparisonRoundIds.length);}
  assert.deepEqual(finding.displayWorkIds,['e0','e1']);assert.equal(finding.support.every(item=>['favourites','dislikes'].includes(item.roundId)),true);assert.ok(finding.annotationBasis.every(item=>item.bindingStatus==='captured-preview-hash'));assert.doesNotMatch(finding.text,/cause|probability|personality|100|0–100/);assert.deepEqual({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews},before);
  const summary=composeTasteSummary({tasteBoundaries:model,observations:[{id:'neighbour',module:'taste-and-neighbours',priority:999,text:'An isolated neighbour choice.'}]});assert.equal(summary.title,finding.title);assert.equal(summary.text,finding.text);assert.deepEqual(summary.findingIds,[finding.id]);assert.ok(summary.workIds.every(id=>finding.highWorkIds.includes(id)),'The heading does not turn the disliked comparison into a favourite hero');
});

test('Ordinal location and even exact-tie changes cannot turn these direct declarations into numeric high/low ratings',()=>{
  const a=declared(),b=declared();for(const r of b.rounds.filter(r=>r.kind==='spectrum'))for(const id of r.works.map(w=>w.id))b.answers[r.id].positions[id]=100;assert.deepEqual(main(result(a)),main(result(b)));
});

test('Too few explicit dislikes, non-selection, None and unsure do not manufacture a negative group',()=>{
  const f=declared();f.answers.dislikes.selectedIds=['e1','e5'];let model=result(f);assert.equal(main(model),undefined);assert.equal(model.explicitChoices.coverage.currentDislikes,2);
  for(const mode of ['none','unsure','missing']){const x=declared();x.answers.dislikes.selectedIds=[];x.answers.dislikes.explicitNone=mode==='none';x.answers.dislikes.unsure=mode==='unsure';if(mode==='missing')delete x.answers.dislikes;model=result(x);assert.equal(main(model),undefined);assert.equal(model.explicitChoices.coverage.currentDislikes,0);}
});

test('Unknown and mismatched visual reviews are excluded rather than silently assigned to the absent side',()=>{
  for(const mutate of [f=>{for(const id of ['e1','e5','e9'])attr(f,id,'human-relationships','unknown');},f=>f.works[1].sha256='f'.repeat(64),f=>delete f.annotationReviews.reviews.e1,f=>f.annotationReviews.version='wrong']){const f=declared();mutate(f);const model=result(f);assert.equal(main(model),undefined);const audit=model.explicitChoices.rulesChecked.find(item=>item.id==='precision-relationships');assert.ok(audit.coverage.unknownSharedQuality+audit.coverage.unknownContrastWithinShared>0);}
});

test('Artist and original discovery diversity cannot be supplied by repeated questions or workshop labels',()=>{
  for(const mutate of [f=>{for(const id of ['e0','e4','e8'])f.works.find(w=>w.id===id).artist='One artist';},f=>{for(const id of ['e1','e5','e9'])f.works.find(w=>w.id===id).artist='Workshop of one artist';},f=>f.rounds[2].evidence.role='probe',f=>f.rounds[2].evidence.stimulusVisibility='not-shown']){const f=declared();mutate(f);assert.equal(main(result(f)),undefined);}
});

test('All current opposing declarations remain counterexamples while the dominant contrast can qualify',()=>{
  const f=fixture(4);f.anchor('favourites',false,['e0','e4','e8','e13']);f.anchor('dislikes',true,['e1','e5','e9','e12']);const finding=main(result(f));assert.ok(finding);assert.deepEqual(new Set(finding.counterWorkIds),new Set(['e12','e13']));assert.equal(finding.counterExamples.length,2);assert.ok(finding.counter.some(item=>item.roundId==='favourites'&&item.workIds.includes('e13')));assert.ok(finding.counter.some(item=>item.roundId==='dislikes'&&item.workIds.includes('e12')));assert.equal(finding.coverage.favouritesWithContrast,3);assert.equal(finding.coverage.dislikesWithContrast,1);
});

test('Substantial contrary declarations suppress a strong conditional reading',()=>{
  const f=declared();f.answers.favourites.selectedIds=['e0','e4','e9'];f.answers.dislikes.selectedIds=['e1','e5','e8'];assert.equal(main(result(f)),undefined);
});

test('The reverse direction keeps exact Favourite/Disliked illustration roles',()=>{
  const f=declared();f.answers.favourites.selectedIds=['e1','e5','e9'];f.answers.dislikes.selectedIds=['e0','e4','e8'];const finding=main(result(f));assert.ok(finding);assert.equal(finding.direction,-1);assert.deepEqual(finding.displayWorkIds,['e1','e0']);assert.equal(finding.displayNotes.e1,'Favourite');assert.equal(finding.displayNotes.e0,'Explicitly disliked');
});

test('Disjoint presented anchor pools remain visible as an exposure limit rather than a clean separating rule',()=>{
  const f=fixture(6);f.anchor('favourites',false,['e0','e4','e8'],f.works.slice(0,12));f.anchor('dislikes',true,['e13','e17','e21'],f.works.slice(12));const model=result(f);assert.equal(main(model),undefined);assert.equal(model.explicitChoices.coverage.currentFavourites,3);assert.equal(model.explicitChoices.coverage.currentDislikes,3);assert.equal(model.explicitChoices.coverage.sharedPresentedPoolWorks,0);assert.equal(model.explicitChoices.coverage.excludedDifferentPoolWorkIds.length,6);
});

test('Latest signed declarations control the cohorts while earlier contradictory declarations remain response history',()=>{
  const f=fixture();f.anchor('earlier-dislikes',true,['e0','e1','e5','e9']);f.anchor('favourites',false,['e0','e4','e8']);const finding=main(result(f));assert.ok(finding);assert.deepEqual(finding.lowWorkIds,['e1','e5','e9']);assert.ok(finding.responseRevisions.some(item=>item.roundId==='earlier-dislikes'&&item.workIds.includes('e0')));assert.equal(finding.coverage.dislikesWithContrast,0);
});

test('Nested conditional descriptions collapse without hiding their complete alternative audit',()=>{
  const f=declared();for(const work of f.works)attr(f,work.id,'pattern-rhythm','present');const model=result(f);assert.equal(model.explicitChoices.findings.length,1);assert.ok(model.explicitChoices.coverage.qualifiedBeforeCollapse>=2);assert.ok(main(model).relatedRuleIds.length);assert.ok(main(model).relatedContrasts[0].supportPairs.length===3);
});
