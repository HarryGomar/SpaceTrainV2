import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveArtworkContext,artworkContextSearchText,renderArtworkContext} from '../../public/art-atlas/artwork-context.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('Context distinguishes a documented creation place from inherited national context',()=>{
  const work=works.find(item=>item.id==='opening-cma-141639'),before=structuredClone(work),context=resolveArtworkContext(work);
  assert.ok(context);assert.match(context.creationPlace.value,/New York/i);assert.match(context.depictedPlace.value,/Maine/i);assert.deepEqual(work,before);
});

test('Refined visual treatments are searchable without replacing the historical movement field',()=>{
  const work=works.find(item=>item.id==='add-rothko-orange-yellow');assert.match(artworkContextSearchText(work),/colour-field abstraction/i);assert.equal(work.movement,'Color field painting');assert.match(renderArtworkContext(work,{esc}),/Curatorial labels/);
});

test('An ID cannot attach context from a different source, image or contradictory preview hash',()=>{
  const work=works.find(item=>item.id==='add-rothko-orange-yellow');
  for(const changed of [{...work,sourceUrl:'https://example.org/other'},{...work,image:'assets/other.jpg'},{...work,previewSha256:'0'.repeat(64)}]){
    assert.equal(resolveArtworkContext(changed),null);assert.equal(artworkContextSearchText(changed),'');assert.equal(renderArtworkContext(changed,{esc}),'');
  }
});

test('Unknown creation places do not become an artist nationality or museum location',()=>{
  const work=works.find(item=>item.id==='velazquez-las-meninas'),html=renderArtworkContext(work,{esc});assert.doesNotMatch(html,/<dt>Made in<\/dt>/);assert.match(html,/Baroque/);
});
