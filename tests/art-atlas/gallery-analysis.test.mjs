import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRounds } from '../../public/art-atlas/engine.mjs';
import { analyzeGallery, galleryGroupingMetrics, paletteDistance } from '../../public/art-atlas/gallery-analysis.mjs';

const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const walls=Array.from({length:5},(_,index)=>({id:'wall-'+index,roomId:'g'+(index+1),side:'north',x1:0,y1:0,x2:900,y2:0}));
function work(id,cluster) {
  const histogram=Array(40).fill(0);histogram[cluster]=1;
  return {id,title:'Painting '+id,artist:'Artist '+id,date:String(1500+cluster*220),movement:'Tradition '+cluster,features:{abstraction:.5,energy:.5,complexity:.5,humanity:.5,narrative:.5,atmosphere:.5,color:.5},analysis:{palette:{histogram,swatches:['#808080']},yearRange:[1500+cluster*220,1500+cluster*220],movementKey:'tradition-'+cluster}};
}
function grouped(count=9) {
  const works=Array.from({length:count},(_,i)=>work('art-'+i,Math.floor(i/3))),placements=Object.fromEntries(works.map((w,i)=>[w.id,{wallId:'wall-'+Math.floor(i/3),t:(i%3+1)/4}]));
  return {works,record:{version:2,kind:'curate',protocol:'open-gallery-v1',id:'exhibition-one',createdAt:1,offeredIds:works.map(w=>w.id),presentedIds:works.map(w=>w.id),placements,roomNames:{g1:'My first room'},baselineAnswers:{},confirmed:true,finishedAt:2}};
}

test('Palette distance uses sampled colour distributions rather than colour intensity alone',()=>{
  const a=work('a',0),b=work('b',1),same=work('same',0);
  assert.equal(a.features.color,b.features.color);assert.equal(paletteDistance(a,same),0);assert.equal(paletteDistance(a,b),1);
  b.analysis.palette.histogram=Array(39).fill(1);assert.equal(paletteDistance(a,b),null);
});

test('Free grouping finds a recurring feature with room-level evidence and co-explanations',()=>{
  const {works,record}=grouped(),findings=analyzeGallery(works,record,walls),f=findings.find(f=>f.feature==='palette');
  assert.ok(f);assert.ok(f.support.length>=2);assert.ok(f.support.every(e=>e.workIds.length===3));assert.match(f.alternatives.join(' '),/not a confidence level/);assert.match(f.alternatives.join(' '),/also align in/);
  assert.equal(findings.filter(f=>f.feature==='date'||f.feature==='movement').length,0);
  for(const finding of findings)for(const item of [...finding.support,...finding.counter])for(const id of item.workIds)assert.ok(works.some(w=>w.id===id));
});

test('Alternative grouping scores do not depend on property order, gallery names or wall coordinates',()=>{
  const {works,record}=grouped(),first=galleryGroupingMetrics(works,record,walls),other=structuredClone(record);
  other.placements=Object.fromEntries(Object.entries(other.placements).reverse());other.roomNames={g1:'A different name',g2:'Another'};
  const movedWalls=walls.map(w=>({...w,x1:999,y1:42,x2:1200,y2:42}));
  assert.deepEqual(galleryGroupingMetrics(works,other,movedWalls),first);
});

test('Missing and open-ended dates never become a recent or ancient date',()=>{
  const {works,record}=grouped();works[0].analysis.yearRange=null;
  const date=galleryGroupingMetrics(works,record,walls).find(m=>m.key==='date');assert.ok(date.coverage<1);assert.ok(date.allValues.some(v=>v===null));
  for(const w of works)w.analysis.yearRange=null;
  assert.equal(analyzeGallery(works,record,walls).some(f=>f.feature==='date'),false);
});

test('Identical descriptors and unknown movement labels do not manufacture a grouping rule',()=>{
  const {works,record}=grouped();for(const w of works){w.analysis.palette.histogram=works[0].analysis.palette.histogram;w.analysis.yearRange=[1900,1900];w.analysis.movementKey='unknown';}
  const findings=analyzeGallery(works,record,walls);assert.ok(findings.some(f=>f.id.endsWith('grouping-open')));assert.equal(findings.some(f=>f.feature),false);
});

