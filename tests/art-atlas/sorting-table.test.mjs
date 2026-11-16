import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSortingRecord,validSortingDraft,validSorting,sortingIds,placeSortingWork,sortingDistance,analyzeSorting,renderSortingSnapshot} from '../../public/art-atlas/sorting-table.mjs';
import {createGalleryRecord,placePainting,validGallery,gallerySlots} from '../../public/art-atlas/gallery-model.mjs';

const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const positions=[[.12,.2],[.23,.2],[.70,.2],[.81,.2],[.12,.75],[.23,.75],[.70,.75],[.81,.75]];
function work(index,cluster=Math.floor(index/2)) {
  const histogram=Array(40).fill(0);histogram[cluster]=1;
  return {id:'work-'+index,title:'Work '+index,date:String(1500+cluster*220),movement:'Tradition '+cluster,features:{color:.5,abstraction:.5,humanity:.5,narrative:.5},analysis:{palette:{histogram},yearRange:[1500+cluster*220,1500+cluster*220],movementKey:'tradition-'+cluster}};
}
function complete(works=actual,options={}) {
  let record=createSortingRecord(works,{},options.records||[],{id:options.id||'table-one',now:options.now??10,...options});
  // Identity is deliberate here: adjacent source indices become spatial pairs,
  // regardless of the independently shuffled source tray.
  const ids=options.offeredIds||works.filter(w=>record.offeredIds.includes(w.id)).map(w=>w.id);
  for(let i=0;i<ids.length;i++){const result=placeSortingWork(record,ids[i],positions[i]);assert.ok(result.ok);record=result.record;}
  return {...record,confirmed:true,finishedAt:options.finishedAt??20};
}
const descriptor=record=>analyzeSorting(Array.from({length:8},(_,i)=>work(i)),record).filter(f=>f.feature);

test('A new table uses eight real identified works and records no default positions',()=>{
  const r=createSortingRecord(actual,{example:[1,2]},[],{id:'fresh',now:10});
  assert.equal(r.offeredIds.length,8);assert.equal(new Set(r.offeredIds).size,8);assert.deepEqual(r.positions,{});assert.deepEqual(sortingIds(r),[]);assert.equal(validSortingDraft(r,actual),true);assert.equal(validSorting(r,actual,false),false);
  for(const id of ['velasco-valley-mexico','shen-clouds','hokusai-mount-fuji','hiroshige-sudden-shower'])assert.ok(r.offeredIds.includes(id));
  assert.deepEqual(createSortingRecord(actual,{},[],{id:'fresh',now:10}).offeredIds,r.offeredIds);
});

test('All eight placements and actual presentation are needed to finish',()=>{
  const r=complete();assert.ok(validSorting(r,actual));assert.ok(validSorting(r,actual,false));
  for(const mutate of [d=>delete d.positions[d.offeredIds[0]],d=>d.presentedIds.pop(),d=>d.confirmed=false,d=>delete d.finishedAt,d=>d.finishedAt=d.createdAt-1]){const d=structuredClone(r);mutate(d);assert.equal(validSorting(d,actual),false);}
  const d=structuredClone(r);d.confirmed=false;delete d.finishedAt;assert.equal(validSorting(d,actual,false),true);
});

test('Saved geometry survives serialization and moving an artwork cannot duplicate it',()=>{
  const r=complete(),id=r.offeredIds[0],saved=JSON.parse(JSON.stringify(r));assert.deepEqual(saved.positions,r.positions);assert.ok(validSorting(saved,actual));
  const p=saved.positions[id],noop=placeSortingWork(saved,id,p);assert.equal(noop.record,saved);assert.equal(noop.changed,false);assert.equal(noop.record.confirmed,true);
  const result=placeSortingWork(saved,id,[p[0],.42]);assert.ok(result.ok);assert.equal(sortingIds(result.record).length,8);assert.equal(result.record.confirmed,false);assert.equal(result.record.finishedAt,undefined);assert.deepEqual(saved.positions[id],p);
});

