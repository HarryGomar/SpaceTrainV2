import {COLLECTION_STORAGE_KEY, COLLECTION_STUDY_KEY, collectionRecord} from '../../public/art-atlas/collection-controls.mjs';
import {PERSONAL_GALLERIES_KEY, validPersonalGalleries} from '../../public/art-atlas/personal-galleries.mjs';
import {createActiveStudyPersistence, loadActiveStudy} from '../../public/art-atlas/active-study-storage.mjs';
import {createStudyArchiveStore, loadStudyArchives} from '../../public/art-atlas/study-archives.mjs';

export const ACCOUNT_SAVE_FORMAT = 'art-atlas-account-save-v1';
export const accountSaveTypes = Object.freeze([
  {id:'galleries', label:'Galleries', key:PERSONAL_GALLERIES_KEY, href:'./galleries.html'},
  {id:'collection', label:'Saved paintings', key:COLLECTION_STORAGE_KEY, href:'./?view=collection'},
  {id:'study', label:'Quiz progress', key:COLLECTION_STUDY_KEY, href:'./'}
]);
const typeById = new Map(accountSaveTypes.map(type => [type.id, type]));
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const validStudy = value => record(value) && value.version === 1 &&
  value.manifest?.protocol === 'art-profile-50-v1' && typeof value.manifest.id === 'string' && value.manifest.id.length > 0 &&
  Array.isArray(value.manifest.catalogue) && Array.isArray(value.plan) && value.plan.length >= 50 &&
  record(value.shown) && record(value.answers) && Array.isArray(value.archives);

function saveType(kind) {
  const type = typeById.get(kind);
  if (!type) throw Error('That Art Atlas save type is unavailable.');
  return type;
}

export function validateAccountSave(kind, snapshot) {
  if (!record(snapshot) || snapshot.format !== ACCOUNT_SAVE_FORMAT || snapshot.kind !== kind) {
    throw Error('That account save could not be opened.');
  }
  const value = snapshot.value;
  if (kind === 'collection') {
    if (!record(value)) throw Error('That saved collection could not be opened.');
    collectionRecord(value);
  } else if (kind === 'galleries') {
    if (!validPersonalGalleries(value)) throw Error('That gallery save could not be opened.');
  } else if (kind === 'study') {
    if (!validStudy(value) || value.archives.some(archive => !record(archive) || archive.archiveStorage || archive.unavailable)) {
      throw Error('That quiz save is missing part of its original record.');
    }
  } else {
    saveType(kind);
  }
  return snapshot;
}

export function accountSaveSummary(snapshot) {
  if (!snapshot) return 'None on this device';
  const {kind, value} = snapshot;
  if (kind === 'galleries') return value.galleries.length + (value.galleries.length === 1 ? ' gallery' : ' galleries');
  if (kind === 'collection') {
    const count = Object.keys(value.saved || {}).length;
    const readings = value.sessions?.length || 0;
    return count + (count === 1 ? ' painting' : ' paintings') + (readings ? ' and ' + readings + (readings === 1 ? ' saved reading' : ' saved readings') : '');
  }
  const responses = Object.values(value.answers).filter(answer => answer && !answer.skipped).length;
  return responses + (responses === 1 ? ' response' : ' responses') +
    (value.archives.length ? ' and ' + value.archives.length + (value.archives.length === 1 ? ' earlier quiz' : ' earlier quizzes') : '');
}

export function createDeviceAccountSaves({storage=globalThis.localStorage, store=createStudyArchiveStore(), external=!!globalThis.indexedDB}={}) {
  async function read(kind, raw) {
    if (raw === null || raw === undefined) return null;
    const key = saveType(kind).key;
    let value;
    if (kind === 'study') {
      const study = await loadActiveStudy(key, {storage:{getItem:() => raw}, store});
      if (!validStudy(study)) throw Error('The quiz on this device could not be opened.');
      const {archives} = await loadStudyArchives(study.archives, store);
      value = {...study, archives};
    } else {
      value = JSON.parse(raw);
      if (kind === 'collection' && value !== null) value = collectionRecord(value);
    }
    if (value === null) return null;
    const snapshot = validateAccountSave(kind, {format:ACCOUNT_SAVE_FORMAT, kind, value});
    if (kind === 'study' && !value.startedAt && !Object.keys(value.answers).length && !value.archives.length) return null;
    if (kind === 'galleries' && !value.galleries.length) return null;
    if (kind === 'collection' && !Object.keys(value.saved).length && !value.sessions.length) return null;
    return snapshot;
  }

  const recoveryKey = (ownerId, kind) => 'art-atlas-account-recovery:' + ownerId + ':' + saveType(kind).id;
  const capture = kind => read(kind, storage.getItem(saveType(kind).key));
  async function recovery(ownerId, kind) {
    const snapshot = await store.get(recoveryKey(ownerId, kind));
    return snapshot ? validateAccountSave(kind, snapshot) : null;
  }

  async function restore(ownerId, kind, incoming) {
    const {value} = validateAccountSave(kind, incoming);
    const storageKey = saveType(kind).key;
    const before = storage.getItem(storageKey);
    const previous = await read(kind, before);
    if (previous) await store.put(recoveryKey(ownerId, kind), previous);

    let failure;
    const guardedStorage = {
      getItem: key => storage.getItem(key),
      setItem(key, text) {
        if (storage.getItem(key) !== before) throw Error('This device changed while the save was opening. Try again from the latest version.');
        storage.setItem(key, text);
      }
    };
    const serialized = JSON.stringify(value);
    if (kind === 'study') {
      const writer = createActiveStudyPersistence({
        storageKey, storage:guardedStorage, store, external, delay:0, onError:error => { failure = error; }
      });
      if (!await writer.save(serialized, {sessionId:value.manifest.id})) throw failure || Error('The quiz could not be restored on this device.');
    } else {
      guardedStorage.setItem(storageKey, serialized);
    }
    return {previous:!!previous};
  }

  return {capture, recovery, restore};
}
