import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_STATUSES,ARTWORK_ATTRIBUTE_LIMITS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {resolveArtworkMedia} from '../../public/art-atlas/artwork-media.mjs';
import {journeyCurationNotes} from '../../public/art-atlas/journey-bank.mjs';

const site=new URL('../../public/art-atlas/',import.meta.url);
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const byId=new Map(works.map(work=>[work.id,work]));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort();
const status=(id,key)=>data.reviews[id].attributes[key].status;
const originalIds=Object.keys(JSON.parse(fs.readFileSync(new URL('../../tools/artwork-attribute-observations-20261115.json',import.meta.url),'utf8')));
const originalRecords=originalIds.map(id=>data.reviews[id]);

test('Sixteen operational visual criteria retain explicit unknown and negative semantics without numeric scores',()=>{
  assert.equal(ARTWORK_ATTRIBUTE_VERSION,'artwork-attributes-v1');
  assert.equal(keys.length,16);
  assert.deepEqual([...ARTWORK_ATTRIBUTE_STATUSES],['present','absent','unknown']);
  assert.deepEqual([...data.attributeKeys].sort(),keys);
  assert.equal(data.unknownSemantics.missingReview,'unknown');
  assert.equal(data.unknownSemantics.sourceMismatch,'unknown');
  assert.match(data.unknownSemantics.missingSymbolism,/never evidence/);
  assert(ARTWORK_ATTRIBUTE_LIMITS.some(line=>/not independent human validation/.test(line)));
  for(const definition of Object.values(ARTWORK_ATTRIBUTE_DEFINITIONS))for(const field of ['label','definition','excludes','absentReason'])assert(definition[field]?.length>8);
});

test('Every reviewed work has all16 statuses, source evidence and honest assistant provenance',()=>{
  assert.equal(originalIds.length,96);
  assert.equal(data.reviewedCount,Object.keys(data.reviews).length);
  assert.ok(data.reviewedCount>=96);
  assert.equal(data.reviewerType,'assistant-visual-review');
  for(const [id,record] of Object.entries(data.reviews)){
    assert(byId.has(id),id);
    assert.equal(record.version,ARTWORK_ATTRIBUTE_VERSION);
    assert.equal(record.reviewed,true);
    assert.equal(record.reviewerType,'assistant-visual-review');
    assert.deepEqual(Object.keys(record.attributes).sort(),keys);
    for(const observation of Object.values(record.attributes)){
      assert(ARTWORK_ATTRIBUTE_STATUSES.includes(observation.status),id);
      assert.equal(observation.evidenceKind,'visual-review');
      assert.equal(typeof observation.reason,'string');
      assert(observation.reason.length>20,id);
      assert(!Object.hasOwn(observation,'score'));
    }
    assert(record.sourceUrls.includes(record.sourceIdentity.sourceUrl));
    assert(record.sourceUrls.every(url=>/^https:\/\//.test(url)));
    assert.ok(record.reviewMethod.length>50);
    if(originalIds.includes(id)){
      assert.match(record.reviewMethod,/all sixteen criteria/);
      assert.match(record.reviewMethod,/No artist or movement defaults/);
    }
  }
});

test('Every sourceIdentity binds actual preview bytes and every reviewedAsset binds the resolved same-composition reproduction',()=>{
  for(const [id,record] of Object.entries(data.reviews)){
    const work=byId.get(id),preview=fs.readFileSync(new URL(work.image,site)),expected=sha(preview),media=resolveArtworkMedia(work,{preferLarge:true});
    assert.deepEqual(record.sourceIdentity,{sourceUrl:work.sourceUrl,image:work.image,previewSha256:expected},id);
    const reference=data.currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])];
    assert(reference,id+' current verified reference');
    assert.equal(reference.sourceUrl,work.sourceUrl);
    assert.equal(reference.image,work.image);
    assert.equal(reference.previewSha256,expected);
    assert.equal(reference.verification,'sha256-of-current-local-preview');
    for(const declared of [work.sha256,work.provenance?.sha256,work.provenance?.thumbnailSha256].filter(Boolean))assert.equal(declared,expected,id+' preview alias');
    assert.match(record.reviewedAsset.sha256,/^[a-f0-9]{64}$/);
    // Some added records were honestly reviewed from their local preview,
    // while the original fixture used the resolved large reproduction.
    assert.ok([work.image,media.src].includes(record.reviewedAsset.image),id+' approved same-work reproduction');
    assert.ok(typeof record.reviewedAsset.mediaBinding==='string'&&record.reviewedAsset.mediaBinding.length>4);
    assert.equal(record.reviewedAsset.compositionMatch,'same-composition');
    assert.equal(typeof record.reviewedAsset.sourceLimited,'boolean');
    const bytes=fs.readFileSync(new URL(record.reviewedAsset.image,site)),size=imageDimensions(bytes);
    assert.equal(sha(bytes),record.reviewedAsset.sha256,id+' review image');
    assert.equal(size.width,record.reviewedAsset.width,id);
    assert.equal(size.height,record.reviewedAsset.height,id);
    assert.equal(size.mime,'image/jpeg');
  }
  assert.equal(Object.keys(data.currentAssetReferences).length,Object.keys(data.reviews).length);
  assert.match(data.currentAssetReferenceScope,/do not assert/);
});

