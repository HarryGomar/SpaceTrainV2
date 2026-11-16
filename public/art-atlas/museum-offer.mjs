export const MUSEUM_OFFER_SCOPE='earlier-rounds-v1';
const unique=values=>[...new Set(values)];

/** Earlier entered image questions count as shown, not as proof of attention. */
export function museumOffer({catalogue=[],plan=[],shown={},answers={},roundId,currentRecord}={}){
  const known=new Set(catalogue.map(work=>work.id)),index=plan.findIndex(round=>round.id===roundId),eligible=new Set(),sourceRoundIds=[];
  if(index<0)return {workIds:[],sourceRoundIds,scope:MUSEUM_OFFER_SCOPE};
  for(const planned of plan.slice(0,index)){
    const round=shown[planned.id];
    if(!round||round.kind==='statements'||round.evidence?.stimulusVisibility==='not-shown')continue;
    const record=answers[round.id]?.record;
    const ids=round.kind==='exercise'?[...(record?.presentedIds||[]),...Object.keys(record?.placements||{}),...Object.keys(record?.positions||{})]:[...(round.workIds||[]),...(round.anchorIds||[])];
    const allowed=ids.filter(id=>known.has(id));if(!allowed.length)continue;
    allowed.forEach(id=>eligible.add(id));sourceRoundIds.push(round.id);
  }
  // An active older museum may already have shown/placed some works. Keep them.
  for(const id of [...(currentRecord?.presentedIds||[]),...Object.keys(currentRecord?.placements||{})])if(known.has(id))eligible.add(id);
  return {workIds:catalogue.map(work=>work.id).filter(id=>eligible.has(id)),sourceRoundIds:unique(sourceRoundIds),scope:MUSEUM_OFFER_SCOPE};
}

export function restrictMuseumDraft(record,workIds){
  const allowed=new Set(workIds);if(record.confirmed||Object.keys(record.placements||{}).some(id=>!allowed.has(id)))return record;
  const next=structuredClone(record);next.offeredIds=next.offeredIds.filter(id=>allowed.has(id));
  next.presentedIds=(next.presentedIds||[]).filter(id=>allowed.has(id));next.labelExposureIds=(next.labelExposureIds||[]).filter(id=>allowed.has(id));next.offerScope=MUSEUM_OFFER_SCOPE;
  if(next.ui&&!allowed.has(next.ui.selectedId))next.ui.selectedId=next.offeredIds[0];
  return next;
}

export function galleryWheelPosition({scrollLeft,scrollWidth,clientWidth,deltaX=0,deltaY=0,deltaMode=0,ctrlKey=false}){
  if(ctrlKey||![scrollLeft,scrollWidth,clientWidth,deltaX,deltaY].every(Number.isFinite)||scrollWidth<=clientWidth)return null;
  const units=deltaMode===1?16:deltaMode===2?clientWidth:1,delta=(Math.abs(deltaX)>Math.abs(deltaY)?deltaX:deltaY)*units;
  const next=Math.max(0,Math.min(scrollWidth-clientWidth,scrollLeft+delta));return next===scrollLeft?null:next;
}
