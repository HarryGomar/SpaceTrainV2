import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClosingReadings} from '../../public/art-atlas/closing-readings.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {withOverallAppeal,APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
import {summarizePreferenceHypotheses} from '../../public/art-atlas/adaptive-selection.mjs';
import {bindFinalRefinementRound,buildFinalRefinementRounds} from '../../public/art-atlas/final-refinement.mjs';

const ids=round=>round.works.map(work=>work.id);
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,i)=>[work.id,values[i]]))});
function fixture(){
  const energy=[.6,.7,.8,1,0,.1,.2,.3,0,.3,.7,1],complexity=[0,.1,.2,.3,.6,.7,.8,1,0,.3,.7,1];
  const works=Array.from({length:12},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,features:{abstraction:.5,energy:energy[i],complexity:complexity[i],humanity:.5,narrative:.5,atmosphere:.5,color:.5}})),rounds=[],answers={};
  for(let i=0;i<3;i++){const round=withOverallAppeal({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});rounds.push(round);answers[round.id]=answer(round,[0,30,70,100]);}
  const hypotheses=summarizePreferenceHypotheses({works,rounds,answers,measurementScope:APPEAL_PROTOCOL}),primary=hypotheses.find(item=>item.feature==='energy'),rival=hypotheses.find(item=>item.feature==='complexity');assert(primary&&rival);
  const check=withOverallAppeal({id:'journey-048',kind:'spectrum',criterion:'preference',works:[works[3],works[7],works[2],works[6]],evidence:{construct:'preference',family:'individual-choice',role:'probe',finalRefinement:{protocol:'closing-refinement-v1',binding:'bound',slot:3,role:'rival-check',sourceRoundIds:rounds.map(round=>round.id),hypotheses:[structuredClone(primary),structuredClone(rival)],checks:[{workIds:['w3','w7'],prediction:'w3',rivalPrediction:'w7',comparisonNovel:true,holdoutUnit:'new-comparison',artworksMayBeFamiliar:true},{workIds:['w2','w6'],prediction:'w2',rivalPrediction:'w6',comparisonNovel:true,holdoutUnit:'new-comparison',artworksMayBeFamiliar:true}]}}});
  rounds.push(check);answers[check.id]=answer(check,[90,10,10,90]);return {works,rounds,answers,check};
}
const build=f=>buildClosingReadings({works:f.works,rounds:f.rounds,answers:f.answers});
const meta=f=>f.check.evidence.finalRefinement;

test('Closing four-work answers check both frozen pairs, with primary/rival matches and exact evidence',()=>{
  const f=fixture(),result=build(f);assert.equal(result.checks.length,2);assert.deepEqual(result.checks.map(check=>check.status),['matched','reversed']);assert.deepEqual(result.checks.map(check=>check.rivalStatus),['reversed','matched']);assert.deepEqual(result.checks.map(check=>check.observedWorkId),['w3','w6']);assert.equal(result.coverage.checkRounds,1);assert.equal(result.coverage.newPairChecks,2);assert.equal(result.observations[0].comparisonCount,2);assert.ok(result.observations[0].counter.some(item=>item.workIds.includes('w6')));assert.ok(result.observations[0].alternatives.some(text=>/dependent/.test(text)));for(const check of result.checks){assert.equal(check.primary.sourceSetCount,3);assert.equal(check.primary.namedArtistCount,12);assert.deepEqual(check.primary.trainingRoundIds,['journey-001','journey-002','journey-003']);assert.equal(check.visibility,'not-seen');}
  const portrait=buildTastePortrait(f);assert.deepEqual(portrait.closingRefinement,result);assert.ok(portrait.observations.some(item=>item.module==='closing-checks'));
});

