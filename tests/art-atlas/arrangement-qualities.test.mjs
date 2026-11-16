import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {analyzeArrangementQualities,ARRANGEMENT_QUALITIES_PROTOCOL} from '../../public/art-atlas/arrangement-qualities.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {createGalleryRecord,placeInRoom,validGallery} from '../../public/art-atlas/gallery-model.mjs';
import {createSortingRecord,validSorting} from '../../public/art-atlas/sorting-table.mjs';

const quality='dramatic-light',digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function sourceFixture(count=8){
  const works=Array.from({length:count},(_,i)=>({id:'fixture-'+i,title:'Synthetic painting '+i,artist:'Named fixture artist '+i,artistKnown:true,sourceUrl:'https://museum.example/object/'+i,image:'assets/fixture-'+i+'.jpg',sha256:digest('synthetic-preview-'+i),features:{humanity:1,narrative:1,atmosphere:1}}));
  const reviews=Object.fromEntries(works.map((work,i)=>[work.id,{version:'artwork-attributes-v1',reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:work.image,sha256:work.sha256,width:800,height:600,compositionMatch:'same-composition',mediaBinding:'explicit-synthetic-test-fixture',sourceLimited:false},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key===quality&&i<count/2?'present':'absent',reason:'Explicit synthetic operational description for this fixture, not a real artwork annotation.',evidenceKind:'visual-review'}]))}]));
  return {works,annotationReviews:{version:'artwork-attributes-v1',reviews}};
}
function museumFixture(count=8,allocation=null){
  const fixture=sourceFixture(count);let record=createGalleryRecord(fixture.works,{}, {id:'museum-fixture',now:1,roomStudy:false});
  fixture.works.forEach((work,i)=>{const result=placeInRoom(record,work.id,allocation?.[i]||'g'+(i<count/2?1:3));assert.ok(result.ok);record=result.record;});
  Object.assign(record,{confirmed:true,finishedAt:2});assert.equal(validGallery(record,fixture.works),true);
  return {...fixture,records:[record]};
}
function sortingFixture(){
  const fixture=sourceFixture(),record=createSortingRecord(fixture.works,{},[],{id:'sorting-fixture',now:1,offeredIds:fixture.works.map(work=>work.id)});
  const points=[[.1,.2],[.13,.21],[.1,.28],[.13,.29],[.85,.7],[.88,.71],[.85,.78],[.88,.79]];
  record.positions=Object.fromEntries(fixture.works.map((work,i)=>[work.id,points[i]]));record.stackOrder=[...record.offeredIds];record.presentedIds=[...record.offeredIds];record.confirmed=true;record.finishedAt=2;
  assert.equal(validSorting(record,fixture.works),true);return {...fixture,records:[record]};
}
const selected=result=>result.findings.find(finding=>finding.qualityKey===quality);

test('Reviewed present and absent qualities describe room membership against the same selected pool and room sizes',()=>{
  const fixture=museumFixture(),before=JSON.stringify(fixture),result=analyzeArrangementQualities(fixture),finding=selected(result);
  assert.ok(finding);assert.equal(result.protocol,ARRANGEMENT_QUALITIES_PROTOCOL);assert.equal(finding.instrument,'museum');
  assert.equal(finding.relation,'grouped-by-shared-quality');assert.equal(finding.direction,1);assert.equal(finding.notPreferenceEvidence,true);
  assert.equal(finding.metrics.withinRoomMismatch,0);assert.ok(finding.metrics.alternativeMeanMismatch>.4);assert.ok(finding.metrics.alternativeAssignments>=16);
  assert.deepEqual(finding.metrics.roomSizes.map(room=>room.placed),[4,4]);assert.equal(finding.sourceVariation.presentWorks,4);assert.equal(finding.sourceVariation.absentWorks,4);
  assert.deepEqual(finding.sourceRecordIds,['museum-fixture']);assert.equal(finding.dependentTaskCount,1);assert.equal(finding.independenceUnit,'scenario:museum-fixture');
  assert.ok(finding.support.some(item=>item.detail.includes('[present]')));assert.ok(finding.support.some(item=>item.detail.includes('[absent]')));
  assert.deepEqual(finding.displayWorkIds.map(id=>finding.displayRoles[id].qualityStatus),['present','absent']);
  assert.notEqual(finding.displayRoles[finding.displayWorkIds[0]].roomId,finding.displayRoles[finding.displayWorkIds[1]].roomId);
  assert.ok(finding.displayNotes[finding.displayWorkIds[1]].description.includes('reviewed absent'));
  assert.equal(JSON.stringify(fixture),before);assert.deepEqual(analyzeArrangementQualities(fixture),result);
});

