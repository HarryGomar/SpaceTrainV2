import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {prepareJourneySession,retakeJourneySession,sessionJourneyRounds,snapshotStudyRound,createDeepStudy} from '../../public/art-atlas/deep-study.mjs';
import {JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
test('Retaking archives the full original instrument and answers without converting its mixed comparison scores',()=>{
  const old=prepareJourneySession(null,works,100),first=sessionJourneyRounds(old)[0];
  old.manifest.journeyRevision='art-profile-50-v8';
  const shown=snapshotStudyRound({...first,title:'Which do you prefer?',hint:'Compare these paintings.',scale:{left:'Less preferred',right:'More preferred'},evidence:{...first.evidence,appealProtocol:undefined,measurementScope:undefined}});
  old.shown[first.id]=shown;old.answers[first.id]={workIds:shown.workIds,criterion:'preference',positions:Object.fromEntries(shown.workIds.map((id,i)=>[id,[95,83,32,4][i]])),confirmed:true};
  old.archives=[{manifest:{id:'earlier-archive'},answers:{earlier:{untouched:true}}}];
  const before=structuredClone(old),fresh=retakeJourneySession(old,works,200);
  assert.deepEqual(old,before);assert.equal(fresh.manifest.journeyRevision,JOURNEY_REVISION);assert.notEqual(fresh.manifest.id,old.manifest.id);
  assert.deepEqual(fresh.answers,{});assert.deepEqual(fresh.shown,{});assert.equal(fresh.startedAt,200);assert.equal(fresh.screen,'question');
  assert.deepEqual(fresh.archives[0],old.archives[0]);const previous={...before};delete previous.archives;assert.deepEqual(fresh.archives[1],previous);
  assert.equal(fresh.archives[1].shown[first.id].scale.left,'Less preferred');assert.equal(fresh.archives[1].answers[first.id].positions[shown.workIds[0]],95);
});

test('The actual journey host preserves the neutral anchor and all three labels after rendering',async()=>{
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/'}),previous={};
  dom.window.matchMedia=()=>({matches:false});
  for(const key of ['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight']){previous[key]=globalThis[key];globalThis[key]=key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:key==='innerWidth'?1280:key==='innerHeight'?720:dom.window[key];}
  try{
    const app=dom.window.document.querySelector('main'),study=createDeepStudy({app,getWorks:()=>works,image:w=>`<img data-artwork="${w.id}" alt="${w.title}">`,esc:String,keepButtons:()=>'',navigate:()=>{},showArtwork:()=>{},mode:'journey'});
    await study.restore();study.handle('deep-start');study.render();
    assert.deepEqual([...app.querySelectorAll('.spectrum-labels>span')].map(el=>el.textContent),['Strongly dislike','Neutral','Strongly like']);
    assert.match(app.querySelector('[data-action="place-spectrum"]').getAttribute('aria-label'),/Every point from 0 to 100/);
  }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});
