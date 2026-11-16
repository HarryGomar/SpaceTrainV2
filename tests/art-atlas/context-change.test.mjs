import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {buildSymbolismRound,symbolismResult} from '../../public/art-atlas/symbolism-rounds.mjs';
import {withContextChange,validContextChangeDefinition,validContextChangeAnswer,sanitizeContextChangeDraft,reduceContextChangeDraft,bindContextChangeRound,CONTEXT_CHANGE_PROTOCOL,CONTEXT_CHANGE_PROMPT} from '../../public/art-atlas/context-change.mjs';
import {validAnswer,sanitizeDraft} from '../../public/art-atlas/engine.mjs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import {APPEAL_PROTOCOL} from '../../public/art-atlas/appeal-scale.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound,restoreStudyRound,createDeepStudy} from '../../public/art-atlas/deep-study.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),ids=round=>round.works.map(work=>work.id);
function fixture(){
  const old=buildSymbolismRound({id:'journey-035',works,contentId:'hope-last-string'}),round=withContextChange(old),source=withContinuousPreference({id:'journey-018',kind:'spectrum',criterion:'preference',works:[round.works[0],...works.filter(work=>work.id!==round.works[0].id).slice(0,3)],evidence:{construct:'preference',family:'individual-choice',role:'discovery',panelNumber:8}}),answer={workIds:ids(source),criterion:'preference',positions:Object.fromEntries(source.works.map((work,i)=>[work.id,[100,50,25,75][i]])),confirmed:true};
  return {old,round,source,answer};
}
function response(round,value=100){let draft=sanitizeContextChangeDraft(round);draft=reduceContextChangeDraft(round,draft,{type:'reveal'});draft=reduceContextChangeDraft(round,draft,{type:'change',value});return reduceContextChangeDraft(round,draft,{type:'confirm'});}

test('Fresh direct-change questions retain the exact three sourced notes and prospective statement link',()=>{
  const current=buildJourneyRounds(works),old=buildJourneyRounds(works,{}, {preferenceProtocol:APPEAL_PROTOCOL}),notes=current.filter(round=>round.contextProtocol===CONTEXT_CHANGE_PROTOCOL);assert.deepEqual(notes.map(round=>round.id),['journey-025','journey-035','journey-040']);
  for(const round of notes){assert.equal(validContextChangeDefinition(round),true);const historical=old.find(source=>source.id===round.id);assert.deepEqual(round.contextNote,historical.contextNote);assert.equal(historical.contextMode,'preference-before-after-v1');assert.equal(round.symbolismProtocol,undefined);assert.equal(round.bankRoundId,undefined);}
  const claimed=notes.find(round=>round.evidence.claimRoundId);assert.equal(claimed.evidence.claimRoundId,current[30].id);assert.equal(current[30].evidence.contextRoundId,claimed.id);assert.equal(current[30].evidence.checkId,claimed.evidence.checkId);
});

test('An earlier appeal of100 can be followed by directly reported Much more without an after-score',()=>{
  const f=fixture(),round=bindContextChangeRound({round:f.round,rounds:[f.source],answers:{[f.source.id]:f.answer}}),answer=response(round,100);assert.equal(round.evidence.priorAppeal.value,100);assert.equal(answer.reportedChange,100);assert.equal(answer.storySeen,true);assert.equal(answer.confirmed,true);assert.equal(validAnswer(round,answer),true);assert.equal(answer.before,undefined);assert.equal(answer.after,undefined);assert.deepEqual(round.contextNote,f.old.contextNote);assert.equal(round.evidence.priorAppeal.sourceAnswer.positions[round.works[0].id],100);
});

test('Reveal precedes the change response; missing, unfinished and contradictory answers fail closed',()=>{
  const {round}=fixture(),base=sanitizeDraft(round,{}),tooEarly=reduceContextChangeDraft(round,base,{type:'change',value:100});assert.equal(tooEarly.reportedChange,undefined);assert.equal(validAnswer(round,{...tooEarly,confirmed:true}),false);const valid=response(round);
  for(const mutate of [answer=>answer.storySeen=false,answer=>answer.confirmed=false,answer=>delete answer.reportedChange,answer=>answer.reportedChange=80,answer=>answer.contentId='different-note',answer=>answer.workId='different-work',answer=>answer.workIds.reverse().push('extra'),answer=>answer.before=100,answer=>answer.after=100,answer=>answer.contextProtocol='unknown']){const changed=structuredClone(valid);mutate(changed);assert.equal(validContextChangeAnswer(round,changed),false);assert.equal(validAnswer(round,changed),false);}
});

test('Uncertainty is separate from neutral, and every direct response remains available without an earlier baseline',()=>{
  const {round}=fixture();assert.equal(round.evidence.priorAppeal,undefined);for(const value of [0,25,50,75,100])assert.ok(validAnswer(round,response(round,value)));
  let draft=reduceContextChangeDraft(round,response(round,50),{type:'unsure'});assert.equal(draft.reportedChange,undefined);assert.equal(draft.uncertain,true);draft=reduceContextChangeDraft(round,draft,{type:'confirm'});assert.ok(validAnswer(round,draft));assert.equal(validAnswer(round,{...draft,reportedChange:50}),false);
});

