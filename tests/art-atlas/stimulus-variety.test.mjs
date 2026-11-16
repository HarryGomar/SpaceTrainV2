import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJourneyRounds as buildCurrentJourneyRounds,createJourneyStimulusPlan,journeyCurationNotes,JOURNEY_REVISION,JOURNEY_VARIETY_POLICY} from '../../public/art-atlas/journey-bank.mjs';
import {selectArrangementStimuli} from '../../public/art-atlas/arrangement-stimuli.mjs';
import {APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
// This regression route deliberately preserves the earlier overall instrument.
// Fresh comparison-first scheduling is covered separately by journey-v12.
const buildJourneyRounds=(works,answers={},options={})=>buildCurrentJourneyRounds(works,answers,{...options,preferenceProtocol:APPEAL_PROTOCOL});

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).slice(0,164);
const notes=journeyCurationNotes(works);
const byId=new Map(works.map(work=>[work.id,work]));
const seed='reviewed-variety-v5-0';
const ids=round=>round.works.map(work=>work.id);
const allIds=round=>[...new Set([...ids(round),...(round.anchorWorks||[]).map(work=>work.id),...(round.anchorIds||[])])];
const same=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());
const ordinary=round=>round.kind==='spectrum'&&round.criterion==='preference'&&round.evidence.construct==='preference'&&round.evidence.unconditional!==false;
const specific=round=>!round.unavailable&&round.kind!=='statements'&&round.evidence.stimulusVisibility!=='not-shown'&&!(round.kind==='exercise'&&!['sorting','difficult-edit','edit'].includes(round.exerciseKind));
const fresh=()=>buildJourneyRounds(works,{}, {seed});

test('The historical overall-instrument variety policy preserves all18 curated main panels and the fixed50-round schedule',()=>{
  const rounds=fresh(),main=rounds.filter(round=>ordinary(round)&&Number.isInteger(round.evidence.panelNumber));
  assert.equal(rounds.length,50);assert.equal(main.length,18);assert.equal(new Set(main.flatMap(ids)).size,72);
  for(const p of notes.proposedFirst18Panels)same(ids(main.find(round=>round.evidence.panelNumber===p.panel)),p.workIds);
  assert.equal(rounds[30].kind,'statements');assert.equal(rounds[34].kind,'context');assert.equal(rounds[34].evidence.claimRoundId,rounds[30].id);
  assert.deepEqual(rounds.flatMap((round,i)=>round.kind==='contrast'?[[i+1,round.contrastKind]]:[]),[[15,'chronology'],[19,'neighbour'],[27,'keep-leave'],[42,'same-subject']]);
  assert.ok(main.every(round=>round.evidence.journeyRevision===JOURNEY_REVISION));assert.equal(JOURNEY_VARIETY_POLICY,'specific-question-variety-v2');
});

test('SortingA uses Calligraphy Party without duplicating a later rotation',()=>{
  const first=selectArrangementStimuli({works,batchIndex:0,kind:'sorting'});
  assert.ok(first.workIds.includes('calligraphy-party'));assert.ok(!first.workIds.includes('study-posada-catrina'));
  const rotations=Array.from({length:4},(_,batchIndex)=>selectArrangementStimuli({works,batchIndex,kind:'sorting'}));
  assert.equal(new Set(rotations.flatMap(row=>row.workIds)).size,32);
  assert.equal(rotations.filter(row=>row.workIds.includes('calligraphy-party')).length,1);
  const rounds=fresh();assert.deepEqual(ids(rounds[7]),ids(rounds[31]));assert.equal(rounds[31].evidence.repeatOf,rounds[7].id);
});

