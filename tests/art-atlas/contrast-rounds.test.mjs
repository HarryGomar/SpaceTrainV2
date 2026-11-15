import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContrastRound, validContrastDefinition, validContrastAnswer, sanitizeContrastDraft, handleContrastAction, moveChronology, chronologyFeedback, contrastAnswerSummary, renderContrastRound, createContrastController} from '../../public/art-atlas/contrast-rounds.mjs';
import {buildContrastReadings} from '../../public/art-atlas/contrast-readings.mjs';

const works = Array.from({length:10}, (_,index) => ({id:String.fromCharCode(97+index),title:'Painting '+String.fromCharCode(65+index),image:'images/'+index+'.jpg',sourceUrl:'https://museum.example/objects/'+index,artist:'Artist '+index,features:{complexity:index%2 ? .9 : .1,color:.5,abstraction:.5,energy:.5}}));
const selected = ids => ids.map(id => works.find(work => work.id === id));
function content(kind, workIds, extra = {}) {
  return {status:'ready',kind:'contrast',contrastKind:kind,contentId:'content-'+kind,title:'A plain question',prompt:'The exact task brief',hint:'A short instruction',workIds,sourceUrls:workIds.map(id => works.find(work => work.id === id).sourceUrl),curationNotes:['Reviewed source records.'],residualConfounds:['Date, artist, colour and reproduction can differ.'],...extra};
}
const keep = (id='keep') => buildContrastRound({works,id,content:content('keep-leave',['a','b','c','d','e','f'])});
const neighbour = () => buildContrastRound({works,id:'neighbour',content:content('neighbour',['a','b','c','d'],{anchorId:'i',relationshipOptions:[{id:'colour',label:'Colour'},{id:'form',label:'Shapes'}]})});
const dates = {a:{yearRange:[1000,1010],sourceUrl:works[0].sourceUrl,displayDate:'c. 1000–10'},b:{yearRange:[1500,1500],sourceUrl:works[1].sourceUrl},c:{yearRange:[1600,1610],sourceUrl:works[2].sourceUrl},d:{yearRange:[1900,1900],sourceUrl:works[3].sourceUrl}};
const chronology = () => buildContrastRound({works,id:'dates',content:content('chronology',['d','b','a','c'],{dateEvidence:dates})});
const subject = (id, workIds) => buildContrastRound({works,id,content:content('same-subject',workIds,{subject:{id:'subject-'+id,label:'Two mountain landscapes',description:'Different mountains.',reviewed:true}})});
const answer = (round, fields) => ({...sanitizeContrastDraft(round),...fields,confirmed:true});
const preference = (id, workIds) => ({id,kind:'spectrum',criterion:'preference',title:'How much do you prefer each painting?',hint:'Space them freely.',works:selected(workIds),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
const prefAnswer = (round, positions) => ({workIds:round.works.map(work => work.id),criterion:'preference',positions,confirmed:true});

test('definition binding requires exact known source-linked identities and keeps snapshots', () => {
  const source = content('keep-leave',['a','b','c','d','e','f']), round = buildContrastRound({works,id:'frozen',content:source});
  assert.ok(validContrastDefinition(round));
  source.workIds[0] = 'missing'; source.curationNotes[0] = 'Edited';
  assert.equal(round.works[0].id,'a'); assert.equal(round.curationNotes[0],'Reviewed source records.');
  assert.equal(buildContrastRound({works,id:'bad',content:source}),null);
  assert.equal(buildContrastRound({works:[...works,works[0]],id:'bad',content:content('keep-leave',['a','b','c','d','e','f'])}),null);
  assert.equal(buildContrastRound({works,id:'bad',content:content('keep-leave',['a','b','c','d','e','e'])}),null);
});

test('keep/leave records only two distinct decisions, leaving four unranked', () => {
  const round = keep();
  let draft = sanitizeContrastDraft(round);
  draft = handleContrastAction(round,draft,'contrast-pick',{workId:'a'});
  assert.equal(draft.selectionPhase,'leave');
  draft = handleContrastAction(round,draft,'contrast-pick',{workId:'b'});
  assert.ok(validContrastAnswer(round,{...draft,confirmed:true}));
  const summary = contrastAnswerSummary(round,{...draft,confirmed:true});
  assert.deepEqual(summary.unrankedIds,['c','d','e','f']);
  assert.equal('positions' in summary,false);
  assert.equal(validContrastAnswer(round,answer(round,{keepId:'a',leaveId:'a'})),false);
  assert.equal(validContrastAnswer(round,{...draft,confirmed:false}),false);
  assert.equal(validContrastAnswer(round,{...draft,confirmed:true,workIds:[...draft.workIds].reverse()}),false);
});

test('changing a role clears its conflicting selection and never silently swaps choices', () => {
  const round = keep(), previous = answer(round,{keepId:'a',leaveId:'b',selectionPhase:'keep'});
  const next = handleContrastAction(round,previous,'contrast-pick',{workId:'b'});
  assert.equal(next.keepId,'b'); assert.equal(next.leaveId,null); assert.equal(next.confirmed,false);
  assert.equal(validContrastAnswer(round,{...next,confirmed:true}),false);
});

test('incompatible saved identities and instruments do not supply preselected responses', () => {
  const round = keep(), response = answer(round,{keepId:'a',leaveId:'b'});
  assert.equal(sanitizeContrastDraft(round,{...response,contrastKind:'same-subject'}).keepId,null);
  assert.equal(sanitizeContrastDraft(round,{...response,workIds:[...response.workIds].reverse()}).keepId,null);
  assert.equal(sanitizeContrastDraft(round,null).keepId,null);
});

test('neighbour anchor is fixed and excluded from candidate answers', () => {
  const round = neighbour();
  assert.equal(round.anchorWorks[0].id,'i');
  assert.deepEqual(sanitizeContrastDraft(round).workIds,['a','b','c','d']);
  assert.ok(validContrastAnswer(round,answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'form'})));
  assert.equal(validContrastAnswer(round,answer(round,{neighbourId:'a',noGoodNeighbour:false})),false);
  assert.equal(validContrastAnswer(round,answer(round,{neighbourId:'i',noGoodNeighbour:false})),false);
  assert.equal(validContrastAnswer(round,answer(round,{neighbourId:'a',noGoodNeighbour:true})),false);
  assert.ok(validContrastAnswer(round,answer(round,{neighbourId:null,noGoodNeighbour:true})));
  assert.equal(validContrastAnswer(round,answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'invented'})),false);
});

