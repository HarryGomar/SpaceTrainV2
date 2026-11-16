import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createOpeningScene} from '../../public/art-atlas/opening-scene.mjs';

const markup='<section class="opening-screen"><canvas data-art-scene></canvas><button data-scene-motion></button></section>';
function fixture({paused=true,storedMotion=null,autoLoad=true,count=3,width=900,height=650}={}){
  const dom=new JSDOM('<main>'+markup+'</main>',{url:'https://example.org/art-atlas/',pretendToBeVisual:true}),window=dom.window,app=window.document.querySelector('main'),images=[],canvases=[],contexts=new Map(),frames=new Map(),resizes=new Set(),viewport={width,height};let frameId=0;
  const media={matches:paused,addEventListener(){},removeEventListener(){}};window.matchMedia=()=>media;window.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){resizes.add(this.callback);}disconnect(){resizes.delete(this.callback);}};
  window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);
  window.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,...viewport,right:viewport.width,bottom:viewport.height};};
  window.HTMLCanvasElement.prototype.getContext=function(type){if(!canvases.includes(this))canvases.push(this);if(type!=='2d')return null;if(!contexts.has(this))contexts.set(this,{draws:[],setTransform(){},fillRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(...args){this.draws.push(args);}});return contexts.get(this);};
  window.Image=class{
    constructor(){this.naturalWidth=600;this.naturalHeight=450;this.removed=false;images.push(this);}
    set src(value){this.url=value;this.requestedUrl=value;if(autoLoad)queueMicrotask(()=>this.onload?.());}
    get src(){return this.url;}
    removeAttribute(name){if(name==='src'){this.url='';this.removed=true;}}
  };
  if(storedMotion)window.localStorage.setItem('art-profile-opening-motion',storedMotion);
  const works=Array.from({length:count},(_,i)=>({id:'w'+i,title:'Artwork '+i,artist:'Artist '+i,image:'assets/w'+i+'.jpg',sourceUrl:'https://museum.example/'+i,studyEligible:true,country:i%2?'Mexico':'France',recognitionTier:'landmark'})),scene=createOpeningScene({app,getWorks:()=>works,seed:12345});
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(window.performance.now()+100);};
  return {dom,window,app,scene,images,canvases,contexts,frames,flush,step(){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(window.performance.now()+1000);},resize(width,height){Object.assign(viewport,{width,height});for(const callback of resizes)callback();},close(){scene.destroy();dom.window.close();}};
}

test('The opening autoplays on a new visit even when an older visit stored Pause',async()=>{
  const f=fixture({paused:false,storedMotion:'pause'});try{await f.flush();assert.equal(f.app.querySelector('[data-art-scene]').dataset.sceneStatus,'running');assert.equal(f.app.querySelector('[data-scene-motion]').getAttribute('aria-label'),'Pause animation');assert.equal(f.frames.size,1);}finally{f.close();}
});

test('Reduced motion starts a gentle moving scene, and Pause remains an immediate session control',async()=>{
  const gentle=fixture(),full=fixture({paused:false,storedMotion:'play'});try{
    await gentle.flush();await full.flush();gentle.step();full.step();
    const g=gentle.app.querySelector('[data-art-scene]'),f=full.app.querySelector('[data-art-scene]');assert.equal(g.dataset.sceneStatus,'running');assert.equal(g.dataset.sceneMotionMode,'gentle');assert.equal(f.dataset.sceneMotionMode,'full');assert.ok(Number(g.dataset.sceneTime)>0);assert.ok(Number(g.dataset.sceneTime)<Number(f.dataset.sceneTime));
    const button=full.app.querySelector('[data-scene-motion]');button.click();assert.equal(f.dataset.sceneStatus,'static');assert.equal(full.frames.size,0);assert.equal(full.window.localStorage.getItem('art-profile-opening-motion'),'play','Pausing this visit does not overwrite a future visit default');button.click();assert.equal(f.dataset.sceneStatus,'running');assert.equal(full.frames.size,1);
  }finally{gentle.close();full.close();}
});