test('The first familiarity uses Wanderer while its paired shortlist retains exactly the same12 identities',()=>{
  const rounds=fresh(),a=rounds[1],pairedA=rounds[8],b=rounds[10],pairedB=rounds[22];
  assert.equal(a.works.length,12);assert.ok(ids(a).includes('friedrich-wanderer'));assert.ok(!ids(a).includes('study-van-gogh-sunflowers'));
  assert.ok(a.works.every(work=>work.recognitionTier==='landmark'));
  same(ids(a),ids(pairedA));same(ids(b),ids(pairedB));
  assert.equal(pairedA.evidence.familiarityRoundId,a.id);assert.equal(pairedB.evidence.familiarityRoundId,b.id);
  assert.ok(!ids(b).includes('friedrich-wanderer'));
  for(const neighbour of [rounds[9],rounds[11],rounds[21],rounds[23]])assert.ok(!ids(b).some(id=>allIds(neighbour).includes(id)));
});

test('Fresh grids and matching avoid their known independent neighbours when the99-work catalogue permits it',()=>{
  for(const trialSeed of [seed,'variety-second-seed','variety-third-seed']){
    const rounds=buildJourneyRounds(works,{}, {seed:trialSeed});
    for(const round of rounds.filter(round=>!round.unavailable&&['choice-grid','match'].includes(round.kind)&&!round.evidence.finalRefinement)){
      assert.equal(round.evidence.varietyPolicy,JOURNEY_VARIETY_POLICY);
      const audit=round.evidence.varietySelection;
      if(!audit.preservedCachedBinding){assert.equal(audit.fallback,false);assert.deepEqual(audit.selectedAvoidedIds,[]);}
      for(const id of ids(round))assert.ok(!audit.avoidWorkIds?.includes(id));
    }
  }
});

test('Already bound wording, source metadata, grid identities and old limits remain byte-for-byte equivalent',()=>{
  const current=fresh(),oldIds=ids(current[1]).map(id=>id==='friedrich-wanderer'?'study-van-gogh-sunflowers':id);
  const oldFamiliarity={...structuredClone(current[1]),title:'The familiarity question already shown.',works:oldIds.map(id=>({...structuredClone(byId.get(id)),title:'Saved '+byId.get(id).title})),evidence:{...current[1].evidence,journeyRevision:'art-profile-50-v5'}};
  delete oldFamiliarity.evidence.varietySelection;delete oldFamiliarity.evidence.varietyPolicy;
  const oldShortlist={...structuredClone(current[8]),title:'The old three-work shortlist.',hint:'Choose up to three.',maxChoices:3,works:[...oldFamiliarity.works].reverse(),evidence:{...current[8].evidence,journeyRevision:'art-profile-50-v5'}};
  delete oldShortlist.evidence.varietySelection;delete oldShortlist.evidence.varietyPolicy;
  const history=[structuredClone(current[0]),oldFamiliarity,oldShortlist,structuredClone(current[16]),structuredClone(current[23])],before=structuredClone(history);
  const rebuilt=buildJourneyRounds(works,{}, {seed,history});
  for(const saved of history)assert.deepEqual(rebuilt.find(round=>round.id===saved.id),saved);
  assert.deepEqual(history,before);
  const linked=buildJourneyRounds(works,{}, {seed,history:[oldFamiliarity]})[8];
  same(ids(linked),oldIds);assert.equal(linked.evidence.varietySelection.preservedCachedBinding,true);
});

test('An earlier museum offering99 changes no grid/match usage count or selected identity',()=>{
  const first=fresh(),museum={id:'earlier-museum-offering',kind:'exercise',exerciseKind:'curate',works,evidence:{construct:'curate'}};
  const withMuseum=buildJourneyRounds(works,{}, {seed,history:[museum]});
  for(const round of first.filter(round=>!round.unavailable&&['choice-grid','match'].includes(round.kind)&&!round.evidence.finalRefinement)){
    const other=withMuseum.find(row=>row.id===round.id);assert.deepEqual(ids(other),ids(round));
    assert.deepEqual(other.evidence.varietySelection.plannedUseCountsBefore,round.evidence.varietySelection.plannedUseCountsBefore);
  }
});