test('no-good-neighbour clears a prior choice and its reported connection', () => {
  const round = neighbour(), next = handleContrastAction(round,answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'colour'}),'contrast-none');
  assert.equal(next.neighbourId,null); assert.equal(next.noGoodNeighbour,true); assert.equal(next.relationshipId,null);
  const changed = handleContrastAction(round,answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'colour'}),'contrast-pick',{workId:'b'});
  assert.equal(changed.neighbourId,'b'); assert.equal(changed.relationshipId,null);
  assert.equal(validContrastAnswer(round,{...changed,confirmed:true}),false);
});

test('subject comparison requires a reviewed match and preserves an explicit no preference', () => {
  const round = subject('mountains',['a','b']);
  assert.ok(validContrastAnswer(round,answer(round,{preferredId:'a',noPreference:false})));
  assert.ok(validContrastAnswer(round,answer(round,{preferredId:null,noPreference:true})));
  assert.equal(validContrastAnswer(round,answer(round,{preferredId:'a',noPreference:true})),false);
  const unreviewed = structuredClone(round); unreviewed.subject.reviewed = false;
  assert.equal(validContrastDefinition(unreviewed),false);
  assert.equal(validContrastAnswer(unreviewed,answer(unreviewed,{preferredId:'a',noPreference:false})),false);
});