test('Canvas fallback draws packed crops and releases temporary image handlers and sources after packing',async()=>{
  const f=fixture();try{await f.flush();const canvas=f.app.querySelector('[data-art-scene]'),draws=f.contexts.get(canvas).draws;assert.equal(canvas.dataset.sceneRenderer,'canvas2d');assert.equal(canvas.dataset.sceneImages,'3');assert.equal(canvas.dataset.sceneStatus,'running');assert.equal(f.frames.size,1,'Reduced motion uses a gentle moving scene');assert.ok(draws.length);assert.ok(draws.every(args=>args[0] instanceof f.window.HTMLCanvasElement),'Painting draws use the single packed canvas');assert.ok(draws.every(args=>args.length===9),'Each draw supplies the packed pixel rectangle');assert.ok(f.images.every(img=>img.onload===null&&img.onerror===null&&img.removed),'No settled source retains load handlers or a decoded image URL');}finally{f.close();}
});

test('Leaving the opening releases atlas pixels and returning retains the same visit order and seed',async()=>{
  const f=fixture();try{await f.flush();const first=f.app.querySelector('[data-art-scene]'),seed=first.dataset.sceneSeed,order=f.images.map(img=>img.requestedUrl),atlas=f.contexts.get(first).draws.at(-1)[0];assert.ok(atlas.width>=2048);f.app.innerHTML='<section>Quiz</section>';f.scene.sync();assert.equal(atlas.width,1);assert.equal(atlas.height,1);assert.equal(f.frames.size,0);f.app.innerHTML=markup;f.scene.sync();await f.flush();assert.equal(f.app.querySelector('[data-art-scene]').dataset.sceneSeed,seed);assert.deepEqual(f.images.slice(order.length).map(img=>img.requestedUrl),order);}finally{f.close();}
});

test('Leaving before downloads settle cancels pending image sources and prevents late drawing',async()=>{
  const f=fixture({autoLoad:false});try{const pending=[...f.images],atlas=f.canvases.find(canvas=>canvas.width===2048);assert.equal(pending.length,3);f.app.innerHTML='<section>Quiz</section>';f.scene.sync();assert.ok(pending.every(img=>img.onload===null&&img.onerror===null&&img.removed));assert.equal(atlas.width,1);assert.equal(atlas.height,1);for(const img of pending)img.onload?.();await f.flush();assert.equal(f.app.querySelector('[data-art-scene]'),null);assert.equal(f.frames.size,0);}finally{f.close();}
});

test('An image failure releases its source too, and other packed paintings remain available',async()=>{
  const f=fixture({autoLoad:false});try{f.images[0].onerror();for(const img of f.images.slice(1))img.onload();await f.flush();const canvas=f.app.querySelector('[data-art-scene]');assert.equal(canvas.dataset.sceneImages,'2');assert.ok(f.images.every(img=>img.removed&&img.onload===null&&img.onerror===null));assert.ok(f.contexts.get(canvas).draws.every(args=>args[0] instanceof f.window.HTMLCanvasElement));}finally{f.close();}
});

test('A 480-image opening retains one 4096 atlas, without 480 decoded source URLs',async()=>{
  const f=fixture({count:480});try{await f.flush();const canvas=f.app.querySelector('[data-art-scene]'),draws=f.contexts.get(canvas).draws;assert.equal(canvas.dataset.sceneImages,'480');assert.equal(canvas.dataset.scenePaintings,'480');assert.equal(new Set(draws.map(args=>args[0])).size,1);assert.equal(draws[0][0].width,4096);assert.ok(f.images.every(img=>img.removed));}finally{f.close();}
});

test('Phone controller renders 96 smaller layers and resize restores desktop without reloading or changing the visit',async()=>{
  const f=fixture({count:480,width:390,height:844});try{
    await f.flush();const canvas=f.app.querySelector('[data-art-scene]'),seed=canvas.dataset.sceneSeed,draws=f.contexts.get(canvas).draws;
    assert.equal(canvas.dataset.scenePaintings,'96');assert.equal(canvas.dataset.scenePoints,'9600');assert.equal(canvas.dataset.sceneImages,'480');
    assert.ok(Math.max(...draws.map(args=>Math.max(args[7],args[8])))<105,'Actual fallback painting dimensions fit the phone treatment');
    f.resize(1440,900);assert.equal(canvas.dataset.scenePaintings,'480');assert.equal(canvas.dataset.scenePoints,'26000');assert.equal(canvas.dataset.sceneSeed,seed);
    f.resize(390,844);assert.equal(canvas.dataset.scenePaintings,'96');assert.equal(canvas.dataset.sceneSeed,seed);assert.equal(f.images.length,480,'Resizing reuses the same packed collection');assert.equal(f.frames.size,1,'The gentle animation continues through both resizes');
  }finally{f.close();}
});
