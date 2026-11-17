import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {buildTasteInquiry,selectTasteInquiry,freezeAppealForecast,evaluateAppealForecasts,inquirySensitivity,readTasteInquiryChecks,inquiryObservations} from '../../public/art-atlas/taste-inquiry.mjs';
import {buildProfileIntelligence} from '../../public/art-atlas/profile-intelligence.mjs';
import {AXES} from '../../public/art-atlas/engine.mjs';
import {buildDiagnosticRound,bindDiagnosticRound} from '../../public/art-atlas/explanation-followups.mjs';
import catalogue from '../../public/art-atlas/artworks.json' with {type:'json'};
import catalogueReviews from '../../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {resolveArtworkAttributes} from '../../public/art-atlas/artwork-quality-review.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {buildTastePatterns} from '../../public/art-atlas/taste-patterns.mjs';

function fixture(count=3){
  const works=Array.from({length:count*4+6},(_,i)=>({id:'q'+i,title:'Synthetic painting '+i,artist:'Fixture artist '+i,image:'assets/q'+i+'.jpg',sourceUrl:'https://fixture.invalid/'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const review=Object.fromEntries(works.map((w,i)=>[w.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:w.sourceUrl,image:w.image,previewSha256:w.sha256},reviewedAsset:{image:w.image,sha256:w.sha256,width:1000,height:800,mediaBinding:'synthetic-fixture',compositionMatch:'same-composition'},sourceUrls:[w.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(k=>[k,{status:(k==='dramatic-light'?i%4<2:k==='geometric-structure'?i%2===0:k==='landscape')?'present':'absent',reason:'Synthetic test annotation',evidenceKind:'visual-review'}]))}]));
  const line=(id,ws,role='discovery')=>withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:ws,evidence:{construct:'preference',family:'individual-choice',role}});
  const respond=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:'preference',confirmed:true,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]]))});
  const rounds=Array.from({length:count},(_,i)=>line('source-'+i,works.slice(i*4,i*4+4)));
  const answers=Object.fromEntries(rounds.map(r=>[r.id,respond(r,[95,85,75,5])]));
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:review};
  const candidateIds=works.slice(count*4+1,count*4+3).map(w=>w.id);
  return {works,rounds,answers,annotationReviews,line,respond,candidateIds};
}

test('Recurrence nominates a question; a frozen new-artist success earns prominence and an actual reversal withdraws it',()=>{
  const f=fixture(),before=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers});
  const initial=buildTasteInquiry(f);assert.ok(initial.candidates.some(c=>c.recurring));assert.ok(initial.candidates.every(c=>!c.summaryEligible));
  const next=selectTasteInquiry({...f,id:'check'});assert.ok(next);assert.equal(next.round.works.length,2);
  const t=next.round.evidence.tasteInquiry;assert.equal(t.newArtistTransfer,true);assert.notEqual(t.predictions[0].prediction,t.predictions[1].prediction);
  const values=t.predictions[0].prediction===1?[94,12]:[12,94];
  f.rounds.push(next.round);f.answers.check=f.respond(next.round,values);
  const passed=buildTasteInquiry(f),winner=t.predictions[0].id;assert.equal(passed.candidates.find(c=>c.id===winner).summaryEligible,true);
  const reading=inquiryObservations(passed,f.works).find(o=>o.id==='inquiry-'+winner);
  assert.ok(reading.support.some(e=>e.roundId==='check'&&e.label==='Frozen new-artist transfer check'&&e.detail.includes('Before your answer')));
  assert.equal(passed.discoverySets,3);assert.equal(passed.checks[0].independentDiscoveryVote,false);
  f.answers.check=f.respond(next.round,[...values].reverse());
  const failed=buildTasteInquiry(f).candidates.find(c=>c.id===winner);assert.equal(failed.summaryEligible,false);assert.equal(failed.status,'mixed');assert.equal(failed.reversals.length,1);
  assert.deepEqual(f.works,before.works);assert.deepEqual(f.rounds.slice(0,3),before.rounds);assert.deepEqual(Object.fromEntries(Object.entries(f.answers).filter(([id])=>id!=='check')),before.answers);
});

