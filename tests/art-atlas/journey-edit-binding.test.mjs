import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDeepStudy, prepareJourneySession, extendJourneySession, sessionJourneyRounds, snapshotStudyRound, validStudyAnswer } from '../../public/art-atlas/deep-study.mjs';
import { createGalleryRecord, gallerySlots, placePainting, validGallery } from '../../public/art-atlas/gallery-model.mjs';
import { validScenarioDraft } from '../../public/art-atlas/scenarios.mjs';
import { setDifficultEditRemoval, startDifficultEditComparison, chooseDifficultEditComparison } from '../../public/art-atlas/difficult-edit.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const ids=round=>round.works.map(w=>w.id);
function museum(pool) {
  let record=createGalleryRecord(pool,{}, {id:'earlier-museum',now:100,roomStudy:false});
  const chosen=['holbein-ambassadors','klimt-kiss','matejko-stanczyk','van-gogh-starry-night'];
  for(const id of chosen){const slot=gallerySlots(record).find(s=>s.roomId==='g1'),result=placePainting(record,id,slot.wallId,slot.t);assert(result.ok);record=result.record;}
  record.confirmed=true;record.finishedAt=200;assert(validGallery(record,pool));return record;
}
function finishWithSkips(data) {
  for(const round of sessionJourneyRounds(data)){
    data.shown[round.id]??=snapshotStudyRound(round);
    data.answers[round.id]??={skipped:true,workIds:ids(round)};
  }
}

test('A later mounted Difficult edit remains bound to its shown set after a different four-work museum room',t=>{
  const savedGlobals=Object.fromEntries(['localStorage','window','requestAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  t.after(()=>{for(const [key,descriptor] of Object.entries(savedGlobals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const store=new Map();
  globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  globalThis.window={addEventListener(){},scrollY:0,scrollTo(){}};
  globalThis.requestAnimationFrame=()=>0;
  const app={innerHTML:'',addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}};
  let data=prepareJourneySession(null,works,300);finishWithSkips(data);
  const museumRound=sessionJourneyRounds(data).find(r=>r.kind==='exercise'&&r.exerciseKind==='curate'),previousMuseum=structuredClone(museum(museumRound.works));
  assert.deepEqual(new Set(previousMuseum.offeredIds),new Set(ids(museumRound)));
  data.answers[museumRound.id]={workIds:ids(museumRound),record:previousMuseum};
  assert(validStudyAnswer(museumRound,data.answers[museumRound.id]));
  data=extendJourneySession(data,works,400);
  const later=sessionJourneyRounds(data).slice(50).find(r=>r.kind==='exercise'&&r.exerciseKind==='difficult-edit');
  assert(later);assert(previousMuseum.offeredIds.length>ids(later).length);
  data.index=data.plan.findIndex(r=>r.id===later.id);data.screen='question';
  store.set('art-profile-journey-v1',JSON.stringify(data));
  const study=createDeepStudy({app,getWorks:()=>works,image:w=>'<img data-artwork="'+w.id+'">',esc:value=>String(value??''),keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});
  study.restore();study.render();
  const mounted=JSON.parse(store.get('art-profile-journey-v1'));
  const response=mounted.answers[later.id];
  assert(response?.record,'Rendering the actual host must persist its newly bound draft');
  assert.deepEqual([...response.record.offeredIds].sort(),[...ids(later)].sort(),'The mounted edit must not silently substitute the earlier gallery room');
  assert(validScenarioDraft(response.record,later.works));
  assert.deepEqual(mounted.answers[museumRound.id].record,previousMuseum,'Earlier spatial evidence must remain intact');
  let completed={...response.record,presentedIds:[...response.record.offeredIds]};
  completed=setDifficultEditRemoval(completed,completed.offeredIds[0],later.works);
  completed=startDifficultEditComparison(completed,later.works);
  completed=chooseDifficultEditComparison(completed,'alternative',later.works);
  completed={...completed,confirmed:true,finishedAt:500};
  mounted.answers[later.id]={...response,record:completed};
  assert(validStudyAnswer(later,mounted.answers[later.id]),'A completed comparison must resolve the same shown round');
  finishWithSkips(mounted);
  const next=extendJourneySession(mounted,works,600);
  assert.equal(next.target,150,'This valid edit must not block the next batch');
  assert.deepEqual(next.answers[later.id],mounted.answers[later.id]);
});
