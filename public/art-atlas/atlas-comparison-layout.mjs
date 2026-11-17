const unique=values=>[...new Set(values)];

/** Directly co-compared works only. A path through other paintings is not a
 * recorded comparison and is deliberately excluded from this neighbourhood. */
export function comparisonNeighbourhood(graph={},workId,roundId=''){
  if(!workId)return [];
  const local=(graph.comparisons||[]).filter(item=>(!roundId||item.roundId===roundId)&&item.workIds?.includes(workId));
  return unique([workId,...local.flatMap(item=>item.workIds)]);
}

/** Allocate drawing area by actual group size. These are display positions;
 * neither direction nor distance encodes taste or an estimated global rank. */
export function layoutComparisonGroups(groups=[],{width=1000,height=600}={}){
  const clean=groups.map(group=>({...group,workIds:unique(group.workIds||[]).sort()})).filter(group=>group.workIds.length).sort((a,b)=>b.workIds.length-a.workIds.length||String(a.id).localeCompare(String(b.id)));
  const boxes=[];
  function split(items,x,y,w,h){
    if(items.length===1){boxes.push({group:items[0],x,y,w,h});return;}
    const weight=items.reduce((sum,group)=>sum+group.workIds.length+2,0);let accumulated=0,index=1,best=Infinity;
    for(let i=1;i<items.length;i++){accumulated+=items[i-1].workIds.length+2;const difference=Math.abs(weight/2-accumulated);if(difference<best){best=difference;index=i;}}
    const fraction=items.slice(0,index).reduce((sum,group)=>sum+group.workIds.length+2,0)/weight,gap=10;
    if(w>=h){const first=(w-gap)*fraction;split(items.slice(0,index),x,y,first,h);split(items.slice(index),x+first+gap,y,w-first-gap,h);}
    else{const first=(h-gap)*fraction;split(items.slice(0,index),x,y,w,first);split(items.slice(index),x,y+first+gap,w,h-first-gap);}
  }
  const w=Math.max(100,width),h=Math.max(100,height);if(clean.length)split(clean,0,0,w,h);
  return boxes.flatMap(({group,x,y,w:boxWidth,h:boxHeight})=>{
    const n=group.workIds.length,columns=Math.max(1,Math.min(n,Math.ceil(Math.sqrt(n*boxWidth/boxHeight)))),rows=Math.ceil(n/columns),cellWidth=boxWidth/columns,cellHeight=boxHeight/rows;
    return group.workIds.map((workId,index)=>({id:'graph:'+workId,workId,componentId:group.id,x:(x+(index%columns+.5)*cellWidth)/w*100,y:100-(y+(Math.floor(index/columns)+.5)*cellHeight)/h*100,thumbnailSize:Math.max(26,Math.min(90,Math.min(cellWidth,cellHeight)-14))}));
  });
}
