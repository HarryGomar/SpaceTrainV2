const ids=round=>round.works.map(work=>work.id);
export const PAGED_FAVOURITES='paged-favourites-v1',FAVOURITES_PAGE_SIZE=18;
const paged=round=>['overall-favourites','overall-dislikes'].includes(round?.evidence?.construct)&&round.evidence.instrumentRevision===PAGED_FAVOURITES;
function validPresentation(round,value){const pages=Math.ceil(round.works.length/FAVOURITES_PAGE_SIZE);return value?.protocol===PAGED_FAVOURITES&&value.pageSize===FAVOURITES_PAGE_SIZE&&Array.isArray(value.visitedPages)&&value.visitedPages.length>0&&new Set(value.visitedPages).size===value.visitedPages.length&&value.visitedPages.includes(0)&&value.visitedPages.every(page=>Number.isInteger(page)&&page>=0&&page<pages)&&Number.isInteger(value.activePage)&&value.visitedPages.includes(value.activePage);}
export function choiceGridExposure(round,answer){
  if(!paged(round)||!validPresentation(round,answer?.presentation))return null;
  const all=ids(round),coPresentedGroups=answer.presentation.visitedPages.map(page=>all.slice(page*FAVOURITES_PAGE_SIZE,(page+1)*FAVOURITES_PAGE_SIZE));
  return {presentedIds:[...new Set(coPresentedGroups.flat())],coPresentedGroups};
}
export function setChoiceGridPage(round,draft,page){
  const next=sanitizeChoiceGrid(round,draft);if(!paged(round)||!Number.isInteger(page)||page<0||page>=Math.ceil(round.works.length/FAVOURITES_PAGE_SIZE))return next;
  next.presentation.activePage=page;if(!next.presentation.visitedPages.includes(page))next.presentation.visitedPages.push(page);return next;
}
export function expandKeepSelectionRound(round){
  if(round?.kind!=='choice-grid'||round.selectionMode!=='shortlist'||['overall-favourites','overall-dislikes'].includes(round.evidence?.construct)||!Array.isArray(round.works)||(round.maxChoices||3)>=round.works.length)return null;
  return {...round,maxChoices:round.works.length,hint:'Select any paintings you would keep. Tap again to change a choice.',evidence:{...round.evidence,construct:'unranked-subset-selection',instrumentRevision:'keep-selection-grid-v2',previousSelectionLimit:round.maxChoices||3,limits:['Select any number. Unselected works are not dislikes or ranks.']}};
}
export function sanitizeChoiceGrid(round,answer={}){
  const offered=ids(round),max=round.selectionMode==='familiarity'?offered.length:round.maxChoices||3;
  const selectedIds=Array.isArray(answer.selectedIds)?[...new Set(answer.selectedIds.filter(id=>offered.includes(id)))].slice(0,max):[];
  return {workIds:offered,selectionMode:round.selectionMode,selectedIds,explicitNone:answer.explicitNone===true&&!selectedIds.length,unsure:(round.selectionMode==='familiarity'||round.allowUnsure===true)&&answer.unsure===true&&!selectedIds.length,confirmed:false,...(paged(round)?{presentation:validPresentation(round,answer.presentation)?structuredClone(answer.presentation):{protocol:PAGED_FAVOURITES,pageSize:FAVOURITES_PAGE_SIZE,visitedPages:[0],activePage:0}}:{})};
}
export function validChoiceGrid(round,answer){
  const offered=ids(round),selected=answer?.selectedIds,max=round.selectionMode==='familiarity'?offered.length:round.maxChoices||3;
  if(round.selectionMode==='shortlist'&&round.maxChoices!==undefined&&(!Number.isInteger(round.maxChoices)||round.maxChoices<1||round.maxChoices>offered.length))return false;
  if(paged(round)){const exposure=choiceGridExposure(round,answer);if(!exposure||!Array.isArray(selected)||selected.some(id=>!exposure.presentedIds.includes(id)))return false;}
  return ['familiarity','shortlist'].includes(round.selectionMode)&&answer?.confirmed ===true&&!answer.skipped&&Array.isArray(answer.workIds)&&answer.workIds.join('|')===offered.join('|')&&answer.selectionMode===round.selectionMode&&Array.isArray(selected)&&new Set(selected).size===selected.length&&selected.every(id=>offered.includes(id))&&selected.length<=max&&(selected.length>0&&answer.explicitNone===false&&!answer.unsure||selected.length===0&&answer.explicitNone===true&&!answer.unsure||selected.length===0&&answer.unsure===true&&(round.selectionMode==='familiarity'||round.allowUnsure===true)&&!answer.explicitNone);
}
export function toggleGridChoice(round,draft,workId){
  const next=sanitizeChoiceGrid(round,draft);if(!ids(round).includes(workId))return next;
  if(next.selectedIds.includes(workId))next.selectedIds=next.selectedIds.filter(id=>id!==workId);
  else if(next.selectedIds.length<(round.selectionMode==='familiarity'?round.works.length:round.maxChoices||3))next.selectedIds.push(workId);
  next.explicitNone=false;next.unsure=false;return next;
}
export function discoveryGridMarkup(round,draft,{image,esc}){
  const hasPages=paged(round),page=hasPages&&validPresentation(round,draft.presentation)?draft.presentation.activePage:0,pageCount=Math.ceil(round.works.length/FAVOURITES_PAGE_SIZE),visible=hasPages?round.works.slice(page*FAVOURITES_PAGE_SIZE,(page+1)*FAVOURITES_PAGE_SIZE):round.works,columns=hasPages?6:round.works.length>12?5:4;
  return `<div class="discovery-grid" data-grid-mode="${round.selectionMode}"><div class="discovery-pictures" style="--grid-count:${round.works.length};--discovery-columns:${columns};--discovery-rows:${Math.ceil(visible.length/columns)};--discovery-mobile-rows:${Math.ceil(visible.length/3)}">${visible.map((work,index)=>`<button type="button" class="discovery-work" data-action="deep-grid-pick" data-work="${esc(work.id)}" aria-label="${round.selectionMode==='familiarity'?'Seen before':round.evidence?.construct==='overall-favourites'?'Favourite':round.evidence?.construct==='overall-dislikes'?'Dislike':'Keep'} painting ${index+1+(hasPages?page*FAVOURITES_PAGE_SIZE:0)}" aria-pressed="${draft.selectedIds?.includes(work.id)===true}"><span class="discovery-art art-visual">${image(work)}</span></button>`).join('')}</div><div class="discovery-grid-tools"><div class="discovery-none-options"><button type="button" class="discovery-none" data-action="deep-grid-none" aria-pressed="${draft.explicitNone===true}"><span aria-hidden="true"></span>None of these</button>${round.selectionMode==='familiarity'||round.allowUnsure===true?`<button type="button" class="discovery-none" data-action="deep-grid-unsure" aria-pressed="${draft.unsure===true}"><span aria-hidden="true"></span>Not sure</button>`:''}</div>${hasPages?`<div class="favourite-pages" aria-label="Painting pages"><button type="button" data-action="deep-grid-page" data-page="${page-1}" aria-label="Previous paintings" ${page===0?'disabled':''}>←</button><span>${page+1} / ${pageCount}</span><button type="button" data-action="deep-grid-page" data-page="${page+1}" aria-label="Next paintings" ${page===pageCount-1?'disabled':''}>→</button></div>`:''}<span class="discovery-count" role="status">${draft.selectedIds?.length||0}${round.selectionMode==='shortlist'&&(round.maxChoices||3)<round.works.length?' / '+(round.maxChoices||3):''} selected</span></div></div>`;
}
