import {chooseAtlasThumbnails,placeAtlasImages} from './atlas-layout.mjs';
import {recognitionWeight} from './curation-priority.mjs';
const short=work=>work?.shortTitle||work?.title||'';
const cornerPath=(width,height=width)=>{const x=width/2+3,y=height/2+3,k=6;return `M${-x+k} ${-y}h${-k}v${k}M${x-k} ${-y}h${k}v${k}M${-x+k} ${y}h${-k}v${-k}M${x-k} ${y}h${k}v${-k}`;};
export const atlasThumbnailSize=zoom=>Math.min(100,40*Math.sqrt(Math.max(1,Number.isFinite(zoom)?zoom:1)));
export function atlasPointLayout(groups,{get,selectedId,zoom=1,photos,position,pointKey,bounds}){
  const expanded=photos&&zoom>=1.25;
  const visibleGroups=[...groups.values()].flatMap(group=>expanded?[...Map.groupBy(group,point=>point.workId).values()]:[group]);
  const entries=visibleGroups.map(group=>{const point=group.find(item=>pointKey(item)===selectedId)||[...group].sort((a,b)=>recognitionWeight(get(b.workId))-recognitionWeight(get(a.workId)))[0],[x,y]=position(point);return {group,point,work:get(point.workId),id:pointKey(point),x,y,displayX:x,displayY:y,priority:recognitionWeight(get(point.workId))};});
  const screenSize=atlasThumbnailSize(zoom),thumbnails=photos?expanded?new Set(entries.map(entry=>entry.id)):chooseAtlasThumbnails(entries,{zoom,selectedId,spacing:Math.SQRT2*(screenSize+6)}):new Set();
  const layout=entries.map(entry=>({...entry,active:entry.id===selectedId,photo:thumbnails.has(entry.id),screenSize}));
  if(expanded)placeAtlasImages(layout,{zoom,size:screenSize,bounds});
  return layout.sort((a,b)=>Number(a.active)-Number(b.active)||Number(a.photo)-Number(b.photo));
}
function geometry(entry,zoom){const {photo,active,screenSize,work}=entry,ratio=work?.width>0&&work?.height>0?work.width/work.height:1,photoWidth=screenSize*Math.min(1,ratio),photoHeight=screenSize*Math.min(1,1/ratio);return {size:screenSize/zoom,hit:(photo?screenSize/2+3:9)/zoom,dot:(active?4:2.8)/zoom,corner:photo?cornerPath(photoWidth,photoHeight):cornerPath(13),led:-(screenSize/2+1)/zoom,countX:(photo?photoWidth/2+4:9)/zoom,countY:(photo?-photoHeight/2+4:-6)/zoom};}
function pointMarkup(entry,options){
  const {mode,zoom,roundLabel,esc}=options;
  const {group,point,work,id,x,y,displayX,displayY,active,photo}=entry,g=geometry(entry,zoom),colour=point.ledComparison?'#a05c43':'#9b8e7b',label=short(work)+(point.roundId?', '+roundLabel(point.roundId):''),unit=mode==='responses'?'placements':'paintings',source=work?'./'+(work.thumbnail||work.image):'';
  return `<g class="atlas-point ${active?'selected':''} ${photo?'has-thumbnail':''}" data-point="${esc(id)}" data-map-x="${x}" data-map-y="${y}" tabindex="0" role="button" aria-label="${esc(label)}" transform="translate(${displayX} ${displayY})"><path class="atlas-position-link" d="M${x-displayX} ${y-displayY}L0 0" fill="none" stroke="#b9afa2" stroke-width="${.7/zoom}"/><circle class="atlas-hit" r="${g.hit}" fill="transparent"/><title>${esc(label)}${group.length>1?' · '+group.length+' '+unit+' here':''}</title><image class="atlas-photo" ${photo?`href="${esc(source)}"`:''} data-image-src="${esc(source)}" x="${-g.size/2}" y="${-g.size/2}" width="${g.size}" height="${g.size}" style="display:${photo?'':'none'}" preserveAspectRatio="xMidYMid meet"/><circle class="atlas-dot" r="${g.dot}" fill="${colour}" style="display:${photo?'none':''}"/><circle class="atlas-led" cx="${g.led}" cy="${g.led}" r="${2/zoom}" fill="#a05c43" style="display:${photo&&point.ledComparison?'':'none'}"/><g class="atlas-point-corners" transform="scale(${1/zoom})"><path d="${g.corner}" fill="none" stroke="#4c443b" stroke-width="1.1"/></g><text class="atlas-overlap-count" x="${g.countX}" y="${g.countY}" style="font-size:${10/zoom}px;display:${group.length>1&&(photo||active)?'':'none'}">${group.length}</text></g>`;
}
export function atlasPointMarkup(groups,options){
  return atlasPointLayout(groups,options).map(entry=>pointMarkup(entry,options)).join('');
}
/** Reuse image nodes while a gesture changes thumbnail scale and visibility. */
export function updateAtlasPointDisplay(host,groups,options){
  const entries=atlasPointLayout(groups,options),nodes=new Map([...host.querySelectorAll('[data-point]')].map(node=>[node.dataset.point,node])),zoom=options.zoom,visible=new Set(entries.map(entry=>entry.id));
  for(const [id,node] of nodes)if(!visible.has(id)){node.remove();nodes.delete(id);}
  for(const entry of entries){
    let node=nodes.get(entry.id);if(!node){host.insertAdjacentHTML('beforeend',pointMarkup(entry,options));node=host.lastElementChild;nodes.set(entry.id,node);}const g=geometry(entry,zoom),photo=node.querySelector('.atlas-photo'),dot=node.querySelector('.atlas-dot'),led=node.querySelector('.atlas-led'),count=node.querySelector('.atlas-overlap-count');
    node.setAttribute('transform',`translate(${entry.displayX} ${entry.displayY})`);const link=node.querySelector('.atlas-position-link');link.setAttribute('d',`M${entry.x-entry.displayX} ${entry.y-entry.displayY}L0 0`);link.setAttribute('stroke-width',.7/zoom);
    node.classList.toggle('has-thumbnail',entry.photo);node.querySelector('.atlas-hit').setAttribute('r',g.hit);photo.style.display=entry.photo?'':'none';if(entry.photo&&!photo.hasAttribute('href'))photo.setAttribute('href',photo.dataset.imageSrc);for(const [key,value] of Object.entries({x:-g.size/2,y:-g.size/2,width:g.size,height:g.size}))photo.setAttribute(key,value);
    dot.style.display=entry.photo?'none':'';dot.setAttribute('r',g.dot);led.style.display=entry.photo&&entry.point.ledComparison?'':'none';led.setAttribute('cx',g.led);led.setAttribute('cy',g.led);led.setAttribute('r',2/zoom);const corners=node.querySelector('.atlas-point-corners');corners.setAttribute('transform',`scale(${1/zoom})`);corners.querySelector('path').setAttribute('d',g.corner);count.setAttribute('x',g.countX);count.setAttribute('y',g.countY);count.style.fontSize=10/zoom+'px';count.style.display=entry.group.length>1&&(entry.photo||entry.active)?'':'none';
  }
  const order=entries.map(entry=>entry.id+':'+entry.photo).join('|');if(host.dataset.photoOrder!==order){for(const entry of entries){const node=nodes.get(entry.id);if(node)host.append(node);}host.dataset.photoOrder=order;}
  return entries;
}
