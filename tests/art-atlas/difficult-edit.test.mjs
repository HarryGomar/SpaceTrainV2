import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRounds } from '../../public/art-atlas/engine.mjs';
import { createGalleryRecord, gallerySlots, placePainting, validGallery } from '../../public/art-atlas/gallery-model.mjs';
import { isDifficultEdit, createDifficultEditRecord, validDifficultEditDraft, validDifficultEdit, difficultEditIds, difficultEditWalls, setDifficultEditRemoval, startDifficultEditComparison, chooseDifficultEditComparison, resetDifficultEditComparison, analyzeDifficultEdit, createDifficultEdit } from '../../public/art-atlas/difficult-edit.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
function baseline(){const r=buildRounds(works,{})[0];return {preferenceRank:{workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map((w,i)=>[w.id,[100,65,35,0][i]])),confirmed:true}};}
function room(ids=baseline().preferenceRank.workIds){let r=createGalleryRecord(works,{}, {id:'my-gallery',now:1,roomStudy:false});r.roomNames.g1='My landscape room';for(const id of ids){const slot=gallerySlots(r).find(s=>s.roomId==='g1');const result=placePainting(r,id,slot.wallId,slot.t);assert.ok(result.ok);r=result.record;}r.confirmed=true;r.finishedAt=2;assert.ok(validGallery(r,works));return r;}
function edit(options={},answers={}){return createDifficultEditRecord(works,answers,[],{id:'edit-one',now:3,...options});}
function compared(r=edit(),removed=r.offeredIds[0],choice='initial'){r={...r,presentedIds:[...r.offeredIds]};r=setDifficultEditRemoval(r,removed,works);r=startDifficultEditComparison(r,works);if(choice)r=chooseDifficultEditComparison(r,choice,works);return r;}
function finished(r=compared()){return {...r,confirmed:true,finishedAt:4};}

test('A new edit binds four real works, with Mexico represented, and leaves every decision missing',()=>{
  const r=edit();assert.ok(isDifficultEdit(r));assert.ok(validDifficultEditDraft(r,works));assert.equal(r.offeredIds.length,4);assert.equal(new Set(r.offeredIds).size,4);assert.ok(r.offeredIds.some(id=>works.find(w=>w.id===id).country==='Mexico'));
  assert.equal(r.source.kind,'catalogue-set');assert.equal(r.phase,'edit');assert.equal(r.removedId,null);assert.equal(r.alternativeRemovedId,null);assert.equal(r.compareChoice,null);assert.deepEqual(r.presentedIds,[]);assert.equal(validDifficultEdit(r,works,false),false);
  for(const source of r.artworkSources){const w=works.find(w=>w.id===source.id);assert.equal(source.image,w.image);assert.equal(source.sourceUrl,w.sourceUrl);}
});

test('A completed room with at least four works supplies the actual set and freezes its source',()=>{
  const source=room(),answers=baseline(),r=createDifficultEditRecord(works,answers,[source],{id:'from-room',now:3});
  assert.equal(r.source.kind,'gallery-room');assert.equal(r.source.recordId,source.id);assert.equal(r.source.roomId,'g1');assert.equal(r.source.roomName,'My landscape room');assert.equal(r.source.selectionRule,'whole-room');assert.deepEqual([...r.offeredIds].sort(),Object.keys(source.placements).sort());assert.ok(validDifficultEditDraft(r,works));
  const id=r.offeredIds[0],savedPosition=r.source.placements[id].t;source.placements[id].t=.99;source.roomNames.g1='Changed later';answers.preferenceRank.positions[answers.preferenceRank.workIds[0]]=0;
  assert.equal(r.source.placements[id].t,savedPosition);assert.equal(r.source.roomName,'My landscape room');assert.equal(r.baselineAnswers.preferenceRank.positions[r.baselineAnswers.preferenceRank.workIds[0]],100);
});

test('A larger room records the full source group while offering an explicit four-work subset',()=>{
  const ids=[...baseline().preferenceRank.workIds,'velasco-valley-mexico'],r=createDifficultEditRecord(works,{},[room(ids)],{id:'subset',now:3});
  assert.equal(r.offeredIds.length,4);assert.equal(r.source.roomWorkIds.length,5);assert.equal(r.source.selectionRule,'first-four-in-wall-order');assert.ok(r.offeredIds.every(id=>r.source.roomWorkIds.includes(id)));assert.ok(validDifficultEditDraft(r,works));
});

test('An unfinished gallery does not masquerade as a completed source room',()=>{
  const source=room();delete source.finishedAt;source.confirmed=false;
  const r=createDifficultEditRecord(works,{},[source],{id:'fallback',now:3});assert.equal(r.source.kind,'catalogue-set');assert.ok(validDifficultEditDraft(r,works));
});