test('A small eligible catalogue reports spacing fallback and counts prior specific scenes without counting its museum tray',()=>{
  const needed=['velasco-valley-mexico','shen-clouds','hokusai-mount-fuji','hiroshige-sudden-shower','monet-water-lilies','cassatt-omnibus','klee-tightrope','klee-carnival','redon-violette','cezanne-mountain','mondrian-composition','rousseau-tiger-buffalo'];
  const pool=needed.map(id=>byId.get(id)),rounds=buildJourneyRounds(pool,{}, {seed:'small-variety'}),counts=new Map();
  assert.ok(rounds.some(round=>round.evidence.varietySelection?.fallback));
  for(const round of rounds){
    const audit=round.evidence.varietySelection;
    if(audit&&!audit.reusedCachedIdentity&&!audit.preservedCachedBinding){
      for(const id of ids(round))assert.equal(audit.plannedUseCountsBefore[id],counts.get(id)||0);
      if(audit.fallback){assert.ok(audit.fallbackReason);assert.ok(audit.selectedAvoidedIds.length);}
    }
    if(specific(round))for(const id of allIds(round))counts.set(id,(counts.get(id)||0)+1);
  }
});

test('Protected adaptive panel sets and frozen repeat prompts survive the independent grid/match policy',()=>{
  const first=fresh(),answers=Object.fromEntries(first.filter(ordinary).map(round=>[round.id,{workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.energy*100)])),confirmed:true}]));
  const selection=createJourneyStimulusPlan({works,rounds:first,answers,batchIndex:1,seed:'variety-protected',reservationPlan:notes.reservePools}),before=structuredClone(selection);
  assert.equal(selection.complete,true);assert.equal(selection.coverage.firstRatingWorkIds.length,46);same(selection.coverage.firstRatingWorkIds,notes.reservePools.batch2);
  const second=buildJourneyRounds(works,answers,{offset:50,batchIndex:1,seed:'variety-protected',history:first,panels:selection,reservationPlan:notes.reservePools});
  for(const [index,panel] of selection.panels.entries()){
    const bound=second.find(round=>ordinary(round)&&round.evidence.panelNumber===index+1);same(ids(bound),panel.workIds);
    if(panel.role==='repeat'){const original=first.find(round=>round.id===panel.repeatOf);assert.equal(bound.title,original.title);assert.equal(bound.hint,original.hint);assert.deepEqual(bound.scale,original.scale);}
  }
  assert.deepEqual(selection,before);
});

test('Same-seed first50 variety improves the audited peak while keeping deliberate returns',()=>{
  const rounds=fresh(),counts=new Map(),adjacent=[];
  for(const round of rounds)if(specific(round))for(const id of allIds(round))counts.set(id,(counts.get(id)||0)+1);
  for(let i=1;i<rounds.length;i++)if(specific(rounds[i-1])&&specific(rounds[i])){const overlap=allIds(rounds[i-1]).filter(id=>allIds(rounds[i]).includes(id));if(overlap.length)adjacent.push([rounds[i-1].id,rounds[i].id,overlap]);}
  assert.ok([...counts.values()].reduce((a,b)=>a+b,0)>200);assert.ok(counts.size>=83);assert.ok(Math.max(...counts.values())<=8);
  assert.equal(rounds.filter(round=>round.kind==='grid'&&round.axis==='achievement').length,5,'The smaller independent budget supplies five matched admiration questions');
  // Sorting deliberately links the preceding constructed still lifes to the
  // grouping task. KeepA retains its six genuine opening pair opportunities;
  // its fixed reviewed set also contains the just-rated Mondrian.
  assert.deepEqual(adjacent,[['journey-007','journey-008',['add-tamayo-still-life-foot','blanchard-still-life']],['journey-026','journey-027',['mondrian-composition']]]);assert.equal(rounds[26].evidence.baselineLinkPlan.linkedPairCount,6);
  assert.ok(rounds.slice(45).every(round=>round.unavailable&&round.evidence.finalRefinement.binding==='deferred'),'Closing definitions must wait for real earlier answers');
  assert.deepEqual(new Set(ids(rounds[3])),new Set(ids(rounds[0])));
});
