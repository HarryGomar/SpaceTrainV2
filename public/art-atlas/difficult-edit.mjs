import { buildRounds, validAnswer } from './engine.mjs';
import { isGallery, validGallery, WALLS, roomOf, roomName } from './gallery-model.mjs';

export const DIFFICULT_EDIT_PROTOCOL='difficult-edit-v1';
const CHOICES=['initial','alternative','equal'];
const unique=ids=>[...new Set(ids)];
const title=w=>w.shortTitle||w.title;
const ownObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hash=text=>[...text].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2166136261);
const workById=(works,id)=>works.find(w=>w.id===id);
const sameSet=(a,b)=>a.length===b.length&&a.every(id=>b.includes(id));
export const isDifficultEdit=record=>record?.kind==='difficult-edit'&&record.version===1&&record.protocol===DIFFICULT_EDIT_PROTOCOL;

function preference(works,answers) {
  if(!ownObject(answers))return null;
  try {const r=buildRounds(works,answers)[0],a=answers.preferenceRank;return validAnswer(r,a)?a:null;}catch{return null;}
}
function wallSource(works,records,options) {
  const available=new Set(works.map(w=>w.id));
  for(const r of [...records].reverse()) {
    if(!isGallery(r)||!validGallery(r,works)||options.sourceRecordId&&r.id!==options.sourceRecordId)continue;
    const rooms=unique(Object.keys(r.placements).map(id=>roomOf(r,id)));
    for(const roomId of rooms) {
      if(options.sourceRoomId&&roomId!==options.sourceRoomId)continue;
      const roomIds=Object.keys(r.placements).filter(id=>roomOf(r,id)===roomId).sort((a,b)=>r.placements[a].wallId.localeCompare(r.placements[b].wallId)||r.placements[a].t-r.placements[b].t);
      if(roomIds.length<4||roomIds.some(id=>!available.has(id)))continue;
      return {ids:roomIds.slice(0,4),source:{kind:'gallery-room',recordId:r.id,protocol:r.protocol,roomId,roomName:roomName(r,roomId),roomWorkIds:[...roomIds],placements:Object.fromEntries(roomIds.map(id=>[id,structuredClone(r.placements[id])])),selectionRule:roomIds.length===4?'whole-room':'first-four-in-wall-order'}};
    }
  }
  return null;
}
function catalogueSource(works,answers) {
  const pref=preference(works,answers),available=new Set(works.map(w=>w.id));let ids=[],basis='landscape-comparison';
  if(pref) {
    const ordered=[...pref.workIds].sort((a,b)=>pref.positions[b]-pref.positions[a]||a.localeCompare(b));
    if(pref.positions[ordered[0]]-pref.positions[ordered.at(-1)]>=15){ids=[ordered[0],ordered.at(-1)];basis='prior-quartet-and-catalogue';}
  }
  const candidates=['velasco-valley-mexico','cezanne-mountain','shen-clouds','hokusai-mount-fuji',...works.map(w=>w.id)];
  for(const id of candidates)if(available.has(id)&&!ids.includes(id)&&ids.length<4)ids.push(id);
  if(ids.length!==4)throw Error('Four available, sourced works are needed for this edit.');
  return {ids,source:{kind:'catalogue-set',basis,roomWorkIds:[...ids]}};
}
function sourceSnapshot(works,ids) {
  return ids.map(id=>{const w=workById(works,id);return {id,title:w.title,shortTitle:w.shortTitle||w.title,artist:w.artist,date:w.date||'',image:w.image,sourceUrl:w.sourceUrl};});
}
export function createDifficultEditRecord(works,baselineAnswers={},records=[],options={}) {
  if(!Array.isArray(works)||works.length<4||new Set(works.map(w=>w?.id)).size!==works.length||works.some(w=>!w?.id||!w.image||!w.sourceUrl||!w.title||!w.artist))throw Error('Four distinct, sourced works are needed for this edit.');
  const captured=structuredClone(ownObject(baselineAnswers)?baselineAnswers:{}),bound=wallSource(works,records,options)||catalogueSource(works,captured),now=Number.isFinite(options.now)?options.now:Date.now();
  const id=options.id||'difficult-edit-'+now+'-'+Math.random().toString(36).slice(2,8);
  return {kind:'difficult-edit',version:1,protocol:DIFFICULT_EDIT_PROTOCOL,id,createdAt:now,offeredIds:[...bound.ids],presentedIds:[],artworkSources:sourceSnapshot(works,bound.ids),baselineAnswers:captured,source:structuredClone(bound.source),phase:'edit',removedId:null,alternativeRemovedId:null,comparisonBasis:null,compareChoice:null,comparisonOrder:hash(id)%2?['alternative','initial']:['initial','alternative'],labelExposureIds:[]};
}
function alternativeFor(record,works) {
  if(!record.offeredIds.includes(record.removedId))return null;
  const kept=record.offeredIds.filter(id=>id!==record.removedId),pref=preference(works,record.baselineAnswers),removedScore=pref?.positions[record.removedId];
  const lower=Number.isFinite(removedScore)?kept.filter(id=>Number.isFinite(pref.positions[id])&&removedScore-pref.positions[id]>=15).sort((a,b)=>pref.positions[a]-pref.positions[b]||a.localeCompare(b)):[];
  return lower.length?{id:lower[0],basis:'earlier-preference'}:{id:kept[hash(record.id+'-alternative')%kept.length],basis:'seeded-retained-work'};
}
export function difficultEditWalls(record) {
  const initial=(record.offeredIds||[]).filter(id=>id!==record.removedId);
  return {initial,alternative:record.alternativeRemovedId?initial.map(id=>id===record.alternativeRemovedId?record.removedId:id):[]};
}
export function difficultEditIds(record) {
  const walls=difficultEditWalls(record);
  return record.compareChoice==='alternative'?walls.alternative:record.compareChoice==='equal'?unique([...walls.initial,...walls.alternative]):walls.initial;
}
export function validDifficultEditDraft(record,works) {
  if(!isDifficultEdit(record)||typeof record.id!=='string'||!record.id||!Number.isFinite(record.createdAt)||!Array.isArray(works)||!Array.isArray(record.offeredIds)||record.offeredIds.length!==4||new Set(record.offeredIds).size!==4)return false;
  if(record.offeredIds.some(id=>!workById(works,id))||!Array.isArray(record.presentedIds)||new Set(record.presentedIds).size!==record.presentedIds.length||record.presentedIds.some(id=>!record.offeredIds.includes(id)))return false;
  if(!ownObject(record.baselineAnswers)||!ownObject(record.source)||!['gallery-room','catalogue-set'].includes(record.source.kind)||!Array.isArray(record.source.roomWorkIds)||new Set(record.source.roomWorkIds).size!==record.source.roomWorkIds.length||record.source.roomWorkIds.some(id=>!workById(works,id))||!record.offeredIds.every(id=>record.source.roomWorkIds.includes(id)))return false;
  if(record.source.kind==='gallery-room') {
    if(typeof record.source.recordId!=='string'||!record.source.recordId||record.source.protocol!=='open-gallery-v1'||typeof record.source.roomName!=='string'||record.source.roomName.length>100||!ownObject(record.source.placements)||!['whole-room','first-four-in-wall-order'].includes(record.source.selectionRule))return false;
    if(record.source.roomWorkIds.some(id=>{const p=record.source.placements[id],wall=WALLS.find(w=>w.id===p?.wallId);return !wall||wall.roomId!==record.source.roomId||!Number.isFinite(p.t)||p.t<0||p.t>1;}))return false;
  } else if(!['landscape-comparison','prior-quartet-and-catalogue'].includes(record.source.basis)||!sameSet(record.source.roomWorkIds,record.offeredIds))return false;
  if(!Array.isArray(record.artworkSources)||record.artworkSources.length!==4||new Set(record.artworkSources.map(w=>w?.id)).size!==4||record.artworkSources.some(s=>{const w=workById(works,s?.id);return !w||!record.offeredIds.includes(s.id)||typeof s.title!=='string'||typeof s.shortTitle!=='string'||typeof s.artist!=='string'||s.image!==w.image||s.sourceUrl!==w.sourceUrl;}))return false;
  if(!['edit','compare'].includes(record.phase)||record.removedId!==null&&!record.offeredIds.includes(record.removedId)||!Array.isArray(record.comparisonOrder)||!sameSet(record.comparisonOrder,['initial','alternative'])||new Set(record.comparisonOrder).size!==2||record.comparisonOrder.length!==2||!Array.isArray(record.labelExposureIds)||record.labelExposureIds.some(id=>!record.offeredIds.includes(id)))return false;
  if(record.phase==='edit')return record.alternativeRemovedId===null&&record.comparisonBasis===null&&record.compareChoice===null;
  const expected=alternativeFor(record,works);
  return !!expected&&record.alternativeRemovedId===expected.id&&record.comparisonBasis===expected.basis&&(record.compareChoice===null||CHOICES.includes(record.compareChoice));
}
export function validDifficultEdit(record,works,finished=true) {
  return validDifficultEditDraft(record,works)&&record.phase==='compare'&&record.offeredIds.every(id=>record.presentedIds.includes(id))&&CHOICES.includes(record.compareChoice)&&(!finished||record.confirmed===true&&Number.isFinite(record.finishedAt));
}
export function setDifficultEditRemoval(record,id,works) {
  if(!validDifficultEditDraft(record,works)||id!==null&&!record.offeredIds.includes(id))return record;
  if(record.removedId===id)return record;
  const next=structuredClone(record);Object.assign(next,{removedId:id,phase:'edit',alternativeRemovedId:null,comparisonBasis:null,compareChoice:null,confirmed:false});delete next.finishedAt;return next;
}
export function startDifficultEditComparison(record,works) {
  if(!validDifficultEditDraft(record,works)||!record.removedId||!record.offeredIds.every(id=>record.presentedIds.includes(id)))return record;
  const alternative=alternativeFor(record,works),next=structuredClone(record);Object.assign(next,{phase:'compare',alternativeRemovedId:alternative.id,comparisonBasis:alternative.basis,compareChoice:null,confirmed:false});delete next.finishedAt;return next;
}
export function chooseDifficultEditComparison(record,choice,works) {
  if(!validDifficultEditDraft(record,works)||record.phase!=='compare'||!CHOICES.includes(choice))return record;
  if(record.compareChoice===choice)return record;
  const next=structuredClone(record);next.compareChoice=choice;next.confirmed=false;delete next.finishedAt;return next;
}
export function resetDifficultEditComparison(record,works) {
  if(!validDifficultEditDraft(record,works))return record;const next=structuredClone(record);Object.assign(next,{phase:'edit',alternativeRemovedId:null,comparisonBasis:null,compareChoice:null,confirmed:false});delete next.finishedAt;return next;
}

