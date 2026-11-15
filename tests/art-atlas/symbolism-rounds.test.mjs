import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SYMBOLISM_CONTENT_BANK,getSymbolismContent} from '../../public/art-atlas/symbolism-content.mjs';
import {SYMBOLISM_PROTOCOL,SYMBOLISM_PROMPTS,SYMBOLISM_SCALE,availableSymbolismContent,selectSymbolismContent,buildSymbolismRound,isSymbolismRound,validSymbolismDefinition,validSymbolismAnswer,sanitizeSymbolismDraft,reduceSymbolismDraft,symbolismResult} from '../../public/art-atlas/symbolism-rounds.mjs';
import {snapshotStudyRound,restoreStudyRound} from '../../public/art-atlas/deep-study.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const make=(id='reveal',contentId='ambassadors-skull',extra={})=>buildSymbolismRound({id,works,contentId,...extra});
const complete=(round,before=25,after=75,extra={})=>({workIds:round.works.map(work=>work.id),workId:round.works[0].id,before,after,storySeen:true,...extra});

test('At least nine source-attributed notes have unique identities, qualified claims and a declared interpretation limit',()=>{
  assert.ok(SYMBOLISM_CONTENT_BANK.length>=9);assert.equal(new Set(SYMBOLISM_CONTENT_BANK.map(note=>note.id)).size,SYMBOLISM_CONTENT_BANK.length);assert.equal(new Set(SYMBOLISM_CONTENT_BANK.map(note=>note.workId)).size,SYMBOLISM_CONTENT_BANK.length);
  for(const note of SYMBOLISM_CONTENT_BANK){assert.ok(note.text.split(/\s+/).length<=65);assert.ok(note.sourceUrls.every(source=>source.startsWith('https://')));assert.ok(note.claims.length>=2);assert.ok(note.interpretationLimit);for(const claim of note.claims)assert.ok(claim.sourceUrls.every(source=>note.sourceUrls.includes(source)));}
  assert.match(getSymbolismContent('hope-last-string').text,/Some early critics/);assert.match(getSymbolismContent('varo-female-creator').interpretationLimit,/preparatory drawing/);assert.doesNotMatch(getSymbolismContent('pearl-painted-fiction').text,/lover|maid|affair/);
});
test('Exact missing artworks or declared images make a note unavailable; no substitute is chosen for a requested ID',()=>{
  const round=make();assert.ok(round);const absent=works.filter(work=>work.id!==round.works[0].id);assert.equal(buildSymbolismRound({id:'missing',works:absent,contentId:'ambassadors-skull'}),null);assert.equal(buildSymbolismRound({id:'wrong-content',works,contentId:'not-a-note'}),null);
  const missingImage=works.map(work=>work.id===round.works[0].id?{...work,image:''}:work);assert.equal(buildSymbolismRound({id:'no-image',works:missingImage,contentId:'ambassadors-skull'}),null);
  for(const note of SYMBOLISM_CONTENT_BANK.filter(note=>!works.some(work=>work.id===note.workId)))assert.equal(buildSymbolismRound({id:'absent-'+note.id,works,contentId:note.id}),null);
  assert.deepEqual(availableSymbolismContent(absent).map(note=>note.workId).filter(id=>id===round.works[0].id),[]);
});
test('Source notes and original catalogue notes are frozen by value into the round and snapshot',()=>{
  const local=structuredClone(works),original=local.find(work=>work.id==='holbein-ambassadors').note,round=buildSymbolismRound({id:'frozen',works:local,contentId:'ambassadors-skull'}),snapshot=snapshotStudyRound(round),noteText=snapshot.contextNote.text;
  assert.equal(round.works[0].note,original);round.contextNote.text='Edited outside the captured question';round.works[0].note='Edited catalogue note';assert.equal(snapshot.contextNote.text,noteText);assert.equal(local.find(work=>work.id==='holbein-ambassadors').note,original);
  const restored=restoreStudyRound(snapshot,works);assert.ok(restored);assert.equal(restored.contextNote.text,noteText);assert.ok(validSymbolismDefinition(restored));assert.deepEqual(restored.contextPrompts,SYMBOLISM_PROMPTS);assert.deepEqual(restored.contextScale,SYMBOLISM_SCALE);
});
test('One criterion is used before and after; legacy answer shape remains valid without a second protocol field',()=>{
  const round=make(),answer=complete(round);assert.ok(validSymbolismDefinition(round));assert.ok(validSymbolismAnswer(round,answer));assert.ok(validAnswer(round,answer));assert.equal(round.criterion,'preference');assert.equal(round.contextPrompts.after,'How much does it appeal now?');
  assert.deepEqual(symbolismResult(round,answer),{roundId:round.id,workId:round.works[0].id,contentId:round.contextNote.id,contentRevision:round.contextNote.revision,before:25,after:75,change:50,beforeStep:2,afterStep:4,changeSteps:2,direction:'increased',detailKnown:null,changedWhat:null,sourceUrls:round.contextNote.sourceUrls});
});
test('A reveal requires a before response and fixes it for later steps, including restored drafts',()=>{
  const round=make();let draft=sanitizeSymbolismDraft(round);draft=reduceSymbolismDraft(round,draft,{type:'reveal'});assert.equal(draft.storySeen,false);draft=reduceSymbolismDraft(round,draft,{type:'rate-after',value:100});assert.equal(draft.after,undefined);
  draft=reduceSymbolismDraft(round,draft,{type:'rate-before',value:0});draft=reduceSymbolismDraft(round,draft,{type:'reveal'});assert.equal(draft.storySeen,true);assert.equal(draft.beforeLocked,0);draft=reduceSymbolismDraft(round,draft,{type:'rate-before',value:100});assert.equal(draft.before,0);
  draft=reduceSymbolismDraft(round,{...draft,before:100},{type:'rate-after',value:75});assert.equal(draft.before,0);assert.equal(draft.beforeLocked,0);assert.ok(validSymbolismAnswer(round,draft));
});
test('Skipped, partial, wrong-identity, wrong-scale and curiosity responses never become paired preference results',()=>{
  const round=make(),base=complete(round);
  for(const bad of [{...base,skipped:true},{...base,storySeen:false},{...base,before:undefined},{...base,after:80},{...base,before:'25'},{...base,workId:'green-tara'},{...base,workIds:['green-tara']},{...base,workIds:[base.workId,base.workId]},{...base,criterion:'interest'},{workId:base.workId,workIds:base.workIds,change:'more'},{...base,beforeLocked:0},{...base,symbolismProtocol:'future-scale'},{...base,contentId:'tara-protection'}]){assert.equal(validSymbolismAnswer(round,bad),false);assert.equal(symbolismResult(round,bad),null);}
});
test('Typed definition errors cannot silently fall back to legacy context validation',()=>{
  const round=make(),answer=complete(round);for(const mutate of [r=>r.symbolismProtocol='unknown-v2',r=>delete r.symbolismProtocol,r=>r.criterion='interest',r=>r.contextCriterion='curiosity-v1',r=>r.contextScale.values=[1,2,3,4,5],r=>r.contextScale.labels.reverse(),r=>r.contextNote.workId='green-tara',r=>r.contextNote.sourceUrls=['https://example.com/invented-source'],r=>r.contextNote.claims[0].sourceUrls=['https://example.com/claim'],r=>r.workIds=['green-tara']]){const bad=structuredClone(round);mutate(bad);assert.ok(isSymbolismRound(bad));assert.equal(validSymbolismDefinition(bad),false);assert.equal(validSymbolismAnswer(bad,answer),false);}
});
test('Negative, zero and full-range changes retain signed steps without treating them as percentages',()=>{
  const round=make();assert.equal(symbolismResult(round,complete(round,100,0)).changeSteps,-4);assert.equal(symbolismResult(round,complete(round,50,50)).changeSteps,0);assert.equal(symbolismResult(round,complete(round,0,100)).changeSteps,4);
});
test('Optional interpretation and detail familiarity describe reports, not required task completions',()=>{
  const round=make();let draft=reduceSymbolismDraft(round,complete(round,50,50),{type:'detail-known',value:'known'});draft=reduceSymbolismDraft(round,draft,{type:'changed-what',value:'interpretation-changed'});assert.ok(validSymbolismAnswer(round,draft));assert.equal(symbolismResult(round,draft).changedWhat,'interpretation-changed');assert.equal(symbolismResult(round,draft).detailKnown,'known');assert.equal(validSymbolismAnswer(round,{...draft,changedWhat:'I know the answer'}),false);
});
test('Selection prioritises explicitly requested or already ordinarily measured works, with no silent repeated stories',()=>{
  const first=selectSymbolismContent({works,preferredWorkIds:['green-tara']});assert.equal(first.content.workId,'green-tara');
  const round=make('planned-tara','tara-protection'),selection=selectSymbolismContent({works,rounds:[round],preferredWorkIds:['green-tara']});assert.notEqual(selection.content.id,round.contextNote.id);
  const all=availableSymbolismContent(works).map((note,index)=>make('used-'+index,note.id));assert.equal(selectSymbolismContent({works,rounds:all}).status,'unavailable');const returnSelection=selectSymbolismContent({works,rounds:all,allowRevisit:true});assert.equal(returnSelection.revisit,true);const returnRound=buildSymbolismRound({id:'return',works,contentId:returnSelection.content.id,rounds:all});assert.equal(returnRound.evidence.storyPreviouslyPlanned,true);assert.ok(returnRound.evidence.previousRevealRoundIds.length);
  const pref={id:'measured',kind:'spectrum',criterion:'preference',works:works.filter(work=>['green-tara','holbein-ambassadors'].includes(work.id)),evidence:{construct:'preference',family:'individual-choice'}},answer={workIds:pref.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(pref.works.map(work=>[work.id,50])),confirmed:true};assert.ok(['green-tara','holbein-ambassadors'].includes(selectSymbolismContent({works,rounds:[pref],answers:{measured:answer}}).content.workId));
});
