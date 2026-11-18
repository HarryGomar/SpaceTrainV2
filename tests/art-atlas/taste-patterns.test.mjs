import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTastePatterns,resolveArtworkAttributes,TASTE_QUALITY_BUNDLES} from '../../public/art-atlas/taste-patterns.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {composeFavouriteSummary} from '../../public/art-atlas/profile-summary.mjs';

function fixture(setCount=3){
  const works=Array.from({length:setCount*4},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/w'+i+'.jpg',sourceUrl:'https://museum.example/w'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const reviews=Object.fromEntries(works.map((work,i)=>[work.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:'assets/large/'+work.id+'.jpg',sha256:work.sha256,width:2000,height:1500,mediaBinding:'source-matched-study-map',compositionMatch:'same-composition'},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key==='dramatic-light'&&i%2===0?'present':'absent',reason:'Reviewed visible criterion for '+key,evidenceKind:'visual-review'}])),sourcedContext:[]} ]));
  const round=(id,indexes,overall=true,extra={})=>{
    const r={id,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Rate within the set.',works:indexes.map(i=>works[i]),evidence:{construct:'preference',family:'individual-choice',role:'discovery',...extra}};return overall?withOverallAppeal(r):r;
  };
  const answer=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:r.criterion,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true}),rounds=Array.from({length:setCount},(_,i)=>round('p'+i,[i*4,i*4+1,i*4+2,i*4+3])),answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r,[90,10,80,20])]));
  return {works,rounds,answers,annotationReviews:{version:ARTWORK_ATTRIBUTE_VERSION,reviews},round,answer};
}
const quality=(model,key='dramatic-light',channel='appeal')=>model[channel].patterns.find(pattern=>pattern.qualityKey===key);
const setStatus=(f,id,key,status)=>f.annotationReviews.reviews[id].attributes[key].status=status;

test('Recurring qualities retain precise support, counterevidence, exposure denominators and annotation provenance',()=>{
  const f=fixture(4);f.answers.p3=f.answer(f.rounds[3],[10,90,20,80]);const before=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews}),model=buildTastePatterns(f),pattern=quality(model);
  assert.equal(pattern.status,'qualified');assert.equal(pattern.direction,1);assert.equal(pattern.summaryEligible,true);assert.equal(pattern.supportingSetCount,3);assert.equal(pattern.opposingSetCount,1);assert.equal(pattern.eligibleSetCount,4);assert.equal(pattern.exposureBaseline.withQuality,8);assert.equal(pattern.exposureBaseline.withoutQuality,8);assert.equal(pattern.exposureBaseline.unknown,0);assert.equal(pattern.counter.some(item=>item.roundId==='p3'),true);assert.equal(pattern.annotationBasis.every(item=>item.bindingStatus==='captured-preview-hash'),true);assert.doesNotMatch(pattern.text,/causes|percentile|probability/);
  assert.deepEqual({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews},before);
});

test('A quality shared by all high works still needs an observed reviewed absence, not a missing review',()=>{
  const f=fixture(3);for(const work of f.works.filter((_,i)=>i%2))delete f.annotationReviews.reviews[work.id];const model=buildTastePatterns(f);assert.equal(quality(model),undefined);const candidate=model.appeal.candidates.find(item=>item.qualityKey==='dramatic-light');assert.equal(candidate.eligibleSetCount,0);assert.equal(candidate.exposureBaseline.unknown,6);assert.equal(candidate.exposureBaseline.withoutQuality,0);assert.equal(model.appeal.associations.find(item=>item.qualityKey==='dramatic-light').summaryEligible,false);
});

test('Malformed/missing attribute statuses are unknown and documented meanings never become visual tags',()=>{
  const f=fixture(3),record=f.annotationReviews.reviews.w0;record.attributes['dramatic-light']={status:'absent',reason:'',evidenceKind:'visual-review'};record.sourcedContext=[{kind:'documented-symbolism',claim:'An institution documents an emblem.',sourceUrl:f.works[0].sourceUrl}];const resolved=resolveArtworkAttributes(f.works[0],f);assert.equal(resolved.attributes['dramatic-light'].status,'unknown');assert.equal(resolved.sourcedContext.length,1);assert.equal(buildTastePatterns(f).patterns.some(pattern=>/symbol|allegor/i.test(pattern.qualityKey)),false);
});

test('Source, image, hash, version and contradictory declared-hash mismatches fail closed',()=>{
  const f=fixture(3);for(const mutate of [x=>x.works[0].sourceUrl='https://other.example/replaced',x=>x.works[0].image='assets/replaced.jpg',x=>x.works[0].sha256='f'.repeat(64),x=>x.works[0].provenance={thumbnailSha256:'f'.repeat(64)},x=>x.annotationReviews.version='another-version',x=>x.annotationReviews.reviews.w0.version='another-version',x=>x.annotationReviews.reviews.w0.reviewedAsset.compositionMatch='different-crop']){
    const next=structuredClone({works:f.works,annotationReviews:f.annotationReviews});mutate(next);assert.equal(resolveArtworkAttributes(next.works[0],next),null);
  }
});

