const ids=round=>round.works.map(work=>work.id);
export function expandKeepSelectionRound(round){
  if(round?.kind!=='choice-grid'||round.selectionMode!=='shortlist'||!Array.isArray(round.works)||(round.maxChoices||3)>=round.works.length)return null;
  return {...round,maxChoices:round.works.length,hint:'Select any paintings you would keep. Tap again to change a choice.',evidence:{...round.evidence,construct:'unranked-subset-selection',instrumentRevision:'keep-selection-grid-v2',previousSelectionLimit:round.maxChoices||3,limits:['Select any number. Unselected works are not dislikes or ranks.']}};
}
export function sanitizeChoiceGrid(round,answer={}){
  const offered=ids(round),max=round.selectionMode==='familiarity'?offered.length:round.maxChoices||3;
  const selectedIds=Array.isArray(answer.selectedIds)?[...new Set(answer.selectedIds.filter(id=>offered.includes(id)))].slice(0,max):[];
  return {workIds:offered,selectionMode:round.selectionMode,selectedIds,explicitNone:answer.explicitNone===true&&!selectedIds.length,unsure:round.selectionMode==='familiarity'&&answer.unsure===true&&!selectedIds.length,confirmed:false};
}
export function validChoiceGrid(round,answer){
  const offered=ids(round),selected=answer?.selectedIds,max=round.selectionMode==='familiarity'?offered.length:round.maxChoices||3;
  if(round.selectionMode==='shortlist'&&round.maxChoices!==undefined&&(!Number.isInteger(round.maxChoices)||round.maxChoices<1||round.maxChoices>offered.length))return false;
  return ['familiarity','shortlist'].includes(round.selectionMode)&&answer?.confirmed===true&&!answer.skipped&&Array.isArray(answer.workIds)&&answer.workIds.join('|')===offered.join('|')&&answer.selectionMode===round.selectionMode&&Array.isArray(selected)&&new Set(selected).size===selected.length&&selected.every(id=>offered.includes(id))&&selected.length<=max&&(selected.length>0&&answer.explicitNone===false&&!answer.unsure||selected.length===0&&answer.explicitNone===true&&!answer.unsure||selected.length===0&&answer.unsure===true&&round.selectionMode==='familiarity'&&!answer.explicitNone);
}
export function toggleGridChoice(round,draft,workId){
  const next=sanitizeChoiceGrid(round,draft);if(!ids(round).includes(workId))return next;
  if(next.selectedIds.includes(workId))next.selectedIds=next.selectedIds.filter(id=>id!==workId);
  else if(next.selectedIds.length<(round.selectionMode==='familiarity'?round.works.length:round.maxChoices||3))next.selectedIds.push(workId);
  next.explicitNone=false;next.unsure=false;return next;
}
export function discoveryGridMarkup(round,draft,{image,esc}){
  return `<div class="discovery-grid" data-grid-mode="${round.selectionMode}"><div class="discovery-pictures" style="--grid-count:${round.works.length}">${round.works.map((work,index)=>`<button type="button" class="discovery-work" data-action="deep-grid-pick" data-work="${esc(work.id)}" aria-label="${round.selectionMode==='familiarity'?'Seen before':'Keep'} painting ${index+1}" aria-pressed="${draft.selectedIds?.includes(work.id)===true}"><span class="discovery-art art-visual">${image(work)}</span></button>`).join('')}</div><div class="discovery-grid-tools"><div class="discovery-none-options"><button type="button" class="discovery-none" data-action="deep-grid-none" aria-pressed="${draft.explicitNone===true}"><span aria-hidden="true"></span>${round.selectionMode==='familiarity'?'None of these':'None of these'}</button>${round.selectionMode==='familiarity'?`<button type="button" class="discovery-none" data-action="deep-grid-unsure" aria-pressed="${draft.unsure===true}"><span aria-hidden="true"></span>Not sure</button>`:''}</div><span class="discovery-count" role="status">${draft.selectedIds?.length||0}${round.selectionMode==='shortlist'&&(round.maxChoices||3)<round.works.length?' / '+(round.maxChoices||3):''} selected</span></div></div>`;
}
