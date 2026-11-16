import {createStudyArchiveStore} from './study-archives.mjs';

export const ACTIVE_STUDY_STORAGE='art-atlas-active-indexeddb-v1';
const marker=value=>value?.activeStorage===ACTIVE_STUDY_STORAGE;
const hasMarker=value=>typeof value?.activeStorage==='string';
const reference=value=>marker(value)&&typeof value.id==='string'&&typeof value.storageKey==='string'&&value.id.startsWith('active:'+value.storageKey+':');
export const isActiveStudyReference=hasMarker;

/** A missing database record is a recovery error, never an empty/new quiz. */
export async function loadActiveStudy(storageKey,{storage=globalThis.localStorage,store=createStudyArchiveStore()}={}){
  const raw=storage?.getItem(storageKey),parsed=JSON.parse(raw||'null');
  if(!hasMarker(parsed))return parsed;
  if(!marker(parsed))throw Error('This saved quiz reference uses an unsupported format. It has been retained.');
  if(!reference(parsed))throw Error('The saved quiz reference is incomplete. It has been retained.');
  if(parsed.storageKey!==storageKey)throw Error('The saved quiz reference belongs to another study.');
  const record=await store.get(parsed.id);
  if(record?.activeStorage!==ACTIVE_STUDY_STORAGE||record.storageKey!==storageKey||typeof record.serialized!=='string')throw Error('The saved quiz could not be opened. Its reference has been retained.');
  const value=JSON.parse(record.serialized);
  if(!value||typeof value!=='object'||parsed.sessionId&&value.manifest?.id!==parsed.sessionId)throw Error('The saved quiz identity does not match its reference.');
  return value;
}

/** Coalesce draft events before serializing. Only committed database writes get a reference. */
export function createActiveStudyPersistence({storageKey,storage=globalThis.localStorage,store=createStudyArchiveStore(),external=!!globalThis.indexedDB,delay=40,inlineLimit=180000,onError=()=>{}}={}){
  let pending=null,running=false,timer=null,generation=0,serial=0,lastResult=true;
  const writer=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),idle=[];
  const remove=async id=>{if(id&&store.remove)try{await store.remove(id);}catch{/* An unreferenced old snapshot may be collected later. */}};
  const settleIdle=()=>{if(!pending&&!running){for(const resolve of idle.splice(0))resolve(lastResult);}};
  function fail(error){lastResult=false;try{onError(error);}catch{}return false;}
  function previousReference(){try{const value=JSON.parse(storage?.getItem(storageKey)||'null');return reference(value)?value:null;}catch{return null;}}
  function schedule(){if(!running&&timer===null)timer=setTimeout(()=>{timer=null;void drain();},delay);}
  async function persist(job){
    let raw;try{raw=typeof job.value==='function'?job.value():job.value;if(typeof raw!=='string')throw Error('The quiz save must be serialized text.');}catch(error){return fail(error);}
    if(job.generation!==generation)return false;
    const previous=previousReference();
    if(!external||raw.length<=inlineLimit&&!previous){try{storage.setItem(storageKey,raw);lastResult=true;return true;}catch(error){return fail(error);}}
    const id='active:'+storageKey+':'+writer+':'+(++serial),next={activeStorage:ACTIVE_STUDY_STORAGE,storageKey,id,...(job.sessionId?{sessionId:job.sessionId}:{}),savedAt:Date.now()};
    try{
      await store.put(id,{activeStorage:ACTIVE_STUDY_STORAGE,storageKey,serialized:raw});
      if(job.generation!==generation){await remove(id);return false;}
      // Publishing first would turn a failed transaction into a lost quiz.
      storage.setItem(storageKey,JSON.stringify(next));
      lastResult=true;await remove(previous?.id);return true;
    }catch(error){await remove(id);return job.generation===generation?fail(error):false;}
  }
  async function drain(){
    if(running)return;
    running=true;
    while(pending){const job=pending;pending=null;const ok=await persist(job);for(const resolve of job.waiters)resolve(ok);}
    running=false;settleIdle();
  }
  function save(value,{sessionId}={}){
    if(!external){try{const raw=typeof value==='function'?value():value;if(typeof raw!=='string')throw Error('The quiz save must be serialized text.');storage.setItem(storageKey,raw);lastResult=true;return Promise.resolve(true);}catch(error){return Promise.resolve(fail(error));}}
    return new Promise(resolve=>{const waiters=pending?.waiters||[];waiters.push(resolve);pending={value,sessionId,generation,waiters};schedule();});
  }
  function flush(){if(timer!==null){clearTimeout(timer);timer=null;}if(pending&&!running)void drain();if(!pending&&!running)return Promise.resolve(lastResult);return new Promise(resolve=>idle.push(resolve));}
  function clear(){
    generation++;if(timer!==null){clearTimeout(timer);timer=null;}if(pending){for(const resolve of pending.waiters)resolve(false);pending=null;}
    const previous=previousReference();try{storage.removeItem(storageKey);lastResult=true;}catch(error){fail(error);}
    void remove(previous?.id);settleIdle();return flush();
  }
  return {save,flush,clear};
}
