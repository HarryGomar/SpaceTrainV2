import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {nextProfileRefinement,PROFILE_REFINEMENT_PROTOCOL} from '../../public/art-atlas/profile-refinement.mjs';
import {withContinuousPreference,isContinuousPreferenceRound} from '../../public/art-atlas/continuous-preference.mjs';
import {selectAppealInvestigation} from '../../public/art-atlas/appeal-investigations.mjs';
import {buildTastePatterns} from '../../public/art-atlas/taste-patterns.mjs';
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
  const f=qualityFixture(),original=structuredClone(f);
  const offer=nextProfileRefinement(f);assert.ok(offer);const round=offer.round,check=round.evidence.appealInvestigation;
  assert.equal(check.scope,'local');
  assert.notEqual(...check.alternatives.map(item=>item.predictedWorkId));
  assert.equal(check.frozenBeforeAnswer,true);
  assert.equal(round.evidence.profileRefinement.discoveryVote,false);
  const alreadyRated=new Set(f.rounds.flatMap(ids));
  assert.ok(ids(round).some(id=>!alreadyRated.has(id)));
  const attempts=[round];f.rounds.push(round);f.answers[round.id]={workIds:ids(round),criterion:'preference',positions:Object.fromEntries(ids(round).map(id=>[id,90])),confirmed:true};
  assert.equal(nextProfileRefinement({...f,attempts}),null,'No additional well-matched pair with an unrated work remains');
  assert.deepEqual(f.rounds.slice(0,3),original.rounds);assert.deepEqual(Object.fromEntries(original.rounds.map(r=>[r.id,f.answers[r.id]])),original.answers);
  assert.equal(nextProfileRefinement({...f,attempts:Array(10).fill(attempts[0])}),null);
  assert.equal(nextProfileRefinement({...original,annotationReviews:{}}),null,'An ordinary appeal fallback is not a useful extra question');
});

