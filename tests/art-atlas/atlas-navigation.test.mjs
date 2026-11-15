import test from 'node:test';
import assert from 'node:assert/strict';
import {ATLAS_MAX_ZOOM,clampAtlasView,atlasWorldToScreen,atlasScreenToWorld,zoomAtlasAt,panAtlasBy,pinchAtlasView,wheelZoomFactor,createAtlasNavigation} from '../../public/art-atlas/atlas-navigation.mjs';
import {atlasThumbnailSize,atlasPointLayout} from '../../public/art-atlas/atlas-points.mjs';
const size={width:1000,height:600},close=(a,b)=>a.forEach((value,index)=>assert.ok(Math.abs(value-b[index])<1e-8,`${a} differs from ${b}`));

test('Cursor-anchored zoom keeps the original artwork coordinate beneath the cursor',()=>{
  const view={zoom:1,pan:[0,0]},anchor=[300,250],world=atlasScreenToWorld(anchor,view,size),next=zoomAtlasAt(view,size,2,anchor);
  assert.equal(next.zoom,2);close(next.pan,[200,50]);close(atlasWorldToScreen(world,next,size),anchor);assert.deepEqual(view,{zoom:1,pan:[0,0]});
  const back=zoomAtlasAt(next,size,.5,anchor);close(back.pan,[0,0]);assert.equal(back.zoom,1);
});
test('Screen and artwork transforms are inverse under a translated zoomed viewport',()=>{
  const view={zoom:3.5,pan:[120,-80]};for(const point of [[0,0],[1000,600],[420.5,200.25],[-30,700]])close(atlasScreenToWorld(atlasWorldToScreen(point,view,size),view,size),point);
});
test('Zoom stops at8 and reset-level pan cannot leave the map shifted',()=>{
  let view={zoom:1,pan:[0,0]};for(let i=0;i<30;i++)view=zoomAtlasAt(view,size,1.35);assert.equal(view.zoom,ATLAS_MAX_ZOOM);close(view.pan,[0,0]);
  assert.deepEqual(zoomAtlasAt({zoom:8,pan:[200,100]},size,.001,[250,200]),{zoom:1,pan:[0,0]});assert.deepEqual(clampAtlasView({zoom:Infinity,pan:[NaN,null]},size),{zoom:1,pan:[0,0]});
});
test('Pan bounds keep the map covering its viewport instead of disappearing beyond an edge',()=>{
  assert.deepEqual(panAtlasBy({zoom:1,pan:[0,0]},size,[500,-300]),{zoom:1,pan:[0,0]});assert.deepEqual(panAtlasBy({zoom:2,pan:[0,0]},size,[5000,-3000]),{zoom:2,pan:[500,-300]});
  assert.deepEqual(panAtlasBy({zoom:2,pan:[500,-300]},size,[-125,75]),{zoom:2,pan:[375,-225]});
});
test('Pinch combines scale with a moving midpoint while preserving its original map anchor',()=>{
  const base={zoom:1,pan:[0,0]},start=[[250,250],[450,250]],current=[[200,300],[600,300]],next=pinchAtlasView(base,size,start,current);assert.equal(next.zoom,2);close(atlasWorldToScreen([350,250],next,size),[400,300]);close(next.pan,[200,100]);assert.deepEqual(base,{zoom:1,pan:[0,0]});
  const limited=pinchAtlasView({zoom:4,pan:[0,0]},size,[[400,300],[600,300]],[[0,300],[1000,300]]);assert.equal(limited.zoom,8);close(atlasWorldToScreen([500,300],limited,size),[500,300]);
});
test('Coincident pinch points and wheel delta units produce finite predictable navigation',()=>{
  const next=pinchAtlasView({zoom:2,pan:[0,0]},size,[[300,200],[300,200]],[[320,240],[320,240]]);assert.equal(next.zoom,2);close(next.pan,[20,40]);assert.equal(wheelZoomFactor(120),wheelZoomFactor(7.5,1));assert.equal(wheelZoomFactor(600),wheelZoomFactor(1,2,600));assert.equal(wheelZoomFactor(NaN),1);assert.ok(wheelZoomFactor(-100)>1);assert.ok(wheelZoomFactor(100)<1);
});
test('Growing thumbnails keep separated screen rectangles and never alter map coordinates',()=>{
  const points=Array.from({length:99},(_,i)=>({id:'p'+i,workId:'w'+i,x:i%11*24,y:Math.floor(i/11)*24})),groups=new Map(points.map(point=>[point.id,[point]])),before=structuredClone(points),options={get:id=>({id,recognitionTier:'established'}),selectedId:'p0',photos:true,position:point=>[point.x,point.y],pointKey:point=>point.id};let firstCount=0;
  for(const zoom of [1,2,4,8]){const layout=atlasPointLayout(groups,{...options,zoom}),photos=layout.filter(point=>point.photo),width=atlasThumbnailSize(zoom);assert.ok(photos.some(point=>point.id==='p0'));assert.ok(width>=40&&width<=100);for(const a of photos)for(const b of photos)if(a!==b)assert.ok(Math.abs(a.x-b.x)*zoom>=width+5.99||Math.abs(a.y-b.y)*zoom>=width+5.99,'Thumbnail rectangles must not overlap');if(zoom===1)firstCount=photos.length;if(zoom===8)assert.ok(photos.length>firstCount);}
  assert.equal(atlasThumbnailSize(1),40);assert.equal(atlasThumbnailSize(8),100);assert.deepEqual(points,before);
});
test('Coincident responses keep one exact position and prefer the selected observation without averaging',()=>{
  const group=[{id:'old',workId:'a',x:20,y:70},{id:'new',workId:'a',x:20,y:70}],layout=atlasPointLayout(new Map([['same',group]]),{get:id=>({id}),selectedId:'new',zoom:4,photos:true,position:point=>[point.x,point.y],pointKey:point=>point.id});assert.equal(layout.length,1);assert.equal(layout[0].id,'new');assert.equal(layout[0].group.length,2);assert.deepEqual([layout[0].x,layout[0].y],[20,70]);
});

