import {validatedProfileEntries,buildPreferenceBasis} from './profile-evidence.mjs';
import {sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';

export const COLLECTION_STORAGE_KEY='art-profile-collection-v1';
export const COLLECTION_STUDY_KEY='art-profile-journey-v1';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const named=value=>typeof value==='string'&&value.trim().length>0;
const unique=values=>[...new Set(values)];

/** Keep the complete collection record, including unfamiliar fields and older
 * sessions. A collection action must not silently repair an unreadable store. */
export function collectionRecord(value=null){
  if(value===null||value===undefined)return {version:1,saved:{},sessions:[]};
  if(!plain(value)||value.version!==1||value.saved!==undefined&&!plain(value.saved)||value.sessions!==undefined&&!Array.isArray(value.sessions))throw Error('Your saved collection could not be read. Its stored data has been retained.');
  return {...structuredClone(value),saved:structuredClone(value.saved||{}),sessions:structuredClone(value.sessions||[])};
}
export const savedPaintingIds=collection=>Object.entries(collection?.saved||{}).filter(([,value])=>value?.look===true||value?.study===true).map(([id])=>id);

/** Only explicit declarations and validated anchored appeal supply likes.
 * Historical rankings and unranked keep grids never become liking scores. */
export function quizCollectionChoices({works=[],rounds=[],answers={}}={}){
  const entries=validatedProfileEntries({works,rounds,answers}),basis=buildPreferenceBasis(entries);
  return {favouriteIds:unique(basis.favourites.map(item=>item.workId)),likedIds:unique(basis.seeds.map(item=>item.workId)),works:[...new Map(basis.seeds.map(item=>[item.workId,structuredClone(item.work)])).values()]};
}

/** Restore only actually shown definitions against their own frozen catalogue.
 * Reading collection candidates does not prepare, upgrade or save a quiz. */
export function quizCollectionChoicesFromStudy(study){
  if(!plain(study)||!Array.isArray(study.manifest?.catalogue)||!plain(study.shown)||!plain(study.answers))return quizCollectionChoices();
  const works=study.manifest.catalogue,byId=new Map(works.map(work=>[work?.id,work])),plan=Array.isArray(study.plan)?study.plan:[],extra=Array.isArray(study.profileRefinement?.plan)?study.profileRefinement.plan:[],base=Number.isInteger(study.profileRefinement?.baseTarget)?study.profileRefinement.baseTarget:50;
  const order=new Map([...plan.slice(0,base),...extra,...plan.slice(base)].map((snapshot,index)=>[snapshot?.id,index]));
  const rounds=Object.entries(study.shown).flatMap(([key,snapshot],index)=>{
    if(!plain(snapshot)||snapshot.id!==key||!Array.isArray(snapshot.workIds)||!snapshot.workIds.length||unique(snapshot.workIds).length!==snapshot.workIds.length||snapshot.workIds.some(id=>!byId.has(id)))return [];
    const anchors=snapshot.anchorIds||[];if(!Array.isArray(anchors)||anchors.some(id=>!byId.has(id)))return [];
    if(snapshot.works!==undefined&&(!Array.isArray(snapshot.works)||snapshot.works.length!==snapshot.workIds.length||snapshot.works.some((work,i)=>work?.id!==snapshot.workIds[i]||!sameOrdinalArtworkIdentity(work,byId.get(work.id),{requireSource:true}))))return [];
    return [{order:order.get(snapshot.id)??plan.length+extra.length+index,round:{...snapshot,works:snapshot.works||snapshot.workIds.map(id=>byId.get(id)),anchorWorks:anchors.map(id=>byId.get(id))}}];
  }).sort((a,b)=>a.order-b.order).map(item=>item.round);
  return quizCollectionChoices({works,rounds,answers:study.answers});
}

export function addSavedPaintings(value,workIds,{now=Date.now()}={}){
  const result=collectionRecord(value),saved=new Map(Object.entries(result.saved));
  for(const id of unique((Array.isArray(workIds)?workIds:[]).filter(named))){const old=plain(saved.get(id))?saved.get(id):{};saved.set(id,{addedAt:now,...old,look:true});}
  result.saved=Object.fromEntries(saved);return result;
}

export function toggleSavedPainting(value,workId,purpose='look',{now=Date.now()}={}){
  const result=collectionRecord(value);if(!named(workId)||!['look','study'].includes(purpose))return result;
  const saved=new Map(Object.entries(result.saved)),old=plain(saved.get(workId))?saved.get(workId):{},next={addedAt:now,...old,[purpose]:old[purpose]!==true};
  if(next.look===true||next.study===true)saved.set(workId,next);else saved.delete(workId);
  result.saved=Object.fromEntries(saved);return result;
}

export function resetSavedPaintings(value){const result=collectionRecord(value),previousSaved=structuredClone(result.saved);result.saved={};return {collection:result,previousSaved};}

/** Undo adds the old saves to the latest record, preserving saves and changes
 * made since the reset, including a new purpose on an already-known painting. */
export function undoSavedPaintingReset(value,previousSaved){
  const result=collectionRecord(value);if(!plain(previousSaved))return result;
  const saved=new Map(Object.entries(structuredClone(previousSaved)));
  for(const [id,current]of Object.entries(result.saved)){const old=saved.get(id);saved.set(id,plain(old)&&plain(current)?{...old,...current}:current);}
  result.saved=Object.fromEntries(saved);return result;
}
