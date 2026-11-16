import {fieldRandom} from './art-field.mjs';

const localImage=value=>typeof value==='string'&&/^\.?\/?assets\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)$/i.test(value)&&!value.includes('..');
const imageKey=value=>value.replace(/^\.\//,'');
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
const normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function sourceKey(work){try{const url=new URL(work.sourceUrl);return ['https:','http:'].includes(url.protocol)?url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'')+url.search:null;}catch{return null;}}
const priority=work=>work.studyEligible===true||work.eligibleForStudy===true||work.coreQuiz===true||work.decorativeOnly===false?2:1;

/** Canonical decorative pool. Returned items are the original records, not
 * altered quiz works or cloned images. A conflicting ID fails closed. */
export function canonicalOpeningPool(records=[]){
  const byId=new Map(),bad=new Set();
  for(const work of Array.isArray(records)?records:[]){
    if(!work||typeof work.id!=='string'||!work.id||!localImage(work.image)||!sourceKey(work))continue;
    if(work.studyEligible===false&&work.eligibleForStudy===false&&work.decorativeOnly!==true)continue;
    const old=byId.get(work.id);
    if(old&&(sourceKey(old)!==sourceKey(work)||imageKey(old.image)!==imageKey(work.image)||digest(old.sha256)&&digest(work.sha256)&&digest(old.sha256)!==digest(work.sha256))){bad.add(work.id);continue;}
    if(!old||priority(work)>priority(old))byId.set(work.id,work);
  }
  const sorted=[...byId.values()].filter(work=>!bad.has(work.id)).sort((a,b)=>priority(b)-priority(a)),sources=new Set(),images=new Set(),hashes=new Set(),result=[];
  // A museum guide can be the primary source for several different murals.
  // Source URL alone is therefore not an object identity.
  for(const work of sorted){const source=sourceKey(work)+'|'+normal(work.title).replace(/[^a-z0-9]+/g,' ')+'|'+normal(work.artist).replace(/[^a-z0-9]+/g,' '),image=imageKey(work.image),hash=digest(work.sha256);if(sources.has(source)||images.has(image)||hash&&hashes.has(hash))continue;sources.add(source);images.add(image);if(hash)hashes.add(hash);result.push(work);}
  return result;
}

/** One seed is created by the scene for its lifetime, never by the resize loop. */
export function createOpeningSeed(cryptoSource=globalThis.crypto){
  if(cryptoSource?.getRandomValues){const bytes=new Uint32Array(1);cryptoSource.getRandomValues(bytes);return bytes[0];}
  return (Date.now()^Math.floor(Math.random()*4294967296))>>>0;
}
const shuffled=(items,random)=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};

/** The decorative foreground varies each visit. It contains a mix of Mexican
 * works, editorial landmarks and other works, without claiming user preference. */
export function orderOpeningPool(works,{seed=9317,max=480}={}){
  const random=fieldRandom(seed^0x85ebca6b),all=shuffled(works,random),used=new Set(),selected=[];
  const mexican=all.filter(work=>/mexic/.test(normal([work.country,...(Array.isArray(work.culture)?work.culture:[])].join(' ')))),landmarks=all.filter(work=>work.recognitionTier==='landmark');
  const take=(pool,count)=>{const chosen=[];for(const work of pool){if(used.has(work.id))continue;chosen.push(work);used.add(work.id);if(chosen.length===count)break;}return chosen;};
  // The first ten are also a balanced foreground on a small screen.
  selected.push(...shuffled([...take(mexican,3),...take(landmarks,5),...take(all,2)],random));
  selected.push(...shuffled([...take(mexican,1),...take(landmarks,3)],random));
  selected.push(...take(all,all.length));
  return selected.slice(0,Math.max(0,Math.floor(max)));
}
