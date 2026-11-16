import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createInteractions} from '../../public/art-atlas/interactions.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
import {renderOpening} from '../../public/art-atlas/experience-view.mjs';

function fixture({width=390,count=4,positions={},ready=true}={}){
  const dom=new JSDOM('<!doctype html><main id="app"></main>',{pretendToBeVisual:true}),previous={};
  for(const name of ['window','document','requestAnimationFrame','cancelAnimationFrame','innerHeight']){previous[name]=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='window'?dom.window:name==='document'?dom.window.document:name==='innerHeight'?844:dom.window[name].bind(dom.window)});}
  let screenWidth=width;dom.window.matchMedia=query=>({matches:!query.includes('max-width')||screenWidth<=Number(/max-width:\s*(\d+)/.exec(query)?.[1]||0),addEventListener(){},removeEventListener(){}});
  const works=Array.from({length:count},(_,i)=>({id:'painting-'+i,title:'Painting '+i,image:'image-'+i+'.jpg'}));
  let round=withOverallAppeal({id:'round-1',kind:'spectrum',criterion:'preference',title:'How much does each painting appeal to you?',works,evidence:{construct:'preference',family:'individual-choice'}}),draft={workIds:works.map(work=>work.id),criterion:'preference',positions:{...positions},confirmed:false},saves=0,isReady=ready;
  const app=dom.window.document.querySelector('#app'),image=work=>`<img src="${work.image}" alt="Painting">`,input=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>isReady,image,esc:String,workById:id=>round.works.find(work=>work.id===id),saveDraft:()=>saves++,sync:()=>{}});
  app.innerHTML=`<section class="deep-question journey-question" data-kind="spectrum"><div class="deep-round-body">${input.markup()}</div></section>`;
  app.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control)input.click(control.dataset.action,control,event);});input.attach();
  const pointer=(type,{x=50,y=50}={})=>{const event=new dom.window.Event(type,{bubbles:true});Object.defineProperties(event,{button:{value:0},clientX:{value:x},clientY:{value:y},pointerId:{value:1},isPrimary:{value:true}});return event;};
  const rate=(value,{changeFirst=false}={})=>{const range=app.querySelector('#mobile-spectrum-range');assert.ok(range,'A phone-sized spectrum has a native granular control');range.dispatchEvent(pointer('pointerdown'));range.value=String(value);range.dispatchEvent(new dom.window.Event('input',{bubbles:true}));if(changeFirst)range.dispatchEvent(new dom.window.Event('change',{bubbles:true}));range.dispatchEvent(pointer('pointerup'));if(!changeFirst)range.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  return {dom,app,input,works,pointer,rate,get draft(){return draft;},get round(){return round;},get saves(){return saves;},setReady(value){isReady=value;input.refresh();},resize(value){screenWidth=value;dom.window.dispatchEvent(new dom.window.Event('resize'));},switchRound(){round={...round,id:'round-2'};draft={workIds:works.map(work=>work.id),criterion:'preference',positions:{},confirmed:false};},close(){dom.window.close();for(const name of Object.keys(previous)){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}}};
}

test('A completed phone spectrum retains all four paintings on the shared line and a large focused work',()=>{
  const f=fixture({positions:{'painting-0':50,'painting-1':50,'painting-2':50,'painting-3':50}});try{assert.equal(f.app.querySelectorAll('.focus-art img').length,1);assert.equal(f.app.querySelectorAll('.reference-art img').length,4);assert.equal(f.app.querySelectorAll('.spectrum-token img').length,4,'The same shared painting line remains available on the phone');assert.equal(f.app.querySelectorAll('img').length,9);assert.ok(f.app.querySelector('.mobile-spectrum-mode'));}finally{f.close();}
});

test('A mobile rating offers every integer point and advances only after the gesture finishes',()=>{
  const f=fixture();try{const range=f.app.querySelector('#mobile-spectrum-range');assert.ok(range);assert.equal(range.min,'0');assert.equal(range.max,'100');assert.equal(range.step,'1');assert.deepEqual(f.draft.positions,{},'The neutral-looking starting thumb is not an answer');
    range.dispatchEvent(f.pointer('pointerdown'));range.value='73';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.draft.positions['painting-0'],73);assert.equal(f.saves,0,'Touch movement previews without serializing the whole saved study on every frame');assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-0');range.dispatchEvent(f.pointer('pointerup'));range.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.equal(f.saves,1);assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-1');assert.deepEqual(f.draft.positions,{'painting-0':73});
    f.rate(0,{changeFirst:true});f.rate(100);f.rate(41);assert.deepEqual(f.draft.positions,{'painting-0':73,'painting-1':0,'painting-2':100,'painting-3':41});assert.ok(validAnswer(f.round,{...f.draft,confirmed:true}));assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-3');assert.deepEqual([...f.app.querySelectorAll('.reference-rating')].map(node=>node.textContent),['73','0','100','41']);
  }finally{f.close();}
});

test('Tapping a reference returns to its painting without changing any ratings, then edits stay on that painting',()=>{
  const f=fixture({positions:{'painting-0':25,'painting-1':50,'painting-2':75,'painting-3':100}});try{const before=structuredClone(f.draft),saves=f.saves;f.app.querySelector('.reference-art[data-work="painting-2"]').click();assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-2');assert.deepEqual(f.draft,before);assert.equal(f.saves,saves);f.rate(76);assert.equal(f.draft.positions['painting-2'],76);assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-2');const decrement=f.app.querySelector('#fine-controls [data-dx="-1"]');decrement.focus();decrement.click();assert.equal(f.draft.positions['painting-2'],75);assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-2');assert.ok(f.dom.window.document.activeElement.matches('#fine-controls [data-dx="-1"]'),'A mobile nudge retains focus on its visible adjustment control');}finally{f.close();}
});

