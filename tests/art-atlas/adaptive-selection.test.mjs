import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planAdaptivePanels } from '../../public/art-atlas/adaptive-selection.mjs';

const featureKeys = ['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
function artworks(count = 60) {
  return Array.from({ length: count }, (_, i) => ({ id:'w'+String(i).padStart(2,'0'), artist:'Artist '+i, artistKnown:true, country:'Region '+i%4, features:Object.fromEntries(featureKeys.map(k=>[k,k==='abstraction'?(i%3)/2:.5])) }));
}
function source(works, index, options = {}) {
  const chosen=works.slice(index*3,index*3+3);
  return {id:'journey-'+index,kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Place the works. Equal positions are fine.',scale:{left:'Less preferred',right:'More preferred'},works:chosen,evidence:{construct:'preference',family:'individual-choice',role:'discovery',setId:'set-'+index,batchIndex:1,...options.evidence},...options};
}
function answer(round, values = [0,50,100]) {
  return {workIds:round.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(round.works.map((w,i)=>[w.id,values[i]])),confirmed:true};
}
function history(works=artworks(), count=12) {
  const rounds=Array.from({length:count},(_,i)=>source(works,i));
  return {works,rounds,answers:Object.fromEntries(rounds.map(r=>[r.id,answer(r)])),batchIndex:2,seed:'regression-seed'};
}
const pairKey=(a,b)=>JSON.stringify([a,b].sort());
const allPairs=ids=>ids.flatMap((a,i)=>ids.slice(i+1).map(b=>pairKey(a,b)));

test('Later exploration retains landmark anchors even after their greater prior exposure',()=>{
  const works=artworks(120).map((work,index)=>({...work,recognitionTier:index<40?'landmark':index<80?'established':'discovery'}));
  const rounds=Array.from({length:5},(_,i)=>({id:'exposure-'+i,kind:'match',works:works.slice(0,40)}));
  const plan=planAdaptivePanels({works,rounds,answers:{},batchIndex:4,seed:'known-anchors'}),byId=new Map(works.map(work=>[work.id,work]));
  assert.equal(plan.panels.length,18);assert.ok(plan.panels.every(panel=>panel.role==='exploration'));
  for(const panel of plan.panels){assert.equal(panel.workIds.filter(id=>byId.get(id).recognitionTier==='landmark').length,panel.subtype==='new-comparison'?1:2);assert.ok(panel.workIds.filter(id=>byId.get(id).recognitionTier==='discovery').length<=1);}
  assert.ok(Math.max(...Object.values(plan.coverage.plannedUses))<=2);
  assert.equal(new Set(plan.panels.flatMap(panel=>panel.workIds)).size,plan.panels.reduce((total,panel)=>total+panel.workIds.length,0));
});

test('Default later batch keeps the exploration floor and stratifies delayed repeats',()=>{
  const input=history(),plan=planAdaptivePanels(input);
  assert.equal(plan.panels.length,18);
  assert.deepEqual(plan.coverage.actualRoles,{exploration:11,repeat:3,recontextualization:2,challenge:2});
  assert(plan.coverage.explorationShare>=.6);
  assert.deepEqual(plan.panels.filter(p=>p.role==='repeat').map(p=>p.focus.band),['relative-high','relative-low','middle']);
  assert(Math.max(...Object.values(plan.coverage.plannedUses))<=2);
});

test('Only confirmed unconditional preference observations supply adaptive evidence',()=>{
  const input=history();
  input.rounds.forEach((r,i)=>{
    if(i===0)r.evidence.family='contextual-choice';
    if(i===1)r.evidence.family='looking-appraisal';
    if(i===2)r.evidence.construct='curiosity';
    if(i===3)r.criterion='interest';
    if(i===4)input.answers[r.id].confirmed=false;
    if(i===5)input.answers[r.id].positions[r.works[0].id]=NaN;
    if(i===6)input.answers[r.id]={skipped:true};
    if(i===7)r.anchorWorks=[input.works.at(-1)];
    if(i===8)r.evidence.family='unrecognised';
    if(i===9)r.evidence.unconditional=false;
  });
  const plan=planAdaptivePanels(input);
  assert.deepEqual(plan.coverage.eligiblePreferenceRoundIds,['journey-10','journey-11']);
  assert(plan.panels.every(p=>p.evidenceRoundIds.every(id=>['journey-10','journey-11'].includes(id))));
  assert(plan.panels.every(p=>!p.provisionalPrediction));
});

test('Ties remain level responses and never become high/low liking or a directional cue',()=>{
  const input=history();input.answers=Object.fromEntries(input.rounds.map(r=>[r.id,answer(r,[90,90,90])]));
  const plan=planAdaptivePanels(input);
  assert(plan.panels.filter(p=>p.role==='repeat').every(p=>p.focus.band==='level-or-mixed'));
  assert.equal(plan.coverage.actualRoles.recontextualization,0);
  assert(plan.panels.every(p=>!p.provisionalPrediction));
});

test('Relative extremes use within-set gaps rather than pooled scale positions',()=>{
  const works=artworks(),rounds=[source(works,0),source(works,1)];
  const answers={[rounds[0].id]:answer(rounds[0],[0,10,20]),[rounds[1].id]:answer(rounds[1],[80,80,80])};
  const plan=planAdaptivePanels({works,rounds,answers,batchIndex:2,panelCount:4,quotas:{exactRepeats:1,recontextualizations:0,challenges:0}});
  const repeated=plan.panels.find(p=>p.role==='repeat');
  assert.equal(repeated.focus.workId,rounds[0].works[2].id);
  assert.equal(repeated.focus.positionWithinSource,20);
  assert.equal(repeated.focus.band,'relative-high');
});

test('Exact repeats preserve prompt, scale and complete set, with reversed order and no mutation',()=>{
  const input=history(),before=structuredClone(input),plan=planAdaptivePanels(input);
  assert.deepEqual(input,before);
  for(const p of plan.panels.filter(p=>p.role==='repeat')){
    const original=input.rounds.find(r=>r.id===p.repeatOf);
    assert.equal(p.exactRepeat,true);assert.equal(p.sourceRoundId,original.id);
    assert.deepEqual(p.workIds,original.works.map(w=>w.id).reverse());
    assert.equal(p.promptSnapshot.title,original.title);assert.equal(p.promptSnapshot.hint,original.hint);
    assert.deepEqual(p.promptSnapshot.scale,original.scale);
    assert.deepEqual(p.promptSnapshot.workIds,original.works.map(w=>w.id));
    p.promptSnapshot.scale.left='Edited output';assert.equal(original.scale.left,'Less preferred');
  }
});

test('Snapshots freeze the actual training values and do not recursively copy older selector plans',()=>{
  const input=history();input.rounds.forEach(r=>{r.evidence.adaptiveSelection={promptSnapshot:{olderPlan:'large nested state'}};});
  const plan=planAdaptivePanels(input),probe=plan.panels.find(p=>p.provisionalHypothesis);
  assert(probe);const training=probe.provisionalHypothesis.trainingEvidence[0],id=training.workIds[0],before=training.positions[id];
  input.answers[training.roundId].positions[id]=79;input.works.find(w=>w.id===id).features.abstraction=.37;
  assert.equal(training.positions[id],before);assert.notEqual(training.featureValues[id],.37);
  for(const p of plan.panels.filter(p=>p.role==='repeat'))assert.equal(p.promptSnapshot.evidence.adaptiveSelection,undefined);
});

test('A same-batch repeat waits for eight intervening shown rounds or an explicit later batch',()=>{
  const works=artworks(),r=source(works,0),answers={[r.id]:answer(r)};
  const filler=n=>Array.from({length:n},(_,i)=>({id:'map-'+i,kind:'grid',works:works.slice(20,23),evidence:{construct:'response'}}));
  const options={works,answers,panelCount:4,batchIndex:1,quotas:{exactRepeats:1,recontextualizations:0,challenges:0}};
  assert.equal(planAdaptivePanels({...options,rounds:[r,...filler(7)]}).coverage.actualRoles.repeat,0);
  const delayed=planAdaptivePanels({...options,rounds:[r,...filler(8)]}).panels.find(p=>p.role==='repeat');
  assert.equal(delayed.delay.interveningRoundCount,8);assert.equal(delayed.delay.basis,'intervening-shown-rounds');
  const nextBatch=planAdaptivePanels({...options,rounds:[r],batchIndex:2}).panels.find(p=>p.role==='repeat');
  assert.equal(nextBatch.delay.basis,'later-batch');
  r.evidence.batchIndex=0;
  const zeroBased=planAdaptivePanels({...options,rounds:[r],batchIndex:1}).panels.find(p=>p.role==='repeat');
  assert.equal(zeroBased.delay.sourceBatchIndex,0);assert.equal(zeroBased.delay.basis,'later-batch');
});

test('Future-repeat works are reserved so earlier planned exploration does not erase the gap',()=>{
  const plan=planAdaptivePanels(history());
  plan.panels.forEach((panel,index)=>{if(panel.role==='repeat')assert(plan.panels.slice(0,index).every(p=>p.workIds.every(id=>!panel.workIds.includes(id))));});
});

test('Exploration floor survives excessive quota requests and scarce repeat evidence',()=>{
  for(const count of [1,2,3,4,12,18,27]){
    const plan=planAdaptivePanels({works:artworks(),panelCount:count,quotas:{exactRepeats:100,recontextualizations:100,challenges:100}});
    assert.equal(plan.panels.length,count);assert(plan.coverage.explorationShare>=.6);
    assert(plan.panels.every(p=>p.role==='exploration'));
  }
  const raised=planAdaptivePanels({...history(),quotas:{minExplorationShare:.8}});assert(raised.coverage.explorationShare>=.8);
});

test('Challenge pairs are new across actual prior co-presentation, including anchors and earlier planned panels',()=>{
  const input=history();input.rounds.push({id:'context-anchor',kind:'spectrum',criterion:'preference',works:[input.works[40]],anchorWorks:[input.works[41]],evidence:{construct:'companion',family:'contextual-choice'}});
  const plan=planAdaptivePanels(input),seen=new Set();
  for(const r of input.rounds){const ids=[...r.works,...(r.anchorWorks||[])].map(w=>w.id);allPairs(ids).forEach(k=>seen.add(k));}
  let checked=0;
  for(const p of plan.panels){
    if(p.role==='challenge'){
      checked++;assert.equal(p.workIds.length,2);assert.equal(p.holdoutUnit,'new-comparison');assert.equal(p.comparisonNovel,true);
      assert(allPairs(p.workIds).every(k=>!seen.has(k)));assert(p.provisionalPrediction);assert(p.workIds.includes(p.provisionalPrediction));
      assert(p.evidenceRoundIds.every(id=>input.rounds.some(r=>r.id===id)));
    }
    allPairs(p.workIds).forEach(k=>seen.add(k));
  }
  assert.equal(checked,2);
});

test('Repeated source sets cannot inflate the source-set gate or generate confidence percentages',()=>{
  const works=artworks(),base=source(works,0),rounds=Array.from({length:12},(_,i)=>({...structuredClone(base),id:'repeat-'+i,evidence:{...base.evidence,role:'repeat',repeatOf:base.id}}));
  const answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r)]));const plan=planAdaptivePanels({works,rounds,answers,batchIndex:2});
  assert.equal(plan.coverage.distinctPreferenceSetCount,1);assert.equal(plan.coverage.eligiblePreferenceRoundIds.length,12);
  assert(plan.panels.every(p=>!p.provisionalPrediction));assert(!Object.hasOwn(plan,'confidence'));assert(!Object.hasOwn(plan,'reliability'));
});