test('The edit and final wall choice need separate explicit decisions and all four works presented',()=>{
  let r=edit();r=setDifficultEditRemoval(r,r.offeredIds[0],works);assert.equal(r.phase,'edit');assert.equal(validDifficultEdit(r,works,false),false);assert.equal(startDifficultEditComparison(r,works),r);
  r.presentedIds=[...r.offeredIds];r=startDifficultEditComparison(r,works);assert.equal(r.phase,'compare');assert.equal(r.compareChoice,null);assert.equal(validDifficultEdit(r,works,false),false);
  r=chooseDifficultEditComparison(r,'initial',works);assert.equal(validDifficultEdit(r,works,false),true);assert.equal(validDifficultEdit(r,works),false);assert.ok(validDifficultEdit(finished(r),works));
});

test('The two three-work versions differ in one position and preserve both shared positions',()=>{
  const r=compared(),walls=difficultEditWalls(r);assert.equal(walls.initial.length,3);assert.equal(walls.alternative.length,3);assert.equal(new Set(walls.alternative).size,3);assert.equal(walls.initial.includes(r.removedId),false);assert.ok(walls.alternative.includes(r.removedId));assert.equal(walls.alternative.includes(r.alternativeRemovedId),false);
  assert.equal(walls.initial.filter((id,i)=>id===walls.alternative[i]).length,2);assert.deepEqual(difficultEditIds(r),walls.initial);assert.deepEqual(difficultEditIds(chooseDifficultEditComparison(r,'alternative',works)),walls.alternative);
});

test('Changing the removal clears dependent comparison data; a no-op leaves it intact',()=>{
  const r=finished(compared()),before=structuredClone(r);assert.equal(setDifficultEditRemoval(r,r.removedId,works),r);
  const changed=setDifficultEditRemoval(r,r.offeredIds.find(id=>id!==r.removedId),works);assert.equal(changed.phase,'edit');assert.equal(changed.compareChoice,null);assert.equal(changed.alternativeRemovedId,null);assert.equal(changed.comparisonBasis,null);assert.equal(changed.finishedAt,undefined);assert.equal(changed.confirmed,false);assert.deepEqual(r,before);
  const back=resetDifficultEditComparison(r,works);assert.equal(back.removedId,r.removedId);assert.equal(back.phase,'edit');assert.equal(back.compareChoice,null);
});

test('Either-wall is explicit missing direction, not an invented unique final wall',()=>{
  const r=finished(compared(edit(),undefined,'equal'));assert.ok(validDifficultEdit(r,works));assert.equal(difficultEditIds(r).length,4);
  const findings=analyzeDifficultEdit(works,r);assert.equal(findings.length,1);assert.match(findings[0].title,/Both three-work walls/);assert.match(findings[0].text,/did not identify one unique set/);
});

test('Actual earlier ratings can target the alternative and support a contextual exception',()=>{
  const answers=baseline(),high=answers.preferenceRank.workIds[0],low=answers.preferenceRank.workIds.at(-1),r=finished(compared(edit({},answers),high,'initial'));
  assert.equal(r.alternativeRemovedId,low);assert.equal(r.comparisonBasis,'earlier-preference');const f=analyzeDifficultEdit(works,r).find(f=>f.id.endsWith('-preference'));assert.ok(f);assert.match(f.title,/higher-rated work stayed outside/);
  const prior=f.support.find(e=>e.roundId==='preferenceRank');assert.deepEqual([...prior.workIds].sort(),[high,low].sort());assert.match(prior.detail,/100/);assert.match(prior.detail,/0/);assert.match(f.alternatives.join(' '),/targeted comparison/);
});

test('The final alternative is interpreted from the actual retained and returned works',()=>{
  const answers=baseline(),source=room(),low=answers.preferenceRank.workIds.at(-1);let r=createDifficultEditRecord(works,answers,[source],{id:'restore-lower',now:3});r=finished(compared(r,low,'alternative'));
  const walls=difficultEditWalls(r),f=analyzeDifficultEdit(works,r).find(f=>f.id.endsWith('-preference'));assert.ok(f);assert.match(f.title,/higher-rated work stayed outside/);assert.ok(difficultEditIds(r).includes(low));assert.equal(difficultEditIds(r).includes(r.alternativeRemovedId),false);assert.deepEqual(difficultEditIds(r),walls.alternative);
});

