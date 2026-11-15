import {chooseAtlasThumbnails} from './atlas-layout.mjs';
import {recognitionWeight} from './curation-priority.mjs';
const short=work=>work?.shortTitle||work?.title||'';
const cornerPath=size=>{const h=size/2+3,k=6;return `M${-h+k} ${-h}h${-k}v${k}M${h-k} ${-h}h${k}v${k}M${-h+k} ${h}h${-k}v${-k}M${h-k} ${h}h${k}v${-k}`;};
export const atlasThumbnailSize=zoom=>Math.min(100,40*Math.sqrt(Math.max(1,Number.isFinite(zoom)?zoom:1)));
export function atlasPointLayout(groups,{get,selectedId,zoom=1,photos,position,pointKey}){
  const entries=[...groups.values()].map(group=>{const point=group.find(item=>pointKey(item)===selectedId)||[...group].sort((a,b)=>recognitionWeight(get(b.workId))-recognitionWeight(get(a.workId)))[0],[x,y]=position(point);return {group,point,work:get(point.workId),id:pointKey(point),x,y,priority:recognitionWeight(get(point.workId))};});
  const screenSize=atlasThumbnailSize(zoom),thumbnails=photos?chooseAtlasThumbnails(entries,{zoom,selectedId,spacing:Math.SQRT2*(screenSize+6)}):new Set();
  return entries.map(entry=>({...entry,active:entry.id===selectedId,photo:thumbnails.has(entry.id),screenSize})).sort((a,b)=>Number(a.active)-Number(b.active)||Number(a.photo)-Number(b.photo));
}
function geometry(entry,zoom){const {photo,active,screenSize}=entry;return {size:screenSize/zoom,hit:(photo?screenSize/2+3:9)/zoom,dot:(active?4:2.8)/zoom,corner:cornerPath(photo?screenSize:13),led:-(screenSize/2+1)/zoom,countX:(photo?screenSize/2+4:9)/zoom,countY:(photo?-screenSize/2+4:-6)/zoom};}
export function atlasPointMarkup(groups,options){
  const {mode,zoom,roundLabel,esc}=options;
  return atlasPointLayout(groups,options).map(entry=>{
    const {group,point,work,id,x,y,active,photo}=entry,g=geometry(entry,zoom),colour=point.ledComparison?'#a05c43':'#9b8e7b',label=short(work)+(point.roundId?', '+roundLabel(point.roundId):''),unit=mode==='responses'?'placements':'paintings',source=work?'./'+work.image:'';
    return `<g class="atlas-point ${active?'selected':''} ${photo?'has-thumbnail':''}" data-point="${esc(id)}" data-map-x="${x}" data-map-y="${y}" tabindex="0" role="button" aria-label="${esc(label)}" transform="translate(${x} ${y})"><circle class="atlas-hit" r="${g.hit}" fill="transparent"/><title>${esc(label)}${group.length>1?' · '+group.length+' '+unit+' here':''}</title><image class="atlas-photo" ${photo?`href="${esc(source)}"`:''} data-image-src="${esc(source)}" x="${-g.size/2}" y="${-g.size/2}" width="${g.size}" height="${g.size}" style="display:${photo?'':'none'}" preserveAspectRatio="xMidYMid meet"/><circle class="atlas-dot" r="${g.dot}" fill="${colour}" style="display:${photo?'none':''}"/><circle class="atlas-led" cx="${g.led}" cy="${g.led}" r="${2/zoom}" fill="#a05c43" style="display:${photo&&point.ledComparison?'':'none'}"/><g class="atlas-point-corners" transform="scale(${1/zoom})"><path d="${g.corner}" fill="none" stroke="#4c443b" stroke-width="1.1"/></g><text class="atlas-overlap-count" x="${g.countX}" y="${g.countY}" style="font-size:${10/zoom}px;display:${group.length>1&&(photo||active)?'':'none'}">${group.length}</text></g>`;
  }).join('');
}
/** Reuse image nodes while a gesture changes thumbnail scale and visibility. */
export function updateAtlasPointDisplay(host,groups,options){
  const entries=atlasPointLayout(groups,options),nodes=new Map([...host.querySelectorAll('[data-point]')].map(node=>[node.dataset.point,node])),zoom=options.zoom;
  for(const entry of entries){
    const node=nodes.get(entry.id);if(!node)continue;const g=geometry(entry,zoom),photo=node.querySelector('.atlas-photo'),dot=node.querySelector('.atlas-dot'),led=node.querySelector('.atlas-led'),count=node.querySelector('.atlas-overlap-count');
    node.classList.toggle('has-thumbnail',entry.photo);node.querySelector('.atlas-hit').setAttribute('r',g.hit);photo.style.display=entry.photo?'':'none';if(entry.photo&&!photo.hasAttribute('href'))photo.setAttribute('href',photo.dataset.imageSrc);for(const [key,value] of Object.entries({x:-g.size/2,y:-g.size/2,width:g.size,height:g.size}))photo.setAttribute(key,value);
    dot.style.display=entry.photo?'none':'';dot.setAttribute('r',g.dot);led.style.display=entry.photo&&entry.point.ledComparison?'':'none';led.setAttribute('cx',g.led);led.setAttribute('cy',g.led);led.setAttribute('r',2/zoom);const corners=node.querySelector('.atlas-point-corners');corners.setAttribute('transform',`scale(${1/zoom})`);corners.querySelector('path').setAttribute('d',g.corner);count.setAttribute('x',g.countX);count.setAttribute('y',g.countY);count.style.fontSize=10/zoom+'px';count.style.display=entry.group.length>1&&(entry.photo||entry.active)?'':'none';
  }
  const order=entries.map(entry=>entry.id+':'+entry.photo).join('|');if(host.dataset.photoOrder!==order){for(const entry of entries){const node=nodes.get(entry.id);if(node)host.append(node);}host.dataset.photoOrder=order;}
  return entries;
}
