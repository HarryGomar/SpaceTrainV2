import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {withContinuousPreference,CONTINUOUS_PROTOCOL} from '../../public/art-atlas/continuous-preference.mjs';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {ACTIVE_STUDY_STORAGE,loadActiveStudy} from '../../public/art-atlas/active-study-storage.mjs';
import {COLLECTION_STORAGE_KEY,COLLECTION_STUDY_KEY,collectionRecord,savedPaintingIds,quizCollectionChoices,quizCollectionChoicesFromStudy,addSavedPaintings,toggleSavedPainting,resetSavedPaintings,undoSavedPaintingReset} from '../../public/art-atlas/collection-controls.mjs';

const works=Array.from({length:4},(_,i)=>({id:'collection-'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/collection-'+i+'.jpg',sourceUrl:'https://museum.example/'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
const ids=round=>round.works.map(work=>work.id);
function fixture(){
  const preference=withContinuousPreference({id:'journey-001',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}),favourites={id:'journey-046',kind:'choice-grid',selectionMode:'shortlist',maxChoices:4,allowUnsure:true,title:'Your favourites',hint:'Choose your favourites',works,evidence:{construct:'overall-favourites',explicitFavourites:true,anchorComparisonProtocol:CONTINUOUS_PROTOCOL}},dislikes={...structuredClone(favourites),id:'journey-049',evidence:{construct:'overall-dislikes',explicitDislikes:true,anchorComparisonProtocol:CONTINUOUS_PROTOCOL}};
  const rounds=[preference,favourites,dislikes],answers={
    [preference.id]:{workIds:ids(preference),criterion:'preference',positions:{'collection-0':20,'collection-1':90,'collection-2':60,'collection-3':50},confirmed:true},
    [favourites.id]:{workIds:ids(favourites),selectionMode:'shortlist',selectedIds:['collection-0'],explicitNone:false,unsure:false,confirmed:true},
    [dislikes.id]:{workIds:ids(dislikes),selectionMode:'shortlist',selectedIds:['collection-1'],explicitNone:false,unsure:false,confirmed:true}
  };
  const snapshots=rounds.map(({works,...round})=>({...round,workIds:works.map(work=>work.id)}));
  return {rounds,answers,study:{manifest:{protocol:'art-profile-50-v1',id:'synthetic-collection-study',catalogue:structuredClone(works)},plan:snapshots,shown:Object.fromEntries([...snapshots].reverse().map(round=>[round.id,round])),answers:structuredClone(answers)}};
}

test('Collection likes use current anchored responses and explicit declarations, never a historical rank',()=>{
  const f=fixture(),before=structuredClone(f),choices=quizCollectionChoices({works,...f});
  assert.deepEqual(choices.favouriteIds,['collection-0']);assert.deepEqual(choices.likedIds,['collection-0','collection-2']);assert.deepEqual(f,before);
  const ordinal=withComparisonPreference({id:'old-rank',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}),answer={workIds:ids(ordinal),criterion:'preference',positions:{'collection-0':100,'collection-1':90,'collection-2':10,'collection-3':0},confirmed:true};
  assert.deepEqual(quizCollectionChoices({works,rounds:[ordinal],answers:{[ordinal.id]:answer}}).likedIds,[]);
  const repeat={...structuredClone(f.rounds[0]),id:'later-appeal',evidence:{...f.rounds[0].evidence,repeatOf:f.rounds[0].id,role:'repeat'}},later={...structuredClone(f.answers[f.rounds[0].id]),positions:{'collection-0':20,'collection-1':90,'collection-2':50,'collection-3':51}};
  assert.deepEqual(quizCollectionChoices({works,rounds:[...f.rounds,repeat],answers:{...f.answers,[repeat.id]:later}}).likedIds,['collection-0','collection-3']);
});

test('Collection candidates come from frozen shown questions in plan order without upgrading the quiz',()=>{
  const f=fixture(),before=structuredClone(f.study);assert.deepEqual(quizCollectionChoicesFromStudy(f.study).likedIds,['collection-0','collection-2']);assert.deepEqual(f.study,before);
  const unseen=structuredClone(f.study);unseen.shown={};assert.deepEqual(quizCollectionChoicesFromStudy(unseen).likedIds,[]);
  const swapped=structuredClone(f.study);swapped.shown['journey-001'].works=structuredClone(works);swapped.shown['journey-001'].works[0].image='assets/different.jpg';assert.deepEqual(quizCollectionChoicesFromStudy(swapped).likedIds,[]);
  const unsure=structuredClone(f.study);unsure.answers['journey-049']={...unsure.answers['journey-049'],selectedIds:[],unsure:true};assert.deepEqual(quizCollectionChoicesFromStudy(unsure).likedIds,['collection-0','collection-1','collection-2']);
});

test('The saved-study pointer is read through IndexedDB without modifying its reference or private source',async()=>{
  const f=fixture(),serialized=JSON.stringify(f.study),pointer={activeStorage:ACTIVE_STUDY_STORAGE,storageKey:COLLECTION_STUDY_KEY,id:'active:'+COLLECTION_STUDY_KEY+':test',sessionId:f.study.manifest.id},storage={getItem:()=>JSON.stringify(pointer)},store={async get(id){assert.equal(id,pointer.id);return {activeStorage:ACTIVE_STUDY_STORAGE,storageKey:COLLECTION_STUDY_KEY,serialized};}};
  const saved=await loadActiveStudy(COLLECTION_STUDY_KEY,{storage,store});assert.deepEqual(quizCollectionChoicesFromStudy(saved).favouriteIds,['collection-0']);assert.equal(JSON.stringify(saved),serialized);assert.equal(storage.getItem(),JSON.stringify(pointer));
});

test('Adding quiz paintings preserves existing purposes, dates, sessions and unknown collection data',()=>{
  const original={version:1,saved:{'collection-0':{study:true,addedAt:12,note:'Keep this annotation'},'not-in-the-current-catalogue':{look:true,custom:true}},sessions:[{schema:'older-format',answers:{preserved:true}}],customSetting:{keep:'yes'}},before=structuredClone(original),result=addSavedPaintings(original,['collection-0','collection-2','collection-2'],{now:50});
  assert.deepEqual(result.saved['collection-0'],{study:true,look:true,addedAt:12,note:'Keep this annotation'});assert.equal(result.saved['collection-2'].addedAt,50);assert.deepEqual(result.sessions,original.sessions);assert.deepEqual(result.customSetting,original.customSetting);assert.deepEqual(result.saved['not-in-the-current-catalogue'],original.saved['not-in-the-current-catalogue']);assert.deepEqual(original,before);
  assert.throws(()=>collectionRecord({version:2,saved:{}}),/retained/);assert.throws(()=>collectionRecord({version:1,saved:[]}),/retained/);
});

test('Reset undo merges with the latest saves and fields instead of replacing newer collection changes',()=>{
  const original={version:1,saved:{'collection-0':{study:true,addedAt:1,note:'old'},'collection-1':{look:true,addedAt:2}},sessions:[{id:'before'}],other:'before'},reset=resetSavedPaintings(original);
  assert.deepEqual(reset.collection.saved,{});const latest=addSavedPaintings(reset.collection,['collection-0','collection-2'],{now:5});latest.saved['collection-0'].note='new';latest.sessions.push({id:'after'});latest.other='after';const restored=undoSavedPaintingReset(latest,reset.previousSaved);
  assert.equal(restored.saved['collection-0'].look,true);assert.equal(restored.saved['collection-0'].study,true);assert.equal(restored.saved['collection-0'].note,'new');assert.equal(restored.saved['collection-0'].addedAt,5);assert.deepEqual(savedPaintingIds(restored).sort(),['collection-0','collection-1','collection-2']);assert.deepEqual(restored.sessions,latest.sessions);assert.equal(restored.other,'after');assert.equal(original.saved['collection-0'].look,undefined);
  const unlooked=toggleSavedPainting(restored,'collection-0');assert.equal(unlooked.saved['collection-0'].look,false);assert.equal(unlooked.saved['collection-0'].study,true);assert.equal(unlooked.saved['collection-0'].note,'new');assert.equal(toggleSavedPainting(unlooked,'collection-0','study').saved['collection-0'],undefined);
});

test('The Paintings page exposes both additions, individual Keep, Saved, reset and a merging undo without editing answers',async()=>{
  const f=fixture(),dom=new JSDOM('<main id="painting-gallery"></main><dialog id="painting-view"><div class="pg-dialog-caption"><div></div></div></dialog>',{url:'https://art-atlas.example/art-atlas/paintings.html'}),win=dom.window,keys=['document','window','location','history','localStorage','requestAnimationFrame','fetch'],previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  win.localStorage.setItem(COLLECTION_STUDY_KEY,JSON.stringify(f.study));win.localStorage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify({version:1,saved:{'collection-3':{study:true,addedAt:1}},sessions:[{id:'retained-session',privateData:'synthetic'}],custom:'retained'}));
  const studyBefore=win.localStorage.getItem(COLLECTION_STUDY_KEY),settle=()=>new Promise(resolve=>setImmediate(resolve)),read=()=>JSON.parse(win.localStorage.getItem(COLLECTION_STORAGE_KEY));
  try{
    for(const [key,value]of Object.entries({document:win.document,window:win,location:win.location,history:win.history,localStorage:win.localStorage,requestAnimationFrame:()=>1,fetch:async()=>({ok:true,json:async()=>structuredClone(works)})}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    await import('../../public/art-atlas/painting-gallery.mjs?collection-controls-test');
    const button=action=>win.document.querySelector('[data-collection-action="'+action+'"]');assert.match(button('add-favourites').textContent,/Add quiz favourites/);assert.match(button('add-liked').textContent,/Add paintings you liked/);
    button('add-favourites').click();await settle();assert.equal(read().saved['collection-0'].look,true);assert.equal(read().saved['collection-2'],undefined);
    const concurrent=read();concurrent.sessions.push({id:'newer-session'});concurrent.extra='newer';win.localStorage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify(concurrent));
    button('add-liked').click();await settle();assert.equal(read().saved['collection-2'].look,true);assert.equal(read().saved['collection-1'],undefined);assert.equal(read().extra,'newer');assert.equal(read().sessions.length,2);
    button('reset').click();await settle();assert.deepEqual(read().saved,{});assert.equal(button('undo').hidden,false);
    win.document.querySelector('[data-gallery-view="all"]').click();win.document.querySelector('[data-keep-painting="collection-1"]').click();await settle();assert.equal(read().saved['collection-1'].look,true);
    button('undo').click();await settle();assert.deepEqual(savedPaintingIds(read()).sort(),works.map(work=>work.id));assert.equal(read().saved['collection-3'].study,true);assert.equal(read().saved['collection-3'].look,undefined);
    win.document.querySelector('[data-gallery-view="saved"]').click();assert.equal(win.document.querySelectorAll('.pg-work').length,4);assert.equal(win.localStorage.getItem(COLLECTION_STUDY_KEY),studyBefore);assert.equal(read().custom,'retained');assert.equal(read().sessions.length,2);
  }finally{for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}win.close();}
});
