import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,comparisonMethodMigration,createDeepStudy,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {CONTINUOUS_PROTOCOL,isContinuousPreferenceRound} from '../../public/art-atlas/continuous-preference.mjs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import {isComparisonPreferenceRound,COMPARISON_PROTOCOL} from '../../public/art-atlas/comparison-protocol.mjs';
import {isOrdinalRefinementRound} from '../../public/art-atlas/ordinal-refinement.mjs';
import {legacyV11Rounds,legacyV11Works} from './helpers/legacy-v11.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),ids=round=>round.works.map(work=>work.id),foundation=works.slice(0,164);
const ordered=round=>({workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,index)=>[work.id,97+index])),confirmed:true});
const none=round=>({workIds:ids(round),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,confirmed:true,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}});
const makeStudy=app=>createDeepStudy({app,getWorks:()=>foundation,image:work=>'<img data-artwork="'+work.id+'">',esc:value=>String(value??''),keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});
async function browser(task,{quota=50_000_000}={}){
  const dom=new JSDOM('<main></main>',{url:'http://localhost/',storageQuota:quota}),keys=['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));dom.window.matchMedia=()=>({matches:false});
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:key==='innerWidth'?1280:key==='innerHeight'?720:dom.window[key]});
  try{return await task(dom.window.document.querySelector('main'),dom);}finally{for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}
}

test('Every fresh continuous refinement binds on entry from actual earlier sources, and captured definitions survive later answers',()=>{
  const data=prepareJourneySession(null,works,100),beforePlan=structuredClone(data.plan),closing=[];
  for(let index=0;index<50;index++){
    data.index=index;const round=sessionJourneyRounds(data)[index];assert.equal(round.unavailable,undefined,round.id+' must have its actual source by entry');
    const snapshot=snapshotStudyRound(round);data.shown[round.id]=snapshot;
    data.answers[round.id]=isComparisonPreferenceRound(round)?ordered(round):round.evidence.explicitFavourites||round.evidence.explicitDislikes?none(round):{workIds:ids(round),skipped:true};
    assert.ok(data.answers[round.id].skipped||validStudyAnswer(round,data.answers[round.id]),round.id);
    if(isOrdinalRefinementRound(round)){closing.push(round);assert.equal(round.evidence.finalRefinement.binding,'bound');assert.ok(round.evidence.finalRefinement.sourceRoundIds.every(id=>Number(id.slice(8))<index+1));}
  }
  assert.equal(closing.length,6);assert.equal(Object.values(data.shown).filter(round=>round.evidence?.explicitDislikes).length,1);assert.equal(data.shown['journey-046'].workIds.length,72);assert.deepEqual(data.shown['journey-049'].workIds,data.shown['journey-046'].workIds);assert.equal(data.shown['journey-049'].evidence.explicitDislikes,true);
  assert.deepEqual(data.plan,beforePlan,'Entering stores the shown snapshot; it does not replace pending historical definitions.');
  const shown=structuredClone(data.shown),changed=structuredClone(data);changed.answers['journey-001'].positions=Object.fromEntries(changed.shown['journey-001'].workIds.map((id,i)=>[id,100-i]));
  for(const round of sessionJourneyRounds(changed))assert.deepEqual(snapshotStudyRound(round),shown[round.id]);
});

test('One-time method migration archives exact overall answers, source bindings and pending questions without conversion',()=>{
  const old={...prepareJourneySession(null,legacyV11Works(),100),plan:legacyV11Rounds().map(snapshotStudyRound),archives:[{manifest:{id:'older'},answers:{private:{unchanged:true}}}]};delete old.manifest.preferenceProtocol;old.manifest.journeyRevision='art-profile-50-v11';
  const first=legacyV11Rounds()[0];old.shown[first.id]=snapshotStudyRound(first);old.answers[first.id]=ordered(first);old.answers[first.id].positions[first.works[0].id]=0;const before=structuredClone(old),migration=comparisonMethodMigration(old,works,200),archived=structuredClone(before);delete archived.archives;
  assert.deepEqual(old,before);assert.deepEqual(migration.archives[0],before.archives[0]);assert.deepEqual(migration.archives[1],archived);assert.deepEqual(migration.answers,{});assert.deepEqual(migration.shown,{});assert.equal(migration.manifest.preferenceProtocol,CONTINUOUS_PROTOCOL);assert.ok(sessionJourneyRounds(migration).filter(round=>round.evidence.panelNumber&&round.evidence.construct==='preference').every(isComparisonPreferenceRound));assert.equal(comparisonMethodMigration(migration,works),null);assert.equal(comparisonMethodMigration({...old,reviewingArchived:true},works),null);
});

test('Completed comparison blocks continue at 51/100 and 101/150 rather than requesting another retake',async()=>{
  await browser(async app=>{
    let data=prepareJourneySession(null,foundation,100);data.startedAt=100;
    for(const target of [50,100]){
      for(const round of sessionJourneyRounds(data)){data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]={workIds:ids(round),skipped:true};}
      const first=sessionJourneyRounds(data)[target-50];data.answers[first.id]=ordered(first);data.screen='reading';data.finishedAt=200;localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));
      const study=makeStudy(app);await study.restore();study.render();assert.ok(app.querySelector('[data-action="deep-extend"]'));assert.match(app.textContent,/Continue with 50 more/);assert.doesNotMatch(app.textContent,/Start updated quiz/);study.handle('deep-extend');study.render();assert.match(app.querySelector('.journey-chrome').textContent,new RegExp((target+1)+' / '+(target+50)));await study.flush();data=extendJourneySession(data,foundation,300+target);await study.clear();
    }
  });
});