test('An unrecorded historical hash needs a verified current reference and remains explicitly current interpretation',()=>{
  const f=fixture(3),work=structuredClone(f.works[0]);delete work.sha256;assert.equal(resolveArtworkAttributes(work,f),null);
  let resolved=resolveArtworkAttributes(work,{...f,currentWorks:f.works});assert.equal(resolved.annotationBasis.bindingStatus,'current-verified-catalogue-reference');assert.equal(resolved.annotationBasis.historicalPreviewHashRecorded,false);assert.match(resolved.annotationBasis.limit,/does not establish a historical hash match/);
  const reference={sourceUrl:work.sourceUrl,image:work.image,previewSha256:f.works[0].sha256,verification:'sha256-of-current-local-preview'},annotationReviews={...f.annotationReviews,currentAssetReferences:{[JSON.stringify([work.sourceUrl,work.image])]:reference}};
  resolved=resolveArtworkAttributes(work,{annotationReviews});assert.equal(resolved.annotationBasis.bindingStatus,'current-verified-asset-reference');reference.previewSha256='f'.repeat(64);assert.equal(resolveArtworkAttributes(work,{annotationReviews}),null);
  assert.equal('sha256' in work,false);
});

test('Legacy relative order is useful without being promoted to positive overall likes or global score associations',()=>{
  const f=fixture(3);f.rounds=f.rounds.map((r,i)=>f.round(r.id,[i*4,i*4+1,i*4+2,i*4+3],false));const model=buildTastePatterns(f),pattern=quality(model,'dramatic-light','relative');assert.ok(pattern);assert.equal(pattern.status,'qualified');assert.equal(pattern.positiveWorkCount,null);assert.equal(pattern.negativeWorkCount,null);assert.equal(pattern.comparisonBasis,'legacy-within-set-comparisons');assert.match(pattern.text,/relative order/);assert.equal(model.appeal.patterns.length,0);assert.equal(model.appeal.associations.length,0);assert.equal(model.favouriteConnections.patterns.length,0);
});

test('Overall appeal and admiration can reach different directions on the exact same paintings',()=>{
  const f=fixture(3),maps=f.rounds.map((r,i)=>({id:'admire'+i,kind:'grid',axis:'achievement',axisDefinition:structuredClone(AXES.achievement),title:'Admiration of making',works:r.works,evidence:{construct:'perceived-achievement',family:'appraisal-map',role:'check'}}));
  for(const r of maps)f.answers[r.id]={workIds:r.works.map(w=>w.id),axis:'achievement',points:Object.fromEntries(r.works.map((w,i)=>[w.id,[i%2?10:90,i%2?90:10]])),confirmed:true};
  const model=buildTastePatterns({...f,rounds:[...f.rounds,...maps]}),like=quality(model),admire=quality(model,'dramatic-light','admiration');assert.equal(like.direction,1);assert.equal(admire.direction,-1);assert.equal(model.coverage.admirationWorks,12);assert.equal(model.coverage.admirationSets,3);assert.ok(admire.support.every(item=>item.roundId.startsWith('admire')));assert.ok(like.support.every(item=>item.roundId.startsWith('p')));
});

test('Single maps, exact repeats, near ties and repeated artists do not create a qualified quality profile',()=>{
  const f=fixture(3),single=buildTastePatterns({...f,rounds:[f.rounds[0]]});assert.equal(single.patterns.some(item=>item.summaryEligible),false);
  for(const round of f.rounds)f.answers[round.id]=f.answer(round,[51,50,52,49]);assert.equal(buildTastePatterns(f).patterns.some(item=>item.summaryEligible),false);
  for(const round of f.rounds)f.answers[round.id]=f.answer(round,[90,10,80,20]);for(const work of f.works.filter((_,i)=>i%2===0))work.artist='The same preferred painter';assert.equal(buildTastePatterns(f).patterns.some(item=>item.summaryEligible),false);
  const repeat={...f.rounds[0],id:'repeat',evidence:{...f.rounds[0].evidence,repeatOf:'p0',role:'repeat'}};f.answers.repeat=f.answer(repeat,[90,10,80,20]);assert.equal(quality(buildTastePatterns({...f,rounds:[f.rounds[0],repeat]})),undefined);
});

