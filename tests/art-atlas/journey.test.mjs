import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJourneyRounds,createJourneyStimulusPlan,bindJourneyStimulusPlan,JOURNEY_PROTOCOL,JOURNEY_REVISION} from '../../public/art-atlas/journey-bank.mjs';
import {FIRST_PANEL_SIZES} from '../../public/art-atlas/stimulus-planner.mjs';
import {buildStudyRounds} from '../../public/art-atlas/question-bank.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound,validStudyAnswer,analyzeStudy} from '../../public/art-atlas/deep-study.mjs';
import {createScenario,analyzeScenarios} from '../../public/art-atlas/scenarios.mjs';
import {placeSortingWork} from '../../public/art-atlas/sorting-table.mjs';
import {setDifficultEditRemoval,startDifficultEditComparison,chooseDifficultEditComparison} from '../../public/art-atlas/difficult-edit.mjs';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {buildResponseAtlas} from '../../public/art-atlas/response-atlas-data.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {legacyV8Rounds} from './helpers/legacy-v8.mjs';
import {isFinalRefinementRound} from '../../public/art-atlas/final-refinement.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).slice(0,164);
const workIds=r=>r.works.map(w=>w.id);
const preferencePanels=rounds=>rounds.filter(r=>r.evidence.construct==='preference'&&Number.isInteger(r.evidence.panelNumber));

test('One 50-round sequence includes comparisons, maps, statements, matching, notes and four arrangement rounds',()=>{
  const rounds=buildJourneyRounds(works);
  assert.equal(rounds.length,50);assert.equal(new Set(rounds.map(r=>r.id)).size,50);
  assert.deepEqual(rounds.flatMap((r,i)=>r.kind==='exercise'?[[i+1,r.exerciseKind]]:[]),[[8,'sorting'],[22,'difficult-edit'],[32,'sorting'],[36,'curate']]);
  assert.deepEqual(new Set(rounds.map(r=>r.kind)),new Set(['spectrum','grid','choice-grid','contrast','statements','match','context','exercise']));
  assert.equal(rounds.filter(r=>r.kind==='choice-grid').length,5);
  assert.equal(rounds.filter(r=>r.kind==='grid').length,9);
  assert.deepEqual(rounds.flatMap((r,i)=>r.kind==='contrast'?[[i+1,r.contrastKind]]:[]),[[15,'chronology'],[19,'neighbour'],[27,'keep-leave'],[42,'same-subject']]);
  assert.deepEqual(rounds.filter(r=>r.kind==='match').map(r=>r.field),['artist','movement']);
  assert.ok(rounds.every(r=>restoreStudyRound(snapshotStudyRound(r),works)));
  assert.equal(rounds[31].evidence.repeatOf,rounds[7].id);
  assert.deepEqual(new Set(workIds(rounds[7])),new Set(workIds(rounds[31])));
  assert(rounds.slice(45).every(round=>isFinalRefinementRound(round)&&round.unavailable));
});

test('The fresh opening uses its curated landmarks and a different varied familiarity set, without overriding supplied panels',()=>{
  const rounds=buildJourneyRounds(works),opening=rounds[0],familiarity=rounds[1],expected=['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss'];
  assert.deepEqual(workIds(opening),expected);
  assert.equal(familiarity.kind,'choice-grid');assert.equal(familiarity.selectionMode,'familiarity');assert.equal(familiarity.works.length,12);assert.equal(familiarity.evidence.construct,'reported-prior-familiarity');
  assert.ok(!workIds(familiarity).some(id=>expected.includes(id)));assert.ok(new Set(familiarity.works.map(work=>work.artist)).size>=8);assert.ok(new Set(familiarity.works.map(work=>work.country).filter(Boolean)).size>=5);
  for(const work of [...opening.works,...familiarity.works])assert.ok(fs.existsSync(new URL('../../public/art-atlas/'+work.image,import.meta.url)),work.id+' needs its actual local reproduction');
  const panels=preferencePanels(rounds).map(round=>({workIds:workIds(round),construct:'preference',role:'exploration'})),replacement=works.slice(0,4).map(work=>work.id);panels[0].workIds=replacement;
  const supplied=buildJourneyRounds(works,{}, {panels});assert.deepEqual(workIds(supplied[0]),replacement);assert.deepEqual(new Set(workIds(supplied[3])),new Set(replacement));
  for(const round of rounds.filter(round=>round.kind==='grid'))assert.ok(!/absorbed|unmoved|want to understand|activated/i.test(JSON.stringify(round.axisDefinition)));
});

