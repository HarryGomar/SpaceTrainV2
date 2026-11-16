import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiagnosticRound,bindDiagnosticRound} from '../../public/art-atlas/explanation-followups.mjs';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {createSortingRecord,validSorting} from '../../public/art-atlas/sorting-table.mjs';
import {validAnswer} from '../../public/art-atlas/engine.mjs';
import {buildProfileIntelligence} from '../../public/art-atlas/profile-intelligence.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound} from '../../public/art-atlas/deep-study.mjs';
import CATALOGUE from '../../public/art-atlas/artworks.json' with {type:'json'};

function fixture(){
  const works=Array.from({length:16},(_,i)=>({id:'f'+i,title:'Fixture '+i,artist:'Artist '+i,artistKnown:true,image:'assets/f'+i+'.jpg',sourceUrl:'https://museum.example/'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((w,i)=>[w.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:w.sourceUrl,image:w.image,previewSha256:w.sha256},reviewedAsset:{image:w.image,sha256:w.sha256,width:600,height:400,compositionMatch:'same-composition',mediaBinding:'source-matched'},sourceUrls:[w.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(k=>[k,{status:k==='narrative-detail'?(i%4===0||i%4===2?'present':'absent'):k==='layered-space'?(i%4===0||i%4===3?'present':'absent'):'absent',reason:'Synthetic reviewed crossing.',evidenceKind:'visual-review'}]))}]))};
  const rounds=Array.from({length:3},(_,i)=>withContinuousPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,{workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map((w,i)=>[w.id,[95,5,75,70][i]])),confirmed:true}]));
  return {works,rounds,answers,annotationReviews};
}

test('The next appeal pair separates two quality explanations with frozen source answers and predictions',()=>{
  const f=fixture(),pending=buildDiagnosticRound({works:f.works,id:'journey-015'}),original=structuredClone(f),r=bindDiagnosticRound({round:pending,...f}),d=r.evidence.diagnostic;
  assert.equal(r.unavailable,undefined);assert.equal(r.kind,'spectrum');assert.equal(r.evidence.role,'probe');assert.equal(d.kind,'quality');assert.equal(d.hypotheses.length,2);assert.notEqual(d.predictions[0],d.predictions[1]);assert.equal(d.comparisonNovel,true);assert.equal(d.sourceSnapshots.length,3);assert.deepEqual(f,original);
  const frozen=structuredClone(r);f.answers['journey-001'].positions.f0=0;assert.deepEqual(bindDiagnosticRound({round:r,...f}),frozen);
  const answer={workIds:r.workIds,criterion:'preference',positions:Object.fromEntries(r.workIds.map((id,i)=>[id,i?10:90])),confirmed:true};assert.ok(validAnswer(r,answer));
  const report=buildProfileIntelligence({...f,rounds:[...f.rounds,r],answers:{...f.answers,[r.id]:answer}});assert.equal(report.diagnostics.checks.length,1);assert.equal(report.diagnostics.checks[0].discoveryVote,false);assert.equal(report.diagnostics.checks[0].signedGap,80);
});

test('Ties remain an unresolved diagnostic; source and prediction mismatches fail closed',()=>{
  const f=fixture(),r=bindDiagnosticRound({round:buildDiagnosticRound({works:f.works,id:'journey-015'}),...f}),answer={workIds:r.workIds,criterion:'preference',positions:Object.fromEntries(r.workIds.map(id=>[id,90])),confirmed:true},run=round=>buildProfileIntelligence({...f,rounds:[...f.rounds,round],answers:{...f.answers,[r.id]:answer}});
  assert.equal(run(r).diagnostics.checks[0].status,'close');assert.match(run(r).diagnostics.observations[0].text,/tied/);
  const bad=structuredClone(r);bad.evidence.diagnostic.predictions=['not-offered','also-not-offered'];assert.equal(run(bad).diagnostics.checks.length,0);
  const malformed=structuredClone(r);malformed.evidence.diagnostic.sourceSnapshots[0]=null;assert.equal(run(malformed).diagnostics.checks.length,0);
  // Later edits do not erase the valid answer captured before this check.
  const changed=structuredClone(f);changed.answers['journey-001']={skipped:true};changed.annotationReviews.reviews[r.workIds[0]].attributes.landscape.status='present';
  assert.equal(buildProfileIntelligence({...changed,rounds:[...changed.rounds,r],answers:{...changed.answers,[r.id]:answer}}).diagnostics.checks.length,1);
  // Catalogue provenance hashes are as binding as the top-level alias.
  const provenance=structuredClone(f);for(const work of provenance.works){work.provenance={thumbnailSha256:work.sha256};delete work.sha256;}
  const bound=bindDiagnosticRound({round:buildDiagnosticRound({works:provenance.works,id:r.id}),...provenance});
  assert.equal(buildProfileIntelligence({...provenance,rounds:[...provenance.rounds,bound],answers:{...provenance.answers,[bound.id]:answer}}).diagnostics.checks.length,1);
});

