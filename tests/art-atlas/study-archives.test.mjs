import test from 'node:test';
import assert from 'node:assert/strict';
import {storeStudyArchives,loadStudyArchives,encodeStudyWithArchives} from '../../public/art-atlas/study-archives.mjs';

const old={manifest:{id:'quiz-old',createdAt:123,catalogue:[{id:'one',title:'Original title'}]},answers:{first:{positions:{one:93}}},shown:{first:{title:'Original question'}},plan:[{id:'future'}]};
const memory=()=>{const values=new Map();return {async put(id,value){values.set(id,structuredClone(value));},async get(id){return structuredClone(values.get(id));}};};

test('A large archive round-trips exactly while active saves contain only a small committed reference',async()=>{
  const store=memory(),before=structuredClone(old),references=await storeStudyArchives([old],store);
  const encoded=encodeStudyWithArchives({manifest:{id:'new'},answers:{},archives:[old]},references),parsed=JSON.parse(encoded);
  assert.ok(!encoded.includes('Original title'));assert.ok(!encoded.includes('Original question'));
  assert.equal(parsed.archives[0].answerCount,1);
  const loaded=await loadStudyArchives(parsed.archives,store);assert.deepEqual(loaded.archives,[before]);assert.deepEqual(old,before);
  loaded.archives[0].answers.first.positions.one=10;
  assert.equal((await loadStudyArchives(parsed.archives,store)).archives[0].answers.first.positions.one,93);
});

test('Failed archive writes cannot produce a reference and unavailable reads retain the recovery reference',async()=>{
  await assert.rejects(()=>storeStudyArchives([old],{async put(){throw Error('quota');}}),/quota/);
  assert.deepEqual(JSON.parse(encodeStudyWithArchives({archives:[old]})).archives,[old],'The fallback retains the full run');
  const references=await storeStudyArchives([old],memory()),reference=references.get('quiz-old');
  const loaded=await loadStudyArchives([reference],{async get(){throw Error('unavailable');}});
  assert.equal(loaded.archives[0].id,'quiz-old');assert.equal(loaded.archives[0].unavailable,true);assert.equal(loaded.references.size,0);
  assert.equal(JSON.parse(encodeStudyWithArchives({archives:loaded.archives})).archives[0].archiveStorage,reference.archiveStorage);
});
