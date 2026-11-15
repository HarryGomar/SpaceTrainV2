import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildTasteConnections,CONNECTION_THRESHOLDS} from '../../public/art-atlas/taste-connections.mjs';
import {createGalleryRecord,gallerySlots,placePainting} from '../../public/art-atlas/gallery-model.mjs';
import {createSortingRecord,placeSortingWork,sortingDistance} from '../../public/art-atlas/sorting-table.mjs';
const works=Array.from({length:12},(_,i)=>({id:'w'+i,title:'Work '+i,artist:'Artist '+i,image:'test.jpg',sourceUrl:'https://museum.example/'+i}));
const pointList=[[.12,.2],[.23,.2],[.7,.2],[.81,.2],[.12,.75],[.23,.75],[.7,.75],[.81,.75]];
const signature=ids=>JSON.stringify([...ids].sort());
function museum(id='museum',now=1){let record=createGalleryRecord(works,{}, {id,now});for(let i=0;i<6;i++){const slot=gallerySlots(record).find(slot=>slot.roomId===(i<3?'g1':'g3'));record=placePainting(record,'w'+i,slot.wallId,slot.t).record;}record.phase='walkthrough';record.roomResponses={entryId:'w0',lingerRoomId:'g1',bridgeIds:['w0','w3']};record.confirmed=true;record.finishedAt=now+1;return record;}
function sorting(id='sorting',now=1,points=pointList){const offeredIds=works.slice(0,8).map(work=>work.id);let record=createSortingRecord(works,{},[],{id,now,offeredIds});for(let i=0;i<8;i++){const result=placeSortingWork(record,'w'+i,points[i]);assert.ok(result.ok);record=result.record;}return {...record,confirmed:true,finishedAt:now+1};}
const build=(records=[],extra={})=>buildTasteConnections({works,records,...extra});

test('A single museum yields its actual chosen rooms without inferred latent categories',()=>{
  const result=build([museum()]);assert.equal(result.groups.length,2);assert.deepEqual(new Set(result.groups.map(group=>signature(group.workIds))),new Set([signature(['w0','w1','w2']),signature(['w3','w4','w5'])]));for(const group of result.groups){assert.equal(group.recurring,false);assert.equal(group.evidenceCount,1);assert.deepEqual(group.sourceIds,['scenario:museum']);assert.equal(group.kind,'museum-room');}assert.equal(result.responseMaps.length,0);
});

test('Museum automatic wall coordinates do not change room clusters or pair evidence',()=>{
  const first=museum(),second=structuredClone(first);[second.placements.w0,second.placements.w1]=[second.placements.w1,second.placements.w0];assert.deepEqual(build([second]),build([first]));
});

test('Two comparable arrangements establish recurrence by record count, not number of pairs',()=>{
  const a=museum('a',1),b=museum('b',3),result=build([b,a]);assert.equal(result.coverage.comparableCohorts,1);assert.ok(result.groups.some(group=>group.recurring&&group.evidenceCount===2));for(const group of result.groups.filter(group=>group.recurring)){assert.equal(group.sourceIds.length,2);assert.equal(group.support.length,2);}const link=result.links.find(link=>signature(link.workIds)===signature(['w0','w1']));assert.ok(link);assert.equal(link.relation,'recurring');assert.equal(link.evidenceCount,2);
});

test('A pair grouped then separated has both exact observations and a counterlink',()=>{
  const a=museum('a',1),b=museum('b',3);[b.placements.w1,b.placements.w4]=[b.placements.w4,b.placements.w1];const result=build([a,b]),link=result.counterlinks.find(link=>signature(link.workIds)===signature(['w0','w1']));assert.ok(link);assert.equal(link.relation,'changed');assert.equal(link.support[0].roundId,'scenario:a');assert.equal(link.counter[0].roundId,'scenario:b');assert.deepEqual(link.observations.map(event=>event.relation),['together','apart']);
});

test('Changed offered sets never manufacture comparable recurrence',()=>{
  const a=museum('a',1),b=museum('b',3);b.offeredIds=b.offeredIds.filter(id=>id!=='w11');const result=build([a,b]);assert.equal(result.coverage.validArrangementRecords,2);assert.equal(result.coverage.comparableCohorts,0);assert.ok(result.groups.every(group=>!group.recurring));
});

test('Only actually presented museum omissions are listed; omission is not dislike',()=>{
  const record=museum();record.presentedIds.push('w8');const result=build([record]);assert.equal(result.omissions.length,1);assert.deepEqual(result.omissions[0].workIds,['w8']);assert.equal(result.omissions[0].count,1);assert.ok(!result.omissions[0].workIds.includes('w9'));assert.match(result.omissions[0].limits.join(' '),/does not establish dislike/);
});

test('Sorting proximity uses normalized 3:2 physical geometry and preserves saved positions',()=>{
  const record=sorting(),before=structuredClone(record),result=build([record]);assert.equal(result.groups.length,4);for(const group of result.groups){assert.equal(group.kind,'sorting-neighbours');for(const a of group.workIds)for(const b of group.workIds)assert.ok(sortingDistance(record.positions[a],record.positions[b])/Math.hypot(1.5,1)<=CONNECTION_THRESHOLDS.sortingNear);}const link=result.links.find(link=>signature(link.workIds)===signature(['w0','w1']));assert.ok(link);assert.ok(Math.abs(link.observations[0].distance-(.11*1.5/Math.hypot(1.5,1)))<1e-10);assert.deepEqual(record,before);
});