test('chronology requires an explicit reviewed permutation and rejects invented placements', () => {
  const round = chronology(), initial = sanitizeContrastDraft(round);
  assert.equal(validContrastAnswer(round,{...initial,confirmed:true}),false);
  const ordered = answer(round,{orderedIds:['a','b','c','d'],uncertainIds:[],orderReviewed:true});
  assert.ok(validContrastAnswer(round,ordered));
  assert.equal(validContrastAnswer(round,{...ordered,orderedIds:['a','a','c','d']}),false);
  assert.equal(validContrastAnswer(round,{...ordered,uncertainIds:['missing']}),false);
  assert.equal(validContrastAnswer(round,{...ordered,uncertainIds:['a','a']}),false);
  assert.equal(buildContrastRound({works,id:'undated',content:content('chronology',['a','b','c','d'],{dateEvidence:{...dates,d:{yearRange:[1900,null],sourceUrl:works[3].sourceUrl}}})}),null);
});

test('chronology movement has the same insertion result for arrows and drag targets', () => {
  assert.deepEqual(moveChronology(['a','b','c','d'],'a',2),['b','c','a','d']);
  const round = chronology(), next = handleContrastAction(round,sanitizeContrastDraft(round),'contrast-move',{workId:'a',targetIndex:0});
  assert.deepEqual(next.orderedIds,['a','d','b','c']);
  assert.equal(next.orderReviewed,true); assert.equal(next.activeId,'a');
  const later = handleContrastAction(round,next,'contrast-move',{workId:'a',direction:'later'});
  assert.deepEqual(later.orderedIds,['d','a','b','c']);
  assert.deepEqual(moveChronology(later.orderedIds,'missing',0),later.orderedIds);
});

test('chronology intervals, touching bounds and stated uncertainty never become fake wrong answers', () => {
  const round = chronology();
  const full = answer(round,{orderedIds:['a','b','c','d'],uncertainIds:[],orderReviewed:true});
  assert.equal(chronologyFeedback(round,full).correct,6);
  const overlapping = structuredClone(round); overlapping.dateEvidence.b.yearRange = [1010,1605];
  const result = chronologyFeedback(overlapping,{...full,orderedIds:['b','a','c','d']});
  assert.equal(result.overlap,2); assert.equal(result.reversed,0);
  const uncertain = chronologyFeedback(round,{...full,orderedIds:['d','c','b','a'],uncertainIds:['a','b','c','d']});
  assert.equal(uncertain.assessed,0); assert.equal(uncertain.uncertain,6); assert.equal(uncertain.reversed,0);
});

test('dates and source labels appear only after chronology confirmation', () => {
  const round = chronology(), image = work => `<img data-artwork="${work.id}" src="${work.image}">`;
  const before = renderContrastRound(round,{}, {image});
  assert.equal(before.includes('c. 1000–10'),false);
  const after = renderContrastRound(round,answer(round,{orderedIds:['a','b','c','d'],uncertainIds:[],orderReviewed:true}),{image});
  assert.equal(after.includes('c. 1000–10'),true);
  assert.equal(after.includes('Your order matches the recorded dates.'),true);
  assert.equal(after.includes('data-action="contrast-change"'),true);
});

test('editing a confirmed chronology invalidates its confirmation', () => {
  const round = chronology(), old = answer(round,{orderedIds:['a','b','c','d'],uncertainIds:[],orderReviewed:true});
  const next = handleContrastAction(round,old,'contrast-move',{workId:'a',direction:'later'});
  assert.equal(next.confirmed,false);
  assert.equal(chronologyFeedback(round,next),null);
});

