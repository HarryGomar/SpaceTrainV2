import {continuousAppealValue} from './continuous-preference.mjs';

export const RECOGNITION_PROTOCOL='recognition-certainty-v1';
export const RECOGNITION_CERTAINTY=Object.freeze(['recognised','inferred','guessed','unsure']);
export const isRecognitionWithCertainty=round=>round?.kind==='match'&&round.evidence?.instrumentRevision===RECOGNITION_PROTOCOL;
export function sanitizeRecognitionCertainty(round,answer){
  return Object.fromEntries(round.works.filter(work=>RECOGNITION_CERTAINTY.includes(answer?.certainty?.[work.id])).map(work=>[work.id,answer.certainty[work.id]]));
}
export function validRecognitionCertainty(round,answer){
  if(!isRecognitionWithCertainty(round))return true;
  const value=answer?.certainty;
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===round.works.length&&round.works.every(work=>RECOGNITION_CERTAINTY.includes(value[work.id])&&(answer.guesses[work.id]!=='unsure'||value[work.id]==='unsure'));
}

/** Actual shown records describe exposure, never comprehension or prior
 * expertise. Missing historical feedback markers remain unknown. */
export function captureArtworkExposure(round,history=[],answers={}){
  const workIds=round.works.map(work=>work.id),byWork=Object.fromEntries(workIds.map(workId=>[workId,{protocol:'artwork-exposure-v1',imageRoundIds:[],labelRoundIds:[],artistLabelRoundIds:[],movementLabelRoundIds:[],noteRoundIds:[],unknownLabelRoundIds:[]}]));
  for(const source of history){
    if(!source||source.id===round.id||source.unavailable||source.kind==='statements'||source.evidence?.stimulusVisibility==='not-shown')continue;
    const answer=answers[source.id],record=answer?.record;
    const presented=source.kind==='exercise'?(record?.presentedIds||[]):source.kind==='choice-grid'&&source.evidence?.instrumentRevision==='paged-favourites-v1'?(answer?.presentation?.visitedPages||[]).flatMap(page=>source.works.slice(page*18,(page+1)*18).map(work=>work.id)):[...(source.works||[]),...(source.anchorWorks||[])].map(work=>work.id);
    for(const workId of workIds){const target=byWork[workId];if(presented.includes(workId))target.imageRoundIds.push(source.id);
      if(source.kind==='match'&&answer?.confirmed===true&&source.works.some(work=>work.id===workId)){if(answer.feedbackSeen===true&&['artist','movement'].includes(source.field)){target.labelRoundIds.push(source.id);target[source.field+'LabelRoundIds'].push(source.id);}else target.unknownLabelRoundIds.push(source.id);}
      if(source.kind==='context'&&answer?.storySeen===true&&source.works.some(work=>work.id===workId)){target.noteRoundIds.push(source.id);target.unknownLabelRoundIds.push(source.id);}
      if(record?.labelExposureIds?.includes(workId)||record?.detailExposureIds?.includes(workId)){target.labelRoundIds.push(source.id);target.artistLabelRoundIds.push(source.id);target.unknownLabelRoundIds.push(source.id);}
      if(source.evidence?.galleryPreview?.availableMatchedWorkIds?.includes(workId))target.unknownLabelRoundIds.push(source.id);
    }
  }
  for(const target of Object.values(byWork))for(const field of ['imageRoundIds','labelRoundIds','artistLabelRoundIds','movementLabelRoundIds','noteRoundIds','unknownLabelRoundIds'])target[field]=[...new Set(target[field])];
  return {protocol:'artwork-exposure-v1',works:byWork,scope:'Recorded presentation and explicit label/note exposure before this question. No attention or pre-quiz familiarity is inferred.'};
}



/** Bind the single cued attribution to actual, answered appeal questions. */
export function bindTasteAttribution(round,shown,answers){
  const entries=new Map();
  for(const source of shown)for(const work of source.works){
    if(!work.artist||work.artistKnown===false||/unknown|unidentified|anonymous|workshop|circle/i.test(work.artist))continue;
    const value=continuousAppealValue(source,answers[source.id],work.id);
    if(value!==null)entries.set(work.id,{work,value,sourceRoundId:source.id});
  }
  const rows=[...entries.values()],exposure=captureArtworkExposure({id:round.id,works:rows.map(row=>row.work)},shown,answers).works;
  const selected=[],artists=new Set();
  for(const side of [1,-1,1,-1]){
    const row=rows.filter(item=>!artists.has(item.work.artist)).sort((a,b)=>{
      const cost=item=>Math.abs(side===1?100-item.value:item.value)+25*Number(!!exposure[item.work.id].artistLabelRoundIds.length)+10*Number(!!exposure[item.work.id].unknownLabelRoundIds.length);
      return cost(a)-cost(b)||a.work.id.localeCompare(b.work.id);
    })[0];
    if(!row)break;
    selected.push(row);artists.add(row.work.artist);
  }
  const {bindFromShownAppeal,...evidence}=round.evidence;
  if(selected.length<4)return {...round,evidence:{...evidence,selectionMethod:'cued-attribution-catalogue-fallback'}};
  const works=selected.map(row=>row.work),labels=[works[2],works[0],works[3],works[1]];
  return {...round,works,workIds:works.map(work=>work.id),options:labels.map((work,index)=>({id:'artist-'+index,label:work.artist})),
    evidence:{...evidence,selectionMethod:'taste-linked-from-answered-appeal',sourceRoundIds:[...new Set(selected.map(row=>row.sourceRoundId))],earlierAppeal:selected.map(({work,value,sourceRoundId})=>({workId:work.id,value,sourceRoundId}))}};
}