test('Bundles are predeclared, require both qualities, and expose correlated alternatives',()=>{
  const f=fixture(3);for(const work of f.works)setStatus(f,work.id,'intimate-figures',f.annotationReviews.reviews[work.id].attributes['dramatic-light'].status);const model=buildTastePatterns(f),bundle=quality(model,'light-and-figures');assert.equal(TASTE_QUALITY_BUNDLES.length,8);assert.equal(bundle.status,'qualified');assert.deepEqual(bundle.attributes,['dramatic-light','intimate-figures']);assert.ok(bundle.coexplaining.some(item=>item.attributes.length===1&&item.attributes[0]==='dramatic-light'));assert.match(bundle.alternatives.join(' '),/not establish a special interaction/);
});

test('Anchored global ratings retain homogeneous-panel information with equal set weighting',()=>{
  const f=fixture(6),rounds=[f.round('h0',[0,1,2,3,4,5,6,7]),f.round('h1',[8,9]),f.round('h2',[10,11]),f.round('h3',[12,13,14,15]),f.round('h4',[16,17,18,19]),f.round('h5',[20,21,22,23])],answers={};
  for(const work of f.works)setStatus(f,work.id,'dramatic-light',Number(work.id.slice(1))<12?'present':'absent');
  rounds.forEach((r,i)=>answers[r.id]=f.answer(r,r.works.map(()=>[100,70,80,10,10,10][i])));
  const model=buildTastePatterns({...f,rounds,answers}),pattern=quality(model);assert.equal(pattern.status,'descriptive-association');assert.equal(pattern.summaryEligible,true);assert.equal(pattern.comparisonBasis,'across-set-anchored-overall-ratings');assert.equal(pattern.ratingAssociation.presentSetCount,3);assert.equal(pattern.ratingAssociation.absentSetCount,3);assert.ok(Math.abs(pattern.ratingAssociation.presentMean-250/3)<1e-8);assert.notEqual(pattern.ratingAssociation.presentMean,1100/12);assert.equal(pattern.withinSet.eligibleSetCount,0);assert.equal(pattern.independentReplicationClaim,undefined);assert.match(pattern.alternatives.join(' '),/No causal effect/);
  const legacy=rounds.map(r=>{const changed={...r,evidence:{construct:'preference',family:'individual-choice',role:'discovery'},scale:{left:'Less preferred',right:'More preferred'}};return changed;});const older=buildTastePatterns({...f,rounds:legacy,answers});assert.equal(quality(older,'dramatic-light','relative'),undefined);assert.equal(older.appeal.associations.length,0);
});

test('Cross-set associations retain named high-rated absences and low-rated presences as counterevidence',()=>{
  const f=fixture(4);f.answers.p3=f.answer(f.rounds[3],[5,90,10,85]);const model=buildTastePatterns(f),association=model.appeal.associations.find(item=>item.qualityKey==='dramatic-light');assert.ok(association.counter.some(item=>item.workIds.includes('w12')));assert.ok(association.counter.some(item=>item.workIds.includes('w13')));assert.equal(association.exposureBaseline.lowerRatedWithQuality,2);
});

test('Explicit favourites produce descriptive connections with rated-pool baselines, never non-selection as dislike',()=>{
  const f=fixture(3),grid={id:'favs',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,title:'Your favourites',works:f.works,evidence:{construct:'overall-favourites',explicitFavourites:true}},answer={workIds:f.works.map(w=>w.id),selectionMode:'shortlist',selectedIds:['w0','w4','w8'],explicitNone:false,unsure:false,confirmed:true};
  const model=buildTastePatterns({...f,rounds:[...f.rounds,grid],answers:{...f.answers,favs:answer}}),pattern=model.favouriteConnections.patterns.find(item=>item.qualityKey==='dramatic-light');assert.ok(pattern);assert.equal(pattern.status,'descriptive');assert.equal(pattern.summaryEligible,true);assert.equal(pattern.independentReplicationClaim,false);assert.equal(pattern.eligibleSetCount,null);assert.equal(pattern.exposureBaseline.selectedWithQuality,3);assert.equal(pattern.exposureBaseline.ratedWithQuality,6);assert.equal(pattern.exposureBaseline.ratedWithoutQuality,6);assert.equal(pattern.negativeWorkCount,0);assert.match(pattern.text,/recurs among your favourites/);
  const allPresent=structuredClone(f.annotationReviews);for(const r of Object.values(allPresent.reviews))r.attributes['dramatic-light'].status='present';const ubiquitous=buildTastePatterns({...f,annotationReviews:allPresent,rounds:[...f.rounds,grid],answers:{...f.answers,favs:answer}}).favouriteConnections.patterns.find(item=>item.qualityKey==='dramatic-light');assert.equal(ubiquitous.summaryEligible,false);
});