test('Familiarity uses one painting selection, with none and uncertainty separate from unselected works',async()=>{
  await browser(async(app,dom)=>{
    Object.defineProperty(dom.window.HTMLImageElement.prototype,'complete',{configurable:true,get:()=>true});
    Object.defineProperty(dom.window.HTMLImageElement.prototype,'naturalWidth',{configurable:true,get:()=>600});
    const data=prepareJourneySession(null,foundation,100),first=sessionJourneyRounds(data)[0];data.startedAt=100;data.index=1;data.screen='question';data.shown[first.id]=snapshotStudyRound(first);data.answers[first.id]=ordered(first);
    localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));const study=makeStudy(app);await study.restore();study.render();
    const round=study.exportData().rounds.find(round=>round.id==='journey-002');assert.equal(round.evidence.familiarityProtocol,'prior-encounter-selection-v3');assert.equal(app.querySelectorAll('.discovery-work').length,12);assert.equal(app.querySelectorAll('fieldset').length,0);assert.equal(app.querySelector('[data-action="deep-next"]').disabled,true);
    study.handle('deep-grid-pick',{dataset:{work:round.workIds[0]}});assert.equal(app.querySelector('[data-action="deep-next"]').disabled,false);study.handle('deep-next');
    const saved=study.exportData().answers['journey-002'];assert.deepEqual(saved.selectedIds,[round.workIds[0]]);assert.equal(saved.familiarity,undefined);assert.equal(saved.confirmed,true);assert.equal(study.exportData().index,2);await study.clear();
  });
});

test('An unfinished v14 familiarity screen retains its original draft before switching to gallery selection',async()=>{
  await browser(async(app,dom)=>{
    Object.defineProperty(dom.window.HTMLImageElement.prototype,'complete',{configurable:true,get:()=>true});Object.defineProperty(dom.window.HTMLImageElement.prototype,'naturalWidth',{configurable:true,get:()=>600});
    const data=prepareJourneySession(null,foundation,100);data.startedAt=100;data.index=1;data.screen='question';data.manifest.journeyRevision='art-profile-50-v14';
    const old=structuredClone(data.plan[1]);old.evidence.familiarityProtocol='prior-encounter-v2';old.hint='For each painting, choose Seen before, New to me or Not sure.';data.plan[1]=old;data.shown[old.id]=structuredClone(old);
    const original={workIds:old.workIds,selectionMode:'familiarity',familiarity:{[old.workIds[0]]:'seen',[old.workIds[1]]:'new',[old.workIds[2]]:'unsure'},selectedIds:[old.workIds[0]],explicitNone:false,unsure:false,confirmed:false};data.answers[old.id]=original;
    localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));const study=makeStudy(app);await study.restore();study.render();const exported=study.exportData(),revision=exported.instrumentRevisions.find(item=>item.roundId===old.id&&item.reason.includes('gallery selection'));
    assert.deepEqual(revision.question,old);assert.deepEqual(revision.answer,original);assert.deepEqual(exported.answers[old.id].selectedIds,original.selectedIds);assert.equal(exported.rounds.find(round=>round.id===old.id).evidence.familiarityProtocol,'prior-encounter-selection-v3');assert.equal(app.querySelectorAll('fieldset').length,0);await study.clear();
  });
});

test('A failed migration cannot replace the last stored old run or erase its answers',async()=>{
  const old=prepareJourneySession(null,foundation,100);delete old.manifest.preferenceProtocol;old.manifest.journeyRevision='art-profile-50-v11';const first=sessionJourneyRounds(old)[0];old.shown[first.id]=snapshotStudyRound(first);old.answers[first.id]=ordered(first);const raw=JSON.stringify(old);
  await browser(async app=>{
    localStorage.setItem('art-profile-journey-v1',raw);const study=makeStudy(app);await study.restore();assert.equal(localStorage.getItem('art-profile-journey-v1'),raw);assert.equal(study.exportData().manifest.id,old.manifest.id);assert.deepEqual(study.exportData().answers,old.answers);assert.match(app.textContent,/new quiz could not be saved/);await study.clear();
  },{quota:raw.length+1024});
});


test('A captured v12 order-only run archives exactly and never acquires personal-appeal levels',()=>{
 const old=prepareJourneySession(null,foundation,10),rounds=buildJourneyRounds(foundation,{}, {preferenceProtocol:COMPARISON_PROTOCOL});old.plan=rounds.map(snapshotStudyRound);old.manifest.preferenceProtocol=COMPARISON_PROTOCOL;old.manifest.journeyRevision='art-profile-50-v12';old.shown[rounds[0].id]=snapshotStudyRound(rounds[0]);old.answers[rounds[0].id]=ordered(rounds[0]);const before=structuredClone(old),fresh=comparisonMethodMigration(old,foundation,20);assert.deepEqual(old,before);const archived=structuredClone(before);delete archived.archives;assert.deepEqual(fresh.archives.at(-1),archived);assert.equal(fresh.manifest.preferenceProtocol,CONTINUOUS_PROTOCOL);assert.ok(isContinuousPreferenceRound(sessionJourneyRounds(fresh)[0]));assert.equal(isContinuousPreferenceRound(sessionJourneyRounds({...old,reviewingArchived:true})[0]),false);assert.equal(sessionJourneyRounds(old)[0].scale.left,'Less preferred here');assert.equal(sessionJourneyRounds(fresh)[0].scale.left,'Strongly dislike');
});
