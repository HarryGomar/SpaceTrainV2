import test from 'node:test';
import assert from 'node:assert/strict';
import {AXES,validAnswer,sanitizeDraft} from '../../public/art-atlas/engine.mjs';
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {collectResponseEvidence,buildProfileIntelligence} from '../../public/art-atlas/profile-intelligence.mjs';
import {rankExplanationPatterns} from '../../public/art-atlas/explanation-ranking.mjs';
import {renderTasteQualityProfile} from '../../public/art-atlas/taste-profile-view.mjs';
import {renderProfileIntelligence} from '../../public/art-atlas/profile-intelligence-view.mjs';
import {RECOGNITION_PROTOCOL,captureArtworkExposure} from '../../public/art-atlas/recognition-evidence.mjs';
import {FAMILIARITY_PROTOCOL,sanitizeChoiceGrid,setFamiliarityChoice,validChoiceGrid} from '../../public/art-atlas/discovery-grid.mjs';
import {withContextChange,CONTEXT_CHANGE_PROTOCOL} from '../../public/art-atlas/context-change.mjs';
import {buildContextChangeReadings} from '../../public/art-atlas/context-change-readings.mjs';

const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const works=Array.from({length:12},(_,i)=>({id:'i'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/i'+i+'.jpg',sourceUrl:'https://museum.example/i'+i,sha256:(i+1).toString(16).padStart(64,'0'),note:'A documented note about this work.'}));
const ids=r=>r.works.map(w=>w.id);
function line(values,wrap=withContinuousPreference){const round=wrap({id:'journey-001',kind:'spectrum',criterion:'preference',works:works.slice(0,4),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});return {round,answer:{workIds:ids(round),criterion:'preference',positions:Object.fromEntries(ids(round).map((id,i)=>[id,values[i]])),confirmed:true}};}

test('Absolute levels, every gap, exact ties and compact appeal clusters survive the evidence layer',()=>{
  const high=line([90,91,99,99]),low=line([0,1,9,9]);
  const run=f=>buildProfileIntelligence({works,rounds:[f.round],answers:{[f.round.id]:f.answer}}),a=run(high),b=run(low);
  assert.equal(a.appealSpacing[0].aboveNeutral.length,4);assert.equal(a.appealSpacing[0].belowNeutral.length,0);assert.equal(b.appealSpacing[0].belowNeutral.length,4);
  assert.deepEqual(a.appealSpacing[0].adjacentGaps.map(g=>g.gap),[1,8,0]);assert.deepEqual(a.appealSpacing[0].ties,[{value:99,workIds:['i2','i3']}]);
  assert.equal(a.appealSpacing[0].clusters.length,1);assert.equal(a.responseLedger[0].gapInterpretation,'reported-personal-appeal-difference');
  const ordinal=line([0,1,9,99],withComparisonPreference),old=run(ordinal);assert.equal(old.appealSpacing.length,0);assert.equal(old.responseLedger[0].gapInterpretation,'order-and-exact-ties-only');
});

test('Personal connection and reported attention use their original separate maps; changed axes fail closed',()=>{
  for(const axis of ['connection','attention']){
    const r={id:'map-'+axis,kind:'grid',axis,axisDefinition:structuredClone(AXES[axis]),works:works.slice(0,4),evidence:{construct:axis==='connection'?'connection':'reported-attention'}},a={workIds:ids(r),axis,points:Object.fromEntries(ids(r).map((id,i)=>[id,i?[80,20]:[10,95]])),confirmed:true};
    const result=buildProfileIntelligence({works,rounds:[r],answers:{[r.id]:a}});assert.equal(result.maps.length,4);assert.equal(result.observations.length,1);assert.equal(result.observations[0].status,'provisional');assert.equal(result.categories.find(c=>c.id===axis).status,'provisional');
    const bad=structuredClone(r);bad.axisDefinition.yName='Measured attention';assert.equal(collectResponseEvidence({works,rounds:[bad],answers:{[r.id]:a}}).length,0);
  }
});

test('Every category stays visible, distinguishing unmeasured from tested but unresolved',()=>{
  const empty=buildProfileIntelligence();assert.equal(empty.categories.length,9);assert.ok(empty.categories.every(c=>c.status==='not-explored'));
  const f=line([75,75,75,75]),result=buildProfileIntelligence({works,rounds:[f.round],answers:{[f.round.id]:f.answer}});assert.equal(result.categories.find(c=>c.id==='appeal').status,'open');assert.equal(result.categories.find(c=>c.id==='connection').status,'not-explored');
  const html=renderProfileIntelligence({intelligence:result,esc});assert.match(html,/What captivates you/);assert.match(html,/Not yet explored/);assert.match(html,/A comparison to try/);assert.doesNotMatch(html,/\d+%/);
});

test('An explicit disliked counterexample remains prominent and comparative evidence outranks slight favourite enrichment',()=>{
  const favourite={id:'fav',qualityKey:'layered-space',title:'Layers',text:'Three favourites share layers. Another favourite does not, and a disliked painting shares them.',channel:'explicit-favourites',status:'descriptive',direction:1,summaryEligible:true,attributes:['layered-space'],favouriteWorkIds:['i0','i1','i2'],explicitDislikesWithQuality:['i3'],support:[],counter:[],exposureBaseline:{selectedKnown:4,selectedWithQuality:3,ratedKnown:8,ratedWithQuality:5}},comparative={id:'comparison',qualityKey:'dramatic-light',title:'Light',text:'A recurring comparative distinction.',channel:'personal-appeal',status:'qualified',direction:1,summaryEligible:true,attributes:['dramatic-light'],supportingSetCount:3,eligibleSetCount:3,support:[{roundId:'r1',workIds:['i4','i5'],responseGap:60},{roundId:'r2',workIds:['i6','i7'],responseGap:60},{roundId:'r3',workIds:['i8','i9'],responseGap:60}],counter:[]};
  const ranked=rankExplanationPatterns([favourite,comparative],{favouriteIds:['i0','i1','i2']});assert.equal(ranked[0].id,'comparison');
  const fav=ranked.find(p=>p.id==='fav'),html=renderTasteQualityProfile({profile:{patterns:[fav]},works,image:()=>'<img>',esc});assert.match(html,/Explicitly disliked, same quality/);assert.match(html,/Another favourite does not/);assert.ok(fav.displayWorkIds.includes('i3'));
});

test('Overlapping explanations remain explicit rivals, not additional independent evidence',()=>{
  const base={channel:'personal-appeal',status:'qualified',direction:1,summaryEligible:true,supportingSetCount:3,eligibleSetCount:3,support:[{roundId:'r1',workIds:['i0','i1']},{roundId:'r2',workIds:['i2','i3']},{roundId:'r3',workIds:['i4','i5']}]};
  const ranked=rankExplanationPatterns([{...base,id:'story',qualityKey:'narrative-detail',title:'Story clues'},{...base,id:'space',qualityKey:'layered-space',title:'Layers of space'}]);assert.equal(ranked[0].competingExplanations.length,1);assert.equal(ranked[0].explanationEvidence.distinctSupportingSets,3);
});

test('Recognition certainty is versioned, preserved on resume and never inferred from correctness',()=>{
  const r={id:'match',kind:'match',field:'artist',works:works.slice(0,2),options:[{id:'a',label:'Artist 0'},{id:'b',label:'Artist 1'}],evidence:{instrumentRevision:RECOGNITION_PROTOCOL}},a={workIds:ids(r),field:'artist',guesses:{i0:'a',i1:'b'},certainty:{i0:'guessed',i1:'recognised'},confirmed:true};
  assert.ok(validAnswer(r,a));assert.deepEqual(sanitizeDraft(r,a).certainty,a.certainty);assert.equal(validAnswer(r,{...a,certainty:{i0:'guessed'}}),false);
  const result=buildProfileIntelligence({works,rounds:[r],answers:{match:a}});assert.equal(result.recognition.responses[0].certainty,'guessed');assert.equal(result.recognition.responses[0].labelExposure,'unknown');
  const old={...r,evidence:{}};assert.ok(validAnswer(old,{...a,certainty:undefined}));
});

test('Label feedback is separate from image exposure and historical uncertain feedback stays unknown',()=>{
  const f=line([90,80,70,60]),match={id:'journey-017',kind:'match',field:'artist',works:f.round.works,evidence:{}},target={id:'journey-067',works:f.round.works};
  let result=captureArtworkExposure(target,[f.round,match],{[f.round.id]:f.answer,[match.id]:{confirmed:true}});assert.deepEqual(result.works.i0.imageRoundIds,['journey-001','journey-017']);assert.deepEqual(result.works.i0.labelRoundIds,[]);assert.deepEqual(result.works.i0.unknownLabelRoundIds,['journey-017']);
  result=captureArtworkExposure(target,[match],{[match.id]:{confirmed:true,feedbackSeen:true}});assert.deepEqual(result.works.i0.labelRoundIds,['journey-017']);
});

test('Explicit familiarity records seen, new and uncertain; unchecked historical paintings remain unknown',()=>{
  const r={id:'familiar',kind:'choice-grid',selectionMode:'familiarity',works:works.slice(0,3),evidence:{familiarityProtocol:FAMILIARITY_PROTOCOL}};let a=sanitizeChoiceGrid(r);
  for(const [id,value]of [['i0','seen'],['i1','new'],['i2','unsure']])a=setFamiliarityChoice(r,a,id,value);
  assert.ok(validChoiceGrid(r,{...a,confirmed:true}));assert.deepEqual(a.selectedIds,['i0']);assert.equal(validChoiceGrid(r,{...a,familiarity:{i0:'seen'},confirmed:true}),false);
  const old={...r,evidence:{}},answer={workIds:ids(old),selectionMode:'familiarity',selectedIds:['i0'],explicitNone:false,unsure:false,confirmed:true};
  const result=buildProfileIntelligence({works,rounds:[old],answers:{familiar:answer}});assert.equal(result.recognition.familiarity.length,1);assert.equal(result.recognition.familiarity[0].status,'seen');
});

test('A direct change can be an exception to rarely, without an invented after-rating or an inconsistency claim',()=>{
  const statement={id:'journey-031',kind:'statements',title:'A statement',hint:'',works:[works[0]],statements:[{id:'contextEffect',text:'Learning the story behind a painting rarely changes how much I appreciate it.'}],evidence:{statementTest:'contextEffect',checkId:'context-check',contextRoundId:'journey-035',stimulusVisibility:'not-shown'}},context=withContextChange({id:'journey-035',kind:'context',works:[works[0]],evidence:{checkId:'context-check'}}),answers={[statement.id]:{workIds:ids(statement),claims:{contextEffect:4}},[context.id]:{workIds:ids(context),workId:'i0',contextProtocol:CONTEXT_CHANGE_PROTOCOL,contentId:context.contextNote.id,storySeen:true,reportedChange:100,uncertain:false,confirmed:true}},rounds=[statement,context],reportedContextChanges=buildContextChangeReadings({works,rounds,answers}),result=buildProfileIntelligence({works,rounds,answers,reportedContextChanges});
  assert.equal(result.contextExpectations.links.length,1);assert.match(result.contextExpectations.observations[0].title,/exception/);assert.match(result.contextExpectations.observations[0].text,/does not establish inconsistency/);assert.equal('after' in result.contextExpectations.links[0],false);
  const old=structuredClone(statement);old.statements[0].text='Learning the story behind a painting rarely changes how much I like it.';
  const legacy=buildProfileIntelligence({works,rounds:[old,context],answers,reportedContextChanges});assert.match(legacy.contextExpectations.observations[0].title,/expectation about liking/);assert.match(legacy.contextExpectations.observations[0].text,/do not establish an exception/);
  answers[context.id]={...answers[context.id],reportedChange:undefined,uncertain:true};const uncertain=buildProfileIntelligence({works,rounds,answers,reportedContextChanges:buildContextChangeReadings({works,rounds,answers})});assert.equal(uncertain.contextExpectations.observations.length,0);
});

test('Duplicate IDs and swapped reproductions cannot supply intelligence evidence',()=>{
  const f=line([90,80,70,60]);assert.equal(collectResponseEvidence({works,rounds:[f.round,f.round],answers:{[f.round.id]:f.answer}}).length,0);
  const changed=structuredClone(f.round);changed.works[0].image='assets/a-different-view.jpg';assert.equal(collectResponseEvidence({works,rounds:[changed],answers:{[f.round.id]:f.answer}}).length,0);
});
