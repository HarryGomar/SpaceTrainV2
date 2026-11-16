import {favouriteExposure} from './profile-evidence.mjs';

const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const identity=work=>typeof work?.id==='string'&&typeof work.sourceUrl==='string'?JSON.stringify([work.id,work.sourceUrl]):null;

/** Previous quizzes prevent rediscovery claims. Their ratings never train the current reading. */
export function buildRecommendationMemory(histories=[]){
  const identities=new Set(),sources=[];
  for(const history of Array.isArray(histories)?histories:[]){
    if(!plain(history)||!Array.isArray(history.manifest?.catalogue))continue;
    const catalogue=history.manifest.catalogue,counts=new Map();
    for(const work of catalogue)counts.set(work?.id,(counts.get(work?.id)||0)+1);
    const byId=new Map(catalogue.filter(work=>counts.get(work?.id)===1&&identity(work)).map(work=>[work.id,work]));
    const snapshots=plain(history.shown)?Object.values(history.shown):Array.isArray(history.rounds)?history.rounds:[];
    for(const snapshot of snapshots){
      const ids=snapshot?.workIds,answer=history.answers?.[snapshot?.id];
      if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id))||snapshot.unavailable||snapshot.evidence?.stimulusVisibility==='not-shown')continue;
      let exposed=ids;
      if(snapshot.kind==='exercise'){
        const presented=answer?.record?.presentedIds;
        // A room's whole collection is not evidence that every work was viewed.
        exposed=Array.isArray(presented)&&presented.every(id=>ids.includes(id))?presented:[];
      }else if(snapshot.kind==='choice-grid'&&snapshot.evidence?.instrumentRevision==='paged-favourites-v1'){
        const round={...snapshot,works:ids.map(id=>byId.get(id))};
        exposed=favouriteExposure(round,answer)?.presentedIds||[];
      }
      for(const id of exposed){
        const work=byId.get(id);identities.add(identity(work));
        sources.push({workId:id,sourceUrl:work.sourceUrl,roundId:snapshot.id,quizId:history.manifest.id||null});
      }
    }
  }
  return {identities,sources,scope:'Previously presented works are excluded from new-work suggestions. Earlier ratings remain in their original quiz.'};
}

export function wasPreviouslyPresented(work,memory){return memory?.identities instanceof Set&&memory.identities.has(identity(work));}
