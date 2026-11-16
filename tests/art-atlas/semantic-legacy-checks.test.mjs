import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyRounds} from '../../public/art-atlas/question-bank.mjs';
import {analyzeStudy} from '../../public/art-atlas/deep-study.mjs';
import {FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';
const keys=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
function fixture(){
  const works=Array.from({length:60},(_,index)=>({id:'literal-fixture-'+index,title:'Synthetic work '+index,artist:'Fixture artist '+index,movement:'Fixture tradition '+index,image:'fixture-'+index+'.jpg',sourceUrl:'https://fixture.invalid/'+index,featureSemanticVersion:FEATURE_SEMANTIC_VERSION,features:Object.fromEntries(keys.map(key=>[key,key==='narrative'?(index%3)/2:.5]))}));
  const initial=buildStudyRounds(works,200),answer=round=>({workIds:round.works.map(work=>work.id),criterion:'preference',confirmed:true,positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.narrative*100)]))}),answers=Object.fromEntries(initial.filter(round=>round.kind==='spectrum'&&round.evidence.construct==='preference'&&round.evidence.role==='discovery').map(round=>[round.id,answer(round)])),rounds=buildStudyRounds(works,200,answers),check=rounds.find(round=>round.evidence.contrastKey==='narrative'&&round.evidence.provisionalPrediction);
  assert.ok(check,'The fixture supplies a real earlier-sources-only literal prediction.');check.evidence.trainingAnswers=Object.fromEntries(check.evidence.trainingRoundIds.map(id=>[id,structuredClone(answers[id])]));answers[check.id]=answer(check);return {works,rounds,answers,check};
}

test('New legacy-bank literal checks freeze their exact semantic version and permit a scoped outcome reading',()=>{
  const input=fixture(),before=structuredClone(input);assert.equal(input.check.evidence.featureSemanticVersion,FEATURE_SEMANTIC_VERSION);assert.ok(analyzeStudy(input.works,input.rounds,input.answers).findings.some(finding=>finding.id==='study-prediction'));assert.deepEqual(input,before);
});

test('An old or unversioned literal prediction remains raw without acquiring the new literal outcome claim',()=>{
  for(const version of [undefined,'older-literal-definition']){const input=fixture();input.check.evidence.featureSemanticVersion=version;const before=structuredClone(input);assert.equal(analyzeStudy(input.works,input.rounds,input.answers).findings.some(finding=>finding.id==='study-prediction'),false);assert.deepEqual(input,before);assert.ok(input.check.evidence.provisionalPrediction);}
});

test('An unreviewed training or proposed work suppresses only the literal interpretation and preserves every frozen record',()=>{
  for(const target of ['training','test']){const input=fixture(),work=target==='training'?input.rounds.find(round=>round.id===input.check.evidence.trainingRoundIds[0]).works[0]:input.check.works[0];delete work.featureSemanticVersion;const before=structuredClone(input);assert.equal(analyzeStudy(input.works,input.rounds,input.answers).findings.some(finding=>finding.id==='study-prediction'),false);assert.deepEqual(input,before);}
});