test('Optional prior appeal uses only a real earlier exact-source continuous answer and stays frozen',()=>{
  const f=fixture(),bind=(sources,answers)=>bindContextChangeRound({round:f.round,rounds:sources,answers}),bound=bind([f.source],{[f.source.id]:f.answer});assert.equal(bound.evidence.priorAppeal.roundId,f.source.id);
  const changed=structuredClone(f.source);changed.works[0].image='assets/different.jpg';assert.equal(bind([changed],{[changed.id]:f.answer}).evidence.priorAppeal,undefined);assert.equal(bind([f.source],{[f.source.id]:{...f.answer,confirmed:false}}).evidence.priorAppeal,undefined);const future={...f.source,id:'journey-099'};assert.equal(bind([future],{[future.id]:f.answer}).evidence.priorAppeal,undefined);
  const replacement=structuredClone(f.answer);replacement.positions[f.round.works[0].id]=0;assert.deepEqual(bindContextChangeRound({round:bound,rounds:[f.source],answers:{[f.source.id]:replacement}}),bound);
});

test('Old5-to5 remains unchanged and cannot be sanitized into a positive direct change',()=>{
  const {old,round}=fixture(),answer={workIds:ids(old),workId:old.works[0].id,before:100,after:100,storySeen:true};assert.equal(validAnswer(old,answer),true);assert.equal(symbolismResult(old,answer).direction,'unchanged');assert.equal(validAnswer(round,{...answer,confirmed:true}),false);const draft=sanitizeDraft(round,answer);assert.equal(draft.storySeen,false);assert.equal(draft.reportedChange,undefined);assert.equal(draft.contextProtocol,CONTEXT_CHANGE_PROTOCOL);assert.equal(validAnswer({id:'old-interest',kind:'context',works:old.works},{workId:old.works[0].id,change:'more'}),true);
});

test('Typed context definitions preserve their note through serialization and reject unknown modes or changed sources',()=>{
  const {round}=fixture(),snapshot=snapshotStudyRound(round),restored=restoreStudyRound(JSON.parse(JSON.stringify(snapshot)),works);assert.deepEqual(snapshotStudyRound(restored),snapshot);assert.equal(validContextChangeDefinition(restored),true);
  for(const mutate of [r=>r.contextProtocol='unknown',r=>{delete r.contextProtocol;delete r.contextMode;},r=>r.contextNote.workId='different',r=>r.contextNote.sourceUrls=['https://wrong.invalid/'],r=>r.contextChangeOptions[2].label='Neither liked nor disliked']){const changed=structuredClone(round);mutate(changed);assert.equal(validContextChangeDefinition(changed),false);assert.equal(restoreStudyRound(snapshotStudyRound(changed),works),null);}
});

test('The actual host shows painting then note then direct circles, and saves a confirmed ceiling-safe response',async()=>{
  const dom=new JSDOM('<main></main>',{url:'http://localhost/',storageQuota:30_000_000}),keys=['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));dom.window.matchMedia=()=>({matches:false});for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:dom.window[key]});
  let study;
  try{
    const data=prepareJourneySession(null,works,100),rounds=sessionJourneyRounds(data),target=rounds[34],source=rounds.slice(0,34).find(round=>round.kind==='spectrum'&&round.evidence.construct==='preference'&&round.works.some(work=>work.id===target.works[0].id));assert.ok(source);data.shown[source.id]=snapshotStudyRound(source);data.answers[source.id]={workIds:ids(source),criterion:'preference',positions:Object.fromEntries(source.works.map(work=>[work.id,100])),confirmed:true};data.index=34;data.screen='question';data.startedAt=100;localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));
    const app=dom.window.document.querySelector('main');study=createDeepStudy({app,getWorks:()=>works,image:work=>'<img data-artwork="'+work.id+'">',esc:String,keepButtons:()=>'',navigate(){},showArtwork(){},mode:'journey'});await study.restore();study.render();const loaded=()=>{for(const image of app.querySelectorAll('img')){Object.defineProperties(image,{complete:{configurable:true,value:true},naturalWidth:{configurable:true,value:100}});image.dispatchEvent(new dom.window.Event('load'));}};loaded();
    assert.equal(app.querySelector('.story-note'),null);assert.equal(app.querySelectorAll('[data-action=deep-context-change]').length,0);assert.equal(app.querySelector('[data-action=deep-next]').textContent,'Reveal note');study.handle('deep-next');loaded();assert.equal(app.querySelector('#question-title').textContent,CONTEXT_CHANGE_PROMPT);assert.equal(app.querySelector('.story-note').textContent,target.contextNote.text);assert.deepEqual([...app.querySelectorAll('.liking-circles button')].map(button=>button.textContent),['Much less','A little less','No change','A little more','Much more']);assert.equal(app.querySelectorAll('[data-action=deep-liking]').length,0);assert.equal(app.querySelector('[data-action=deep-next]').disabled,true);
    const muchMore=app.querySelector('[data-action=deep-context-change][data-value="100"]');study.handle('deep-context-change',muchMore);assert.equal(app.querySelector('[data-action=deep-next]').disabled,false);study.handle('deep-next');await study.flush();const exported=study.exportData(),answer=exported.answers[target.id],shown=restoreStudyRound(exported.rounds.find(snapshot=>snapshot.id===target.id),exported.manifest.catalogue);assert.equal(answer.reportedChange,100);assert.equal(answer.confirmed,true);assert.equal(shown.evidence.priorAppeal.value,100);assert.ok(validAnswer(shown,answer));const reading=exported.portrait.reportedContextChanges.responses.find(item=>item.roundId===target.id);assert.equal(reading.priorAppeal.value,100);assert.equal(reading.direction,1);assert.equal(reading.strength,2);assert.equal('after' in reading,false);
  }finally{if(study)await study.clear();for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}
});
