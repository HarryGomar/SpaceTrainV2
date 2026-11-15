export function selectAtlasDimension(state,axis,value,dimensions){
  const ids=[...new Set(dimensions.map(item=>typeof item==='string'?item:item.id))];
  let xId=ids.includes(state.xId)?state.xId:ids[0],yId=ids.includes(state.yId)&&state.yId!==xId?state.yId:ids.find(id=>id!==xId);
  if(!ids.includes(value))return {xId,yId};
  if(axis==='x'){if(value===yId)yId=xId;xId=value;}
  else{if(value===xId)xId=yId;yId=value;}
  return {xId,yId};
}
