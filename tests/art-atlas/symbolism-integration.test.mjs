import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import {buildSymbolismRound,validSymbolismDefinition} from '../../public/art-atlas/symbolism-rounds.mjs';
import {validAnswer,sanitizeDraft} from '../../public/art-atlas/engine.mjs';
import {snapshotStudyRound,restoreStudyRound} from '../../public/art-atlas/deep-study.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {renderTastePortrait} from '../../public/art-atlas/taste-portrait-view.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url)));
const answer=(round,before,after)=>({workIds:[round.works[0].id],workId:round.works[0].id,before,after,storySeen:true});

test('Three sourced symbolism exercises occupy distinct slots and preserve the prospective claim link',()=>{
  const rounds=buildJourneyRounds(works),notes=rounds.filter(round=>round.symbolismProtocol);
  assert.deepEqual(notes.map(round=>round.id),['journey-035','journey-040','journey-048']);
  assert.equal(new Set(notes.map(round=>round.works[0].id)).size,3);
  for(const round of notes){assert.ok(validSymbolismDefinition(round));assert.equal(round.bankRoundId,undefined);assert.ok(round.evidence.newInstrument);}
  assert.equal(notes[0].evidence.claimRoundId,rounds[30].id);
  assert.equal(rounds[30].evidence.contextRoundId,notes[0].id);
  if(works.some(work=>work.id==='add-watts-hope'))assert.equal(notes[0].works[0].id,'add-watts-hope');
});

test('Malformed typed context cannot fall through to a generic before/after reading',()=>{
  const round=buildSymbolismRound({id:'bad',works,contentId:'ambassadors-skull'});delete round.symbolismProtocol;
  const input={works,rounds:[round],answers:{bad:answer(round,25,100)}},portrait=buildTastePortrait(input);
  assert.equal(validAnswer(round,input.answers.bad),false);
  assert.equal(restoreStudyRound(snapshotStudyRound(round),works),null);
  assert.equal(portrait.coverage.validRounds,0);assert.equal(portrait.symbolism.responses.length,0);assert.deepEqual(portrait.contextRatings,[]);
});

test('An unfinished typed reveal preserves its locked baseline across sanitising and snapshot restore',()=>{
  const round=buildSymbolismRound({id:'saved',works,contentId:'ambassadors-skull'}),snapshot=snapshotStudyRound(round),draft={...answer(round,0,75),beforeLocked:0};
  const restored=restoreStudyRound(snapshot,works),retained=sanitizeDraft(restored,draft);
  assert.equal(retained.before,0);assert.equal(retained.beforeLocked,0);assert.equal(retained.after,75);assert.ok(validAnswer(restored,retained));
  round.contextNote.text='A later editorial change';assert.notEqual(restored.contextNote.text,round.contextNote.text);
});

test('The profile shows each observed before/after pair without adding a duplicate generic context reading',()=>{
  const a=buildSymbolismRound({id:'a',works,contentId:'ambassadors-skull'}),b=buildSymbolismRound({id:'b',works,contentId:'tara-protection'}),rounds=[a,b],answers={a:answer(a,25,75),b:answer(b,75,25)},portrait=buildTastePortrait({works,rounds,answers});
  assert.deepEqual([portrait.symbolism.summary.increased,portrait.symbolism.summary.decreased],[1,1]);assert.deepEqual(portrait.contextRatings,[]);
  assert.ok(portrait.observations.some(item=>item.module==='symbolism'));assert.ok(!portrait.observations.some(item=>item.module==='context-note'));
  const html=renderTastePortrait({portrait,works,rounds,answers,image:work=>`<img data-work="${work.id}">`,esc:value=>String(value??'')});
  assert.match(html,/id="profile-symbolism"/);assert.match(html,/Before: 2 of 5/);assert.match(html,/After: 4 of 5/);assert.ok(!portrait.observations.some(item=>item.module==='personality'));
  assert.match(html,/The note you read/);assert.ok(html.includes(a.contextNote.text));assert.ok(html.includes(b.contextNote.text));
});
