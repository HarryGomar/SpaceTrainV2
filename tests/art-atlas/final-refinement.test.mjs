import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFinalRefinementRounds,bindFinalRefinementRound,isFinalRefinementRound} from '../../public/art-atlas/final-refinement.mjs';
import {APPEAL_PROTOCOL,isOverallAppealRound,withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {summarizePreferenceHypotheses,planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {buildJourneyRounds,createJourneyStimulusPlan,journeyAdaptiveQuotas,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).slice(0,164);
const ids=round=>round.works.map(work=>work.id),sig=values=>JSON.stringify([...values].sort());
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,index)=>[work.id,values[index]]))});
const source=(offered,index,values=[10,40,70,100],overall=true)=>{const round={id:'journey-'+String(index+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place the paintings by preference.',scale:{left:'Less preferred',right:'More preferred'},works:offered,evidence:{construct:'preference',family:'individual-choice',role:'discovery',panelNumber:index+2,setId:'source-'+index,journeyRevision:overall?'art-profile-50-v10':'art-profile-50-v9'}};const r=overall?withOverallAppeal(round):round;return {round:r,answer:answer(r,values)};};
function fixture(){const history=[],answers={};for(let i=0;i<8;i++){const item=source(works.slice(i*4,i*4+4),i,i<2?[5+i,15+i,25+i,35+i]:[55+i,65+i,75+i,85+i]);history.push(item.round);answers[item.round.id]=item.answer;}for(let i=8;i<45;i++)history.push({id:'journey-'+String(i+1).padStart(3,'0'),kind:'statements',title:'Shown text',hint:'',works:[works[40]],evidence:{stimulusVisibility:'not-shown'}});return {history,answers,templates:buildFinalRefinementRounds({works,seed:'final-regression'})};}

test('The fresh164 journey uses18 appeal quartets,3 Caravaggios, Mexico and deferred closing questions',()=>{
  const plan=createJourneyStimulusPlan({works}),rounds=buildJourneyRounds(works,{}, {panels:plan}),main=rounds.filter(r=>r.evidence.panelNumber&&r.evidence.construct==='preference');
  assert.equal(JOURNEY_REVISION,'art-profile-50-v11');assert(plan.complete);assert.equal(main.length,18);assert.equal(new Set(main.flatMap(ids)).size,72);assert(main.every(isOverallAppealRound));assert.deepEqual([plan.reservations.batch2.length,plan.reservations.batch3.length],[46,46]);
  const chosen=new Set(main.flatMap(ids));for(const id of ['add-caravaggio-judith-barberini','add-caravaggio-supper-emmaus-1601','add-caravaggio-taking-christ','add-siqueiros-madre-nina','add-varo-harmony','add-carrington-dagobert','add-kahlo-borderline'])assert(chosen.has(id),id);
  assert.deepEqual(rounds.slice(-5).map(r=>r.evidence.finalRefinement.slot),[1,2,3,4,5]);assert(rounds.slice(-5).every(r=>isFinalRefinementRound(r)&&r.unavailable));
  assert.equal(rounds[24].kind,'context');assert.equal(rounds[31].evidence.repeatOf,rounds[7].id);assert.equal(rounds[42].axis,'reading');assert.equal(rounds[44].axis,'achievement');
  const earlier=new Set(rounds.slice(0,7).filter(r=>r.evidence.construct==='preference').flatMap(ids));assert(rounds[7].works.every(w=>earlier.has(w.id)));for(const id of ['blanchard-still-life','add-tamayo-still-life-foot','add-rivera-portrait-frida'])assert(ids(rounds[7]).includes(id));assert.equal(rounds[7].evidence.arrangementSelection.revision,'earlier-appeal-sorting-v1');assert.equal(sig(ids(rounds[31])),sig(ids(rounds[7])));assert(ids(rounds[9]).includes('add-siqueiros-madre-nina'));
});

test('Favourite candidates retain all earlier overall appeal works, sorted without sacrificing a favourite for a repeat',()=>{
  const f=fixture(),before=structuredClone(f),round=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers});
  assert.equal(round.unavailable,undefined);assert.equal(round.works.length,32);assert.equal(round.maxChoices,5);assert(round.evidence.explicitFavourites);const expected=f.history.filter(r=>isOverallAppealRound(r)).flatMap(r=>ids(r).map(id=>({id,value:f.answers[r.id].positions[id]}))).sort((a,b)=>b.value-a.value);assert.deepEqual(new Set(ids(round)),new Set(expected.map(item=>item.id)));assert.deepEqual(round.evidence.finalRefinement.candidateRatings.map(item=>item.value),[...expected].map(item=>item.value));
  assert.equal(Math.min(...round.evidence.finalRefinement.candidateRatings.map(r=>r.value)),Math.min(...expected.map(r=>r.value)));for(const item of round.evidence.finalRefinement.candidateRatings)assert.equal(item.value,f.answers[item.roundId].positions[item.workId]);
  const reserved=round.evidence.finalRefinement.repeatReservation;assert(reserved);assert(reserved.workIds.every(id=>!ids(round).slice(0,18).includes(id)));assert(reserved.workIds.every(id=>ids(round).includes(id)),'Reserved paintings remain selectable on later pages');assert.equal(round.evidence.instrumentRevision,'paged-favourites-v1');assert.deepEqual(f,before);
});

test('Unconfirmed, partial, wrong-identity, contextual, legacy-only and future answers cannot bind favourites',()=>{
  for(const mutate of [f=>Object.values(f.answers).forEach(a=>a.confirmed=false),f=>Object.values(f.answers).forEach(a=>delete a.positions[a.workIds[0]]),f=>Object.values(f.answers).forEach(a=>a.workIds.reverse()),f=>f.history.forEach(r=>r.evidence.family='contextual-choice'),f=>f.history.forEach(r=>{delete r.evidence.appealProtocol;delete r.evidence.measurementScope;}),f=>f.history.forEach(r=>r.id='journey-099')]){
    const f=fixture();mutate(f);const round=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers});assert.equal(round.unavailable,true);assert(round.unavailableReason);assert.equal(round.evidence.finalRefinement.binding,'unavailable');
  }
});