test('Exact ties, small gaps and high or low clusters do not select a directional account',()=>{
  for(const values of [[90,90,90,90],[99,98,97,96],[4,3,2,1]]){
    const f=fixture();for(const r of f.rounds)f.answers[r.id]=f.respond(r,values);
    assert.equal(selectTasteInquiry({...f,id:'none'}),null);assert.equal(buildTasteInquiry(f).candidates.length,0);
  }
  const f=fixture(),next=selectTasteInquiry({...f,id:'tie'});f.rounds.push(next.round);f.answers.tie=f.respond(next.round,[88,88]);
  const result=buildTasteInquiry(f);assert.equal(result.checks[0].outcome,'close');assert.ok(result.candidates.every(c=>!c.summaryEligible));
});

test('Historical order, unknown reviews, edited training, changed targets and repeated sets cannot manufacture confirmation',()=>{
  const f=fixture(),next=selectTasteInquiry({...f,id:'check'});f.rounds.push(next.round);f.answers.check=f.respond(next.round,[90,10]);
  f.answers['source-0'].positions.q0=50;assert.equal(readTasteInquiryChecks(f)[0].sourceChanged,true);assert.ok(buildTasteInquiry(f).candidates.every(c=>!c.summaryEligible));
  const unknown=fixture();for(const id of unknown.candidateIds)delete unknown.annotationReviews.reviews[id];assert.equal(selectTasteInquiry({...unknown,id:'none'}),null);
  const legacy=fixture();legacy.rounds=legacy.rounds.map(r=>withComparisonPreference({...r,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}));assert.equal(buildTasteInquiry(legacy).discoverySets,0);
  const repeated=fixture(),repeat={...structuredClone(repeated.rounds[0]),id:'repeat',evidence:{...repeated.rounds[0].evidence,role:'repeat',repeatOf:'source-0'}};repeated.rounds.push(repeat);repeated.answers.repeat=repeated.respond(repeat,[99,98,97,96]);assert.equal(buildTasteInquiry(repeated).discoverySets,3);
  const swapped=fixture(),check=selectTasteInquiry({...swapped,id:'bad'}).round;check.works.reverse();swapped.rounds.push(check);swapped.answers.bad=swapped.respond(check,[90,10]);assert.deepEqual(readTasteInquiryChecks(swapped),[]);
});

test('Conditional accounts retain the opposite result outside their context instead of averaging it away',()=>{
  const f=fixture(6);
  for(let i=3;i<6;i++){
    const r=f.rounds[i];f.answers[r.id]=f.respond(r,[20,10,95,85]);
    for(const w of r.works)f.annotationReviews.reviews[w.id].attributes.landscape.status='absent';
  }
  // Use an available fixed conditional question, marks within landscapes.
  for(const w of f.works)f.annotationReviews.reviews[w.id].attributes['visible-paint-marks'].status=f.annotationReviews.reviews[w.id].attributes['dramatic-light'].status;
  const model=buildTasteInquiry(f),conditional=model.candidates.find(c=>c.id==='marks-in-landscapes');
  assert.equal(conditional.direction,1);assert.equal(conditional.supportingSets,3);assert.equal(conditional.outsideContext.opposing,3);assert.equal(conditional.summaryEligible,false);
  assert.equal(model.candidates.find(c=>c.id==='visible-paint-marks'),undefined);
  const sensitivity=inquirySensitivity(f);assert.equal(sensitivity.variants.length,4);assert.ok(sensitivity.variants.every(v=>typeof v.directionChanged==='boolean'));
});

test('A within-artist comparison remains local and cannot count as new-artist transfer',()=>{
  const f=fixture();for(const id of f.candidateIds)f.works.find(w=>w.id===id).artist='Same fixture artist';
  const next=selectTasteInquiry({...f,id:'within',mode:'within-artist'});assert.ok(next);assert.equal(next.round.evidence.tasteInquiry.newArtistTransfer,false);
  f.rounds.push(next.round);f.answers.within=f.respond(next.round,[90,10]);assert.ok(buildTasteInquiry(f).candidates.every(c=>!c.summaryEligible));
});