const evidence=(record,label,detail,workIds)=>({roundId:'scenario:'+record.id,label,detail,workIds:unique(workIds)});
function finding(record,key,titleText,text,support,options={}) {
  return {id:'difficult-edit-'+record.id+'-'+key,title:titleText,text,kind:'curation',priority:8,support,counter:[],alternatives:[],...options,evidence:unique([...support,...(options.counter||[])].flatMap(e=>e.workIds))};
}
export function analyzeDifficultEdit(works,record,previousRecords=[]) {
  if(!validDifficultEdit(record,works))return [];
  const walls=difficultEditWalls(record),name=id=>title(workById(works,id)),list=ids=>ids.map(name).join('; '),removed=record.removedId,other=record.alternativeRemovedId;
  const editEv=evidence(record,'Initial edit',`You put ${name(removed)} in storage and kept ${list(walls.initial)}.`,record.offeredIds);
  const compareEv=evidence(record,'Two walls',`The alternative restored ${name(removed)} in the position occupied by ${name(other)}. The other two works stayed in the same positions. You chose ${record.compareChoice==='equal'?'either wall':record.compareChoice==='initial'?'the initial wall':'the alternative wall'}.`,record.offeredIds);
  const alternatives=['Putting a work in storage is a decision about this wall, not a recorded dislike.','Only one of the three displayed positions changed in the comparison. The source room and the imagined display may still affect the decision.','The reproductions use a shared display size and do not reproduce the original physical scale.',...(record.comparisonBasis==='earlier-preference'?['The alternative was selected using the earlier ratings. It is a targeted comparison, not an independent test of a general preference.']:[])];
  let titleText,text;
  if(record.compareChoice==='initial'){titleText='The original edit held up against an alternative.';text=`You first put ${name(removed)} in storage. When offered a wall restoring it in place of ${name(other)}, you kept the original three-work wall.`;}
  else if(record.compareChoice==='alternative'){titleText='The alternative changed your edit.';text=`You first put ${name(removed)} in storage, then chose a wall restoring it and putting ${name(other)} back instead. The other two works stayed in place.`;}
  else {titleText='Both three-work walls remained possible.';text=`You first put ${name(removed)} in storage, then gave equal preference to the wall restoring it in place of ${name(other)}. This comparison did not identify one unique set of three to keep.`;}
  const findings=[finding(record,'comparison',titleText,text,[editEv,compareEv],{priority:record.compareChoice==='equal'?7:10,alternatives})];
  const pref=preference(works,record.baselineAnswers),a=pref?.positions[removed],b=pref?.positions[other];
  if(record.compareChoice!=='equal'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>=15) {
    const finalRemoved=record.compareChoice==='initial'?removed:other,finalKept=record.compareChoice==='initial'?other:removed,removedHigher=pref.positions[finalRemoved]>pref.positions[finalKept];
    const prior={roundId:'preferenceRank',label:'Earlier preference',detail:`${name(removed)}: ${a}; ${name(other)}: ${b} on the preference scale captured when this exercise began.`,workIds:[removed,other]};
    findings.push(finding(record,'preference',removedHigher?'A higher-rated work stayed outside this wall.':'The final wall agreed with this earlier preference.',removedHigher?`You had rated ${name(finalRemoved)} above ${name(finalKept)} individually. The wall you chose kept ${name(finalKept)} and left ${name(finalRemoved)} in storage, even after both versions were available to compare.`:`Your chosen wall kept ${name(finalKept)} and left ${name(finalRemoved)} out. That agrees with the earlier individual preference for these two works; it does not establish what made the wall work.`,[prior,editEv,compareEv],{priority:removedHigher?14:6,alternatives:[...alternatives,'These are actual ratings for this earlier quartet. They do not rate the two other works or establish a general rule about your taste.']}));
  }
  const previous=[...previousRecords].reverse().find(r=>r.id!==record.id&&validDifficultEdit(r,works)&&sameSet(r.offeredIds,record.offeredIds));
  if(previous) {
    const same=previous.removedId===record.removedId;
    findings.push(finding(record,'revisit',same?'The same work was edited out twice.':'A different edit on another attempt.',`With the same four works offered, ${same?'you initially put the same work in storage both times':`the initial removal changed from ${name(previous.removedId)} to ${name(removed)}`}. This records those two attempts rather than a taste-consistency score.`,[evidence(previous,'Earlier edit',`Initial removal: ${name(previous.removedId)}.`,previous.offeredIds),editEv],{priority:5,alternatives:['Memory, a different intention or deliberate experimentation can affect a repeated task.']}));
  }
  return findings.sort((a,b)=>b.priority-a.priority);
}

