import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJourneyRounds,createJourneyStimulusPlan,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound} from '../../public/art-atlas/deep-study.mjs';
import {collectTastePatternSources} from '../../public/art-atlas/taste-axes.mjs';
import {isOverallAppealRound} from '../../public/art-atlas/appeal-scale.mjs';
import {legacyV8Rounds} from './helpers/legacy-v8.mjs';
import {legacyV11Rounds} from './helpers/legacy-v11.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const ids=round=>round.works.map(work=>work.id);
const fresh=prepareJourneySession(null,works,1000);
function oldBlock(data){
  const old=structuredClone(data),legacy=legacyV8Rounds(works),panel2=restoreStudyRound(old.plan[2],old.manifest.catalogue),panel14=restoreStudyRound(old.plan[44],old.manifest.catalogue);
  old.plan[1]=snapshotStudyRound(legacy[1]);old.plan[2]=snapshotStudyRound(legacy[2]);old.plan[8]=snapshotStudyRound(legacy[8]);
  old.plan[5]=snapshotStudyRound({...panel2,id:'journey-006',evidence:{...panel2.evidence,pairedRoundIds:[],priorMeasureRoundIds:[]}});
  old.plan[44]=snapshotStudyRound({id:'journey-045',kind:'spectrum',criterion:'preference',title:'How much are you looking at how it was made?',hint:'Think about paint, marks, lines and composition.',scale:{left:'Little attention to its making',right:'A lot of attention to its making'},works:panel14.works,evidence:{...panel14.evidence,construct:'attention-to-making',family:'looking-appraisal',role:'check'}});
  old.manifest.journeyRevision='art-profile-50-v10';for(const round of old.plan)round.evidence.journeyRevision='art-profile-50-v10';return old;
}

test('Captured v11 retains its eighteen overall-rating quartets and five exact matched admiration maps',()=>{
  const rounds=legacyV11Rounds(),preferences=rounds.filter(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber),maps=rounds.filter(round=>round.kind==='grid'&&round.axis==='achievement');
  assert.ok(rounds.every(round=>round.evidence.journeyRevision==='art-profile-50-v11'));assert.equal(rounds.length,50);assert.equal(preferences.length,18);assert.equal(new Set(preferences.flatMap(ids)).size,72);assert.equal(new Set(preferences.flatMap(ids)).size,preferences.flatMap(ids).length);assert.ok(preferences.every(isOverallAppealRound));
  assert.deepEqual(maps.map(round=>round.id),['journey-004','journey-006','journey-021','journey-034','journey-045']);assert.equal(new Set(maps.flatMap(ids)).size,20);
  for(const map of maps){const preference=preferences.find(source=>source.evidence.panelNumber===map.evidence.panelNumber);assert.ok(preference);assert.ok(rounds.indexOf(preference)<rounds.indexOf(map));assert.deepEqual(new Set(ids(map)),new Set(ids(preference)));assert.equal(map.evidence.setId,preference.evidence.setId);assert.ok(map.evidence.priorMeasureRoundIds.includes(preference.id));}
  assert.ok(rounds.slice(45).every(round=>round.evidence.finalRefinement&&round.unavailable));assert.equal(rounds.filter(round=>round.evidence.construct==='attention-to-making').length,0);
  assert.equal(ids(rounds[1]).includes('study-vermeer-pearl'),false);assert.equal(ids(rounds[1]).includes('add-van-eyck-arnolfini'),true);assert.ok(!ids(rounds[1]).some(id=>ids(rounds[2]).includes(id)));
});

test('Admiration coverage reports actual valid20/16/12 works rather than promising the current schedule to old responses',()=>{
  const rounds=sessionJourneyRounds(fresh),maps=rounds.filter(round=>round.kind==='grid'&&round.axis==='achievement'),answer=round=>({workIds:ids(round),axis:round.axis,points:Object.fromEntries(round.works.map(work=>[work.id,[50,75]])),confirmed:true});
  for(const count of [5,4,3]){const answers=Object.fromEntries(maps.slice(0,count).map(round=>[round.id,answer(round)])),sources=collectTastePatternSources({works,rounds,answers});assert.equal(sources.admiration.workCount,count*4);assert.equal(sources.admiration.sets.length,count);}
  const legacy=legacyV8Rounds(works),oldMaps=legacy.filter(round=>round.kind==='grid'&&round.axis==='achievement'),old=collectTastePatternSources({works,rounds:legacy,answers:Object.fromEntries(oldMaps.map(round=>[round.id,answer(round)]))});assert.equal(old.admiration.workCount,12);
});