test('A raw legacy panel identity retains its artwork binding and prior-source chain on the new map',()=>{
  const old={id:'journey-001',kind:'spectrum',format:'spectrum',criterion:'preference',title:'The question actually shown.',hint:'The original preference instruction.',works:works.slice(0,4),evidence:{construct:'preference',family:'individual-choice',role:'discovery',setId:'panel-01'}},copy=structuredClone(old),rounds=buildJourneyRounds(works,{}, {history:[old]}),map=rounds[3];
  assert.deepEqual(old,copy);assert.deepEqual(rounds[0],old);assert.equal(map.axis,'achievement');assert.deepEqual(new Set(workIds(map)),new Set(workIds(old)));assert.equal(map.evidence.setId,old.evidence.setId);assert.ok(map.evidence.priorMeasureRoundIds.includes(old.id));assert.ok(map.evidence.pairedRoundIds.includes(old.id));
  const future={...structuredClone(old),id:'journey-051'},fresh=buildJourneyRounds(works,{}, {history:[future]});
  assert.deepEqual(workIds(fresh[0]),['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss'],'A later frozen panel cannot rebind the current batch');
});

test('An explicit unconditional=false flag prevents a valid spectrum from becoming preference training or atlas links',()=>{
  const base=buildJourneyRounds(works)[0],round={...base,evidence:{...base.evidence,unconditional:false}},answer={workIds:workIds(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,i*30])),confirmed:true};
  assert.ok(validStudyAnswer(round,answer),'The numerical response remains valid for its declared question');
  const input={works,rounds:[round],answers:{[round.id]:answer}},planned=planAdaptivePanels({...input,panelCount:0});assert.deepEqual(planned.coverage.eligiblePreferenceRoundIds,[]);
  const atlas=buildResponseAtlas(input);assert.deepEqual(atlas.graph.nodes,[]);assert.deepEqual(atlas.graph.edges,[]);assert.equal(atlas.coverage.validPreferenceRounds,0);
});

test('A self-contained adaptive repeat plan preserves an original blank instruction',()=>{
  const source={...buildJourneyRounds(works)[0],hint:''},answer={workIds:workIds(source),criterion:'preference',positions:Object.fromEntries(source.works.map((work,i)=>[work.id,i*30])),confirmed:true};
  const selection=planAdaptivePanels({works,rounds:[source],answers:{[source.id]:answer},batchIndex:1,seed:'blank-original-instruction',quotas:{exactRepeats:1,recontextualizations:0,challenges:0}}),planned=selection.panels.find(panel=>panel.role==='repeat');
  assert.ok(planned);assert.equal(planned.promptSnapshot.hint,'');assert.equal(planned.promptSnapshot.title,source.title);
  const next=buildJourneyRounds(works,{[source.id]:answer},{batchIndex:1,offset:50,panels:selection}),repeat=next.find(round=>round.evidence.repeatOf===source.id&&round.kind==='spectrum');
  assert.ok(repeat);assert.equal(repeat.hint,'');assert.equal(repeat.title,source.title);assert.equal(repeat.evidence.sourcePrompt.hint,'');assert.deepEqual(new Set(workIds(repeat)),new Set(workIds(source)));assert.equal(source.hint,'');
});

test('Restoring a journey keeps shown wording, earlier answers and its original catalogue',()=>{
  const data=prepareJourneySession(null,works,10),first=sessionJourneyRounds(data)[0];
  data.shown[first.id]=snapshotStudyRound(first);
  data.answers[first.id]={workIds:workIds(first),criterion:'preference',positions:Object.fromEntries(first.works.map((w,i)=>[w.id,20+i*20])),confirmed:true};
  const saved=structuredClone(data),changed=works.map(w=>({...w,title:'Changed metadata'}));
  const restored=prepareJourneySession(saved,changed,20);
  assert.equal(restored.manifest.protocol,JOURNEY_PROTOCOL);
  assert.deepEqual(restored.answers,saved.answers);assert.deepEqual(restored.shown,saved.shown);
  assert.deepEqual(restored.manifest.catalogue,saved.manifest.catalogue);
  assert.deepEqual(sessionJourneyRounds(restored)[0],first);
  assert.deepEqual(saved,data);
});

