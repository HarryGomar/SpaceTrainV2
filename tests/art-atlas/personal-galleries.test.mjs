import {museumLibraryOrder} from '../../public/art-atlas/curation-priority.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {PERSONAL_GALLERIES_KEY,PERSONAL_GALLERIES_PROTOCOL,PERSONAL_ROOM_SLOTS,emptyPersonalGalleries,readPersonalGalleries,validPersonalGalleries,personalWorkSnapshot,personalGalleryWorkIds,addPersonalGallery,renamePersonalGallery,addPersonalRoom,movePersonalRoom,renamePersonalRoom,removePersonalRoom,personalRoomPositions,placePersonalWork,removePersonalWork,resolvePersonalWork,personalGallerySearch,extractQuizGalleries,personalMuseumConnections} from '../../public/art-atlas/personal-galleries.mjs';
import {createPersonalGalleries} from '../../public/art-atlas/galleries.mjs';
import {createGalleryRecord,gallerySlots,placePainting} from '../../public/art-atlas/gallery-model.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const works=Array.from({length:16},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,date:String(1800+i),museum:'Museum '+i,movement:'Movement '+i,image:'assets/art/painting-'+i+'.jpg',sourceUrl:'https://museum.example/objects/'+i,width:600,height:500,rights:'Public domain',credit:'Source collection',analysis:{yearRange:[1800+i,1800+i]}}));
const book=()=>addPersonalGallery(emptyPersonalGalleries(),{galleryId:'g',roomId:'r',title:'My gallery',now:1}).state;
function hang(state,workId='w0',roomId='r',slot='north-left'){const result=placePersonalWork(state,'g',roomId,slot,workId,works,{now:3});assert.ok(result.ok,result.message);return result.state;}
const saved=state=>state.galleries[0];
function reviewed(work,tags){work.analysis.curatorialFacets={version:'curatorial-facets-v1',reviewed:true,tags,sourceUrls:[work.sourceUrl],reviewedImage:work.image,reviewedImageSha256:'1'.repeat(64)};}

test('Galleries and real rooms can be created, named and independently retained without quiz protocols',()=>{
  const initial=emptyPersonalGalleries(),first=book(),before=structuredClone(first),added=addPersonalRoom(first,'g',{roomId:'r2',roomName:'Blue & gold',now:2});assert.ok(added.ok);assert.deepEqual(first,before);let state=renamePersonalRoom(added.state,'g','r2','A quiet room',3).state;state=renamePersonalGallery(state,'g','A small museum',4).state;state=addPersonalGallery(state,{galleryId:'g2',roomId:'r3',now:5}).state;assert.equal(state.galleries.length,2);assert.equal(state.galleries[0].rooms.length,2);assert.equal(state.galleries[0].rooms[1].name,'A quiet room');assert.equal(state.protocol,PERSONAL_GALLERIES_PROTOCOL);assert.equal(state.galleries[0].kind,undefined);assert.deepEqual(initial,emptyPersonalGalleries());assert.ok(validPersonalGalleries(state));
});

test('An occupied room cannot be removed; the last empty room can be removed and replaced',()=>{
  const state=hang(book()),before=structuredClone(state),rejected=removePersonalRoom(state,'g','r',5);assert.equal(rejected.ok,false);assert.deepEqual(state,before);const empty=removePersonalWork(state,'g','w0',6).state,removed=removePersonalRoom(empty,'g','r',7);assert.ok(removed.ok);assert.deepEqual(saved(removed.state).rooms,[]);const added=addPersonalRoom(removed.state,'g',{roomId:'replacement',now:8});assert.ok(added.ok);assert.equal(saved(added.state).rooms[0].id,'replacement');
});

test('Legacy rooms have positions, and swapping or removing them preserves the other rooms and wall art',()=>{
  const state=hang(addPersonalRoom(book(),'g',{roomId:'r2',now:2}).state);
  delete saved(state).floorPlan;
  const legacy=readPersonalGalleries(JSON.stringify(state)),before=structuredClone(state);
  assert.deepEqual(legacy.state,state);
  const positions=personalRoomPositions(saved(legacy.state));
  const change=movePersonalRoom(legacy.state,'g','r2',positions.r,4);
  assert.ok(change.ok);
  assert.equal(change.swappedRoomId,'r');
  assert.deepEqual(saved(change.state).floorPlan,{r:positions.r2,r2:positions.r});
  assert.deepEqual(saved(change.state).rooms,saved(state).rooms);
  assert.deepEqual(saved(change.state).workSnapshots,saved(state).workSnapshots);
  assert.deepEqual(legacy.state,before);
  assert.deepEqual(readPersonalGalleries(JSON.stringify(change.state)).state,change.state);
  const invalid=movePersonalRoom(change.state,'g','r2',{column:-1,row:0},5);
  assert.equal(invalid.ok,false);
  assert.equal(invalid.state,change.state);
  const removed=removePersonalRoom(change.state,'g','r2',6);
  assert.ok(removed.ok);
  assert.deepEqual(saved(removed.state).floorPlan,{r:positions.r2});
});

