import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArtField,updateFieldPointer,interactFieldPoint,fieldClearing,FIELD_MOTION} from '../../public/art-atlas/art-field.mjs';
import {canonicalOpeningPool,createOpeningSeed,orderOpeningPool} from '../../public/art-atlas/opening-pool.mjs';

const studyWorks=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const decorativeWorks=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/opening-artworks.json',import.meta.url),'utf8'));
const canonicalCollection=canonicalOpeningPool([...studyWorks,...decorativeWorks]);
const fullCollection=orderOpeningPool(canonicalCollection,{seed:9317});

test('The painting field is deterministic, uses its curated opening pool and has actual depth',()=>{
  assert.equal(studyWorks.length,487);
  assert.equal(decorativeWorks.length,255);
  assert.equal(canonicalCollection.length,504);
  assert.equal(fullCollection.length,346);
  const field=createArtField({workCount:fullCollection.length});
  assert.deepEqual(field,createArtField({workCount:fullCollection.length}));
  assert.equal(new Set(field.paintings.map(p=>p.workIndex)).size,fullCollection.length);
  assert.equal(new Set(field.paintings.map(p=>fullCollection[p.workIndex].id)).size,fullCollection.length);
  assert.equal(field.paintings.length,fullCollection.length);
  assert.ok(field.particles.length>20000);
  const depth=field.paintings.map(p=>p.position[2]);
  assert.ok(Math.max(...depth)-Math.min(...depth)>2);
  assert.ok(field.paintings.every(p=>p.position.every(Number.isFinite)&&p.edge>0));
  const mobile=createArtField({mobile:true,workCount:fullCollection.length});
  assert.equal(mobile.paintings.length,96);
  const desktopByWork=new Map(field.paintings.map(p=>[p.workIndex,p]));
  for(const item of mobile.paintings){const original=desktopByWork.get(item.workIndex);assert.deepEqual(item.position,original.position,'Resize preserves each painting position and depth');assert.equal(item.angle,original.angle);assert.equal(item.seed,original.seed);assert.equal(item.edge,original.edge*.36);}
  assert.ok(mobile.particles.length<field.particles.length);
  assert.equal(new Set(mobile.paintings.map(p=>p.workIndex)).size,96);
  for(const workCount of [0,1,12,59,96,99,125,255,320,354,480]){
    const sample=createArtField({workCount});
    assert.equal(sample.paintings.length,workCount);
    assert.deepEqual(sample.paintings.map(p=>p.workIndex).sort((a,b)=>a-b),Array.from({length:workCount},(_,i)=>i));
  }
});

test('Phone layers keep the visit identities, smaller edges and a spread of depths without changing desktop geometry',()=>{
  const desktop=createArtField({workCount:480,seed:3456}),mobile=createArtField({mobile:true,workCount:480,seed:3456});
  assert.deepEqual(mobile,createArtField({mobile:true,workCount:480,seed:3456}));
  assert.deepEqual(desktop,createArtField({workCount:480,seed:3456}),'Switching to phone does not mutate the desktop layout');
  assert.equal(mobile.paintings.length,96);
  assert.equal(mobile.paintings.filter(item=>item.hero).length,10);
  for(let index=0;index<10;index++)assert.ok(mobile.paintings.some(item=>item.workIndex===index),'The balanced opening foreground remains available');
  assert.ok(Math.max(...mobile.paintings.map(item=>item.workIndex))>470,'Deeper layers sample the entire seeded pool');
  assert.ok(Math.max(...mobile.paintings.map(item=>item.position[2]))-Math.min(...mobile.paintings.map(item=>item.position[2]))>2);
  const largestEdge=Math.max(...mobile.paintings.map(item=>item.edge*844/2*3.6/(3.6-item.position[2])));
  assert.ok(largestEdge<105,'Foreground paintings remain below desktop-scale edges on a 390×844 phone');
  for(const workCount of [0,1,12,59,96])assert.equal(createArtField({mobile:true,workCount}).paintings.length,workCount,'Small collections are not unnecessarily thinned');
});

test('Phone clearing protects the title and Start area while retaining paintings and points around it',()=>{
  for(const point of [[0,0],[.48,0],[-.48,0],[0,.3],[0,-.3]])assert.equal(fieldClearing(point,true),0);
  assert.ok(fieldClearing([0,.6],true)>.95,'Top and bottom layers remain visible');
  assert.ok(fieldClearing([.9,.2],true)>.6,'Side layers remain present outside the protected centre');
  assert.ok(fieldClearing([.5,0],false)>fieldClearing([.5,0],true),'Desktop clearing keeps its existing tighter centre');
});

