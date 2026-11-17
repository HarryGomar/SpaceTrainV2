import {PERSONAL_GALLERIES_KEY,PERSONAL_ROOM_SLOTS,PERSONAL_FLOOR_GRID,emptyPersonalGalleries,readPersonalGalleries,addPersonalGallery,renamePersonalGallery,addPersonalRoom,movePersonalRoom,renamePersonalRoom,removePersonalRoom,placePersonalWork,removePersonalWork,personalRoomPositions,personalGalleryWorkIds,resolvePersonalWork,personalGallerySearch,extractQuizGalleries,personalMuseumConnections} from './personal-galleries.mjs';
import {artworkImageAttributes,setArtworkImage} from './artwork-image.mjs';
import {updateArtworkCorners} from './artwork-corners.mjs';
import {loadStudyArchives} from './study-archives.mjs';
import {loadActiveStudy} from './active-study-storage.mjs';
import {GALLERY_CONTEXT_KEY,nextGalleryContext} from './painting-gallery-data.mjs';
import {isGallery,ROOMS,WALLS,mountBox} from './gallery-model.mjs';
import {museumLibraryOrder} from './curation-priority.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const short=work=>work?.shortTitle||work?.title||'Unavailable artwork';
const date=value=>Number.isFinite(value)?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
const quizKey='art-profile-journey-v1';
const floorSteps=new Map([
  ['ArrowUp',{column:0,row:-1,side:'north',label:'up',arrow:'↑'}],
  ['ArrowRight',{column:1,row:0,side:'east',label:'right',arrow:'→'}],
  ['ArrowDown',{column:0,row:1,side:'south',label:'down',arrow:'↓'}],
  ['ArrowLeft',{column:-1,row:0,side:'west',label:'left',arrow:'←'}]
]);
const cellKey=cell=>cell.column+':'+cell.row;
const beside=(cell,step)=>({column:cell.column+step.column,row:cell.row+step.row});
const onFloor=cell=>cell.column>=0&&cell.column<PERSONAL_FLOOR_GRID.columns&&cell.row>=0&&cell.row<PERSONAL_FLOOR_GRID.rows;
const cellStyle=cell=>'--plan-column:'+(cell.column+1)+';--plan-row:'+(cell.row+1);