test('Direction probes require several distinct sets and artists, and never impute missing descriptors as zero',()=>{
  const input=history();input.works.forEach(w=>{w.artist='One artist';});
  assert(planAdaptivePanels(input).panels.every(p=>!p.provisionalPrediction));
  const missing=history();missing.works.forEach(w=>{w.features={};});
  assert(planAdaptivePanels(missing).panels.every(p=>!p.provisionalPrediction));
  const good=planAdaptivePanels(history());assert(good.panels.some(p=>p.provisionalHypothesis?.feature==='abstraction'));
  assert(good.panels.filter(p=>p.provisionalPrediction).every(p=>p.provisionalHypothesis.sourceSetCount>=3));
});

test('Unshown answers cannot affect selection; same inputs and catalogue permutation remain deterministic',()=>{
  const input=history(),base=planAdaptivePanels(input);
  const changed=structuredClone(input);changed.answers['future-unshown']={confirmed:true,positions:{w00:100,w01:0}};
  assert.deepEqual(planAdaptivePanels(changed),base);
  assert.deepEqual(planAdaptivePanels({...input,works:[...input.works].reverse()}),base);
  assert.notDeepEqual(planAdaptivePanels({...input,seed:'another-seed'}).panels,base.panels);
});

test('Recontextualisation changes alternatives and is never labelled an exact repeat',()=>{
  const input=history(),plan=planAdaptivePanels(input);
  for(const p of plan.panels.filter(p=>p.role==='recontextualization')){
    const source=input.rounds.find(r=>r.id===p.focus.sourceRoundId),sourceIds=source.works.map(w=>w.id);
    assert(p.workIds.includes(p.focus.workId));assert(p.workIds.filter(id=>id!==p.focus.workId).every(id=>!sourceIds.includes(id)));
    assert.equal(p.repeatOf,undefined);assert.equal(p.exactRepeat,undefined);
  }
});

