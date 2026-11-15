import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareJourneySession,prepareStudySession,sessionJourneyRounds,restoreStudyRound,snapshotStudyRound,createDeepStudy} from '../../public/art-atlas/deep-study.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const initial=prepareJourneySession(null,works,1000);
const ids=round=>round.works.map(w=>w.id);
const response=round=>({workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((w,i)=>[w.id,Math.round(i/(round.works.length-1)*100)])),confirmed:true});
function laterCheckFixture(){
  const data=structuredClone(initial),first=sessionJourneyRounds(data);
  const sources=first.filter(r=>r.kind==='spectrum'&&r.criterion==='preference'&&r.evidence.construct==='preference').slice(0,3);
  sources.forEach(r=>{data.shown[r.id]=snapshotStudyRound(r);data.answers[r.id]=response(r);});
  const next=data.plan.map((snapshot,i)=>({...structuredClone(snapshot),id:'journey-'+String(i+51).padStart(3,'0'),evidence:{...snapshot.evidence,batchIndex:1,selectionSeed:'saved-later-block'}}));
  data.plan.push(...next);data.target=100;
  data.batches=[{index:1,offset:50,selection:structuredClone(data.manifest.stimulusPlanning.firstPlan)}];
  for(const index of [96,97]){
    const round={id:'journey-'+String(index+1).padStart(3,'0'),kind:'spectrum',format:'spectrum',criterion:'preference',title:'The captured later check '+index,hint:'The captured instruction.',scale:{left:'Less preferred',right:'More preferred'},works:works.slice(10,12),bankRoundId:'study-139',evidence:{construct:'preference',family:'feature-check',role:'check',batchIndex:1,sourceBankRoundId:'study-139',selectionSeed:'saved-later-block',contrastKey:'saved-contrast',provisionalPrediction:works[10].id,trainingRoundIds:['obsolete-source'],trainingAnswers:{'obsolete-source':{frozen:true}},heldOut:true}};
    data.plan[index]=snapshotStudyRound(round);
  }
  const future={id:'journey-100',kind:'spectrum',criterion:'preference',title:'A future recorded preference',hint:'Equal positions are fine.',works:works.slice(20,24),evidence:{construct:'preference',family:'individual-choice',role:'discovery',batchIndex:1}};
  data.plan[99]=snapshotStudyRound(future);data.shown[future.id]=snapshotStudyRound(future);data.answers[future.id]=response(future);
  return {data,sourceIds:sources.map(r=>r.id),future};
}

test('Resolving a captured journey does no feature-planning work when no prospective check needs refresh',()=>{
  const data=structuredClone(initial);for(const p of data.plan){data.shown[p.id]=structuredClone(p);data.answers[p.id]={skipped:true,workIds:[...p.workIds]};}
  let featureReads=0,generations=0;
  data.manifest.catalogue=data.manifest.catalogue.map(work=>{const copy={...work};Object.defineProperty(copy,'features',{get(){featureReads++;return work.features;},enumerable:true});return copy;});
  const result=sessionJourneyRounds(data,{regenerateBlock(){generations++;throw Error('A captured journey must not be planned again.');}});
  assert.equal(result.length,50);assert.equal(featureReads,0,'Restoring captured questions must not run feature selection or fitting');assert.equal(generations,0);
  assert.deepEqual(result.map(r=>r.title),data.plan.map(r=>r.title));
});

test('Later checks refresh from their saved block once, using local indices and only earlier actual answers',()=>{
  const {data,sourceIds,future}=laterCheckFixture(),before=structuredClone(data),calls=[];
  const resolved=sessionJourneyRounds(data,{regenerateBlock(catalogue,answers,options){
    calls.push(options);assert.equal(options.offset,50);assert.equal(options.batchIndex,1);assert.equal(options.seed,'saved-later-block');
    assert.equal(options.panels.length,18);assert(options.history.every(r=>r.id!==future.id));assert.equal(answers[future.id],undefined);
    assert.deepEqual(Object.keys(answers).sort(),[...sourceIds].sort());
    return data.plan.slice(50,100).map(snapshot=>{const r=restoreStudyRound(snapshot,catalogue);return r.evidence.family==='feature-check'?{...r,evidence:{...r.evidence,provisionalPrediction:r.works[1].id,trainingRoundIds:[...sourceIds],heldOut:true,comparisonNovel:true,holdoutUnit:'new-comparison'}}:r;});
  }});
  assert.equal(calls.length,1,'Checks in one bound block share one regeneration');
  for(const index of [96,97]){assert.equal(resolved[index].evidence.provisionalPrediction,works[11].id);assert.deepEqual(resolved[index].evidence.trainingRoundIds,sourceIds);assert.equal(resolved[index].evidence.trainingAnswers,undefined);assert.equal(resolved[index].title,before.plan[index].title);}
  assert.deepEqual(data,before,'Refreshing returned evidence must not rewrite saved definitions, answers or training provenance');
});