function fakeApp(round, images) {
  const root = {dataset:{},querySelector:() => null,querySelectorAll:selector => selector === '.contrast-picture img,.contrast-anchor-picture img' ? images : [],addEventListener(){},removeEventListener(){}};
  return {querySelector:() => root};
}
test('controller blocks new confirmation for failed, pending, missing and misidentified images', () => {
  const round = keep(), initial = answer(round,{keepId:'a',leaveId:'b'}), images = round.works.map(work => ({dataset:{artwork:work.id},complete:true,naturalWidth:100}));
  let saved;
  const controller = createContrastController({app:fakeApp(round,images),round,draft:initial,saveDraft:value => { saved=value; }});
  assert.ok(controller.confirm()); assert.equal(saved.confirmed,true);
  images[0].naturalWidth=0; assert.equal(controller.confirm(),null);
  images[0].naturalWidth=100; images[0].complete=false; assert.equal(controller.confirm(),null);
  images[0].complete=true; images[0].dataset.artwork='wrong'; assert.equal(controller.confirm(),null);
  images[0].dataset.artwork='a'; images.pop(); assert.equal(controller.confirm(),null);
  controller.dispose();
});

test('keep/leave reading links an actual earlier pair and never rates the other four', () => {
  const pref = preference('before',['a','b','g']), round = keep();
  const findings = buildContrastReadings({works,rounds:[pref,round],answers:{before:prefAnswer(pref,{a:20,b:80,g:50}),keep:answer(round,{keepId:'a',leaveId:'b'})}});
  assert.equal(findings.length,1); assert.equal(findings[0].id,'contrast-keep-leave');
  assert.deepEqual(findings[0].support.map(item => item.roundId),['before','keep']);
  assert.equal(findings[0].comparisons[0].kind,'categorical-contrast');
  assert.equal('measures' in findings[0].comparisons[0],false);
  assert.ok(findings[0].support[1].detail.includes('other four were not ranked'));
});

test('contextual scales, partial sources, future sources and duplicate IDs cannot supply prior taste', () => {
  const pref = preference('before',['a','b']), round = keep(), complete = {before:prefAnswer(pref,{a:20,b:80}),keep:answer(round,{keepId:'a',leaveId:'b'})};
  const contextual = {...pref,evidence:{construct:'contextual-choice',family:'contextual-choice'}};
  assert.deepEqual(buildContrastReadings({works,rounds:[contextual,round],answers:complete}),[]);
  assert.deepEqual(buildContrastReadings({works,rounds:[pref,round],answers:{...complete,before:{...complete.before,positions:{a:20}}}}),[]);
  assert.deepEqual(buildContrastReadings({works,rounds:[round,pref],answers:complete}),[]);
  assert.deepEqual(buildContrastReadings({works,rounds:[pref,{...pref},round],answers:complete}),[]);
  assert.deepEqual(buildContrastReadings({works:[...works,works[0]],rounds:[pref,round],answers:complete}),[]);
});

test('returning to the same six-work set cannot inflate support or erase an opposing choice', () => {
  const pref = preference('before',['a','b']), first = keep('one'), second = keep('two'), third = keep('three');
  const answers = {before:prefAnswer(pref,{a:20,b:80}),one:answer(first,{keepId:'a',leaveId:'b'}),two:answer(second,{keepId:'a',leaveId:'b'}),three:answer(third,{keepId:'b',leaveId:'a'})};
  const result = buildContrastReadings({works,rounds:[pref,first,second,third],answers})[0];
  assert.equal(result.supportingSetCount,1); assert.equal(result.counterSetCount,1);
  assert.ok(result.counter.some(item => item.roundId === 'three'));
  assert.equal(result.comparisons[0].notes.a[0].text,'Earlier preference: 20 / 100');
  assert.ok(result.comparisons[0].notes.a.every(note => /^[a-z-]+$/.test(note.role)));
});

