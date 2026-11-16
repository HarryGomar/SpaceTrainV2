import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createInteractions} from '../../public/art-atlas/interactions.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';

function fixture(width=390,points={}){
  const dom=new JSDOM('<main id="app"></main>',{pretendToBeVisual:true}),previous={};
  for(const name of ['window','document','requestAnimationFrame','cancelAnimationFrame','innerHeight']){previous[name]=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='window'?dom.window:name==='document'?dom.window.document:name==='innerHeight'?844:dom.window[name].bind(dom.window)});}
  dom.window.matchMedia=()=>({matches:width<=700});
  const works=Array.from({length:4},(_,i)=>({id:'painting-'+i,title:'Painting '+i,image:'image-'+i+'.jpg'})),round={id:'map',kind:'grid',axis:'achievement',works},draft={workIds:works.map(w=>w.id),axis:'achievement',points:structuredClone(points),confirmed:false};
  const app=dom.window.document.querySelector('#app');let saves=0;
  const input=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>true,image:w=>`<img src="${w.image}" alt="Painting">`,esc:String,workById:id=>works.find(w=>w.id===id),saveDraft:()=>saves++,sync:()=>{}});
  app.innerHTML=`<section class="journey-question deep-question"><div class="deep-round-body">${input.markup()}</div></section>`;
  app.addEventListener('click',e=>{const control=e.target.closest('[data-action]');if(control)input.click(control.dataset.action,control,e);});input.attach();
  const pad=app.querySelector('#response-pad');pad.setPointerCapture=()=>{};pad.getBoundingClientRect=()=>({left:0,right:300,top:0,bottom:300,width:300,height:300});
  function place(x,y){for(const type of ['pointerdown','pointerup']){const e=new dom.window.Event(type,{bubbles:true});Object.defineProperties(e,{button:{value:0},clientX:{value:x},clientY:{value:y},pointerId:{value:1}});pad.dispatchEvent(e);}}
  return {app,input,round,draft,place,get saves(){return saves;},close(){dom.window.close();for(const [key,value]of Object.entries(previous)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}};
}

test('A phone map shows the painting first, preserves an editable placement, then reviews all four together',()=>{
  const f=fixture();try{
    const layout=f.app.querySelector('.mobile-map-mode');assert.equal(layout.dataset.mapStage,'painting');assert.deepEqual(f.draft.points,{});assert.deepEqual(f.input.mobileMapAction(),{label:'Place on map',disabled:false});
    f.input.advanceMobileMap();assert.equal(layout.dataset.mapStage,'map');assert.equal(f.input.mobileMapAction().disabled,true);assert.deepEqual(f.draft.points,{});
    for(let i=0;i<4;i++){
      if(i){assert.equal(layout.dataset.mapStage,'painting');f.input.advanceMobileMap();}
      f.place(150,150);assert.deepEqual(f.draft.points['painting-'+i],[50,50]);assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-'+i,'Touch release does not silently switch to another painting before review');
      assert.equal(f.input.mobileMapAction().label,i<3?'Next painting':'Review map');assert.equal(f.input.mobileMapAction().disabled,false);f.input.advanceMobileMap();
    }
    assert.equal(layout.dataset.mapStage,'review');assert.equal(f.input.mobileMapAction(),null);assert.equal(f.input.advanceMobileMap(),false);assert.equal(f.app.querySelectorAll('.map-token').length,4);assert.ok(validAnswer(f.round,{...f.draft,confirmed:true}));
    const inspect=f.app.querySelector('.mobile-map-toolbar button');assert.equal(inspect.dataset.action,'zoom');assert.equal(inspect.dataset.work,'painting-3');assert.equal(inspect.getAttribute('aria-label'),'View painting full screen');assert.equal(Object.keys(f.draft.points).length,4);assert.equal(f.saves,4);
  }finally{f.close();}
});

test('A restored complete phone map opens at review and desktop map gestures keep their original flow',()=>{
  const saved=Object.fromEntries(Array.from({length:4},(_,i)=>['painting-'+i,[10+i,90-i]])),phone=fixture(390,saved);
  try{assert.equal(phone.app.querySelector('.map-layout').dataset.mapStage,'review');assert.equal(phone.input.mobileMapAction(),null);assert.deepEqual(phone.draft.points,saved);}finally{phone.close();}
  const desktop=fixture(1280);try{assert.equal(desktop.app.querySelector('.mobile-map-mode'),null);assert.equal(desktop.input.mobileMapAction(),null);assert.equal(desktop.input.advanceMobileMap(),false);desktop.place(150,150);assert.equal(desktop.app.querySelector('.focus-art').dataset.work,'painting-1');assert.deepEqual(desktop.draft.points,{'painting-0':[50,50]});}finally{desktop.close();}
});