test('The actual closing binder produces snapshots accepted by the outcome reader',()=>{
  const f=fixture(),history=f.rounds.slice(0,3),template=buildFinalRefinementRounds({works:f.works,seed:'closing-reading-regression'})[2],bound=bindFinalRefinementRound({round:template,works:f.works,rounds:history,answers:f.answers});assert.equal(bound.unavailable,undefined);assert.ok(bound.evidence.finalRefinement.checks.length);
  const result=buildClosingReadings({works:f.works,rounds:[...history,bound],answers:{...f.answers,[bound.id]:answer(bound,[10,40,70,100])}});assert.equal(result.checks.length,bound.evidence.finalRefinement.checks.length);assert.ok(result.observations[0].support.some(item=>item.roundId===bound.id));
});

test('Near ties do not pick a winner or declare either explanation correct',()=>{
  const f=fixture();f.answers[f.check.id]=answer(f.check,[51,49,50,50]);const result=build(f);assert.ok(result.checks.every(check=>check.status==='near-tie'&&check.observedWorkId===null&&check.rivalStatus==='near-tie'));assert.match(result.observations[0].title,/No clear order/);assert.equal(result.observations[0].counter.length,0);
});

test('Frozen training positions and descriptors are not refitted after later answer/catalogue edits',()=>{
  const f=fixture(),before=build(f);for(const source of f.rounds.slice(0,3))for(const id of ids(source))f.answers[source.id].positions[id]=100-f.answers[source.id].positions[id];const liveCatalogue=structuredClone(f.works);for(const work of liveCatalogue){work.features.energy=1-work.features.energy;work.features.complexity=1-work.features.complexity;}
  const after=buildClosingReadings({works:liveCatalogue,rounds:f.rounds,answers:f.answers});assert.deepEqual(after,before);assert.deepEqual(meta(f).hypotheses[0].trainingEvidence[0].positions,{w0:0,w1:30,w2:70,w3:100});
});

test('Changing the actual closing answer changes its observed outcome while preserving the captured prediction',()=>{
  const f=fixture(),before=build(f);f.answers[f.check.id]=answer(f.check,[0,100,100,0]);const after=build(f);assert.deepEqual(after.checks.map(check=>check.status),['reversed','matched']);assert.deepEqual(after.checks.map(check=>check.predictedWorkId),before.checks.map(check=>check.predictedWorkId));assert.deepEqual(after.checks[0].primary.trainingEvidence,before.checks[0].primary.trainingEvidence);
});

test('Incomplete, skipped, stale, off-scale and unconfirmed whole answers cannot yield partial pair outcomes',()=>{
  for(const mutate of [a=>delete a.positions.w6,a=>a.positions.w6=null,a=>a.positions.w6=101,a=>a.workIds.reverse(),a=>a.confirmed=false,a=>a.skipped=true]){const f=fixture();mutate(f.answers[f.check.id]);assert.deepEqual(build(f).checks,[]);}
});

test('No legacy scale, context, changed protocol or unbound definition is a closing overall check',()=>{
  for(const mutate of [f=>delete f.check.evidence.appealProtocol,f=>f.check.scale.left='Less preferred',f=>f.check.evidence.family='contextual-choice',f=>f.check.evidence.unconditional=false,f=>meta(f).protocol='foreign',f=>meta(f).binding='deferred',f=>f.check.evidence.role='discovery',f=>f.check.evidence.repeatOf='journey-001']){const f=fixture();mutate(f);assert.deepEqual(build(f).checks,[]);}
});

test('Training source identities must be actual earlier definitions with complete frozen values',()=>{
  for(const mutate of [f=>meta(f).hypotheses[0].trainingEvidence[0].roundId=f.check.id,f=>meta(f).hypotheses[0].trainingRoundIds[0]='missing',f=>meta(f).hypotheses[0].trainingEvidence[0].workIds[0]='unknown',f=>delete meta(f).hypotheses[0].trainingEvidence[0].positions.w0,f=>meta(f).hypotheses[0].trainingEvidence[0].confirmed=false,f=>meta(f).hypotheses[0].trainingEvidence[0].measurementScope='legacy',f=>meta(f).sourceRoundIds.push(f.check.id),f=>f.rounds.push({...f.rounds[0]})]){const f=fixture();mutate(f);assert.deepEqual(build(f).checks,[]);}
});

