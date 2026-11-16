import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeChoiceGrid,validChoiceGrid,toggleGridChoice,expandKeepSelectionRound} from '../../public/art-atlas/discovery-grid.mjs';
import {validAnswer,sanitizeDraft} from '../../public/art-atlas/engine.mjs';
const round=mode=>({id:'grid',kind:'choice-grid',selectionMode:mode,maxChoices:mode==='shortlist'?3:12,works:Array.from({length:12},(_,i)=>({id:'work-'+i}))});
const complete=(r,answer)=>({...sanitizeChoiceGrid(r,answer),confirmed:true});

test('An explicit overall-favourites choice keeps its stated limit while an ordinary keep grid can expand',()=>{
  const favourites={...round('shortlist'),maxChoices:5,evidence:{construct:'overall-favourites'}};
  assert.equal(expandKeepSelectionRound(favourites),null);
  assert.ok(expandKeepSelectionRound(round('shortlist')));
  const chosen=complete(favourites,{selectedIds:favourites.works.slice(0,5).map(work=>work.id)});assert.equal(validChoiceGrid(favourites,chosen),true);
  assert.equal(validChoiceGrid(favourites,{...chosen,selectedIds:favourites.works.slice(0,6).map(work=>work.id)}),false);
});

test('An untouched selection is missing; explicit none is a valid separate answer',()=>{
  for(const mode of ['familiarity','shortlist']){
    const r=round(mode);assert.equal(validChoiceGrid(r,complete(r,{})),false);
    const none=complete(r,{explicitNone:true});assert.equal(validChoiceGrid(r,none),true);assert.equal(validAnswer(r,none),true);assert.deepEqual(none.selectedIds,[]);
    assert.equal(validChoiceGrid(r,{...none,confirmed:false}),false);
  }
});
test('Not sure is available only for familiarity and cannot also mean none or a selection',()=>{
  const r=round('familiarity'),unsure=complete(r,{unsure:true});assert.equal(validChoiceGrid(r,unsure),true);
  assert.equal(validChoiceGrid(r,{...unsure,explicitNone:true}),false);
  assert.equal(validChoiceGrid(r,{...unsure,selectedIds:['work-1']}),false);
  assert.equal(validChoiceGrid(round('shortlist'),complete(round('shortlist'),{unsure:true})),false);
});
test('A shortlist stops at three, supports removal and does not rank unselected works',()=>{
  const r=round('shortlist');let draft=sanitizeChoiceGrid(r,{explicitNone:true});
  for(const id of ['work-0','work-1','work-2','work-3'])draft=toggleGridChoice(r,draft,id);
  assert.deepEqual(draft.selectedIds,['work-0','work-1','work-2']);assert.equal(draft.explicitNone,false);assert.equal(draft.unsure,false);
  draft=toggleGridChoice(r,draft,'work-1');draft=toggleGridChoice(r,draft,'work-3');assert.deepEqual(draft.selectedIds,['work-0','work-2','work-3']);
  assert.equal(validAnswer(r,{...draft,confirmed:true}),true);assert.equal(Object.hasOwn(draft,'positions'),false);
});
test('Submitted identity, order, duplicates, capacity and foreign artwork are checked',()=>{
  const r=round('shortlist'),valid=complete(r,{selectedIds:['work-1','work-2']});assert.equal(validChoiceGrid(r,valid),true);
  for(const change of [{workIds:[...valid.workIds].reverse()},{selectedIds:['work-1','work-1']},{selectedIds:['outside']},{selectedIds:['work-0','work-1','work-2','work-3']},{selectionMode:'familiarity'},{skipped:true}])assert.equal(validChoiceGrid(r,{...valid,...change}),false);
});
test('Restoring a partial grid removes foreign identities and resets confirmation',()=>{
  const r=round('shortlist'),draft=sanitizeDraft(r,{selectedIds:['work-1','work-1','outside','work-2','work-3','work-4'],confirmed:true});
  assert.deepEqual(draft.selectedIds,['work-1','work-2','work-3']);assert.deepEqual(draft.workIds,r.works.map(w=>w.id));assert.equal(draft.confirmed,false);
  assert.deepEqual(toggleGridChoice(r,draft,'outside'),draft);
});

test('An unrestricted keep grid accepts more than three without ranking the remaining works',()=>{
  const r={...round('shortlist'),maxChoices:12};let draft=sanitizeChoiceGrid(r,{});
  for(const work of r.works)draft=toggleGridChoice(r,draft,work.id);
  assert.equal(draft.selectedIds.length,12);assert.equal(validChoiceGrid(r,{...draft,confirmed:true}),true);assert.equal(Object.hasOwn(draft,'positions'),false);
  const old=round('shortlist');assert.equal(validChoiceGrid(old,{...draft,confirmed:true}),false);
});

test('Removing the active keep limit preserves the original definition for its revision record',()=>{
  const original=round('shortlist'),snapshot=structuredClone(original),expanded=expandKeepSelectionRound(original);
  assert.deepEqual(original,snapshot);assert.deepEqual(expanded.works,original.works);assert.equal(expanded.maxChoices,12);assert.equal(expanded.evidence.previousSelectionLimit,3);
  assert.equal(expandKeepSelectionRound(expanded),null);assert.equal(expandKeepSelectionRound(round('familiarity')),null);
});