test('Prospective global predictions are compared to actual held-out levels and a mean-only baseline, with edited sources excluded',()=>{
  const f=fixture(),raw=f.line('heldout',f.works.slice(12,16)),round=freezeAppealForecast({...f,round:raw});
  assert.equal(round.evidence.appealForecast.frozenBeforeAnswer,true);f.rounds.push(round);f.answers.heldout=f.respond(round,[95,85,75,5]);
  const result=evaluateAppealForecasts(f);assert.equal(result.sets,1);assert.ok(result.mae<result.meanOnlyMae);assert.equal(result.records[0].pairs.length,6);
  const inquiry=buildTasteInquiry(f),driver=inquiry.candidates.find(c=>c.id==='dramatic-light');assert.equal(driver.forecastSupported,true);assert.equal(driver.summaryEligible,true);assert.equal(driver.forecastChecks[0].independentDiscoveryVotes,1);assert.equal(inquiry.discoverySets,4);
  assert.ok(inquiryObservations(inquiry,f.works).every(o=>o.headline&&!/a distinction to explore/i.test(o.headline)));
  const profile=buildProfileIntelligence(f);assert.equal(profile.predictionEvaluation.sets,1);assert.equal(profile.responseLedger[0].question.title,f.rounds[0].title);assert.deepEqual(profile.responseLedger[0].response,f.answers['source-0']);
  f.answers['source-0'].positions.q0=40;assert.equal(evaluateAppealForecasts(f).sets,0);
});

test('Signed gaps reverse an aversion account while annotation uncertainty sends the flexible slot to coverage',()=>{
  const f=fixture();for(const r of f.rounds)f.answers[r.id]=f.respond(r,[5,15,25,95]);
  const model=buildTasteInquiry(f);assert.equal(model.candidates.find(c=>c.id==='dramatic-light').direction,-1);
  const missing=fixture(),pending=buildDiagnosticRound({works:missing.works,id:'journey-068'});
  pending.evidence.diagnostic={...pending.evidence.diagnostic,policy:'appeal-investigation-v1',mode:'transfer',inquiryMode:'transfer'};
  const bound=bindDiagnosticRound({...missing,round:pending,annotationReviews:{},selection:{candidateIds:missing.candidateIds}});
  assert.equal(bound.evidence.diagnostic.kind,'breadth-exploration');assert.equal(bound.evidence.role,'discovery');assert.equal(bound.evidence.tasteInquiry,undefined);
});

test('Moderate anchored appeal can join a later wish to return, with a tense work that would not earn a return as a boundary',()=>{
  const f=fixture(),source=f.rounds[0];f.answers[source.id]=f.respond(source,[40,45,70,80]);
  const map={id:'return-map',kind:'grid',axis:'returnResponse',axisDefinition:structuredClone(AXES.returnResponse),works:source.works,evidence:{construct:'tension-and-return'}};
  f.rounds.push(map);f.answers[map.id]={workIds:map.works.map(w=>w.id),axis:map.axis,confirmed:true,points:Object.fromEntries(map.works.map((w,i)=>[w.id,i===0?[90,90]:[90,10]]))};
  const result=buildProfileIntelligence(f),reading=result.observations.find(o=>o.id.endsWith('return-beyond-appeal'));
  assert.ok(reading);assert.match(reading.text,/personal appeal 40/);assert.match(reading.text,/not an observed return/);assert.equal(reading.status,'provisional');assert.ok(reading.counter.some(c=>c.workIds.includes('q1')));
  const changed=structuredClone(map);changed.axisDefinition.yName='Observed return visits';f.rounds[f.rounds.length-1]=changed;
  assert.equal(buildProfileIntelligence(f).observations.some(o=>o.id.endsWith('return-beyond-appeal')),false);
});