test('An actual nontrivial sorting group chooses source-bound rival companions and remains relatedness evidence',()=>{
  const f=fixture(),sortingWorks=[f.works[0],f.works[4],...f.works.slice(8,14)],record=createSortingRecord(sortingWorks,{},[],{id:'source-sort',now:1,offeredIds:sortingWorks.map(w=>w.id)});
  Object.assign(record,{positions:Object.fromEntries(sortingWorks.map((w,i)=>[w.id,i<2?[.15+i*.04,.2]:[.6+(i%2)*.22,.45+Math.floor((i-2)/2)*.15]])),presentedIds:sortingWorks.map(w=>w.id),stackOrder:sortingWorks.map(w=>w.id),confirmed:true,finishedAt:2});assert.ok(validSorting(record,sortingWorks));
  const source={id:'journey-008',kind:'exercise',exerciseKind:'sorting',works:sortingWorks,evidence:{}},answer={workIds:sortingWorks.map(w=>w.id),record},pending=buildDiagnosticRound({works:f.works,id:'journey-032',kind:'grouping'}),r=bindDiagnosticRound({round:pending,...f,rounds:[...f.rounds,source],answers:{...f.answers,[source.id]:answer}});
  assert.equal(r.kind,'choice-grid');assert.equal(r.selectionMode,'relatedness');assert.equal(r.anchorWorks.length,2);assert.equal(r.evidence.unconditional,false);assert.equal(r.evidence.diagnostic.sourceRoundId,source.id);assert.equal(r.evidence.diagnostic.rivals.length,2);
  const a={workIds:r.workIds,selectionMode:'relatedness',selectedIds:[r.workIds[0]],explicitNone:false,unsure:false,confirmed:true};assert.ok(validAnswer(r,a));
  const result=buildProfileIntelligence({...f,rounds:[...f.rounds,source,r],answers:{...f.answers,[source.id]:answer,[r.id]:a}});assert.equal(result.grouping.observations[0].preferenceVote,false);
  assert.equal(result.grouping.observations[0].support[0].roundId,source.id);
  const swapped=structuredClone(r);[swapped.evidence.diagnostic.rivals[0].workId,swapped.evidence.diagnostic.rivals[1].workId]=[swapped.evidence.diagnostic.rivals[1].workId,swapped.evidence.diagnostic.rivals[0].workId];
  assert.equal(buildProfileIntelligence({...f,rounds:[...f.rounds,source,swapped],answers:{...f.answers,[source.id]:answer,[r.id]:a}}).grouping.observations.length,0);
  const malformed=structuredClone(r);malformed.evidence.diagnostic.rivals={};
  assert.equal(buildProfileIntelligence({...f,rounds:[...f.rounds,source,malformed],answers:{...f.answers,[source.id]:answer,[r.id]:a}}).grouping.responses.length,0);
  const missing=buildProfileIntelligence({...f,rounds:[...f.rounds,r],answers:{...f.answers,[r.id]:a}});assert.equal(missing.grouping.observations.length,0);
  const skipped=bindDiagnosticRound({round:pending,...f,rounds:[...f.rounds,source],answers:{...f.answers,[source.id]:{...answer,skipped:true}}});assert.equal(skipped.evidence.diagnostic.kind,'appeal-fallback');
  const stacked=structuredClone(answer);for(const id of stacked.record.offeredIds)stacked.record.positions[id]=[.5,.5];assert.ok(validSorting(stacked.record,sortingWorks));
  const noSeparation=bindDiagnosticRound({round:pending,...f,rounds:[...f.rounds,source],answers:{...f.answers,[source.id]:stacked}});assert.equal(noSeparation.evidence.diagnostic.kind,'appeal-fallback');
});

test('A single stack cannot be mined for grouping motives; missing reviews produce an explicit appeal fallback',()=>{
  const f=fixture(),r=bindDiagnosticRound({round:buildDiagnosticRound({works:f.works,id:'journey-032',kind:'grouping'}),...f});assert.equal(r.kind,'spectrum');assert.equal(r.evidence.diagnostic.kind,'appeal-fallback');assert.match(r.evidence.diagnostic.reason,/No completed earlier sorting/);
  const unknown=bindDiagnosticRound({round:buildDiagnosticRound({works:f.works,id:'journey-015'}),...f,annotationReviews:{}});assert.equal(unknown.evidence.diagnostic.kind,'appeal-fallback');assert.equal(unknown.evidence.diagnostic.prediction,null);
});

test('Future answers cannot select a deferred comparison and shown snapshots never rebind',()=>{
  const f=fixture(),pending=buildDiagnosticRound({works:f.works,id:'journey-002'}),r=bindDiagnosticRound({round:pending,...f});assert.equal(r.evidence.diagnostic.kind,'appeal-fallback');assert.deepEqual(r.evidence.diagnostic.sourceRoundIds,['journey-001']);
  const data=prepareJourneySession(null,CATALOGUE,1),initial=sessionJourneyRounds(data);assert.equal(initial.length,50);assert.equal(initial.filter(r=>r.kind==='match').length,1);assert.equal(initial.filter(r=>r.axis==='achievement').length,3);assert.equal(initial.filter(r=>r.axis==='attention').length,1);assert.equal(initial.filter(r=>r.axis==='connection').length,1);
  for(let i=0;i<14;i++){const round=sessionJourneyRounds(data)[i];if(round.unavailable)continue;data.shown[round.id]=snapshotStudyRound(round);if(round.kind==='spectrum')data.answers[round.id]={workIds:round.works.map(w=>w.id),criterion:round.criterion,positions:Object.fromEntries(round.works.map((w,index)=>[w.id,90-index*20])),confirmed:true};else data.answers[round.id]={skipped:true,workIds:round.works.map(w=>w.id)};}
  data.index=14;const bound=sessionJourneyRounds(data)[14];assert.equal(bound.unavailable,undefined);data.shown[bound.id]=snapshotStudyRound(bound);const copy=structuredClone(bound);data.answers['journey-001'].positions[initial[0].works[0].id]=0;assert.deepEqual(sessionJourneyRounds(data)[14],restoreStudyRound(snapshotStudyRound(copy),data.manifest.catalogue));
});