test('Explicit None remains a real favourite response and does not invent selected favourites',()=>{
  const f=fixture(),grid=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers});f.history.push(grid);f.answers[grid.id]={confirmed:true,workIds:ids(grid),presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0},selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false};assert(validAnswer(grid,f.answers[grid.id]));
  const cross=bindFinalRefinementRound({round:f.templates[1],works,rounds:f.history,answers:f.answers});assert.equal(cross.unavailable,undefined);assert.equal(cross.evidence.finalRefinement.explicitNoFavourites,true);assert.deepEqual(cross.evidence.finalRefinement.explicitFavouriteIds,[]);assert(isOverallAppealRound(cross));
});
test('A restored deferred template cannot retain conflicting placeholder identity aliases',()=>{
  const f=fixture(),template={...structuredClone(f.templates[0]),workIds:ids(f.templates[0]),anchorIds:[],anchorWorks:[]},before=structuredClone(template),bound=bindFinalRefinementRound({round:template,works,rounds:f.history,answers:f.answers});assert.equal(bound.unavailable,undefined);assert.deepEqual(bound.workIds,ids(bound));assert.deepEqual(bound.anchorIds,[]);assert.deepEqual(bound.anchorWorks,[]);assert.notDeepEqual(bound.workIds,template.workIds);assert.deepEqual(template,before);assert(validAnswer(bound,{workIds:ids(bound),presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0},selectionMode:'shortlist',selectedIds:ids(bound).slice(0,5),confirmed:true,explicitNone:false,unsure:false}));
});