test('neighbour reading retains the fixed painting, exact brief and reported connection', () => {
  const pref = preference('before',['a','b']), round = neighbour();
  const findings = buildContrastReadings({works,rounds:[pref,round],answers:{before:prefAnswer(pref,{a:25,b:80}),neighbour:answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'form'})}});
  assert.equal(findings.length,1); assert.equal(findings[0].id,'contrast-neighbour');
  assert.ok(findings[0].support[1].workIds.includes('i'));
  assert.equal(findings[0].support[1].prompt,'The exact task brief');
  assert.ok(findings[0].support[1].detail.includes('Reported connection: Shapes'));
  assert.ok(findings[0].alternatives.some(value => value.includes('not a dislike')));
});

test('a neighbour can differ from one earlier preference while retaining another', () => {
  const pref = preference('before',['a','b','c','d']), round = neighbour();
  const findings = buildContrastReadings({works,rounds:[pref,round],answers:{before:prefAnswer(pref,{a:50,b:90,c:10,d:30}),neighbour:answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'form'})}});
  assert.equal(findings.length,1); assert.equal(findings[0].supportingSetCount,1); assert.equal(findings[0].counterSetCount,1);
  assert.ok(findings[0].support.some(item => item.workIds.includes('b')));
  assert.ok(findings[0].counter.some(item => item.workIds.includes('c')));
});

test('an isolated categorical choice makes no manufactured taste finding', () => {
  const round = neighbour();
  assert.deepEqual(buildContrastReadings({works,rounds:[round],answers:{neighbour:answer(round,{neighbourId:'a',noGoodNeighbour:false,relationshipId:'form'})}}),[]);
  const keepRound = keep();
  assert.deepEqual(buildContrastReadings({works,rounds:[keepRound],answers:{keep:answer(keepRound,{keepId:'a',leaveId:'b'})}}),[]);
});

test('a subject choice can reverse the actual earlier pair without inventing a new numeric rating', () => {
  const pref = preference('before',['a','b','g']), round = subject('subject',['a','b']);
  const findings = buildContrastReadings({works,rounds:[pref,round],answers:{before:prefAnswer(pref,{a:20,b:80,g:50}),subject:answer(round,{preferredId:'a',noPreference:false})}});
  assert.equal(findings.length,1); const reading = findings[0];
  assert.equal(reading.id,'contrast-subject-reversal'); assert.equal(reading.module,'subject-and-treatment');
  assert.equal(reading.title,'Your two-work choice reversed the earlier order.');
  assert.deepEqual(reading.support.map(item => item.roundId),['before','subject']);
  assert.deepEqual(reading.comparisons[0].sourceRoundIds,['before','subject']);
  assert.equal(reading.comparisons[0].notes.a[0].text,'Earlier preference: 20 / 100');
  assert.equal('measures' in reading.comparisons[0],false);
  assert.ok(reading.alternatives.some(text => text.includes('does not show that subject framing caused')));
});

test('subject reversals require a complete earlier ordinary source and an explicit valid later choice', () => {
  const pref = preference('before',['a','b']), round = subject('subject',['a','b']);
  const answers = {before:prefAnswer(pref,{a:20,b:80}),subject:answer(round,{preferredId:'a',noPreference:false})};
  const run = (rounds, responses = answers, corpus = works) => buildContrastReadings({works:corpus,rounds,answers:responses});
  assert.deepEqual(run([round]),[]);
  assert.deepEqual(run([round,pref]),[]);
  assert.deepEqual(run([{...pref,evidence:{construct:'contextual-choice',family:'contextual-choice'}},round]),[]);
  assert.deepEqual(run([pref,round],{...answers,before:{...answers.before,positions:{a:20}}}),[]);
  assert.deepEqual(run([pref,round],{...answers,before:{...answers.before,positions:{a:50,b:60}}}),[]);
  assert.deepEqual(run([pref,round],{...answers,subject:answer(round,{preferredId:null,noPreference:true})}),[]);
  assert.deepEqual(run([pref,round],{...answers,subject:{...answers.subject,skipped:true}}),[]);
  assert.deepEqual(run([pref,{...round,subject:{...round.subject,reviewed:false}}]),[]);
  assert.deepEqual(run([pref,round],{...answers,subject:{...answers.subject,workIds:['b','a']}}),[]);
  assert.deepEqual(run([pref,round,round]),[]);
  assert.deepEqual(run([pref,round],answers,[...works,works[0]]),[]);
});

