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