test('An intentional tap at neutral records50, while keyboard adjustment waits for Enter before advancing',()=>{
  const f=fixture();try{const range=f.app.querySelector('#mobile-spectrum-range');assert.ok(range);range.dispatchEvent(f.pointer('pointerdown'));range.dispatchEvent(f.pointer('pointerup'));assert.deepEqual(f.draft.positions,{'painting-0':50});assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-1');range.value='61';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));range.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-1');range.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-2');assert.equal(f.draft.positions['painting-1'],61);}finally{f.close();}
});

test('Readiness and an old gesture cannot write into another question',()=>{
  const f=fixture({ready:false});try{const range=f.app.querySelector('#mobile-spectrum-range');assert.ok(range);assert.equal(range.disabled,true);range.value='88';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.deepEqual(f.draft.positions,{});f.setReady(true);assert.equal(range.disabled,false);range.dispatchEvent(f.pointer('pointerdown'));f.switchRound();range.dispatchEvent(f.pointer('pointerup'));range.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.deepEqual(f.draft.positions,{});assert.equal(f.saves,0);}finally{f.close();}
});

test('The desktop comparison retains all four placed artwork tokens and its existing granular nudge behavior',()=>{
  const f=fixture({width:1280,positions:{'painting-0':10,'painting-1':20,'painting-2':30,'painting-3':40}});try{assert.equal(f.app.querySelectorAll('.spectrum-token img').length,4);assert.equal(f.app.querySelector('.mobile-spectrum-mode'),null);f.app.querySelector('.reference-art[data-work="painting-1"]').click();f.app.querySelector('#fine-controls [data-dx="1"]').click();assert.equal(f.draft.positions['painting-1'],21);assert.ok(validAnswer(f.round,{...f.draft,confirmed:true}));}finally{f.close();}
});

test('Mobile edits retain all101 values and the original question and answer shape',()=>{
  const f=fixture({positions:{'painting-0':10,'painting-1':20,'painting-2':30,'painting-3':40}});try{const definition=structuredClone(f.round);for(let value=0;value<=100;value++){f.rate(value);assert.equal(f.draft.positions['painting-0'],value);assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-0');}assert.deepEqual(f.round,definition);assert.deepEqual(Object.keys(f.draft).sort(),['confirmed','criterion','positions','workIds']);assert.deepEqual(f.draft.positions,{'painting-0':100,'painting-1':20,'painting-2':30,'painting-3':40});assert.ok(validAnswer(f.round,{...f.draft,confirmed:true}));}finally{f.close();}
});

test('A cancelled touch preserves the last visible point once without advancing',()=>{
  const f=fixture();try{const range=f.app.querySelector('#mobile-spectrum-range');range.dispatchEvent(f.pointer('pointerdown'));for(const value of [20,30,40]){range.value=String(value);range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));}assert.equal(f.saves,0);range.dispatchEvent(f.pointer('pointercancel'));assert.equal(f.saves,1);assert.deepEqual(f.draft.positions,{'painting-0':40});assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-0');range.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.equal(f.saves,1);}finally{f.close();}
});

test('Revisiting a placed desktop painting never silently assigns its rating to an unplaced painting',()=>{
  const f=fixture({width:1280,positions:{'painting-0':51}});try{
    f.app.querySelector('.reference-art[data-work="painting-1"]').click();
    const before=structuredClone(f.draft),saves=f.saves;
    f.app.querySelector('.placed-art[data-work="painting-0"]').click();
    assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-0');
    assert.deepEqual(f.draft,before);assert.equal(f.saves,saves);
    f.app.querySelector('#fine-controls [data-dx="1"]').click();
    assert.equal(f.draft.positions['painting-0'],52);
    assert.equal(f.draft.positions['painting-1'],undefined);
  }finally{f.close();}
});


test('A phone painting can be dragged onto the shared line and advances only after a successful drop',()=>{
  const f=fixture();try{
    const handle=f.app.querySelector('.focus-art');handle.setPointerCapture=()=>{};
    f.app.querySelector('#spectrum-target').getBoundingClientRect=()=>({left:20,right:320,top:170,bottom:270,width:300,height:100});
    Object.defineProperty(f.app.querySelector('.spectrum-rail'),'getBoundingClientRect',{value:()=>({left:20,width:300})});
    handle.dispatchEvent(f.pointer('pointerdown',{x:50,y:50}));
    handle.dispatchEvent(f.pointer('pointermove',{x:170,y:220}));
    assert.deepEqual(f.draft.positions,{});assert.ok(f.dom.window.document.querySelector('.art-drag-ghost'));
    handle.dispatchEvent(f.pointer('pointerup',{x:170,y:220}));
    assert.deepEqual(f.draft.positions,{'painting-0':50});assert.equal(f.saves,1);
    assert.equal(f.app.querySelector('.focus-art').dataset.work,'painting-1');
    assert.equal(f.app.querySelectorAll('.spectrum-token').length,1);assert.equal(f.dom.window.document.querySelector('.art-drag-ghost'),null);
  }finally{f.close();}
});


test('The opening keeps a single primary action for a fresh or started quiz',()=>{
  const fresh=new JSDOM(renderOpening()),started=new JSDOM(renderOpening({started:true,profileAvailable:false}));
  try{for(const dom of [fresh,started])assert.equal(dom.window.document.querySelector('[data-action=deep-retake]'),null);assert.equal(fresh.window.document.querySelector('.opening-start').textContent,'Start');assert.equal(started.window.document.querySelector('.opening-start').textContent,'Continue');assert.equal(started.window.document.querySelector('[data-action=deep-reading]'),null);}finally{fresh.window.close();started.window.close();}
});
