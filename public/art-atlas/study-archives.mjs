const DATABASE='art-atlas-study-archives',STORE='quizzes';
export const ARCHIVE_STORAGE='art-atlas-indexeddb-v1';
const isReference=value=>value?.archiveStorage===ARCHIVE_STORAGE&&typeof value.id==='string';

/** Large, unchanged old runs live in IndexedDB; the active quiz stays in localStorage. */
export function createStudyArchiveStore(indexedDB=globalThis.indexedDB){
  let connection;
  function open(){
    if(!indexedDB)return Promise.reject(Error('Archive storage unavailable'));
    return connection??=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DATABASE,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Archive storage unavailable'));
      request.onblocked=()=>reject(Error('Archive storage is busy'));
    });
  }
  return {
    async put(id,value){const db=await open();return new Promise((resolve,reject)=>{const transaction=db.transaction(STORE,'readwrite');transaction.objectStore(STORE).put({id,value});transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('Archive was not saved'));});},
    async get(id){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result?.value);request.onerror=()=>reject(request.error||Error('Archive could not open'));});}
  };
}

export async function storeStudyArchives(sessions,store){
  const references=new Map();
  for(const session of sessions||[]){
    if(isReference(session))continue;
    const id=session?.manifest?.id;if(typeof id!=='string')continue;
    await store.put(id,structuredClone(session));
    references.set(id,{archiveStorage:ARCHIVE_STORAGE,id,manifest:{id,createdAt:session.manifest.createdAt},answerCount:Object.keys(session.answers||{}).length});
  }
  return references;
}

export async function loadStudyArchives(sessions,store){
  const references=new Map(),archives=[];
  for(const session of sessions||[]){
    if(!isReference(session)){archives.push(session);continue;}
    let saved;try{saved=await store.get(session.id);}catch{/* The reference remains recoverable and is never replaced by a different run. */}
    if(saved?.manifest?.id===session.id){archives.push(saved);references.set(session.id,session);}
    else archives.push({...session,unavailable:true});
  }
  return {archives,references};
}

export function encodeStudyWithArchives(data,references=new Map()){
  return JSON.stringify({...data,archives:(data.archives||[]).map(session=>references.get(session?.manifest?.id)||session)});
}
