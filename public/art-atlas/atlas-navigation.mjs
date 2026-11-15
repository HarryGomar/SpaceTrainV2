export const ATLAS_MIN_ZOOM=1;
export const ATLAS_MAX_ZOOM=8;
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const sizeOf=size=>({width:Math.max(1,finite(size?.width,1)),height:Math.max(1,finite(size?.height,1))});
const pair=value=>[finite(value?.[0],0),finite(value?.[1],0)];
const zoomOf=value=>Math.max(ATLAS_MIN_ZOOM,Math.min(ATLAS_MAX_ZOOM,finite(value,1)));

/** Pan is measured in map viewport pixels; artwork coordinates never change. */
export function clampAtlasView(view,size){
  const {width,height}=sizeOf(size),zoom=zoomOf(view?.zoom),pan=pair(view?.pan),limits=[width*(zoom-1)/2,height*(zoom-1)/2];
  return {zoom,pan:pan.map((value,index)=>Math.max(-limits[index],Math.min(limits[index],value))||0)};
}
export function atlasWorldToScreen(point,view,size){
  const {width,height}=sizeOf(size),centre=[width/2,height/2],pan=pair(view?.pan),zoom=zoomOf(view?.zoom);
  return pair(point).map((value,index)=>centre[index]+pan[index]+zoom*(value-centre[index]));
}
export function atlasScreenToWorld(point,view,size){
  const {width,height}=sizeOf(size),centre=[width/2,height/2],pan=pair(view?.pan),zoom=zoomOf(view?.zoom);
  return pair(point).map((value,index)=>centre[index]+(value-centre[index]-pan[index])/zoom);
}
function placeAnchor(view,size,zoom,world,screen){
  const {width,height}=sizeOf(size),centre=[width/2,height/2];
  return clampAtlasView({zoom,pan:screen.map((value,index)=>value-centre[index]-zoom*(world[index]-centre[index]))},size);
}
export function zoomAtlasAt(view,size,factor,anchor){
  const dimensions=sizeOf(size),current=clampAtlasView(view,dimensions),screen=anchor?pair(anchor):[dimensions.width/2,dimensions.height/2],zoom=zoomOf(current.zoom*(Number.isFinite(factor)&&factor>0?factor:1));
  return placeAnchor(current,dimensions,zoom,atlasScreenToWorld(screen,current,dimensions),screen);
}
export function panAtlasBy(view,size,delta){const current=clampAtlasView(view,size),move=pair(delta);return clampAtlasView({zoom:current.zoom,pan:current.pan.map((value,index)=>value+move[index])},size);}
export function pinchAtlasView(view,size,startPoints,currentPoints){
  if(!Array.isArray(startPoints)||!Array.isArray(currentPoints)||startPoints.length!==2||currentPoints.length!==2)return clampAtlasView(view,size);
  const initial=startPoints.map(pair),current=currentPoints.map(pair),centre=points=>[0,1].map(index=>(points[0][index]+points[1][index])/2),distance=points=>Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]),startCentre=centre(initial),endCentre=centre(current),base=clampAtlasView(view,size),ratio=distance(initial)>1?distance(current)/distance(initial):1,zoom=zoomOf(base.zoom*ratio);
  return placeAnchor(base,size,zoom,atlasScreenToWorld(startCentre,base,size),endCentre);
}
export function wheelZoomFactor(delta,mode=0,pageHeight=680){
  const pixels=finite(delta,0)*(mode===1?16:mode===2?Math.max(1,finite(pageHeight,680)):1);
  return Math.exp(-Math.max(-1000,Math.min(1000,pixels))*.002);
}

/** All native input listeners stay on this map. Nothing intercepts the surrounding page. */
export function createAtlasNavigation({element,getSize,getView,setView,onGestureEnd=()=>{}}){
  const pointers=new Map(),listeners=[];let start=null,moved=false,multiple=false,suppressUntil=0;
  const listen=(name,fn,options)=>{element.addEventListener(name,fn,options);listeners.push([name,fn,options]);};
  const local=event=>{const box=element.getBoundingClientRect(),size=getSize();return [(event.clientX-box.left)/Math.max(1,box.width)*size.width,(event.clientY-box.top)/Math.max(1,box.height)*size.height];};
  const control=target=>target.closest?.('button,a,input,select,textarea');
  const update=next=>{const previous=getView();if(next.zoom!==previous.zoom||next.pan.some((value,index)=>value!==previous.pan[index]))setView(next,{zoomChanged:next.zoom!==previous.zoom});};
  const restart=()=>{start={view:clampAtlasView(getView(),getSize()),points:[...pointers.values()].slice(0,2).map(point=>[...point])};};
  const zoomAt=(factor,anchor)=>{update(zoomAtlasAt(getView(),getSize(),factor,anchor));};
  const reset=()=>{update({zoom:1,pan:[0,0]});onGestureEnd();};
  listen('wheel',event=>{if(event.target.closest?.('input,select,textarea'))return;event.preventDefault();zoomAt(wheelZoomFactor(event.deltaY,event.deltaMode,getSize().height),local(event));},{passive:false});
  listen('pointerdown',event=>{
    if(control(event.target)||event.pointerType==='mouse'&&event.button!==0)return;
    if(!pointers.size){moved=false;multiple=false;suppressUntil=0;element.querySelector?.('svg')?.focus({preventScroll:true});}
    pointers.set(event.pointerId,local(event));if(pointers.size>1)multiple=true;restart();event.preventDefault();const capture=event.target.closest?.('[data-point]')||element.querySelector?.('svg')||element;capture.setPointerCapture?.(event.pointerId);
  });
  listen('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!start)return;pointers.set(event.pointerId,local(event));const current=[...pointers.values()].slice(0,2);
    if(current.length===2){moved=true;update(pinchAtlasView(start.view,getSize(),start.points,current));}
    else {const delta=current[0].map((value,index)=>value-start.points[0][index]);if(Math.hypot(...delta)>5)moved=true;if(moved)update(panAtlasBy(start.view,getSize(),delta));}
    event.preventDefault();
  });
  const end=event=>{if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(moved||multiple||event.type==='pointercancel')suppressUntil=Date.now()+500;if(pointers.size)restart();else {start=null;onGestureEnd();}};
  listen('pointerup',end);listen('pointercancel',end);listen('lostpointercapture',end);
  listen('keydown',event=>{
    if(event.altKey||event.metaKey||event.ctrlKey||event.target.closest?.('input,select,textarea'))return;
    if(!['+','=','-','_','0'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='0')reset();else zoomAt(['+','='].includes(event.key)?1.35:1/1.35);
  });
  return {zoomAt,reset,consumeClick(){if(Date.now()>suppressUntil)return false;suppressUntil=0;return true;},destroy(){listeners.forEach(args=>element.removeEventListener(...args));pointers.clear();start=null;}};
}