test('Click placement, moves between rooms and swaps preserve exactly one instance per gallery',()=>{
  let state=addPersonalRoom(book(),'g',{roomId:'r2',now:2}).state;state=hang(state,'w0');state=hang(state,'w1','r','north-right');state=hang(state,'w0','r2','south-left');assert.equal(saved(state).rooms[0].layout['north-left'],undefined);assert.equal(saved(state).rooms[1].layout['south-left'],'w0');state=hang(state,'w0','r','north-right');assert.equal(saved(state).rooms[0].layout['north-right'],'w0');assert.equal(saved(state).rooms[1].layout['south-left'],'w1');assert.deepEqual(personalGalleryWorkIds(saved(state)).sort(),['w0','w1']);assert.ok(validPersonalGalleries(state));
});

test('A new library painting cannot silently replace an occupied wall space',()=>{
  const state=hang(book()),result=placePersonalWork(state,'g','r','north-left','w1',works,{now:4});assert.equal(result.ok,false);assert.deepEqual(result.state,state);assert.equal(saved(state).rooms[0].layout['north-left'],'w0');assert.equal(saved(state).workSnapshots.w1,undefined);
});

test('Saved artwork source, rights and identity survive catalogue growth and conflicting replacements',()=>{
  const state=hang(book()),gallery=saved(state),snapshot=structuredClone(gallery.workSnapshots.w0),changed=structuredClone(works);changed[0].title='Different work';changed[0].sourceUrl='https://museum.example/different';assert.deepEqual(resolvePersonalWork(gallery,'w0',changed),{work:snapshot,unavailable:true,fromSnapshot:true});assert.deepEqual(resolvePersonalWork(gallery,'w0',[]),{work:snapshot,unavailable:false,fromSnapshot:true});assert.equal(gallery.workSnapshots.w0.rights,'Public domain');assert.deepEqual(readPersonalGalleries(JSON.stringify(state)).state,state);assert.equal(gallery.workSnapshots.w0.title,'Painting 0');
});

test('Malformed store data fails closed with its original bytes retained',()=>{
  for(const raw of ['{bad',JSON.stringify({protocol:'open-gallery-v1',version:2,galleries:[]}),JSON.stringify({...book(),version:99})]){const result=readPersonalGalleries(raw);assert.equal(result.ok,false);assert.equal(result.state,null);assert.equal(result.unreadableSource,raw);}
  for(const mutate of [s=>saved(s).rooms[0].layout.bad='w0',s=>saved(s).rooms.push(structuredClone(saved(s).rooms[0])),s=>saved(s).workSnapshots.w0.width='12" onerror="bad',s=>saved(s).workSnapshots.w0.image='../outside.jpg',s=>saved(s).workSnapshots.w0.sourceUrl='javascript:alert(1)',s=>saved(s).workSnapshots.w0.imageLarge='https://remote.example/img.jpg',s=>saved(s).updatedAt=0]){const state=hang(book());mutate(state);assert.equal(validPersonalGalleries(state),false);assert.equal(readPersonalGalleries(JSON.stringify(state)).ok,false);}
});

test('Unknown, duplicate or invalid source identities cannot be placed, and no wall slot is invented',()=>{
  const state=book();assert.equal(placePersonalWork(state,'g','r','north-left','unknown',works).ok,false);assert.equal(placePersonalWork(state,'g','r','ceiling','w0',works).ok,false);assert.equal(placePersonalWork(state,'g','r','north-left','w0',[works[0],structuredClone(works[0])]).ok,false);assert.equal(PERSONAL_ROOM_SLOTS.length,8);assert.equal(new Set(PERSONAL_ROOM_SLOTS.map(slot=>slot.id)).size,8);assert.equal(addPersonalGallery(state,{now:null}).ok,false);
});

test('The full sourced collection is available, including international artist and country searches',()=>{
  assert.equal(actual.filter(work=>personalWorkSnapshot(work)).length,actual.length);assert.ok(personalGallerySearch(actual,'Varo').some(work=>work.id==='add-varo-harmony'));assert.ok(personalGallerySearch(actual,'mexico').length>=20);assert.ok(personalGallerySearch(actual,'Velasco').some(work=>work.id==='velasco-valley-mexico'));assert.deepEqual(personalGallerySearch(actual,'not-an-artist-xyz'),[]);assert.ok(personalGallerySearch(actual,'TAMAYO').length);
});

