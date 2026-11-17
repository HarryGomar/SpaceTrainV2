import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createInteractions} from '../../public/art-atlas/interactions.mjs';
import {withContinuousPreference,CONTINUOUS_SCALE} from '../../public/art-atlas/continuous-preference.mjs';
import {taskSignal} from '../../public/art-atlas/task-signals.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';

function fixture(width=390,initial=[90,93,96,99]){
  const dom=new JSDOM('<main></main>'),keys=['window','document','requestAnimationFrame','cancelAnimationFrame','innerHeight'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?dom.window:key==='document'?dom.window.document:key==='innerHeight'?844:key==='requestAnimationFrame'?()=>0:()=>{}});
  dom.window.matchMedia=query=>({matches:!query.includes('max-width')||width<=Number(/max-width:\s*(\d+)/.exec(query)?.[1]||0),addEventListener(){},removeEventListener(){}});
  const works=Array.from({length:4},(_,i)=>({id:'work-'+i,title:'Painting '+i,image:'assets/fixture-'+i+'.jpg'})),round=withContinuousPreference({id:'personal-appeal',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice'}}),draft={workIds:works.map(work=>work.id),criterion:'preference',positions:initial?Object.fromEntries(works.map((work,i)=>[work.id,initial[i]])):{},confirmed:false},app=dom.window.document.querySelector('main');let saved=0;
  const input=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>true,image:work=>'<img src="'+work.image+'" alt="Painting">',esc:String,workById:id=>works.find(work=>work.id===id),saveDraft:()=>saved++,sync(){}});
  app.innerHTML='<section class="deep-question journey-question"><div class="deep-round-body">'+input.markup()+'</div></section>';app.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control)input.click(control.dataset.action,control,event);});input.attach();
  return {dom,app,input,round,draft,get saved(){return saved;},close(){dom.window.close();for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}

test('Personal appeal keeps its three anchors, visible points and shared painting line on mobile and desktop',()=>{
  for(const width of [390,1280]){const f=fixture(width);try{assert.deepEqual([...f.app.querySelectorAll('.spectrum-labels>span')].map(node=>node.textContent),Object.values(CONTINUOUS_SCALE));assert.equal(f.app.querySelectorAll('.spectrum-token img').length,4);assert.deepEqual([...f.app.querySelectorAll('.position-value')].map(node=>node.textContent),['90','93','96','99']);assert.deepEqual([...f.app.querySelectorAll('.reference-rating')].map(node=>node.textContent),['90','93','96','99']);assert.match(f.app.querySelector('#fine-controls').textContent,/90/);assert.match(f.app.querySelector('.spectrum-hit').getAttribute('aria-label'),/Neutral is 50/);assert.equal(taskSignal(f.round).label,'Personal appeal');}finally{f.close();}}
});

test('The personal appeal phone input retains every integer, exact neutral and one-step line adjustments without changing its source definition',()=>{
  const f=fixture();try{const definition=structuredClone(f.round),range=f.app.querySelector('#mobile-spectrum-range');assert.equal(range.min,'0');assert.equal(range.max,'100');assert.equal(range.step,'1');assert.match(range.getAttribute('aria-label'),/^Rate painting/);assert.equal(range.getAttribute('aria-valuetext'),'90 of 100');
    for(let value=0;value<=100;value++){range.value=String(value);range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.draft.positions['work-0'],value);assert.equal(range.getAttribute('aria-valuetext'),value+' of 100');}
    range.dispatchEvent(new f.dom.window.Event('blur'));range.value='99';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.app.querySelectorAll('#fine-controls button').length,0);assert.equal(f.draft.positions['work-0'],99);assert.ok(validAnswer(f.round,{...f.draft,confirmed:true}));assert.deepEqual(f.round,definition);
  }finally{f.close();}
});

test('The initial neutral-looking thumb is not a personal appeal answer',()=>{
  const f=fixture(390,null);try{assert.deepEqual(f.draft.positions,{});const range=f.app.querySelector('#mobile-spectrum-range');assert.equal(range.value,'50');assert.equal(range.getAttribute('aria-valuetext'),'Not rated');assert.equal(validAnswer(f.round,{...f.draft,confirmed:true}),false);}finally{f.close();}
});
