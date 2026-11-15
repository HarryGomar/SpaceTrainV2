import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {museumLibraryOrder,recognitionTier} from '../../public/art-atlas/curation-priority.mjs';
import {createGalleryRecord,validGalleryDraft} from '../../public/art-atlas/gallery-model.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url)));
test('The museum presents recognisable works first while retaining every distinct offered artwork',()=>{
  const before=structuredClone(works),ordered=museumLibraryOrder(works);
  assert.deepEqual(ordered.slice(0,4).map(work=>work.id),['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss']);
  assert.deepEqual(new Set(ordered.map(work=>work.id)),new Set(works.map(work=>work.id)));
  assert.equal(ordered.length,99);assert.ok(ordered.slice(0,12).every(work=>recognitionTier(work)!=='discovery'));
  assert.deepEqual(works,before);
});
test('The journey museum records the landmark-first tray order instead of shuffling it again',()=>{
  const record=createGalleryRecord([...works].reverse(),{}, {id:'museum-landmarks',presentationOrder:'landmark-first-v1'});
  assert.equal(record.presentationOrder,'landmark-first-v1');assert.ok(validGalleryDraft(record,works));
  assert.deepEqual(record.offeredIds,museumLibraryOrder([...works].reverse()).map(work=>work.id));
  assert.deepEqual(record.presentedIds,[]);assert.deepEqual(record.placements,{});
});