test('Museum connections rank direct selected holdings before static order or sampled themes',()=>{
  const pool=structuredClone(works);for(const i of [0,1,2])pool[i].museum='Prado';pool[3].museum='Earlier listed museum';const results=personalMuseumConnections(pool.slice(0,4),[pool[3],...pool.slice(0,3)],[]);assert.equal(results[0].name,'Prado');assert.deepEqual(results[0].heldWorkIds,['w0','w1','w2']);assert.equal(results[0].basis,'Paintings in this collection');assert.ok(results[0].sourceUrls.includes(pool[0].sourceUrl));assert.equal('score' in results[0],false);assert.equal('percentage' in results[0],false);assert.match(results[0].limits.join(' '),/not a search of every museum/);assert.match(results[0].limits.join(' '),/currently on display/);
});

test('An artist represented in a collection is not presented as ownership of the selected painting',()=>{
  const work={...works[0],artist:'Claude Monet',museum:'Private collection'},fact={id:'museum',name:'A sourced museum',artists:['Claude Monet'],sourceUrl:'https://museum.example/monet',visitUrl:'https://museum.example/'};const result=personalMuseumConnections([work],[],[fact]);assert.equal(result.length,1);assert.equal(result[0].basis,'Artists represented here');assert.deepEqual(result[0].heldWorkIds,[]);assert.deepEqual(result[0].artistWorkIds,['w0']);assert.equal(result[0].sourceUrl,fact.sourceUrl);assert.deepEqual(personalMuseumConnections([{...work,artistKnown:false}],[],[fact]),[]);
});

test('Sampled collection themes require multiple actual paintings on both sides and do not invent missing tags',()=>{
  const pool=structuredClone(works);for(const i of [0,1,4,5]){pool[i].movement='Unknown';reviewed(pool[i],['imagined-world','narrative-detail']);}pool[0].museum='Private collection';pool[1].museum='Private collection';pool[4].museum='A museum';pool[5].museum='A museum';const selected=pool.slice(0,2),library=pool.slice(4,6),result=personalMuseumConnections(selected,library,[]);assert.equal(result.length,1);assert.equal(result[0].basis,'Connections in our collection sample');assert.equal(result[0].themePairs.length,2);assert.equal(new Set(result[0].catalogueWorkIds).size,2);assert.deepEqual(result[0].heldWorkIds,[]);assert.equal(result[0].coverage.institutionWorksInLibrary,2);
  delete pool[0].analysis.curatorialFacets;assert.deepEqual(personalMuseumConnections(selected,library,[]),[]);assert.deepEqual(personalMuseumConnections([pool[1],pool[1]],library,[]),[]);
});

function quizFixture(){
  const catalogue=structuredClone(actual);let record=createGalleryRecord(catalogue,{}, {id:'saved-museum',now:1});for(let i=0;i<6;i++){const slot=gallerySlots(record).find(slot=>slot.roomId===(i<3?'g1':'g3'));record=placePainting(record,catalogue[i].id,slot.wallId,slot.t).record;}record.roomNames.g1='Light and space';record.phase='walkthrough';record.roomResponses={entryId:catalogue[0].id,lingerRoomId:'g3',bridgeIds:[catalogue[0].id,catalogue[3].id]};record.confirmed=true;record.finishedAt=2;const roundId='journey-036',session={manifest:{id:'profile-original',createdAt:1,catalogue},shown:{[roundId]:{id:roundId,kind:'exercise',exerciseKind:'curate',workIds:[...record.offeredIds]}},answers:{[roundId]:{workIds:[...record.offeredIds],record}}};return {session,record,roundId};
}
test('Completed quiz rooms stay read-only and use only the actual captured catalogue',()=>{
  const {session,record}=quizFixture(),before=structuredClone(session),result=extractQuizGalleries([session]);assert.equal(result.galleries.length,1);const gallery=result.galleries[0];assert.equal(gallery.quiz,true);assert.equal(gallery.rooms[0].name,'Light and space');assert.deepEqual(gallery.rooms[0].workIds,session.manifest.catalogue.slice(0,3).map(work=>work.id));assert.deepEqual(gallery.sourceRecord,record);assert.deepEqual(gallery.workSnapshots[session.manifest.catalogue[0].id].title,session.manifest.catalogue[0].title);assert.deepEqual(session,before);
  const altered=structuredClone(actual);altered[0].title='A replacement';assert.equal(resolvePersonalWork(gallery,altered[0].id,altered).unavailable,true);assert.equal(gallery.workSnapshots[altered[0].id].title,before.manifest.catalogue[0].title);
});

