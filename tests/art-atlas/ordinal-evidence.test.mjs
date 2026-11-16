import test from 'node:test';
import assert from 'node:assert/strict';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {comparisonReadout} from '../../public/art-atlas/profile-comparisons.mjs';
import {renderProfileEvidence} from '../../public/art-atlas/taste-portrait-parts.mjs';
import {buildLookingAppraisals} from '../../public/art-atlas/looking-appraisals.mjs';
import {captureMuseumPreferences,museumPreferenceFindings} from '../../public/art-atlas/museum-preferences.mjs';
import {createDifficultEditRecord,setDifficultEditRemoval,analyzeDifficultEdit} from '../../public/art-atlas/difficult-edit.mjs';
import {buildResponseAtlas} from '../../public/art-atlas/response-atlas-data.mjs';

const works=Array.from({length:12},(_,i)=>({id:'art-'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/'+i+'.jpg',sourceUrl:'https://museum.example/'+i}));
const ordinary=(id,offered)=>({id,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Compare this group.',works:offered,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:round.works.map(w=>w.id),positions:Object.fromEntries(round.works.map((w,i)=>[w.id,values[i]]))});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('Evidence shows an ordinal choice and exact ties, while old close ratings retain their original rule',()=>{
  const round=withComparisonPreference(ordinary('order',works.slice(0,4))),a=answer(round,[91,90,90,0]),item={title:'Actual comparison',support:[{roundId:'order',workIds:['art-0','art-1']}]},input={works,rounds:[round],answers:{order:a}};
  const readout=comparisonReadout(item,input);
  assert.ok(readout.notes['art-0'].some(note=>note.role==='preferred'));
  const html=renderProfileEvidence({...input,item,image:w=>'<img alt="'+w.title+'">',esc});
  assert.match(html,/Order in this group/);assert.match(html,/<strong>1 of 4<\/strong>/);assert.match(html,/<strong>Joint 2 of 4<\/strong>/);assert.doesNotMatch(html,/91<small>|90<small>|Personal appeal/);
  const tied=structuredClone(a);tied.positions['art-0']=90;
  assert.ok(comparisonReadout(item,{...input,answers:{order:tied}}).notes['art-0'].some(note=>note.role==='tie'&&note.text==='Equal preference'));
  const legacy={...ordinary('order',works.slice(0,4))};
  assert.ok(comparisonReadout(item,{...input,rounds:[legacy]}).notes['art-0'].some(note=>note.role==='near-tie'));
});

test('Appraisal relationships are unchanged by monotone changes to ordinal line spacing',()=>{
  function fixture(values){const rounds=[],answers={};for(let i=0;i<3;i++){
    const offered=works.slice(i*4,i*4+4),pref=withComparisonPreference(ordinary('pref-'+i,offered)),app={id:'app-'+i,kind:'spectrum',criterion:'preference',title:'How much is there to take in?',hint:'Rate the amount of visual detail in each painting. This is separate from how much you like it.',scale:{left:'Visually sparse',right:'Visually dense'},works:offered,evidence:{construct:'perceived-visual-density',family:'looking-appraisal',role:'check'}};
    rounds.push(pref,app);answers[pref.id]=answer(pref,values);answers[app.id]=answer(app,[100,70,30,0]);
  }return {works,rounds,answers};}
  const narrow=buildLookingAppraisals(fixture([90,91,92,93])),wide=buildLookingAppraisals(fixture([0,30,60,100]));
  assert.equal(narrow.observations.length,1);
  const digest=model=>model.observations.map(item=>({title:item.title,balance:item.evidenceBalance,support:item.support.map(e=>[e.roundId,e.workIds]),counter:item.counter.map(e=>[e.roundId,e.workIds])}));
  assert.deepEqual(digest(narrow),digest(wide));
  assert.equal(narrow.observations[0].evidenceBalance.opposedSets,3);
});

test('Museum omissions use the exact earlier ordinal pair and do not compare disconnected group positions',()=>{
  const first=withComparisonPreference(ordinary('first',works.slice(0,2))),other=withComparisonPreference(ordinary('other',works.slice(2,4))),context={roundId:'museum-round',index:2};
  const snapshot=values=>captureMuseumPreferences(works,{preferenceContext:context,preferenceSources:[{round:first,answer:answer(first,values),index:0},{round:other,answer:answer(other,[100,0]),index:1}]});
  const record={id:'museum',confirmed:true,finishedAt:10,offeredIds:works.slice(0,4).map(w=>w.id),presentedIds:works.slice(0,4).map(w=>w.id),placements:{'art-1':{wallId:'wall-1'}},roomResponses:{},preferenceSnapshot:snapshot([91,90])};
  const findings=museumPreferenceFindings(works,record);
  assert.equal(findings.length,1);assert.deepEqual(findings[0].evidence,['art-0','art-1']);assert.equal(findings[0].comparisonBasis,'same-pair-ordinal-preference');
  assert.doesNotMatch(findings[0].text,/91|90|100|highly rated/);
  assert.deepEqual(museumPreferenceFindings(works,{...record,preferenceSnapshot:snapshot([100,0])}).map(f=>[f.title,f.evidence]),findings.map(f=>[f.title,f.evidence]));
  assert.equal(museumPreferenceFindings(works,{...record,preferenceSnapshot:snapshot([50,50])}).length,0);
});

test('A wall edit detects an earlier one-step ordinal order without treating the step as liking strength',()=>{
  const offered=works.slice(0,4),round=withComparisonPreference(ordinary('earlier',offered)),source={round,answer:answer(round,[91,90,89,88]),index:0};
  let record=createDifficultEditRecord(offered,{},[],{id:'edit',now:2,preferenceContext:{roundId:'edit-round',index:1},preferenceSources:[source],preferenceCatalogue:offered});
  record=setDifficultEditRemoval(record,'art-0',offered);record={...record,presentedIds:[...record.offeredIds],confirmed:true,finishedAt:3};
  const finding=analyzeDifficultEdit(offered,record).find(item=>item.readingBasis==='matched-earlier-preference');
  assert.ok(finding);assert.match(JSON.stringify(finding.comparisons),/Earlier order: 1 of 4/);assert.doesNotMatch(JSON.stringify(finding.comparisons),/91 \/ 100/);
});

test('The atlas draws one-step ordinal orders and withholds stale literal action annotations',()=>{
  const round=withComparisonPreference(ordinary('compare',works.slice(0,4))),input={works,rounds:[round],answers:{compare:answer(round,[91,90,90,0])}},atlas=buildResponseAtlas(input);
  assert.equal(atlas.graph.edges.length,5);assert.equal(atlas.graph.clearGap,1);assert.equal(atlas.graph.globalRanking,null);
  assert.ok(atlas.graph.edges.some(edge=>edge.source==='art-0'&&edge.target==='art-1'&&edge.relation==='preference-order'));
  const stale=works.slice(0,2).map(work=>({...work,features:{narrative:1,atmosphere:1,abstraction:.5}})),descriptions=buildResponseAtlas({works:stale});
  assert.equal(descriptions.dimensions.find(d=>d.id==='narrative').values.length,0);assert.equal(descriptions.dimensions.find(d=>d.id==='atmosphere').values.length,0);
  assert.equal(descriptions.dimensions.find(d=>d.id==='abstraction').values.length,2);
  const changed=structuredClone(round);changed.hint='A different task';assert.equal(buildResponseAtlas({...input,rounds:[changed]}).graph.edges.length,0);
});
