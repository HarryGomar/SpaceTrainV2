import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_STUDY_STORAGE,createActiveStudyPersistence,loadActiveStudy} from '../../public/art-atlas/active-study-storage.mjs';

const key='art-profile-journey-v1';
function local(limit=Infinity){const values=new Map();return {values,getItem:id=>values.get(id)||null,setItem(id,value){if([...values].reduce((sum,[k,v])=>sum+(k===id?0:v.length),value.length)>limit)throw Error('quota');values.set(id,value);},removeItem:id=>values.delete(id)};}
function database(){const values=new Map();return {values,async put(id,value){values.set(id,structuredClone(value));},async get(id){return structuredClone(values.get(id));},async remove(id){values.delete(id);}};}
const snapshot=(position=79)=>({manifest:{id:'same-frozen-study',catalogue:[{id:'one',title:'Original title',note:'x'.repeat(300000)}]},plan:[{id:'journey-001',workIds:['one'],title:'Original question'}],shown:{'journey-001':{id:'journey-001',workIds:['one'],title:'Original question'}},answers:{'journey-001':{workIds:['one'],positions:{one:position},confirmed:true}},archives:[]});
const text=value=>JSON.stringify(value);

test('Large active snapshots restore exactly through a small committed reference under a restrictive local quota',async()=>{
  const storage=local(2000),store=database(),writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000}),value=snapshot();
  const saved=writer.save(()=>text(value),{sessionId:value.manifest.id});
  assert.equal(storage.getItem(key),null,'An uncommitted snapshot cannot get a pointer.');
  await writer.flush();assert.equal(await saved,true);
  const pointer=JSON.parse(storage.getItem(key));assert.equal(pointer.activeStorage,ACTIVE_STUDY_STORAGE);assert.ok(storage.getItem(key).length<500);
  assert.deepEqual(await loadActiveStudy(key,{storage,store}),value);
  assert.deepEqual(await loadActiveStudy(key,{storage,store}),value,'Restoring again does not regenerate frozen records.');
});

test('Many granular pointer updates serialize only their latest pending draft and retain every integer position',async()=>{
  const storage=local(),store=database(),writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000});
  let calls=0,current=snapshot(0);const pending=[];
  for(let value=0;value<=100;value++){current=snapshot(value);pending.push(writer.save(()=>{calls++;return text(current);}));}
  assert.equal(calls,0);await writer.flush();assert.equal(calls,1);assert.ok((await Promise.all(pending)).every(Boolean));
  assert.equal((await loadActiveStudy(key,{storage,store})).answers['journey-001'].positions.one,100);
  for(const value of [1,37,63,99]){current=snapshot(value);const saved=writer.save(()=>text(current));await writer.flush();assert.equal(await saved,true);assert.equal((await loadActiveStudy(key,{storage,store})).answers['journey-001'].positions.one,value);}
  assert.equal(store.values.size,1,'Only the last referenced active snapshot remains.');
});

test('A later draft cannot overtake an in-flight write and stale completions cannot overwrite it',async()=>{
  const storage=local(),store=database(),put=store.put,pending=[];
  store.put=(id,value)=>new Promise(resolve=>pending.push(async()=>{await put(id,value);resolve();}));
  const writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000});
  const first=writer.save(text(snapshot(14)));const flushing=writer.flush();await Promise.resolve();
  const second=writer.save(text(snapshot(86)));assert.equal(pending.length,1,'The second transaction has not started early.');
  await pending.shift()();await first;await Promise.resolve();assert.equal(pending.length,1);
  await pending.shift()();assert.equal(await second,true);assert.equal(await flushing,true);
  assert.equal((await loadActiveStudy(key,{storage,store})).answers['journey-001'].positions.one,86);
});

test('Database and reference-quota failures both retain the previous committed full snapshot',async()=>{
  const storage=local(),store=database(),writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000});
  writer.save(text(snapshot(28)));await writer.flush();const committed=storage.getItem(key),put=store.put;
  store.put=async()=>{throw Error('database quota');};const failed=writer.save(text(snapshot(90)));await writer.flush();assert.equal(await failed,false);assert.equal(storage.getItem(key),committed);
  assert.equal((await loadActiveStudy(key,{storage,store})).answers['journey-001'].positions.one,28);
  store.put=put;const set=storage.setItem;storage.setItem=()=>{throw Error('local reference quota');};const refused=writer.save(text(snapshot(91)));await writer.flush();assert.equal(await refused,false);assert.equal(storage.getItem(key),committed);storage.setItem=set;
  assert.equal((await loadActiveStudy(key,{storage,store})).answers['journey-001'].positions.one,28);
  assert.equal(store.values.size,1,'A failed reference commit leaves no orphaned candidate snapshot.');
});

test('Clearing while a database write is pending cannot resurrect erased local data',async()=>{
  const storage=local(),store=database(),put=store.put;let release;
  store.put=(id,value)=>new Promise(resolve=>{release=async()=>{await put(id,value);resolve();};});
  const writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000});
  const first=writer.save(text(snapshot(73)));const flushing=writer.flush();await Promise.resolve();const clearing=writer.clear();
  await release();assert.equal(await first,false);await clearing;await flushing;assert.equal(storage.getItem(key),null);assert.equal(store.values.size,0);
});

test('Legacy inline studies stay readable, while missing or mismatched database identities fail closed',async()=>{
  const storage=local(),store=database(),value=snapshot();storage.setItem(key,text(value));assert.deepEqual(await loadActiveStudy(key,{storage,store}),value);
  const pointer={activeStorage:ACTIVE_STUDY_STORAGE,storageKey:key,id:'active:'+key+':missing',sessionId:value.manifest.id};storage.setItem(key,text(pointer));await assert.rejects(loadActiveStudy(key,{storage,store}),/retained/);assert.equal(storage.getItem(key),text(pointer));
  await store.put(pointer.id,{activeStorage:ACTIVE_STUDY_STORAGE,storageKey:key,serialized:text({...value,manifest:{id:'different'}})});await assert.rejects(loadActiveStudy(key,{storage,store}),/identity/);
  const malformed={activeStorage:ACTIVE_STUDY_STORAGE,storageKey:key,id:'an-archive-id'};storage.setItem(key,text(malformed));await assert.rejects(loadActiveStudy(key,{storage,store}),/retained/);
  storage.setItem(key,text({...pointer,activeStorage:'unsupported-future-format'}));await assert.rejects(loadActiveStudy(key,{storage,store}),/unsupported/);
});

test('A failed old transaction after clear cannot report a failure against the new empty study',async()=>{
  const storage=local(),store=database();let reject,errors=0;store.put=()=>new Promise((_,failed)=>{reject=failed;});
  const writer=createActiveStudyPersistence({storageKey:key,storage,store,external:true,delay:10000,onError:()=>errors++}),saved=writer.save(text(snapshot()));const flushing=writer.flush();await Promise.resolve();const cleared=writer.clear();reject(Error('Old write failed after clear'));await cleared;await flushing;assert.equal(await saved,false);assert.equal(errors,0);assert.equal(storage.getItem(key),null);
});