test('The reader changes a qualified explanation after seeing a preassigned transfer pair',()=>{
  const f=qualityFixture();
  const before=buildTastePatterns(f),offer=selectAppealInvestigation({...f,id:'journey-018',mode:'transfer'});
  assert.ok(offer);
  const round=offer.round,[preferred,opposed]=round.evidence.appealInvestigation.alternatives;
  const original=before.patterns.find(item=>item.channel==='personal-appeal'&&item.qualityKey===opposed.quality);
  assert.equal(original.summaryEligible,true);
  const answer={workIds:ids(round),criterion:'preference',positions:{[preferred.predictedWorkId]:93,[opposed.predictedWorkId]:10},confirmed:true};
  const after=buildTastePatterns({...f,rounds:[...f.rounds,round],answers:{...f.answers,[round.id]:answer}});
  assert.equal(after.investigations[0].independentOfTraining,true);
  const changed=after.patterns.find(item=>item.id===original.id);
  assert.equal(changed.investigation.status,'challenged');
  assert.equal(changed.summaryEligible,false);
  assert.ok(!after.readingSummary?.principalPatternIds.includes(original.id));
  assert.equal(after.coverage.continuousSets,before.coverage.continuousSets);
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

test('The host offers refinement before the profile and continues across useful extra rounds',async()=>{
  const {data,rounds}=completedBase(),originalPlan=structuredClone(data.plan),dom=new JSDOM('<main></main>',{url:'http://localhost/',storageQuota:60_000_000});
  const returnMap=rounds.find(round=>round.kind==='grid'&&round.axis==='returnResponse');
  data.answers[returnMap.id]={workIds:ids(returnMap),axis:returnMap.axis,points:Object.fromEntries(ids(returnMap).map((id,i)=>[id,i===0?[80,90]:[50,50]])),confirmed:true};
  const last=data.plan.at(-1).id;
  delete data.answers[last];
  delete data.shown[last];
  data.screen='question';
  data.finishedAt=null;
  const keys=['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame'],previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  dom.window.matchMedia=()=>({matches:false});for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='requestAnimationFrame'?()=>0:key==='cancelAnimationFrame'?()=>{}:dom.window[key]});
  let study;
  try{
    localStorage.setItem('art-profile-journey-v1',JSON.stringify(data));const app=dom.window.document.querySelector('main');
    study=createDeepStudy({app,getWorks:()=>CATALOGUE,image:work=>'<img data-artwork="'+work.id+'">',esc:String,keepButtons:()=>'',navigate:()=>study.render(),showArtwork(){},mode:'journey'});
    app.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control)study.handle(control.dataset.action,control,event);});
    const loaded=()=>{for(const image of app.querySelectorAll('img')){Object.defineProperties(image,{complete:{configurable:true,value:true},naturalWidth:{configurable:true,value:100}});image.dispatchEvent(new dom.window.Event('load'));}};
    const click=action=>app.querySelector('[data-action='+action+']').click();
    const place=()=>app.querySelector('#response-pad').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    function submitMap(){
      for(const button of app.querySelectorAll('.reference-art')){button.click();loaded();place();loaded();}
      assert.equal(app.querySelector('[data-action=deep-next]').disabled,false);
      click('deep-next');
    }
    await study.restore();study.render();
    assert.equal(app.querySelector('.deep-question').dataset.deepRound,last);
    click('deep-skip');
    assert.ok(app.querySelector('[data-action=deep-refine]'));
    assert.equal(app.querySelector('.journey-reading'),null);
    const completed=study.exportData();
    assert.equal(completed.profileRefinement,undefined,'Seeing the choice consumes no optional rounds');
    await study.flush();await study.restore();study.render();
    click('deep-reveal-profile');
    assert.ok(app.querySelector('.journey-reading'));
    assert.equal(study.exportData().profileRefinement,undefined);

    click('deep-refinement-options');click('deep-refine');loaded();
    assert.equal(app.querySelector('.deep-question').dataset.deepRound,'profile-refine-01');
    place();
    const before=study.exportData(),frozen=structuredClone(before.profileRefinement.plan[0]);
    click('deep-save');await study.flush();await study.restore();study.render();
    assert.match(app.querySelector('[data-action=deep-refine]').textContent,/Resume/);
    click('deep-refine');loaded();
    const resumed=study.exportData();
    assert.deepEqual(resumed.profileRefinement.plan[0],frozen);
    assert.deepEqual(resumed.answers['profile-refine-01'].points,before.answers['profile-refine-01'].points);

    submitMap();
    assert.equal(app.querySelector('.deep-question').dataset.deepRound,'profile-refine-02');
    assert.equal(app.querySelector('.journey-reading'),null,'Continue leads directly to the next question');
    assert.ok(app.querySelector('[data-action=deep-refine-stop]'),'View profile remains available during the extra rounds');
    loaded();submitMap();
    assert.equal(app.querySelector('.journey-reading'),null,'Completing the extras allows an explicit reveal');
    assert.equal(app.querySelector('[data-action=deep-refine]'),null,'No generic question replaces an exhausted useful follow-up');
    await study.flush();await study.restore();study.render();
    click('deep-reveal-profile');
    const result=study.exportData();
    assert.ok(app.querySelector('.journey-reading'));
    assert.equal(result.target,50);
    assert.deepEqual(result.plannedRounds,originalPlan);
    assert.equal(result.finishedAt,completed.finishedAt);
    assert.equal(result.profileRefinement.active,false);
    assert.equal(result.profileRefinement.plan.length,2);
    for(const id of ['profile-refine-01','profile-refine-02'])assert.equal(result.answers[id].confirmed,true);
    assert.ok(result.portrait.intelligence.maps.some(row=>row.roundId==='profile-refine-01'));
    assert.ok(result.portrait.reportedGridMaps.some(row=>row.roundId==='profile-refine-02'));
  }finally{if(study)await study.clear();for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}
});

test('Continuing to100 preserves the extra record in its real position between the first and second blocks',()=>{
  const {data,rounds}=completedBase(),offer=nextProfileRefinement({works:CATALOGUE,rounds,answers:data.answers});assert.ok(offer);const extra=offer.round;
  data.profileRefinement={protocol:PROFILE_REFINEMENT_PROTOCOL,baseTarget:50,plan:[snapshotStudyRound(extra)],active:true};data.shown[extra.id]=snapshotStudyRound(extra);data.answers[extra.id]={workIds:ids(extra),axis:extra.axis,points:Object.fromEntries(ids(extra).map(id=>[id,[50,50]])),confirmed:true};
  const firstPlan=structuredClone(data.plan),extended=extendJourneySession(data,CATALOGUE,300),history=journeyEvidenceRounds(extended);
  assert.equal(extended.plan.length,100);assert.equal(extended.index,50);assert.equal(extended.profileRefinement.active,false);assert.deepEqual(extended.plan.slice(0,50),firstPlan);assert.equal(history[49].id,'journey-050');assert.equal(history[50].id,extra.id);assert.equal(history[51].id,'journey-051');assert.deepEqual(extended.answers[extra.id],data.answers[extra.id]);
});
