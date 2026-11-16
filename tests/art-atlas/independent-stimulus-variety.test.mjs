import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJourneyRounds,JOURNEY_REVISION,JOURNEY_VARIETY_POLICY} from '../../public/art-atlas/journey-bank.mjs';
import {recognitionTier} from '../../public/art-atlas/curation-priority.mjs';
import {auditTrajectory,questionIds,ordinary,works} from './helpers/repetition-audit.mjs';

const same=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());
const baselineBySeed={
  'reviewed-variety-v5-0':{distinctIndependent:81,peakIndependent:4},
  'editorial-release-audit':{distinctIndependent:83,peakIndependent:4},
  'independent-underuse-audit':{distinctIndependent:83,peakIndependent:4}
};
let paths;
const trajectories=()=>paths||=Object.keys(baselineBySeed).map(seed=>({seed,...auditTrajectory(seed)}));

test('Three complete trajectories use independent slots more broadly while retaining the fresh72/46/46 preference route',()=>{
  for(const {seed,metrics,blocks} of trajectories()){
    assert.deepEqual(metrics.map(row=>row.firstRatings),[72,46,46]);
    assert.equal(metrics[1].independentSlots,88);assert.equal(metrics[1].distinctIndependent,88);
    const final=metrics[2];assert.equal(final.independentSlots,132);assert.ok(final.distinctIndependent>=100);assert.ok(final.distinctIndependent>baselineBySeed[seed].distinctIndependent);assert.ok(final.peakIndependent<baselineBySeed[seed].peakIndependent);assert.equal(final.near3Independent,0);
    assert.equal(final.distinctSpecific,works.length);
    for(const {rounds} of blocks)for(const round of rounds.filter(round=>round.kind==='match')){
      assert.equal(new Set(round.works.map(work=>work[round.field])).size,4,'Broader selection must retain four distinct answer labels');
      assert.ok(round.works.every(work=>round.field!=='artist'||work.artistKnown!==false));
    }
  }
});

test('Exact returns and matched follow-ups preserve the actual prompt, source set and deliberate dependency',()=>{
  for(const {rounds} of trajectories()){
    const byId=new Map(rounds.map(round=>[round.id,round]));
    for(const round of rounds.filter(round=>round.evidence?.exactRepeat)){
      const source=byId.get(round.evidence.repeatOf);assert.ok(source);same(questionIds(round),questionIds(source));assert.equal(round.title,source.title);assert.equal(round.hint,source.hint);assert.deepEqual(round.scale,source.scale);assert.ok(rounds.indexOf(round)>rounds.indexOf(source));
    }
    for(const round of rounds.filter(round=>round.kind==='grid'||round.evidence?.family==='looking-appraisal')){
      const source=rounds.find(other=>ordinary(other)&&other.evidence.batchIndex===round.evidence.batchIndex&&other.evidence.panelNumber===round.evidence.panelNumber);
      if(source)same(questionIds(round),questionIds(source));
    }
    for(let start=0;start<rounds.length;start+=50){
      same(questionIds(rounds[start+1]),questionIds(rounds[start+8]));same(questionIds(rounds[start+10]),questionIds(rounds[start+22]));
    }
  }
});

test('Heavy prior landmark use cannot exclude less-used eligible paintings from independent questions',()=>{
  const landmarks=works.filter(work=>recognitionTier(work)==='landmark'),history=Array.from({length:12},(_,i)=>({id:'prior-source-'+i,kind:'context',works:landmarks,evidence:{construct:'source-exposure'}}));
  const rounds=buildJourneyRounds(works,{}, {seed:'underuse-over-tier',history});
  const independent=rounds.filter(round=>!round.unavailable&&['choice-grid','match'].includes(round.kind)&&!round.evidence.finalRefinement&&!round.evidence.varietySelection?.fixedFirstFamiliarity&&!round.evidence.varietySelection?.reusedCachedIdentity);
  assert.ok(independent.length>=3);
  for(const round of independent){
    assert.ok(round.works.every(work=>recognitionTier(work)!=='landmark'),'Recognition-tier quotas must not force paintings with twelve earlier presentations');
    assert.equal(round.evidence.varietyPolicy,JOURNEY_VARIETY_POLICY);assert.equal(round.evidence.varietySelection.coveragePriority,'least-cumulative-specific-appearances');
  }
});

test('A shownv8 panel and its subsequent matched set stay fixed under thev9 selector',()=>{
  const current=buildJourneyRounds(works,{}, {seed:'saved-v8-binding'}),source=structuredClone(current.find(round=>ordinary(round)&&round.evidence.panelNumber===9));
  source.title='The original saved preference prompt.';source.hint='The original saved hint.';source.works=works.slice(-4).map(work=>({...structuredClone(work),title:'Saved '+work.title}));source.evidence.journeyRevision='art-profile-50-v8';
  const before=structuredClone(source),rebuilt=buildJourneyRounds(works,{}, {seed:'saved-v8-binding',history:[source]});
  assert.deepEqual(rebuilt.find(round=>round.id===source.id),source);assert.deepEqual(source,before);
  const followup=rebuilt.find(round=>round.kind==='grid'&&round.evidence.panelNumber===9);assert.ok(followup);same(questionIds(followup),questionIds(source));assert.equal(followup.evidence.journeyRevision,JOURNEY_REVISION);
});