test('Closing sources and predictions are prospective and reserved repeat works stay out of46–49',()=>{
  const f=fixture();let reservation;
  for(const template of f.templates.slice(0,4)){
    const bound=bindFinalRefinementRound({round:template,works,rounds:f.history,answers:f.answers});assert.equal(bound.unavailable,undefined);const number=Number(bound.id.slice(8));for(const id of bound.evidence.finalRefinement.sourceRoundIds||[])assert(Number(id.slice(8))<number);
    if(template===f.templates[0])reservation=bound.evidence.finalRefinement.repeatReservation;else assert(ids(bound).every(id=>!reservation.workIds.includes(id)));
    for(const h of bound.evidence.finalRefinement.hypotheses||[]){assert.equal(h.measurementScope,APPEAL_PROTOCOL);assert(h.trainingRoundIds.every(id=>Number(id.slice(8))<number));}
    f.history.push(bound);f.answers[bound.id]=bound.kind==='choice-grid'?{confirmed:true,workIds:ids(bound),presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0},selectionMode:'shortlist',selectedIds:ids(bound).slice(0,5),explicitNone:false,unsure:false}:answer(bound,[11,42,73,94]);
  }
  const repeat=bindFinalRefinementRound({round:f.templates[4],works,rounds:f.history,answers:f.answers}),original=f.history.find(r=>r.id===repeat.evidence.repeatOf);assert(repeat.evidence.exactRepeat);assert.equal(original.id,reservation.sourceRoundId);assert.equal(repeat.title,original.title);assert.equal(repeat.hint,original.hint);assert.deepEqual(repeat.scale,original.scale);assert.deepEqual(ids(repeat),[...ids(original)].reverse());assert(isOverallAppealRound(repeat));
  const frozen=structuredClone(repeat);assert.deepEqual(bindFinalRefinementRound({round:repeat,works,rounds:[],answers:{}}),frozen,'Captured definitions are immutable after binding');
});

test('A legacy exact source keeps its original scale and never acquires overall-appeal semantics',()=>{
  const f=fixture(),legacy=source(works.slice(80,84),0,[0,30,60,100],false);legacy.round.id='journey-000';f.history.unshift(legacy.round);f.answers[legacy.round.id]=legacy.answer;
  const result=bindFinalRefinementRound({round:f.templates[4],works,rounds:f.history,answers:f.answers});assert.equal(result.evidence.repeatOf,legacy.round.id);assert.equal(result.title,legacy.round.title);assert.deepEqual(result.scale,legacy.round.scale);assert.equal(result.evidence.appealProtocol,undefined);assert.equal(result.evidence.measurementScope,undefined);assert.equal(isOverallAppealRound(result),false);
});

test('An actual late exposure invalidates a reserved repeat instead of manufacturing consistency',()=>{
  const f=fixture(),grid=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers}),reserved=grid.evidence.finalRefinement.repeatReservation;
  f.history.push(grid,{id:'journey-049',kind:'choice-grid',title:'Shown images',hint:'',works:f.history.filter(r=>r.kind==='spectrum').flatMap(r=>r.works)});
  const result=bindFinalRefinementRound({round:f.templates[4],works,rounds:f.history,answers:f.answers});assert.equal(result.evidence.exactRepeat,undefined);assert.equal(result.evidence.repeatOf,undefined);assert.equal(result.evidence.finalRefinement.role,'closing-comparison');assert(result.evidence.finalRefinement.repeatFallbackReason);assert(result.works.every(w=>!reserved.workIds.includes(w.id)));
});
test('Opening a reserved favourites page resets the repeat delay; missing page history is conservative',()=>{
  for(const presentation of [{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0,1],activePage:1},undefined]){
    const f=fixture(),grid=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers});f.history.push(grid);f.answers[grid.id]={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,...(presentation?{presentation}:{})};
    const result=bindFinalRefinementRound({round:f.templates[4],works,rounds:f.history,answers:f.answers});assert.equal(result.evidence.exactRepeat,undefined);assert.equal(result.evidence.finalRefinement.role,'closing-comparison');assert(result.evidence.finalRefinement.repeatFallbackReason);assert(f.history.filter(isOverallAppealRound).every(source=>sig(ids(source))!==sig(ids(result))),'An unspaced identical quartet cannot be renamed a new comparison');
  }
});

test('Legacy and overall ratings cannot jointly manufacture the three-set directional model gate',()=>{
  const rounds=[],answers={};for(let i=0;i<5;i++){const item=source(works.slice(i*4,i*4+4),i,[0,30,60,100],i>=3);rounds.push(item.round);answers[item.round.id]=item.answer;}
  assert.deepEqual(summarizePreferenceHypotheses({works,rounds,answers,measurementScope:APPEAL_PROTOCOL}),[]);
  const plan=planAdaptivePanels({works,rounds,answers,panelCount:6,seed:'mixed-scope'});assert.equal(plan.coverage.activeMeasurementScope,APPEAL_PROTOCOL);assert.deepEqual(plan.coverage.modelSourceRoundIds,rounds.slice(3).map(r=>r.id));assert(plan.panels.every(p=>!p.provisionalHypothesis));
});