test('A mixed room remains a counterexample to a pattern supported by other rooms',()=>{
  const {works,record}=grouped(12);works[10].analysis.palette.histogram=works[0].analysis.palette.histogram;
  works[11].analysis.palette.histogram=works[3].analysis.palette.histogram;
  const f=analyzeGallery(works,record,walls).find(f=>f.feature==='palette');assert.ok(f);assert.ok(f.counter.length);assert.equal(f.counter[0].workIds.length,2);
});

test('Larger gallery groups retain every work instead of being reduced to two-work pairs',()=>{
  const works=Array.from({length:9},(_,i)=>work('variable-'+i,i<2?0:i<5?1:2));
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',id:'variable',createdAt:1,offeredIds:works.map(w=>w.id),presentedIds:works.map(w=>w.id),placements:Object.fromEntries(works.map((w,i)=>[w.id,{wallId:i<2?'wall-0':i<5?'wall-1':'wall-2',t:(i+1)/10}])),roomNames:{},baselineAnswers:{},confirmed:true,finishedAt:2};
  const before=galleryGroupingMetrics(works,record,walls).find(m=>m.key==='palette');assert.equal(before.value,0);assert.deepEqual(before.rooms.map(r=>r.ids.length),[2,3,4]);
  works[8].analysis.palette.histogram=works[0].analysis.palette.histogram;
  const after=galleryGroupingMetrics(works,record,walls).find(m=>m.key==='palette');assert.ok(Math.abs(after.value-1/6)<1e-12);
});

test('A different pair inside an otherwise closer gallery stays visible as an exception',()=>{
  const works=Array.from({length:10},(_,i)=>work('internal-'+i,i<3?0:i<7?1:2));
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',id:'internal',createdAt:1,offeredIds:works.map(w=>w.id),presentedIds:works.map(w=>w.id),placements:Object.fromEntries(works.map((w,i)=>[w.id,{wallId:i<4?'wall-0':i<7?'wall-1':'wall-2',t:(i+1)/11}])),roomNames:{},baselineAnswers:{},confirmed:true,finishedAt:2};
  const f=analyzeGallery(works,record,walls).find(f=>f.feature==='palette');assert.ok(f);assert.ok(f.counter.some(e=>e.detail.includes('despite the closer average grouping')));assert.ok(f.counter[0].workIds.includes('internal-3'));
});

test('Immediate wall neighbours are compared while gallery membership stays fixed',()=>{
  const works=Array.from({length:12},(_,i)=>work('neighbor-'+i,i%6<3?0:1)),placements=Object.fromEntries(works.map((w,i)=>[w.id,{wallId:i<6?'wall-0':'wall-1',t:(i%6+1)/7}]));
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',id:'neighbors',createdAt:1,offeredIds:works.map(w=>w.id),presentedIds:works.map(w=>w.id),placements,roomNames:{},baselineAnswers:{},confirmed:true,finishedAt:2};
  const f=analyzeGallery(works,record,walls).find(f=>f.title==='The wall neighbours add another connection.');assert.ok(f);assert.match(f.text,/within their existing galleries and wall positions/);assert.ok(new Set(f.support.map(e=>e.detail.match(/Gallery \d+/)?.[0])).size>=2);assert.ok(f.counter.length);
});

test('Repeat readings count retained, separated and newly formed pairs without a consistency percentage',()=>{
  const {works,record}=grouped(),later={...structuredClone(record),id:'exhibition-two',finishedAt:3};
  [later.placements['art-0'],later.placements['art-3']]=[later.placements['art-3'],later.placements['art-0']];
  const f=analyzeGallery(works,later,walls,[record]).find(f=>f.id.endsWith('-revisit'));assert.ok(f);assert.match(f.text,/same-gallery pairs/);assert.match(f.alternatives.join(' '),/not independent responses or a taste-consistency percentage/);
  const changedPool={...record,offeredIds:[...record.offeredIds,'not-offered-before']};
  assert.equal(analyzeGallery(works,later,walls,[changedPool]).some(f=>f.id.endsWith('-revisit')),false);
});

test('Repeating a grouping basis retains evidence from both exhibitions',()=>{
  const {works,record}=grouped(),later={...structuredClone(record),id:'exhibition-two',finishedAt:3};
  const f=analyzeGallery(works,later,walls,[record]).find(f=>f.feature==='palette');assert.ok(f);assert.match(f.text,/previous exhibition/);assert.ok(f.support.some(e=>e.roundId==='scenario:exhibition-one'));assert.ok(f.support.some(e=>e.roundId==='scenario:exhibition-two'));assert.match(f.alternatives.join(' '),/do not establish a stable trait/);
});

