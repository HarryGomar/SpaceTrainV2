import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSortingRecord,placeSortingWork,validSortingDraft,validSorting,analyzeSorting,renderSortingSnapshot,sortingPointerPosition} from '../../public/art-atlas/sorting-table.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const fresh=()=>createSortingRecord(works,{},[],{id:'free-grouping',now:10});

test('Dragging preserves the grabbed point and keeps edge drops on the table',()=>{
  const rect={left:100,top:100,width:600,height:400};
  assert.deepEqual(sortingPointerPosition(rect,430,310,[30,10]),[.5,.5]);
  assert.deepEqual(sortingPointerPosition(rect,442,318,[30,10]),[.52,.52]);
  assert.deepEqual(sortingPointerPosition(rect,101,101),[.055,.075]);
  assert.equal(sortingPointerPosition(rect,99,200),null);
});

test('Paintings can sit close together or stack exactly without shifting another work',()=>{
  let record=fresh();const [a,b,c]=record.offeredIds;
  record=placeSortingWork(record,a,[.4,.4]).record;
  const close=placeSortingWork(record,b,[.42,.415]);
  assert.equal(close.ok,true,'A related work should be allowed to overlap');
  assert.deepEqual(close.record.positions[a],[.4,.4]);record=close.record;
  const stack=placeSortingWork(record,c,[.4,.4]);assert.equal(stack.ok,true);
  assert.deepEqual(stack.record.positions[a],[.4,.4]);assert.deepEqual(stack.record.positions[c],[.4,.4]);
  assert.equal(validSortingDraft(stack.record,works),true);
});

test('Free stacking keeps its drawing order through save and restore',()=>{
  let record=fresh();const [a,b]=record.offeredIds;
  record=placeSortingWork(record,a,[.4,.4]).record;
  record=placeSortingWork(record,b,[.4,.4]).record;
  record=placeSortingWork(record,a,[.42,.42]).record;
  const restored=JSON.parse(JSON.stringify(record));
  assert.equal(validSortingDraft(restored,works),true);
  assert.deepEqual(restored.stackOrder,[b,a]);
  for(const corrupt of [{...restored,stackOrder:[a,a]},{...restored,stackOrder:[a,'unknown']},{...restored,stackOrder:[a]}])assert.equal(validSortingDraft(corrupt,works),false);
});

test('An existing table adopts free stacking only after an actual new placement',()=>{
  let record=fresh();const [a,b]=record.offeredIds;
  delete record.layoutVersion;delete record.stackOrder;
  record.positions={[a]:[.25,.4],[b]:[.75,.4]};record.presentedIds=[a,b];
  const before=structuredClone(record);assert.equal(validSortingDraft(record,works),true);
  const changed=placeSortingWork(record,b,[.25,.4]);assert.equal(changed.ok,true);
  assert.equal(changed.record.layoutVersion,'free-overlap-v1');assert.equal(validSortingDraft(changed.record,works),true);
  assert.deepEqual(record,before,'Historical positions must not be changed in place');
  const missingVersion={...changed.record};delete missingVersion.layoutVersion;
  assert.equal(validSortingDraft(missingVersion,works),false,'Legacy records cannot silently acquire a different spacing constraint');
});

test('A completely stacked set is one arrangement rather than a fabricated near-versus-far contrast',()=>{
  let record=fresh();for(const id of record.offeredIds)record=placeSortingWork(record,id,[.5,.5]).record;
  record.confirmed=true;record.finishedAt=20;assert.equal(validSorting(record,works),true);
  const findings=analyzeSorting(works,record);
  assert.ok(findings.some(f=>f.id.endsWith('-single-group')));
  assert.ok(!findings.some(f=>f.id.endsWith('-geometry')||f.feature));
  const snapshot=renderSortingSnapshot({record,work:id=>works.find(w=>w.id===id),image:w=>'<img data-id="'+w.id+'">',esc:String});
  for(const id of record.offeredIds)assert.ok(snapshot.includes('data-work="'+id+'"'));
});

test('An old spacing constraint cannot become evidence of free-stacking consistency',()=>{
  let old=fresh();old.id='old-spaced';delete old.layoutVersion;delete old.stackOrder;
  old.positions=Object.fromEntries(old.offeredIds.map((id,index)=>[id,[.1+(index%4)*.26,index<4?.2:.8]]));
  old.presentedIds=[...old.offeredIds];old.confirmed=true;old.finishedAt=12;
  assert.equal(validSorting(old,works),true);
  let current=createSortingRecord(works,{},[old],{id:'new-stacked',now:20,offeredIds:old.offeredIds});
  assert.equal(current.sortingReferenceId,null);
  for(const id of current.offeredIds)current=placeSortingWork(current,id,old.positions[id]).record;
  current.confirmed=true;current.finishedAt=30;current.sortingReferenceId=old.id;
  assert.equal(analyzeSorting(works,current,[old]).some(f=>f.id.endsWith('-comparison')),false);
});