test('Training snapshots require three distinct artwork sets, four named artists and real directional support',()=>{
  for(const mutate of [f=>{for(const round of f.rounds.slice(0,3))for(const work of round.works)work.artist='One artist';},f=>meta(f).hypotheses[0].trainingEvidence[2].workIds=[...meta(f).hypotheses[0].trainingEvidence[0].workIds],f=>meta(f).hypotheses[0].supportingRoundIds=['journey-001'],f=>meta(f).hypotheses[0].direction=-1,f=>meta(f).hypotheses[0].trainingEvidence.forEach(snapshot=>{for(const id of snapshot.workIds)snapshot.featureValues[id]=.5;})]){const f=fixture();mutate(f);assert.deepEqual(build(f).checks,[]);}
});

test('Claimed primary and rival predictions must agree with their captured directions and actual frozen test descriptors',()=>{
  for(const mutate of [f=>meta(f).checks.forEach(check=>check.prediction=check.workIds.find(id=>id!==check.prediction)),f=>meta(f).checks.forEach(check=>check.rivalPrediction=check.prediction),f=>meta(f).hypotheses[1].direction=-1,f=>meta(f).checks.forEach(check=>check.workIds[0]='unknown'),f=>meta(f).checks.forEach(check=>check.artworksMayBeFamiliar=false)]){const f=fixture();mutate(f);assert.deepEqual(build(f).checks,[]);}
});

test('Earlier actual co-presentation defeats a claimed new pair, while an explicitly nonnovel recheck stays descriptive',()=>{
  const f=fixture(),seen={id:'seen',kind:'choice-grid',works:[f.works[3],f.works[7],f.works[2],f.works[6]]};f.rounds.splice(3,0,seen);assert.deepEqual(build(f).checks,[]);
  for(const check of meta(f).checks){check.comparisonNovel=false;check.holdoutUnit=null;}const result=build(f);assert.equal(result.checks.length,2);assert.ok(result.checks.every(check=>check.visibility==='seen'));assert.equal(result.observations[0].readingBasis,'descriptive-recheck');assert.equal(result.coverage.newPairChecks,0);assert.match(result.observations[0].alternatives.join(' '),/no independent held-out/);
});

test('A hidden statement reference does not become art exposure, but unknown museum presentation suppresses novelty',()=>{
  const f=fixture();f.rounds.splice(3,0,{id:'statement',kind:'statements',works:f.check.works,evidence:{stimulusVisibility:'not-shown'}});assert.equal(build(f).checks.length,2);
  f.rounds.splice(3,0,{id:'museum',kind:'exercise',exerciseKind:'curate',works:f.works});assert.deepEqual(build(f).checks,[]);
});

test('Duplicate pair labels do not multiply an outcome or turn familiar artworks into independent replications',()=>{
  const f=fixture();meta(f).checks.push(structuredClone(meta(f).checks[0]));const result=build(f);assert.equal(result.checks.length,2);assert.equal(result.coverage.checkRounds,1);assert.equal(result.observations[0].comparisonCount,2);assert.doesNotMatch(JSON.stringify(result),/accuracy percentage"\s*:|confidence"\s*:|independentWorks/);
});

