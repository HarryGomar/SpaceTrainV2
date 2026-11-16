import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,createDeepStudy} from '../../public/art-atlas/deep-study.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).slice(0,164),ids=round=>round.works.map(work=>work.id);
async function fixture({kind='grid',complete=false,width=390}={}){
  const dom=new JSDOM('<main></main>',{url:'http://localhost/',storageQuota:20_000_000}),win=dom.window,keys=['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','innerHeight'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));win.matchMedia=()=>({matches:width<=700});for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:key==='innerHeight'?667:win[key]});
  const data=prepareJourneySession(null,works,100),rounds=sessionJourneyRounds(data),index=kind==='grid'?3:0,round=rounds[index],selected=ids(round),points=Object.fromEntries(selected.slice(0,complete?4:1).map((id,i)=>[id,[20+i*10,80-i*10]])),positions=Object.fromEntries(selected.slice(0,complete?4:2).map((id,i)=>[id,30+i*20]));data.index=index;data.screen='question';data.startedAt=100;data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]={workIds:selected,...(kind==='grid'?{axis:round.axis,points}:{criterion:round.criterion,positions}),confirmed:false};localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));
  const app=win.document.querySelector('main'),study=createDeepStudy({app,getWorks:()=>works,image:work=>'<img loading="lazy" data-artwork="'+work.id+'" src="'+work.image+'">',esc:String,keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});await study.restore();study.render();
  const state=(img,loaded,broken=false)=>Object.defineProperties(img,{complete:{value:loaded,configurable:true},naturalWidth:{value:loaded&&!broken?100:0,configurable:true}});
  function load(selector){for(const img of app.querySelectorAll(selector))state(img,true);app.querySelector(selector)?.dispatchEvent(new win.Event('load'));}
  const unloadAll=()=>{for(const img of app.querySelectorAll('.deep-round-body img'))state(img,false);};unloadAll();
  return {app,study,round,points,positions,state,load,unloadAll,win,async close(){await study.clear();for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}};
}

test('A restored partial phone map can advance from the painting while its hidden placed-map copy remains unloaded',async()=>{
  const f=await fixture();try{
    assert.equal(f.app.querySelector('.mobile-map-mode').dataset.mapStage,'painting');assert.equal(f.app.querySelector('.map-surround img').complete,false);
    f.load('.focus-column img,.work-overview img');assert.equal(f.app.querySelector('#deep-image-status').hidden,true);assert.equal(f.app.querySelector('[data-action=deep-next]').disabled,false);assert.equal(f.app.querySelector('[data-action=deep-next]').textContent,'Place on map');
    f.study.handle('deep-next');assert.equal(f.app.querySelector('.mobile-map-mode').dataset.mapStage,'map');f.unloadAll();f.load('.mobile-map-toolbar img,.map-surround img');assert.equal(f.app.querySelector('#deep-image-status').hidden,true);assert.equal(f.app.querySelector('#response-pad').getAttribute('aria-disabled'),'false');assert.equal(f.app.querySelector('.focus-column img').complete,false);assert.equal(f.app.querySelector('.work-overview img').complete,false);
    const pad=f.app.querySelector('#response-pad');pad.setPointerCapture=()=>{};pad.getBoundingClientRect=()=>({left:0,top:0,width:300,height:300});for(const type of ['pointerdown','pointerup']){const event=new f.win.Event(type,{bubbles:true});Object.defineProperties(event,{button:{value:0},clientX:{value:150},clientY:{value:150},pointerId:{value:1}});pad.dispatchEvent(event);}f.load('.mobile-map-toolbar img,.map-surround img');assert.equal(f.app.querySelector('[data-action=deep-next]').textContent,'Next painting');assert.equal(f.app.querySelector('[data-action=deep-next]').disabled,false);
  }finally{await f.close();}
});

test('A complete phone map reload can confirm its unchanged points without loading the hidden focus and overview copies',async()=>{
  const f=await fixture({complete:true});try{
    assert.equal(f.app.querySelector('.mobile-map-mode').dataset.mapStage,'review');f.load('.mobile-map-toolbar img,.map-surround img');assert.equal(f.app.querySelector('.focus-column img').complete,false);assert.equal(f.app.querySelector('.work-overview img').complete,false);assert.equal(f.app.querySelector('#deep-image-status').hidden,true);assert.equal(f.app.querySelector('[data-action=deep-next]').textContent,'Continue');assert.equal(f.app.querySelector('[data-action=deep-next]').disabled,false);f.study.handle('deep-next');const exported=f.study.exportData();assert.deepEqual(exported.answers[f.round.id].points,f.points);assert.equal(exported.answers[f.round.id].confirmed,true);
  }finally{await f.close();}
});

test('Phone spectrum readiness ignores only the hidden placed-reference copies, retaining the actual focus and line tokens',async()=>{
  const f=await fixture({kind:'spectrum'});try{
    assert.ok(f.app.querySelector('.mobile-spectrum-mode'));assert.equal(f.app.querySelectorAll('.work-overview .has-placement img').length,2);for(const img of f.app.querySelectorAll('.deep-round-body img'))if(!img.closest('.work-overview .has-placement'))f.state(img,true);f.app.querySelector('.focus-column img').dispatchEvent(new f.win.Event('load'));assert.equal(f.app.querySelector('#deep-image-status').hidden,true);assert.equal(f.app.querySelector('#mobile-spectrum-range').disabled,false);assert.equal(f.app.querySelector('.work-overview .has-placement img').complete,false);
    const hidden=f.app.querySelector('.work-overview .has-placement img');f.state(hidden,true,true);hidden.dispatchEvent(new f.win.Event('error'));assert.equal(f.app.querySelector('#deep-image-status').hidden,true);
    const visible=f.app.querySelector('.spectrum-token img');f.state(visible,true,true);visible.dispatchEvent(new f.win.Event('error'));assert.equal(f.app.querySelector('#deep-image-status').dataset.state,'failed');assert.equal(f.app.querySelector('#mobile-spectrum-range').disabled,true);
  }finally{await f.close();}
});

test('Desktop readiness still waits for its visible placed painting instead of applying the phone stage exclusions',async()=>{
  const f=await fixture({width:1280});try{assert.equal(f.app.querySelector('.mobile-map-mode'),null);f.load('.focus-column img,.work-overview img');assert.equal(f.app.querySelector('#deep-image-status').hidden,false);assert.equal(f.app.querySelector('[data-action=deep-next]').disabled,true);f.load('.map-surround img');assert.equal(f.app.querySelector('#deep-image-status').hidden,true);assert.equal(f.app.querySelector('#response-pad').getAttribute('aria-disabled'),'false');}finally{await f.close();}
});
