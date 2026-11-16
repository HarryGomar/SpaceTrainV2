import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {resolveArtworkMedia} from '../../public/art-atlas/artwork-media.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {isReviewedVisualDescriptor} from '../../public/art-atlas/visual-descriptor-semantics.mjs';

const root=new URL('../../',import.meta.url),site=new URL('public/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const works=read(new URL('artworks.json',site)),byId=new Map(works.map(work=>[work.id,work]));
const manifest=read(new URL('tools/art-atlas-canonical-manifest-20261116.json',root));
const observations=read(new URL('tools/canonical-artwork-observations-20261116.json',root));
const attributes=read(new URL('artwork-attribute-reviews.json',site));
const contexts=read(new URL('artwork-context-reviews.json',site));
const literal=read(new URL('literal-descriptor-reviews.json',site));
const additions=manifest.workIds.map(id=>byId.get(id));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const featureKeys=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];

test('The approved24 additions are public-data fixtures with17 Western classics and7 Mexican-context works',()=>{
  assert.equal(manifest.workIds.length,24);assert.equal(new Set(manifest.workIds).size,24);
  assert.equal(manifest.westernClassics,17);assert.equal(manifest.mexicanContext,7);
  assert.deepEqual(Object.keys(observations).sort(),[...manifest.workIds].sort());
  assert.equal(additions.filter(work=>work.country==='Mexico').length,7);
  assert.ok(additions.every(work=>work?.id&&work.eligibleForStudy&&work.studyEligible));
  assert.equal(additions.filter(work=>work.artist==='Caravaggio').length,4);
  for(const id of manifest.unimportedIds)assert.ok(!byId.has(id),id+' has no placeholder');
});

