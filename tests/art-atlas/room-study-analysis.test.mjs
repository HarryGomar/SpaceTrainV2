import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeRoomDecisions, roomGraphDistance } from '../../public/art-atlas/room-study-analysis.mjs';
import { buildRounds } from '../../public/art-atlas/engine.mjs';

const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const walls=Array.from({length:5},(_,i)=>({id:'wall-'+(i+1),roomId:'g'+(i+1),side:'north',x1:0,y1:0,x2:900,y2:0}));
const connections=[['hall','g2'],['hall','g4'],['hall','g5'],['g1','g2'],['g2','g3'],['g1','g4'],['g3','g5']];
function synthetic(values=[.2,.8,1,0]) {
  const works=values.flatMap((value,index)=>[0,1].map(i=>({id:'art-'+(index+1)+'-'+i,title:'Painting '+(index+1)+'-'+i,date:'1900',features:{humanity:value,narrative:.5},analysis:{yearRange:[1900,1900],palette:{histogram:[1,...Array(39).fill(0)]}}})));
  const placements=Object.fromEntries(works.map((w,i)=>[w.id,{wallId:'wall-'+(Math.floor(i/2)+1),t:i%2?.7:.3,intent:'room-drop'}]));
  return {works,record:{version:2,kind:'curate',protocol:'open-gallery-v1',roomStudy:'room-relations-v1',id:'rooms-one',createdAt:1,offeredIds:works.map(w=>w.id),presentedIds:works.map(w=>w.id),placements,roomNames:{},baselineAnswers:{},phase:'walkthrough',roomResponses:{entryId:works[0].id,lingerRoomId:'g3',bridgeIds:[works[0].id,works[4].id]},confirmed:true,finishedAt:2}};
}
function actualRecord() {
  const round=buildRounds(actual)[0],quartet=round.works.map(w=>w.id),ids=[...quartet,...actual.filter(w=>!quartet.includes(w.id)).slice(0,2).map(w=>w.id)];
  const record={version:2,kind:'curate',protocol:'open-gallery-v1',roomStudy:'room-relations-v1',id:'actual-rooms',createdAt:1,offeredIds:actual.map(w=>w.id),presentedIds:ids,placements:Object.fromEntries(ids.map((id,i)=>[id,{wallId:i<3?'wall-1':'wall-2',t:(i%3+1)/4}])),roomNames:{},baselineAnswers:{preferenceRank:{workIds:quartet,criterion:'preference',confirmed:true,positions:Object.fromEntries(quartet.map((id,i)=>[id,[100,70,40,0][i]]))}},phase:'walkthrough',roomResponses:{entryId:quartet[1],lingerRoomId:'g2',bridgeIds:[quartet[1],ids[5]]},confirmed:true,finishedAt:2};
  return {record,quartet,ids};
}

test('The graph distinguishes a direct gallery connection from a route through the hall',()=>{
  assert.equal(roomGraphDistance(connections,'g1','g2'),1);assert.equal(roomGraphDistance(connections,'g4','g5'),2);assert.equal(roomGraphDistance(connections,'g1','g5'),3);assert.equal(roomGraphDistance(connections,'g1','missing'),null);
});

test('The beginning and the longest stop can use different room groups without claiming a cause',()=>{
  const {works,record}=synthetic(),f=analyzeRoomDecisions(works,record,walls,connections).find(f=>f.id.endsWith('entry-and-linger'));
  assert.ok(f);assert.match(f.text,/arrival choice and the room worth more time separated/);assert.equal(f.support.length,2);assert.match(f.alternatives.join(' '),/not measured viewing time/);
});

test('An earlier favourite is compared only through a valid matching preference snapshot',()=>{
  const {record,quartet}=actualRecord(),f=analyzeRoomDecisions(actual,record,walls,connections).find(f=>f.id.endsWith('entry-and-linger'));
  assert.ok(f);assert.match(f.title,/earlier favourite/);assert.ok(f.evidence.includes(quartet[0]));assert.ok(f.evidence.includes(quartet[1]));assert.equal(f.support.find(e=>e.sourceRoundId==='preferenceRank').roundId,'scenario:actual-rooms');
  record.baselineAnswers.preferenceRank.workIds.reverse();const invalid=analyzeRoomDecisions(actual,record,walls,connections);assert.equal(invalid.some(f=>/favourite|You rated/.test(f.title+' '+f.text)),false);
});

