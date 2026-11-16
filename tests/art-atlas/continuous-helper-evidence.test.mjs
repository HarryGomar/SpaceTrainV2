import test from 'node:test';
import assert from 'node:assert/strict';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {buildLookingAppraisals} from '../../public/art-atlas/looking-appraisals.mjs';
import {captureMuseumPreferences,museumPreferenceFindings} from '../../public/art-atlas/museum-preferences.mjs';
import {createDifficultEditRecord,setDifficultEditRemoval,analyzeDifficultEdit} from '../../public/art-atlas/difficult-edit.mjs';
import {buildResponseAtlas} from '../../public/art-atlas/response-atlas-data.mjs';

const works=Array.from({length:12},(_,i)=>({id:'art-'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/'+i+'.jpg',sourceUrl:'https://museum.example/'+i}));
const preference=(id,offered)=>withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:offered,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:round.works.map(w=>w.id),positions:Object.fromEntries(round.works.map((w,i)=>[w.id,values[i]]))});

test('Continuous appeal edges retain exact levels and one-point gaps without being labelled order-only',()=>{
  const round=preference('appeal',works.slice(0,4)),input={works,rounds:[round],answers:{appeal:answer(round,[90,89,70,70])}},atlas=buildResponseAtlas(input);
  const edge=atlas.graph.edges.find(e=>e.source==='art-0'&&e.target==='art-1');
  assert.equal(edge.gap,1);assert.deepEqual(edge.positions,{'art-0':90,'art-1':89});assert.equal(edge.relation,'appeal-difference');assert.equal(edge.orderOnly,false);
  const unknown=structuredClone(round);unknown.evidence.continuousProtocol='unrecognised-protocol';assert.equal(buildResponseAtlas({...input,rounds:[unknown]}).graph.edges.length,0);
  const missing=structuredClone(round);delete missing.evidence.continuousProtocol;assert.equal(buildResponseAtlas({...input,rounds:[missing]}).graph.edges.length,0);
});

test('Matched appraisal maps and evidence preserve the new personal-appeal scale and its gaps',()=>{
  const rounds=[],answers={};for(let i=0;i<3;i++){
    const offered=works.slice(i*4,i*4+4),pref=preference('pref-'+i,offered),app={id:'app-'+i,kind:'spectrum',criterion:'preference',title:'How much is there to take in?',hint:'Rate the amount of visual detail in each painting. This is separate from how much you like it.',scale:{left:'Visually sparse',right:'Visually dense'},works:offered,evidence:{construct:'perceived-visual-density',family:'looking-appraisal',role:'check'}};
    rounds.push(pref,app);answers[pref.id]=answer(pref,[91,90,89,88]);answers[app.id]=answer(app,[0,30,70,100]);
  }
  const model=buildLookingAppraisals({works,rounds,answers});
  assert.equal(model.panels.length,3);assert.equal(model.panels[0].axisDefinition.xName,'Personal appeal');assert.equal(model.panels[0].axisDefinition.left,'Strongly dislike');
  assert.deepEqual(model.panels[0].points.map(p=>p.x),[91,90,89,88]);
  assert.ok(model.observations[0].comparisons.some(c=>c.measures[0].values.includes(91)));
  const malformed=structuredClone(rounds);for(const r of malformed.filter(r=>r.id.startsWith('pref')))delete r.evidence.continuousProtocol;
  assert.equal(buildLookingAppraisals({works,rounds:malformed,answers}).panels.length,0);
});

test('Museum omissions use captured continuous levels once and do not compare incompatible rating instruments',()=>{
  const round=preference('appeal',works.slice(0,2)),context={roundId:'museum-round',index:2},snapshot=sources=>captureMuseumPreferences(works,{preferenceContext:context,preferenceSources:sources});
  const source={round,answer:answer(round,[92,20]),index:0},record={id:'museum',confirmed:true,finishedAt:10,offeredIds:['art-0','art-1'],presentedIds:['art-0','art-1'],placements:{'art-1':{wallId:'wall-1'}},roomResponses:{},preferenceSnapshot:snapshot([source])};
  const findings=museumPreferenceFindings(works,record);assert.equal(findings.length,1);assert.doesNotMatch(findings[0].id,/ordinal/);assert.match(findings[0].support[0].detail,/92 \/ 100/);
  const legacy=withOverallAppeal({id:'old',kind:'spectrum',criterion:'preference',works:works.slice(1,3),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
  const mixed={...record,preferenceSnapshot:snapshot([source,{round:legacy,answer:answer(legacy,[10,50]),index:1}])};
  assert.equal(museumPreferenceFindings(works,mixed).length,0);
});

test('A difficult edit shows the actual earlier continuous rating instead of converting it into a rank',()=>{
  const offered=works.slice(0,4),round=preference('earlier',offered),source={round,answer:answer(round,[91,90,89,88]),index:0};
  let record=createDifficultEditRecord(offered,{},[],{id:'edit',now:2,preferenceContext:{roundId:'edit-round',index:1},preferenceSources:[source],preferenceCatalogue:offered});
  record=setDifficultEditRemoval(record,'art-0',offered);record={...record,presentedIds:[...record.offeredIds],confirmed:true,finishedAt:3};
  const finding=analyzeDifficultEdit(offered,record).find(item=>item.readingBasis==='matched-earlier-preference');
  assert.ok(finding);assert.match(JSON.stringify(finding.comparisons),/91 \/ 100/);assert.doesNotMatch(JSON.stringify(finding.comparisons),/Earlier order/);
  const malformed=structuredClone(source);delete malformed.round.evidence.continuousProtocol;
  const rejected=createDifficultEditRecord(offered,{},[],{id:'bad',now:2,preferenceContext:{roundId:'edit-round',index:1},preferenceSources:[malformed],preferenceCatalogue:offered});
  assert.equal(rejected.preferenceSources.length,0);
});
