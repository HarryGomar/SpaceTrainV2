const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const centre=points=>[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
const distance=points=>Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);

/** Presentation only. The caller supplies the exact current or frozen artwork;
 * opening, zooming and panning never write to quiz answers or preference data. */
export function createArtworkDialog({dialog,content,image,esc,keepButtons=()=>'',renderContext=()=>''}){
  const doc=dialog.ownerDocument,win=doc.defaultView,closeButton=dialog.querySelector('.dialog-close'),originalParent=closeButton.parentElement,originalNext=closeButton.nextSibling,toolbar=doc.createElement('header'),listeners=[],pointers=new Map();let saved=null,view={zoom:1,pan:[0,0]},gesture=null,currentWork=null,restoreFrame=null,destroyed=false;
  toolbar.className='art-dialog-tools';toolbar.innerHTML='<div class="art-dialog-zoom" role="group" aria-label="Painting zoom"><button type="button" data-art-zoom="out" aria-label="Zoom painting out">−</button><button type="button" data-art-zoom="in" aria-label="Zoom painting in">+</button><button type="button" data-art-zoom="fit">Fit</button></div><button type="button" class="art-dialog-info" data-art-info aria-expanded="false" aria-controls="art-dialog-footer">Details</button>';
  closeButton.textContent='Close';closeButton.setAttribute('aria-label','Close full-screen painting');toolbar.append(closeButton);dialog.prepend(toolbar);dialog.setAttribute('aria-label','Painting full screen');
  const listen=(element,type,handler,options)=>{element.addEventListener(type,handler,options);listeners.push(()=>element.removeEventListener(type,handler,options));};
  const stage=()=>content.querySelector('.art-dialog-image'),picture=()=>stage()?.querySelector('img');
  function bounds(){const box=stage()?.getBoundingClientRect();return {width:box?.width||1,height:box?.height||1,left:box?.left||0,top:box?.top||0};}
  function limits(zoom){const box=bounds(),img=picture(),ratio=(img?.naturalWidth||currentWork?.largeWidth||currentWork?.width||1)/(img?.naturalHeight||currentWork?.largeHeight||currentWork?.height||1),imageWidth=img?.clientWidth||box.width,imageHeight=img?.clientHeight||box.height,width=Math.min(imageWidth,imageHeight*ratio),height=Math.min(imageHeight,imageWidth/ratio);return [Math.max(0,(width*zoom-box.width)/2),Math.max(0,(height*zoom-box.height)/2)];}
  function apply(next=view){const zoom=clamp(Number(next.zoom)||1,1,5),max=limits(zoom);view={zoom,pan:[0,1].map(index=>clamp(Number(next.pan?.[index])||0,-max[index],max[index]))};const img=picture();if(img)img.style.transform=`translate(${view.pan[0]}px,${view.pan[1]}px) scale(${zoom})`;dialog.dataset.artZoom=zoom.toFixed(2);dialog.classList.toggle('art-dialog-zoomed',zoom>1);toolbar.querySelector('[data-art-zoom="out"]').disabled=zoom===1;toolbar.querySelector('[data-art-zoom="in"]').disabled=zoom===5;stage()?.setAttribute('aria-label',`Painting at ${Math.round(zoom*100)} percent. Use plus and minus to zoom, arrow keys to pan, or zero to fit.`);}
  function zoomAt(factor,point){const box=bounds(),screen=point||[box.width/2,box.height/2],world=screen.map((value,index)=>(value-[box.width/2,box.height/2][index]-view.pan[index])/view.zoom),zoom=clamp(view.zoom*factor,1,5);apply({zoom,pan:screen.map((value,index)=>value-[box.width/2,box.height/2][index]-world[index]*zoom)});}
  function local(event){const box=bounds();return [event.clientX-box.left,event.clientY-box.top];}
  function beginGesture(){const points=[...pointers.values()];gesture=points.length?{points:points.slice(0,2),view:{zoom:view.zoom,pan:[...view.pan]}}:null;}
  function fit(){pointers.clear();gesture=null;apply({zoom:1,pan:[0,0]});}
  function setDetails(open){dialog.dataset.infoOpen=String(open);const button=toolbar.querySelector('[data-art-info]');button.setAttribute('aria-expanded',String(open));button.textContent=open?'Hide details':'Details';if(dialog.open)apply();}
  function lock(opener){
    if(saved)return;if(restoreFrame!==null){win.cancelAnimationFrame?.(restoreFrame);restoreFrame=null;}
    const body=doc.body,ancestors=[];for(let node=opener?.parentElement;node;node=node.parentElement)ancestors.push({node,top:node.scrollTop,left:node.scrollLeft});
    saved={opener,ancestors,x:win.scrollX||0,y:win.scrollY||0,bodyStyle:{position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,overflow:body.style.overflow},hadClass:doc.documentElement.classList.contains('artwork-dialog-open')};
    doc.documentElement.classList.add('artwork-dialog-open');Object.assign(body.style,{position:'fixed',top:-saved.y+'px',left:-saved.x+'px',width:'100%',overflow:'hidden'});
  }
  function restore(){
    if(!saved)return;const original=saved;saved=null;Object.assign(doc.body.style,original.bodyStyle);if(!original.hadClass)doc.documentElement.classList.remove('artwork-dialog-open');
    const reset=()=>{for(const {node,top,left}of original.ancestors)if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}win.scrollTo?.({left:original.x,top:original.y,behavior:'instant'});original.opener?.isConnected&&original.opener.focus?.({preventScroll:true});};reset();restoreFrame=win.requestAnimationFrame?.(()=>{restoreFrame=null;if(!dialog.open)reset();})??null;
  }
  function close(){if(dialog.open)dialog.close();restore();}
  listen(closeButton,'click',close);
  listen(dialog,'cancel',event=>{event.preventDefault();close();});
  listen(dialog,'close',()=>{pointers.clear();gesture=null;restore();});
  listen(dialog,'click',event=>{
    const button=event.target.closest?.('[data-art-zoom],[data-art-info]');if(button){if(button.hasAttribute('data-art-info'))setDetails(dialog.dataset.infoOpen!=='true');else if(button.dataset.artZoom==='fit')fit();else zoomAt(button.dataset.artZoom==='in'?1.4:1/1.4);return;}
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}
  });
  listen(dialog,'keydown',event=>{if(event.target.matches?.('input,textarea,select'))return;if(['+','=','-','_','0'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='0')fit();else zoomAt(['+','='].includes(event.key)?1.4:1/1.4);}else if(view.zoom>1&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const movement={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]}[event.key];apply({zoom:view.zoom,pan:view.pan.map((value,index)=>value+movement[index])});}});
  listen(content,'load',event=>{if(event.target===picture())apply();},true);
  listen(content,'error',event=>{if(event.target===picture()){const message=content.querySelector('.art-dialog-error');if(message)message.hidden=false;}},true);
  listen(content,'wheel',event=>{if(!event.target.closest?.('.art-dialog-image'))return;event.preventDefault();zoomAt(Math.exp(-clamp(event.deltaY,-200,200)*.004),local(event));},{passive:false});
  listen(content,'dblclick',event=>{if(event.target.closest?.('.art-dialog-image')){event.preventDefault();if(view.zoom>1)fit();else zoomAt(2,local(event));}});
  listen(content,'pointerdown',event=>{const host=event.target.closest?.('.art-dialog-image');if(!host||event.button!==undefined&&event.button!==0)return;pointers.set(event.pointerId,local(event));host.setPointerCapture?.(event.pointerId);beginGesture();});
  listen(content,'pointermove',event=>{
    if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,local(event));const points=[...pointers.values()].slice(0,2),initial=gesture.points;
    if(points.length===2&&initial.length===2){const box=bounds(),start=centre(initial),end=centre(points),zoom=clamp(gesture.view.zoom*distance(points)/Math.max(1,distance(initial)),1,5),world=start.map((value,index)=>(value-[box.width/2,box.height/2][index]-gesture.view.pan[index])/gesture.view.zoom);apply({zoom,pan:end.map((value,index)=>value-[box.width/2,box.height/2][index]-world[index]*zoom)});}else if(points.length===1&&view.zoom>1)apply({zoom:gesture.view.zoom,pan:gesture.view.pan.map((value,index)=>value+points[0][index]-initial[0][index])});
  });
  const end=event=>{pointers.delete(event.pointerId);beginGesture();};listen(content,'pointerup',end);listen(content,'pointercancel',end);listen(win,'resize',()=>{if(dialog.open)apply();});
  return {open(work,{reveal=false,opener=doc.activeElement}={}){
    if(destroyed||!work?.id||!work.image)return false;lock(opener);currentWork=work;
    content.innerHTML=`<div class="art-dialog-image" tabindex="0">${image(work,'',{large:true})}<p class="art-dialog-error" role="status" hidden>The painting could not load. Close and try again.</p></div><footer id="art-dialog-footer">${reveal?`<h2>${esc(work.title)}</h2><p>${esc(work.artist)} · ${esc(work.date)}${reveal==='artist'?'':' · '+esc(work.movement)}</p>${reveal==='artist'?'':`<p>${esc(work.note)}</p>${keepButtons(work)}`}<p><a href="${esc(work.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(work.museum||work.institution||'Collection source')} ↗</a> · ${work.rightsUrl?`<a href="${esc(work.rightsUrl)}" target="_blank" rel="noopener noreferrer">${esc(work.rights)}</a>`:esc(work.rights)}</p>`:`<p>Artist and context are revealed later.</p><p>${esc(work.museum||work.institution)} · ${esc(work.rights)}</p>`}${reveal===true?`<details class="painting-metadata"><summary>Painting details</summary>${renderContext(work,{esc})}</details>`:''}</footer>`;
    setDetails(!(win.matchMedia?.('(max-width:700px)').matches));fit();content.scrollTop=0;
    try{if(!dialog.open)dialog.showModal();closeButton.focus({preventScroll:true});return true;}catch{restore();return false;}
  },close,destroy(){if(destroyed)return;close();if(restoreFrame!==null)win.cancelAnimationFrame?.(restoreFrame);restoreFrame=null;listeners.forEach(remove=>remove());if(originalNext?.parentElement===originalParent)originalParent.insertBefore(closeButton,originalNext);else originalParent.prepend(closeButton);toolbar.remove();destroyed=true;}};
}