function fixture(initial={zoom:2,pan:[0,0]}){
  let view=structuredClone(initial);const listeners=new Map(),captures=[],svg={focus(){},setPointerCapture:id=>captures.push(['svg',id])},point={closest:selector=>selector==='[data-point]'?point:null,setPointerCapture:id=>captures.push(['point',id])},element={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),querySelector:()=>svg,getBoundingClientRect:()=>({left:100,top:50,width:1000,height:600})},nav=createAtlasNavigation({element,getSize:()=>size,getView:()=>view,setView:next=>view=next});
  const fire=(type,options={})=>{const event={type,pointerId:1,pointerType:'touch',button:0,target:point,clientX:400,clientY:300,deltaY:0,deltaMode:0,key:'',prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){},...options};listeners.get(type)?.(event);return event;};return {nav,fire,listeners,captures,point,get view(){return view;}};
}
test('Dragging an artwork pans but suppresses the resulting click; an ordinary tap remains selectable',()=>{
  const f=fixture();f.fire('pointerdown');f.fire('pointermove',{clientX:403,clientY:302});f.fire('pointerup');assert.deepEqual(f.view,{zoom:2,pan:[0,0]});assert.equal(f.nav.consumeClick(),false);assert.deepEqual(f.captures,[['point',1]],'Pointer capture preserves the original painting click target');
  f.fire('pointerdown');f.fire('pointermove',{clientX:430,clientY:340});f.fire('pointerup');close(f.view.pan,[30,40]);assert.equal(f.nav.consumeClick(),true);assert.equal(f.nav.consumeClick(),false);
});
test('Two touch pointers zoom about their midpoint and do not generate a painting selection',()=>{
  const f=fixture({zoom:1,pan:[0,0]});f.fire('pointerdown',{pointerId:1,clientX:350});f.fire('pointerdown',{pointerId:2,clientX:550});f.fire('pointermove',{pointerId:2,clientX:750});assert.equal(f.view.zoom,2);close(atlasWorldToScreen([350,250],f.view,size),[450,250]);f.fire('pointerup',{pointerId:1});f.fire('pointerup',{pointerId:2});assert.equal(f.nav.consumeClick(),true);
});
test('Map-local wheel also covers its overlay buttons while native control presses remain independent',()=>{
  const f=fixture({zoom:1,pan:[0,0]}),control={closest:selector=>selector==='button,a,input,select,textarea'?control:null};assert.ok(f.listeners.has('wheel'));f.fire('pointerdown',{target:control});assert.deepEqual(f.captures,[]);assert.equal(f.fire('wheel',{deltaY:-100,target:control}).prevented,true);assert.ok(f.view.zoom>1);f.nav.reset();const wheel=f.fire('wheel',{deltaY:-100});assert.equal(wheel.prevented,true);assert.ok(f.view.zoom>1);close(atlasWorldToScreen([300,250],f.view,size),[300,250]);assert.equal(f.fire('keydown',{key:'a'}).prevented,false);assert.equal(f.fire('keydown',{key:'0'}).prevented,true);assert.deepEqual(f.view,{zoom:1,pan:[0,0]});assert.equal(f.fire('keydown',{key:'+'}).prevented,true);assert.ok(f.view.zoom>1);f.nav.destroy();assert.equal(f.listeners.size,0);
});
