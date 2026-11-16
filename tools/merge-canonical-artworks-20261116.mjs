import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../public/art-atlas/artwork-attribute-definitions.mjs';
import {journeyCurationNotes} from '../public/art-atlas/journey-bank.mjs';

const root=new URL('../',import.meta.url),site=new URL('public/art-atlas/',root),staging=new URL('artifacts/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const save=(url,data)=>fs.writeFileSync(url,JSON.stringify(data,null,2)+'\n');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const candidate=read(new URL('canonical-expansion-candidates-20261116.json',staging));
const addedAttributes=read(new URL('canonical-expansion-reviews-20261116.json',staging));
const addedContexts=read(new URL('canonical-expansion-contexts-20261116.json',staging));
const addedLiteral=read(new URL('canonical-expansion-literal-20261116.json',staging));
const catalogue=read(new URL('artworks.json',site));
const attributes=read(new URL('artwork-attribute-reviews.json',site));
const contexts=read(new URL('artwork-context-reviews.json',site));
const literal=read(new URL('literal-descriptor-reviews.json',site));
const originalCatalogue=structuredClone(catalogue);
const ids=candidate.works.map(work=>work.id);
assert.equal(ids.length,24);assert.equal(new Set(ids).size,24);
for(const map of [addedAttributes.reviews,addedContexts.records,addedLiteral.reviews])assert.deepEqual(Object.keys(map).sort(),[...ids].sort());
const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort();
const byId=new Map(catalogue.map(work=>[work.id,work]));
const existing=catalogue.filter(work=>!ids.includes(work.id));
const existingHashes=new Set(existing.map(work=>hash(fs.readFileSync(new URL(work.image,site)))));
const existingSources=new Set(existing.map(work=>work.sourceUrl));
const newHashes=new Set();
function appendMap(target,added,label){
  for(const [id,value] of Object.entries(added)){
    if(Object.hasOwn(target,id))assert.deepEqual(target[id],value,label+' collision '+id);
    else target[id]=value;
  }
}
for(const work of candidate.works){
  assert.match(work.id,/^canon-[a-z0-9-]+$/);
  assert.ok(!existingSources.has(work.sourceUrl),work.id+' duplicate source');
  assert.match(work.sourceUrl,/^https:\/\//);assert.match(work.rightsUrl,/^https:\/\//);
  assert.ok(work.creditLine?.length>20&&work.rights?.length>2,work.id+' rights');
  const preview=fs.readFileSync(new URL(work.image,site)),large=fs.readFileSync(new URL(work.imageLarge,site));
  assert.equal(imageDimensions(preview).mime,'image/jpeg');assert.equal(imageDimensions(large).mime,'image/jpeg');
  assert.equal(hash(preview),work.sha256);assert.equal(hash(large),work.provenance.largeSha256);
  assert.ok(!existingHashes.has(work.sha256)&&!newHashes.has(work.sha256),work.id+' repeated bytes');newHashes.add(work.sha256);
  for(const [bytes,width,height] of [[preview,work.width,work.height],[large,work.largeWidth,work.largeHeight]]){
    const actual=imageDimensions(bytes);assert.equal(actual.width,width);assert.equal(actual.height,height);assert.equal(actual.mime,'image/jpeg');
  }
  assert.ok(Math.max(work.largeWidth,work.largeHeight)<=3200);
  assert.ok(work.largeWidth<=work.provenance.downloadedWidth&&work.largeHeight<=work.provenance.downloadedHeight);
  const identity={sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256};
  for(const record of [addedAttributes.reviews[work.id],addedContexts.records[work.id],addedLiteral.reviews[work.id]])assert.deepEqual(record.sourceIdentity,identity);
  const review=addedAttributes.reviews[work.id];
  assert.equal(review.reviewed,true);assert.deepEqual(Object.keys(review.attributes).sort(),keys);
  for(const value of Object.values(review.attributes)){assert.ok(['present','absent','unknown'].includes(value.status));assert.ok(value.reason?.length>20);}
  assert.deepEqual(addedLiteral.reviews[work.id].after,work.features);
  assert.deepEqual(work.featureLiteralReview.sourceIdentity,identity);
  assert.equal(work.featureSemanticVersion,'literal-action-setting-v2');
  if(byId.has(work.id))assert.deepEqual(byId.get(work.id),work,'Existing canonical record differs: '+work.id);
  else catalogue.push(work);
}
appendMap(attributes.reviews,addedAttributes.reviews,'Attribute');
appendMap(attributes.currentAssetReferences,addedAttributes.currentAssetReferences,'Current asset');
appendMap(contexts.records,addedContexts.records,'Context');
appendMap(literal.reviews,addedLiteral.reviews,'Literal');
appendMap(literal.currentAssetReferences,addedAttributes.currentAssetReferences,'Literal asset');
attributes.reviewedCount=Object.keys(attributes.reviews).length;contexts.reviewedCount=Object.keys(contexts.records).length;
literal.reviewSets.canonical=[...ids];
literal.summary.reviewed=Object.keys(literal.reviews).length;
literal.summary.canonicalAdded=ids.length;
literal.summary.reconsideredExistingRecords=258;
literal.summary.existingRecordDeltaScope='changedRecords and unchangedRecords describe the original 258 reconsidered records. The 24 newly added records have no prior catalogue values.';
const first=[...new Set(journeyCurationNotes(catalogue).proposedFirst18Panels.flatMap(panel=>panel.workIds))];
literal.summary.first72={count:first.length,reviewed:first.filter(id=>literal.reviews[id]).length,missing:first.filter(id=>!literal.reviews[id])};
assert.equal(new Set([...Object.keys(literal.reviews),...Object.keys(literal.withheld),...Object.keys(literal.excluded)]).size,catalogue.length);
for(const work of originalCatalogue)assert.deepEqual(catalogue.find(candidate=>candidate.id===work.id),work,'Original record was altered: '+work.id);
const publicText=JSON.stringify({candidate,addedAttributes,addedContexts,addedLiteral});
assert.ok(!/notion\.so|notion\.site|notionSource|favouriteFlag|favoriteFlag/.test(publicText),'Private source markers');
const manifest={version:'canonical-collection-20261116-v1',scope:'Public source inventory for 24 canonical additions. These are editorial stimulus priorities, not visitor preferences.',workIds:ids,westernClassics:17,mexicanContext:7,sourceLimitedIds:candidate.works.filter(work=>work.provenance.sourceLimited).map(work=>work.id),unimportedIds:['canon-varo-embroidering-mantle','canon-varo-celestial-pabulum','canon-kahlo-broken-column']};
save(new URL('tools/art-atlas-canonical-manifest-20261116.json',root),manifest);
save(new URL('artworks.json',site),catalogue);
save(new URL('artwork-attribute-reviews.json',site),attributes);
save(new URL('artwork-context-reviews.json',site),contexts);
save(new URL('literal-descriptor-reviews.json',site),literal);
console.log(JSON.stringify({catalogue:catalogue.length,attributeReviews:attributes.reviewedCount,contextRecords:contexts.reviewedCount,literalReviewed:literal.summary.reviewed,pending:Object.keys(literal.withheld).length,galleryOnly:Object.keys(literal.excluded).length,originalRecordsUnchanged:originalCatalogue.length,first72:literal.summary.first72},null,2));