test('Recommendations match exact reviewed qualities and link to supporting present works, excluding recorded exposure',()=>{
  const f=fixture(4),model=buildTastePatterns({...f,rounds:f.rounds.slice(0,3),answers:{p0:f.answers.p0,p1:f.answers.p1,p2:f.answers.p2}});assert.ok(model.recommendations.length);for(const item of model.recommendations){assert.ok(['w12','w14'].includes(item.workId));assert.ok(item.sourceWorkIds.length);assert.ok(item.sourceWorkIds.every(id=>Number(id.slice(1))%2===0));assert.equal(item.matchBasis,'source-bound-reviewed-visual-qualities');assert.equal('probability' in item,false);}
  const viewed={id:'curate',kind:'exercise',exerciseKind:'curate',works:f.rounds[3].works},answer={workIds:viewed.works.map(w=>w.id),record:{presentedIds:['w12'],placements:{}}},after=buildTastePatterns({...f,rounds:[...f.rounds.slice(0,3),viewed],answers:{p0:f.answers.p0,p1:f.answers.p1,p2:f.answers.p2,curate:answer}});assert.equal(after.recommendations.some(item=>item.workId==='w12'),false);assert.equal(after.recommendations.some(item=>item.workId==='w14'),true);
});

test('Favourite readings show distinct reviewed groups, including a pair, without promoting them to overall taste',()=>{
  const f=fixture(3);
  for(const id of ['w0','w4'])setStatus(f,id,'visible-gesture','present');
  for(const id of ['w3','w7'])setStatus(f,id,'imagined-world','present');
  const grid={id:'favs',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,title:'Your favourites',works:f.works,evidence:{construct:'overall-favourites',explicitFavourites:true}};
  const selectedIds=['w0','w4','w3','w7','w9'];
  const answer={workIds:f.works.map(w=>w.id),selectionMode:'shortlist',selectedIds,explicitNone:false,unsure:false,confirmed:true};
  const patterns=buildTastePatterns({...f,rounds:[...f.rounds,grid],answers:{...f.answers,favs:answer}}).favouriteConnections.patterns;
  const summary=composeFavouriteSummary({works:f.works,favourites:selectedIds.map(workId=>({workId})),patterns});
  assert.deepEqual(summary.workIds,selectedIds);
  assert.ok(patterns.find(item=>item.qualityKey==='imagined-world'&&!item.summaryEligible));
  assert.ok(summary.threads.some(thread=>thread.qualityKey==='imagined-world'&&thread.workIds.length===2));
  assert.equal(summary.threads.filter(thread=>thread.workIds.includes('w0')&&thread.workIds.includes('w4')).length,1);
});

test('An earlier quiz excludes prior low-rated paintings from rediscovery without changing the current quality reading',()=>{
  const f=fixture(4),rounds=f.rounds.slice(0,3),answers={p0:f.answers.p0,p1:f.answers.p1,p2:f.answers.p2},before=buildTastePatterns({...f,rounds,answers});
  const recommendationHistory=[{manifest:{catalogue:f.works},shown:{old:{id:'old',kind:'spectrum',workIds:['w12']}},answers:{old:{workIds:['w12'],positions:{w12:20},confirmed:true}}}];
  const after=buildTastePatterns({...f,rounds,answers,recommendationHistory});
  assert.ok(before.recommendations.some(item=>item.workId==='w12'));
  assert.equal(after.recommendations.some(item=>item.workId==='w12'),false);
  assert.ok(after.recommendations.some(item=>item.workId==='w14'));
  assert.deepEqual(after.readingSummary,before.readingSummary);
  assert.deepEqual(after.appeal,before.appeal);
});

test('Unvisited paged favourites are neither dislikes nor known exposure; absent page evidence is conservatively unknown',()=>{
  const f=fixture(8),rounds=f.rounds.slice(0,3),answers=Object.fromEntries(rounds.map(r=>[r.id,f.answers[r.id]])),grid={id:'favs',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,title:'Your favourites',works:f.works,evidence:{construct:'overall-favourites',explicitFavourites:true,instrumentRevision:'paged-favourites-v1'}},answer={workIds:f.works.map(w=>w.id),selectionMode:'shortlist',selectedIds:['w0','w4','w8'],explicitNone:false,unsure:false,confirmed:true,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}};
  let model=buildTastePatterns({...f,rounds:[...rounds,grid],answers:{...answers,favs:answer}});assert.equal(model.recommendations.some(item=>item.workId==='w12'),false);assert.equal(model.recommendations.some(item=>item.workId==='w18'),true);
  delete answer.presentation;model=buildTastePatterns({...f,rounds:[...rounds,grid],answers:{...answers,favs:answer}});assert.equal(model.recommendations.length,0);assert.equal(model.favouriteConnections.patterns.length,0);
});