test('An enteredv10 block preserves every pending instrument, definition and answer while the new code revision advances',()=>{
  for(const marker of ['shown','null-answer','skip']){
    const data=oldBlock(fresh),round=data.plan[2];if(marker==='shown')data.shown[round.id]=structuredClone(round);else data.answers[round.id]=marker==='skip'?{workIds:[...round.workIds],skipped:true}:null;
    const before=structuredClone(data),updated=prepareJourneySession(data,works,2000),rounds=sessionJourneyRounds(updated);assert.deepEqual(data,before);assert.deepEqual(updated.plan,before.plan);assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.equal(updated.manifest.journeyRevision,JOURNEY_REVISION);assert.equal(restoreStudyRound(updated.plan[2],updated.manifest.catalogue).kind,'choice-grid');if(marker==='skip')assert.equal(rounds[2].unavailable,true);else assert.equal(rounds[2].kind,'choice-grid');assert.equal(rounds[5].kind,'spectrum');assert.equal(rounds[5].evidence.construct,'preference');assert.equal(rounds[44].evidence.construct,'attention-to-making');assert.equal(rounds.filter(round=>round.kind==='grid'&&round.axis==='achievement').length,3);assert.match(updated.planRevisions.at(-1).batchNotes[0].reason,/already been started/);assert.deepEqual(updated.planRevisions.at(-1).previousUnshown,[]);assert.deepEqual(prepareJourneySession(updated,works,3000),updated);
  }
});

test('An entirely unstartedv10 block may refresh, retaining the previous plan for review',()=>{
  const data=oldBlock(fresh),before=structuredClone(data),updated=prepareJourneySession(data,works,2000),rounds=sessionJourneyRounds(updated);
  assert.deepEqual(data,before);assert.deepEqual(updated.answers,{});assert.deepEqual(updated.shown,{});assert.equal(rounds[2].kind,'spectrum');assert.equal(rounds[5].axis,'achievement');assert.equal(rounds[44].axis,'achievement');assert.equal(rounds.filter(round=>round.kind==='grid'&&round.axis==='achievement').length,5);assert.deepEqual(updated.planRevisions.at(-1).previousUnshown,before.plan);assert.equal(updated.planRevisions.at(-1).batchNotes[0].status,'refreshed');assert.deepEqual(updated.manifest.catalogue,before.manifest.catalogue);
});

test('A fresh later block may update without changing the started historical block or saved adaptive identities',()=>{
  const data=oldBlock(fresh),first=restoreStudyRound(data.plan[0],data.manifest.catalogue);data.shown[first.id]=snapshotStudyRound(first);
  const selection=createJourneyStimulusPlan({works,batchIndex:1,seed:'unstarted-later-v11'}),block=buildJourneyRounds(works,{}, {batchIndex:1,offset:50,seed:'unstarted-later-v11',panels:selection});
  data.plan.push(...block.map(round=>{const snapshot=snapshotStudyRound(round);snapshot.evidence.journeyRevision='art-profile-50-v10';return snapshot;}));data.batches=[{index:1,offset:50,selection}];const before=structuredClone(data),updated=prepareJourneySession(data,works,2000);
  assert.deepEqual(updated.plan.slice(0,50),before.plan.slice(0,50));assert.deepEqual(updated.shown,before.shown);assert.deepEqual(updated.answers,before.answers);assert.deepEqual(updated.batches,before.batches);assert.equal(updated.planRevisions.at(-1).batchNotes.find(note=>note.offset===0).status,'preserved');assert.equal(updated.planRevisions.at(-1).batchNotes.find(note=>note.offset===50).status,'refreshed');
  for(const panel of updated.plan.slice(50).filter(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber))assert.deepEqual(new Set(panel.workIds),new Set(selection.panels[panel.evidence.panelNumber-1].workIds));
});
