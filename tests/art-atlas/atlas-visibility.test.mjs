import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasPointLayout} from '../../public/art-atlas/atlas-points.mjs';
import {selectAtlasDimension} from '../../public/art-atlas/atlas-axis-selection.mjs';

const options={get:id=>({id}),selectedId:null,photos:true,position:p=>[p.x,p.y],pointKey:p=>p.id};
const same=[{id:'one',workId:'a',x:50,y:50},{id:'two',workId:'b',x:50,y:50}],near=[{id:'three',workId:'c',x:50.1,y:50.1}];

test('Zoom exposes every distinct co-located and nearby painting as an image',()=>{
  const groups=new Map([['same',same],['near',near]]),before=structuredClone([...groups]);
  for(const zoom of [1.35,2,4,8]){const layout=atlasPointLayout(groups,{...options,zoom});assert.equal(layout.length,3);assert.ok(layout.every(p=>p.photo),'A zoomed painting must never remain a dot');assert.deepEqual(new Set(layout.map(p=>p.work.id)),new Set(['a','b','c']));}
  assert.deepEqual([...groups],before);
});

test('Changing a selection does not rearrange the zoomed paintings',()=>{
  const groups=new Map([['same',same],['near',near]]),a=atlasPointLayout(groups,{...options,zoom:4}),b=atlasPointLayout(groups,{...options,zoom:4,selectedId:'two'});
  const positions=list=>Object.fromEntries(list.map(p=>[p.work.id,[p.displayX,p.displayY,p.x,p.y]]));assert.deepEqual(positions(a),positions(b));
});

test('Selecting the other axis swaps dimensions instead of plotting a dimension against itself',()=>{
  const available=['abstraction','complexity','color'];assert.deepEqual(selectAtlasDimension({xId:'abstraction',yId:'complexity'},'x','complexity',available),{xId:'complexity',yId:'abstraction'});
  assert.deepEqual(selectAtlasDimension({xId:'abstraction',yId:'complexity'},'y','abstraction',available),{xId:'complexity',yId:'abstraction'});
  assert.deepEqual(selectAtlasDimension({xId:'abstraction',yId:'complexity'},'x','missing',available),{xId:'abstraction',yId:'complexity'});
});