test('A real-catalogue across-set association cannot bypass the advance-prediction gate through a legacy headline or category',()=>{
  const present=[],absent=[];
  for(const work of catalogue){const r=resolveArtworkAttributes(work,{annotationReviews:catalogueReviews,currentWorks:catalogue}),status=r?.attributes['layered-space'].status;if(status==='present'&&present.length<12)present.push(work);if(status==='absent'&&absent.length<12)absent.push(work);}
  const works=[...present,...absent],f=fixture(),rounds=Array.from({length:6},(_,i)=>f.line('homogeneous-'+i,works.slice(i*4,i*4+4))),answers=Object.fromEntries(rounds.map((r,i)=>[r.id,f.respond(r,Array(4).fill(i<3?90:10))]));
  const portrait=buildTastePortrait({works,rounds,answers});
  assert.equal(portrait.intelligence.inquiry.candidates.length,0);
  assert.notEqual(portrait.profileSummary.basis,'reviewed-quality-patterns');
  assert.notEqual(portrait.profileSummary.basis,'recurring-visual-comparisons');
  assert.notEqual(portrait.intelligence.categories.find(c=>c.id==='appeal').status,'supported');
  assert.ok(portrait.tastePatterns.patterns.filter(p=>p.channel==='personal-appeal').every(p=>!p.summaryEligible));
  const raw=buildTastePatterns({works,rounds,answers,annotationReviews:catalogueReviews});
  assert.notEqual(buildProfileIntelligence({works,rounds,answers,tastePatterns:raw}).categories.find(c=>c.id==='appeal').status,'supported');
});

test('A conditional forecast abstains outside its context; counterexample artists are part of the frozen training pool',()=>{
  const f=fixture();for(const w of f.works)f.annotationReviews.reviews[w.id].attributes['visible-paint-marks'].status=f.annotationReviews.reviews[w.id].attributes['dramatic-light'].status;
  for(const w of f.works.slice(14,16))f.annotationReviews.reviews[w.id].attributes.landscape.status='absent';
  const raw=f.line('heldout',f.works.slice(12,16)),round=freezeAppealForecast({...f,round:raw});
  const conditional=round.evidence.appealForecast.conditionalForecasts.find(c=>c.id==='marks-in-landscapes');assert.ok(conditional);assert.equal(conditional.scores.q14,null);assert.equal(conditional.scores.q15,null);
  f.rounds.push(round);f.answers.heldout=f.respond(round,[90,10,90,10]);
  const forecast=evaluateAppealForecasts(f).records[0].conditional.find(c=>c.id==='marks-in-landscapes');assert.equal(forecast.knownPairs,1);
  const g=fixture(4);g.answers['source-3']=g.respond(g.rounds[3],[5,15,25,95]);g.works.find(w=>w.id===g.candidateIds[0]).artist=g.works[12].artist;
  const probe=selectTasteInquiry({...g,id:'counter-artist'});assert.ok(probe);assert.equal(probe.round.evidence.tasteInquiry.newArtistTransfer,false);
  g.rounds.push(probe.round);g.answers[probe.round.id]=g.respond(probe.round,[95,5]);assert.equal(readTasteInquiryChecks(g)[0].newArtistTransfer,false);
});

test('An illustrative source pair follows the set direction even when its largest outlier goes the other way',()=>{
  const f=fixture();f.annotationReviews.reviews.q3.attributes['dramatic-light'].status='present';f.answers['source-0']=f.respond(f.rounds[0],[0,90,50,90]);
  const candidate=buildTasteInquiry(f).candidates.find(c=>c.id==='dramatic-light');
  assert.equal(candidate.direction,1);assert.equal(candidate.groups[0].gap,10);
  assert.ok(candidate.groups[0].example.values[0]>candidate.groups[0].example.values[1]);
});

