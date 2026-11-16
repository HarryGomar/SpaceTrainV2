import {hasRegionalCuration,isLaterCurationWork,isWesternAmericasWork} from './curation-sequence.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import CURATION_NOTES from './curation-notes.json' with {type:'json'};

export const COLLECTION_ROUTING_VERSION='primary-classics-americas-v1';
const unique=values=>[...new Set(values)];
/** Keep the full source collection. Editorial routing changes the default
 * collection, never an artwork identity or a recorded viewer preference. */
export function routeCollection(works=[],prior=null,notes=CURATION_NOTES){
  notes=notes&&typeof notes==='object'&&!Array.isArray(notes)?notes:CURATION_NOTES;
  const records=(Array.isArray(works)?works:[]).filter(work=>typeof work?.id==='string'),enabled=prior?.version===COLLECTION_ROUTING_VERSION||hasRegionalCuration(records),captured=new Set(prior?.catalogueWorkIds||[]),wasMain=new Set(prior?.mainWorkIds||[]),main=[],world=[];
  for(const work of records){const primary=!enabled||captured.has(work.id)?!enabled||wasMain.has(work.id):!isLaterCurationWork(work,notes);(primary?main:world).push(work);}
  const studyWorks=main.filter(isStudyEligibleArtwork),metadata={version:COLLECTION_ROUTING_VERSION,enabled,catalogueWorkIds:unique(records.map(work=>work.id)),mainWorkIds:unique(main.map(work=>work.id)),worldWorkIds:unique(world.map(work=>work.id)),activeStudyWorkIds:unique(studyWorks.map(work=>work.id)),source:'Editorial Western/Americas and Mexican focus, retaining a few global anchors. Great Wave is an explicit early exception.',scope:'Collection routing is not a personal preference, creation-location claim, popularity estimate or annotation value.'};
  return {main,world,studyWorks,metadata,coverage:{catalogue:records.length,main:main.length,world:world.length,activeStudy:studyWorks.length,mainWesternAmericas:main.filter(work=>isWesternAmericasWork(work,notes)).length}};
}
export const mainCollectionWorks=(works,prior,notes)=>routeCollection(works,prior,notes).main;