test('Unconfirmed, conflicting or incomplete historical room sources cannot be replaced with current library data',()=>{
  for(const mutate of [s=>s.answers['journey-036'].record.confirmed=false,s=>s.answers['journey-036'].workIds.reverse(),s=>s.shown['journey-036'].workIds=['unknown'],s=>s.shown['journey-036'].kind='spectrum',s=>s.shown['journey-036'].exerciseKind='sorting',s=>s.shown['journey-036'].id='another-round',s=>s.manifest.catalogue.pop()]){const {session}=quizFixture();mutate(session);assert.deepEqual(extractQuizGalleries([session]).galleries,[]);}const {session}=quizFixture();assert.deepEqual(extractQuizGalleries([session,structuredClone(session)]).galleries,[]);
});

function uiFixture({raw=null,quizSessions=[],storageFails=false}={}){
  const dom=new JSDOM('<!doctype html><main id="test-galleries"></main>',{url:'https://art.example/galleries.html',pretendToBeVisual:true}),values=new Map([['art-profile-journey-v1','original quiz bytes'],...(raw===null?[]:[[PERSONAL_GALLERIES_KEY,raw]])]),writes=[],storage={getItem:key=>values.get(key)??null,setItem(key,value){if(storageFails)throw Error('Quota');values.set(key,value);writes.push(key);}},app=dom.window.document.querySelector('main');
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const ui=createPersonalGalleries({app,works:actual,storage,quizSessions,now:()=>10});
  const click=selector=>{const element=app.querySelector(selector);assert.ok(element,selector);element.click();},change=(id,value)=>{const input=app.querySelector('#'+id);assert.ok(input,id);input.value=value;input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};return {dom,app,ui,values,writes,storage,click,change,close(){ui.dispose();dom.window.close();}};
}

test('The standalone editor creates, renames, places and auto-selects the next painting without writing quiz storage',()=>{
  const f=uiFixture();try{f.click('[data-action=pg-new]');f.change('pg-gallery-name','An evening room');f.change('pg-room-name','Night paintings');const first=museumLibraryOrder(actual)[0].id;f.click('[data-action=pg-select][data-work="'+first+'"]');f.click('[data-action=pg-place][data-slot=north-left]');const state=f.ui.getState(),g=state.galleries[0];assert.equal(g.title,'An evening room');assert.equal(g.rooms[0].name,'Night paintings');assert.equal(g.rooms[0].layout['north-left'],first);assert.equal(f.app.querySelector('.pg-library-work[aria-pressed=true]').dataset.work,museumLibraryOrder(actual)[1].id);assert.ok(f.writes.length);assert.ok(f.writes.every(key=>key===PERSONAL_GALLERIES_KEY));assert.equal(f.values.get('art-profile-journey-v1'),'original quiz bytes');assert.ok(validPersonalGalleries(JSON.parse(f.values.get(PERSONAL_GALLERIES_KEY))));
    const reload=uiFixture({raw:f.values.get(PERSONAL_GALLERIES_KEY)});try{assert.match(reload.app.textContent,/An evening room/);assert.deepEqual(reload.ui.getState(),state);}finally{reload.close();}
  }finally{f.close();}
});

test('Room editing, moving across rooms and undo are genuine persistent actions',()=>{
  const f=uiFixture();try{f.click('[data-action=pg-new]');f.click('[data-action=pg-place][data-slot=north-left]');const first=f.ui.getState().galleries[0].rooms[0].id;f.click('[data-action=pg-add-room]');const second=f.ui.getState().galleries[0].rooms[1].id;assert.notEqual(first,second);f.click('[data-action=pg-select][data-work="'+museumLibraryOrder(actual)[0].id+'"]');f.click('[data-action=pg-place][data-slot=south-left]');let g=f.ui.getState().galleries[0];assert.equal(g.rooms[0].layout['north-left'],undefined);assert.equal(g.rooms[1].layout['south-left'],museumLibraryOrder(actual)[0].id);assert.equal(f.app.querySelector('[data-action=pg-remove-room]').disabled,true);f.click('[data-action=pg-undo]');g=f.ui.getState().galleries[0];assert.equal(g.rooms[0].layout['north-left'],museumLibraryOrder(actual)[0].id);assert.equal(g.rooms[1].layout['south-left'],undefined);f.click('[data-action=pg-remove-room]');assert.equal(f.ui.getState().galleries[0].rooms.length,1);}finally{f.close();}
});