test('An unavailable bound selector preserves the raw check and safely withholds unverified predictions',()=>{
  const {data}=laterCheckFixture(),before=structuredClone(data);delete data.batches;
  let calls=0;const result=sessionJourneyRounds(data,{regenerateBlock(){calls++;throw Error('No bound source');}});
  assert.equal(calls,0);
  for(const index of [96,97]){assert.equal(result[index].evidence.provisionalPrediction,null);assert.equal(result[index].evidence.trainingAnswers,undefined);assert.equal(result[index].evidence.heldOut,false);assert.match(result[index].evidence.prospectiveCheckUnavailable,/bound panel selection/);assert.deepEqual(data.plan[index],before.plan[index]);}
});

test('Different prompt/source or future training evidence cannot refresh a pinned prediction',()=>{
  for(const defect of ['wording','source','future']){
    const {data,sourceIds,future}=laterCheckFixture();
    const resolved=sessionJourneyRounds(data,{regenerateBlock(catalogue){return data.plan.slice(50,100).map(snapshot=>{const r=restoreStudyRound(snapshot,catalogue);if(r.evidence.family!=='feature-check')return r;return {...r,...(defect==='wording'?{hint:'Changed wording'}:{}),...(defect==='source'?{bankRoundId:'another-source'}:{}),evidence:{...r.evidence,provisionalPrediction:r.works[0].id,trainingRoundIds:defect==='future'?[...sourceIds,future.id]:sourceIds,heldOut:true}};});}});
    assert.equal(resolved[96].evidence.provisionalPrediction,null,defect);assert.equal(resolved[96].evidence.heldOut,false,defect);
  }
});

test('Shown feature checks retain their captured predictions and training snapshots unchanged',()=>{
  const {data}=laterCheckFixture();data.shown['journey-097']=structuredClone(data.plan[96]);data.shown['journey-098']=structuredClone(data.plan[97]);
  const expected=restoreStudyRound(data.shown['journey-097'],data.manifest.catalogue);let calls=0;
  const resolved=sessionJourneyRounds(data,{regenerateBlock(){calls++;throw Error('Shown evidence must not refresh');}});
  assert.equal(calls,0);assert.deepEqual(resolved[96],expected);
});

test('A profile render and export each restore the snapshot plan once rather than repeatedly planning or restoring it',t=>{
  const descriptors=Object.fromEntries(['localStorage','window','requestAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  t.after(()=>{for(const [key,descriptor] of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const data=structuredClone(initial);data.screen='reading';for(const p of data.plan){data.shown[p.id]=structuredClone(p);data.answers[p.id]={skipped:true,workIds:[...p.workIds]};}
  const storage=new Map([['art-profile-journey-v1',JSON.stringify(data)]]);
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  globalThis.window={addEventListener(){},scrollY:0,scrollTo(){}};globalThis.requestAnimationFrame=()=>0;
  const app={innerHTML:'',addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}};
  const study=createDeepStudy({app,getWorks:()=>works,image:w=>'<img data-artwork="'+w.id+'">',esc:v=>String(v??''),keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});study.restore();
  const originalMap=Array.prototype.map;let snapshotTraversals=0;
  Array.prototype.map=function(...args){if(this.length===50&&this[0]?.id==='journey-001'&&Array.isArray(this[0]?.workIds)&&!this[0]?.works)snapshotTraversals++;return Reflect.apply(originalMap,this,args);};
  try{
    study.render();assert.equal(snapshotTraversals,1,'One profile render should restore one snapshot plan');assert(app.innerHTML.length>0);
    snapshotTraversals=0;const exported=study.exportData();assert.equal(snapshotTraversals,1,'One export should share one restored plan across its readings');assert.equal(exported.plannedRounds.length,50);assert.deepEqual(exported.answers,data.answers);
  }finally{Array.prototype.map=originalMap;}
});

test('A completed legacy50-round path keeps its overview action even though its frozen plan has200 definitions',t=>{
  const descriptors=Object.fromEntries(['localStorage','window','requestAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  t.after(()=>{for(const [key,descriptor] of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const data=prepareStudySession(null,works,1000);data.target=50;data.screen='reading';
  for(const p of data.plan.slice(0,50)){data.shown[p.id]=structuredClone(p);data.answers[p.id]={skipped:true,workIds:[...p.workIds]};}
  const storage=new Map([['art-profile-deep-study-v1',JSON.stringify(data)]]);
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  globalThis.window={addEventListener(){},scrollY:0,scrollTo(){}};globalThis.requestAnimationFrame=()=>0;
  const app={innerHTML:'',addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}};
  const study=createDeepStudy({app,getWorks:()=>works,image:w=>'<img data-artwork="'+w.id+'">',esc:v=>String(v??''),keepButtons:()=>'',navigate(){},showArtwork(){},mode:'legacy'});
  study.restore();study.render();
  assert(app.innerHTML.includes('data-action="deep-home">Study overview'));
  assert(!app.innerHTML.includes('data-action="deep-start">Continue the study'));
});