test('Closing questions sharing a primary feature produce one specific reading while retaining every raw result',()=>{
  const f=fixture(),second=structuredClone(f.check);second.id='journey-049';second.evidence.finalRefinement.slot=4;second.evidence.finalRefinement.role='exception-check';for(const check of second.evidence.finalRefinement.checks){check.comparisonNovel=false;check.holdoutUnit=null;}f.rounds.push(second);f.answers[second.id]=answer(second,[10,90,90,10]);const result=build(f),visible=result.observations.filter(item=>item.module==='closing-checks');assert.equal(visible.length,1);assert.equal(result.roundObservations.length,2);assert.equal(result.checks.length,4);assert.equal(result.coverage.checkRounds,2);assert.equal(visible[0].sourceQuestionCount,2);assert.equal(visible[0].distinctPairCount,2);assert.equal(visible[0].comparisonCount,4);assert.equal(visible[0].title,'Visual activity did not settle these choices.');assert.deepEqual(visible[0].outcomeCounts,{matched:2,reversed:2,nearTied:0});assert.deepEqual(visible[0].displayWorkIds,['w6','w2']);assert.ok(visible[0].text.includes('Painting 6')&&visible[0].text.includes('Painting 2'));assert.deepEqual(new Set(visible[0].sourceFindingIds),new Set(['closing-check-journey-048','closing-check-journey-049']));assert.ok(visible[0].support.some(source=>source.roundId==='journey-048'));assert.ok(visible[0].support.some(source=>source.roundId==='journey-049'));
});

function withFavourites(){
  const f=fixture();f.rounds.pop();delete f.answers[f.check.id];const candidates=f.rounds.flatMap((round,index)=>round.works.map(work=>({workId:work.id,value:f.answers[round.id].positions[work.id],roundId:round.id,index}))),grid={id:'journey-046',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,works:[...f.works],evidence:{construct:'overall-favourites',explicitFavourites:true,finalRefinement:{protocol:'closing-refinement-v1',binding:'bound',slot:1,role:'favourites',candidateRatings:candidates}}};
  f.rounds.push(grid);f.answers[grid.id]={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:['w0'],explicitNone:false,unsure:false};return {...f,grid};
}
test('An explicit favourite can override a higher captured rating without making nonselection a dislike',()=>{
  const f=withFavourites(),result=build(f);assert.equal(result.favouriteRefinements.length,1);const finding=result.favouriteRefinements[0];assert.equal(finding.pairs.length,1);assert.equal(finding.pairs[0].selectedWorkId,'w0');assert.equal(finding.pairs[0].selectedBefore,0);assert.equal(finding.pairs[0].unselectedBefore,100);assert.ok(!f.answers[f.grid.id].selectedIds.includes(finding.pairs[0].unselectedWorkId));assert.equal('dislike' in finding.pairs[0],false);assert.ok(finding.support.some(item=>item.roundId===f.grid.id));assert.equal(buildTastePortrait(f).heroWorks[0].workId,'w0');
  const before=structuredClone(result);for(const round of f.rounds.slice(0,3))for(const id of ids(round))f.answers[round.id].positions[id]=50;assert.deepEqual(build(f),before,'Earlier captured candidate values are not silently recalculated');
});

function pagedFixture(){
  const works=Array.from({length:24},(_,i)=>({id:'p'+i,title:'Painting '+i,artist:'Artist '+i,features:{energy:(i%4)/3,complexity:(i%4)/3}})),rounds=[],answers={};
  for(let i=0;i<6;i++){const round=withOverallAppeal({id:'source-'+i,kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});rounds.push(round);answers[round.id]=answer(round,round.works.map(work=>Number(work.id.slice(1))>=18?100:70));}
  const grid={id:'paged-favourites',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,works,evidence:{construct:'overall-favourites',instrumentRevision:'paged-favourites-v1',finalRefinement:{protocol:'closing-refinement-v1',binding:'bound',slot:1,role:'favourites',candidateRatings:rounds.flatMap((round,index)=>round.works.map(work=>({workId:work.id,value:answers[round.id].positions[work.id],roundId:round.id,index})))}}};rounds.push(grid);answers[grid.id]={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:['p0'],explicitNone:false,unsure:false,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0],activePage:0}};return {works,rounds,answers,grid};
}
test('Only actually presented unselected favourites can oppose a selected favourite',()=>{
  const f=pagedFixture();assert.deepEqual(build(f).favouriteRefinements,[],'Higher old ratings on unopened pages are not a non-selection');f.answers[f.grid.id].presentation={protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0,1],activePage:1};const result=build(f);assert.equal(result.favouriteRefinements.length,1);assert.equal(result.favouriteRefinements[0].presentedIds.length,24);assert.ok(result.favouriteRefinements[0].pairs[0].unselectedWorkId.startsWith('p'));assert.ok(Number(result.favouriteRefinements[0].pairs[0].unselectedWorkId.slice(1))>=18);
});

