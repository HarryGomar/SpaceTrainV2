import test from 'node:test';
import assert from 'node:assert/strict';
import {selectResponseInquiry} from '../../public/art-atlas/response-inquiries.mjs';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {AXES,validAnswer} from '../../public/art-atlas/engine.mjs';
import {collectTastePatternSources} from '../../public/art-atlas/taste-axes.mjs';
import {buildDiagnosticRound,bindDiagnosticRound} from '../../public/art-atlas/explanation-followups.mjs';

function fixture(axis='returnResponse'){
  const works=Array.from({length:8},(_,i)=>({id:'m'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const rounds=[0,1].map(i=>withContinuousPreference({id:'p'+i,kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}));
  const answers=Object.fromEntries(rounds.map(r=>[r.id,{workIds:r.works.map(w=>w.id),criterion:'preference',confirmed:true,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,40+i*2]))}]));
  const map={id:'map',kind:'grid',axis,axisDefinition:structuredClone(AXES[axis]),works:works.slice(0,2),evidence:{construct:{returnResponse:'tension-and-return',achievement:'perceived-achievement',attention:'reported-attention',connection:'connection'}[axis]}};
  rounds.push(map);answers.map={workIds:['m0','m1'],axis,confirmed:true,points:axis==='returnResponse'?{m0:[90,90],m1:[90,10]}:{m0:[20,90],m1:[25,10]}};
  return {works,rounds,answers,id:'journey-100',batchIndex:1,candidateIds:works.map(w=>w.id)};
}

test('The live question chooses a return map with a real boundary and an unmeasured appeal-matched work',()=>{
  const f=fixture(),before=structuredClone(f),offer=selectResponseInquiry(f);assert.ok(offer);assert.equal(offer.round.kind,'grid');assert.equal(offer.round.axis,'returnResponse');assert.equal(offer.categoryId,'return');assert.equal(offer.round.works.length,3);
  const evidence=offer.round.evidence.responseInquiry;assert.equal(evidence.anchorId,'m0');assert.equal(evidence.boundaryId,'m1');assert.equal(evidence.unmeasuredWorkIds.length,1);assert.equal(evidence.prediction,null);assert.equal(evidence.cost.placements,3);assert.equal(evidence.cost.separateJudgments,6);assert.deepEqual(f,before);
  const answer={workIds:offer.round.works.map(w=>w.id),axis:offer.round.axis,confirmed:true,points:Object.fromEntries(offer.round.works.map(w=>[w.id,[60,80]]))};assert.ok(validAnswer(offer.round,answer));
  f.rounds.push(offer.round);f.answers[offer.round.id]=answer;assert.equal(selectResponseInquiry({...f,id:'next'}),null,'One response follow-up per block prevents a map loop');
});

test('The later flexible slot can bind a response interaction rather than another appeal line',()=>{
  const f=fixture(),pending=buildDiagnosticRound({works:f.works,id:f.id});pending.evidence={...pending.evidence,batchIndex:1,diagnostic:{...pending.evidence.diagnostic,policy:'appeal-investigation-v1',inquiryMode:'transfer',interactionPolicy:'choose-measure'}};
  const bound=bindDiagnosticRound({...f,round:pending,selection:{batchIndex:1,candidateIds:f.candidateIds}});assert.equal(bound.kind,'grid');assert.equal(bound.evidence.diagnostic.kind,'response-inquiry');assert.equal(bound.evidence.diagnostic.binding,'bound');
  const frozen=structuredClone(bound);f.answers.map.points.m0=[50,50];assert.deepEqual(bindDiagnosticRound({...f,round:bound}),frozen,'The question already shown remains frozen');
});

test('Similar appeal with different attention can choose the later map even when both paintings appeal', () => {
  const f = fixture('attention');
  Object.assign(f.answers.p0.positions, {m0:71, m1:68});
  Object.assign(f.answers.p1.positions, {m4:70});
  f.answers.map.points = {m0:[71,82], m1:[68,27]};
  const pending = buildDiagnosticRound({works:f.works, id:f.id});
  pending.evidence.batchIndex = 1;
  Object.assign(pending.evidence.diagnostic, {
    policy:'appeal-investigation-v1', inquiryMode:'transfer', interactionPolicy:'choose-measure'
  });
  const bound = bindDiagnosticRound({...f, round:pending, selection:{batchIndex:1, candidateIds:f.candidateIds}});
  assert.equal(bound.axis, 'attention');
  assert.equal(bound.evidence.diagnostic.kind, 'response-inquiry');
  const inquiry = bound.evidence.responseInquiry;
  assert.deepEqual(bound.works.map(work => work.id), ['m0', 'm1', 'm4']);
  assert.deepEqual(inquiry.sourceMap.points, f.answers.map.points);
  assert.deepEqual(inquiry.unmeasuredWorkIds, ['m4']);
  assert.match(inquiry.question, /appeal about equally/);
  assert.equal(inquiry.prediction, null);

  // Same order, but the small attention gap leaves no reason to repeat the map.
  f.answers.map.points.m1 = [68,79];
  assert.equal(selectResponseInquiry(f), null);
});

test('A matched admiration comparison holds admiration steady while appeal varies', () => {
  const f = fixture('achievement');
  f.answers.map.points = {m0:[77,75], m1:[42,71]};
  const inquiry = selectResponseInquiry(f)?.round.evidence.responseInquiry;
  assert.equal(inquiry?.boundaryId, 'm1');
  assert.match(inquiry.question, /admire about equally/);
  // The same appeal gap with a much larger admiration gap is a different result.
  f.answers.map.points.m1 = [42,42];
  assert.equal(selectResponseInquiry(f), null);
});

test('A selected admiration check is related evidence, never a second independent discovery group',()=>{
  const f=fixture('achievement'),offer=selectResponseInquiry(f);assert.ok(offer);const initial=collectTastePatternSources(f);assert.equal(initial.admiration.sets.length,1);
  f.rounds.push(offer.round);f.answers[offer.round.id]={workIds:offer.round.works.map(w=>w.id),axis:'achievement',confirmed:true,points:Object.fromEntries(offer.round.works.map(w=>[w.id,[30,90]]))};
  const later=collectTastePatternSources(f);assert.equal(later.admiration.sets.length,1);assert.equal(later.admiration.checks.length,1);assert.equal(later.preferenceScopes[0].sets.length,initial.preferenceScopes[0].sets.length);
});

test('Appeal alone, neutral maps, changed axes and exhausted targets leave the interaction open',()=>{
  const f=fixture();assert.equal(selectResponseInquiry({...f,rounds:f.rounds.slice(0,2)}),null);
  f.answers.map.points={m0:[50,50],m1:[50,50]};assert.equal(selectResponseInquiry(f),null);
  const altered=fixture('attention');altered.rounds.at(-1).axisDefinition.yName='Observed viewing time';assert.equal(selectResponseInquiry(altered),null);
  assert.equal(selectResponseInquiry({...fixture(),candidateIds:['m0','m1']}),null);
});