test('Complete-link sorting groups do not turn a proximity chain into a three-work cluster',()=>{
  const record=sorting('chain',1,[[.12,.2],[.32,.2],[.52,.2],[.83,.2],[.12,.75],[.32,.75],[.52,.75],[.83,.75]]),result=build([record]);assert.ok(result.groups.every(group=>!['w0','w1','w2'].every(id=>group.workIds.includes(id))));
});

test('Sorting near-to-far transitions retain exact earlier and later evidence',()=>{
  const a=sorting('a',1),b=sorting('b',3);[b.positions.w1,b.positions.w7]=[b.positions.w7,b.positions.w1];const result=build([a,b]),link=result.counterlinks.find(link=>signature(link.workIds)===signature(['w0','w1']));assert.ok(link);assert.deepEqual(link.observations.map(event=>event.relation),['near','far']);assert.equal(link.evidenceCount,2);
});

test('Different instruments can show a contextual difference without claiming exact repeat consistency',()=>{
  const result=build([museum(),sorting('sorting',4)]),pattern=result.crossTaskPatterns.find(pattern=>signature(pattern.workIds)===signature(['w2','w3']));assert.ok(pattern);assert.equal(pattern.comparable,false);assert.equal(pattern.evidenceCount,2);assert.match(pattern.limits.join(' '),/different instruments/);assert.equal(result.coverage.comparableCohorts,0);assert.ok(result.groups.every(group=>!group.recurring));
});

function responseFixture(){const art=works.slice(0,3),pref={id:'pref',kind:'spectrum',criterion:'preference',works:art,evidence:{construct:'preference',family:'individual-choice'}},curious={id:'curious',kind:'spectrum',criterion:'interest',works:[...art].reverse(),evidence:{construct:'curiosity'}},answers={pref:{workIds:['w0','w1','w2'],criterion:'preference',positions:{w0:100,w1:50,w2:0},confirmed:true},curious:{workIds:['w2','w1','w0'],criterion:'interest',positions:{w0:0,w1:50,w2:100},confirmed:true}};return {pref,curious,answers};}
test('Exact preference/curiosity maps preserve labelled recorded values in either presentation order',()=>{
  const f=responseFixture(),result=build([],{rounds:[f.curious,f.pref],answers:f.answers}),map=result.responseMaps[0];assert.ok(map);assert.equal(map.axes.x.label,'Preference');assert.equal(map.axes.y.label,'Curiosity');assert.deepEqual(map.points.map(point=>[point.workId,point.x,point.y]),[['w0',100,0],['w1',50,50],['w2',0,100]]);assert.ok(result.crossTaskPatterns.some(pattern=>pattern.kind==='preference-curiosity-contrast'));
});

test('Meaning maps use suggested meaning rather than another map instrument or fabricated preference',()=>{
  const f=responseFixture(),meaning={id:'meaning',kind:'grid',axis:'meaning',works:f.pref.works,evidence:{construct:'meaning'}},answer={workIds:['w0','w1','w2'],axis:'meaning',points:{w0:[10,80],w1:[50,50],w2:[90,20]},confirmed:true};const result=build([],{rounds:[f.pref,meaning],answers:{pref:f.answers.pref,meaning:answer}});assert.equal(result.responseMaps[0].axes.y.label,'Suggested meaning');assert.equal(result.responseMaps[0].points[0].y,10);assert.equal(result.responseMaps[0].points[0].interestInInterpretation,80);assert.deepEqual(build([],{rounds:[f.pref,meaning],answers:{meaning:answer}}).responseMaps,[]);
});

test('Incomplete, mismatched and ambiguous answer identities create no response coordinates',()=>{
  const f=responseFixture();for(const mutate of [answers=>delete answers.pref,answers=>delete answers.curious.positions.w0,answers=>answers.curious.workIds.reverse(),answers=>answers.curious.confirmed=false]){const answers=structuredClone(f.answers);mutate(answers);assert.deepEqual(build([],{rounds:[f.pref,f.curious],answers}).responseMaps,[]);}assert.deepEqual(build([],{rounds:[f.pref,f.curious,structuredClone(f.curious)],answers:f.answers}).responseMaps,[]);
});

test('Malformed, unconfirmed, unknown or duplicate record identities are rejected gracefully',()=>{
  const a=museum();for(const mutate of [record=>record.confirmed=false,record=>record.finishedAt=NaN,record=>record.placements.w0=null,record=>record.presentedIds.push('unknown'),record=>record.protocol='another-protocol']){const record=structuredClone(a);mutate(record);assert.equal(build([record]).coverage.validArrangementRecords,0);}assert.equal(build([a,structuredClone(a)]).coverage.validArrangementRecords,0);assert.doesNotThrow(()=>build([null,{},'broken']));
});

test('All visual lists and displayed groups are capped while source counts remain explicit',()=>{
  const result=build([museum(),sorting('one',3),sorting('two',5),museum('later',7)]);for(const field of ['groups','links','counterlinks','responseMaps','crossTaskPatterns','omissions'])assert.ok(result[field].length<=6);for(const group of result.groups){assert.ok(group.workIds.length<=6);assert.ok(group.totalWorkCount>=group.workIds.length);for(const item of [...group.support,...group.counter])assert.ok(item.workIds.every(id=>works.some(work=>work.id===id)));}
});

test('The current real catalogue can be used without imputing metadata or inventing a cluster',()=>{
  const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),before=structuredClone(actual),result=buildTasteConnections({works:actual,rounds:[],answers:{},records:[]});assert.deepEqual(result.groups,[]);assert.deepEqual(result.responseMaps,[]);assert.deepEqual(actual,before);
});
