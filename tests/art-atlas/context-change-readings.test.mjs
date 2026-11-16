import test from 'node:test';
import assert from 'node:assert/strict';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {withContextChange,bindContextChangeRound,CONTEXT_CHANGE_PROTOCOL} from '../../public/art-atlas/context-change.mjs';
import {buildContextChangeReadings} from '../../public/art-atlas/context-change-readings.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {comparisonReadout} from '../../public/art-atlas/profile-comparisons.mjs';
import {renderProfileEvidence} from '../../public/art-atlas/taste-portrait-parts.mjs';

function fixture(value=100,reportedChange=100){
  const works=Array.from({length:4},(_,index)=>({id:'context-'+index,title:'Painting '+index,artist:'Artist '+index,sourceUrl:'https://museum.example/object/'+index,image:'assets/context-'+index+'.jpg',sha256:(index+1).toString(16).padStart(64,'0'),note:'A source-backed note for this exact painting.',features:{energy:.5}}));
  const source=withContinuousPreference({id:'journey-001',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}),sourceAnswer={workIds:works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(works.map(work=>[work.id,value])),confirmed:true},template=withContextChange({id:'journey-025',kind:'context',works:[works[0]],evidence:{}}),round=bindContextChangeRound({round:template,rounds:[source],answers:{[source.id]:sourceAnswer}}),answer={workIds:[works[0].id],workId:works[0].id,contextProtocol:CONTEXT_CHANGE_PROTOCOL,contentId:round.contextNote.id,storySeen:true,reportedChange,uncertain:false,confirmed:true};
  return {works,rounds:[source,round],answers:{[source.id]:sourceAnswer,[round.id]:answer},round,answer};
}

test('A top earlier rating plus Much more is a large positive report rather than a ceiling-imposed no-change result',()=>{
  const f=fixture(),before=structuredClone(f),result=buildContextChangeReadings(f),response=result.responses[0],observation=result.observations[0];
  assert.equal(response.priorAppeal.value,100);assert.equal(response.direction,1);assert.equal(response.strength,2);assert.equal(result.coverage.largePositiveWorks,1);assert.match(observation.title,/beyond a top rating/);assert.deepEqual(observation.sourceRoundIds,['journey-001','journey-025']);assert.equal('after' in response,false);assert.equal('after' in observation,false);assert.deepEqual(f,before);
  const portrait=buildTastePortrait(f);assert.equal(portrait.reportedContextChanges.coverage.largePositiveWorks,1);assert.equal(portrait.coverage.reportedContextChangeTasks,1);assert.deepEqual(portrait.contextRatings,[]);
  const readout=comparisonReadout(observation,f);assert.equal(readout.single,false);assert.equal(readout.measures.length,0);assert.match(readout.notes['context-0'][0].text,/Much more appreciation/);
});

test('The older literal100 before and100 after remains unchanged and never becomes a direct lift response',()=>{
  const f=fixture(),old={id:'old-context',kind:'context',contextMode:'preference-before-after-v1',works:[f.works[0]],evidence:{}},args={works:f.works,rounds:[old],answers:{[old.id]:{workIds:['context-0'],workId:'context-0',before:100,after:100,storySeen:true,confirmed:true}}},portrait=buildTastePortrait(args);
  assert.equal(portrait.contextRatings[0].change,0);assert.equal(portrait.reportedContextChanges.coverage.validResponses,0);assert.match(portrait.observations.find(item=>item.id==='taste-context-rating').title,/stayed the same/);
});

test('No change is the explicit midpoint; uncertainty has neither a fabricated midpoint nor a direction',()=>{
  const neutral=fixture(100,50),same=buildContextChangeReadings(neutral);assert.equal(same.responses[0].direction,0);assert.equal(same.coverage.noChangeWorks,1);
  const unsure=fixture();delete unsure.answer.reportedChange;unsure.answer.uncertain=true;const result=buildContextChangeReadings(unsure);assert.equal(result.responses[0].reportedChange,null);assert.equal(result.responses[0].direction,null);assert.equal(result.responses[0].strength,null);assert.equal(result.coverage.noChangeWorks,0);assert.equal(result.coverage.uncertainWorks,1);assert.deepEqual(result.observations,[]);
});

