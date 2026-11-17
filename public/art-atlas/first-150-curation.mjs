import FIRST_150 from './first-150-curation.json' with {type:'json'};
import {routeCollection} from './collection-routing.mjs';
import {extendStimulusReservations} from './stimulus-planner.mjs';

const PLAN=FIRST_150;
const openingIds=PLAN.openingPanels.flatMap(panel=>panel.workIds);
const earlyIds=[...openingIds,...PLAN.laterBlocks.flatMap(block=>block.workIds)];
const sameIds=(left,right)=>left.length===right.length&&left.every(id=>right.includes(id));

export function releasedForQuiz(workId,batchIndex,reservations){
  return batchIndex+1>=(reservations?.minimumQuizBlock?.[workId]??1);
}

/** The release determines ordinary first-150 membership. The allocator can
 * still fill later capacity, and a saved allocation pins its own older design.
 */
export function declaredFirst150(works,notes,{reservationPlan,firstWorkIds,startBatch=1}={}){
  if(reservationPlan&&reservationPlan.earlyCurationRevision!==PLAN.revision)return null;
  if(firstWorkIds?.length&&!sameIds(firstWorkIds,openingIds))return null;
  const routed=routeCollection(works,reservationPlan?.collectionRouting,notes);
  const byId=new Map(routed.studyWorks.map(work=>[work.id,work]));
  if(earlyIds.some(id=>!byId.get(id)?.image||!byId.get(id)?.sourceUrl))return null;
  const earlyPools=Object.fromEntries(PLAN.laterBlocks.map(block=>['batch'+block.block,[...block.workIds]]));
  const fixed=reservationPlan||{...earlyPools,earlyCurationRevision:PLAN.revision,deferredUntilAfter150:[...PLAN.deferrals],minimumQuizBlock:{...PLAN.minimumQuizBlock}};
  const reservePools=extendStimulusReservations({works:routed.studyWorks,firstWorkIds:openingIds,reservationPlan:fixed,startBatch,preferredOrder:PLAN.deferrals,deferEastAsian:true,curationNotes:notes});
  reservePools.collectionRouting=routed.metadata;
  return {
    ...notes,
    studyDesignRevision:PLAN.revision,
    collectionRouting:routed.metadata,
    reservePools,
    earlyComparisonPairs:Object.fromEntries(PLAN.laterBlocks.map(block=>[block.block,block.comparisons])),
    proposedFirst18Panels:PLAN.openingPanels.map(panel=>({
      panel:panel.panel,workIds:[...panel.workIds],galleryTitle:panel.title,
      primaryQuestion:panel.purposes.join(' '),
      comparisonObjectives:{title:panel.title,qualities:[...panel.qualities],purposes:[...panel.purposes]},
      sourceUrls:panel.workIds.map(id=>byId.get(id).sourceUrl),
      questionUse:'Anchored personal appeal, with separately reported judgments where scheduled.',
      confounds:['Subject, artist, medium, recognition and other visual qualities can differ within a group.']
    }))
  };
}