export function createDifficultEdit({app,getRecord,setRecord,getWorks,image,esc,save,rerender,inspect}) {
  const histories=new Map();let drag=null,frame=null,suppressUntil=0;
  const root=()=>app.querySelector('.difficult-edit');
  const record=()=>getRecord();
  const work=id=>{const w=workById(getWorks(),id),snapshot=record()?.artworkSources?.find(s=>s.id===id);return w&&snapshot?{...w,...snapshot}:w;};
  const valid=()=>validDifficultEditDraft(record(),getWorks());
  const render=(previousPhase=null,recordId=record()?.id)=>{
    rerender();
    if(previousPhase!==null&&record()?.phase!==previousPhase&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{
      if(record()?.id!==recordId||!root())return;
      const heading=root().querySelector('#question-title');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
    });
  };
  function remember(){const d=record(),stack=histories.get(d.id)||[];stack.push(structuredClone(d));histories.set(d.id,stack.slice(-24));}
  function update(next){if(next===record())return false;const before=record();remember();setRecord(next);save();render(before.phase,before.id);return true;}
  function mountedReady(){const element=root(),d=record();if(!element||!valid())return false;const imgs=[...element.querySelectorAll('img')];return imgs.length>0&&imgs.every(img=>img.complete&&img.naturalWidth>0)&&d.offeredIds.every(id=>imgs.some(img=>img.dataset.artwork===id));}
  function sync(){
    const element=root();if(!element){clearDrag();return;}
    const imgs=[...element.querySelectorAll('img')],failed=imgs.filter(img=>img.complete&&!img.naturalWidth),ready=mountedReady(),d=record();
    const status=element.querySelector('[data-difficult-image-status]');if(status){status.hidden=ready;status.innerHTML=ready?'':failed.length?'An artwork could not load. <button class="text-button" type="button" data-action="difficult-retry">Retry images</button>':'Loading the four works…';}
    if(ready&&!d.offeredIds.every(id=>d.presentedIds.includes(id))){d.presentedIds=[...d.offeredIds];save();}
    for(const button of element.querySelectorAll('[data-action="difficult-remove"],[data-action="difficult-putback"],[data-action="difficult-choice"]'))button.disabled=!ready;
    const compare=element.querySelector('[data-action="difficult-compare"]');if(compare)compare.disabled=!ready||!d.removedId;
    const finish=element.querySelector('[data-action="lab-finish"]');if(finish)finish.disabled=!ready||!validDifficultEdit(d,getWorks(),false);
    const undo=element.querySelector('[data-action="difficult-undo"]');if(undo)undo.disabled=!histories.get(d?.id)?.length;
  }
  function art(id,action='difficult-remove') {const w=work(id);return `<figure class="difficult-work"><button class="difficult-art" type="button" data-action="${action}" data-difficult-work="${esc(id)}" aria-label="${esc(action==='difficult-remove'?'Put '+title(w)+' in storage':'Return '+title(w)+' to the wall')}">${image(w)}</button><figcaption><span>${esc(title(w))}</span><button class="text-button" type="button" data-action="difficult-inspect" data-work="${esc(id)}" aria-label="Look closer at ${esc(title(w))}">Look closer ↗</button></figcaption></figure>`;}
  function compareWall(variant,label) {const d=record(),ids=difficultEditWalls(d)[variant],selected=d.compareChoice===variant;return `<section class="difficult-comparison-wall ${selected?'wall-selected':''}" data-version="${variant}"><div class="difficult-version-heading"><span class="eyebrow">Wall ${label}</span><button class="difficult-wall-choice" type="button" data-action="difficult-choice" data-choice="${variant}" aria-pressed="${selected}"><span class="difficult-choice-dot" aria-hidden="true"></span>${selected?'Wall '+label+' selected':'Keep wall '+label}</button></div><button class="difficult-wall-surface" type="button" data-action="difficult-choice" data-choice="${variant}" aria-pressed="${selected}" aria-label="Choose wall ${label}"><span class="difficult-comparison-art">${ids.map(id=>`<span class="difficult-preview-item">${image(work(id))}<span>${esc(title(work(id)))}</span></span>`).join('')}</span></button></section>`;}
  function markup(){
    const d=record();if(!isDifficultEdit(d))return '';
    if(!valid())return '<section class="difficult-edit"><h1 id="question-title">This wall cannot be reopened.</h1><p>A referenced work or part of the saved comparison is unavailable. No replacement has been chosen.</p><button class="text-button" type="button" data-action="lab-home">← Exercises</button></section>';
    const comparing=d.phase==='compare',source=d.source.kind==='gallery-room'?'From your '+d.source.roomName:'Four works from the collection';
    return `<section class="difficult-edit" data-difficult-step="${d.phase}"><header class="difficult-top"><button class="text-button" type="button" data-action="lab-home">← Exercises</button><span>${esc(source)}</span><span>${comparing?'02':'01'} / 02</span></header><div class="difficult-question"><p class="eyebrow">The difficult edit</p><h1 id="question-title">${comparing?'Which wall would you keep?':'One work must go.'}</h1><p>${comparing?'Both versions keep three works. Two stay in the same positions; one changes.':'Keep three works on this wall. Drag one into storage, or tap it to put it back.'}</p></div><div class="difficult-image-status" data-difficult-image-status role="status" hidden></div>
      ${comparing?`<div class="difficult-comparisons">${d.comparisonOrder.map((variant,i)=>compareWall(variant,i?'B':'A')).join('')}</div><button class="difficult-equal-choice" type="button" data-action="difficult-choice" data-choice="equal" aria-pressed="${d.compareChoice==='equal'}"><span class="difficult-choice-dot" aria-hidden="true"></span>Either wall works equally well for me</button>`:`<div class="difficult-wall" data-difficult-wall>${d.offeredIds.map(id=>id===d.removedId?`<div class="difficult-empty-slot"><span>In storage</span><button class="text-button" type="button" data-action="difficult-putback">Return to the wall</button></div>`:art(id)).join('')}</div><div class="difficult-storage" data-difficult-storage><div><span class="eyebrow">Storage</span><p>${d.removedId?'This work is off the wall.':'Drop one work here.'}</p></div>${d.removedId?`<button class="difficult-stored-art" type="button" data-action="difficult-putback" data-difficult-work="${esc(d.removedId)}" aria-label="Return ${esc(title(work(d.removedId)))} to the wall">${image(work(d.removedId))}<span>${esc(title(work(d.removedId)))}</span></button>`:'<span class="difficult-storage-mark" aria-hidden="true">↓</span>'}</div>`}
      <p class="difficult-live" data-difficult-live role="status" aria-live="polite">${comparing?(d.compareChoice==='equal'?'You left the two versions equal.':d.compareChoice?'A wall is selected. Confirm when ready.':'Choose a wall, or leave the versions equal.'):d.removedId?title(work(d.removedId))+' is in storage. You can change the edit.':'All four works are on the wall.'}</p><div class="difficult-actions"><div><button class="text-button" type="button" data-action="${comparing?'difficult-edit-again':'lab-home'}">${comparing?'← Change the edit':'Save and come back later'}</button><button class="text-button" type="button" data-action="difficult-undo">Undo</button></div><button class="primary-button" type="button" data-action="${comparing?'lab-finish':'difficult-compare'}" disabled>${comparing?'Read this decision':'Compare two versions'} →</button></div></section>`;
  }
  function remove(id){if(mountedReady())update(setDifficultEditRemoval(record(),id,getWorks()));}
  function clearDrag(){if(frame)cancelAnimationFrame(frame);frame=null;drag?.ghost?.remove();drag=null;root()?.querySelectorAll('.is-dragging,.is-drag-over').forEach(el=>el.classList.remove('is-dragging','is-drag-over'));}
  function within(element,x,y){if(!element)return false;const b=element.getBoundingClientRect();return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;}
  function hover(){if(!drag?.ghost)return;const delta=drag.y<50?-8:drag.y>innerHeight-50?8:0;if(delta)window.scrollBy(0,delta);for(const el of root()?.querySelectorAll('[data-difficult-storage],[data-difficult-wall]')||[])el.classList.toggle('is-drag-over',within(el,drag.x,drag.y));frame=requestAnimationFrame(hover);}
  app.addEventListener('load',()=>{if(root())sync();},true);app.addEventListener('error',()=>{if(root())sync();},true);
  app.addEventListener('dragstart',event=>{if(event.target.closest('.difficult-edit [data-difficult-work]'))event.preventDefault();});
  app.addEventListener('pointerdown',event=>{const element=event.target.closest('.difficult-edit [data-difficult-work]');if(!element||record()?.phase!=='edit'||event.button!==0||!mountedReady())return;drag={id:element.dataset.difficultWork,recordId:record().id,element,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,ghost:null};element.setPointerCapture?.(event.pointerId);});
  app.addEventListener('pointermove',event=>{if(!drag)return;if(record()?.id!==drag.recordId||!root()){clearDrag();return;}drag.x=event.clientX;drag.y=event.clientY;if(!drag.ghost&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7){drag.ghost=document.createElement('div');drag.ghost.className='difficult-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.innerHTML=image(work(drag.id));document.body.append(drag.ghost);drag.element.classList.add('is-dragging');hover();}if(drag.ghost){if(event.cancelable)event.preventDefault();drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';}});
  app.addEventListener('pointerup',event=>{if(!drag)return;const moved=!!drag.ghost,id=drag.id,sameRecord=record()?.id===drag.recordId;clearDrag();if(!moved||!sameRecord)return;suppressUntil=Date.now()+180;if(within(root()?.querySelector('[data-difficult-storage]'),event.clientX,event.clientY))remove(id);else if(id===record().removedId&&within(root()?.querySelector('[data-difficult-wall]'),event.clientX,event.clientY))remove(null);else{const status=root()?.querySelector('[data-difficult-live]');if(status)status.textContent='Drop onto storage to take a work off the wall.';}});
  app.addEventListener('pointercancel',clearDrag);
  app.addEventListener('keydown',event=>{if(!root())return;if(event.key==='Escape'){clearDrag();return;}const element=event.target.closest('[data-difficult-work]');if(!element||record().phase!=='edit')return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const buttons=[...root().querySelectorAll('[data-difficult-work]')],index=buttons.indexOf(element);buttons[(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();}if(['Delete','Backspace'].includes(event.key)){event.preventDefault();remove(element.dataset.difficultWork===record().removedId?null:element.dataset.difficultWork);}});
  return {markup,sync,mountedReady,handle(action,control){
    if(!action?.startsWith('difficult-'))return false;if(Date.now()<suppressUntil&&['difficult-remove','difficult-putback'].includes(action))return true;
    if(action==='difficult-retry'){for(const img of root()?.querySelectorAll('img')||[])if(img.complete&&!img.naturalWidth){const w=work(img.dataset.artwork);if(w)img.src='./'+w.image+'?retry='+Date.now();}sync();return true;}
    if(!isDifficultEdit(record())||!valid())return true;
    if(action==='difficult-remove'&&record().phase==='edit')remove(control.dataset.difficultWork);
    if(action==='difficult-putback'&&record().phase==='edit')remove(null);
    if(action==='difficult-compare'&&mountedReady())update(startDifficultEditComparison(record(),getWorks()));
    if(action==='difficult-choice'&&mountedReady())update(chooseDifficultEditComparison(record(),control.dataset.choice,getWorks()));
    if(action==='difficult-edit-again')update(resetDifficultEditComparison(record(),getWorks()));
    if(action==='difficult-undo'){const before=record(),stack=histories.get(before.id),previous=stack?.pop();if(previous){previous.confirmed=false;delete previous.finishedAt;setRecord(previous);save();render(before.phase,before.id);}}
    if(action==='difficult-inspect'){const id=control.dataset.work;if(record().offeredIds.includes(id)){record().labelExposureIds=unique([...record().labelExposureIds,id]);save();inspect?.(id);}}
    return true;
  }};
}
