import {createArtField,updateFieldPointer,interactFieldPoint,fieldClearing} from './art-field.mjs';
import {createOpeningRenderer} from './opening-renderer.mjs';
import {canonicalOpeningPool,createOpeningSeed,orderOpeningPool} from './opening-pool.mjs';

const PAPER='#f5f4f1';
export function createOpeningScene({app,getWorks,seed}){
 const document=app.ownerDocument,window=document.defaultView,media=window.matchMedia('(prefers-reduced-motion: reduce)');
 const visitSeed=Number.isInteger(seed)?seed>>>0:createOpeningSeed(window.crypto),fieldSeed=visitSeed^0x9e3779b9;
 let mounted=null,atlas=null,signature='',pendingAtlas=false,disposed=false,userPaused=null,lastUpload=-Infinity;
 // A visit starts moving. Reduced motion slows the scene; an explicit pause
 // belongs to this visit rather than silently becoming a permanent setting.
 const paused=()=>userPaused===true;
 function pool(){return orderOpeningPool(canonicalOpeningPool(getWorks()),{seed:visitSeed,max:480});}
 function releaseAtlas(){
  if(atlas){const pack=atlas;pack.cancelled=true;for(const img of pack.pendingImages){img.onload=null;img.onerror=null;img.removeAttribute('src');}pack.pendingImages.clear();pack.sources=[];pack.canvas.width=1;pack.canvas.height=1;}
  atlas=null;signature='';pendingAtlas=false;lastUpload=-Infinity;
 }
 function prepareAtlas(){
  const works=pool(),key=works.map(w=>w.id+':'+w.image).join('|');if(key===signature&&atlas)return;releaseAtlas();signature=key;
  const size=works.length>64?4096:2048,columns=Math.ceil(Math.sqrt(Math.max(1,works.length))),cell=Math.floor(size/columns),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#918678';ctx.fillRect(0,0,8,8);
  const pack={canvas,sources:[],pendingImages:new Set(),cancelled:false,loaded:0,settled:0,total:works.length};atlas=pack;
  pack.sources=works.map((work,index)=>{
   const source={id:work.id,loaded:false,ratio:1,uv:[0,0,1,1],pixelRect:[0,0,1,1]},img=new window.Image();img.decoding='async';pack.pendingImages.add(img);let settled=false;
   const finish=()=>{if(settled)return;settled=true;img.onload=null;img.onerror=null;img.removeAttribute('src');pack.pendingImages.delete(img);pack.settled++;if(atlas===pack&&!disposed&&!pack.cancelled){pendingAtlas=true;if(mounted&&!mounted.frame)paint();}};
   img.onload=()=>{try{if(pack.cancelled||atlas!==pack||!img.naturalWidth||!img.naturalHeight)return;const ratio=img.naturalWidth/img.naturalHeight,edge=cell-12,w=Math.round(ratio>1?edge:edge*ratio),h=Math.round(ratio>1?edge/ratio:edge),x=index%columns*cell+(cell-w)/2,y=Math.floor(index/columns)*cell+(cell-h)/2;ctx.drawImage(img,x,y,w,h);source.loaded=true;source.ratio=ratio;source.pixelRect=[x,y,w,h];source.uv=[x/size,1-(y+h)/size,(x+w)/size,1-y/size];pack.loaded++;}finally{finish();}};
   img.onerror=finish;img.src=new URL(work.image,document.baseURI).href;return source;
  });pendingAtlas=true;
 }
 function fallbackRenderer(canvas){
  const ctx=canvas.getContext('2d');if(!ctx)return null;let field,sources=[],packed=null;
  return {type:'canvas2d',setField(f,s){field=f;sources=s;},setAtlas(canvas){packed=canvas;},resize(){},destroy(){field=null;sources=[];packed=null;},draw({time,pointer,width:w,height:h}){
   ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.fillStyle=PAPER;ctx.fillRect(0,0,w,h);
   function project(item){const p=item.position,d=3.6/(3.6-p[2]),[x,y]=interactFieldPoint([p[0]*d,p[1]*d],pointer,{aspect:w/h,z:p[2]});return {x:(x+1)*w/2+Math.sin(time*.04+item.seed)*2,y:(1-y)*h/2+Math.cos(time*.036+item.seed)*2,d,alpha:fieldClearing([x,y],field.mobile)};}
   for(const item of field.particles.filter((_,i)=>i%9===0)){const p=project(item);ctx.globalAlpha=.18*p.alpha;ctx.fillStyle='#8c8173';ctx.fillRect(p.x,p.y,1.1,1.1);}
   for(const item of field.paintings){const source=sources[item.workIndex%sources.length];if(!source?.loaded||!packed)continue;const p=project(item),edge=item.edge*h/2*p.d,iw=source.ratio>1?edge:edge*source.ratio,ih=source.ratio>1?edge/source.ratio:edge;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(item.angle);ctx.globalAlpha=Math.max(.05,Math.min(.8,(item.position[2]+2.9)/3.5*.83))*p.alpha;ctx.filter='saturate(.75)';ctx.drawImage(packed,...source.pixelRect,-iw/2,-ih/2,iw,ih);ctx.restore();}ctx.globalAlpha=1;
  }};
 }
 function drawMetadata(){if(!mounted)return;const c=mounted.canvas;c.dataset.sceneRenderer=mounted.renderer.type;c.dataset.sceneImages=String(atlas.loaded);c.dataset.scenePaintings=String(mounted.field.paintings.length);c.dataset.scenePoints=String(mounted.field.particles.length);c.dataset.sceneState=atlas.loaded?'ready':'loading';c.dataset.sceneStatus=document.hidden||!mounted.visible?'suspended':paused()?'static':'running';c.dataset.sceneMotionMode=media.matches?'gentle':'full';c.dataset.sceneTime=mounted.time.toFixed(3);c.dataset.scenePointerEnergy=mounted.pointer.energy.toFixed(3);c.dataset.scenePointerMoves=String(mounted.moves);c.dataset.sceneSeed=String(visitSeed);}
 function paint(){if(!mounted||disposed)return;const s=mounted;if(pendingAtlas&&(atlas.settled===atlas.total||window.performance.now()-lastUpload>180)){lastUpload=window.performance.now();s.renderer.setAtlas(atlas.canvas,atlas.settled===atlas.total);s.renderer.setField(s.field,atlas.sources);pendingAtlas=false;}s.renderer.draw({time:s.time,pointer:s.pointer,width:s.width,height:s.height});drawMetadata();}
 function updateControl(){if(!mounted)return;const control=mounted.control;control?.setAttribute('aria-label',paused()?'Play animation':'Pause animation');if(control)control.innerHTML=`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${paused()?'M7 4l9 6-9 6z':'M7 5v10M13 5v10'}"/></svg>`;}
 function frame(now){
  const s=mounted;if(!s)return;s.frame=0;if(paused()||document.hidden||!s.visible)return;
  const elapsed=(now-s.last)/1000;if(elapsed>=1/75){const dt=Math.min(elapsed,.05);s.last=now;s.time+=dt*(media.matches ? .2 : 1);updateFieldPointer(s.pointer,{x:s.target.x,y:s.target.y,time:s.time,active:s.target.active},dt);paint();}
  s.frame=window.requestAnimationFrame(frame);
 }
 function animate(){if(!mounted)return;window.cancelAnimationFrame(mounted.frame);mounted.frame=0;updateControl();paint();if(!paused()&&!document.hidden&&mounted.visible){mounted.last=window.performance.now();mounted.frame=window.requestAnimationFrame(frame);}}
 function resize(){if(!mounted)return;const s=mounted,box=s.canvas.getBoundingClientRect();if(!box.width||!box.height)return;s.width=box.width;s.height=box.height;const dpr=Math.min(window.devicePixelRatio||1,box.width<700?1.4:1.6);s.canvas.width=Math.round(box.width*dpr);s.canvas.height=Math.round(box.height*dpr);if(s.mobile!==(box.width<700)){s.mobile=box.width<700;s.field=createArtField({mobile:s.mobile,workCount:atlas.total,seed:fieldSeed});s.renderer.setField(s.field,atlas.sources);}s.renderer.resize();paint();}
 function toggle(){userPaused=!paused();animate();}
 function pointerMove(event){if(!mounted||paused())return;const s=mounted,b=s.canvas.getBoundingClientRect(),amount=media.matches ? .25 : 1;s.target={x:((event.clientX-b.left)/b.width*2-1)*amount,y:(1-(event.clientY-b.top)/b.height*2)*amount,active:true};s.moves++;}
 function pointerLeave(){if(mounted)mounted.target={x:0,y:0,active:false};}
 function contextLost(event){event.preventDefault();if(mounted){window.cancelAnimationFrame(mounted.frame);mounted.frame=0;mounted.canvas.dataset.sceneStatus='suspended';}}
 function contextRestored(){const old=mounted?.canvas;if(old){unmount();sync();}}
 function unmount(){if(!mounted)return;const s=mounted;mounted=null;window.cancelAnimationFrame(s.frame);s.resize.disconnect();s.intersection?.disconnect();s.control?.removeEventListener('click',toggle);s.root.removeEventListener('pointermove',pointerMove);s.root.removeEventListener('pointerleave',pointerLeave);s.canvas.removeEventListener('webglcontextlost',contextLost);s.canvas.removeEventListener('webglcontextrestored',contextRestored);s.renderer.destroy();}
 function sync(){
  let canvas=app.querySelector('.opening-screen [data-art-scene]');if(canvas===mounted?.canvas)return;unmount();if(!canvas||disposed){releaseAtlas();return;}prepareAtlas();let renderer=createOpeningRenderer(canvas);
  if(!renderer){const replacement=document.createElement('canvas');replacement.setAttribute('data-art-scene','');replacement.setAttribute('aria-hidden','true');canvas.replaceWith(replacement);canvas=replacement;renderer=fallbackRenderer(canvas);}if(!renderer)return;
  const mobile=canvas.getBoundingClientRect().width<700;mounted={canvas,renderer,mobile,root:canvas.parentElement,control:app.querySelector('[data-scene-motion]'),width:1,height:1,time:0,last:0,frame:0,moves:0,visible:true,field:createArtField({mobile,workCount:atlas.total,seed:fieldSeed}),pointer:{x:0,y:0,energy:0,time:0},target:{x:0,y:0,active:false},resize:new window.ResizeObserver(resize)};
  if(window.IntersectionObserver){const owner=mounted;mounted.intersection=new window.IntersectionObserver(entries=>{if(mounted!==owner)return;const entry=entries.find(item=>item.target===owner.canvas);if(entry&&owner.visible!==entry.isIntersecting){owner.visible=entry.isIntersecting;animate();}},{threshold:.01});mounted.intersection.observe(canvas);}
  pendingAtlas=true;mounted.control?.addEventListener('click',toggle);mounted.root.addEventListener('pointermove',pointerMove,{passive:true});mounted.root.addEventListener('pointerleave',pointerLeave,{passive:true});canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);mounted.resize.observe(canvas);resize();animate();
 }
 const observer=new window.MutationObserver(sync);observer.observe(app,{childList:true});document.addEventListener('visibilitychange',animate);media.addEventListener('change',animate);sync();
 return {sync,destroy(){disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',animate);media.removeEventListener('change',animate);unmount();releaseAtlas();}};
}
