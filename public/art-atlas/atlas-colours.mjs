import {axisColours} from './task-signals.mjs';

// Display colours describe the named map dimension, never a preference score.
const dimensions=Object.freeze({abstraction:'#4e6d94',energy:'#ae6c45',complexity:'#7465a0',humanity:'#a05c43',narrative:'#8c6381',atmosphere:'#557e72',color:'#917329',date:'#7f7568'});
export const atlasDimensionColour=id=>dimensions[id]||'#7f7568';
export function atlasChoiceColours({dimensions:available=[],maps=[]}={}){
  return Object.fromEntries([
    ...available.map(item=>[item.id,[atlasDimensionColour(item.id),atlasDimensionColour(item.id)]]),
    ...maps.map(item=>[item.id,axisColours(item.axisId)])
  ]);
}