test('The original96 review fixture and complete current72-work curation remain covered after catalogue expansion',()=>{
  const first=new Set(journeyCurationNotes(works).proposedFirst18Panels.flatMap(panel=>panel.workIds));
  assert.equal(first.size,72);
  for(const id of first)assert(data.reviews[id],id);
  for(const id of originalIds)assert(data.reviews[id],id);
  assert.ok(Object.keys(data.reviews).filter(id=>!first.has(id)).length>=24);
  for(const id of ['monet-water-lilies','rousseau-tiger-buffalo','chitarman-tiered-court','opening-cma-169545','add-thomas-etude-blue','add-krasner-icarus','add-merida-time-space','figari-candombe-moon','study-guo-xi-early-spring'])assert(data.reviews[id],id);
  for(const id of ['study-rembrandt-night-watch','study-botticelli-birth-venus','study-waterhouse-shalott','study-david-marat','study-fan-kuan-travelers','add-varo-sympathy','add-varo-weaving-space-time','add-izquierdo-living-still-life','add-rivera-flower-vendor','add-af-klint-dove-two','add-hammershoi-room-wife','add-morandi-still-life-1948'])assert(data.reviews[id],id);
});

test('The review distinguishes treatment, subject and unresolved evidence rather than assigning artist-wide defaults',()=>{
  assert.equal(status('add-pollock-convergence','pattern-rhythm'),'present');
  assert.equal(status('add-pollock-convergence','geometric-structure'),'absent');
  assert.equal(status('add-pollock-convergence','expressive-distortion'),'unknown');
  assert.equal(status('add-thomas-etude-blue','geometric-structure'),'absent');
  assert.equal(status('add-thomas-etude-blue','visible-paint-marks'),'present');
  assert.equal(status('add-newman-prometheus-bound','geometric-structure'),'unknown');
  assert.equal(status('study-vermeer-milkmaid','visible-paint-marks'),'absent');
  assert.equal(status('study-morisot-cradle','visible-paint-marks'),'present');
  assert.equal(status('study-david-marat','visible-gesture'),'absent');
  assert.equal(status('goya-saturn','visible-gesture'),'present');
  assert.equal(status('study-van-gogh-sunflowers','landscape'),'absent');
  assert.equal(status('van-gogh-starry-night','landscape'),'present');
  assert.equal(status('van-gogh-starry-night','narrative-detail'),'absent');
  assert.equal(status('van-gogh-night-cafe','narrative-detail'),'present');
  assert.equal(status('add-caravaggio-judith-barberini','theatrical-staging'),'present');
  assert.equal(status('add-caravaggio-taking-christ','theatrical-staging'),'absent');
  assert.equal(status('holbein-ambassadors','expressive-distortion'),'present');
  assert.equal(status('holbein-ambassadors','precise-rendering'),'present');
});

test('Documented meanings remain separate cited context and lack of documentation supplies no negative symbolism score',()=>{
  assert.equal(originalRecords.filter(record=>record.sourcedContext.length).length,9);
  for(const record of Object.values(data.reviews)){
    assert(!Object.hasOwn(record.attributes,'symbolic-objects'));
    assert.equal(record.contextStatus,record.sourcedContext.length?'documented-context-available':'not-documented-in-this-review');
    for(const context of record.sourcedContext){
      assert.equal(context.evidenceKind,'primary-source-context');
      assert.ok(typeof context.kind==='string'&&context.kind.length>8);
      if(originalRecords.includes(record))assert(['documented-symbolism','documented-narrative'].includes(context.kind));
      assert(context.claim.length>25&&context.sourcePublisher&&context.sourceLocator);
      assert.match(context.sourceUrl,/^https:\/\//);
      assert(record.sourceUrls.includes(context.sourceUrl));
      assert(!Object.hasOwn(context,'preferenceScore'));
    }
  }
  assert.equal(data.reviews['goya-saturn'].contextStatus,'not-documented-in-this-review');
  assert.equal(data.reviews['add-watts-hope'].sourcedContext[0].kind,'documented-symbolism');
});
