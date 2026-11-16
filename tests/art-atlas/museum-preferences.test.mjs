import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMuseumPreferences,museumPreferenceFindings} from '../../public/art-atlas/museum-preferences.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';

const works='abcdefgh'.split('').map(id=>({id,title:'Painting '+id,artist:'Artist '+id,image:'art/'+id+'.jpg',sourceUrl:'https://museum.example/'+id}));
const source=(index,ids,values)=>{const round=withOverallAppeal({id:'pref-'+index,kind:'spectrum',criterion:'preference',works:ids.map(id=>works.find(work=>work.id===id)),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});return {index,round,answer:{workIds:ids,criterion:'preference',positions:Object.fromEntries(ids.map((id,n)=>[id,values[n]])),confirmed:true}};};
const earlier=[source(1,['a','b','c','d'],[95,80,25,70]),source(3,['e','f','g','h'],[90,60,20,50])];
const context={roundId:'museum-round',index:10};
function museum(){return {id:'museum',kind:'curate',protocol:'open-gallery-v1',createdAt:20,confirmed:true,finishedAt:30,offeredIds:works.map(work=>work.id),presentedIds:works.map(work=>work.id),placements:{b:{wallId:'wall1'},c:{wallId:'wall2'},d:{wallId:'wall3'}},roomResponses:{entryId:'c'},preferenceSnapshot:captureMuseumPreferences(works,{preferenceContext:context,preferenceSources:earlier})};}

test('Museum omission uses the frozen overall-appeal sources including comparisons from different earlier groups',()=>{
  const record=museum(),before=structuredClone(record),findings=museumPreferenceFindings(works,record),omission=findings.find(finding=>finding.id.endsWith('omission'));
  assert.ok(omission);assert.ok(omission.evidence.includes('a'));assert.ok(omission.evidence.includes('c'));assert.ok(omission.support.some(item=>item.roundId==='pref-1'));
  assert.ok(findings.some(item=>item.id.endsWith('entry')));assert.deepEqual(record,before);
  record.presentedIds=record.presentedIds.filter(id=>!['a','e'].includes(id));
  assert.equal(museumPreferenceFindings(works,record).some(item=>item.id.endsWith('omission')),false,'Unseen offered favourites cannot become deliberate omissions');
});

test('Legacy relative questions, future sources, unfinished answers and changed identities cannot supply global appeal',()=>{
  for(const change of [item=>{delete item.round.evidence.appealProtocol;},item=>{item.index=11;},item=>{item.answer.confirmed=false;},item=>{item.round.works[0].sourceUrl='https://other.example/a';}]){
    const sources=structuredClone(earlier);for(const item of sources)change(item);
    const snapshot=captureMuseumPreferences(works,{preferenceContext:context,preferenceSources:sources});assert.deepEqual(snapshot.sources,[]);
  }
  const record=museum();record.preferenceSnapshot.sources[0].answer.positions.a=Infinity;
  assert.equal(museumPreferenceFindings(works,record).some(item=>item.evidence.includes('a')),false);
});

test('Changing an answer after the museum starts cannot change its captured preference evidence',()=>{
  const record=museum(),before=museumPreferenceFindings(works,record);const changed=structuredClone(earlier);changed[0].answer.positions.a=0;
  assert.deepEqual(museumPreferenceFindings(works,record),before);
  const later=museum();later.preferenceSnapshot=captureMuseumPreferences(works,{preferenceContext:context,preferenceSources:changed});
  assert.ok(!museumPreferenceFindings(works,later).find(item=>item.id.endsWith('omission'))?.support.some(item=>item.workIds.includes('a')),'The changed low rating can be counterevidence, but cannot support the favourite-omission claim');
});
