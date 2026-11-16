import test from 'node:test';
import assert from 'node:assert/strict';
import {APPEAL_PROTOCOL,APPEAL_SCALE,isOverallAppealRound,withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {validAnswer,sanitizeDraft} from '../../public/art-atlas/engine.mjs';

const ordinary={id:'appeal',kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Compare these works.',works:['a','b','c','d'].map(id=>({id})),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}};
const answer=(round,values)=>({workIds:round.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(round.works.map((work,index)=>[work.id,values[index]])),confirmed:true});

test('Fixed anchors preserve every granular position and allow a whole group to be high, low or equal',()=>{
  const round=withOverallAppeal(ordinary);
  for(let position=0;position<=100;position++)assert.equal(validAnswer(round,answer(round,Array(4).fill(position))),true);
  for(const values of [[81,84,92,99],[1,3,8,16],[43,43,43,43],[0,37,58,100]]){
    const original=answer(round,values);assert.equal(validAnswer(round,original),true);
    assert.deepEqual(sanitizeDraft(round,original).positions,original.positions,'Labels cannot snap or rescale the recorded points');
  }
});

test('Only an explicitly captured overall-appeal instrument can supply cross-group scores',()=>{
  const round=withOverallAppeal(ordinary);assert.equal(isOverallAppealRound(round),true);assert.equal(isOverallAppealRound(ordinary),false);
  for(const changed of [{...round,evidence:{...round.evidence,appealProtocol:'future'}},{...round,scale:{left:'Less preferred',right:'More preferred'}},{...round,evidence:{...round.evidence,construct:'perceived-visual-density'}},{...round,anchorIds:['fixed-neighbour']}])assert.equal(isOverallAppealRound(changed),false);
  assert.equal(isOverallAppealRound({...round,evidence:{...round.evidence,role:'repeat',repeatOf:'earlier'}}),true,'A genuine captured repeat can retain its measurement scope');
  assert.throws(()=>withOverallAppeal({...ordinary,evidence:{...ordinary.evidence,role:'repeat',repeatOf:'old'}}));
  assert.equal(ordinary.title,'Which do you prefer?');assert.equal(Object.hasOwn(ordinary.evidence,'appealProtocol'),false);
  assert.equal(round.evidence.appealProtocol,APPEAL_PROTOCOL);assert.deepEqual(round.scale,APPEAL_SCALE);
});
