import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArtField,updateFieldPointer} from '../../public/art-atlas/art-field.mjs';

const studyWorks=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const decorativeWorks=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/opening-artworks.json',import.meta.url),'utf8'));
const fullCollection=[...studyWorks,...decorativeWorks];

test('The painting field is deterministic, uses the whole catalogue and has actual depth',()=>{
  assert.equal(studyWorks.length,156);
  assert.equal(decorativeWorks.length,255);
  assert.equal(fullCollection.length,411);
  const field=createArtField({workCount:fullCollection.length});
  assert.deepEqual(field,createArtField({workCount:fullCollection.length}));
  assert.equal(new Set(field.paintings.map(p=>p.workIndex)).size,411);
  assert.equal(new Set(field.paintings.map(p=>fullCollection[p.workIndex].id)).size,411);
  assert.equal(field.paintings.length,411);
  assert.ok(field.particles.length>20000);
  const depth=field.paintings.map(p=>p.position[2]);
  assert.ok(Math.max(...depth)-Math.min(...depth)>2);
  assert.ok(field.paintings.every(p=>p.position.every(Number.isFinite)&&p.edge>0));
  const mobile=createArtField({mobile:true,workCount:fullCollection.length});
  assert.equal(mobile.paintings.length,411);
  assert.ok(mobile.particles.length<field.particles.length);
  assert.equal(new Set(mobile.paintings.map(p=>p.workIndex)).size,411);
  for(const workCount of [0,1,12,59,96,99,125,255,320,354]){
    const sample=createArtField({workCount});
    assert.equal(sample.paintings.length,workCount);
    assert.deepEqual(sample.paintings.map(p=>p.workIndex).sort((a,b)=>a-b),Array.from({length:workCount},(_,i)=>i));
  }
});

test('Pointer motion is smoothed, energy stays bounded and settles when motion stops',()=>{
  const pointer={x:0,y:0,energy:0,time:0};
  updateFieldPointer(pointer,{x:1,y:-1,time:1});
  assert.ok(pointer.x>0&&pointer.x<.1);
  assert.ok(pointer.energy>0&&pointer.energy<=1);
  for(let i=0;i<120;i++)updateFieldPointer(pointer,{x:i%2?1:-1,y:0,time:2+i/60});
  assert.ok(pointer.energy<=1);
  for(let i=0;i<180;i++)updateFieldPointer(pointer,{x:pointer.x,y:pointer.y,time:5+i/60,active:false});
  assert.ok(pointer.energy<.0001);
});