test('Missing preference answers and an unrated starting work never become favourite claims',()=>{
  const {record,ids}=actualRecord();record.baselineAnswers={};assert.equal(analyzeRoomDecisions(actual,record,walls,connections).some(f=>/favourite|You rated/.test(f.title+' '+f.text)),false);
  const rated=actualRecord();rated.record.roomResponses.entryId=ids[5];assert.equal(analyzeRoomDecisions(actual,rated.record,walls,connections).some(f=>/favourite|You rated/.test(f.title+' '+f.text)),false);
});

test('A chosen cross-room link remains precise when no measured descriptor explains it',()=>{
  const {works,record}=synthetic([.5,.5,.5,.5,.5]);record.roomResponses.entryId=works[6].id;record.roomResponses.lingerRoomId='g4';record.roomResponses.bridgeIds=[works[6].id,works[8].id];
  const result=analyzeRoomDecisions(works,record,walls,connections),f=result.find(f=>f.id.endsWith('chosen-bridge'));assert.ok(f);assert.match(f.text,/2 connections apart/);assert.equal(f.support.length,1);assert.doesNotMatch(f.text,/relatively similar|also similar/);assert.equal(result.some(f=>f.scope==='room-adjacency'),false);
});

test('A cross-room descriptor connection keeps a contrasting descriptor as a limit',()=>{
  const {works,record}=synthetic();record.roomResponses.bridgeIds=[works[0].id,works[2].id];
  for(let i=0;i<works.length;i++){works[i].analysis.palette.histogram=Array(40).fill(0);works[i].analysis.palette.histogram[i<4?0:1]=1;}
  works[0].analysis.yearRange=[1500,1500];works[0].date='1500';works[2].analysis.yearRange=[1900,1900];works[2].date='1900';
  const f=analyzeRoomDecisions(works,record,walls,connections).find(f=>f.id.endsWith('chosen-bridge'));assert.ok(f);assert.match(f.text,/similar colour distributions/);assert.match(f.text,/your reason remains open/);assert.ok(f.counter.some(e=>e.detail.includes('different recorded date ranges')));
});

test('Adjacency compares intact room groups over the physical graph, including remote rooms',()=>{
  const {works,record}=synthetic(),f=analyzeRoomDecisions(works,record,walls,connections).find(f=>f.scope==='room-adjacency');
  assert.ok(f);assert.equal(f.feature,'humanity');assert.match(f.text,/directly connected gallery groups have closer/);assert.match(f.alternatives.join(' '),/24 permutations/);assert.match(f.alternatives.join(' '),/automatic wall spacing/);assert.ok(f.support.some(e=>e.detail.includes('graph connections apart')));
});

test('A spatial contrast can also be described without claiming an intention to create it',()=>{
  const {works,record}=synthetic([1,0,.8,.2]),f=analyzeRoomDecisions(works,record,walls,connections).find(f=>f.scope==='room-adjacency');
  assert.ok(f);assert.match(f.text,/more different/);assert.match(f.alternatives.join(' '),/does not prove an intention/);
});

test('Five populated rooms compare all 120 assignments of the intact groups',()=>{
  const {works,record}=synthetic([.2,.5,.8,0,1]),f=analyzeRoomDecisions(works,record,walls,connections).find(f=>f.scope==='room-adjacency');
  assert.ok(f);assert.match(f.alternatives.join(' '),/120 permutations/);assert.match(f.text,/have closer/);
});

test('Automatic wall placement and later wall adjustments do not alter room-level conclusions',()=>{
  const {works,record}=synthetic(),first=analyzeRoomDecisions(works,record,walls,connections),changed=structuredClone(record);
  Object.values(changed.placements).forEach((p,i)=>{p.t=i%2?.2:.8;p.intent='wall-adjusted';});
  assert.deepEqual(analyzeRoomDecisions(works,changed,walls,connections),first);
});

