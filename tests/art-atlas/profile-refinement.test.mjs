import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {nextProfileRefinement,PROFILE_REFINEMENT_PROTOCOL} from '../../public/art-atlas/profile-refinement.mjs';
import {withContinuousPreference,isContinuousPreferenceRound} from '../../public/art-atlas/continuous-preference.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {createDeepStudy,prepareJourneySession,sessionJourneyRounds,journeyEvidenceRounds,snapshotStudyRound,extendJourneySession} from '../../public/art-atlas/deep-study.mjs';
import CATALOGUE from '../../public/art-atlas/artworks.json' with {type:'json'};

const ids=round=>round.works.map(work=>work.id);
function qualityFixture(){
  const works=Array.from({length:16},(_,i)=>({id:'f'+i,title:'Painting '+i,artist:'Artist '+i,artistKnown:true,image:'assets/f'+i+'.jpg',sourceUrl:'https://museum.example/'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((work,i)=>[work.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:work.sha256},reviewedAsset:{image:work.image,sha256:work.sha256,width:600,height:400,compositionMatch:'same-composition',mediaBinding:'source-matched'},sourceUrls:[work.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(k=>[k,{status:k==='narrative-detail'?(i%4===0||i%4===2?'present':'absent'):k==='layered-space'?(i%4===0||i%4===3?'present':'absent'):'absent',reason:'Synthetic crossing for the test.',evidenceKind:'visual-review'}]))}]))};
  const rounds=Array.from({length:3},(_,i)=>withContinuousPreference({id:'journey-'+String(i+1).padStart(3,'0'),kind:'spectrum',criterion:'preference',works:works.slice(i*4,i*4+4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}));
  const answers=Object.fromEntries(rounds.map(round=>[round.id,{workIds:ids(round),criterion:'preference',positions:Object.fromEntries(round.works.map((work,i)=>[work.id,[95,5,75,70][i]])),confirmed:true}]));
  return {works,rounds,answers,annotationReviews};
}

test('Optional questions use frozen rival predictions, avoid already offered pairs and stop rather than padding',()=>{
  const f=qualityFixture(),original=structuredClone(f),attempts=[];
  for(let i=0;i<2;i++){
    const offer=nextProfileRefinement({...f,attempts});assert.ok(offer);const round=offer.round;
    assert.equal(round.evidence.diagnostic.kind,'quality');assert.notEqual(...round.evidence.diagnostic.predictions);assert.equal(round.evidence.profileRefinement.discoveryVote,false);
    const priorPairs=f.rounds.flatMap(source=>ids(source).flatMap((id,j)=>ids(source).slice(j+1).map(other=>[id,other].sort().join('|'))));assert.ok(!priorPairs.includes(ids(round).sort().join('|')));
    attempts.push(round);f.rounds.push(round);f.answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(ids(round).map(id=>[id,90])),confirmed:true};
  }
  assert.equal(nextProfileRefinement({...f,attempts}),null,'Two unresolved checks of the same rival explanations do not trigger endless repeats');
  assert.deepEqual(f.rounds.slice(0,3),original.rounds);assert.deepEqual(Object.fromEntries(original.rounds.map(r=>[r.id,f.answers[r.id]])),original.answers);
  assert.equal(nextProfileRefinement({...f,attempts:Array(10).fill(attempts[0])}),null);
  assert.equal(nextProfileRefinement({...original,annotationReviews:{}}),null,'An ordinary appeal fallback is not a useful extra question');
});

function completedBase(){
  const data=prepareJourneySession(null,CATALOGUE,100),rounds=sessionJourneyRounds(data);
  for(const round of rounds){data.shown[round.id]=snapshotStudyRound(round);data.answers[round.id]={skipped:true,workIds:ids(round)};}
  for(const round of rounds.filter(isContinuousPreferenceRound).filter(round=>round.evidence.role==='discovery').slice(0,4))data.answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(ids(round).map(id=>[id,60])),confirmed:true};
  const source=rounds.find(round=>round.kind==='grid'&&round.axis==='attention');assert.ok(source);
  data.answers[source.id]={workIds:ids(source),axis:source.axis,points:Object.fromEntries(ids(source).map((id,i)=>[id,i===0?[20,90]:[50,50]])),confirmed:true};
  data.index=49;data.screen='reading';data.startedAt=100;data.finishedAt=200;
  return {data,rounds,source};
}

