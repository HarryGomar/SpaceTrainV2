import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createOpeningScene} from '../../public/art-atlas/opening-scene.mjs';

const markup='<section class="opening-screen"><canvas data-art-scene></canvas><button data-scene-motion></button></section>';
function fixture({paused=true,autoLoad=true,count=3}={}){
  const dom=new JSDOM('<main>'+markup+'</main>',{url:'https://example.org/art-atlas/',pretendToBeVisual:true}),window=dom.window,app=window.document.querySelector('main'),images=[],canvases=[],contexts=new Map(),frames=new Map();let frameId=0;
  const media={matches:paused,addEventListener(){},removeEventListener(){}};window.matchMedia=()=>media;window.ResizeObserver=class{observe(){}disconnect(){}};
  window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);
  window.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:900,height:650,right:900,bottom:650};};
  window.HTMLCanvasElement.prototype.getContext=function(type){if(!canvases.includes(this))canvases.push(this);if(type!=='2d')return null;if(!contexts.has(this))contexts.set(this,{draws:[],setTransform(){},fillRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(...args){this.draws.push(args);}});return contexts.get(this);};
  window.Image=class{
    constructor(){this.naturalWidth=600;this.naturalHeight=450;this.removed=false;images.push(this);}
    set src(value){this.url=value;this.requestedUrl=value;if(autoLoad)queueMicrotask(()=>this.onload?.());}
    get src(){return this.url;}
    removeAttribute(name){if(name==='src'){this.url='';this.removed=true;}}
  };
  const works=Array.from({length:count},(_,i)=>({id:'w'+i,title:'Artwork '+i,artist:'Artist '+i,image:'assets/w'+i+'.jpg',sourceUrl:'https://museum.example/'+i,studyEligible:true,country:i%2?'Mexico':'France',recognitionTier:'landmark'})),scene=createOpeningScene({app,getWorks:()=>works,seed:12345});
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
  return {dom,window,app,scene,images,canvases,contexts,frames,flush,close(){scene.destroy();dom.window.close();}};
}

test('Canvas fallback draws packed crops and releases temporary image handlers and sources after packing',async()=>{
  const f=fixture();try{await f.flush();const canvas=f.app.querySelector('[data-art-scene]'),draws=f.contexts.get(canvas).draws;assert.equal(canvas.dataset.sceneRenderer,'canvas2d');assert.equal(canvas.dataset.sceneImages,'3');assert.equal(canvas.dataset.sceneStatus,'static');assert.equal(f.frames.size,0,'Reduced motion stays paused');assert.ok(draws.length);assert.ok(draws.every(args=>args[0] instanceof f.window.HTMLCanvasElement),'Painting draws use the single packed canvas');assert.ok(draws.every(args=>args.length===9),'Each draw supplies the packed pixel rectangle');assert.ok(f.images.every(img=>img.onload===null&&img.onerror===null&&img.removed),'No settled source retains load handlers or a decoded image URL');}finally{f.close();}
});

test('Leaving the opening releases atlas pixels and returning retains the same visit order and seed',async()=>{
  const f=fixture();try{await f.flush();const first=f.app.querySelector('[data-art-scene]'),seed=first.dataset.sceneSeed,order=f.images.map(img=>img.requestedUrl),atlas=f.contexts.get(first).draws.at(-1)[0];assert.ok(atlas.width>=2048);f.app.innerHTML='<section>Quiz</section>';f.scene.sync();assert.equal(atlas.width,1);assert.equal(atlas.height,1);assert.equal(f.frames.size,0);f.app.innerHTML=markup;f.scene.sync();await f.flush();assert.equal(f.app.querySelector('[data-art-scene]').dataset.sceneSeed,seed);assert.deepEqual(f.images.slice(order.length).map(img=>img.requestedUrl),order);}finally{f.close();}
});

test('Leaving before downloads settle cancels pending image sources and prevents late drawing',async()=>{
  const f=fixture({autoLoad:false});try{const pending=[...f.images],atlas=f.canvases.find(canvas=>canvas.width===2048);assert.equal(pending.length,3);f.app.innerHTML='<section>Quiz</section>';f.scene.sync();assert.ok(pending.every(img=>img.onload===null&&img.onerror===null&&img.removed));assert.equal(atlas.width,1);assert.equal(atlas.height,1);for(const img of pending)img.onload?.();await f.flush();assert.equal(f.app.querySelector('[data-art-scene]'),null);assert.equal(f.frames.size,0);}finally{f.close();}
});

test('An image failure releases its source too, and other packed paintings remain available',async()=>{
  const f=fixture({autoLoad:false});try{f.images[0].onerror();for(const img of f.images.slice(1))img.onload();const canvas=f.app.querySelector('[data-art-scene]');assert.equal(canvas.dataset.sceneImages,'2');assert.ok(f.images.every(img=>img.removed&&img.onload===null&&img.onerror===null));assert.ok(f.contexts.get(canvas).draws.every(args=>args[0] instanceof f.window.HTMLCanvasElement));}finally{f.close();}
});

test('A 480-image opening retains one 4096 atlas, without 480 decoded source URLs',async()=>{
  const f=fixture({count:480});try{await f.flush();const canvas=f.app.querySelector('[data-art-scene]'),draws=f.contexts.get(canvas).draws;assert.equal(canvas.dataset.sceneImages,'480');assert.equal(canvas.dataset.scenePaintings,'480');assert.equal(new Set(draws.map(args=>args[0])).size,1);assert.equal(draws[0][0].width,4096);assert.ok(f.images.every(img=>img.removed));}finally{f.close();}
});