test('Deliberately mixed rooms describe contrast rather than manufacturing a shared-quality grouping',()=>{
  const fixture=museumFixture(8,['g1','g2','g3','g4','g1','g2','g3','g4']),finding=selected(analyzeArrangementQualities(fixture));
  assert.ok(finding);assert.equal(finding.relation,'grouped-by-quality-contrast');assert.equal(finding.direction,-1);assert.equal(finding.metrics.withinRoomMismatch,1);
  assert.match(finding.text,/bring together works reviewed with and without/);assert.match(finding.directionMeaning,/Neither direction is a liking or dislike/);
});

test('Free sorting uses fixed3:2 near and far geometry with disjoint examples and a dependent-task label',()=>{
  const fixture=sortingFixture(),finding=selected(analyzeArrangementQualities(fixture));
  assert.ok(finding);assert.equal(finding.instrument,'sorting');assert.equal(finding.relation,'grouped-by-shared-quality');
  assert.equal(finding.metrics.nearMismatch,0);assert.equal(finding.metrics.farMismatch,1);
  assert.equal(finding.support.length,4);assert.equal(new Set(finding.support.slice(0,2).flatMap(item=>item.workIds)).size,4);
  assert.equal(new Set(finding.support.slice(2).flatMap(item=>item.workIds)).size,4);assert.equal(finding.dependentTaskCount,1);
  assert.ok(finding.alternatives.some(line=>/not.*confidence percentage|do not.*confidence percentage/.test(line)));
});

test('An actual exception stays in the room and table evidence',()=>{
  const rooms=museumFixture(8,['g1','g1','g1','g2','g3','g3','g3','g2']),roomFinding=selected(analyzeArrangementQualities(rooms));
  assert.ok(roomFinding);assert.ok(roomFinding.counter.length);assert.ok(roomFinding.counter[0].workIds.includes('fixture-3'));assert.ok(roomFinding.counter[0].workIds.includes('fixture-7'));
  const table=sortingFixture();table.records[0].positions['fixture-3']=[.6,.7];
  const tableFinding=selected(analyzeArrangementQualities(table));assert.ok(tableFinding);assert.ok(tableFinding.counter.length);assert.ok(tableFinding.counter.some(item=>item.workIds.includes('fixture-3')));
});

test('A changed source, image, declared checksum or missing review cannot silently become an absent quality',()=>{
  for(const mode of ['source','image','hash','missing','unreviewed']){
    const fixture=museumFixture(6),work=fixture.works[0];
    if(mode==='source')work.sourceUrl='https://museum.example/different-work';
    if(mode==='image')work.image='assets/different-reproduction.jpg';
    if(mode==='hash')work.sha256='f'.repeat(64);
    if(mode==='missing')delete fixture.annotationReviews.reviews[work.id];
    if(mode==='unreviewed')fixture.annotationReviews.reviews[work.id].reviewed=false;
    const result=analyzeArrangementQualities(fixture);assert.equal(result.findings.length,0,mode);assert.equal(result.coverage.records[0].qualitiesWithReviewedContrasts,0,mode);
  }
});

test('Unknown criteria, all-present criteria and one-artist fixtures do not create a grouping opportunity',()=>{
  for(const mode of ['unknown','present','same-artist']){
    const fixture=museumFixture(6);
    if(mode==='same-artist')for(const work of fixture.works)work.artist='Same source artist';
    else for(const record of Object.values(fixture.annotationReviews.reviews))record.attributes[quality].status=mode;
    assert.equal(analyzeArrangementQualities(fixture).findings.length,0,mode);
  }
});