test('Embedded sorting counts only after explicit completion and keeps exact spatial evidence',()=>{
  const round=buildJourneyRounds(works)[7];
  let record=createScenario('sorting',works,{},[],{id:'journey-sort',now:10,offeredIds:workIds(round)});
  assert.equal(validStudyAnswer(round,{workIds:workIds(round),record}),false);
  record.offeredIds.forEach((id,i)=>{const placed=placeSortingWork(record,id,[[.12,.37,.63,.88][i%4],i<4?.25:.75]);assert.ok(placed.ok);record=placed.record;});
  Object.assign(record,{confirmed:true,finishedAt:20});
  const answer={workIds:workIds(round),record};assert.ok(validStudyAnswer(round,answer));
  assert.equal(validStudyAnswer(round,{...answer,skipped:true}),false);
  assert.equal(validStudyAnswer(round,{...answer,record:{kind:'sorting'}}),false);
  assert.equal(validStudyAnswer(round,{...answer,workIds:[...answer.workIds].reverse()}),false);
  const model=analyzeStudy(works,[round],{[round.id]:answer});
  assert.equal(model.answered,1);assert.equal(model.predictionChecks,0);
  assert.ok(analyzeScenarios(works,[record]).findings.length);
});

test('The edit needs its final comparison before it resolves as one round',()=>{
  const round=buildJourneyRounds(works)[21];
  let record=createScenario('difficult-edit',round.works,{},[],{id:'journey-edit',now:10,offeredIds:workIds(round)});
  assert.deepEqual(new Set(record.offeredIds),new Set(workIds(round)));
  record.presentedIds=[...record.offeredIds];record=setDifficultEditRemoval(record,record.offeredIds[0],works);
  const answer=()=>({workIds:workIds(round),record});
  assert.equal(validStudyAnswer(round,answer()),false);
  record=startDifficultEditComparison(record,works);record=chooseDifficultEditComparison(record,'equal',works);
  assert.equal(validStudyAnswer(round,answer()),false);
  Object.assign(record,{confirmed:true,finishedAt:20});assert.ok(validStudyAnswer(round,answer()));
  assert.equal(analyzeStudy(works,[round],{[round.id]:answer()}).answered,1);
});

test('Skipping every round yields a completion record without an invented profile',()=>{
  const rounds=buildJourneyRounds(works),answers=Object.fromEntries(rounds.map(r=>[r.id,{workIds:workIds(r),skipped:true}]));
  const reading=analyzeStudy(works,rounds,answers);
  assert.equal(reading.answered,0);assert.equal(reading.skipped,50);assert.equal(reading.enough,false);assert.deepEqual(reading.findings,[]);
});

test('Normal task references stay within the new sequence and training evidence precedes the check',()=>{
  const rounds=buildJourneyRounds(works),ids=new Set(rounds.map(r=>r.id));
  for(const [index,r] of rounds.entries()){
    if(r.evidence.repeatOf)assert.ok(ids.has(r.evidence.repeatOf));
    for(const key of ['trainingRoundIds','priorMeasureRoundIds'])for(const id of r.evidence[key]||[]){assert.ok(ids.has(id));assert.ok(Number(id.slice(-3))<index+1);}
    if(r.kind==='spectrum'&&r.evidence.family==='contextual-choice')assert.ok(r.scale?.left&&r.scale?.right);
  }
});

test('An incompatible saved source is retained instead of being overwritten as a new session',()=>{
  const earlier={version:1,answers:{legacy:{choice:'kept'}},plan:[]},copy=structuredClone(earlier);
  const data=prepareJourneySession(earlier,works,10);
  assert.deepEqual(data.retainedSource,earlier);assert.deepEqual(earlier,copy);assert.equal(data.plan.length,50);
});

test('The journey spaces cross-task returns and has no repeated ordinary preference panel',()=>{
  const rounds=buildJourneyRounds(works),signature=r=>workIds(r).sort().join('|');
  const preference=preferencePanels(rounds);
  assert.equal(preference.length,18);
  assert.equal(new Set(preference.map(signature)).size,18);
  assert.ok(preference.every(r=>r.evidence.role==='discovery'&&!r.evidence.repeatOf));
  for(let i=1;i<rounds.length;i++)if(!rounds[i].unavailable&&!rounds[i-1].unavailable)assert.notEqual(signature(rounds[i]),signature(rounds[i-1]),'consecutive shown questions reuse a complete artwork set');
  for(const [index,round] of rounds.entries()){
    if(!round.evidence.panelNumber)continue;
    const linked=rounds.filter(other=>other.evidence.setId===round.evidence.setId&&other.id!==round.id);
    assert.deepEqual(new Set(round.evidence.pairedRoundIds),new Set(linked.map(other=>other.id)));
    for(const other of linked){
      assert.equal(signature(other),signature(round));
      assert.ok(Math.abs(rounds.indexOf(other)-index)>=3,'cross-task return needs other decisions between it');
      assert.notEqual(other.evidence.construct,round.evidence.construct);
    }
  }
});