test('the latest earlier pair source is used instead of searching older answers for a reversal', () => {
  const first = preference('first',['a','b']), later = preference('later',['a','b','c']), round = subject('subject',['a','b']);
  const answers = {first:prefAnswer(first,{a:20,b:80}),later:prefAnswer(later,{a:80,b:20,c:50}),subject:answer(round,{preferredId:'a',noPreference:false})};
  assert.deepEqual(buildContrastReadings({works,rounds:[first,later,round],answers}),[]);
});

test('a subject quartet retains aligned and reversed pair relations without ranking its other alternatives', () => {
  const pref = preference('before',['a','b','c','d']), round = subject('subject',['a','b','c','d']);
  const answers = {before:prefAnswer(pref,{a:50,b:90,c:10,d:30}),subject:answer(round,{preferredId:'a',noPreference:false})};
  const reading = buildContrastReadings({works,rounds:[pref,round],answers})[0];
  assert.equal(reading.id,'contrast-subject-reversal'); assert.equal(reading.supportingSetCount,1); assert.equal(reading.counterSetCount,1);
  assert.equal(reading.title,'Your subject-matched choice reversed an earlier order.');
  assert.ok(reading.support[0].workIds.includes('b')); assert.ok(reading.counter[0].workIds.includes('c'));
  assert.ok(reading.support[1].detail.includes('unchosen alternatives were not ranked'));
});

test('same-subject patterns need separate reviewed sets and at least four actual paintings', () => {
  const first = subject('one',['a','b']), second = subject('two',['c','d']);
  const answers = {one:answer(first,{preferredId:'a',noPreference:false}),two:answer(second,{preferredId:'c',noPreference:false})};
  assert.deepEqual(buildContrastReadings({works,rounds:[first],answers}),[]);
  const findings = buildContrastReadings({works,rounds:[first,second],answers});
  assert.equal(findings.length,1); assert.equal(findings[0].module,'subject-and-treatment');
  assert.equal(findings[0].feature,'complexity'); assert.equal(findings[0].direction,-1);
  assert.equal(findings[0].supportingSetCount,2);
  assert.ok(findings[0].alternatives.some(value => value.includes('not participant ratings')));
  const duplicate = {...second,works:first.works};
  assert.deepEqual(buildContrastReadings({works,rounds:[first,duplicate],answers:{one:answers.one,two:answer(duplicate,{preferredId:'a',noPreference:false})}}),[]);
});

test('missing descriptors and no-preference responses are not zero-imputed or counted as pattern support', () => {
  const first = subject('one',['a','b']), second = subject('two',['c','d']);
  second.works[0].features = {};
  const answers = {one:answer(first,{preferredId:'a',noPreference:false}),two:answer(second,{preferredId:'c',noPreference:false})};
  assert.deepEqual(buildContrastReadings({works,rounds:[first,second],answers}),[]);
  second.works = selected(['c','d']);
  assert.deepEqual(buildContrastReadings({works,rounds:[first,second],answers:{...answers,two:answer(second,{preferredId:null,noPreference:true})}}),[]);
});

test('date knowledge and uncertainty remain task feedback without a personality reading', () => {
  const round = chronology(), response = answer(round,{orderedIds:['a','b','c','d'],uncertainIds:[],orderReviewed:true});
  assert.equal(contrastAnswerSummary(round,response).feedback.correct,6);
  assert.deepEqual(buildContrastReadings({works,rounds:[round],answers:{dates:response}}),[]);
});
