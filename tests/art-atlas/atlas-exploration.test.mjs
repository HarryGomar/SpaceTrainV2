import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {layoutComparisonGroups,comparisonNeighbourhood} from '../../public/art-atlas/atlas-comparison-layout.mjs';
import {atlasChoiceColours,atlasDimensionColour} from '../../public/art-atlas/atlas-colours.mjs';
import {axisColours} from '../../public/art-atlas/task-signals.mjs';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {snapshotStudyRound} from '../../public/art-atlas/deep-study.mjs';

test('A large connected comparison group receives room without losing its small neighbouring groups',()=>{
  const groups=[{id:'large',workIds:Array.from({length:64},(_,i)=>'w'+i)},{id:'small-a',workIds:['a','b','c','d']},{id:'small-b',workIds:['e','f','g','h']}],before=structuredClone(groups),layout=layoutComparisonGroups(groups,{width:1000,height:500});
  assert.equal(layout.length,72);assert.equal(new Set(layout.map(p=>p.workId)).size,72);assert.ok(layout.every(p=>p.x>0&&p.x<100&&p.y>0&&p.y<100));
  for(let i=0;i<layout.length;i++)for(const b of layout.slice(i+1)){const a=layout[i],half=(a.thumbnailSize+b.thumbnailSize)/2;assert.ok(Math.abs(a.x-b.x)*10>=half||Math.abs(a.y-b.y)*5>=half,'Overview thumbnails have separate display space');}
  assert.deepEqual(layoutComparisonGroups([...groups].reverse(),{width:1000,height:500}),layout);assert.deepEqual(groups,before);
});

test('Focus includes actual direct comparisons and never treats a chain as a comparison',()=>{
  const graph={comparisons:[{roundId:'one',workIds:['a','b']},{roundId:'one',workIds:['b','c']},{roundId:'two',workIds:['a','d']}]},before=structuredClone(graph);
  assert.deepEqual(comparisonNeighbourhood(graph,'a'),['a','b','d']);assert.deepEqual(comparisonNeighbourhood(graph,'a','one'),['a','b']);assert.deepEqual(graph,before);
});

test('Picker colours use the actual map axes, and dimension colours stay stable across axis placement',()=>{
  const maps=[{id:'admiration',axisId:'achievement'},{id:'attention',axisId:'attention'},{id:'return',axisId:'returnResponse'}],colours=atlasChoiceColours({dimensions:[{id:'complexity'},{id:'color'}],maps});
  for(const map of maps)assert.deepEqual(colours[map.id],axisColours(map.axisId));
  assert.deepEqual(colours.complexity,[atlasDimensionColour('complexity'),atlasDimensionColour('complexity')]);assert.notEqual(colours.complexity[0],colours.color[0]);
});

test('The comparison interface can focus a painting or original question without changing responses',async()=>{
  const works=Array.from({length:8},(_,i)=>({id:'test-'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/'+i,image:'assets/test-'+i+'.jpg',sha256:(i+1).toString(16).padStart(64,'0'),width:600,height:400,features:{abstraction:.4,energy:.5,complexity:.5,humanity:.5,narrative:.4,atmosphere:.4,color:.5}}));
  const rounds=[0,1].map(index=>withContinuousPreference({id:'journey-00'+(index+1),kind:'spectrum',criterion:'preference',title:'Comparison '+index,hint:'Place each painting on the appeal line.',works:works.slice(index*4,index*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}));
  const answers=Object.fromEntries(rounds.map(round=>[round.id,{workIds:round.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(round.works.map((w,i)=>[w.id,95-i*25])),confirmed:true}])),saved={manifest:{protocol:'art-profile-50-v1',catalogue:works},shown:Object.fromEntries(rounds.map(round=>[round.id,snapshotStudyRound(round)])),answers},original=structuredClone(saved);
  const dom=new JSDOM('<main id="atlas"></main><dialog id="atlas-method"><button>Close</button><div></div></dialog>',{url:'https://example.test/art-atlas/maps.html'}),keys=['window','document','localStorage','location','ResizeObserver','requestAnimationFrame','fetch'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const set=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  try{
    set('window',dom.window);set('document',dom.window.document);set('localStorage',dom.window.localStorage);set('location',dom.window.location);set('ResizeObserver',class{observe(){}disconnect(){}});set('requestAnimationFrame',()=>0);set('fetch',async()=>({ok:true,json:async()=>works}));
    dom.window.scrollTo=()=>{};localStorage.setItem('art-profile-journey-v1',JSON.stringify(saved));
    await import('../../public/art-atlas/response-atlas.mjs?exploration-test');
    const app=document.querySelector('#atlas');app.querySelector('[data-mode=comparisons]').click();
    assert.equal(app.querySelectorAll('[data-point]').length,8);assert.equal(app.querySelectorAll('.atlas-edge').length,0,'The overview starts without an unreadable all-edge web');assert.equal(app.querySelectorAll('.has-thumbnail').length,8);
    app.querySelector('[data-point]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));assert.ok(app.querySelectorAll('.atlas-edge').length>0);assert.equal(app.querySelector('[data-focus-comparisons]').disabled,false);
    app.querySelector('[data-focus-comparisons]').click();assert.equal(app.querySelectorAll('[data-point]').length,4);assert.equal(app.querySelector('[data-all-comparisons]').hidden,false);
    app.querySelector('[data-all-comparisons]').click();assert.equal(app.querySelectorAll('[data-point]').length,8);
    const question=app.querySelector('#atlas-comparison-question');question.value=rounds[1].id;question.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(app.querySelectorAll('[data-point]').length,4);assert.equal(app.querySelectorAll('.atlas-edge').length,6);
    assert.deepEqual(JSON.parse(localStorage.getItem('art-profile-journey-v1')),original);
  }finally{for(const [key,value]of Object.entries(previous))if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];dom.window.close();}
});
