import {FAMILIARITY_SELECTION_PROTOCOL,isExplicitFamiliarity} from './discovery-grid.mjs';
import {isRecognitionWithCertainty} from './recognition-evidence.mjs';

export const FAMILIARITY_SELECTION_HINT='Select any you had seen before Art Atlas. Tap again to undo.';

/** Simplify active, unfinished tasks; archive the original definition and draft.
 * Completed answers keep their original measurement and certainty reports. */
export function simplifyActiveInteraction(round,answer,{force=false}={}){
  if(!round||answer?.skipped||answer?.confirmed&&!force)return null;
  const familiarity=isExplicitFamiliarity(round),recognition=isRecognitionWithCertainty(round);
  if(!familiarity&&!recognition)return null;
  const updated=structuredClone(round),draft=answer?structuredClone(answer):undefined;
  if(familiarity){
    updated.hint=FAMILIARITY_SELECTION_HINT;
    updated.evidence={...updated.evidence,familiarityProtocol:FAMILIARITY_SELECTION_PROTOCOL,previousFamiliarityProtocol:round.evidence.familiarityProtocol};
    if(draft){draft.selectedIds=round.works.map(work=>work.id).filter(id=>answer.familiarity?.[id]==='seen'||answer.selectedIds?.includes(id));delete draft.familiarity;draft.explicitNone=answer.explicitNone===true&&!draft.selectedIds.length;draft.unsure=answer.unsure===true&&!draft.selectedIds.length;draft.confirmed=false;}
  }else{
    updated.evidence={...updated.evidence,instrumentRevision:'cued-attribution-v2',previousInstrumentRevision:round.evidence.instrumentRevision};
    if(draft){delete draft.certainty;draft.confirmed=false;}
  }
  return {round:updated,draft,reason:familiarity?'Restore gallery selection; unselected paintings remain unknown.':'Remove the per-painting attribution questionnaire.'};
}