test('The expanded collection appears across small preference panels without overusing a favourite',()=>{
  const rounds=buildJourneyRounds(works),preference=preferencePanels(rounds);
  const appearances=new Map();
  for(const round of preference){assert.ok(round.works.length>=3&&round.works.length<=4);for(const id of workIds(round))appearances.set(id,(appearances.get(id)||0)+1);}
  assert.equal(appearances.size,72);
  assert.deepEqual([...preference].sort((a,b)=>a.evidence.panelNumber-b.evidence.panelNumber).map(round=>round.works.length),Array(18).fill(4));
  if(works.length>=54)assert.ok([...appearances.values()].every(count=>count===1));
  assert.ok(rounds.slice(0,3).every((round,index,early)=>early.slice(0,index).every(other=>!workIds(round).some(id=>workIds(other).includes(id)))));
  assert.deepEqual(new Set(workIds(rounds[3])),new Set(workIds(rounds[0])),'The first map deliberately revisits the first preference set under a different question');
  const artist=rounds[16],movement=rounds[17];
  assert.ok(!workIds(artist).some(id=>workIds(movement).includes(id)),'the immediately following game must not teach the same paintings again');
});

test('Concrete appraisals and the one prospective claim retain distinct meanings',()=>{
  const rounds=buildJourneyRounds(works),appraisals=rounds.filter(r=>r.evidence.family==='looking-appraisal');
  assert.deepEqual(appraisals.map(r=>r.evidence.construct),[],'Fresh first50 spends the isolated surface self-rating on a fifth matched admiration map');
  assert.ok(appraisals.every(r=>r.scale.left&&r.scale.right&&r.evidence.questionTarget&&!r.evidence.heldOut));
  assert.deepEqual(new Set(rounds.filter(r=>r.kind==='grid').map(r=>r.axis)),new Set(['achievement','reading','returnResponse']));
  for(const round of rounds.filter(r=>r.kind==='grid'))assert.deepEqual(round.axisDefinition,AXES[round.axis]);
  assert.ok(!rounds.some(r=>r.evidence.construct==='curiosity'||['response','connection','meaning'].includes(r.axis)));
  const claims=rounds.filter(r=>r.kind==='statements');assert.equal(claims.length,1);
  assert.deepEqual(claims[0].statements,[{id:'contextEffect',text:'Learning the story behind a painting rarely changes how much I like it.'}]);
  const note=rounds[34];
  assert.equal(note.contextMode,'preference-before-after-v1');
  assert.equal(note.evidence.construct,'context-liking-change');
  assert.equal(note.evidence.family,'symbolism-reveal');
  assert.equal(note.evidence.claimRoundId,claims[0].id);
  assert.equal(claims[0].evidence.contextRoundId,note.id);
  assert.equal(claims[0].evidence.checkId,note.evidence.checkId);
  assert.equal(note.works[0].id,works.some(w=>w.id==='add-watts-hope')?'add-watts-hope':works.some(w=>w.id==='holbein-ambassadors')?'holbein-ambassadors':'redon-violette');
  assert.ok(!rounds.some(r=>/first stop|final stop|return visit|afternoon|easy to understand|feeling calm|ones I want to understand/i.test(r.title+' '+r.hint+' '+(r.statements||[]).map(s=>s.text).join(' '))));
});

test('Familiarity and later keep grids share exact identities without limiting or ranking the new selections',()=>{
  const rounds=buildJourneyRounds(works),grids=rounds.filter(r=>r.kind==='choice-grid'&&!isFinalRefinementRound(r));
  assert.deepEqual(grids.map(r=>[r.id,r.selectionMode]),[['journey-002','familiarity'],['journey-009','shortlist'],['journey-011','familiarity'],['journey-023','shortlist']]);
  for(const round of grids){assert.equal(round.works.length,12);assert.equal(new Set(workIds(round)).size,12);assert.equal(round.evidence.family,'selection-grid');assert.notEqual(round.evidence.construct,'preference');assert.equal(round.criterion,undefined);assert.equal(round.bankRoundId,undefined);}
  for(const [beforeId,afterId] of [['journey-002','journey-009'],['journey-011','journey-023']]){
    const before=rounds.find(r=>r.id===beforeId),after=rounds.find(r=>r.id===afterId);
    assert.deepEqual(new Set(workIds(after)),new Set(workIds(before)));assert.notDeepEqual(workIds(after),workIds(before));assert.equal(after.evidence.familiarityRoundId,before.id);assert.equal(after.evidence.gridGroup,before.evidence.gridGroup);assert.equal(after.evidence.setId,before.evidence.setId);
    const unknown={workIds:workIds(before),selectionMode:'familiarity',selectedIds:[],explicitNone:false,unsure:true,confirmed:true};assert.ok(validStudyAnswer(before,unknown));
    const selected={workIds:workIds(after),selectionMode:'shortlist',selectedIds:workIds(after).slice(0,3),explicitNone:false,unsure:false,confirmed:true};assert.ok(validStudyAnswer(after,selected));assert.equal(after.maxChoices,after.works.length);assert.equal(after.evidence.construct,'unranked-subset-selection');assert.ok(validStudyAnswer(after,{...selected,selectedIds:workIds(after).slice(0,4)}));assert.ok(validStudyAnswer(after,{...selected,selectedIds:workIds(after)}));assert.equal(validStudyAnswer(after,{...selected,selectedIds:[],unsure:true}),false);
  }
});