test('Automatic wall positioning never becomes evidence of a deliberate change in wall neighbours',()=>{
  const {works,record}=grouped();record.roomStudy='room-relations-v1';for(const p of Object.values(record.placements))p.intent='room-drop';
  const later={...structuredClone(record),id:'later-auto',finishedAt:3};
  [later.placements['art-0'],later.placements['art-1']]=[later.placements['art-1'],later.placements['art-0']];
  const findings=analyzeGallery(works,later,walls,[record]),revisit=findings.find(f=>f.id.endsWith('-revisit'));
  assert.ok(revisit);assert.doesNotMatch(revisit.title+' '+revisit.text,/wall neighbours changed|immediate wall neighbour changed/);assert.equal(findings.some(f=>f.id.includes('-neighbors-')),false);
});

test('An earlier favourite can support an omission only after that exact work was presented',()=>{
  const r=buildRounds(actual)[0],ids=r.works.map(w=>w.id),offered=actual.map(w=>w.id),others=offered.filter(id=>id!==ids[0]);
  const pref={workIds:ids,criterion:'preference',confirmed:true,positions:Object.fromEntries(ids.map((id,i)=>[id,[100,70,40,0][i]]))};
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',id:'actual',createdAt:1,offeredIds:offered,presentedIds:[...offered],placements:Object.fromEntries(others.slice(0,8).map((id,i)=>[id,{wallId:i<4?'wall-0':'wall-1',t:(i%4+1)/5}])),roomNames:{},baselineAnswers:{preferenceRank:pref},confirmed:true,finishedAt:2};
  const first=analyzeGallery(actual,record,walls).find(f=>f.id.endsWith('-omission'));assert.ok(first);assert.ok(first.evidence.includes(ids[0]));
  record.presentedIds=record.presentedIds.filter(id=>id!==ids[0]);assert.equal(analyzeGallery(actual,record,walls).some(f=>f.id.endsWith('-omission')),false);
});

test('Unknown artwork identities, invalid wall references and unfinished records add no evidence',()=>{
  const {works,record}=grouped();assert.deepEqual(analyzeGallery(works,{...record,confirmed:false},walls),[]);
  assert.deepEqual(analyzeGallery(works,{...record,placements:{unknown:{wallId:'wall-0',t:.5}}},walls),[]);
  const bad=structuredClone(record);bad.placements['art-0'].wallId='missing';assert.deepEqual(analyzeGallery(works,bad,walls),[]);
});

test('A clear local movement connection is retained without inventing a repeated gallery rule',()=>{
  const ids=['monet-water-lilies','morisot-reading','cassatt-omnibus','mondrian-composition','klee-tightrope','klee-carnival'];
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',id:'actual-local',createdAt:1,offeredIds:actual.map(w=>w.id),presentedIds:ids,placements:Object.fromEntries(ids.map((id,i)=>[id,{wallId:i<3?'wall-0':'wall-1',t:(i%3+1)/4}])),roomNames:{},baselineAnswers:{},confirmed:true,finishedAt:2};
  const metrics=galleryGroupingMetrics(actual,record,walls);assert.equal(metrics.find(m=>m.key==='movement').eligible,false);
  const local=analyzeGallery(actual,record,walls).find(f=>f.scope==='gallery');assert.ok(local);assert.equal(local.feature,'movement');assert.equal(local.galleryId,'g1');assert.match(local.title,/Impressionism/);assert.match(local.text,/does not establish a repeated grouping rule/);assert.deepEqual(local.support[0].workIds,[...ids.slice(0,3)].sort());assert.ok(local.counter[0].workIds.includes('mondrian-composition'));assert.match(local.counter[0].detail,/does not show the same close connection/);
});

test('An unvarying or weak descriptor produces no local gallery claim',()=>{
  const {works,record}=grouped(6);
  for(const w of works){w.analysis.palette.histogram=works[0].analysis.palette.histogram;w.analysis.yearRange=[1900,1900];w.analysis.movementKey='one broad label';}
  assert.equal(analyzeGallery(works,record,walls).some(f=>f.scope==='gallery'),false);
  for(const [i,w] of works.entries())w.analysis.yearRange=[1900+i,1900+i];
  assert.equal(analyzeGallery(works,record,walls).some(f=>f.scope==='gallery'),false);
});