test('A previously co-presented catalogue still allows different alternatives without a false novelty claim',()=>{
  const input=history();input.rounds.push({id:'offered-catalogue',kind:'exercise',works:input.works,evidence:{construct:'arrangement',family:'contextual-arrangement'}});
  const plan=planAdaptivePanels(input),recontext=plan.panels.filter(p=>p.role==='recontextualization');
  assert.equal(recontext.length,2);assert.equal(plan.coverage.actualRoles.challenge,0);
  assert(recontext.every(p=>p.comparisonNovel===undefined&&p.repeatOf===undefined));
});

test('Exercise exposure uses actual presented IDs and recorded groups rather than its offerable catalogue',()=>{
  const input=history(),before=planAdaptivePanels(input);
  input.rounds.push({id:'actual-exhibition',kind:'exercise',works:input.works,presentedIds:['w40','w41','w42','w43'],coPresentedGroups:[['w40','w41']],exposureUnknownWorkIds:['w42','w43'],evidence:{construct:'arrangement',family:'contextual-arrangement'}});
  const plan=planAdaptivePanels(input);
  assert.equal(plan.coverage.exposureBefore.w44,before.coverage.exposureBefore.w44);
  assert.equal(plan.coverage.exposureBefore.w40,before.coverage.exposureBefore.w40+1);
  assert.deepEqual(plan.coverage.exposureUnknownWorkIds,['w42','w43']);
  assert.deepEqual(plan.coverage.exposureUnknownRoundIds,['actual-exhibition']);
  for(const p of plan.panels.filter(p=>p.role==='challenge')){
    assert(p.workIds.every(id=>!['w42','w43'].includes(id)));
    assert.notDeepEqual([...p.workIds].sort(),['w40','w41']);
  }
  assert(plan.panels.some(p=>p.role==='challenge'));
});