test('A shownv9 relative question survives freshv10 generation byte-for-byte',()=>{
  const old=source(works.slice(20,24),5,[10,20,30,40],false).round,before=structuredClone(old),rebuilt=buildJourneyRounds(works,{}, {history:[old],seed:'preserve-v9'});assert.deepEqual(rebuilt.find(r=>r.id===old.id),before);assert.equal(isOverallAppealRound(rebuilt.find(r=>r.id===old.id)),false);assert.deepEqual(old,before);
});
test('Later164 blocks introduce46 new ratings with feasible exploration capacity and unchanged protected panels',()=>{
  let rounds=[],answers={},reservationPlan;const seen=new Set();
  for(let batchIndex=0;batchIndex<3;batchIndex++){
    const seed='fresh164-allocation-'+batchIndex,released=new Set(reservationPlan?.['batch'+(batchIndex+1)]||[]),adaptivePlan=batchIndex?planAdaptivePanels({works:works.filter(work=>seen.has(work.id)||released.has(work.id)),rounds,answers,batchIndex,seed,quotas:journeyAdaptiveQuotas(batchIndex,reservationPlan)}):undefined,before=adaptivePlan&&structuredClone(adaptivePlan);
    const selection=createJourneyStimulusPlan({works,rounds,answers,batchIndex,reservationPlan,seed,adaptivePlan});if(adaptivePlan){assert.deepEqual(adaptivePlan,before);for(const [index,panel] of adaptivePlan.panels.entries())if(panel.role!=='exploration')assert.deepEqual(selection.panels[index],panel);}
    reservationPlan??=selection.reservations;assert(selection.complete);assert.equal(selection.coverage.firstRatingWorkIds.length,[72,46,46][batchIndex]);assert(selection.coverage.firstRatingTargetFeasible);assert(selection.coverage.firstRatingTargetMet);assert(selection.coverage.firstRatingSlotCapacity>=selection.coverage.firstRatingTarget);selection.coverage.firstRatingWorkIds.forEach(id=>seen.add(id));
    if(batchIndex){assert.deepEqual(selection.coverage.quotas.requested,{repeat:2,recontextualization:1,challenge:3});assert.equal(selection.panels.filter(panel=>panel.role==='exploration').length,12);}
    const block=buildJourneyRounds(works,answers,{history:rounds,panels:selection,reservationPlan,batchIndex,offset:batchIndex*50}),main=block.filter(round=>round.evidence.panelNumber&&round.evidence.construct==='preference');for(const round of main)answers[round.id]=answer(round,round.works.map(work=>Math.round(work.features.abstraction*100)));rounds.push(...main);
  }
  assert.equal(seen.size,164);assert.deepEqual(journeyAdaptiveQuotas(2,{batch3:Array(42).fill('legacy')}),{exactRepeats:2,recontextualizations:1,challenges:4});assert.deepEqual(journeyAdaptiveQuotas(2,{batch3:Array(46).fill('fresh')}),{exactRepeats:2,recontextualizations:1,challenges:3});assert.deepEqual(journeyAdaptiveQuotas(3,{batch4:[]}),{});
});
test('Adaptive exposure counts only the opened favourite pages and marks missing page history unknown',()=>{
  const f=fixture(),grid=bindFinalRefinementRound({round:f.templates[0],works,rounds:f.history,answers:f.answers}),base=planAdaptivePanels({works,rounds:f.history,answers:f.answers,panelCount:0}),a={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}},next=planAdaptivePanels({works,rounds:[...f.history,grid],answers:{...f.answers,[grid.id]:a},panelCount:0}),visible=ids(grid)[0],unopened=ids(grid).at(-1);
  assert.equal(next.coverage.exposureBefore[visible],base.coverage.exposureBefore[visible]+1);assert.equal(next.coverage.exposureBefore[unopened],base.coverage.exposureBefore[unopened]);assert.deepEqual(next.coverage.exposureUnknownWorkIds,[]);
  delete a.presentation;const unknown=planAdaptivePanels({works,rounds:[...f.history,grid],answers:{...f.answers,[grid.id]:a},panelCount:0});for(const id of ids(grid))assert(unknown.coverage.exposureUnknownWorkIds.includes(id));
});
