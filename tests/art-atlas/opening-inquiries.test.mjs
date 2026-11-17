import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../../public/art-atlas/artworks.json' with {type:'json'};
import reviews from '../../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {isContinuousPreferenceRound,withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {selectOpeningInquiry,readOpeningInquiries,OPENING_COMPARISONS} from '../../public/art-atlas/opening-inquiries.mjs';
import {selectAppealInvestigation} from '../../public/art-atlas/appeal-investigations.mjs';
import {buildProfileIntelligence,openingInquiryReadings} from '../../public/art-atlas/profile-intelligence.mjs';
import {collectTastePatternSources} from '../../public/art-atlas/taste-axes.mjs';

const ids=round=>round.works.map(work=>work.id),landscape=work=>reviews.reviews[work.id]?.attributes.landscape.status==='present';
function replay(rate,length=50){
  const data=prepareJourneySession(null,catalogue,100);data.manifest.id='synthetic-opening-verification';
  const rounds=[];
  for(let index=0;index<length;index++){
    data.index=index;const round=sessionJourneyRounds(data)[index];rounds.push(round);
    if(!round.unavailable)data.shown[round.id]=snapshotStudyRound(round);
    const answer=!round.unavailable&&isContinuousPreferenceRound(round)?{criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map(work=>[work.id,rate(work,index)])),confirmed:true}:{workIds:ids(round),skipped:true};
    assert.ok(validStudyAnswer(round,answer)||answer.skipped,round.id);data.answers[round.id]=answer;
  }
  return {works:catalogue,rounds,answers:data.answers,data};
}

test('Actual fresh landscapes earn early within-Monet and urban boundary comparisons without enlarging discovery evidence',()=>{
  const run=replay(work=>landscape(work)?92:18),questions=run.rounds.filter(round=>round.evidence.openingInquiry);
  assert.ok(questions.some(round=>Number(round.id.slice(8))<=18&&ids(round).includes('study-monet-japanese-footbridge')));
  assert.ok(questions.some(round=>ids(round).includes('piazza-san-marco')));
  for(const round of questions){
    const inquiry=round.evidence.openingInquiry;
    assert.equal(inquiry.candidate.theme,'landscape');assert.ok(inquiry.sourceSnapshots.length>=2);
    assert.ok(inquiry.controls.usable);assert.equal(round.evidence.role,'probe');
    assert.ok(inquiry.candidate.groups.some(group=>group.signedGap>=25));
    assert.ok(inquiry.pulledForwardIds.length<=1);
  }
  const sources=collectTastePatternSources(run).preferenceScopes.find(scope=>scope.channel==='personal-appeal');
  for(const round of questions)assert.ok(!sources.sets.some(set=>set.entry.round.id===round.id));
  const readings=readOpeningInquiries(run);assert.equal(readings.length,questions.length);
  const profile=buildProfileIntelligence(run);
  assert.ok(profile.observations.some(item=>item.id.startsWith('intelligence-opening-')));
  assert.ok(openingInquiryReadings(run).every(item=>item.status!=='supported'&&item.discoveryVote===false&&item.text.includes('reason remains open')));
  assert.equal(run.data.plan.length,50);
});

test('The same artwork order with small gaps explores broadly; all-high, all-low and exact ties do too',()=>{
  for(const rate of [work=>landscape(work)?56:53,()=>99,()=>1,()=>50]){
    const run=replay(rate,23),questions=run.rounds.filter(round=>round.evidence.diagnostic);
    assert.ok(questions.length>=4);
    assert.ok(questions.every(round=>!round.evidence.openingInquiry&&!round.evidence.appealInvestigation));
    assert.ok(questions.every(round=>round.evidence.diagnostic.kind==='breadth-exploration'));
  }
});

test('Strong abstract appeal earns geometry, colour-field and paint-mark comparisons, retaining negative evidence',()=>{
  const run=replay(work=>work.features.abstraction>=.9?92:18),questions=run.rounds.filter(round=>round.evidence.openingInquiry);
  assert.equal(questions[0].id,'journey-009');
  assert.ok(questions.some(round=>ids(round).includes('add-rothko-orange-yellow')&&ids(round).includes('mondrian-composition')));
  assert.ok(questions.some(round=>ids(round).includes('add-herrera-cobalt-white')&&ids(round).includes('add-pollock-convergence')));
  assert.ok(questions.every(round=>round.evidence.openingInquiry.candidate.theme==='abstract'));
  assert.ok(questions.some(round=>round.evidence.openingInquiry.candidate.groups.some(group=>group.comparisonType==='levels-only'&&group.signedGap===null)));
  const dislike=replay(work=>landscape(work)?8:82,18);
  assert.ok(dislike.rounds.some(round=>round.evidence.openingInquiry?.candidate.direction===-1));
});