test('Fewer occupied rooms, uniform descriptors and unvaried graph alternatives yield no adjacency claim',()=>{
  const small=synthetic([0,.5,1]);assert.equal(analyzeRoomDecisions(small.works,small.record,walls,connections).some(f=>f.scope==='room-adjacency'),false);
  const flat=synthetic([.5,.5,.5,.5]);assert.equal(analyzeRoomDecisions(flat.works,flat.record,walls,connections).some(f=>f.scope==='room-adjacency'),false);
  const star=[['hall','g1'],['hall','g2'],['hall','g3'],['hall','g4']];const other=synthetic();assert.equal(analyzeRoomDecisions(other.works,other.record,walls,star).some(f=>f.scope==='room-adjacency'),false);
});

test('Unconfirmed, incomplete, unknown and same-room bridge choices produce no room findings',()=>{
  const {works,record}=synthetic();
  for(const invalid of [{...record,confirmed:false},{...record,phase:'arrange'},{...record,roomStudy:undefined},{...record,roomResponses:{...record.roomResponses,entryId:'unknown'}},{...record,roomResponses:{...record.roomResponses,lingerRoomId:'hall'}},{...record,roomResponses:{...record.roomResponses,bridgeIds:[works[0].id,works[1].id]}},{...record,roomResponses:{...record.roomResponses,bridgeIds:[works[0].id,works[0].id]}}])assert.deepEqual(analyzeRoomDecisions(works,invalid,walls,connections),[]);
  const broken=structuredClone(record);broken.placements[works[0].id]=null;assert.deepEqual(analyzeRoomDecisions(works,broken,walls,connections),[]);
});

test('Every observation retains exact known identities and the exhibition record scope',()=>{
  const {works,record}=synthetic(),result=analyzeRoomDecisions(works,record,walls,connections);assert.ok(result.length<=3);
  for(const f of result)for(const e of [...f.support,...f.counter]){assert.equal(e.roundId,'scenario:'+record.id);for(const id of e.workIds)assert.ok(works.some(w=>w.id===id));}
});

function narrativeFixture(){
  const result=synthetic();
  for(const work of result.works){work.features.narrative=work.features.humanity;work.features.humanity=.5;}
  result.record.roomResponses.bridgeIds=[result.works[0].id,result.works[6].id];
  return result;
}

test('Pending, v1 and per-field unknown action annotations cannot explain a bridge or room adjacency',()=>{
  for(const mode of ['pending','v1','unknown']){
    const {works,record}=narrativeFixture();
    for(const work of works){
      work.featureSemanticVersion=mode==='pending'?'pending-literal-action-setting-review':mode==='v1'?'literal-action-setting-v1':'literal-action-setting-v2';
      if(mode==='unknown')work.featureLiteralReview={version:'literal-action-setting-v2',reviewed:true,fields:{narrative:{status:'unknown',value:null}}};
    }
    const findings=analyzeRoomDecisions(works,record,walls,connections);
    assert.equal(findings.some(finding=>finding.feature==='narrative'),false,mode+' adjacency');
    const bridge=findings.find(finding=>finding.id.endsWith('chosen-bridge'));
    assert.ok(bridge,mode+' retains the explicit chosen connection');
    assert.doesNotMatch(bridge.text,/depicted events|depicted action/,mode+' bridge');
    assert.equal(bridge.support.length,1,mode+' has no invented descriptor support');
  }
});

test('Explicit reviewed-v2 action supports the same descriptive comparisons while a stale field value is rejected',()=>{
  const {works,record}=narrativeFixture();
  for(const work of works){
    work.featureSemanticVersion='literal-action-setting-v2';
    work.featureLiteralReview={version:'literal-action-setting-v2',reviewed:true,fields:{narrative:{status:'reviewed',value:work.features.narrative}}};
  }
  const findings=analyzeRoomDecisions(works,record,walls,connections);
  assert.ok(findings.some(finding=>finding.feature==='narrative'));
  assert.match(findings.find(finding=>finding.id.endsWith('chosen-bridge')).text,/depicted events|depicted action/);
  for(const work of works)work.featureLiteralReview.fields.narrative.value=1-work.features.narrative;
  const stale=analyzeRoomDecisions(works,record,walls,connections);
  assert.equal(stale.some(finding=>finding.feature==='narrative'),false);
  assert.doesNotMatch(stale.find(finding=>finding.id.endsWith('chosen-bridge')).text,/depicted events|depicted action/);
});
