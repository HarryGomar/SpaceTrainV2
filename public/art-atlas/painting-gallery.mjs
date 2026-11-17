import {buildPaintingGallery,filterPaintingGallery,paintingSearchText,nextGalleryContext,GALLERY_CONTEXT_KEY} from './painting-gallery-data.mjs';
import {updateArtworkCorners} from './artwork-corners.mjs';
import {artworkImageAttributes,setArtworkImage} from './artwork-image.mjs';
import {journeyCurationNotes} from './journey-bank.mjs';
import {renderArtworkContext} from './artwork-context.mjs';
import {loadActiveStudy} from './active-study-storage.mjs';
import {COLLECTION_STORAGE_KEY,COLLECTION_STUDY_KEY,collectionRecord,savedPaintingIds,quizCollectionChoicesFromStudy,addSavedPaintings,toggleSavedPainting,resetSavedPaintings,undoSavedPaintingReset} from './collection-controls.mjs';

const root=document.querySelector('#painting-gallery'),dialog=document.querySelector('#painting-view'),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let gallery=null,viewId='first',query='',selectedKey=null,visibleItems=[],selectedIndex=0,cornerFrame=null;
let collection=collectionRecord(),choices=quizCollectionChoicesFromStudy(null),previousSavedCollection=null,collectionError='',studyError='',collectionMessage='',baseWorks=[],studyVersion=0,busy=false;
const short=work=>work.shortTitle||work.title;
const scheduleCorners=()=>{if(cornerFrame!==null)return;cornerFrame=requestAnimationFrame(()=>{cornerFrame=null;updateArtworkCorners(root);});};
function currentView(){return gallery.views.find(view=>view.id===viewId)||gallery.views[0];}
function latestCollection(){return collectionRecord(JSON.parse(localStorage.getItem(COLLECTION_STORAGE_KEY)||'null'));}
function storedCollection(){try{collection=latestCollection();collectionError='';}catch{collectionError='Your saved collection could not be read. Its stored data has been retained.';}}
function savedView(){
  const available=new Map([...gallery.views.filter(view=>view.id!=='saved').flatMap(view=>view.groups.flatMap(group=>group.items.map(item=>[item.workId,item.work]))),...choices.works.map(work=>[work.id,work]),...baseWorks.map(work=>[work.id,work])]),items=savedPaintingIds(collection).flatMap(id=>{
    const work=available.get(id);return work?[{key:'kept:'+id,workId:id,source:'collection',work,searchText:paintingSearchText(work)}]:[];
  });
  return {id:'saved',label:'Saved · '+items.length,title:'Your saved paintings',intro:'Paintings you keep for looking or for further study.',kind:'saved',groups:items.length?[{id:'saved-paintings',kind:'catalogue',label:'',title:'',workIds:items.map(item=>item.workId),items}]:[],workCount:items.length,itemCount:items.length,setCount:items.length?1:0};
}
function updateCollectionTools(){
  const pending=ids=>ids.filter(id=>collection.saved[id]?.look!==true).length;
  for(const [action,ids,label]of [['add-favourites',choices.favouriteIds,'Add quiz favourites'],['add-liked',choices.likedIds,'Add paintings you liked']]){
    const button=root.querySelector('[data-collection-action="'+action+'"]');if(!button)continue;button.textContent=label+(ids.length?' · '+ids.length:'');button.disabled=busy||!!collectionError||!pending(ids);
  }
  const reset=root.querySelector('[data-collection-action="reset"]'),undo=root.querySelector('[data-collection-action="undo"]');if(reset)reset.disabled=busy||!!collectionError||!savedPaintingIds(collection).length;if(undo){undo.hidden=!previousSavedCollection;undo.disabled=busy||!!collectionError;}
  const status=root.querySelector('#painting-collection-status');if(status)status.textContent=collectionError||[collectionMessage,studyError].filter(Boolean).join(' ')||'Keep saves a painting for looking. Study saves remain separate.';
  for(const button of document.querySelectorAll('[data-keep-painting]')){const kept=collection.saved[button.dataset.keepPainting]?.look===true;button.setAttribute('aria-pressed',String(kept));button.textContent=kept?'Kept':'Keep';button.disabled=busy||!!collectionError;}
}
function shell(){
  root.innerHTML=`<header class="pg-top"><a href="./" class="pg-brand">← Art Atlas</a><nav aria-label="Explore Art Atlas"><a href="./?view=collection">Your saved paintings</a><a href="./maps.html">Maps ↗</a><a href="./profiles.html">Profiles ↗</a></nav></header><div class="pg-heading"><h1>The collection</h1></div><div class="pg-tools"><nav class="pg-views" aria-label="Painting collections">${gallery.views.map(view=>`<button type="button" data-gallery-view="${esc(view.id)}" aria-pressed="${view.id===viewId}">${esc(view.label)}</button>`).join('')}</nav><div class="pg-search"><label for="painting-search">Find a painting</label><input id="painting-search" type="search" placeholder="Title, artist, movement or place" autocomplete="off" spellcheck="false"><button type="button" data-clear-search hidden>Clear</button></div></div><section class="pg-introduction" aria-labelledby="gallery-view-title"><div><h2 id="gallery-view-title"></h2><p id="gallery-view-intro"></p></div><p id="gallery-result-count" role="status" aria-live="polite"></p></section><div class="pg-groups" id="painting-groups"></div><footer class="pg-footer"><details><summary>About these sets</summary><div>${gallery.scope.map(line=>`<p>${esc(line)}</p>`).join('')}</div></details><a href="./">Return to the study →</a></footer>`;
  const heading=root.querySelector('.pg-heading'),controls=document.createElement('section');controls.className='pg-collection-controls';controls.setAttribute('aria-label','Save paintings');controls.innerHTML='<div class="pg-collection-actions"><button type="button" data-collection-action="add-favourites">Add quiz favourites</button><button type="button" data-collection-action="add-liked">Add paintings you liked</button><button type="button" data-collection-action="reset">Reset saved paintings</button><button type="button" data-collection-action="undo" hidden>Undo reset</button></div><p>Quiz favourites are your explicit selections. Liked paintings also include positive appeal ratings.</p><p id="painting-collection-status" role="status" aria-live="polite"></p>';heading.after(controls);
  root.querySelector('.pg-top nav a').href='#saved';
  renderGallery();
}
function paintingMarkup(item){
  const work=item.work;
  const kept=collection.saved[work.id];
  return `<figure class="pg-work"><button class="pg-art art-visual ${selectedKey===item.key?'is-selected':''}" type="button" data-gallery-art="${esc(item.key)}" aria-haspopup="dialog" aria-label="View ${esc(short(work))} by ${esc(work.artist||'unidentified artist')}"><img ${artworkImageAttributes(work,{sizes:"auto, (max-width:700px) 42vw, 25vw"})} alt="${esc(work.alt||work.title)}"></button><figcaption><strong>${esc(short(work))}</strong><span>${esc(work.artist||'Unidentified artist')}</span>${work.date?`<small>${esc(work.date)}</small>`:''}<button type="button" class="pg-keep" data-keep-painting="${esc(work.id)}" aria-label="Keep ${esc(short(work))} for looking" aria-pressed="${kept?.look===true}">${kept?.look===true?'Kept':'Keep'}</button>${kept?.study===true?'<small class="pg-study-save">Saved for study</small>':''}</figcaption></figure>`;
}
function renderGallery(){
  const saved=savedView(),index=gallery.views.findIndex(view=>view.id==='saved');if(index<0)gallery.views.splice(1,0,saved);else gallery.views[index]=saved;
  const navigation=root.querySelector('.pg-views');if(navigation)navigation.innerHTML=gallery.views.map(view=>`<button type="button" data-gallery-view="${esc(view.id)}" aria-pressed="${view.id===viewId}">${esc(view.label)}</button>`).join('');
  const source=currentView(),view=filterPaintingGallery(source,query);visibleItems=[...new Map(view.groups.flatMap(group=>group.items).map(item=>[item.key,item])).values()];
  for(const button of root.querySelectorAll('[data-gallery-view]'))button.setAttribute('aria-pressed',String(button.dataset.galleryView===source.id));
  root.dataset.view=source.id;root.querySelector('#gallery-view-title').textContent=source.title;root.querySelector('#gallery-view-title').hidden=source.id==='all';root.querySelector('#gallery-view-intro').textContent=source.intro;
  root.querySelector('#gallery-result-count').textContent=view.workCount+' '+(view.workCount===1?'painting':'paintings')+(['planned','history'].includes(source.kind)?' · '+view.setCount+' '+(view.setCount===1?'set':'sets'):'')+(query?' found':'');
  root.querySelector('[data-clear-search]').hidden=!query;
  root.querySelector('#painting-groups').innerHTML=view.groups.length?view.groups.map(group=>`<section class="pg-set ${['planned-comparison','answered-comparison'].includes(group.kind)?'pg-comparison-set':'pg-pool'}" aria-label="${esc(group.label||source.title)}">${group.label||group.title?`<header class="pg-set-heading"><p>${esc(group.label)}</p>${group.title?`<h3>${esc(group.title)}</h3>`:''}</header>`:''}<div class="pg-paintings" data-painting-count="${group.items.length}">${group.items.map(paintingMarkup).join('')}</div></section>`).join(''):`<div class="pg-empty"><h3>${query?'No paintings match that search.':source.kind==='history'?'No completed comparison sets yet.':'No paintings are available in this group.'}</h3><p>${query?'Try an artist, title, movement or place.':source.kind==='history'?'Completed ordinary preference comparisons will appear here.':''}</p>${query?'<button type="button" data-clear-search>Clear search →</button>':''}</div>`;
  const empty=root.querySelector('.pg-empty');if(empty&&!query&&source.kind==='saved'){empty.querySelector('h3').textContent='No saved paintings yet.';empty.querySelector('p').textContent='Add your quiz choices above, or Keep a painting as you browse.';}
  updateCollectionTools();scheduleCorners();
}
function selectView(id){
  if(!gallery.views.some(view=>view.id===id))return;viewId=id;selectedKey=null;history.replaceState(null,'','#'+id);renderGallery();
}
function showPainting(index){
  if(!visibleItems.length)return;selectedIndex=(index+visibleItems.length)%visibleItems.length;const item=visibleItems[selectedIndex],work=item.work;selectedKey=item.key;
  const img=dialog.querySelector('#painting-image');setArtworkImage(img,work);
  const context=renderArtworkContext(work,{esc}),details=dialog.querySelector('#painting-context');details.hidden=!context;details.querySelector('div').innerHTML=context;
  dialog.querySelector('#painting-title').textContent=work.title;dialog.querySelector('#painting-artist').textContent=[work.artist,work.date].filter(Boolean).join(' · ');dialog.querySelector('#painting-institution').textContent=work.museum||work.institution||'';dialog.querySelector('#painting-source').href=work.sourceUrl;dialog.querySelector('#painting-credit').textContent=work.imageCredit||(work.provenance?.sourceRightsStatement?.startsWith('©')?work.provenance.sourceRightsStatement:'')||(['CC0','Public domain'].includes(work.rights)?work.rights:'');dialog.querySelector('#painting-position').textContent=(selectedIndex+1)+' / '+visibleItems.length;
  for(const button of dialog.querySelectorAll('[data-painting-step]'))button.disabled=visibleItems.length<2;
  for(const button of root.querySelectorAll('[data-gallery-art]'))button.classList.toggle('is-selected',button.dataset.galleryArt===selectedKey);
  let keep=dialog.querySelector('[data-keep-painting]');if(!keep){keep=document.createElement('button');keep.type='button';keep.className='pg-keep';dialog.querySelector('.pg-dialog-caption>div').append(keep);}keep.dataset.keepPainting=work.id;keep.setAttribute('aria-label','Keep '+short(work)+' for looking');
  updateCollectionTools();
  if(!dialog.open){document.documentElement.classList.add('pg-modal-open');dialog.showModal();}
}
async function refreshQuizChoices(){
  const version=++studyVersion;
  try{const study=await loadActiveStudy(COLLECTION_STUDY_KEY);if(version===studyVersion){choices=quizCollectionChoicesFromStudy(study);studyError='';}return study;}
  catch(error){if(version===studyVersion){choices=quizCollectionChoicesFromStudy(null);studyError='Your saved quiz could not be opened. You can still browse and keep paintings.';}return null;}
}
function refreshCollectionDisplay(){
  if(!gallery)return;const activeKey=selectedKey;renderGallery();
  if(dialog.open){const index=visibleItems.findIndex(item=>item.key===activeKey);if(index>=0)showPainting(index);else if(visibleItems.length)showPainting(Math.min(selectedIndex,visibleItems.length-1));else dialog.close();}
}
async function changeCollection(action,workId=null){
  if(busy)return;busy=true;updateCollectionTools();
  try{
    if(action==='add-favourites'||action==='add-liked'){await refreshQuizChoices();if(studyError)return;}
    const latest=latestCollection();let next=latest,undo=previousSavedCollection,message='';
    if(action==='add-favourites'||action==='add-liked'){
      const selected=action==='add-favourites'?choices.favouriteIds:choices.likedIds,added=selected.filter(id=>latest.saved[id]?.look!==true).length;next=addSavedPaintings(latest,selected);message=added?'Saved '+added+' '+(added===1?'painting':'paintings')+' for looking.':'Those paintings are already saved for looking.';
    }else if(action==='keep'){
      next=toggleSavedPainting(latest,workId);message=(next.saved[workId]?.look?'Saved for looking: ':'Removed from looking saves: ')+(baseWorks.find(work=>work.id===workId)?.title||'painting')+'.';
    }else if(action==='reset'){
      const reset=resetSavedPaintings(latest);next=reset.collection;undo=reset.previousSaved;message='Saved paintings reset. You can undo this.';
    }else if(action==='undo'&&previousSavedCollection){next=undoSavedPaintingReset(latest,previousSavedCollection);undo=null;message='Restored your earlier saves and kept your newer additions.';}else return;
    localStorage.setItem(COLLECTION_STORAGE_KEY,JSON.stringify(next));collection=next;previousSavedCollection=undo;collectionError='';collectionMessage=message;
  }catch(error){collectionError='Your collection could not be saved. Its stored data has been retained.';}
  finally{
    busy=false;refreshCollectionDisplay();
    if(workId&&!dialog.open){const button=[...root.querySelectorAll('[data-keep-painting]')].find(item=>item.dataset.keepPainting===workId)||root.querySelector('[data-gallery-view="saved"]');button?.focus({preventScroll:true});}
  }
}
root.addEventListener('click',event=>{
  const collectionAction=event.target.closest('[data-collection-action]');if(collectionAction){void changeCollection(collectionAction.dataset.collectionAction);return;}
  const keep=event.target.closest('[data-keep-painting]');if(keep){void changeCollection('keep',keep.dataset.keepPainting);return;}
  const tab=event.target.closest('[data-gallery-view]');if(tab){selectView(tab.dataset.galleryView);return;}
  const painting=event.target.closest('[data-gallery-art]');if(painting){const index=visibleItems.findIndex(item=>item.key===painting.dataset.galleryArt);if(index>=0)showPainting(index);return;}
  if(event.target.closest('[data-clear-search]')){query='';root.querySelector('#painting-search').value='';renderGallery();root.querySelector('#painting-search').focus({preventScroll:true});}
});
root.addEventListener('input',event=>{if(event.target.id==='painting-search'){query=event.target.value;renderGallery();}});
root.addEventListener('load',scheduleCorners,true);root.addEventListener('error',event=>{if(event.target.matches('img')){event.target.closest('.pg-work')?.classList.add('image-unavailable');scheduleCorners();}},true);
window.addEventListener('resize',scheduleCorners);
window.addEventListener('hashchange',()=>{if(gallery)selectView(location.hash.slice(1));});
dialog.addEventListener('click',event=>{const keep=event.target.closest('[data-keep-painting]');if(keep){void changeCollection('keep',keep.dataset.keepPainting);return;}if(event.target===dialog||event.target.closest('[data-close-painting]'))dialog.close();const step=event.target.closest('[data-painting-step]');if(step)showPainting(selectedIndex+Number(step.dataset.paintingStep));});
dialog.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showPainting(selectedIndex+(event.key==='ArrowLeft'?-1:1));}});
dialog.addEventListener('close',()=>document.documentElement.classList.remove('pg-modal-open'));
window.addEventListener('storage',event=>{if(event.key===COLLECTION_STORAGE_KEY){storedCollection();refreshCollectionDisplay();}else if(event.key===COLLECTION_STUDY_KEY)void refreshQuizChoices().then(refreshCollectionDisplay);});
window.addEventListener('focus',()=>{storedCollection();void refreshQuizChoices().then(refreshCollectionDisplay);});

try{
  const artResponse=await fetch('./artworks.json');if(!artResponse.ok)throw Error('Collection unavailable');const works=await artResponse.json(),notes=journeyCurationNotes(works);
  baseWorks=works;storedCollection();const saved=await refreshQuizChoices();
  gallery=buildPaintingGallery({works,notes,saved});if(location.hash.slice(1)==='saved'||gallery.views.some(view=>view.id===location.hash.slice(1)))viewId=location.hash.slice(1);shell();
  // This records only that this gallery was opened, never which names were read.
  try{let previous=null;try{previous=JSON.parse(localStorage.getItem(GALLERY_CONTEXT_KEY));}catch{}const availableIds=gallery.views.find(view=>view.id==='all').groups.flatMap(group=>group.workIds);localStorage.setItem(GALLERY_CONTEXT_KEY,JSON.stringify(nextGalleryContext(previous,availableIds)));}catch{}
}catch{root.innerHTML='<p class="pg-loading">The paintings could not load. <a href="./paintings.html">Try again →</a></p>';}