test('Invalid coordinates and unknown works are rejected without shifting saved paintings',()=>{
  const r=complete(),[a]=r.offeredIds;
  for(const point of [null,[.5],[.5,undefined],[0,.5],[1,.5],[NaN,.5],[.5,Infinity]]){const result=placeSortingWork(r,a,point);assert.equal(result.ok,false);assert.equal(result.record,r);}
  assert.equal(placeSortingWork(r,'unoffered',[.4,.45]).ok,false);
});

test('Malformed drafts, identities and existing positions fail closed without missing values becoming zero',()=>{
  const r=complete();for(const mutate of [d=>d.positions[d.offeredIds[0]]=null,d=>d.positions[d.offeredIds[0]]=[.5],d=>d.positions.unknown=[.5,.5],d=>d.positions=[],d=>d.offeredIds[0]='unknown',d=>d.offeredIds[0]=d.offeredIds[1],d=>d.presentedIds=['unknown'],d=>d.detailExposureIds=['unknown'],d=>d.ui='broken',d=>d.ui.cursor=[0,.5],d=>d.ui.autoNext='yes',d=>d.ui.zoom='other',d=>d.positionSpace='pixels']){const d=structuredClone(r);mutate(d);assert.equal(validSortingDraft(d,actual),false);assert.deepEqual(analyzeSorting(actual,d),[]);}
  const d=structuredClone(r);d.positions[d.offeredIds[0]]=null;assert.doesNotThrow(()=>placeSortingWork(d,d.offeredIds[1],[.5,.5]));assert.equal(placeSortingWork(d,d.offeredIds[1],[.5,.5]).ok,false);
  assert.equal(validSortingDraft({...r,ui:[]},actual),false);
});

test('Geometric reading reports actual near and far evidence using the 3:2 table',()=>{
  assert.equal(sortingDistance([.1,.2],[.3,.2]),.3);assert.equal(sortingDistance([.1,.2],[.1,.5]),.3);
  const r=complete(),finding=analyzeSorting(actual,r).find(f=>f.id.endsWith('-geometry'));assert.ok(finding);assert.equal(finding.support.length,2);
  for(const e of finding.support){assert.equal(e.roundId,'scenario:'+r.id);assert.equal(e.workIds.length,2);for(const id of e.workIds){assert.ok(r.positions[id]);assert.ok(e.detail.includes(id+': ['));}}
  assert.match(finding.alternatives.join(' '),/does not establish liking/);assert.match(finding.alternatives.join(' '),/No hidden axis/);
});

test('A descriptor requires several disjoint close pairs and contrasting separated pairs',()=>{
  const works=Array.from({length:8},(_,i)=>work(i)),r=complete(works),findings=descriptor(r);assert.equal(findings.length,1);const f=findings[0];assert.equal(f.support.length,5);assert.equal(new Set(f.support.slice(0,3).flatMap(e=>e.workIds)).size,6);assert.ok(f.alternatives.some(s=>s.includes('dependent observations')));
  // The same geometry with only one identifiable movement pair cannot acquire
  // a repeated movement explanation by counting all pairs as separate support.
  const weak=works.map((w,i)=>({...structuredClone(w),analysis:{...structuredClone(w.analysis),palette:{histogram:Array(40).fill(1/40)},yearRange:null,movementKey:i<2?'shared':'separate-'+i}}));
  assert.equal(analyzeSorting(weak,r).some(f=>f.feature),false);
});

test('Uniform descriptors, absent dates and metadata exposure add no preference explanation',()=>{
  const works=Array.from({length:8},(_,i)=>work(i,0)),r=complete(works);for(const w of works){w.analysis.yearRange=null;w.analysis.movementKey='unknown';}
  r.detailExposureIds=[...r.offeredIds];const findings=analyzeSorting(works,r);assert.equal(findings.length,1);assert.equal(findings.some(f=>f.feature),false);assert.equal(findings.some(f=>/you (like|prefer)/i.test(f.text)),false);
});

