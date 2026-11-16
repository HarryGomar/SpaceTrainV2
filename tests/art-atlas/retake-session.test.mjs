import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {retakeJourneySession,snapshotStudyRound,createDeepStudy} from '../../public/art-atlas/deep-study.mjs';
import {JOURNEY_PROTOCOL,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {isOverallAppealRound,APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
import {isComparisonPreferenceRound} from '../../public/art-atlas/comparison-protocol.mjs';
import {CONTINUOUS_QUESTION} from '../../public/art-atlas/continuous-preference.mjs';
import {legacyV11Works,legacyV11Rounds} from './helpers/legacy-v11.mjs';
import {legacyV8Works,legacyV8Rounds} from './helpers/legacy-v8.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
test('Retaking archives the full original instrument and answers without converting its mixed comparison scores',()=>{
  const catalogue=legacyV8Works(legacyV11Works()),rounds=legacyV8Rounds(legacyV11Works()),first=rounds[0],shown=snapshotStudyRound(first),old={version:1,target:50,index:0,screen:'question',startedAt:100,finishedAt:null,manifest:{version:1,protocol:JOURNEY_PROTOCOL,journeyRevision:'art-profile-50-v8',id:'public-v8-retake',catalogue,catalogueIds:catalogue.map(work=>work.id)},plan:rounds.map(snapshotStudyRound),shown:{},answers:{}};
  assert.equal(isOverallAppealRound(first),false);assert.equal(isComparisonPreferenceRound(first),false);
  old.shown[first.id]=shown;old.answers[first.id]={workIds:shown.workIds,criterion:'preference',positions:Object.fromEntries(shown.workIds.map((id,i)=>[id,[95,83,32,4][i]])),confirmed:true};
  old.archives=[{manifest:{id:'earlier-archive'},answers:{earlier:{untouched:true}}}];
  const before=structuredClone(old),fresh=retakeJourneySession(old,works,200);
  assert.deepEqual(old,before);assert.equal(fresh.manifest.journeyRevision,JOURNEY_REVISION);assert.notEqual(fresh.manifest.id,old.manifest.id);
  assert.deepEqual(fresh.answers,{});assert.deepEqual(fresh.shown,{});assert.equal(fresh.startedAt,200);assert.equal(fresh.screen,'question');
  assert.deepEqual(fresh.archives[0],old.archives[0]);const previous={...before};delete previous.archives;assert.deepEqual(fresh.archives[1],previous);
  assert.equal(fresh.archives[1].shown[first.id].scale.left,'Less preferred');assert.equal(fresh.archives[1].answers[first.id].positions[shown.workIds[0]],95);
});

async function inHost(saved,check){
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/'}),previous={};
  dom.window.matchMedia=()=>({matches:false});
  for(const key of ['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight']){previous[key]=globalThis[key];globalThis[key]=key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:key==='innerWidth'?1280:key==='innerHeight'?720:dom.window[key];}
  try{
    if(saved)dom.window.localStorage.setItem('art-profile-journey-v1',JSON.stringify(saved));
    const app=dom.window.document.querySelector('main'),study=createDeepStudy({app,getWorks:()=>works,image:w=>`<img data-artwork="${w.id}" alt="${w.title}">`,esc:String,keepButtons:()=>'',navigate:()=>{},showArtwork:()=>{},mode:'journey'});
    await study.restore();if(!saved)study.handle('deep-start');study.render();check(app);
  }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
}

test('The actual archived v11 host preserves its genuine neutral overall anchor and three literal labels',async()=>{
  const catalogue=legacyV11Works(),rounds=legacyV11Rounds(),first=rounds[0],saved={version:1,target:50,index:0,screen:'question',startedAt:100,finishedAt:null,reviewingArchived:true,archives:[],answers:{},shown:{[first.id]:snapshotStudyRound(first)},manifest:{version:1,protocol:JOURNEY_PROTOCOL,journeyRevision:'art-profile-50-v11',preferenceProtocol:APPEAL_PROTOCOL,id:'public-v11-archive-render',catalogue,catalogueIds:catalogue.map(work=>work.id)},plan:rounds.map(snapshotStudyRound)};
  assert(isOverallAppealRound(first));
  await inHost(saved,app=>{
    assert.deepEqual([...app.querySelectorAll('.spectrum-labels>span')].map(el=>el.textContent),['Strongly dislike','Neutral','Strongly like']);
    assert.match(app.querySelector('[data-action="place-spectrum"]').getAttribute('aria-label'),/Every point from 0 to 100/);
  });
});

test('The fresh personal-appeal host keeps granular positions and its explicit dislike, neutral and like anchors',async()=>{
  await inHost(null,app=>{
    assert.deepEqual([...app.querySelectorAll('.spectrum-labels>span')].map(el=>el.textContent),['Strongly dislike','Neutral','Strongly like']);
    const range=app.querySelector('#mobile-spectrum-range');assert(range);assert.deepEqual(['min','max','step'].map(key=>range.getAttribute(key)),['0','100','1']);
    assert(app.textContent.includes(CONTINUOUS_QUESTION));
  });
});
