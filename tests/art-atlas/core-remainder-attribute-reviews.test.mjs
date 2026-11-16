import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
const root=new URL('../../',import.meta.url),site=new URL('public/art-atlas/',root);
const current=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const reviews=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const original=Object.keys(JSON.parse(fs.readFileSync(new URL('tools/artwork-attribute-observations-20261115.json',root),'utf8')));
const observations=JSON.parse(fs.readFileSync(new URL('tools/core-remainder-observations-20261115.json',root),'utf8'));
const ids=Object.keys(observations),byId=new Map(current.map(w=>[w.id,w]));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const status=(id,key)=>reviews.reviews[id].attributes[key].status;

test('The original96 and reviewed remainder68 partition all original164 without borrowing expansion records',()=>{
  assert.equal(original.length,96);assert.equal(ids.length,68);
  assert.equal(new Set([...original,...ids]).size,164);
  assert.deepEqual([...original,...ids].sort(),current.slice(0,164).map(w=>w.id).sort());
  for(const id of ids){assert.ok(!id.startsWith('req-'));assert.ok(!id.startsWith('extended-'));assert.ok(reviews.reviews[id],id+' integrated review');}
});

test('Every remainder record binds the current exact source and both preview and reviewed image bytes',()=>{
  for(const id of ids){
    const w=byId.get(id),r=reviews.reviews[id],preview=fs.readFileSync(new URL(w.image,site));
    assert.deepEqual(r.sourceIdentity,{sourceUrl:w.sourceUrl,image:w.image,previewSha256:sha(preview)},id);
    const reference=reviews.currentAssetReferences[JSON.stringify([w.sourceUrl,w.image])];assert.equal(reference.previewSha256,sha(preview));
    const bytes=fs.readFileSync(new URL(r.reviewedAsset.image,site)),size=imageDimensions(bytes);
    assert.equal(sha(bytes),r.reviewedAsset.sha256,id);assert.equal(size.width,r.reviewedAsset.width);assert.equal(size.height,r.reviewedAsset.height);assert.equal(size.mime,'image/jpeg');
    assert.equal(r.reviewedAsset.compositionMatch,'same-composition');assert.match(r.reviewedAsset.displayScale,/contact-sheet/);
  }
});

test('All sixteen criteria have explicit assistant-reviewed statuses, visible reasons and no invented symbolic facts',()=>{
  const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort();let unknown=0;
  for(const id of ids){const r=reviews.reviews[id];assert.equal(r.version,'artwork-attributes-v1');assert.equal(r.reviewed,true);assert.equal(r.reviewerType,'assistant-visual-review');assert.deepEqual(Object.keys(r.attributes).sort(),keys);assert.match(r.reviewMethod,/No artist or movement defaults/);assert.match(r.reviewMethod,/not independent human validation/);
    for(const a of Object.values(r.attributes)){assert.ok(['present','absent','unknown'].includes(a.status));assert.ok(a.reason.length>20);assert.equal(a.evidenceKind,'visual-review');assert.equal(Object.hasOwn(a,'score'),false);if(a.status==='unknown')unknown++;}
    assert.deepEqual(r.sourcedContext,[]);assert.equal(r.contextStatus,'not-documented-in-this-review');
  }
  assert.ok(unknown>100);assert.match(reviews.reviews['teotihuacan-mural'].reviewScope,/Surviving fragment only/);
});

test('Actual visual treatment can differ within an artist and a movement',()=>{
  assert.equal(status('add-mondrian-composition-1930','visible-paint-marks'),'unknown');
  assert.equal(status('add-mondrian-tableau-one','visible-paint-marks'),'present');
  assert.equal(status('add-mondrian-composition-1930','precise-rendering'),'present');
  assert.equal(status('add-mondrian-tableau-one','precise-rendering'),'absent');
  assert.equal(status('add-magritte-fanatiques','imagined-world'),'unknown');
  assert.equal(status('add-ernst-divinite','imagined-world'),'present');
  assert.equal(status('add-kandinsky-impression-concert','geometric-structure'),'present');
  assert.equal(status('add-kandinsky-rowing','geometric-structure'),'absent');
});

test('Titles, pose and ordinary high contrast cannot manufacture depicted action, nature or selective light',()=>{
  assert.equal(status('add-malevich-football-player','visible-gesture'),'absent');
  assert.equal(status('add-klee-flowering-tree','landscape'),'absent');
  assert.equal(status('monet-spring-flowers','landscape'),'absent');
  assert.equal(status('study-monet-japanese-footbridge','landscape'),'present');
  assert.equal(status('study-wood-american-gothic','visible-gesture'),'absent');
  assert.equal(status('study-gentileschi-judith','visible-gesture'),'present');
  assert.equal(status('add-kupka-cathedral','dramatic-light'),'unknown');
  assert.equal(status('add-atl-climatic-eruption','dramatic-light'),'present');
});