test('Earlier tables are captured by exact ID and chronology, not array order',()=>{
  const oldest=complete(actual,{id:'oldest',now:1,finishedAt:2}),latest=complete(actual,{id:'latest',now:3,finishedAt:4}),r=complete(actual,{id:'current',now:10,records:[latest,oldest]});
  assert.equal(r.sortingReferenceId,'latest');const f=analyzeSorting(actual,r,[latest,oldest]).find(f=>f.id.endsWith('-comparison'));assert.ok(f);assert.ok(f.support.some(e=>e.roundId==='scenario:latest'));assert.ok(f.support.some(e=>e.roundId==='scenario:current'));
  assert.equal(analyzeSorting(actual,r,[oldest]).some(f=>f.id.endsWith('-comparison')),false);
  assert.equal(analyzeSorting(actual,r,[latest,structuredClone(latest)]).some(f=>f.id.endsWith('-comparison')),false);
  assert.equal(analyzeSorting(actual,r,[{...latest,finishedAt:11}]).some(f=>f.id.endsWith('-comparison')),false);
  assert.equal(analyzeSorting(actual,r,[{...latest,protocol:'other-protocol'}]).some(f=>f.id.endsWith('-comparison')),false);
});

test('Repeat comparisons preserve the same painting identities and do not substitute another pool',()=>{
  const previous=complete(actual,{id:'earlier',now:1,finishedAt:2}),r=complete(actual,{id:'current',now:10,records:[previous]});
  const changed=structuredClone(previous),other=actual.find(w=>!changed.offeredIds.includes(w.id));const id=changed.offeredIds[0];changed.offeredIds[0]=other.id;changed.positions[other.id]=changed.positions[id];delete changed.positions[id];changed.presentedIds=changed.presentedIds.map(v=>v===id?other.id:v);changed.ui.selectedId=other.id;
  changed.stackOrder=changed.stackOrder.map(value=>value===id?other.id:value);
  assert.equal(validSorting(changed,actual),true);assert.equal(analyzeSorting(actual,r,[changed]).some(f=>f.id.endsWith('-comparison')),false);
});

test('A museum comparison uses captured room membership and never wall pixel positions',()=>{
  const pool=createSortingRecord(actual,{},[],{id:'pool',now:1}).offeredIds;let museum=createGalleryRecord(actual,{}, {id:'museum',now:1,roomStudy:false});
  for(let i=0;i<pool.length;i++){const slot=gallerySlots(museum).find(s=>s.roomId===(i<4?'g1':'g3'));assert.ok(slot);const result=placePainting(museum,pool[i],slot.wallId,slot.t);assert.ok(result.ok);museum=result.record;}
  museum.confirmed=true;museum.finishedAt=2;assert.equal(validGallery(museum,actual),true);
  const r=complete(actual,{id:'after-museum',now:10,records:[museum]}),f=analyzeSorting(actual,r,[museum]).find(f=>f.id.endsWith('-comparison'));assert.equal(r.museumReferenceId,'museum');assert.ok(f);assert.match(f.alternatives[0],/not the same measurement/);assert.ok(f.support.some(e=>e.roundId==='scenario:museum'));
  const shifted=structuredClone(museum);[shifted.placements[pool[0]],shifted.placements[pool[1]]]=[shifted.placements[pool[1]],shifted.placements[pool[0]]];assert.equal(validGallery(shifted,actual),true);assert.deepEqual(analyzeSorting(actual,r,[shifted]).find(f=>f.id.endsWith('-comparison')),f);
});

test('Read-only snapshot uses saved positions and actual artwork IDs',()=>{
  const r=complete(),html=renderSortingSnapshot({record:r,work:id=>actual.find(w=>w.id===id),image:w=>'<img data-id="'+w.id+'">',esc:s=>String(s)});assert.equal((html.match(/data-action="evidence"/g)||[]).length,8);for(const id of r.offeredIds){assert.ok(html.includes('data-work="'+id+'"'));assert.ok(html.includes('left:'+r.positions[id][0]*100+'%;top:'+r.positions[id][1]*100+'%;'));}
});
