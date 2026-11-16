import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {PAGED_FAVOURITES,sanitizeChoiceGrid,toggleGridChoice,setChoiceGridPage,choiceGridExposure,validChoiceGrid,discoveryGridMarkup} from '../../public/art-atlas/discovery-grid.mjs';
const round={id:'favourites',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,evidence:{construct:'overall-favourites',instrumentRevision:PAGED_FAVOURITES},works:Array.from({length:72},(_,i)=>({id:'painting-'+i,title:'Painting '+i}))};

test('Every rated painting is reachable, and selections survive pages without expanding the five-favourite limit',()=>{
  let draft=sanitizeChoiceGrid(round);draft=toggleGridChoice(round,draft,'painting-0');draft=setChoiceGridPage(round,draft,2);draft=toggleGridChoice(round,draft,'painting-36');draft=setChoiceGridPage(round,draft,3);draft=toggleGridChoice(round,draft,'painting-71');draft=toggleGridChoice(round,draft,'painting-70');draft=toggleGridChoice(round,draft,'painting-69');draft=toggleGridChoice(round,draft,'painting-68');
  assert.deepEqual(draft.selectedIds,['painting-0','painting-36','painting-71','painting-70','painting-69']);assert.equal(validChoiceGrid(round,{...draft,confirmed:true}),true);
  const restored=sanitizeChoiceGrid(round,JSON.parse(JSON.stringify(draft)));assert.deepEqual(restored,draft);
  const dom=new JSDOM(discoveryGridMarkup(round,draft,{image:w=>`<img alt="${w.title}">`,esc:String}));
  assert.equal(dom.window.document.querySelectorAll('.discovery-work').length,18);assert.ok(dom.window.document.querySelector('[data-work="painting-71"]'));assert.equal(dom.window.document.querySelector('[data-work="painting-0"]'),null);
  dom.window.close();
});

test('Exposure records only opened pages, with no invented simultaneous comparison across them',()=>{
  const draft=setChoiceGridPage(round,sanitizeChoiceGrid(round),2),exposure=choiceGridExposure(round,draft);
  assert.equal(exposure.presentedIds.length,36);assert.equal(exposure.coPresentedGroups.length,2);assert.ok(!exposure.presentedIds.includes('painting-18'));
  assert.ok(!exposure.coPresentedGroups.some(group=>group.includes('painting-0')&&group.includes('painting-36')));
  assert.equal(validChoiceGrid(round,{...draft,selectedIds:['painting-18'],explicitNone:false,confirmed:true}),false);
  for(const presentation of [null,{...draft.presentation,visitedPages:[0,0]},{...draft.presentation,visitedPages:[0,4]},{...draft.presentation,activePage:1},{...draft.presentation,pageSize:19}])assert.equal(choiceGridExposure(round,{...draft,presentation}),null);
});