/** The free editor writes only its own store. Quiz sources are supplied read-only. */
export function createPersonalGalleries({app,works,storage,quizSessions=[],now=()=>Date.now()}={}){
  let raw=null,storageAvailable=true;try{raw=storage?.getItem(PERSONAL_GALLERIES_KEY)??null;}catch{storageAvailable=false;}
  const loaded=readPersonalGalleries(raw),quiz=extractQuizGalleries(quizSessions);let state=loaded.ok?loaded.state:emptyPersonalGalleries(),unreadable=!loaded.ok,undo=[],drag=null,roomDrag=null,suppressUntil=0;
  const ui={mode:'index',editorView:'walls',galleryId:null,roomId:null,quizId:null,query:'',page:0,selected:null,scope:'gallery',status:unreadable?'The saved galleries could not be read. Their original data is kept; new galleries can be downloaded from this tab.':storageAvailable?'':'Galleries cannot be saved in this browser. You can still download your work.'};
  const gallery=()=>state.galleries.find(item=>item.id===ui.galleryId),room=()=>gallery()?.rooms.find(item=>item.id===ui.roomId),quizGallery=()=>quiz.galleries.find(item=>item.id===ui.quizId);
  const image=work=>`<img ${artworkImageAttributes(work,{sizes:'auto, (max-width:700px) 22vw, 140px'})} alt="${esc(work.alt||work.title)}" draggable="false">`;
  function savedArt(g,id){const resolved=resolvePersonalWork(g,id,works);return resolved.work&&!resolved.unavailable?resolved.work:null;}
  const library=()=>personalGallerySearch(museumLibraryOrder(works),ui.query);
  function chooseNext(from){const all=library(),used=new Set(personalGalleryWorkIds(gallery())),start=all.findIndex(work=>work.id===from);ui.selected=null;for(let n=1;n<=all.length;n++){const index=(start+n+all.length)%all.length;if(!used.has(all[index].id)){ui.selected=all[index].id;ui.page=Math.floor(index/8);break;}}}
  function persist(){if(unreadable||!storageAvailable)return false;try{storage.setItem(PERSONAL_GALLERIES_KEY,JSON.stringify(state));return true;}catch{storageAvailable=false;ui.status='These changes could not be saved in this browser. Download your galleries to keep them.';return false;}}
  function apply(result,message,{advance=null,recordUndo=true}={}){if(!result.ok){ui.status=result.message;render();return false;}if(recordUndo)undo.push(structuredClone(state));if(undo.length>30)undo.shift();state=result.state;ui.galleryId=result.galleryId||ui.galleryId;if(result.roomId!==undefined)ui.roomId=result.roomId;ui.status=message||'';if(advance)chooseNext(advance);persist();render();return true;}
  function artButton(work,{origin='library',className='',selected=false,draggable=false}={}){
    return `<button type="button" class="pg-art ${className}" data-action="pg-inspect" data-work="${esc(work.id)}" data-origin="${origin}" ${draggable?`data-pg-drag="${esc(work.id)}"`:''} aria-label="View ${esc(short(work))}" aria-pressed="${selected}"><span class="art-visual">${image(work)}</span></button>`;
  }
  function header(){return `<header class="pg-top"><a href="./">← Art Atlas</a><nav aria-label="Explore Art Atlas"><a href="./paintings.html">Paintings</a><a href="./maps.html">Maps</a><a href="./profiles.html">Profiles</a><a href="./account.html">Account saves</a></nav></header>`;}
  function tabs(){return `<nav class="pg-tabs" aria-label="Galleries"><button type="button" data-action="pg-index" aria-pressed="${ui.mode!=='quiz'&&ui.mode!=='quiz-index'}">Your galleries</button><button type="button" data-action="pg-quiz-index" aria-pressed="${ui.mode==='quiz'||ui.mode==='quiz-index'}">Quiz galleries</button></nav>`;}
  function indexMarkup(){
    const isQuiz=ui.mode==='quiz-index',items=isQuiz?quiz.galleries:state.galleries;
    return `<section class="pg-index"><div class="pg-heading"><div><p class="pg-eyebrow">Art Atlas</p><h1>Galleries</h1><p>${isQuiz?'Revisit the rooms you completed in a quiz. The original arrangements stay as you made them.':'Make rooms for paintings you want to see together.'}</p></div>${!isQuiz?'<button type="button" class="pg-primary" data-action="pg-new">Create a gallery <span aria-hidden="true">↗</span></button>':''}</div>${tabs()}${items.length?`<div class="pg-index-list">${items.map(item=>{
      const ids=isQuiz?item.rooms.flatMap(room=>room.workIds):personalGalleryWorkIds(item),preview=ids.slice(0,4),lookup=id=>isQuiz?item.workSnapshots[id]:savedArt(item,id);
      return `<button type="button" class="pg-gallery-row" data-action="${isQuiz?'pg-open-quiz':'pg-open'}" data-gallery="${esc(item.id)}"><span class="pg-gallery-preview">${preview.map(id=>{const work=lookup(id);return work?`<span>${image(work)}</span>`:'<span class="pg-unavailable">Artwork unavailable</span>';}).join('')}${!preview.length?'<span class="pg-empty-preview" aria-hidden="true"><i></i><i></i><i></i><i></i></span>':''}</span><span class="pg-gallery-row-name"><strong>${esc(isQuiz?'Quiz gallery · '+date(item.finishedAt):item.title)}</strong><small>${item.rooms.length} ${item.rooms.length===1?'room':'rooms'} · ${ids.length} ${ids.length===1?'painting':'paintings'}</small></span><span aria-hidden="true">↗</span></button>`;
    }).join('')}</div>`:`<div class="pg-empty"><p>${isQuiz?'Completed quiz rooms will appear here.':'Start with an empty room. Choose a painting, then a space on the wall.'}</p>${isQuiz?'<a href="./">Return to the quiz ↗</a>':''}</div>`}${isQuiz&&quiz.unavailable.length?'<p class="pg-note">Some older quiz galleries could not be opened. Their saved quiz data has not been changed.</p>':''}</section>`;
  }
  function roomNavigation(g,{readonly=false}={}){
    return `<nav class="pg-room-nav" aria-label="Rooms">${g.rooms.map((r,index)=>`<button type="button" data-action="${readonly?'pg-quiz-room':'pg-room'}" data-room="${esc(r.id)}" aria-pressed="${r.id===ui.roomId}"><span class="pg-room-number">${String(index+1).padStart(2,'0')}</span><span>${esc(r.name)}</span><small>${readonly?r.workIds.length:Object.keys(r.layout).length} ${(readonly?r.workIds.length:Object.keys(r.layout).length)===1?'painting':'paintings'}</small></button>`).join('')}${!readonly?'<button type="button" class="pg-add-room" data-action="pg-add-room"><span aria-hidden="true">+</span> Add a room</button>':''}</nav>`;
  }
  function floorMarkup(g,selectedRoom){
    const positions=personalRoomPositions(g),occupied=new Set(Object.values(positions).map(cellKey));
    const tiles=g.rooms.map(r=>{
      const cell=positions[r.id],works=Object.values(r.layout),preview=works.length?savedArt(g,works[0]):null;
      const doors=[...floorSteps.values()].filter(step=>occupied.has(cellKey(beside(cell,step))));
      const count=works.length+(works.length===1?' painting':' paintings');
      return `<button type="button" class="pg-plan-room" data-action="pg-plan-room" data-room="${esc(r.id)}" data-pg-room-drag
        aria-label="${esc(r.name)}, ${count}" aria-pressed="${r===selectedRoom}" style="${cellStyle(cell)}">
        ${doors.map(step=>`<span class="pg-plan-door" data-side="${step.side}" aria-hidden="true"></span>`).join('')}
        ${preview?`<span class="pg-plan-preview" aria-hidden="true">${image(preview)}</span>`:''}
        <span class="pg-plan-room-name">${esc(r.name)}</span>
      </button>`;
    }).join('');
    const selectedCell=positions[selectedRoom?.id];
    const arrows=selectedCell?[...floorSteps].map(([key,step])=>`<button type="button" id="pg-step-${step.side}" data-action="pg-plan-step" data-step="${key}" data-side="${step.side}" aria-label="Move room ${step.label}" ${onFloor(beside(selectedCell,step))?'':'disabled'}>${step.arrow}</button>`).join(''):'';
    const count=Object.keys(selectedRoom?.layout||{}).length;
    return `<section class="pg-floor-plan" aria-label="Floor plan">
      <div class="pg-floor-heading"><p id="pg-floor-instructions">Drag rooms or use the arrows to move them. Drop one onto another to swap.</p><button type="button" class="pg-text pg-floor-add" data-action="pg-add-room"><span aria-hidden="true">+</span> Add a room</button></div>
      <div class="pg-floor-workspace">
        <div class="pg-plan-board" role="group" aria-label="Room positions" aria-describedby="pg-floor-instructions" style="--plan-columns:${PERSONAL_FLOOR_GRID.columns};--plan-rows:${PERSONAL_FLOOR_GRID.rows}">
          <span class="pg-plan-target" hidden aria-hidden="true"></span>${tiles}
          ${tiles?'':'<p class="pg-plan-empty">Add a room to start your floor plan.</p>'}
        </div>
        ${selectedRoom?`<aside class="pg-plan-detail" aria-label="Selected room">
          <div><h2>${esc(selectedRoom.name)}</h2><p>${count} ${count===1?'painting':'paintings'}</p></div>
          <div class="pg-plan-arrows" role="group" aria-label="Move selected room">${arrows}</div>
          <div class="pg-plan-actions"><button type="button" class="pg-primary" data-action="pg-show-walls">Open room <span aria-hidden="true">↗</span></button>
          ${count?'':'<button type="button" class="pg-text" data-action="pg-remove-room">Remove empty room</button>'}</div>
        </aside>`:''}
      </div>
    </section>`;
  }
  function wallMarkup(g,r){
    return `<div class="pg-room-stage" aria-label="${esc(r.name)} floor plan"><div class="pg-room-walls" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="pg-room-centre"><input id="pg-room-name" aria-label="Room name" maxlength="60" value="${esc(r.name)}"><span>${Object.keys(r.layout).length} of 8 wall spaces</span></div>${PERSONAL_ROOM_SLOTS.map(slot=>{
      const workId=r.layout[slot.id],work=workId?savedArt(g,workId):null,selected=workId&&ui.selected===workId;
      return `<button type="button" class="pg-slot ${workId?'occupied':''}" style="--slot-x:${slot.x}%;--slot-y:${slot.y}%" data-action="${workId?'pg-mounted':'pg-place'}" data-slot="${slot.id}" ${workId?`data-work="${esc(workId)}" data-pg-drag="${esc(workId)}"`:''} aria-label="${esc(slot.label+(workId?': '+(work?short(work):'Unavailable painting'):'; place selected painting'))}" aria-pressed="${!!selected}"><span class="art-visual">${work?image(work):workId?'<span class="pg-unavailable">Artwork unavailable</span>':'<span class="pg-slot-add" aria-hidden="true">+</span>'}</span></button>`;
    }).join('')}</div>`;
  }
  function libraryMarkup(g){
    const all=library(),pages=Math.max(1,Math.ceil(all.length/8));ui.page=Math.max(0,Math.min(pages-1,ui.page));const visible=all.slice(ui.page*8,ui.page*8+8),used=new Set(personalGalleryWorkIds(g)),selected=ui.selected?(Object.hasOwn(g.workSnapshots,ui.selected)?savedArt(g,ui.selected):works.find(work=>work.id===ui.selected)):null;
    return `<aside class="pg-library"><div class="pg-library-heading"><h2>Paintings</h2><span>${works.length} in the library</span></div><label class="pg-search"><span class="sr-only">Search paintings, artists, countries or movements</span><input type="search" id="pg-search" placeholder="Search paintings or artists" value="${esc(ui.query)}"></label><div class="pg-active-work">${selected?`${artButton(selected,{origin:g.workSnapshots[ui.selected]?'personal':'library',className:'pg-selected-art',draggable:true})}<div><strong>${esc(short(selected))}</strong><p>${esc(selected.artist||'Artist unrecorded')}</p><span>${used.has(ui.selected)?'Choose another wall space to move it.':'Choose an empty wall space.'}</span>${used.has(ui.selected)?'<button class="pg-text" type="button" data-action="pg-remove-work">Take off the wall</button>':''}</div>`:'<p>Choose a painting below, then a wall space.</p>'}</div><div class="pg-library-grid">${visible.map(work=>`<button type="button" class="pg-library-work" data-action="pg-select" data-work="${esc(work.id)}" data-pg-drag="${esc(work.id)}" aria-label="Select ${esc(short(work))}" aria-pressed="${ui.selected===work.id}" data-hung="${used.has(work.id)}"><span class="art-visual">${image(work)}</span><span>${esc(short(work))}</span></button>`).join('')}</div>${!visible.length?'<p class="pg-note">No paintings match this search.</p>':''}<div class="pg-library-pages"><button type="button" class="pg-text" data-action="pg-page" data-page="${ui.page-1}" ${ui.page===0?'disabled':''} aria-label="Previous paintings">←</button><span>${ui.page+1} / ${pages}</span><button type="button" class="pg-text" data-action="pg-page" data-page="${ui.page+1}" ${ui.page===pages-1?'disabled':''} aria-label="Next paintings">→</button></div></aside>`;
  }
  function connectionsMarkup(selected){
    const connections=personalMuseumConnections(selected,works),byId=new Map([...works,...selected].map(work=>[work.id,work]));
    return `<section class="pg-connections"><div class="pg-connections-heading"><div><p class="pg-eyebrow">Explore collections</p><h2>Museum connections</h2></div>${ui.mode==='personal'?`<div class="pg-scope" aria-label="Museum connection scope"><button type="button" data-action="pg-scope" data-scope="gallery" aria-pressed="${ui.scope==='gallery'}">Whole gallery</button><button type="button" data-action="pg-scope" data-scope="room" aria-pressed="${ui.scope==='room'}">This room</button></div>`:''}</div>${connections.length?`<div class="pg-connection-list">${connections.map(connection=>`<article class="pg-connection"><div><p class="pg-eyebrow">${esc(connection.basis)}</p><h3><a href="${esc(connection.sourceUrl)}" target="_blank" rel="noreferrer">${esc(connection.name)} ↗</a></h3><p>${esc(connection.text)}</p><div class="pg-connection-art">${connection.workIds.slice(0,4).map(id=>byId.get(id)).filter(Boolean).map(work=>artButton(work,{origin:'connection'})).join('')}</div>${connection.basis==='Connections in our collection sample'?`<div class="pg-sampled-works"><span>From this collection in our library</span>${connection.catalogueWorkIds.slice(0,3).map(id=>byId.get(id)).filter(Boolean).map(work=>`<a href="${esc(work.sourceUrl)}" target="_blank" rel="noreferrer">${esc(short(work))} ↗</a>`).join('')}</div>`:''}</div></article>`).join('')}</div>`:`<p class="pg-note">${selected.length?'There is not yet a specific sourced collection connection for these paintings.':'Hang a painting to explore collection connections.'}</p>`}<p class="pg-note">These links use the paintings and collection records in this library. They do not identify a world-closest museum or guarantee what is currently on display.</p></section>`;
  }
  function editorMarkup(){
    const g=gallery();if(!g)return indexMarkup();const r=room(),plan=ui.editorView==='plan';
    const heading=`<div class="pg-editor-heading"><button class="pg-text" type="button" data-action="pg-index">← Galleries</button><div class="pg-editor-tools"><button class="pg-text" type="button" data-action="pg-undo" ${undo.length?'':'disabled'}>Undo</button><button class="pg-text" type="button" data-action="pg-download">Download</button></div><input id="pg-gallery-name" aria-label="Gallery name" maxlength="80" value="${esc(g.title)}"></div>`;
    const views=`<nav class="pg-tabs pg-editor-tabs" aria-label="Gallery editor"><button id="pg-show-walls" type="button" data-action="pg-show-walls" aria-pressed="${!plan}">Hang paintings</button><button id="pg-show-plan" type="button" data-action="pg-show-plan" aria-pressed="${plan}">Floor plan</button></nav>`;
    if(plan)return `<section class="pg-editor">${heading}${views}${floorMarkup(g,r)}</section>`;
    const selectedIds=ui.scope==='room'&&r?Object.values(r.layout):personalGalleryWorkIds(g),selected=selectedIds.map(id=>savedArt(g,id)).filter(Boolean);
    return `<section class="pg-editor">${heading}${views}<p class="pg-wall-instructions">Choose a painting, then a wall space. Drag to move it. Each placement brings up the next painting.</p>${roomNavigation(g)}<div class="pg-studio"><div class="pg-room-area">${r?wallMarkup(g,r):'<div class="pg-room-empty"><p>Add a room to start hanging paintings.</p><button class="pg-primary" type="button" data-action="pg-add-room">Add a room ↗</button></div>'}<div class="pg-room-tools"><span>${r?'Edit the room name in the centre.':''}</span>${r?`<button class="pg-text" type="button" data-action="pg-remove-room" ${Object.keys(r.layout).length?'disabled':''}>Remove empty room</button>`:''}</div></div>${libraryMarkup(g)}</div>${connectionsMarkup(selected)}</section>`;
  }
  function quizPlanMarkup(g){
    if(!isGallery(g.sourceRecord))return '';
    const record=g.sourceRecord;
    return `<div class="pg-quiz-plan" aria-label="Original quiz floor plan"><svg viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true"><path d="M460 730 H30 V30 H970 V730 H540 M330 30 V140 M330 220 V500 M330 580 V730 M670 30 V140 M670 220 V500 M670 580 V730 M30 360 H140 M220 360 H460 M540 360 H780 M860 360 H970"/></svg>${ROOMS.map(r=>{const savedRoom=g.rooms.find(room=>room.id===r.id);return `<button type="button" class="pg-quiz-floor" data-action="pg-quiz-room" data-room="${r.id}" aria-pressed="${ui.roomId===r.id}" style="left:${r.x/10}%;top:${r.y/7.6}%;width:${r.w/10}%;height:${r.h/7.6}%" ${savedRoom?'':'disabled'}><span>${esc(savedRoom?.name||'Empty room')}</span><small>${savedRoom?.workIds.length||0} ${(savedRoom?.workIds.length||0)===1?'painting':'paintings'}</small></button>`;}).join('')}<span class="pg-quiz-entrance">Entrance</span>${Object.entries(record.placements).map(([id,p])=>{const box=mountBox(WALLS.find(wall=>wall.id===p.wallId),p.t),work=savedArt(g,id);return `<button type="button" class="pg-quiz-mount" data-action="pg-inspect" data-origin="quiz" data-work="${esc(id)}" style="left:${box.x/10}%;top:${box.y/7.6}%;width:${box.width/10}%;height:${box.height/7.6}%" aria-label="View ${esc(work?short(work):'unavailable artwork')}"><span class="art-visual">${work?image(work):'<span class="pg-unavailable">Unavailable</span>'}</span></button>`;}).join('')}</div>`;
  }
  function quizMarkup(){
    const g=quizGallery();if(!g)return indexMarkup();const r=g.rooms.find(room=>room.id===ui.roomId)||g.rooms[0];ui.roomId=r?.id||null;
    const selected=(r?.workIds||[]).map(id=>savedArt(g,id)).filter(Boolean);
    return `<section class="pg-quiz"><div class="pg-editor-heading"><button class="pg-text" type="button" data-action="pg-quiz-index">← Quiz galleries</button><p class="pg-eyebrow">${esc(date(g.finishedAt))}</p><h1>Your quiz gallery</h1><p>The rooms and artwork details saved with this quiz. This view does not edit your answers.</p></div>${roomNavigation(g,{readonly:true})}${quizPlanMarkup(g)}<section class="pg-quiz-room"><h2>${esc(r?.name||'Room')}</h2><div class="pg-quiz-paintings">${(r?.workIds||[]).map(id=>{const work=savedArt(g,id);return work?`<figure>${artButton(work,{origin:'quiz'})}<figcaption>${esc(short(work))}<span>${esc(work.artist||'')}</span></figcaption></figure>`:`<div class="pg-unavailable">Unavailable artwork <small>${esc(id)}</small></div>`;}).join('')}</div></section>${connectionsMarkup(selected)}</section>`;
  }
  function dialogs(){return `<dialog class="pg-art-dialog" id="pg-art-dialog"><button type="button" class="pg-dialog-close" data-action="pg-close-art" aria-label="Close artwork">×</button><img alt=""><p class="pg-art-error" role="status" hidden>The image could not load. The original artwork details and source remain below.</p><div><h2></h2><p class="pg-art-credit"></p><p class="pg-art-rights"></p><a target="_blank" rel="noreferrer">Collection source ↗</a></div></dialog>`;}
  function render(){
    cancelRoomDrag();
    const focused=app.ownerDocument.activeElement,focusId=focused?.id,selection=focused&&['search','text'].includes(focused.type)?[focused.selectionStart,focused.selectionEnd]:null;
    const status=unreadable?'The saved galleries could not be read. Their original data is kept; new galleries can be downloaded from this tab.':!storageAvailable?'These changes could not be saved in this browser. Download your galleries to keep them.':ui.status;
    app.innerHTML=header()+(ui.mode==='personal'?editorMarkup():ui.mode==='quiz'?quizMarkup():indexMarkup())+`<p class="pg-status" role="status">${esc(status)}</p>${unreadable?'<button type="button" class="pg-text" data-action="pg-download-original">Download original saved data</button>':''}`+dialogs();
    for(const img of app.querySelectorAll('img')){img.addEventListener('load',()=>updateArtworkCorners(app),{once:true});img.addEventListener('error',()=>{if(img.closest('.pg-art-dialog')){img.hidden=true;app.querySelector('.pg-art-error').hidden=false;return;}const frame=img.closest('.art-visual')||img.parentElement;frame.innerHTML='<span class="pg-unavailable">Image unavailable</span>';},{once:true});}
    updateArtworkCorners(app);
    if(focusId){const field=app.querySelector('#'+focusId);if(field&&typeof field.focus==='function'){field.focus({preventScroll:true});if(selection)try{field.setSelectionRange(...selection);}catch{}}}
  }
  function inspect(workId,origin){
    let work=origin==='quiz'?savedArt(quizGallery(),workId):origin==='personal'?savedArt(gallery(),workId):origin==='connection'?(ui.mode==='quiz'?savedArt(quizGallery(),workId):savedArt(gallery(),workId)||works.find(work=>work.id===workId)):works.find(work=>work.id===workId);
    if(!work){ui.status='The saved artwork details are unavailable.';render();return;}
    const dialog=app.querySelector('#pg-art-dialog');dialog.querySelector('img').hidden=false;dialog.querySelector('.pg-art-error').hidden=true;setArtworkImage(dialog.querySelector('img'),work);dialog.querySelector('h2').textContent=work.title;dialog.querySelector('.pg-art-credit').textContent=[work.artist,work.date,work.museum].filter(Boolean).join(' · ');dialog.querySelector('.pg-art-rights').textContent=[work.credit,work.rights].filter(Boolean).join(' · ');dialog.querySelector('a').href=work.sourceUrl;dialog.showModal();
  }
  function download(value,filename){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=app.ownerDocument.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
  function place(slot,workId=ui.selected){if(!gallery()||!room()||!workId){ui.status='Choose a painting first.';render();return;}const wasHung=personalGalleryWorkIds(gallery()).includes(workId);apply(placePersonalWork(state,ui.galleryId,ui.roomId,slot,workId,works,{now:now()}),'Painting placed.',{advance:wasHung?null:workId});}
  function open(id){if(ui.galleryId!==id)undo=[];ui.galleryId=id;ui.roomId=gallery()?.rooms[0]?.id||null;ui.mode='personal';ui.editorView='walls';ui.status='';ui.query='';ui.page=0;chooseNext(null);render();}
  function focusRoom(roomId,action){
    [...app.querySelectorAll('[data-action="'+action+'"][data-room]')].find(button=>button.dataset.room===roomId)?.focus({preventScroll:true});
  }
  function moveRoom(roomId,cell){
    const g=gallery();
    if(!g||!cell||!onFloor(cell))return false;
    const entry=g.rooms.find(r=>r.id===roomId);
    if(!entry||cellKey(personalRoomPositions(g)[roomId])===cellKey(cell))return false;
    const result=movePersonalRoom(state,ui.galleryId,roomId,cell,now());
    const swapped=g.rooms.find(r=>r.id===result.swappedRoomId);
    const message=swapped?entry.name+' swapped with '+swapped.name+'.':entry.name+' moved.';
    return apply(result,message);
  }
  function nudgeRoom(roomId,key){
    const step=floorSteps.get(key),g=gallery();
    if(!step||!g||!g.rooms.some(r=>r.id===roomId))return;
    if(moveRoom(roomId,beside(personalRoomPositions(g)[roomId],step)))focusRoom(roomId,'pg-plan-room');
  }
  function planCellAt(board,clientX,clientY){
    const bounds=board.getBoundingClientRect();
    const x=clientX-bounds.left-board.clientLeft,y=clientY-bounds.top-board.clientTop;
    if(x<0||y<0||x>=board.clientWidth||y>=board.clientHeight)return null;
    return {column:Math.floor(x/board.clientWidth*PERSONAL_FLOOR_GRID.columns),row:Math.floor(y/board.clientHeight*PERSONAL_FLOOR_GRID.rows)};
  }
  function cancelRoomDrag(){
    const gesture=roomDrag;
    if(!gesture)return;
    roomDrag=null;
    gesture.target.style.removeProperty('transform');
    delete gesture.target.dataset.moving;
    gesture.preview.hidden=true;
    if(gesture.target.hasPointerCapture?.(gesture.pointerId))gesture.target.releasePointerCapture(gesture.pointerId);
  }
  app.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');if(!control||Date.now()<suppressUntil)return;const action=control.dataset.action;
    if(action==='pg-index'){ui.mode='index';ui.status='';render();}
    else if(action==='pg-quiz-index'){ui.mode='quiz-index';ui.status='';render();}
    else if(action==='pg-new'){const result=addPersonalGallery(state,{now:now()});if(apply(result,'Gallery created.'))open(result.galleryId);}
    else if(action==='pg-open')open(control.dataset.gallery);
    else if(action==='pg-open-quiz'){ui.mode='quiz';ui.quizId=control.dataset.gallery;ui.roomId=quizGallery()?.rooms[0]?.id||null;ui.status='';render();}
    else if(action==='pg-show-plan'||action==='pg-show-walls'){
      ui.editorView=action==='pg-show-plan'?'plan':'walls';
      ui.status='';
      render();
      if(!control.id)focusRoom(ui.roomId,'pg-room');
    }
    else if(action==='pg-plan-room'){ui.roomId=control.dataset.room;ui.status='';render();focusRoom(ui.roomId,'pg-plan-room');}
    else if(action==='pg-plan-step')nudgeRoom(ui.roomId,control.dataset.step);
    else if(action==='pg-room'||action==='pg-quiz-room'){ui.roomId=control.dataset.room;ui.status='';render();}
    else if(action==='pg-add-room'){
      if(apply(addPersonalRoom(state,ui.galleryId,{now:now(),nearRoomId:ui.roomId}),'Room added.')&&ui.editorView==='plan')focusRoom(ui.roomId,'pg-plan-room');
    }
    else if(action==='pg-remove-room')apply(removePersonalRoom(state,ui.galleryId,ui.roomId,now()),'Empty room removed.');
    else if(action==='pg-select'||action==='pg-mounted'){ui.selected=control.dataset.work;ui.status='';render();}
    else if(action==='pg-place')place(control.dataset.slot);
    else if(action==='pg-remove-work')apply(removePersonalWork(state,ui.galleryId,ui.selected,now()),'Painting taken off the wall.');
    else if(action==='pg-page'){ui.page=Number(control.dataset.page);render();}
    else if(action==='pg-scope'){ui.scope=control.dataset.scope;render();}
    else if(action==='pg-undo'){if(undo.length){state=undo.pop();if(!gallery()){ui.mode='index';ui.galleryId=null;}else if(!room())ui.roomId=gallery().rooms[0]?.id||null;ui.status='Last change undone.';persist();render();}}
    else if(action==='pg-inspect')inspect(control.dataset.work,control.dataset.origin);
    else if(action==='pg-close-art')control.closest('dialog').close();
    else if(action==='pg-download')download(state,'art-atlas-galleries.json');
    else if(action==='pg-download-original')download(loaded.unreadableSource,'art-atlas-galleries-original.json');
  });
  app.addEventListener('input',event=>{if(event.target.id==='pg-search'){ui.query=event.target.value;ui.page=0;render();}});
  function commitName(field){
    if(field.id==='pg-gallery-name'&&gallery()?.title!==field.value.trim())apply(renamePersonalGallery(state,ui.galleryId,field.value,now()),'Gallery renamed.');
    if(field.id==='pg-room-name'&&room()?.name!==field.value.trim())apply(renamePersonalRoom(state,ui.galleryId,ui.roomId,field.value,now()),'Room renamed.');
  }
  app.addEventListener('change',event=>commitName(event.target));
  app.addEventListener('focusout',event=>commitName(event.target));
  app.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&['pg-gallery-name','pg-room-name'].includes(event.target.id)){event.preventDefault();const fieldId=event.target.id;commitName(event.target);app.querySelector('#'+fieldId)?.blur();}
    if(event.key==='Escape'){
      cancelRoomDrag();
      if(drag){drag.ghost?.remove();drag=null;}
    }
    const tile=event.target.closest('[data-pg-room-drag]');
    if(tile&&floorSteps.has(event.key)&&!roomDrag&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      event.preventDefault();
      nudgeRoom(tile.dataset.room,event.key);
    }
  });
  app.addEventListener('pointerdown',event=>{
    const target=event.target.closest('[data-pg-room-drag]');
    if(!target||roomDrag||event.button!==0||event.isPrimary===false)return;
    const board=target.closest('.pg-plan-board'),rect=target.getBoundingClientRect();
    roomDrag={target,board,preview:board.querySelector('.pg-plan-target'),pointerId:event.pointerId,x:event.clientX,y:event.clientY,
      centreX:rect.left+rect.width/2,centreY:rect.top+rect.height/2,moved:false};
    target.setPointerCapture?.(event.pointerId);
  });
  app.addEventListener('pointermove',event=>{
    const gesture=roomDrag;
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    const x=event.clientX-gesture.x,y=event.clientY-gesture.y;
    if(!gesture.moved&&Math.hypot(x,y)<=6)return;
    gesture.moved=true;
    gesture.target.dataset.moving='true';
    gesture.target.style.transform='translate('+x+'px,'+y+'px)';
    const cell=planCellAt(gesture.board,gesture.centreX+x,gesture.centreY+y);
    gesture.preview.hidden=!cell;
    if(cell)gesture.preview.style.cssText=cellStyle(cell);
  });
  app.addEventListener('pointerup',event=>{
    const gesture=roomDrag;
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    const cell=planCellAt(gesture.board,gesture.centreX+event.clientX-gesture.x,gesture.centreY+event.clientY-gesture.y);
    cancelRoomDrag();
    if(!gesture.moved)return;
    suppressUntil=Date.now()+180;
    const roomId=gesture.target.dataset.room;
    if(moveRoom(roomId,cell))focusRoom(roomId,'pg-plan-room');
  });
  for(const eventName of ['pointercancel','lostpointercapture']){
    app.addEventListener(eventName,event=>{if(roomDrag?.pointerId===event.pointerId)cancelRoomDrag();});
  }
  app.addEventListener('pointerdown',event=>{const target=event.target.closest('[data-pg-drag]');if(!target||ui.mode!=='personal'||event.button!==0||event.isPrimary===false)return;drag={id:target.dataset.pgDrag,x:event.clientX,y:event.clientY,target,ghost:null};target.setPointerCapture?.(event.pointerId);});
  app.addEventListener('pointermove',event=>{if(!drag)return;if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8){const work=gallery()?.workSnapshots[drag.id]||works.find(work=>work.id===drag.id);if(!work)return;drag.ghost=app.ownerDocument.createElement('div');drag.ghost.className='pg-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.innerHTML=image(work);app.ownerDocument.body.append(drag.ghost);}if(drag.ghost){drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';}});
  app.addEventListener('pointerup',event=>{if(!drag)return;const gesture=drag;drag=null;gesture.ghost?.remove();if(!gesture.ghost)return;suppressUntil=Date.now()+180;const target=app.ownerDocument.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');if(target)place(target.dataset.slot,gesture.id);});
  app.addEventListener('pointercancel',()=>{drag?.ghost?.remove();drag=null;});
  const resize=()=>updateArtworkCorners(app);globalThis.window?.addEventListener('resize',resize);
  render();
  return {render,getState:()=>structuredClone(state),getQuizGalleries:()=>structuredClone(quiz.galleries),dispose(){globalThis.window?.removeEventListener('resize',resize);cancelRoomDrag();drag?.ghost?.remove();}};
}

async function readArchive(id){
  if(!globalThis.indexedDB)return null;
  return new Promise(resolve=>{const request=indexedDB.open('art-atlas-study-archives',1);request.onupgradeneeded=()=>{request.transaction.abort();};request.onerror=request.onblocked=()=>resolve(null);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('quizzes')){db.close();resolve(null);return;}const transaction=db.transaction('quizzes','readonly'),get=transaction.objectStore('quizzes').get(id);get.onsuccess=()=>resolve(get.result?.value||null);get.onerror=()=>resolve(null);transaction.oncomplete=transaction.onabort=()=>db.close();};});
}
async function boot(app){
  try{
    const response=await fetch('./artworks.json');if(!response.ok)throw Error('The collection could not load.');const works=await response.json(),saved=await loadActiveStudy(quizKey);let storage=null;try{storage=globalThis.localStorage;const context=JSON.parse(storage.getItem(GALLERY_CONTEXT_KEY)||'null');storage.setItem(GALLERY_CONTEXT_KEY,JSON.stringify(nextGalleryContext(context,works.map(work=>work.id))));}catch{}
    const archives=Array.isArray(saved?.archives)?(await loadStudyArchives(saved.archives,{get:readArchive})).archives:[];
    createPersonalGalleries({app,works,storage,quizSessions:[saved,...archives]});
  }catch{app.innerHTML='<div class="pg-load-error"><a href="./">← Art Atlas</a><h1>The painting library could not load.</h1><p>Reload this page to try again. Saved galleries have not been changed.</p></div>';}
}
if(typeof document!=='undefined'){const app=document.querySelector('#personal-galleries');if(app)boot(app);}
