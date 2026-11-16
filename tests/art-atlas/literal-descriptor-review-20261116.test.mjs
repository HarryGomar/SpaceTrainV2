import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {buildLiteralDescriptorPackage,literalObservations,STRICT_LITERAL_VERSION,PENDING_LITERAL_VERSION,FEATURE_KEYS,LITERAL_KEYS} from '../../tools/build-literal-descriptor-review-20261116.mjs';

const root=new URL('../../',import.meta.url),site=new URL('public/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const works=read(new URL('artworks.json',site)),byId=new Map(works.map(work=>[work.id,work]));
const inventory=read(new URL('tools/art-atlas-expansion-manifest-20261115.json',root));
const bindings=read(new URL('tools/literal-review-source-bindings-20261116.json',root)).entries;
const publicLedger=read(new URL('literal-descriptor-reviews.json',site));
const {observations,sets}=literalObservations();
const reviewedIds=Object.keys(observations),pendingIds=inventory.collection.workIds.filter(id=>!observations[id]);
const galleryIds=inventory.required.workIds.filter(id=>!observations[id]);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Public review inventory partitions258 reviewed,202 pending and3 gallery-only without private staging files',()=>{
  assert.deepEqual(Object.values(sets).map(ids=>ids.length),[164,16,78]);
  assert.equal(reviewedIds.length,258);assert.equal(pendingIds.length,202);assert.equal(galleryIds.length,3);
  assert.equal(new Set([...reviewedIds,...pendingIds,...galleryIds]).size,463);
  assert.deepEqual([...reviewedIds,...pendingIds,...galleryIds].sort(),works.map(work=>work.id).sort());
  assert.deepEqual(Object.keys(bindings).sort(),reviewedIds.sort());
  assert.equal(Object.keys(publicLedger.reviews).length,258);assert.equal(Object.keys(publicLedger.withheld).length,202);assert.equal(Object.keys(publicLedger.excluded).length,3);
  for(const id of galleryIds){assert.equal(byId.get(id).studyEligible,false,id);assert.deepEqual(byId.get(id).features,{},id);}
});

test('Every strict review has the actual source, preview SHA and inspected reproduction SHA and dimensions',()=>{
  for(const id of reviewedIds){
    const work=byId.get(id),binding=bindings[id],preview=fs.readFileSync(new URL(work.image,site));
    assert.deepEqual(binding.sourceIdentity,{sourceUrl:work.sourceUrl,image:work.image,previewSha256:sha(preview)},id);
    const published=publicLedger.reviews[id];
    assert.deepEqual(published.sourceIdentity,binding.sourceIdentity,id+' published source');
    assert.deepEqual(published.before,binding.before,id+' published raw prior');
    assert.equal(published.reviewedAsset.image,binding.reviewedAsset.image,id+' published review asset');
    assert.equal(published.reviewedAsset.sha256,binding.reviewedAsset.sha256,id+' published review hash');
    const asset=binding.reviewedAsset,bytes=fs.readFileSync(new URL(asset.image,site)),dimensions=imageDimensions(bytes);
    assert.equal(sha(bytes),asset.sha256,id);assert.equal(dimensions.width,asset.width,id);assert.equal(dimensions.height,asset.height,id);
    assert.equal(asset.compositionMatch,'same-composition');
    assert.ok(observations[id][2].length>30,id+' visible reason');
    assert.equal(Object.keys(binding.before).length,7,id+' raw prior values');
    for(const [i,key] of LITERAL_KEYS.entries()){assert.equal(published.after[key],observations[id][i],id+' published '+key);assert.equal(published.fields[key].status,observations[id][i]===null?'unknown':'reviewed');}
  }
});

