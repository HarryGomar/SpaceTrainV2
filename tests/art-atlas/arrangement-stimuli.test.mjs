import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ARRANGEMENT_STIMULI_BANK,selectArrangementStimuli} from '../../public/art-atlas/arrangement-stimuli.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const byId=new Map(works.map(work=>[work.id,work]));

test('Four sorting rotations supply32 different sourced works with landmarks and international contexts',()=>{
  const all=[];
  for(let batchIndex=0;batchIndex<4;batchIndex++){
    const result=selectArrangementStimuli({works,batchIndex,kind:'sorting'});
    assert.equal(result.status,'ready');assert.equal(result.fallback,false);assert.equal(result.rotationIndex,batchIndex);assert.equal(result.workIds.length,8);assert.equal(new Set(result.workIds).size,8);
    assert.ok(result.workIds.filter(id=>byId.get(id).recognitionTier==='landmark').length>=4);
    assert.ok(new Set(result.workIds.map(id=>byId.get(id).country).filter(Boolean)).size>=3);
    for(const id of result.workIds)assert.ok(result.sourceUrls.includes(byId.get(id).sourceUrl));
    assert.match(result.reuseRule,/reuse that saved set/);all.push(...result.workIds);
  }
  assert.equal(new Set(all).size,32);
});

test('Four edit rotations supply actual four-work sets and the first is the reviewed mountain group',()=>{
  const seen=new Set();
  for(let batchIndex=0;batchIndex<4;batchIndex++){
    const result=selectArrangementStimuli({works,batchIndex,kind:'difficult-edit'});
    assert.equal(result.status,'ready');assert.equal(result.workIds.length,4);assert.equal(new Set(result.workIds).size,4);assert.equal(result.fallback,false);
    assert.ok(result.workIds.filter(id=>byId.get(id).recognitionTier==='landmark').length>=2);assert.ok(result.curationNotes.length>=2);
    assert.ok(!seen.has(result.contentId));seen.add(result.contentId);
  }
  const first=selectArrangementStimuli({works,batchIndex:0,kind:'edit'});
  assert.deepEqual(first.workIds,['cezanne-mountain','velasco-valley-mexico','hokusai-mount-fuji','study-guo-xi-early-spring']);
  assert.equal(first.kind,'difficult-edit');
});

test('The same sorting batch is stable for its later return while other batches have different sets',()=>{
  const a=selectArrangementStimuli({works,batchIndex:0,kind:'sorting'}),b=selectArrangementStimuli({works:[...works].reverse(),batchIndex:0,kind:'sorting'});
  assert.deepEqual(a,b);
  for(let batchIndex=1;batchIndex<4;batchIndex++)assert.notDeepEqual(selectArrangementStimuli({works,batchIndex,kind:'sorting'}).workIds,a.workIds);
  assert.deepEqual(selectArrangementStimuli({works,batchIndex:4,kind:'sorting'}).workIds,a.workIds);
});

test('An incomplete preferred cohort falls back only to another complete reviewed set',()=>{
  for(const kind of ['sorting','difficult-edit']){
    const preferred=selectArrangementStimuli({works,batchIndex:0,kind}),missing=preferred.workIds[0];
    const result=selectArrangementStimuli({works:works.filter(work=>work.id!==missing),batchIndex:0,kind});
    assert.equal(result.status,'ready');assert.equal(result.fallback,true);assert.notEqual(result.contentId,preferred.contentId);assert.ok(result.fallbackReason);assert.ok(result.rejected[0].missingIds.includes(missing));
    const exact=ARRANGEMENT_STIMULI_BANK[kind].find(row=>row.contentId===result.contentId);assert.deepEqual(result.workIds,exact.workIds);
  }
});

test('No available reviewed set returns unavailable instead of an arbitrary filler',()=>{
  assert.equal(selectArrangementStimuli({works:[],kind:'sorting'}).status,'unavailable');
  assert.equal(selectArrangementStimuli({works,kind:'unknown'}).status,'unavailable');
  const preferred=selectArrangementStimuli({works,kind:'sorting'}),only=preferred.workIds.map(id=>byId.get(id));
  const duplicate=selectArrangementStimuli({works:[...only,only[0]],kind:'sorting'});assert.equal(duplicate.status,'unavailable');assert.deepEqual(duplicate.workIds,[]);
  const decorative=selectArrangementStimuli({works:only.map(work=>({...work,decorativeOnly:true})),kind:'sorting'});assert.equal(decorative.status,'unavailable');
  const noSources=selectArrangementStimuli({works:only.map(work=>({...work,sourceUrl:''})),kind:'sorting'});assert.equal(noSources.status,'unavailable');
});

test('Outputs do not mutate the catalogue or frozen curated bank and need no assumed descriptors',()=>{
  const before=structuredClone(works),result=selectArrangementStimuli({works,kind:'sorting'});
  result.workIds.reverse();result.curationNotes.push('Local output change');
  assert.deepEqual(works,before);assert.notDeepEqual(result,selectArrangementStimuli({works,kind:'sorting'}));
  const withoutFeatures=works.map(({features,...rest})=>rest);assert.equal(selectArrangementStimuli({works:withoutFeatures,kind:'edit'}).status,'ready');
});