test('All48 derivative files are measured local JPEGs, source hashed, distinct and never upscaled',()=>{
  const hashes=new Set(),otherHashes=new Set(works.filter(work=>!manifest.workIds.includes(work.id)).map(work=>sha(fs.readFileSync(new URL(work.image,site)))));
  for(const work of additions){
    const preview=fs.readFileSync(new URL(work.image,site)),large=fs.readFileSync(new URL(work.imageLarge,site));
    for(const [bytes,width,height,expected] of [[preview,work.width,work.height,work.sha256],[large,work.largeWidth,work.largeHeight,work.provenance.largeSha256]]){
      const actual=imageDimensions(bytes);assert.equal(actual.mime,'image/jpeg',work.id);
      assert.equal(actual.width,width);assert.equal(actual.height,height);assert.equal(sha(bytes),expected);
      assert.ok(!hashes.has(expected)&&!otherHashes.has(expected),work.id+' duplicate');hashes.add(expected);
    }
    assert.equal(work.provenance.thumbnailSha256,work.sha256);
    assert.equal(preview.length,work.bytes);assert.equal(large.length,work.provenance.largeBytes);
    assert.ok(Math.max(work.width,work.height)<=800);assert.ok(Math.max(work.largeWidth,work.largeHeight)<=3200);
    assert.ok(work.largeWidth<=work.provenance.downloadedWidth&&work.largeHeight<=work.provenance.downloadedHeight);
    assert.match(work.provenance.sourceImageSha256,/^[a-f0-9]{64}$/);
    assert.match(work.provenance.downloadUrl,/^https:\/\//);
    assert.equal(resolveArtworkMedia(work,{preferLarge:true}).src,work.imageLarge);
  }
  assert.equal(hashes.size,48);
});

test('Seventeen PD or CC0 reproductions retain rights evidence while7 modern artworks never acquire an open artwork licence',()=>{
  assert.equal(additions.filter(work=>work.rights==='Public domain').length,14);
  assert.equal(additions.filter(work=>work.rights==='CC0').length,3);
  const modern=additions.filter(work=>!['CC0','Public domain'].includes(work.rights));assert.equal(modern.length,7);
  for(const work of additions){
    assert.match(work.sourceUrl,/^https:\/\//);assert.match(work.rightsUrl,/^https:\/\//);
    assert.ok(work.creditLine.length>30&&work.provenance.licenseMetadata);
  }
  for(const work of modern){assert.match(work.rights,/no open reuse licen[cs]e established/i);assert.ok(work.copyrightNotice.length>20);}
  const dualidad=byId.get('canon-tamayo-dualidad');assert.match(dualidad.rights,/Photograph: CC BY 2.0/);assert.match(dualidad.rights,/Underlying artwork/);
  assert.equal(byId.get('canon-durer-melencolia').provenance.licenseMetadata.objectID,336228);
  assert.equal(byId.get('canon-durer-melencolia').provenance.licenseMetadata.accessionNumber,'43.106.1');
});

test('All16 tri-state criteria and current contexts bind the exact inspected preview and large reproduction',()=>{
  const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort();
  for(const work of additions){
    const identity={sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256};
    const review=attributes.reviews[work.id];
    assert.equal(review.reviewed,true);assert.equal(review.reviewerType,'assistant-visual-review');
    assert.deepEqual(review.sourceIdentity,identity);assert.deepEqual(contexts.records[work.id].sourceIdentity,identity);
    assert.equal(review.reviewedAsset.image,work.imageLarge);assert.equal(review.reviewedAsset.sha256,work.provenance.largeSha256);
    assert.deepEqual(Object.keys(review.attributes).sort(),keys);
    for(const value of Object.values(review.attributes)){assert.ok(['present','absent','unknown'].includes(value.status));assert.ok(value.reason.length>20);assert.equal(value.evidenceKind,'visual-review');}
    assert.ok(review.sourceUrls.includes(work.sourceUrl));
    for(const context of review.sourcedContext){assert.ok(context.sourceLocator&&context.sourcePublisher);assert.ok(review.sourceUrls.includes(context.sourceUrl));}
    for(const field of ['creationPlace','depictedPlace','artistNationality','artistBirthCountry'])assert.equal(contexts.records[work.id].facts[field].status,'unknown',work.id+' no inferred '+field);
    assert.equal(contexts.records[work.id].facts.medium.status,'documented');
  }
});

test('The new literal-v2 scores have exact source bindings and separate restrained action from violence and photographed architecture',()=>{
  for(const work of additions){
    assert.deepEqual(Object.keys(work.features).sort(),[...featureKeys].sort());
    assert.deepEqual(featureKeys.map(key=>work.features[key]),observations[work.id].features);
    assert.equal(work.featureSemanticVersion,'literal-action-setting-v2');
    const review=literal.reviews[work.id];assert.deepEqual(review.after,work.features);assert.deepEqual(review.sourceIdentity,work.featureLiteralReview.sourceIdentity);
    for(const key of ['narrative','atmosphere']){assert.equal(review.fields[key].status,'reviewed');assert.equal(review.fields[key].value,work.features[key]);assert.equal(isReviewedVisualDescriptor(work,key),true);}
  }
  assert.equal(byId.get('canon-holbein-dead-christ').features.narrative,0);
  assert.equal(byId.get('canon-ingres-odalisque').features.narrative,0);
  assert.equal(byId.get('canon-caravaggio-medusa').features.atmosphere,0);
  assert.equal(byId.get('canon-tamayo-dualidad').features.atmosphere,0);
  assert.equal(byId.get('canon-tamayo-dualidad').features.humanity,0);
  assert.ok(byId.get('canon-delacroix-sardanapalus').features.narrative>=.75);
});

test('Important versions, support and reproduction limits stay explicit rather than being substituted silently',()=>{
  assert.match(byId.get('canon-bosch-temptations-lisbon').title,/triptych/);assert.match(byId.get('canon-bosch-temptations-lisbon').sourceUrl,/247559/);
  assert.match(byId.get('canon-bruegel-tower-babel').title,/Vienna/);
  assert.match(byId.get('canon-bocklin-isle-dead').title,/first Basel/);
  assert.equal(byId.get('canon-bocklin-isle-dead').date,'1880');
  assert.equal(byId.get('canon-holbein-dead-christ').medium,'Mixed technique on limewood panel');
  const adam=byId.get('canon-michelangelo-creation-adam');assert.equal(adam.compositionScope,'central-scene-crop');assert.match(adam.viewScope,/not the complete Sistine ceiling/);
  assert.deepEqual(byId.get('canon-varo-escape').analysis.dateAlternatives,[[1961,1961],[1961,1962]]);
  assert.deepEqual(additions.filter(work=>work.provenance.sourceLimited).map(work=>work.id),manifest.sourceLimitedIds);
  assert.deepEqual(manifest.sourceLimitedIds.map(id=>[byId.get(id).largeWidth,byId.get(id).largeHeight]),[[1568,1316],[1196,1200],[1568,1931]]);
  for(const id of manifest.sourceLimitedIds)assert.equal(resolveArtworkMedia(byId.get(id),{preferLarge:true}).sourceLimited,true);
});
