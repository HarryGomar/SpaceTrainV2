/** Keep map coordinates intact; display only thumbnails that fit at this zoom. */
export function chooseAtlasThumbnails(points,{zoom=1,spacing=54,selectedId=null}={}){
  const scale=Number.isFinite(zoom)&&zoom>0?zoom:1;
  const ordered=[...points].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId)||(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id))),chosen=[];
  for(const point of ordered)if(chosen.every(other=>Math.hypot(point.x-other.x,point.y-other.y)*scale>=spacing))chosen.push(point);
  return new Set(chosen.map(point=>point.id));
}
