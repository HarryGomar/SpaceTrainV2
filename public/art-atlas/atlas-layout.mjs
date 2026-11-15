/** Keep map coordinates intact; display only thumbnails that fit at this zoom. */
export function chooseAtlasThumbnails(points,{zoom=1,spacing=54,selectedId=null}={}){
  const scale=Number.isFinite(zoom)&&zoom>0?zoom:1;
  const ordered=[...points].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId)||(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id))),chosen=[];
  for(const point of ordered)if(chosen.every(other=>Math.hypot(point.x-other.x,point.y-other.y)*scale>=spacing))chosen.push(point);
  return new Set(chosen.map(point=>point.id));
}

/** Display offsets separate images without changing their actual map coordinates. */
export function placeAtlasImages(entries,{zoom=1,size=40,bounds=null}={}){
  const gap=(size+8)/zoom,half=(size/2+4)/zoom,placed=[];
  const ordered=[...entries].sort((a,b)=>String(a.point.workId).localeCompare(String(b.point.workId))||a.x-b.x||a.y-b.y);
  const clamp=(value,limit)=>Math.max(half,Math.min(limit-half,value));
  for(const entry of ordered){
    let best=null;
    // Keep a painting near its measured position. Dense areas may overlap until
    // the viewer zooms further; sending pictures across the map is misleading.
    for(let ring=0;ring<=2;ring++){
      const offsets=[];if(!ring)offsets.push([0,0]);else for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++)if(Math.max(Math.abs(dx),Math.abs(dy))===ring)offsets.push([dx,dy]);
      offsets.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b)||a[1]-b[1]||a[0]-b[0]);
      for(const [dx,dy] of offsets){
        let x=entry.x+dx*gap,y=entry.y+dy*gap;
        if(bounds){x=clamp(x,bounds.width);y=clamp(y,bounds.height);}
        const collisions=placed.filter(other=>Math.abs(x-other.displayX)<gap-.001&&Math.abs(y-other.displayY)<gap-.001).length;
        const distance=Math.hypot(x-entry.x,y-entry.y);
        if(!best||collisions<best.collisions||collisions===best.collisions&&distance<best.distance)best={x,y,collisions,distance};
        if(!collisions)break;
      }
      if(best&&!best.collisions)break;
    }
    entry.displayX=best.x;entry.displayY=best.y;entry.displayOverlap=best.collisions>0;placed.push(entry);
  }
  return entries;
}
