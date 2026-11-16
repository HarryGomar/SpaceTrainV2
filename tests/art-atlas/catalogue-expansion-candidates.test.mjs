import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {isReviewedVisualDescriptor,FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';

const site=new URL('../../public/art-atlas/',import.meta.url);
const current=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const manifest=JSON.parse(fs.readFileSync(new URL('../../tools/art-atlas-expansion-manifest-20261115.json',import.meta.url),'utf8')).collection;
const data={...manifest,works:manifest.workIds.map(id=>current.find(work=>work.id===id))};
const allReviews=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const reviews={reviewedCount:manifest.count,reviews:Object.fromEntries(manifest.workIds.map(id=>[id,allReviews.reviews[id]]))};
const opening=JSON.parse(fs.readFileSync(new URL('opening-artworks.json',site),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const norm=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const identity=w=>norm(w.title)+'|'+norm(w.artist);
const key=url=>url.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');

test('The staged collection has280 reviewed candidates,20 documented exclusions and no pending implied eligibility',()=>{
  assert.equal(data.count,280);assert.equal(data.works.length,280);assert.equal(reviews.reviewedCount,280);assert.equal(data.pendingReviewCount,0);assert.equal(data.excludedCandidates.length,20);
  for(const excluded of data.excludedCandidates){assert.ok(excluded.reason.length>30);assert.ok(!data.works.some(w=>w.id===excluded.id));assert.equal(reviews.reviews[excluded.id],undefined);}
});

test('Canonical study identities remain unique; opening promotions reuse their original source and preview',()=>{
  const candidateIds=new Set(data.works.map(w=>w.id));assert.equal(new Set(current.map(w=>w.id)).size,current.length);
  // The same staged identity may already have been integrated. It must still be
  // the captured painting, not another copy with a new source or preview.
  for(const w of data.works){const integrated=current.find(old=>old.id===w.id);if(integrated){assert.equal(integrated.sourceUrl,w.sourceUrl);assert.equal(integrated.sha256,w.sha256);assert.equal(integrated.title,w.title);assert.equal(integrated.artist,w.artist);}}
  const original164=current.slice(0,164);assert.equal(original164.length,164);assert.ok(original164.every(w=>!candidateIds.has(w.id)),'Append-only original164 baseline');
  const baseline=current.filter(w=>!candidateIds.has(w.id)),urls=new Set(baseline.map(w=>key(w.sourceUrl))),ids=new Set(baseline.map(w=>w.id)),identities=new Set(baseline.map(identity));
  const byId=new Map(opening.map(w=>[w.id,w]));let promotions=0;
  for(const w of data.works){assert.ok(!ids.has(w.id),w.id);assert.ok(!urls.has(key(w.sourceUrl)),w.id);assert.ok(!identities.has(identity(w)),w.id);ids.add(w.id);urls.add(key(w.sourceUrl));identities.add(identity(w));
    if(w.provenance.promotedFromOpening){promotions++;const old=byId.get(w.id);assert.ok(old);assert.equal(w.image,old.image);assert.equal(w.sourceUrl,old.sourceUrl);assert.equal(w.sha256,old.sha256);}
  }
  assert.equal(promotions,235);assert.equal(data.works.filter(w=>!w.provenance.promotedFromOpening).length,45);
});

test('Every preview and large rendition is real, dimensionally correct, hash-bound and at most3200 pixels',()=>{
  const previewHashes=new Set(),largeHashes=new Set();
  for(const w of data.works){
    const preview=fs.readFileSync(new URL(w.image,site)),large=fs.readFileSync(new URL(w.imageLarge,site));
    assert.equal(hash(preview),w.sha256,w.id);assert.equal(hash(large),w.provenance.largeSha256,w.id);assert.equal(preview.length,w.bytes);assert.equal(large.length,w.provenance.largeBytes);
    const small=imageDimensions(preview),big=imageDimensions(large);assert.deepEqual([small.width,small.height],[w.width,w.height],w.id);assert.deepEqual([big.width,big.height],[w.largeWidth,w.largeHeight],w.id);assert.equal(small.mime,'image/jpeg');assert.equal(big.mime,'image/jpeg');
    assert.ok(Math.max(w.largeWidth,w.largeHeight)<=3200);assert.ok(Math.max(w.largeWidth,w.largeHeight)>=Math.max(w.width,w.height));assert.ok(Math.min(w.largeWidth,w.largeHeight)>=350);
    assert.ok(!previewHashes.has(w.sha256),'Duplicate preview '+w.id);assert.ok(!largeHashes.has(w.provenance.largeSha256),'Duplicate large image '+w.id);previewHashes.add(w.sha256);largeHashes.add(w.provenance.largeSha256);
  }
});

test('Five provisional descriptors, separately reviewed or pending literal fields, and all sixteen source-bound criteria retain their actual review scope',()=>{
  const attrs=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS),features=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];let unknown=0,present=0;
  for(const w of data.works){assert.equal(w.studyEligible,true);assert.ok([FEATURE_SEMANTIC_VERSION,'pending-literal-action-setting-review'].includes(w.featureSemanticVersion));assert.match(w.featureSource,/visual review/);for(const feature of features){const literal=['narrative','atmosphere'].includes(feature),known=!literal||w.featureSemanticVersion===FEATURE_SEMANTIC_VERSION&&w.featureLiteralReview.fields[feature].status==='reviewed';assert.equal(isReviewedVisualDescriptor(w,feature),known,w.id+' '+feature);if(known)assert.ok(Number.isInteger(w.features[feature]*4));else if(w.featureSemanticVersion===FEATURE_SEMANTIC_VERSION)assert.equal(w.features[feature],null);else assert.ok(Number.isFinite(w.features[feature]),'A pending record retains its raw draft without certifying it.');}
    const review=reviews.reviews[w.id];assert.equal(review.reviewed,true);assert.equal(review.reviewerType,'assistant-visual-review');assert.equal(review.sourceIdentity.image,w.image);assert.equal(review.sourceIdentity.previewSha256,w.sha256);assert.equal(review.sourceIdentity.sourceUrl,w.sourceUrl);assert.deepEqual(Object.keys(review.attributes).sort(),attrs.sort());assert.equal(review.reviewedAsset.image,w.image);assert.equal(review.reviewedAsset.sha256,w.sha256);assert.ok(review.contactNumber>0);
    for(const a of Object.values(review.attributes)){assert.ok(['present','absent','unknown'].includes(a.status));assert.ok(a.reason.length>20);assert.equal(a.evidenceKind,'visual-review');if(a.status==='unknown')unknown++;if(a.status==='present')present++;}
    assert.deepEqual(review.sourcedContext,[]);assert.equal(review.contextStatus,'not-documented-in-this-review');assert.equal(w.note,'');
  }
  assert.ok(unknown>200,'Fine uncertainty must be represented');assert.ok(present>900,'Review must contain concrete visual content, not only unknowns');
});

test('Rights use the exact source image permissions; NGA image policy is never relabelled datasetCC0',()=>{
  let nga=0,cma=0;
  for(const w of data.works){assert.match(w.sourceUrl,/^https:\/\//);assert.match(w.rightsUrl,/^https:\/\//);const p=w.provenance;
    if(p.provider==='National Gallery of Art Open Data'){nga++;assert.equal(p.openaccess,1);assert.equal(p.publishedImage.openaccess,'1');assert.equal(p.publishedImage.viewtype,'primary');assert.equal(String(w.sourceId),p.publishedImage.depictstmsobjectid);assert.notEqual(w.rights,'CC0');assert.match(p.sourceRightsStatement,/dataset CC0 license is separate/);assert.match(p.imageMetadataUrl,/NationalGalleryOfArt/);const urls=reviews.reviews[w.id].sourceUrls;assert.ok(urls.includes(w.sourceUrl));assert.ok(urls.some(url=>/NationalGalleryOfArt/.test(url)));assert.ok(urls.every(url=>!url.includes('openaccess-api.clevelandart.org')));}
    else{cma++;assert.equal(p.share_license_status,'CC0');assert.equal(w.rights,'CC0');assert.match(p.recordUrl,/openaccess-api.clevelandart.org\/api\/artworks\/\d+$/);}
  }
  assert.equal(nga,30);assert.equal(cma,250);
});

test('Dates, palette and curation hints remain descriptive; later traditions are not early padding or invented creation places',()=>{
  let later=0,unknownCountries=0;
  for(const w of data.works){assert.equal(w.movement,'Unknown');assert.equal(w.analysis.movementKey,null);assert.match(w.movementSource,/Unknown/);assert.match(w.countrySource,/not a verified place of execution/);
    const years=w.analysis.yearRange;assert.ok(years===null||years.length===2&&years.every(Number.isFinite)&&years[0]<=years[1]);const palette=w.analysis.palette;assert.equal(palette.histogram.length,40);assert.ok(Math.abs(palette.histogram.reduce((a,b)=>a+b,0)-1)<.00003);assert.ok(palette.histogram.every(v=>v>=0&&v<=1));
    assert.equal(w.curationHints.version,'collection-expansion-curation-v1');if(w.curationHints.role==='later-tradition-depth'){later++;assert.equal(w.curationHints.reserveUntilBatch,3);}if(w.country==='Unknown')unknownCountries++;
  }
  assert.ok(later>100);assert.equal(unknownCountries,30);assert.match(data.curationScope,/zero-based/);
});