test('Every new map names its own construct and revisits its exact preference panel',()=>{
  const rounds=buildJourneyRounds(works);
  for(const round of rounds.filter(r=>r.kind==='grid')){
    const preference=rounds.find(r=>r.evidence.construct==='preference'&&r.evidence.panelNumber===round.evidence.panelNumber);assert.ok(preference);
    assert.deepEqual(new Set(workIds(round)),new Set(workIds(preference)));assert.equal(round.evidence.setId,preference.evidence.setId);assert.ok(round.evidence.pairedRoundIds.includes(preference.id));assert.notEqual(round.evidence.construct,'preference');assert.equal(round.evidence.family,'reported-appraisal');assert.equal(round.evidence.newInstrument,true);
    const answer={workIds:workIds(round),axis:round.axis,points:Object.fromEntries(round.works.map((work,i)=>[work.id,[10+i*20,90-i*20]])),confirmed:true};assert.ok(validStudyAnswer(round,answer));assert.equal(validStudyAnswer(round,{...answer,axis:'response'}),false);
    const restored=restoreStudyRound(snapshotStudyRound(round),works);assert.deepEqual(restored.axisDefinition,round.axisDefinition);assert.equal(restored.title,round.title);
  }
});

test('The curated72 plan binds reviewed briefs and reserves without manufacturing metadata for a saved different set',()=>{
  const selection=createJourneyStimulusPlan({works}),rounds=buildJourneyRounds(works),panels=preferencePanels(rounds).sort((a,b)=>a.evidence.panelNumber-b.evidence.panelNumber),bound=bindJourneyStimulusPlan(selection,rounds);
  assert.equal(bound.bindingStatus,'exact-curated-plan');assert.equal(bound.boundMainWorkCount,72);assert.deepEqual(bound.reservations.batch2,selection.reservations.batch2);assert.equal(bound.reservations.batch2.length,46);assert.equal(bound.reservations.batch3.length,46);
  assert.equal(new Set([...bound.boundMainWorkIds,...bound.reservations.batch2,...bound.reservations.batch3]).size,works.length);
  for(const [index,panel] of panels.entries()){
    const proposed=selection.panels[index];assert.deepEqual(new Set(workIds(panel)),new Set(proposed.workIds));assert.deepEqual(panel.evidence.plannerDiagnostic,proposed.plannerDiagnostic);assert.deepEqual(panel.evidence.editorialBrief,proposed.editorialBrief);assert.equal(panel.evidence.stimulusPlannerRevision,selection.revision);
    for(const map of rounds.filter(round=>round.kind==='grid'&&round.evidence.panelNumber===index+1))assert.equal(map.works.length,4,'Each current map uses its four reference works');
  }
  const panelNumber=rounds.find(round=>round.kind==='grid'&&round.evidence.panelNumber!==1).evidence.panelNumber,proposed=selection.panels[panelNumber-1],original=panels[panelNumber-1],replacement=works.filter(work=>!proposed.workIds.includes(work.id)).slice(0,4),saved={...structuredClone(original),works:replacement,evidence:{...original.evidence,journeyRevision:'art-profile-50-v3'}};
  const revised=buildJourneyRounds(works,{}, {panels:selection,history:[saved]}),map=revised.find(round=>round.kind==='grid'&&round.evidence.panelNumber===panelNumber),rebound=bindJourneyStimulusPlan(selection,revised);
  assert.deepEqual(revised.find(round=>round.id===saved.id),saved);assert.deepEqual(new Set(workIds(map)),new Set(workIds(saved)));assert.equal(map.evidence.panelBindingMismatch,true);assert.equal(map.evidence.plannerDiagnostic,undefined);assert.equal(map.evidence.editorialBrief,undefined);assert.equal(map.evidence.adaptiveSelection,undefined);assert.equal(rebound.bindingStatus,'saved-or-fallback-bindings');assert.equal(rebound.firstPlan,null);assert.ok(rebound.proposalMismatchPanels.includes(panelNumber));assert.equal(rebound.boundMainWorkCount,new Set(preferencePanels(revised).flatMap(workIds)).size);
});