test('A visit seed gives a repeatable order and geometry,while different visits change both',()=>{
  const a=orderOpeningPool(fullCollection,{seed:12345}),b=orderOpeningPool(fullCollection,{seed:67890});assert.deepEqual(a,orderOpeningPool(fullCollection,{seed:12345}));assert.notDeepEqual(a.slice(0,14).map(w=>w.id),b.slice(0,14).map(w=>w.id));assert.equal(new Set(a.map(w=>w.id)).size,fullCollection.length);assert.notDeepEqual(createArtField({workCount:fullCollection.length,seed:12345}).paintings,createArtField({workCount:fullCollection.length,seed:67890}).paintings);
  for(const list of [a,b]){const ten=list.slice(0,10),fourteen=list.slice(0,14);assert.ok(ten.filter(w=>/mexic/i.test(w.country||'')).length>=3);assert.ok(ten.filter(w=>w.recognitionTier==='landmark').length>=5);assert.ok(fourteen.filter(w=>/mexic/i.test(w.country||'')).length>=4);assert.ok(fourteen.filter(w=>w.recognitionTier==='landmark').length>=8);assert.ok(list.every(w=>fullCollection.includes(w)),'Original canonical records are reused');}
});

test('Fresh seeds use the supplied cryptographic source once per call',()=>{
  let sequence=500,calls=0;const crypto={getRandomValues(bytes){calls++;bytes[0]=sequence++;return bytes;}};assert.equal(createOpeningSeed(crypto),500);assert.equal(createOpeningSeed(crypto),501);assert.equal(calls,2);
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

test('Stationary presence is prominent and stable; tiny input jitter does not spike its force',()=>{
  const pointer={x:0,y:0,energy:0,time:0};for(let i=0;i<240;i++)updateFieldPointer(pointer,{x:.35,y:.2,time:i/60},1/60);assert.ok(Math.abs(pointer.energy-FIELD_MOTION.presence)<.00001);const energy=pointer.energy;
  for(let i=0;i<120;i++)updateFieldPointer(pointer,{x:.35+(i%2?.001:-.001),y:.2,time:4+i/60},1/60);assert.ok(Math.abs(pointer.energy-energy)<.00001);assert.ok(Math.abs(pointer.x-.35)<.0002);
  const moved=interactFieldPoint([.62,.2],pointer,{aspect:1.6,z:.4}),pixels=Math.hypot((moved[0]-.62)*720,(moved[1]-.2)*450);assert.ok(pixels>25&&pixels<100,'Visible yet bounded displacement');
});

test('Pointer smoothing is frame-rate independent,and leaving returns to the original geometry',()=>{
  const a={x:0,y:0,energy:0,time:0},b={...a};for(let i=0;i<60;i++)updateFieldPointer(a,{x:.8,y:-.4,time:i/60},1/60);for(let i=0;i<120;i++)updateFieldPointer(b,{x:.8,y:-.4,time:i/120},1/120);assert.ok(Math.abs(a.x-b.x)<1e-10);assert.ok(Math.abs(a.energy-b.energy)<1e-10);
  for(let i=0;i<240;i++)updateFieldPointer(a,{x:0,y:0,time:1+i/60,active:false},1/60);const point=[.6,.4],settled=interactFieldPoint(point,a,{aspect:1.6,z:.4});assert.ok(Math.hypot(settled[0]-point[0],settled[1]-point[1])<1e-6);assert.deepEqual(interactFieldPoint(point,{x:.8,y:.4,energy:0},{aspect:1.6}),point);
});

test('Force direction remains continuous close to the pointer and all finite inputs stay bounded',()=>{
  const pointer={x:.2,y:.1,energy:.9};const left=interactFieldPoint([.19999,.1],pointer),right=interactFieldPoint([.20001,.1],pointer);assert.ok(Math.hypot(left[0]-right[0],left[1]-right[1])<.001);
  const state={x:0,y:0,energy:0};updateFieldPointer(state,{x:NaN,y:Infinity,time:1},NaN);assert.ok([state.x,state.y,state.energy].every(Number.isFinite));for(const aspect of [.45,1,2.5])for(const z of [-2.9,0,.8]){const p=interactFieldPoint([.4,.4],pointer,{aspect,z});assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(p[0]-.4,p[1]-.4)<1);}
});