test('Unresolved exercise exposure never silently creates a held-out comparison claim',()=>{
  const input=history();input.rounds.push({id:'unresolved-exercise',kind:'exercise',works:input.works});
  const plan=planAdaptivePanels(input);
  assert.equal(plan.coverage.exposureUnknownWorkIds.length,input.works.length);
  assert(plan.panels.every(p=>p.holdoutUnit===undefined));
});

test('Missing works and tiny catalogues return safe results without replacing saved evidence',()=>{
  const input=history();input.rounds[0].works[0]={id:'not-available'};
  const plan=planAdaptivePanels(input);assert(!plan.coverage.eligiblePreferenceRoundIds.includes(input.rounds[0].id));
  assert.equal(planAdaptivePanels({works:[]}).panels.length,0);
  const tiny=planAdaptivePanels({works:artworks(1)});assert.equal(tiny.panels.length,0);assert(tiny.coverage.shortageReason);
  const small=planAdaptivePanels({works:artworks(2)});assert.equal(small.panels.length,18);assert(small.panels.every(p=>new Set(p.workIds).size===2));
});

test('Actual expanded catalogue schedules valid current IDs with complete local assets',()=>{
  const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
  const plan=planAdaptivePanels({works,batchIndex:1,seed:'actual-catalogue'});
  assert.equal(plan.panels.length,18);assert.equal(plan.coverage.actualRoles.exploration,18);
  for(const p of plan.panels)for(const id of p.workIds)assert(works.some(w=>w.id===id));
  assert(plan.coverage.selectedWorkIds.length>=Math.min(works.length,50));
});