test('An isolated standout earns a local check and no recurring subject claim',()=>{
  const run=replay(work=>work.id==='add-warhol-gold-marilyn'?98:49,18),question=run.rounds.find(round=>round.evidence.appealInvestigation);
  assert.equal(question.id,'journey-009');
  assert.ok(question.evidence.appealInvestigation.anchorIds.includes('add-warhol-gold-marilyn'));
  assert.ok(run.rounds.every(round=>!round.evidence.openingInquiry));
});

test('Captured inquiry readings preserve ties, below-neutral answers and original source responses after editing',()=>{
  const run=replay(work=>landscape(work)?92:18,18),question=run.rounds.find(round=>round.evidence.openingInquiry);
  assert.ok(question);
  for(const [values,outcome]of [[[88,88],'close'],[[88,84],'close'],[[22,4],'both-low'],[[92,61],'both-high'],[[92,12],'separated']]){
    const answers={...run.answers,[question.id]:{...run.answers[question.id],positions:Object.fromEntries(ids(question).map((id,index)=>[id,values[index]]))}};
    assert.equal(readOpeningInquiries({...run,answers}).find(item=>item.roundId===question.id)?.outcome,outcome);
  }
  const sourceId=question.evidence.openingInquiry.sourceSnapshots[0].round.id,edited=structuredClone(run.answers);
  for(const id of edited[sourceId].workIds)edited[sourceId].positions[id]=50;
  assert.equal(readOpeningInquiries({...run,answers:edited}).find(item=>item.roundId===question.id).sourceChanged,true);
  for(const replacement of [{...run.answers[sourceId],skipped:true},{...run.answers[sourceId],confirmed:false},undefined]){
    const answers={...run.answers,[sourceId]:replacement};
    assert.equal(readOpeningInquiries({...run,answers}).find(item=>item.roundId===question.id)?.outcome,'historical');
  }
  const skipped=structuredClone(run.data);skipped.answers[sourceId]={workIds:run.answers[sourceId].workIds,skipped:true};
  const skippedRestore=prepareJourneySession(skipped,catalogue,250);
  assert.equal(readOpeningInquiries({...run,rounds:sessionJourneyRounds(skippedRestore),answers:skippedRestore.answers}).find(item=>item.roundId===question.id)?.outcome,'historical');
  const restored=prepareJourneySession(run.data,catalogue,200);
  assert.deepEqual(snapshotStudyRound(sessionJourneyRounds(restored).find(round=>round.id===question.id)),snapshotStudyRound(question));
  const current=OPENING_COMPARISONS.find(pair=>pairKey(pair.workIds)===pairKey(ids(question))),oldReason=current.reason;
  try{current.reason='A future editorial wording change.';assert.ok(readOpeningInquiries(run).some(item=>item.roundId===question.id&&item.comparison.reason===oldReason));}finally{current.reason=oldReason;}
});

const pairKey=ids=>JSON.stringify([...ids].sort());
test('Opening inquiries and isolated-anchor investigations share the one-work early-release budget',()=>{
  const run=replay(work=>landscape(work)?92:18,18),inquiries=run.rounds.filter(round=>round.evidence.openingInquiry?.pulledForwardIds.length);
  assert.equal(inquiries.length,1);
  const source=withContinuousPreference({id:'budget-source',kind:'spectrum',criterion:'preference',works:['monet-water-lilies','holbein-ambassadors'].map(id=>catalogue.find(work=>work.id===id)),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
  const answers={[source.id]:{criterion:'preference',workIds:ids(source),positions:{'monet-water-lilies':98,'holbein-ambassadors':10},confirmed:true}};
  const parameters={works:catalogue,id:'journey-023',batchIndex:0,candidateIds:['study-van-gogh-sunflowers'],earlyIds:['extended-cma-150693'],answers};
  const viable=selectAppealInvestigation({...parameters,rounds:[source]});
  assert.deepEqual(viable.round.evidence.appealInvestigation.pulledForwardIds,['extended-cma-150693']);
  const next=selectAppealInvestigation({...parameters,rounds:[source,inquiries[0]]});
  assert.equal(next,null);
  const mixed=replay(work=>landscape(work)?92:work.features.abstraction>=.9?78:18);
  assert.ok(mixed.rounds.reduce((count,round)=>count+(round.evidence.openingInquiry?.pulledForwardIds.length||0)+(round.evidence.appealInvestigation?.pulledForwardIds.length||0),0)<=1);
});

test('Unknown reviews, invalid answers and changed reproduction identities cannot nominate an opening inquiry',()=>{
  const run=replay(work=>landscape(work)?92:18,14),empty={...reviews,reviews:{}};
  assert.equal(selectOpeningInquiry({...run,id:'journey-015',annotationReviews:empty}),null);
  const invalid=Object.fromEntries(Object.entries(run.answers).map(([id,answer])=>[id,{...answer,confirmed:false}]));
  assert.equal(selectOpeningInquiry({...run,answers:invalid,id:'journey-015'}),null);
  const changed=run.rounds.map(round=>({...round,works:round.works.map(work=>({...work,image:'assets/wrong-image.jpg'}))}));
  assert.equal(selectOpeningInquiry({...run,rounds:changed,id:'journey-015'}),null);
});