test('The host offers refinement after50, preserves a stopped draft across restore and uses the extra map in the reading',async()=>{
  const {data}=completedBase(),originalPlan=structuredClone(data.plan),dom=new JSDOM('<main></main>',{url:'http://localhost/',storageQuota:60_000_000});
  const keys=['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  dom.window.matchMedia=()=>({matches:false});for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:dom.window[key]});
  let study;
  try{
    localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));const app=dom.window.document.querySelector('main');
    study=createDeepStudy({app,getWorks:()=>CATALOGUE,image:work=>'<img data-artwork="'+work.id+'">',esc:String,keepButtons:()=>'',navigate:()=>study.render(),showArtwork(){},mode:'journey'});
    app.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control)study.handle(control.dataset.action,control,event);});
    const loaded=()=>{for(const image of app.querySelectorAll('img')){Object.defineProperties(image,{complete:{configurable:true,value:true},naturalWidth:{configurable:true,value:100}});image.dispatchEvent(new dom.window.Event('load'));}};
    await study.restore();study.render();assert.ok(app.querySelector('[data-action=deep-refine]'));assert.equal(study.exportData().profileRefinement,undefined,'Rendering the invitation does not start or extend the quiz');
    app.querySelector('[data-action=deep-refine]').click();loaded();assert.equal(app.querySelector('.deep-question').dataset.deepRound,'profile-refine-01');assert.match(app.querySelector('.journey-chrome').textContent,/Refining/);
    app.querySelector('#response-pad').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));const before=study.exportData(),frozen=structuredClone(before.profileRefinement.plan[0]);
    app.querySelector('[data-action=deep-refine-stop]').click();await study.flush();assert.ok(app.querySelector('.journey-reading'));await study.restore();study.render();assert.match(app.querySelector('[data-action=deep-refine]').textContent,/Continue refining/);
    app.querySelector('[data-action=deep-refine]').click();loaded();assert.deepEqual(study.exportData().profileRefinement.plan[0],frozen);assert.deepEqual(study.exportData().answers['profile-refine-01'].points,before.answers['profile-refine-01'].points);
    const pad=app.querySelector('#response-pad');for(const button of [...app.querySelectorAll('.reference-art')]){button.click();loaded();pad.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));loaded();}
    assert.equal(app.querySelector('[data-action=deep-next]').disabled,false);app.querySelector('[data-action=deep-next]').click();await study.flush();
    const result=study.exportData();assert.ok(app.querySelector('.journey-reading'));assert.equal(result.target,50);assert.deepEqual(result.plannedRounds,originalPlan);assert.equal(result.finishedAt,200);assert.equal(result.profileRefinement.active,false);assert.equal(result.profileRefinement.plan.length,1);assert.equal(result.answers['profile-refine-01'].confirmed,true);
    assert.ok(result.portrait.intelligence.maps.some(row=>row.roundId==='profile-refine-01'),'The extra response reaches the profile analysis');assert.equal(app.querySelector('[data-action=deep-refine]'),null,'No generic question replaces an exhausted useful follow-up');
  }finally{if(study)await study.clear();for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}
});

test('Continuing to100 preserves the extra record in its real position between the first and second blocks',()=>{
  const {data,rounds}=completedBase(),offer=nextProfileRefinement({works:CATALOGUE,rounds,answers:data.answers});assert.ok(offer);const extra=offer.round;
  data.profileRefinement={protocol:PROFILE_REFINEMENT_PROTOCOL,baseTarget:50,plan:[snapshotStudyRound(extra)],active:true};data.shown[extra.id]=snapshotStudyRound(extra);data.answers[extra.id]={workIds:ids(extra),axis:extra.axis,points:Object.fromEntries(ids(extra).map(id=>[id,[50,50]])),confirmed:true};
  const firstPlan=structuredClone(data.plan),extended=extendJourneySession(data,CATALOGUE,300),history=journeyEvidenceRounds(extended);
  assert.equal(extended.plan.length,100);assert.equal(extended.index,50);assert.equal(extended.profileRefinement.active,false);assert.deepEqual(extended.plan.slice(0,50),firstPlan);assert.equal(history[49].id,'journey-050');assert.equal(history[50].id,extra.id);assert.equal(history[51].id,'journey-051');assert.deepEqual(extended.answers[extra.id],data.answers[extra.id]);
});