test('Historicalv8 round47 retains its delayed exact quartet instrument and evidence',()=>{
  const rounds=legacyV8Rounds(works),repeat=rounds[46],source=rounds.find(round=>round.id===repeat.evidence.repeatOf);assert.ok(source);assert.equal(repeat.kind,'spectrum');assert.equal(repeat.evidence.role,'repeat');assert.equal(repeat.evidence.lateExactReturn,true);assert.notEqual(source.id,rounds[0].id);assert.equal(source.works.length,4);assert.equal(source.evidence.role,'discovery');assert.equal(source.evidence.unconditional===false,false);
  assert.deepEqual(workIds(repeat),[...workIds(source)].reverse());assert.equal(repeat.title,source.title);assert.equal(repeat.hint,source.hint);assert.deepEqual(repeat.scale,source.scale);assert.equal(repeat.evidence.sourceSetId,source.evidence.setId);assert.equal(repeat.evidence.dependencyGroup,source.evidence.setId);assert.deepEqual(repeat.evidence.priorMeasureRoundIds,[source.id]);assert.equal(repeat.evidence.panelNumber,undefined);
  const sourceIds=new Set(workIds(source));let last=-1;
  for(const [index,round] of rounds.slice(0,46).entries())if(round.kind!=='statements'&&[...round.works,...(round.anchorWorks||[])].some(work=>sourceIds.has(work.id)))last=index;
  assert.equal(repeat.evidence.delay.lastArtworkExposureIndex,last);assert.equal(repeat.evidence.delay.interveningRoundCount,46-last-1);assert.ok(46-last-1>=8);assert.ok(last>=35,'The full museum library is conservatively included');assert.ok(!workIds(rounds[45]).some(id=>sourceIds.has(id)),'Sorting46 cannot expose a delayed quartet');
  const answer=round=>({workIds:workIds(round),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,workIds(source).indexOf(work.id)*30])),confirmed:true}),answers={[source.id]:answer(source),[repeat.id]:answer(repeat)};
  assert.ok(validStudyAnswer(source,answers[source.id]));assert.ok(validStudyAnswer(repeat,answers[repeat.id]));assert.equal(analyzeStudy(works,[source,repeat],answers).repeatsCompared,1);assert.equal(analyzeStudy(works,[source,repeat],{[repeat.id]:answers[repeat.id]}).repeatsCompared,0);assert.equal(analyzeStudy(works,[source,repeat],{...answers,[repeat.id]:{...answers[repeat.id],confirmed:false}}).repeatsCompared,0);
});

test('An already shown v3 shortlist remains exact wherev10 now defers a closing comparison',()=>{
  const old=legacyV8Rounds(works)[8],saved={...structuredClone(old),id:'journey-047',title:'The v3 shortlist actually shown.',evidence:{...old.evidence,journeyRevision:'art-profile-50-v3'}},before=structuredClone(saved),restored=buildJourneyRounds(works,{}, {history:[saved]});assert.deepEqual(restored[46],before);assert.deepEqual(saved,before);
});

test('The extra comparison links two earlier panels as a probe rather than a nineteenth discovery set',()=>{
  const rounds=legacyV8Rounds(works),preference=rounds.filter(r=>r.evidence.construct==='preference'),bridge=preference.find(r=>r.evidence.bridgeComparison);
  assert.equal(preference.length,20);assert.equal(preferencePanels(rounds).length,18);assert.equal(bridge.id,'journey-049');assert.equal(bridge.evidence.role,'probe');assert.equal(bridge.evidence.panelNumber,undefined);assert.equal(bridge.works.length,2);
  assert.equal(bridge.evidence.heldOut,undefined);assert.equal(bridge.evidence.provisionalPrediction,undefined);
  const earlier=preferencePanels(rounds),parents=bridge.works.map(work=>earlier.find(r=>workIds(r).includes(work.id)));assert.ok(parents.every(Boolean));assert.notEqual(parents[0].id,parents[1].id);
  assert.equal(bridge.evidence.subjectBaselinePreparation.status,'ready');assert.equal(bridge.evidence.preparesContrastContentId,'subject-mountains');
  assert.ok(!earlier.some(r=>workIds(bridge).every(id=>workIds(r).includes(id))));
});

