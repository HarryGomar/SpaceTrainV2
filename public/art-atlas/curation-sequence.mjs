// Editorial sequencing by recorded cultural/practice context. These groups do
// not assert a creation location or describe the viewer's identity or taste.
export const CURATION_SEQUENCE='western-americas-first-v1';
export const EARLY_REQUIRED_IDS=Object.freeze(['req-brueghel-hearing','req-caravaggio-david-borghese','req-dore-quixote-library','req-rivera-controller-universe','req-birkhauser-worlds-wound']);
export const hasRegionalCuration=works=>EARLY_REQUIRED_IDS.every(id=>works.some(work=>work.id===id));
function context(work,notes={}){
  const annotation=notes.annotations?.find(item=>item.workId===work.id),values=[work.curationRegion,work.practiceContext,work.analysis?.practiceContext,work.culture,work.origin,work.country,annotation?.regionKey];
  return values.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>typeof value==='string').join(' ').toLowerCase();
}
const eastAsian=/east[- ]asia|\b(japan|japanese|china|chinese|korea|korean)\b/;
const southAsianHimalayan=/south[- ]asia|\b(india|indian|nepal|nepalese|tibet|tibetan|himalaya|himalayan|bhutan|bhutanese|sri lanka|sri lankan|pakistan|pakistani|bangladesh|bangladeshi)\b/;
const westernAmericas=/\b(europe|european|america|americas|american|mexico|mexican|brazil|brazilian|uruguay|uruguayan|argentina|argentine|chile|chilean|cuba|cuban|peru|peruvian|canada|canadian|united states|united kingdom|england|english|britain|british|france|french|italy|italian|germany|german|spain|spanish|netherlands|dutch|flanders|flemish|belgium|belgian|austria|austrian|switzerland|swiss|norway|norwegian|sweden|swedish|denmark|danish|finland|finnish|poland|polish|greece|greek|russia|russian|hungary|hungarian|romania|romanian|portugal|portuguese|ireland|irish)\b/;
export function isWesternAmericasWork(work,notes={}){return westernAmericas.test(context(work,notes));}
export function isDeferredEastAsianWork(work,notes={}){
  if(work.id==='study-hokusai-great-wave')return false;
  const value=context(work,notes);return eastAsian.test(value)&&!westernAmericas.test(value);
}
export function isDeferredSouthAsianHimalayanWork(work,notes={}){const value=context(work,notes);return southAsianHimalayan.test(value)&&!westernAmericas.test(value);}
export function isLaterCurationWork(work,notes={}){return isDeferredEastAsianWork(work,notes)||isDeferredSouthAsianHimalayanWork(work,notes);}
export function allowedInCurationStage(work,batchIndex,notes={}){return batchIndex>=4||!isLaterCurationWork(work,notes);}
