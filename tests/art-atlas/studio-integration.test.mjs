import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createScenario,validScenarioDraft,validScenario,selectedIds,analyzeScenarios} from '../../public/art-atlas/scenarios.mjs';
import {placeSortingWork} from '../../public/art-atlas/sorting-table.mjs';
import {setDifficultEditRemoval,startDifficultEditComparison,chooseDifficultEditComparison} from '../../public/art-atlas/difficult-edit.mjs';
import {buildProfile} from '../../public/art-atlas/engine.mjs';
import {museumMatches} from '../../public/art-atlas/museums.mjs';
import {restoreCurationRecords} from '../../public/art-atlas/curation-storage.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
function sorting(){
  let record=createScenario('sorting',works,{},[],{id:'integration-sort',now:10});
  record.offeredIds.forEach((id,i)=>{const result=placeSortingWork(record,id,[[.12,.37,.63,.88][i%4],i<4?.25:.75]);assert.ok(result.ok);record=result.record;});
  return {...record,confirmed:true,finishedAt:20};
}
function edit(){
  let record=createScenario('difficult-edit',works,{},[],{id:'integration-edit',now:30});
  record.presentedIds=[...record.offeredIds];
  record=setDifficultEditRemoval(record,record.offeredIds[0],works);
  record=startDifficultEditComparison(record,works);
  record=chooseDifficultEditComparison(record,'alternative',works);
  return {...record,confirmed:true,finishedAt:40};
}

test('New studio records pass shared dispatch and survive JSON round trips',()=>{
  for(const record of [sorting(),edit()]){
    assert.ok(validScenario(record,works));
    assert.ok(validScenarioDraft(JSON.parse(JSON.stringify(record)),works));
    assert.deepEqual(analyzeScenarios(works,[record]).records,[record]);
    assert.ok(selectedIds(record).every(id=>record.offeredIds.includes(id)));
  }
});

test('A completed advanced exercise can open a limited reading without inventing quiz answers',()=>{
  for(const record of [sorting(),edit()]){
    const profile=buildProfile(works,{},[record]);
    assert.ok(profile.enough);assert.equal(profile.answered,0);assert.equal(profile.taskCount,0);
    assert.equal(profile.scenarioCount,1);assert.equal(profile.prediction,null);
    assert.ok(profile.findings.length>0);
    assert.ok(profile.findings.every(f=>f.kind==='curation'));
    for(const finding of profile.findings){assert.ok(finding.support.length);assert.ok(finding.evidence.every(id=>record.offeredIds.includes(id)));assert.ok(finding.alternatives.length);}
  }
});

test('Draft or unconfirmed arrangements do not enter combined evidence',()=>{
  for(const complete of [sorting(),edit()]){
    const draft={...complete,confirmed:false};
    assert.ok(validScenarioDraft(draft,works));assert.ok(validScenario(draft,works,false));
    assert.equal(validScenario(draft,works),false);
    assert.equal(analyzeScenarios(works,[draft]).findings.length,0);
    assert.equal(buildProfile(works,{},[draft]).enough,false);
  }
});

test('Mandatory sorting works and wall edits are not museum recommendation likes',()=>{
  const result=museumMatches(works,[sorting(),edit()],{},{});
  assert.equal(result.personalized,false);
});

test('Both new formats coexist with completed legacy mini exercises',()=>{
  const legacy=createScenario('edit',works,{},[],{id:'old-edit',now:1});
  legacy.choiceId=legacy.offeredIds[0];Object.assign(legacy,{confirmed:true,finishedAt:2});
  assert.equal(legacy.offeredIds.length,3);assert.ok(validScenario(legacy,works));
  const result=analyzeScenarios(works,[legacy,sorting(),edit()]);
  assert.equal(result.records.length,3);
  assert.ok(result.findings.some(f=>f.id.includes('integration-sort')));
  assert.ok(result.findings.some(f=>f.id.includes('integration-edit')));
  assert.ok(result.findings.some(f=>f.id.includes('old-edit')));
});

test('Unavailable artworks park original records and drafts without discarding them',()=>{
  const records=[sorting(),edit()],draft=createScenario('sorting',works,{},[],{id:'saved-draft',now:50});
  const saved={records,drafts:{sorting:draft},parkedCurations:[]};
  const missing=new Set(records.flatMap(r=>r.offeredIds));
  const smallerCatalogue=works.filter(w=>!missing.has(w.id));
  const restored=restoreCurationRecords(saved,smallerCatalogue);
  assert.equal(restored.records.length,0);assert.deepEqual(restored.retained.records,records);
  assert.deepEqual(restored.retained.drafts,[{kind:'sorting',record:draft}]);
  const recovered=restoreCurationRecords(JSON.parse(JSON.stringify(restored)),works);
  assert.deepEqual(recovered.records,records);assert.deepEqual(recovered.drafts.sorting,draft);
  assert.deepEqual(recovered.retained,{records:[],drafts:[],parkedCurations:[]});
  assert.deepEqual(saved.records,records);
});

test('Reopening an older unavailable draft cannot replace a newer active draft',()=>{
  const current=createScenario('sorting',works,{},[],{id:'new-draft',now:80});
  const earlier=createScenario('sorting',works,{},[],{id:'old-draft',now:50});
  const restored=restoreCurationRecords({drafts:{sorting:current},retained:{drafts:[{kind:'sorting',record:earlier}]}},works);
  assert.equal(restored.drafts.sorting.id,current.id);
  assert.equal(restored.retained.drafts[0].record.id,earlier.id);
});