test('Only actually hung and presented works contribute; added offers and capacity cannot become negative preference',()=>{
  const fixture=museumFixture(),first=analyzeArrangementQualities(fixture);
  const extra=sourceFixture(12).works.slice(8);fixture.works.push(...extra);fixture.records[0].offeredIds.push(...extra.map(work=>work.id));fixture.records[0].presentedIds.push(...extra.map(work=>work.id));
  const result=analyzeArrangementQualities(fixture);assert.deepEqual(result.findings,first.findings);
  assert.ok(result.findings.every(finding=>finding.workIds.every(id=>Object.hasOwn(fixture.records[0].placements,id))));
  delete fixture.records[0].placements['fixture-0'];fixture.records[0].presentedIds=fixture.records[0].presentedIds.filter(id=>id!=='fixture-1');
  assert.equal(analyzeArrangementQualities(fixture).coverage.validRecords,0);
});

test('A single room, an unplaced initial sorting record and one tight stack add no invented quality separation',()=>{
  const one=museumFixture(6,Array(6).fill('g1'));assert.equal(analyzeArrangementQualities(one).findings.length,0);
  const fixture=sourceFixture(),initial=createSortingRecord(fixture.works,{},[],{id:'initial-fixture',now:1,offeredIds:fixture.works.map(work=>work.id)});
  assert.equal(analyzeArrangementQualities({...fixture,records:[initial]}).coverage.validRecords,0);
  const stacked=sortingFixture();for(const id of stacked.records[0].offeredIds)stacked.records[0].positions[id]=[.5,.5];
  assert.equal(analyzeArrangementQualities(stacked).findings.length,0);
});

test('The rich-quality reader ignores raw7features, layer order, room names and table zoom as analytic signals',()=>{
  const fixture=sortingFixture(),first=selected(analyzeArrangementQualities(fixture));
  for(const work of fixture.works)work.features={humanity:0,narrative:null,atmosphere:null};
  fixture.records[0].stackOrder.reverse();fixture.records[0].ui.zoom='large';fixture.records[0].ui.cursor=[.8,.8];
  assert.deepEqual(selected(analyzeArrangementQualities(fixture)),first);
});

test('Correlated quality descriptions are retained as alternatives without duplicating independent evidence',()=>{
  const fixture=museumFixture();for(const record of Object.values(fixture.annotationReviews.reviews))record.attributes['intimate-figures']={...record.attributes[quality]};
  const result=analyzeArrangementQualities(fixture);assert.equal(result.findings.length,1);assert.equal(result.findings[0].dependentTaskCount,1);
  assert.equal(result.findings[0].coincidingQualityKeys.length,1);assert.ok(result.findings[0].alternatives.some(line=>line.includes('effects are not separated')));
});

test('Every finding retains exact source annotations, reasons and record references rather than title-derived symbolism',()=>{
  const fixture=museumFixture();fixture.works[0].title='Symbolic mystery of the unknown';const finding=selected(analyzeArrangementQualities(fixture));
  assert.ok(finding);assert.equal(Object.hasOwn(finding,'symbolism'),false);assert.deepEqual(finding.attributes,[quality]);
  for(const item of [...finding.support,...finding.counter]){assert.equal(item.roundId,'scenario:museum-fixture');assert.ok(item.workIds.every(id=>finding.workIds.includes(id)));}
  for(const annotation of finding.annotationEvidence){const work=fixture.works.find(work=>work.id===annotation.workId);assert.equal(annotation.sourceUrl,work.sourceUrl);assert.equal(annotation.previewSha256,work.sha256);assert.equal(annotation.reviewerType,'assistant-visual-review');assert.ok(annotation.reason.length>20);}
});

test('Malformed inputs, duplicate record identities and unfinished records fail closed',()=>{
  assert.equal(analyzeArrangementQualities({works:null,records:null,currentWorks:null}).findings.length,0);
  const fixture=museumFixture();assert.equal(analyzeArrangementQualities({...fixture,records:[fixture.records[0],structuredClone(fixture.records[0])]}).coverage.validRecords,0);
  fixture.records[0].confirmed=false;assert.equal(analyzeArrangementQualities(fixture).coverage.validRecords,0);
});