test('An unopened page never revokes an earlier explicit favourite, and missing paging evidence is unknown',()=>{
  const f=pagedFixture(),old={...structuredClone(f.grid),id:'earlier-favourites',evidence:{construct:'overall-favourites'}},oldAnswer={confirmed:true,workIds:ids(old),selectionMode:'shortlist',selectedIds:['p23'],explicitNone:false,unsure:false};f.rounds.splice(6,0,old);f.answers[old.id]=oldAnswer;f.answers[f.grid.id].selectedIds=[];f.answers[f.grid.id].explicitNone=true;assert.equal(buildTastePortrait(f).heroWorks[0].workId,'p23');assert.equal(buildTastePortrait(f).heroWorks[0].basis,'overall-favourites');
  delete f.answers[f.grid.id].presentation;assert.equal(buildTastePortrait(f).heroWorks[0].workId,'p23');assert.deepEqual(build(f).favouriteRefinements,[]);
  f.answers[f.grid.id].presentation={protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0,1],activePage:1};assert.ok(buildTastePortrait(f).heroWorks.every(item=>item.basis!=='overall-favourites'));
});

test('Closing novelty respects actual page co-presentation and refuses missing page metadata',()=>{
  const f=fixture();for(let i=12;i<24;i++)f.works.push({id:'w'+i,title:'Painting '+i,artist:'Artist '+i});const first=f.works.filter(work=>!['w6','w7'].includes(work.id)).slice(0,18),rest=f.works.filter(work=>!first.includes(work)),grid={id:'paged-seen',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,works:[...first,...rest],evidence:{construct:'overall-favourites',instrumentRevision:'paged-favourites-v1'}},a={confirmed:true,workIds:ids(grid),selectionMode:'shortlist',selectedIds:[],explicitNone:true,unsure:false,presentation:{protocol:'paged-favourites-v1',pageSize:18,visitedPages:[0,1],activePage:1}};f.rounds.splice(3,0,grid);f.answers[grid.id]=a;assert.equal(build(f).checks.length,2,'Seeing individual paintings on different pages is not simultaneous co-presentation');delete a.presentation;assert.deepEqual(build(f).checks,[]);
});

test('Missing earlier sources, malformed candidate snapshots, generic keep grids and explicit None invent no favourite override',()=>{
  for(const mutate of [f=>f.grid.evidence.construct='unranked-subset-selection',f=>f.grid.evidence.finalRefinement.candidateRatings.pop(),f=>f.grid.evidence.finalRefinement.candidateRatings[0].roundId='unknown',f=>f.grid.evidence.finalRefinement.candidateRatings[0].value=null,f=>{f.answers[f.grid.id].selectedIds=[];f.answers[f.grid.id].explicitNone=true;},f=>f.answers['journey-001'].confirmed=false]){const f=withFavourites();mutate(f);assert.deepEqual(build(f).favouriteRefinements,[]);}
});

test('Closing analysis is pure and malformed containers return no fabricated outcome',()=>{
  const f=fixture(),before=structuredClone(f),result=build(f);assert.deepEqual(f,before);result.checks[0].primary.trainingEvidence[0].positions.w0=99;assert.deepEqual(f,before);assert.deepEqual(buildClosingReadings({works:null,rounds:null,answers:null}).checks,[]);
});