test('Reproducible strict package retains all five other drafts and keeps unresolved values explicitly unknown',()=>{
  const output=buildLiteralDescriptorPackage({works,reviewedAt:'2026-11-16T00:00:00.000Z'});
  assert.equal(output.summary.reviewed,258);assert.equal(output.summary.bulkPending,202);assert.equal(output.summary.galleryOnly,3);
  assert.equal(output.summary.first72.reviewed,72);assert.deepEqual(output.summary.first72.missing,[]);
  assert.equal(output.summary.unchangedRecords,47);assert.equal(output.summary.changedRecords,211);
  assert.equal(output.summary.unknownFields.length,17);
  for(const [id,r] of Object.entries(output.reviews)){
    assert.equal(r.version,STRICT_LITERAL_VERSION);assert.equal(r.reviewed,true);
    for(const key of FEATURE_KEYS.filter(key=>!LITERAL_KEYS.includes(key)))assert.equal(r.after[key],r.before[key],id+' '+key);
    for(const key of LITERAL_KEYS){assert.equal(r.fields[key].status,r.after[key]===null?'unknown':'reviewed');assert.equal(r.fields[key].value,r.after[key]);}
  }
  assert.equal(output.reviews['turner-burning-parliament'].after.narrative,null);
  assert.equal(output.reviews['extended-nga-52624'].after.narrative,null);
  assert.equal(output.reviews['add-kandinsky-rowing'].after.atmosphere,null);
  assert.equal(output.withheld['opening-cma-113202'].proposedFeatureSemanticVersion,PENDING_LITERAL_VERSION);
});

test('A changed source identity or declared thumbnail hash cannot silently inherit the manual review',()=>{
  const changedSource=structuredClone(works),changedHash=structuredClone(works);
  changedSource.find(work=>work.id==='goya-saturn').sourceUrl='https://example.com/different-reproduction';
  changedHash.find(work=>work.id==='goya-saturn').sha256='0'.repeat(64);
  assert.throws(()=>buildLiteralDescriptorPackage({works:changedSource}),/Reviewed source identity changed/);
  assert.throws(()=>buildLiteralDescriptorPackage({works:changedHash}),/Declared preview hash mismatch/);
});

test('Literal audit separates still bodies, physical exertion, environmental movement and flat backgrounds',()=>{
  const get=id=>observations[id].slice(0,2);
  assert.deepEqual(get('study-david-marat'),[0,0.25]);
  assert.deepEqual(get('study-wood-american-gothic'),[0,0.5]);
  assert.deepEqual(get('study-hokusai-great-wave'),[0.25,1]);
  assert.deepEqual(get('add-atl-climatic-eruption'),[0,1]);
  assert.deepEqual(get('extended-nga-52397'),[0.5,0]);
  assert.deepEqual(get('req-orozco-man-fire'),[0.75,0]);
  assert.deepEqual(get('study-gentileschi-judith'),[1,0.25]);
  assert.deepEqual(get('add-pollock-convergence'),[0,0]);
});

test('Current public catalogue uses v2 only for strict reviews and excludes pending or unknown literal fields',()=>{
  for(const id of reviewedIds){
    const work=byId.get(id),binding=bindings[id],values=observations[id];
    assert.equal(work.featureSemanticVersion,STRICT_LITERAL_VERSION,id);
    for(const [i,key] of LITERAL_KEYS.entries())assert.equal(work.features[key],values[i],id+' '+key);
    for(const key of FEATURE_KEYS.filter(key=>!LITERAL_KEYS.includes(key)))assert.equal(work.features[key],binding.before[key],id+' retained '+key);
    const review=work.featureLiteralReview;
    assert.equal(review?.reviewed,true,id+' review marker');
    assert.deepEqual(review.sourceIdentity,binding.sourceIdentity,id+' review identity');
    for(const [i,key] of LITERAL_KEYS.entries())assert.equal(review.fields[key].status,values[i]===null?'unknown':'reviewed',id+' '+key+' status');
  }
  for(const id of pendingIds){assert.equal(byId.get(id).featureSemanticVersion,PENDING_LITERAL_VERSION,id);assert.equal(byId.get(id).featureLiteralReview?.reviewed,false,id);}
});