test('Source backlinks identify real instruments without importing unrelated predictions',()=>{
  const source=new Map(buildStudyRounds(works,200).map(r=>[r.id,r]));
  const rounds=buildJourneyRounds(works),normal=rounds.filter(r=>r.kind!=='exercise'&&!isFinalRefinementRound(r)),banked=normal.filter(r=>r.bankRoundId),newInstruments=normal.filter(r=>!r.bankRoundId);
  assert.equal(new Set(banked.map(r=>r.bankRoundId)).size,banked.length);
  for(const round of normal){
    assert.equal(round.evidence.journeyRevision,JOURNEY_REVISION);
    for(const key of ['heldOut','provisionalPrediction','trainingRoundIds','comparisonNovel','contrastKey'])assert.equal(round.evidence[key],undefined);
  }
  for(const round of banked){assert.ok(source.has(round.bankRoundId));assert.equal(source.get(round.bankRoundId).kind,round.kind);assert.equal(round.evidence.sourceBankRoundId,round.bankRoundId);assert.equal(round.evidence.sourceBinding,'journey-selected-works');}
  assert.equal(newInstruments.length+banked.length,41);assert.equal(banked.length,21);assert.equal(newInstruments.length,20);
  for(const round of newInstruments){assert.ok(['grid','choice-grid','contrast','context'].includes(round.kind));assert.equal(round.evidence.newInstrument,true);assert.ok(round.evidence.instrumentRevision);assert.equal(round.evidence.sourceBankRoundId,undefined);assert.equal(round.evidence.sourceBinding,undefined);assert.ok(round.evidence.sourceUrls.length);for(const url of round.evidence.sourceUrls)assert.equal(new URL(url).protocol,'https:');assert.ok(round.evidence.limits.length);}
});

test('Missing descriptors remain missing and do not prevent a sourced work being shown',()=>{
  const unannotated={...works[0],id:'sourced-unannotated-work',title:'A sourced work awaiting descriptors',features:undefined,analysis:undefined};
  // A 54-work pool supplies exactly the 18 initial triads. A larger live
  // catalogue intentionally leaves some works for later batches.
  const collection=[...works.slice(0,53),unannotated],copy=structuredClone(collection),rounds=buildJourneyRounds(collection);
  const bound=rounds.filter(r=>r.evidence.construct==='preference').flatMap(r=>r.works).find(w=>w.id===unannotated.id);
  assert.ok(bound);assert.equal(bound.features,undefined);
  assert.deepEqual(collection,copy);
});

test('Shown round wording stays fixed while its later cross-task binding remains exact',()=>{
  const first=buildJourneyRounds(works),shown=structuredClone(first[0]);shown.title='The wording that was actually shown.';
  const history=[shown],copy=structuredClone(history),next=buildJourneyRounds(works,{}, {history});
  assert.deepEqual(next[0],shown);assert.deepEqual(history,copy);
  const paired=next.filter(r=>r.evidence.setId===shown.evidence.setId&&r.id!==shown.id);assert.equal(paired.length,1);
  assert.deepEqual(new Set(workIds(paired[0])),new Set(workIds(shown)));
  assert.equal(paired[0].axis,'achievement');
});

