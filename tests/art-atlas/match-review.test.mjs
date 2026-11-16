import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createInteractions} from '../../public/art-atlas/interactions.mjs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import {correctOption,validAnswer} from '../../public/art-atlas/engine.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),rounds=buildJourneyRounds(works),globalsReady=new WeakSet(),escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function exercise(t,round,draft,{reviewExists=true}={}){
  if(!globalsReady.has(t)){const saved=Object.fromEntries(['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));t.after(()=>{for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});globalThis.window={addEventListener(){}};globalThis.document={activeElement:null};globalsReady.add(t);}
  const host={innerHTML:'',classList:{add(){}},querySelector:selector=>selector==='.match-review-grid'&&reviewExists?{}:null},app={addEventListener(){},querySelector:selector=>selector==='.matching-input'?host:null,querySelectorAll:()=>[]},input=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>true,image:work=>`<img data-artwork="${escape(work.id)}" src="${escape(work.image)}">`,esc:escape,workById:id=>round.works.find(work=>work.id===id),saveDraft(){throw Error('Rendering a review cannot change saved choices');},sync(){}});
  return {input,host};
}
function withCertainty(round,draft){if(round.evidence.instrumentRevision==='recognition-certainty-v1')draft.certainty=Object.fromEntries(round.works.map(work=>[work.id,draft.guesses[work.id]==='unsure'?'unsure':'guessed']));return draft;}
const figures=markup=>[...markup.matchAll(/<figure class="match-review-work" data-review-work="([^"]+)" data-match-status="([^"]+)">([\s\S]*?)<\/figure>/g)].map(match=>({workId:match[1],status:match[2],body:match[3]}));

test('All-unsure artist and movement checks show every actual painting with its correct name and the unchanged uncertainty',t=>{
  for(const round of rounds.filter(round=>round.kind==='match')){
    const draft={workIds:round.works.map(work=>work.id),field:round.field,guesses:Object.fromEntries(round.works.map(work=>[work.id,'unsure'])),confirmed:true},before=structuredClone(withCertainty(round,draft));assert.ok(validAnswer(round,draft));const {input}=exercise(t,round,draft),markup=input.markup(),items=figures(markup);
    assert.equal(items.length,4);assert.deepEqual(items.map(item=>item.workId),draft.workIds);assert.equal((markup.match(/<img /g)||[]).length,4);assert.doesNotMatch(markup,/Unused label|class="match-targets"|class="unsure-works"|data-drop-option/);
    for(const item of items){const work=round.works.find(work=>work.id===item.workId);assert.match(item.body,new RegExp('data-artwork="'+work.id+'"'));assert.ok(item.body.includes(escape(work[round.field])+'</strong>'));assert.ok(item.body.includes('Answer: </span>'));assert.equal(item.status,'unsure');assert.ok(item.body.includes('</svg>Not sure</span>'));assert.ok(!item.body.includes('You chose'));}
    assert.deepEqual(draft,before);
  }
});
test('A mixed review distinguishes the correct answer from the original wrong selection without assigning unknown choices',t=>{
  const round=rounds.find(round=>round.kind==='match'&&round.field==='artist'),offered=round.works.map(work=>work.id),draft={workIds:offered,field:round.field,guesses:{[offered[0]]:correctOption(round,round.works[0]),[offered[1]]:correctOption(round,round.works[2]),[offered[2]]:'unsure',[offered[3]]:correctOption(round,round.works[3])},confirmed:true},before=structuredClone(withCertainty(round,draft));assert.ok(validAnswer(round,draft));const {input}=exercise(t,round,draft),items=figures(input.markup()),wrong=items.find(item=>item.workId===offered[1]),unsure=items.find(item=>item.workId===offered[2]);
  assert.ok(wrong.body.includes(escape(round.works[1].artist)+'</strong>'));assert.ok(wrong.body.includes('You chose '+escape(round.works[2].artist)));assert.equal(wrong.status,'missed');assert.ok(wrong.body.includes('</svg>Incorrect</span>'));assert.equal(unsure.status,'unsure');assert.ok(unsure.body.includes('</svg>Not sure</span>'));assert.ok(!unsure.body.includes('You chose'));assert.equal(items.filter(item=>item.status==='correct'&&item.body.includes('</svg>Correct</span>')).length,2);assert.deepEqual(draft,before);
});
test('Confirmed attachment replaces an old target layout before querying unavailable label or unsure controls',t=>{
  const round=rounds.find(round=>round.kind==='match'),draft={workIds:round.works.map(work=>work.id),field:round.field,guesses:Object.fromEntries(round.works.map(work=>[work.id,'unsure'])),confirmed:true},{input,host}=exercise(t,round,draft,{reviewExists:false});assert.doesNotThrow(()=>input.attach());assert.equal(figures(host.innerHTML).length,4);assert.ok(host.innerHTML.includes('class="match-review-grid"'));
});
test('Unconfirmed matching keeps its original source tray and drop controls',t=>{
  const round=rounds.find(round=>round.kind==='match'),draft={workIds:round.works.map(work=>work.id),field:round.field,guesses:{},confirmed:false},{input}=exercise(t,round,draft),markup=input.markup();assert.ok(markup.includes('class="match-targets"'));assert.ok(markup.includes('class="unsure-works"'));assert.equal((markup.match(/<img /g)||[]).length,4);assert.doesNotMatch(markup,/match-review-grid/);
});

test('Attribution certainty controls survive painting and are cleared when a label is reassigned',()=>{
  const dom=new JSDOM('<main></main>'),oldWindow=globalThis.window,oldDocument=globalThis.document;
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  try{
    const app=document.querySelector('main'),round=rounds.find(round=>round.kind==='match'),draft={workIds:round.works.map(work=>work.id),field:round.field,guesses:Object.fromEntries(round.works.map(work=>[work.id,correctOption(round,work)])),certainty:{},confirmed:false};let saves=0;
    const input=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>true,image:work=>`<img data-artwork="${work.id}">`,esc:escape,workById:id=>round.works.find(work=>work.id===id),saveDraft(){saves++;},sync(){}});
    app.innerHTML=input.markup();input.attach();assert.equal(validAnswer(round,{...draft,confirmed:true}),false);
    for(const work of round.works){const control=app.querySelector(`[data-action="match-certainty"][data-work="${work.id}"][data-value="guessed"]`);assert.ok(control);input.click('match-certainty',control,{});}
    assert.equal(saves,4);assert.equal(app.querySelectorAll('.match-certainty [aria-pressed="true"]').length,4);assert.ok(validAnswer(round,{...draft,confirmed:true}));
    const [first,second]=round.works;input.click('select-art',{dataset:{work:first.id}},{});input.click('place-match',{dataset:{option:draft.guesses[second.id]}},{});
    assert.equal(draft.certainty[first.id],undefined);assert.equal(draft.certainty[second.id],undefined);assert.equal(Object.keys(draft.certainty).length,2);assert.equal(validAnswer(round,{...draft,confirmed:true}),false);
  }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;dom.window.close();}
});
