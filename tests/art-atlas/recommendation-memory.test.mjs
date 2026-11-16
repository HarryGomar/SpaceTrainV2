import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecommendationMemory,wasPreviouslyPresented} from '../../public/art-atlas/recommendation-memory.mjs';

const works=[{id:'a',title:'Earlier low-rated painting',sourceUrl:'https://museum.example/objects/a'},{id:'b',title:'Never viewed painting',sourceUrl:'https://museum.example/objects/b'}];
const history={manifest:{id:'earlier',catalogue:works},shown:{q:{id:'q',kind:'spectrum',workIds:['a']}},answers:{q:{workIds:['a'],positions:{a:20},confirmed:true}}};

test('An earlier low-rated work cannot be introduced as a new suggestion, without importing its score',()=>{
  const memory=buildRecommendationMemory([history]);
  assert.equal(wasPreviouslyPresented(works[0],memory),true);
  assert.equal(wasPreviouslyPresented(works[1],memory),false);
  assert.equal('score' in memory.sources[0],false);
  assert.equal('positions' in memory,false);
  assert.deepEqual(memory.sources[0],{workId:'a',sourceUrl:works[0].sourceUrl,roundId:'q',quizId:'earlier'});
});

test('Old identities cannot hide a different current source, or an unshown future question',()=>{
  const future={...history,shown:{},plan:[{id:'future',workIds:['b']}]};
  const memory=buildRecommendationMemory([history,future]);
  assert.equal(wasPreviouslyPresented({...works[0],sourceUrl:'https://different.example/work'},memory),false);
  assert.equal(wasPreviouslyPresented(works[1],memory),false);
});

test('Opening a museum tray does not mean all of its works were viewed',()=>{
  const gallery={manifest:{catalogue:works},shown:{g:{id:'g',kind:'exercise',workIds:['a','b']}},answers:{g:{record:{presentedIds:['a']}}}};
  const memory=buildRecommendationMemory([gallery]);
  assert.equal(wasPreviouslyPresented(works[0],memory),true);
  assert.equal(wasPreviouslyPresented(works[1],memory),false);
});

test('A broken archive remains untouched and cannot invent exposure',()=>{
  const source={manifest:{catalogue:works},shown:{q:{id:'q',workIds:['missing']}}},before=structuredClone(source);
  assert.equal(buildRecommendationMemory([null,source]).identities.size,0);
  assert.deepEqual(source,before);
});