test('Missing or invalid baseline preferences produce a scoped comparison rather than invented liking',()=>{
  const r=finished(compared(edit({}, {preferenceRank:{confirmed:false,positions:{invented:100}}}))),findings=analyzeDifficultEdit(works,r);
  assert.ok(validDifficultEdit(r,works));assert.equal(findings.length,1);assert.equal(findings.some(f=>f.support.some(e=>e.roundId==='preferenceRank')),false);assert.match(findings[0].alternatives.join(' '),/not a recorded dislike/);
  for(const f of findings)for(const e of [...f.support,...f.counter]){assert.equal(e.roundId,'scenario:'+r.id);assert.ok(e.workIds.every(id=>r.offeredIds.includes(id)));}
});

test('Malformed identities, source snapshots or comparison metadata are rejected without repair',()=>{
  const r=finished(compared()),before=structuredClone(r),missing=works.filter(w=>w.id!==r.offeredIds[0]);assert.equal(validDifficultEditDraft(r,missing),false);assert.deepEqual(r,before);assert.deepEqual(analyzeDifficultEdit(missing,r),[]);
  const corruptions=[{...r,offeredIds:[r.offeredIds[0],r.offeredIds[0],...r.offeredIds.slice(2)]},{...r,alternativeRemovedId:r.removedId},{...r,comparisonOrder:['initial','initial']},{...r,compareChoice:'guess'},{...r,presentedIds:[...r.presentedIds,r.presentedIds[0]]},{...r,protocol:'future-version'}];
  for(const bad of corruptions)assert.equal(validDifficultEditDraft(bad,works),false);
  const imageChanged=structuredClone(r);imageChanged.artworkSources[0].image='a-replacement.jpg';assert.equal(validDifficultEditDraft(imageChanged,works),false);
  assert.equal(setDifficultEditRemoval(r,'invented',works),r);assert.equal(chooseDifficultEditComparison(r,'invented',works),r);
});

test('Repeated records only compare initial edits when the same four works were available',()=>{
  const a=finished(compared(edit({id:'first'}))),b=finished(compared(edit({id:'second'}),a.removedId));const f=analyzeDifficultEdit(works,b,[a]).find(f=>f.id.endsWith('-revisit'));assert.ok(f);assert.match(f.text,/same four works/);assert.match(f.text,/rather than a taste-consistency score/);assert.equal(f.support[0].roundId,'scenario:'+a.id);
});

function fakeController(initial) {
  let current=initial,broken=false,saves=0;const finish={disabled:false};
  const element={querySelectorAll:selector=>selector==='img'?current.offeredIds.map((id,i)=>({complete:true,naturalWidth:broken&&i===0?0:100,dataset:{artwork:id}})):[],querySelector:selector=>selector==='[data-action="lab-finish"]'?finish:null};
  const app={querySelector:selector=>selector==='.difficult-edit'?element:null,addEventListener:()=>{}};
  const controller=createDifficultEdit({app,getRecord:()=>current,setRecord:r=>{current=r;},getWorks:()=>works,image:()=>'',esc:String,save:()=>{saves++;},rerender:()=>{},inspect:()=>{}});
  return {controller,current:()=>current,switchTo:r=>{current=r;},breakImage:value=>{broken=value;},finish,saves:()=>saves};
}

test('Undo history stays with its own record when another draft is opened',()=>{
  const a=edit({id:'undo-a'}),b=edit({id:'undo-b'}),fake=fakeController(a);fake.controller.sync();fake.controller.handle('difficult-remove',{dataset:{difficultWork:a.offeredIds[0]}});const editedA=fake.current();assert.equal(editedA.removedId,a.offeredIds[0]);
  fake.switchTo(b);fake.controller.handle('difficult-undo',{});assert.equal(fake.current(),b);assert.equal(fake.current().removedId,null);
  fake.switchTo(editedA);fake.controller.handle('difficult-undo',{});assert.equal(fake.current().removedId,null);assert.equal(fake.current().id,a.id);assert.equal(fake.current().finishedAt,undefined);
});

test('A failed image blocks new edits and final confirmation, with no answer manufactured on recovery',()=>{
  const fake=fakeController(edit());fake.breakImage(true);fake.controller.sync();assert.equal(fake.controller.mountedReady(),false);assert.deepEqual(fake.current().presentedIds,[]);fake.controller.handle('difficult-remove',{dataset:{difficultWork:fake.current().offeredIds[0]}});assert.equal(fake.current().removedId,null);
  fake.breakImage(false);fake.controller.sync();assert.equal(fake.controller.mountedReady(),true);assert.equal(fake.current().presentedIds.length,4);assert.equal(fake.current().removedId,null);
  fake.switchTo(compared(fake.current()));fake.controller.sync();assert.equal(fake.finish.disabled,false);fake.breakImage(true);fake.controller.sync();assert.equal(fake.finish.disabled,true);assert.equal(fake.current().compareChoice,'initial');
});
