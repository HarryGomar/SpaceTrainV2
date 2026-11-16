import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {isOverallAppealRound} from '../../public/art-atlas/appeal-scale.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const ids=round=>round.works.map(work=>work.id);
const positions=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,index)=>[work.id,values[index]]))});

test('Entering each closing question binds actual earlier answers and freezes its resolved source chain',()=>{
  const data=prepareJourneySession(null,works,1000),originalPlan=structuredClone(data.plan),captured=[];
  for(let index=0;index<45;index++){
    data.index=index;const round=sessionJourneyRounds(data)[index];assert.equal(round.unavailable,undefined,round.id);data.shown[round.id]=snapshotStudyRound(round);
    data.answers[round.id]=isOverallAppealRound(round)?positions(round,round.evidence.panelNumber===2?[2,12,22,32]:[58,71,84,97]):{workIds:ids(round),skipped:true};
    if(!data.answers[round.id].skipped)assert(validStudyAnswer(round,data.answers[round.id]),round.id);
  }
  const priorShown=structuredClone(data.shown),priorAnswers=structuredClone(data.answers);
  for(let index=45;index<50;index++){
    data.index=index;const round=sessionJourneyRounds(data)[index];assert.equal(round.unavailable,undefined,round.id);assert.equal(round.evidence.finalRefinement.binding,'bound');
    for(const id of round.evidence.finalRefinement.sourceRoundIds||round.evidence.finalRefinement.candidateSourceRoundIds||[]){assert(data.shown[id],id+' was not actually shown');assert(data.answers[id]?.confirmed,id+' lacks confirmation');assert(Number(id.slice(8))<index+1);}
    for(const h of round.evidence.finalRefinement.hypotheses||[])for(const snapshot of h.trainingEvidence){assert(data.shown[snapshot.roundId]);assert.deepEqual(snapshot.positions,data.answers[snapshot.roundId].positions);assert(Number(snapshot.roundId.slice(8))<index+1);}
    data.shown[round.id]=snapshotStudyRound(round);captured.push(snapshotStudyRound(round));
    data.answers[round.id]=round.kind==='choice-grid'?{confirmed:true,workIds:ids(round),presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0},selectionMode:'shortlist',selectedIds:ids(round).slice(0,5),explicitNone:false,unsure:false}:positions(round,[14,42,73,96]);assert(validStudyAnswer(round,data.answers[round.id]));
    const now=sessionJourneyRounds(data);for(const earlier of captured)assert.deepEqual(snapshotStudyRound(now.find(item=>item.id===earlier.id)),earlier,'A later answer must not refresh an entered definition');
  }
  assert.deepEqual(data.plan,originalPlan,'Deferred plan remains a proposal; entered snapshots own the actual definitions');
  for(const [id,snapshot] of Object.entries(priorShown))assert.deepEqual(data.shown[id],snapshot);for(const [id,answer] of Object.entries(priorAnswers))assert.deepEqual(data.answers[id],answer);
  const final=sessionJourneyRounds(data),repeat=final[49],source=final.find(round=>round.id===repeat.evidence.repeatOf);assert(source);assert.equal(repeat.evidence.exactRepeat,true);assert.equal(repeat.title,source.title);assert.equal(repeat.hint,source.hint);assert.deepEqual(repeat.scale,source.scale);assert.deepEqual(ids(repeat),[...ids(source)].reverse());assert(isOverallAppealRound(repeat));
  assert.equal(final[45].maxChoices,5);assert.equal(final[45].evidence.construct,'overall-favourites');assert.equal(final[45].works.length,72);assert(final[47].evidence.finalRefinement.sourceRoundIds.includes('journey-047'),'The next definition must see the actual completed cross-set answer');
});
