import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAtlasThumbnails} from '../../public/art-atlas/atlas-layout.mjs';
const points=Array.from({length:30},(_,i)=>({id:'point-'+i,x:i%10*20,y:Math.floor(i/10)*20,priority:i%4}));
test('Visible thumbnails have enough space without changing or dropping any source coordinates',()=>{
  const before=structuredClone(points),shown=chooseAtlasThumbnails(points),selected=points.filter(p=>shown.has(p.id));
  for(const a of selected)for(const b of selected)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=54);
  assert.ok(selected.length<points.length);assert.deepEqual(points,before);
});
test('Zoom reveals more thumbnails and the selected work wins its local space',()=>{
  const normal=chooseAtlasThumbnails(points),zoomed=chooseAtlasThumbnails(points,{zoom:4,selectedId:'point-0'});
  assert.ok(zoomed.size>normal.size);assert.ok(zoomed.has('point-0'));
  assert.deepEqual(chooseAtlasThumbnails([...points].reverse()),normal);
});
