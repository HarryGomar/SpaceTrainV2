import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {resolveArtworkAttributes} from './taste-patterns.mjs';

/** Fixed candidate contrasts. They are editorial study objectives, not fitted
 * psychological factors or claims that two pictures differ in only one way. */
export const QUALITY_COMPARISONS=Object.freeze([
  ['narrative-detail','imagined-world'],['dramatic-light','intimate-figures'],
  ['theatrical-staging','human-relationships'],['geometric-structure','visible-paint-marks'],
  ['expressive-distortion','precise-rendering'],['layered-space','material-detail']
]);
const cache=new WeakMap();
function qualities(work){const identity=JSON.stringify([work.sourceUrl,work.image,work.sha256,work.previewSha256,work.provenance?.thumbnailSha256,work.provenance?.sha256,work.provenance?.download?.sha256]),previous=cache.get(work);if(previous?.identity===identity)return previous.attributes;const attributes=resolveArtworkAttributes(work,{annotationReviews:REVIEWS})?.attributes||null;cache.set(work,{identity,attributes});return attributes;}
const status=(row,key)=>qualities(row.work)?.[key]?.status||'unknown';
const cell=(row,keys)=>{const values=keys.map(key=>status(row,key));return values.includes('unknown')?null:values.map(value=>value==='present'?1:0).join('');};
export function qualityDiagnostic(rows,keys){
  const cells=Object.fromEntries(['00','01','10','11'].map(key=>[key,[]])),unknown=[];for(const row of rows){const value=cell(row,keys);if(value===null)unknown.push(row.id);else cells[value].push(row.id);}
  const populated=Object.values(cells).filter(items=>items.length).length;
  return {version:'source-bound-quality-crossing-v1',qualities:[...keys],cells,unknownWorkIds:unknown,status:populated===4?'four-cells':populated>=3?'three-cells':populated>=2?'partial':'not-contrasted',sourceBindings:rows.map(row=>({workId:row.id,sourceUrl:row.work.sourceUrl,image:row.work.image,sourceBound:!!qualities(row.work),reviewedPreviewSha256:qualities(row.work)?REVIEWS.reviews[row.id]?.sourceIdentity.previewSha256||null:null,statuses:Object.fromEntries(keys.map(key=>[key,status(row,key)]))})),limit:'Observed annotation cells, not randomized causal isolation. Other visual properties, artist, subject, period and reproduction can still differ.'};
}

/** Bounded search through source-reviewed cells. Mandatory freshness, protected
 * comparisons, landmark caps and explicit avoid-pairs remain caller constraints. */
export function chooseQualityCrossing({candidates,keys,benefit,requiredFresh=0,fresh=()=>false,maximumLandmarks=4,avoidPair=()=>false}={}){
  const buckets=Object.fromEntries(['00','01','10','11'].map(key=>[key,[]]));for(const row of candidates){const value=cell(row,keys);if(value!==null)buckets[value].push(row);}
  const score=row=>benefit(row)+(row.work.curationRole==='canonical-priority'?1:0);
  for(const bucket of Object.values(buckets))bucket.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
  const cells=Object.keys(buckets).filter(key=>buckets[key].length);if(cells.length<3)return null;
  // Three-cell designs can distinguish a correlated pair in some directions,
  // but are explicitly labelled partial rather than completed with fake zeros.
  const targetCells=cells.length===4?cells:[...cells,cells[0]];let best=null;
  function visit(index,chosen){
    if(index===4){if(chosen.filter(fresh).length<requiredFresh)return;const artists=new Set(chosen.map(row=>row.work.artist)).size,value=chosen.reduce((sum,row)=>sum+score(row),0)+artists*4,diagnostic=qualityDiagnostic(chosen,keys);if(!best||value>best.score||value===best.score&&chosen.map(row=>row.id).join('|')<best.chosen.map(row=>row.id).join('|'))best={chosen:[...chosen],score:value,qualityDiagnostic:diagnostic};return;}
    for(const row of buckets[targetCells[index]].slice(0,6)){if(chosen.some(other=>other.id===row.id||avoidPair(other,row))||chosen.filter(other=>other.landmark).length+Number(row.landmark)>maximumLandmarks||chosen.filter(other=>other.work.artist===row.work.artist).length>=2)continue;chosen.push(row);visit(index+1,chosen);chosen.pop();}
  }
  visit(0,[]);return best;
}