test('The floor plan moves rooms by keyboard and button, keeps Undo, and restores the layout after reload',()=>{
  const f=uiFixture();
  try{
    f.click('[data-action=pg-new]');
    f.click('[data-action=pg-place][data-slot=north-left]');
    f.click('[data-action=pg-show-plan]');
    f.click('[data-action=pg-add-room]');
    const before=f.ui.getState(),[first,second]=saved(before).rooms;
    const firstTile=()=>[...f.app.querySelectorAll('[data-action=pg-plan-room]')].find(button=>button.dataset.room===first.id);
    assert.equal(f.app.querySelectorAll('.pg-plan-door').length,2,'new rooms are adjacent');
    firstTile().focus();
    firstTile().dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    const moved=f.ui.getState(),position=saved(moved).floorPlan[first.id],original=saved(before).floorPlan[first.id];
    assert.deepEqual(position,{column:original.column+1,row:original.row});
    assert.equal(f.dom.window.document.activeElement,firstTile());
    f.click('[data-action=pg-plan-step][data-step=ArrowDown]');
    assert.equal(saved(f.ui.getState()).floorPlan[first.id].row,position.row+1);
    f.click('[data-action=pg-undo]');
    assert.deepEqual(f.ui.getState(),moved);
    assert.equal(saved(moved).rooms[0].layout['north-left'],saved(before).rooms[0].layout['north-left']);
    assert.deepEqual(saved(moved).floorPlan[second.id],saved(before).floorPlan[second.id]);

    const reload=uiFixture({raw:f.values.get(PERSONAL_GALLERIES_KEY)});
    try{
      reload.click('[data-action=pg-open]');
      reload.click('[data-action=pg-show-plan]');
      assert.deepEqual(reload.ui.getState(),moved);
      reload.click('.pg-plan-actions [data-action=pg-show-walls]');
      assert.equal(reload.app.querySelector('.pg-slot[data-slot=north-left]').classList.contains('occupied'),true);
      assert.deepEqual(reload.writes,[]);
    }finally{reload.close();}
  }finally{f.close();}
});

test('Quiz gallery browsing never rewrites its source or the separate personal store',()=>{
  const {session}=quizFixture(),before=structuredClone(session),f=uiFixture({quizSessions:[session]});try{f.click('[data-action=pg-quiz-index]');f.click('[data-action=pg-open-quiz]');assert.match(f.app.textContent,/Light and space/);assert.equal(f.app.querySelector('[data-action=pg-add-room]'),null);assert.equal(f.app.querySelector('[data-action=pg-place]'),null);assert.equal(f.app.querySelector('#pg-room-name'),null);f.click('[data-action=pg-quiz-room][data-room=g3]');assert.equal(f.app.querySelectorAll('.pg-quiz-paintings figure').length,3);assert.deepEqual(f.writes,[]);assert.deepEqual(session,before);}finally{f.close();}
});

test('Malformed saved data is not overwritten, and a storage failure is reported without touching the quiz',()=>{
  const f=uiFixture({raw:'{unreadable'});try{f.click('[data-action=pg-new]');assert.equal(f.ui.getState().galleries.length,1);assert.equal(f.values.get(PERSONAL_GALLERIES_KEY),'{unreadable');assert.deepEqual(f.writes,[]);assert.ok(f.app.querySelector('[data-action=pg-download-original]'));}finally{f.close();}
  const quota=uiFixture({storageFails:true});try{quota.click('[data-action=pg-new]');assert.match(quota.app.textContent,/could not be saved/);assert.equal(quota.values.get('art-profile-journey-v1'),'original quiz bytes');}finally{quota.close();}
});

test('Gallery names are text and image failure preserves the artwork dialog source and close control',()=>{
  const f=uiFixture();try{f.click('[data-action=pg-new]');const title='<img src=x onerror=alert(1)>';f.change('pg-gallery-name',title);assert.equal(f.app.querySelector('#pg-gallery-name').value,title);assert.equal(f.app.querySelector('[onerror]'),null);f.click('.pg-selected-art');const dialog=f.app.querySelector('#pg-art-dialog');assert.equal(dialog.open,true);dialog.querySelector('img').dispatchEvent(new f.dom.window.Event('error'));assert.ok(dialog.querySelector('[data-action=pg-close-art]'));assert.equal(dialog.querySelector('a').getAttribute('href'),museumLibraryOrder(actual)[0].sourceUrl);assert.equal(dialog.querySelector('.pg-art-error').hidden,false);}finally{f.close();}
});