test('A genuine later repeat reversal weakens a previously transferred account without becoming a new discovery',()=>{
  const f=fixture(),probe=selectTasteInquiry({...f,id:'check'}).round,t=probe.evidence.tasteInquiry;
  f.rounds.push(probe);f.answers.check=f.respond(probe,t.predictions[0].prediction===1?[95,5]:[5,95]);
  const winning=t.predictions[0].id;assert.equal(buildTasteInquiry(f).candidates.find(c=>c.id===winning).summaryEligible,true);
  const original=f.rounds[0],repeat={...structuredClone(original),id:'later-repeat',works:[...original.works].reverse(),evidence:{...original.evidence,role:'repeat',repeatOf:original.id}};
  f.rounds.push(repeat);f.answers[repeat.id]=f.respond(repeat,repeat.works.map(w=>100-f.answers[original.id].positions[w.id]));
  const model=buildTasteInquiry(f),candidate=model.candidates.find(c=>c.id===winning);
  assert.equal(model.discoverySets,3);assert.equal(candidate.repeatReversals.length,1);assert.equal(candidate.summaryEligible,false);assert.equal(candidate.status,'mixed');
  const reading=inquiryObservations(model,f.works).find(o=>o.id==='inquiry-'+winning);assert.match(reading.text,/return to the same works/);assert.ok(reading.counter.some(e=>e.roundId==='later-repeat'&&e.sourceRole==='repeat'));
  assert.deepEqual(f.answers[original.id].positions,{q0:95,q1:85,q2:75,q3:5});
});

test('An unchanged repeat of a partially fresh source cannot manufacture a reversal by changing its analysis subset',()=>{
  const f=fixture(4);f.answers['source-0']=f.respond(f.rounds[0],[0,0,100,100]);
  f.rounds[3]=f.line('source-3',[f.works[0],f.works[2],f.works[12],f.works[14]]);f.answers['source-3']=f.respond(f.rounds[3],[0,100,90,80]);
  const before=buildTasteInquiry(f).candidates.find(c=>c.id==='dramatic-light');assert.equal(before.support.find(g=>g.roundId==='source-3').gap,10);
  const repeat={...structuredClone(f.rounds[3]),id:'unchanged-repeat',evidence:{...f.rounds[3].evidence,role:'repeat',repeatOf:'source-3'}};
  f.rounds.push(repeat);f.answers[repeat.id]=f.respond(repeat,[0,100,90,80]);
  const after=buildTasteInquiry(f).candidates.find(c=>c.id==='dramatic-light');assert.equal(after.repeatReversals.length,0);assert.equal(after.status,before.status);assert.equal(after.supportingSets,before.supportingSets);
});

test('A contrary frozen discovery forecast withdraws an earlier transfer and illustrates the opposing result',()=>{
  const f=fixture(),probe=selectTasteInquiry({...f,id:'transfer'}).round,t=probe.evidence.tasteInquiry;
  f.rounds.push(probe);f.answers.transfer=f.respond(probe,t.predictions[0].prediction===1?[95,5]:[5,95]);
  const id=t.predictions[0].id,before=buildTasteInquiry(f).candidates.find(c=>c.id===id);assert.equal(before.summaryEligible,true);
  const target=f.line('later-forecast',f.works.slice(15,18)),frozen=freezeAppealForecast({...f,round:target});
  const test=frozen.evidence.appealForecast.conditionalForecasts.find(c=>c.id===id);assert.ok(test);
  f.rounds.push(frozen);f.answers[frozen.id]=f.respond(frozen,frozen.works.map(w=>test.scores[w.id]>0?5:95));
  const after=buildTasteInquiry(f).candidates.find(c=>c.id===id),counter=after.forecastReversals[0];
  assert.equal(after.summaryEligible,false);assert.equal(after.status,'mixed');assert.ok(counter);
  assert.equal(Math.sign(counter.values[0]-counter.values[1]),-counter.prediction);
  const observation=inquiryObservations(buildTasteInquiry(f),f.works).find(o=>o.id==='inquiry-'+id);
  assert.ok(observation.counter.some(e=>e.roundId===frozen.id));assert.match(observation.text,/went the other way/);
});