test('Direct change works without a baseline; an invalid captured source cannot supply an already-loved claim',()=>{
  const noBaseline=fixture();delete noBaseline.round.evidence.priorAppeal;assert.equal(buildContextChangeReadings(noBaseline).responses[0].direction,1);assert.equal(buildContextChangeReadings(noBaseline).responses[0].priorAppeal,null);
  for(const mutate of [f=>f.round.evidence.priorAppeal.value=75,f=>f.round.evidence.priorAppeal.roundId='future',f=>f.round.evidence.priorAppeal.sourceIdentity.image='different.jpg',f=>f.round.evidence.priorAppeal.sourceAnswer.confirmed=false,f=>f.round.evidence.priorAppeal.sourceQuestion.scale.right='More preferred']){
    const f=fixture();mutate(f);const result=buildContextChangeReadings(f);assert.equal(result.responses[0].priorAppeal,null);assert.equal(result.coverage.largePositiveWorks,1);assert.doesNotMatch(result.observations[0].title,/top rating|existing preference/);
  }
});

test('Invalid, incomplete, uncertain-plus-number and wrong-note answers cannot enter the direct-change model',()=>{
  for(const mutate of [f=>f.answer.confirmed=false,f=>f.answer.storySeen=false,f=>f.answer.workId='different',f=>f.answer.roundId='other-question',f=>f.answer.contentId='different-note',f=>f.answer.reportedChange=90,f=>f.answer.uncertain=true,f=>f.answer.after=100,f=>f.round.contextNote.text='Altered source note',f=>f.round.contextProtocol='unknown',f=>f.works.push(structuredClone(f.works[0]))]){const f=fixture();mutate(f);assert.deepEqual(buildContextChangeReadings(f).responses,[]);}
});

test('A later live edit cannot replace the captured baseline in the reading or its displayed evidence',()=>{
  const f=fixture(),before=buildContextChangeReadings(f);f.answers['journey-001'].positions['context-0']=50;const result=buildContextChangeReadings(f);assert.deepEqual(result,before);
  const html=renderProfileEvidence({item:result.observations[0],...f,image:work=>'<img alt="'+work.title+'">',esc:String});assert.match(html,/Painting 0: 100 on the earlier personal-appeal scale/);assert.doesNotMatch(html,/50<small> \/ 100/);
});

test('Repeat reports retain their history while counting each painting once and expose the actual sourced note in evidence',()=>{
  const f=fixture(),later={...structuredClone(f.round),id:'journey-035'};f.rounds.push(later);f.answers[later.id]={...structuredClone(f.answer),reportedChange:0};
  const result=buildContextChangeReadings(f);assert.equal(result.coverage.validResponses,2);assert.equal(result.coverage.distinctWorks,1);assert.equal(result.coverage.repeatedWorkResponses,1);assert.equal(result.coverage.negativeWorks,1);assert.equal(result.coverage.positiveWorks,0);assert.equal(result.observations[0].reportedChange,0);
  const html=renderProfileEvidence({item:result.observations[0],...f,image:work=>'<img alt="'+work.title+'">',esc:String});assert.match(html,/The note you read/);assert.match(html,/source-backed note for this exact painting/);assert.match(html,/Much less appreciation/);
});

test('Two distinct direct reports provide a descriptive context summary and source IDs without implying a symbolic trait',()=>{
  const f=fixture(),other=withContextChange({id:'journey-035',kind:'context',works:[f.works[1]],evidence:{}});f.rounds.push(other);f.answers[other.id]={...structuredClone(f.answer),workIds:[f.works[1].id],workId:f.works[1].id,contentId:other.contextNote.id};
  const result=buildContextChangeReadings(f),portrait=buildTastePortrait(f);assert.equal(result.summary.distinctWorkCount,2);assert.equal(result.summary.documentaryInterpretation,false,'A generic collection note does not become documented symbolism');assert.match(result.summary.text,/2 different paintings/);assert.equal(result.observations.length,1);assert.deepEqual(result.summary.sourceRoundIds,['journey-025','journey-035']);assert(portrait.profileSummary.findingIds.includes('reported-context-summary'));assert.equal(portrait.profileSummary.basis,'direct-context-reports');assert.doesNotMatch(portrait.profileSummary.title,/sensitivity|personality/i);
});
