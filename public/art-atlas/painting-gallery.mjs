import {buildPaintingGallery,filterPaintingGallery,nextGalleryContext,GALLERY_CONTEXT_KEY} from './painting-gallery-data.mjs';
import {updateArtworkCorners} from './artwork-corners.mjs';
import {artworkImageAttributes,setArtworkImage} from './artwork-image.mjs';

const root=document.querySelector('#painting-gallery'),dialog=document.querySelector('#painting-view'),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let gallery=null,viewId='first',query='',selectedKey=null,visibleItems=[],selectedIndex=0,cornerFrame=null;
const short=work=>work.shortTitle||work.title;
const scheduleCorners=()=>{if(cornerFrame!==null)return;cornerFrame=requestAnimationFrame(()=>{cornerFrame=null;updateArtworkCorners(root);});};
function currentView(){return gallery.views.find(view=>view.id===viewId)||gallery.views[0];}
function shell(){
  root.innerHTML=`<header class="pg-top"><a href="./" class="pg-brand">← Art Atlas</a><nav aria-label="Explore Art Atlas"><a href="./maps.html">Maps ↗</a><a href="./profiles.html">Profiles ↗</a></nav></header><div class="pg-heading"><h1>The collection</h1></div><div class="pg-tools"><nav class="pg-views" aria-label="Painting collections">${gallery.views.map(view=>`<button type="button" data-gallery-view="${esc(view.id)}" aria-pressed="${view.id===viewId}">${esc(view.label)}</button>`).join('')}</nav><div class="pg-search"><label for="painting-search">Find a painting</label><input id="painting-search" type="search" placeholder="Title, artist, movement or place" autocomplete="off" spellcheck="false"><button type="button" data-clear-search hidden>Clear</button></div></div><section class="pg-introduction" aria-labelledby="gallery-view-title"><div><h2 id="gallery-view-title"></h2><p id="gallery-view-intro"></p></div><p id="gallery-result-count" role="status" aria-live="polite"></p></section><div class="pg-groups" id="painting-groups"></div><footer class="pg-footer"><details><summary>About these sets</summary><div>${gallery.scope.map(line=>`<p>${esc(line)}</p>`).join('')}</div></details><a href="./">Return to the study →</a></footer>`;
  renderGallery();
}
function paintingMarkup(item){
  const work=item.work;
  return `<figure class="pg-work"><button class="pg-art art-visual ${selectedKey===item.key?'is-selected':''}" type="button" data-gallery-art="${esc(item.key)}" aria-haspopup="dialog" aria-label="View ${esc(short(work))} by ${esc(work.artist||'unidentified artist')}"><img ${artworkImageAttributes(work,{sizes:"auto, (max-width:700px) 42vw, 25vw"})} alt="${esc(work.alt||work.title)}"></button><figcaption><strong>${esc(short(work))}</strong><span>${esc(work.artist||'Unidentified artist')}</span>${work.date?`<small>${esc(work.date)}</small>`:''}</figcaption></figure>`;
}
function renderGallery(){
  const source=currentView(),view=filterPaintingGallery(source,query);visibleItems=[...new Map(view.groups.flatMap(group=>group.items).map(item=>[item.key,item])).values()];
  for(const button of root.querySelectorAll('[data-gallery-view]'))button.setAttribute('aria-pressed',String(button.dataset.galleryView===source.id));
  root.dataset.view=source.id;root.querySelector('#gallery-view-title').textContent=source.title;root.querySelector('#gallery-view-title').hidden=source.id==='all';root.querySelector('#gallery-view-intro').textContent=source.intro;
  root.querySelector('#gallery-result-count').textContent=view.workCount+' '+(view.workCount===1?'painting':'paintings')+(['planned','history'].includes(source.kind)?' · '+view.setCount+' '+(view.setCount===1?'set':'sets'):'')+(query?' found':'');
  root.querySelector('[data-clear-search]').hidden=!query;
  root.querySelector('#painting-groups').innerHTML=view.groups.length?view.groups.map(group=>`<section class="pg-set ${['planned-comparison','answered-comparison'].includes(group.kind)?'pg-comparison-set':'pg-pool'}" aria-label="${esc(group.label||source.title)}">${group.label||group.title?`<header class="pg-set-heading"><p>${esc(group.label)}</p>${group.title?`<h3>${esc(group.title)}</h3>`:''}</header>`:''}<div class="pg-paintings" data-painting-count="${group.items.length}">${group.items.map(paintingMarkup).join('')}</div></section>`).join(''):`<div class="pg-empty"><h3>${query?'No paintings match that search.':source.kind==='history'?'No completed comparison sets yet.':'No paintings are available in this group.'}</h3><p>${query?'Try an artist, title, movement or place.':source.kind==='history'?'Completed ordinary preference comparisons will appear here.':''}</p>${query?'<button type="button" data-clear-search>Clear search →</button>':''}</div>`;
  scheduleCorners();
}
function selectView(id){
  if(!gallery.views.some(view=>view.id===id))return;viewId=id;selectedKey=null;history.replaceState(null,'','#'+id);renderGallery();
}
function showPainting(index){
  if(!visibleItems.length)return;selectedIndex=(index+visibleItems.length)%visibleItems.length;const item=visibleItems[selectedIndex],work=item.work;selectedKey=item.key;
  const img=dialog.querySelector('#painting-image');setArtworkImage(img,work);
  dialog.querySelector('#painting-title').textContent=work.title;dialog.querySelector('#painting-artist').textContent=[work.artist,work.date].filter(Boolean).join(' · ');dialog.querySelector('#painting-institution').textContent=work.museum||work.institution||'';dialog.querySelector('#painting-source').href=work.sourceUrl;dialog.querySelector('#painting-credit').textContent=work.imageCredit||(work.provenance?.sourceRightsStatement?.startsWith('©')?work.provenance.sourceRightsStatement:'')||(['CC0','Public domain'].includes(work.rights)?work.rights:'');dialog.querySelector('#painting-position').textContent=(selectedIndex+1)+' / '+visibleItems.length;
  for(const button of dialog.querySelectorAll('[data-painting-step]'))button.disabled=visibleItems.length<2;
  for(const button of root.querySelectorAll('[data-gallery-art]'))button.classList.toggle('is-selected',button.dataset.galleryArt===selectedKey);
  if(!dialog.open){document.documentElement.classList.add('pg-modal-open');dialog.showModal();}
}
root.addEventListener('click',event=>{
  const tab=event.target.closest('[data-gallery-view]');if(tab){selectView(tab.dataset.galleryView);return;}
  const painting=event.target.closest('[data-gallery-art]');if(painting){const index=visibleItems.findIndex(item=>item.key===painting.dataset.galleryArt);if(index>=0)showPainting(index);return;}
  if(event.target.closest('[data-clear-search]')){query='';root.querySelector('#painting-search').value='';renderGallery();root.querySelector('#painting-search').focus({preventScroll:true});}
});
root.addEventListener('input',event=>{if(event.target.id==='painting-search'){query=event.target.value;renderGallery();}});
root.addEventListener('load',scheduleCorners,true);root.addEventListener('error',event=>{if(event.target.matches('img')){event.target.closest('.pg-work')?.classList.add('image-unavailable');scheduleCorners();}},true);
window.addEventListener('resize',scheduleCorners);
window.addEventListener('hashchange',()=>{if(gallery)selectView(location.hash.slice(1));});
dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-close-painting]'))dialog.close();const step=event.target.closest('[data-painting-step]');if(step)showPainting(selectedIndex+Number(step.dataset.paintingStep));});
dialog.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showPainting(selectedIndex+(event.key==='ArrowLeft'?-1:1));}});
dialog.addEventListener('close',()=>document.documentElement.classList.remove('pg-modal-open'));

try{
  const [artResponse,notesResponse]=await Promise.all([fetch('./artworks.json'),fetch('./curation-notes.json')]);if(!artResponse.ok||!notesResponse.ok)throw Error('Collection unavailable');const [works,notes]=await Promise.all([artResponse.json(),notesResponse.json()]);
  let saved=null;try{saved=JSON.parse(localStorage.getItem('art-profile-journey-v1'));}catch{}
  gallery=buildPaintingGallery({works,notes,saved});if(gallery.views.some(view=>view.id===location.hash.slice(1)))viewId=location.hash.slice(1);shell();
  // This records only that this gallery was opened, never which names were read.
  try{let previous=null;try{previous=JSON.parse(localStorage.getItem(GALLERY_CONTEXT_KEY));}catch{}const availableIds=gallery.views.find(view=>view.id==='all').groups.flatMap(group=>group.workIds);localStorage.setItem(GALLERY_CONTEXT_KEY,JSON.stringify(nextGalleryContext(previous,availableIds)));}catch{}
}catch{root.innerHTML='<p class="pg-loading">The paintings could not load. <a href="./paintings.html">Try again →</a></p>';}
