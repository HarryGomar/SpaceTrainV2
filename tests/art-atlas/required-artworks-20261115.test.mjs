import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
const root=new URL('../../',import.meta.url),site=new URL('public/art-atlas/',root);
const manifest=JSON.parse(fs.readFileSync(new URL('tools/art-atlas-expansion-manifest-20261115.json',root),'utf8'));
const attributes=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const current=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const currentById=new Map(current.map(w=>[w.id,w]));
const works=manifest.required.workIds.map(id=>currentById.get(id));
assert.ok(works.every(Boolean),'All required manifest IDs must be integrated in the public catalogue');
const byId=new Map(works.map(w=>[w.id,w]));
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const partial=['req-rivera-history-mexico','req-siqueiros-bourgeoisie','req-siqueiros-march-humanity-section'];

test('Nineteen source-identified candidates preserve seven PD reproductions and separate modern work rights',()=>{
  assert.equal(works.length,19);assert.equal(byId.size,19);assert.equal(works.filter(w=>w.rights==='Public domain').length,7);
  assert.equal(works.filter(w=>w.studyEligible).length,16);
  for(const w of works){
    assert.match(w.sourceUrl,/^https:\/\//);assert.match(w.rightsUrl,/^https:\/\//);assert.equal(w.curationRole,'required-anchor');
    assert.equal(w.provenance.institutionRecordUrl,w.sourceUrl);assert.ok(w.sourceId);assert.ok(w.alt);assert.ok(w.note);assert.ok(!w.notionSource);
    if(w.rights==='Public domain'){assert.equal(w.provenance.licenseMetadata.LicenseShortName,'Public domain');assert.equal(w.provenance.licenseMetadata.Copyrighted,'False');}
    else{assert.match(w.rights,/no open reuse license established/i);assert.equal(w.provenance.reuseStatus,'permission-not-established-for-underlying-work');}
  }
  assert.equal(JSON.stringify(works).includes('notion.so'),false);assert.equal(JSON.stringify(works.map(w=>attributes.reviews[w.id])).includes('notion.so'),false);
});

test('Every preview and large reproduction is a real measured JPEG with exact final SHA and no upscaling',()=>{
  const hashes=new Set();
  for(const w of works){
    for(const [path,width,height,digest] of [[w.image,w.width,w.height,w.sha256],[w.imageLarge,w.largeWidth,w.largeHeight,w.provenance.largeSha256]]){
      assert.match(path,/^assets\/required-20261115\/req-[a-z0-9-]+(?:-large)?\.jpg$/);const bytes=fs.readFileSync(new URL(path,site));
      assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length>10000);const measured=imageDimensions(bytes);assert.equal(measured.width,width);assert.equal(measured.height,height);assert.equal(measured.mime,'image/jpeg');assert.equal(sha(bytes),digest);
    }
    assert.ok(Math.max(w.largeWidth,w.largeHeight)<=3200);assert.ok(w.largeWidth<=w.provenance.downloadedWidth);assert.ok(w.largeHeight<=w.provenance.downloadedHeight);
    assert.ok(!hashes.has(w.sha256));hashes.add(w.sha256);assert.equal(w.provenance.thumbnailSha256,w.sha256);
  }
  for(const old of current.filter(w=>!byId.has(w.id)))assert.ok(!hashes.has(sha(fs.readFileSync(new URL(old.image,site)))),'new image duplicates current preview '+old.id);
});

test('Partial cycles and monochrome archive fragments cannot become ordinary stimuli or invented whole-work traits',()=>{
  for(const id of partial){const w=byId.get(id),r=attributes.reviews[id];assert.equal(w.studyEligible,false);assert.equal(w.eligibleForStudy,false);assert.deepEqual(w.features,{});assert.equal(w.compositionScope,'section');assert.ok(w.underlyingWorkId);assert.match(w.title,/section|wall|detail/);assert.ok(Object.values(r.attributes).every(a=>a.status==='unknown'));}
  assert.equal(byId.get('req-siqueiros-new-democracy').compositionScope,'whole-panel');assert.match(byId.get('req-siqueiros-new-democracy').title,/central panel/);
  for(const w of works.filter(w=>w.studyEligible)){assert.equal(Object.keys(w.features).length,7);assert.ok(Object.values(w.features).every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.match(w.featureSource,/provisional/);}
});

test('All sixteen statuses bind exact reviewed previews and large sources, with honest assistant provenance',()=>{
  assert.equal(works.length,19);const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort();
  for(const w of works){const r=attributes.reviews[w.id];assert.equal(r.reviewed,true);assert.equal(r.reviewerType,'assistant-visual-review');assert.deepEqual(r.sourceIdentity,{sourceUrl:w.sourceUrl,image:w.image,previewSha256:w.sha256});assert.deepEqual(Object.keys(r.attributes).sort(),keys);assert.equal(r.reviewedAsset.sha256,w.provenance.largeSha256);assert.equal(r.reviewedAsset.image,w.imageLarge);for(const a of Object.values(r.attributes)){assert.ok(['present','absent','unknown'].includes(a.status));assert.ok(a.reason.length>20);assert.equal(a.evidenceKind,'visual-review');}}
});

test('Exact series, version, date alternatives and source-limited reproductions stay explicit',()=>{
  for(const sense of ['hearing','smell','taste','touch'])assert.ok(byId.has('req-brueghel-'+sense));assert.ok(current.some(w=>w.id==='brueghel-sight'));
  assert.deepEqual(byId.get('req-caravaggio-david-borghese').analysis.dateAlternatives,[[1606,1607],[1609,1610]]);
  const dore=byId.get('req-dore-quixote-library');assert.equal(dore.analysis.originalDesignYear,1863);assert.equal(dore.analysis.scannedEditionYear,1906);assert.match(dore.artist,/Pisan/);
  const birk=byId.get('req-birkhauser-worlds-wound');assert.equal(birk.largeHeight,1706);assert.equal(birk.provenance.sourceLimited,true);assert.ok(attributes.reviews[birk.id].sourcedContext.some(c=>c.kind==='documented-title-alias'&&c.sourceUrl.includes('jungpage.org')));
  for(const id of ['req-rivera-controller-universe','req-orozco-katharsis','req-camarena-liberacion','req-siqueiros-new-democracy']){const w=byId.get(id);assert.ok(w.provenance.documentImageExtraction);assert.equal(w.viewScope==='whole-work'||w.viewScope==='whole-panel',true);}
});