test('A frozen earlier preference and curiosity pairing still produces its original evidence chain',()=>{
  const offered=buildJourneyRounds(works)[0].works,preference={id:'journey-001',kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place each painting by preference.',works:offered,evidence:{journeyRevision:'art-profile-50-v2',construct:'preference',family:'individual-choice',role:'discovery',setId:'frozen-v2-panel'}},curiosity={id:'journey-009',kind:'spectrum',criterion:'interest',title:'How much do you want to understand each painting?',hint:'Rate your wish to investigate.',works:[...offered].reverse(),evidence:{journeyRevision:'art-profile-50-v2',construct:'curiosity',family:'interest',role:'check',setId:'frozen-v2-panel'}},rounds=[preference,curiosity];
  const order=workIds(preference),positions=Object.fromEntries(order.map((id,i)=>[id,5+i*30]));
  const answers={
    [preference.id]:{workIds:workIds(preference),criterion:'preference',positions,confirmed:true},
    [curiosity.id]:{workIds:workIds(curiosity),criterion:'interest',positions:Object.fromEntries(order.map(id=>[id,100-positions[id]])),confirmed:true}
  };
  const result=analyzeStudy(works,rounds,answers),finding=result.findings.find(item=>item.id==='study-curiosity');
  assert.ok(finding);assert.deepEqual(new Set(finding.support.map(item=>item.roundId)),new Set([preference.id,curiosity.id]));
});

test('A further batch has new presentation and panel IDs with correctly offset special links',()=>{
  const first=buildJourneyRounds(works),second=buildJourneyRounds(works,{}, {batchIndex:1,offset:50,history:first,seed:'next-batch'});
  assert.equal(second.length,50);assert.equal(second[0].id,'journey-051');assert.equal(second.at(-1).id,'journey-100');
  assert.ok(second.every(r=>!first.some(earlier=>earlier.id===r.id)));
  assert.ok(second.filter(r=>r.evidence.panelNumber).every(r=>!first.some(earlier=>earlier.evidence.setId===r.evidence.setId)));
  assert.deepEqual(second.flatMap((r,i)=>r.kind==='exercise'?[[i+51,r.exerciseKind]]:[]),[[58,'sorting'],[72,'difficult-edit'],[82,'sorting'],[86,'curate']]);
  assert.equal(second[31].evidence.repeatOf,second[7].id);
  assert.equal(second[30].evidence.contextRoundId,second[34].id);assert.equal(second[34].evidence.claimRoundId,second[30].id);
  assert.notEqual(second[34].works[0].id,first[34].works[0].id);
  assert.equal(second[34].evidence.storyPreviouslyShown,false);
  assert.ok(second.every(r=>restoreStudyRound(snapshotStudyRound(r),works)));
});

test('An adaptive exact repeat keeps its real prompt and set while crossed comparisons stay probes',()=>{
  const first=buildJourneyRounds(works),source=structuredClone(first[0]);
  source.title='The original preference question.';source.hint='An instruction captured at its first presentation.';source.scale={left:'The original left end',right:'The original right end'};
  first[0]=source;
  const panels=preferencePanels(first).map(r=>({workIds:workIds(r),construct:'preference',role:'discovery',selectionReason:'Underexposed comparison.',evidenceRoundIds:[]}));
  panels[0]={...panels[0],role:'repeat',exactRepeat:true,repeatOf:source.id,promptSnapshot:snapshotStudyRound(source),selectionReason:'Delayed check of a previous ordering.',evidenceRoundIds:[source.id]};
  panels[1]={...panels[1],role:'probe',selectionReason:'New crossing of previously rated works.'};
  const copy=structuredClone(panels),second=buildJourneyRounds(works,{}, {batchIndex:1,offset:50,panels:{panels},history:first});
  const repeated=second[0];
  assert.equal(repeated.title,source.title);assert.equal(repeated.hint,source.hint);assert.deepEqual(repeated.scale,source.scale);
  assert.deepEqual(workIds(repeated),workIds(source).reverse());assert.equal(repeated.evidence.repeatOf,source.id);assert.equal(repeated.evidence.role,'repeat');
  assert.equal(repeated.evidence.selectionMethod,'adaptive-panel-plan');assert.deepEqual(repeated.evidence.evidenceRoundIds,[source.id]);
  const paired=second.find(r=>r.evidence.panelNumber===1&&r.kind==='grid');assert.ok(paired);assert.deepEqual(new Set(workIds(paired)),new Set(workIds(source)));
  const probe=second.find(r=>r.evidence.panelNumber===2&&r.evidence.construct==='preference');
  assert.equal(probe.evidence.role,'probe');assert.equal(probe.evidence.repeatOf,undefined);assert.equal(probe.evidence.exactRepeat,undefined);
  assert.deepEqual(panels,copy);
});

test('A changed artwork set or contextual source cannot masquerade as an exact repeat',()=>{
  const first=buildJourneyRounds(works),panels=preferencePanels(first).map(r=>({workIds:workIds(r),construct:'preference',role:'discovery'}));
  const options={batchIndex:1,offset:50,history:first,panels};
  panels[0]={...panels[0],role:'repeat',exactRepeat:true,repeatOf:first[0].id};
  panels[0].workIds=[...workIds(first[0]).slice(1),works.find(work=>!workIds(first[0]).includes(work.id)).id];
  assert.throws(()=>buildJourneyRounds(works,{},options),/identical artwork set/);
  panels[0]={workIds:workIds(first[0]),construct:'preference',role:'repeat',exactRepeat:true,repeatOf:'other',promptSnapshot:{...snapshotStudyRound(first[0]),evidence:{construct:'perceived-visual-density'}}};
  assert.throws(()=>buildJourneyRounds(works,{},options),/original unconditional prompt/);
  for(const mutate of [round=>round.evidence.family='contextual-choice',round=>round.evidence.unconditional=false,round=>round.brief='Choose for a particular room.',round=>round.anchorWorks=[works[8]]]){
    const contextual=structuredClone(first[0]);mutate(contextual);panels[0]={workIds:workIds(first[0]),construct:'preference',role:'repeat',exactRepeat:true,repeatOf:contextual.id};assert.throws(()=>buildJourneyRounds(works,{}, {...options,history:[contextual]}),/original unconditional prompt/);
  }
});
