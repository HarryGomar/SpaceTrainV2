import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root=new URL('../',import.meta.url),site=new URL('public/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const write=(url,data)=>fs.writeFileSync(url,JSON.stringify(data,null,2)+'\n');
const id='matejko-stanczyk',oldUrl='https://cyfrowe.mnw.pl/pl/zbiory/962339';
const currentUrl='https://artsandculture.google.com/asset/sta%C5%84czyk-jan-matejko/4AHFtRqeObzoRw';
const works=read(new URL('artworks.json',site)),work=works.find(work=>work.id===id);
assert.ok([oldUrl,currentUrl].includes(work.sourceUrl),'Unexpected source identity');
const original={id:work.id,title:work.title,image:work.image,features:structuredClone(work.features)};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const previewSha256=sha(fs.readFileSync(new URL(work.image,site)));
const correction={version:'source-correction-20261116-v1',workId:id,previousSourceUrl:oldUrl,sourceUrl:currentUrl,
  reason:'The previous museum URL identifies a1876 wood engraving by Jan Styfi after Matejko. Its prototype field identifies the actual1862 painting as MP433MNW. The museum-provided Google Arts & Culture object identifies the displayed colour painting as1862, oil on canvas, inventory MP433. No print date or print medium is transferred to the painting.',
  evidenceUrls:[oldUrl,currentUrl],imageUnchanged:work.image,previewSha256,dateUnchanged:work.date,
  scope:'Current catalogue and current review/media bindings only. Previously saved participant manifests and exports are not rewritten.'};
correction.reason=correction.reason.replace(/a1876/g,'a 1876').replace(/actual1862/g,'actual 1862').replace(/as1862/g,'as 1862');
const attributes=read(new URL('artwork-attribute-reviews.json',site)),literal=read(new URL('literal-descriptor-reviews.json',site));
const contexts=read(new URL('artwork-context-reviews.json',site)),media=read(new URL('study-image-sources.json',site));
const bindings=read(new URL('tools/literal-review-source-bindings-20261116.json',root));
const priorKey=JSON.stringify([oldUrl,work.image]),currentKey=JSON.stringify([currentUrl,work.image]);
function bind(record){
  assert.ok(record&&[oldUrl,currentUrl].includes(record.sourceIdentity.sourceUrl),id+' missing source binding');
  assert.equal(record.sourceIdentity.image,work.image);assert.equal(record.sourceIdentity.previewSha256,previewSha256);
  record.sourceIdentity.sourceUrl=currentUrl;
  if(record.sourceUrls)record.sourceUrls=[...new Set([...record.sourceUrls,currentUrl])];
  record.sourceIdentityCorrection=correction;
}
function moveReference(map){
  const reference=map[priorKey]||map[currentKey];assert.ok(reference);
  assert.equal(reference.previewSha256,previewSha256);delete map[priorKey];
  map[currentKey]={...reference,sourceUrl:currentUrl,sourceIdentityCorrection:correction};
}
bind(attributes.reviews[id]);moveReference(attributes.currentAssetReferences);
bind(literal.reviews[id]);moveReference(literal.currentAssetReferences);
bind(bindings.entries[id]);
if(contexts.records[id])bind(contexts.records[id]);
work.sourceUrl=currentUrl;work.provenance.institutionRecordUrl=currentUrl;work.provenance.sourceIdentityCorrection=correction;
work.featureLiteralReview.sourceIdentity.sourceUrl=currentUrl;
if(work.analysis?.curatorialFacets?.sourceUrls)work.analysis.curatorialFacets.sourceUrls=[...new Set([...work.analysis.curatorialFacets.sourceUrls,currentUrl])];
const large=media.entries[id];assert.equal(large.sourceIdentity.image,work.image);
assert.ok([oldUrl,currentUrl].includes(large.sourceIdentity.sourceUrl));
large.sourceIdentity.sourceUrl=currentUrl;large.provenance.institutionRecordUrl=currentUrl;
large.provenance.institutionIdentity.institutionRecordUrl=currentUrl;large.provenance.sourceIdentityCorrection=correction;
assert.deepEqual({id:work.id,title:work.title,image:work.image,features:work.features},original);
write(new URL('artworks.json',site),works);write(new URL('artwork-attribute-reviews.json',site),attributes);
write(new URL('literal-descriptor-reviews.json',site),literal);write(new URL('study-image-sources.json',site),media);
write(new URL('tools/literal-review-source-bindings-20261116.json',root),bindings);
if(contexts.records[id])write(new URL('artwork-context-reviews.json',site),contexts);
write(new URL('tools/art-atlas-source-corrections-20261116.json',root),{version:'source-corrections-20261116-v1',corrections:[correction]});
console.log(JSON.stringify({workId:id,currentSource:currentUrl,previewSha256,imageBytesChanged:false,participantExportsChanged:false}));
