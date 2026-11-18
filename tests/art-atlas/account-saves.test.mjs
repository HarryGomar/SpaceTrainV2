import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCOUNT_SAVE_FORMAT, createDeviceAccountSaves} from '../../src/art-atlas/account-storage.mjs';
import {ACTIVE_STUDY_STORAGE, isActiveStudyReference, loadActiveStudy} from '../../public/art-atlas/active-study-storage.mjs';
import {ARCHIVE_STORAGE} from '../../public/art-atlas/study-archives.mjs';
import {COLLECTION_STORAGE_KEY, COLLECTION_STUDY_KEY} from '../../public/art-atlas/collection-controls.mjs';
import {PERSONAL_GALLERIES_KEY, addPersonalGallery, emptyPersonalGalleries} from '../../public/art-atlas/personal-galleries.mjs';

const owner = 'tester-on-a-different-device';
const kindSave = (kind, value) => ({format:ACCOUNT_SAVE_FORMAT, kind, value});
const studyKey = COLLECTION_STUDY_KEY;
const roundId = 'journey-001';
function study(id) {
  const work = {id:'fixture-sun', image:'assets/fixture.jpg', sourceUrl:'https://example.invalid/fixture'};
  const shown = {id:roundId, kind:'spectrum', workIds:[work.id], evidence:{positionMeaning:'original-screen-coordinate'}};
  return {
    version:1, manifest:{id, protocol:'art-profile-50-v1', catalogue:[work]},
    startedAt:1, plan:Array.from({length:50}, (_, i) => ({id:'journey-'+String(i+1).padStart(3,'0')})),
    shown:{[roundId]:shown}, answers:{[roundId]:{positions:{[work.id]:73}, confirmed:true}}, archives:[]
  };
}

function fixture() {
  const values = new Map(), archive = new Map();
  const storage = {
    getItem:key => values.get(key) ?? null,
    setItem(key, raw) { values.set(key, raw); }
  };
  const store = {
    async get(id) { return archive.get(id); },
    async put(id, value) { archive.set(id, structuredClone(value)); },
    async remove(id) { archive.delete(id); }
  };
  return {storage, store, values, archive, device:createDeviceAccountSaves({storage, store, external:true})};
}

test('Quiz saves resolve frozen archives and restore the exact shown questions and responses on another device', async () => {
  const from = fixture(), to = fixture(), active = study('active-original'), archived = study('earlier-original');
  const originalId = 'active:'+studyKey+':fixture';
  active.archives = [{id:archived.manifest.id, archiveStorage:ARCHIVE_STORAGE}];
  await from.store.put(originalId, {activeStorage:ACTIVE_STUDY_STORAGE, storageKey:studyKey, serialized:JSON.stringify(active)});
  await from.store.put(archived.manifest.id, archived);
  from.storage.setItem(studyKey, JSON.stringify({id:originalId, sessionId:active.manifest.id, activeStorage:ACTIVE_STUDY_STORAGE, storageKey:studyKey}));

  const snapshot = await from.device.capture('study');
  assert.deepEqual(snapshot.value.archives, [archived]);
  assert.deepEqual(snapshot.value.shown, active.shown);
  assert.deepEqual(snapshot.value.answers, active.answers);
  assert.equal(JSON.parse(from.storage.getItem(studyKey)).id, originalId, 'Reading a save leaves the device identity alone');

  snapshot.value.retainedSource = 'large portable record '.repeat(10_000);
  await to.device.restore(owner, 'study', snapshot);
  assert.ok(isActiveStudyReference(JSON.parse(to.storage.getItem(studyKey))));
  assert.deepEqual(await loadActiveStudy(studyKey, to), snapshot.value);
  await from.store.remove(archived.manifest.id);
  await assert.rejects(from.device.capture('study'), /missing part of its original record/);
});

test('Restoring a collection or gallery keeps its previous device copy under the signed-in account', async () => {
  const f = fixture();
  const old = {version:1, saved:{w1:{look:true}}, sessions:[]};
  const fresh = {version:1, saved:{w2:{study:true}}, sessions:[]};
  f.storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(old));
  const gallery = addPersonalGallery(emptyPersonalGalleries(), {now:1, galleryId:'g', roomId:'r'}).state;
  await f.device.restore(owner, 'galleries', kindSave('galleries', gallery));
  assert.deepEqual(await f.device.capture('galleries'), kindSave('galleries', gallery));
  assert.equal(f.storage.getItem(COLLECTION_STORAGE_KEY), JSON.stringify(old));

  assert.deepEqual(await f.device.restore(owner, 'collection', kindSave('collection', fresh)), {previous:true});
  assert.deepEqual(await f.device.capture('collection'), kindSave('collection', fresh));
  assert.deepEqual(await f.device.recovery(owner, 'collection'), kindSave('collection', old));
  assert.equal(await f.device.recovery('other-account', 'collection'), null);
});

test('Restore refuses a concurrent device write and keeps the incoming copy out of active storage', async () => {
  const f = fixture(), old = {version:1, saved:{w1:{look:true}}, sessions:[]}, latest = {...old, saved:{w3:{look:true}}};
  f.storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(old));
  const store = {...f.store, async put(id, value) {
    f.storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(latest));
    await f.store.put(id, value);
  }};
  const device = createDeviceAccountSaves({storage:f.storage, store, external:true});
  await assert.rejects(device.restore(owner, 'collection', kindSave('collection', old)), /This device changed/);
  assert.deepEqual(await device.capture('collection'), kindSave('collection', latest));
});
