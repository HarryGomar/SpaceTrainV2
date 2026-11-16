import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {renderTastePortrait} from '../../public/art-atlas/taste-portrait-view.mjs';
import {createSortingRecord,placeSortingWork} from '../../public/art-atlas/sorting-table.mjs';

function fixture(){
  const works=Array.from({length:16},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:i%2?'Other Artist '+i:'Atlas Painter',date:String((i%2?1920:1850)+i),movement:i%2?'Busy tradition':'Quiet tradition',museum:'A Museum',sourceUrl:'https://museum.example/art/'+i,features:{abstraction:.5,energy:i%2?.9:.1,complexity:.5,humanity:.5,narrative:.5,atmosphere:.5,color:.5},analysis:{yearRange:[(i%2?1920:1850)+i,(i%2?1920:1850)+i],movementKey:i%2?'busy':'quiet'}}));
  const round=(id,indexes,construct='preference',extra={})=>({id,kind:'spectrum',criterion:construct==='curiosity'?'interest':'preference',title:construct==='curiosity'?'Which would you like to understand?':'Which do you prefer?',works:indexes.map(i=>works[i]),evidence:{construct,family:construct==='curiosity'?'interest':'individual-choice',role:'discovery',...extra}});
  const p1=round('p1',[0,1,2,3]),p2=round('p2',[4,5,6,7]),answer=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:r.criterion,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true});
  return {works,round,answer,p1,p2,rounds:[p1,p2],answers:{p1:answer(p1,[100,0,80,20]),p2:answer(p2,[100,0,80,20])}};
}
function build(f,extra={}){return buildTastePortrait({works:f.works,rounds:f.rounds,answers:f.answers,...extra});}

test('Empty evidence yields no manufactured profile, preferences or discovery scores',()=>{
  const p=buildTastePortrait();assert.deepEqual(p.observations,[]);assert.deepEqual(p.heroWorks,[]);assert.equal(p.coverage.preferenceTasks,0);for(const items of Object.values(p.discovery))assert.deepEqual(items,[]);assert.ok(p.unavailable.some(item=>item.module==='population-rarity'));assert.ok(p.nextSteps.some(item=>item.id==='more-preference'));
});

test('A recurring annotation needs two distinct preference sets and exact evidence',()=>{
  const f=fixture(),one=build(f,{rounds:[f.p1]});assert.equal(one.observations.some(item=>item.module==='patterns'),false);
  const p=build(f),pattern=p.observations.find(item=>item.module==='patterns');assert.ok(pattern);assert.equal(pattern.feature,'energy');assert.equal(pattern.direction,-1);assert.equal(pattern.supportedSetCount,2);assert.deepEqual(pattern.support.map(item=>item.roundId),['p1','p2']);assert.match(pattern.alternatives.join(' '),/not what caused/);
  assert.equal(p.discovery.types.length,1);assert.ok(p.heroWorks.every(item=>item.support.length));
});

test('Repeating or relabelling the same set cannot supply a second discovery set',()=>{
  const f=fixture(),again={...f.p1,id:'same-set',works:[...f.p1.works].reverse(),evidence:{...f.p1.evidence,setId:'a-new-label'}};const p=build(f,{rounds:[f.p1,again],answers:{p1:f.answers.p1,'same-set':f.answer(again,[20,80,0,100])}});assert.equal(p.coverage.preferenceTasks,2);assert.equal(p.coverage.distinctPreferenceSets,1);assert.equal(p.observations.some(item=>item.module==='patterns'),false);assert.equal(p.consistency.repeatedSets,0);
});

test('Context, curation, curiosity, recognition and saves never become unconditional preference',()=>{
  const f=fixture(),context=f.round('ctx',[0,1,2,3],'preference',{family:'contextual-choice'}),interest=f.round('interest',[4,5,6,7],'curiosity'),recognition={id:'labels',kind:'match',field:'artist',works:f.p1.works,options:f.p1.works.map((w,i)=>({id:'a'+i,label:w.artist}))};
  const p=build(f,{rounds:[context,interest,recognition],answers:{ctx:f.answer(context,[100,0,80,20]),interest:f.answer(interest,[100,0,80,20]),labels:{workIds:recognition.works.map(w=>w.id),field:'artist',guesses:Object.fromEntries(recognition.works.map((w,i)=>[w.id,'a'+i])),confirmed:true}},records:[{kind:'curate',confirmed:true}],saved:{w0:{look:true,study:true},w1:{look:true},unknown:{look:true}}});
  assert.equal(p.coverage.preferenceTasks,0);assert.equal(p.coverage.curiosityTasks,1);assert.equal(p.coverage.recognitionTasks,1);assert.equal(p.coverage.curatorialRecords,0);assert.deepEqual(p.heroWorks,[]);assert.deepEqual(p.discovery.artists,[]);assert.deepEqual(p.collection.overlapIds,['w0']);assert.deepEqual(p.collection.unratedSavedIds,['w0','w1']);
});

test('Question semantics, criterion and identity take precedence over a preference-looking number',()=>{
  const f=fixture(),unknown=f.round('unknown',[0,1,2,3],'unreviewed-construct'),anchor={...f.p2,anchorWorks:[f.works[8]]};const p=build(f,{rounds:[unknown,anchor],answers:{unknown:f.answer(unknown,[100,0,80,20]),p2:f.answers.p2}});assert.equal(p.coverage.preferenceTasks,0);
  const malformed=structuredClone(f.answers);malformed.p2.workIds.reverse();assert.equal(build(f,{answers:malformed}).coverage.preferenceTasks,1);
});

test('Incomplete, skipped, unconfirmed, unknown and ambiguous rounds fail closed',()=>{
  const f=fixture();for(const mutate of [a=>delete a.p2.positions.w4,a=>a.p2.positions.w4=null,a=>a.p2.positions.w4=NaN,a=>a.p2.confirmed=false,a=>a.p2.skipped=true,a=>a.p2.workIds=['unknown']]){const answers=structuredClone(f.answers);mutate(answers);const p=build(f,{answers});assert.equal(p.coverage.preferenceTasks,1);assert.equal(p.observations.some(item=>item.module==='patterns'),false);}
  assert.equal(build(f,{rounds:[f.p1,structuredClone(f.p1)]}).coverage.preferenceTasks,0);
  assert.equal(build(f,{rounds:[{...f.p1,works:[{id:'missing'}]}]}).coverage.preferenceTasks,0);
  const answers=structuredClone(f.answers);answers.p1.positions=Object.assign([],...Object.entries(answers.p1.positions).map(([id,v])=>({[id]:v})));assert.equal(build(f,{answers}).coverage.preferenceTasks,1);
});

test('Unknown feature values and unknown date ranges never become zero',()=>{
  const f=fixture();for(const w of f.works){delete w.features.energy;w.analysis.yearRange=null;w.movement='Unknown';w.analysis.movementKey='unknown';}
  const p=build(f);assert.equal(p.observations.some(item=>item.module==='patterns'),false);assert.deepEqual(p.discovery.eras,[]);assert.deepEqual(p.discovery.traditions,[]);
});

test('Annotations that covary are retained as competing descriptions',()=>{
  const f=fixture();for(const w of f.works)w.features.abstraction=w.features.energy;const p=build(f),patterns=p.observations.filter(item=>item.module==='patterns');assert.equal(patterns.length,1);assert.ok(patterns[0].alternatives.some(text=>text.includes('also align with')));
});

test('An overall supportive set can contain opposing choices; checks and repeats retain their separate roles',()=>{
  const f=fixture();
  for(let i=0;i<6;i++)f.works[i].features.energy=[1,.4,0][i%3];
  const a=f.round('a',[0,1,2]),b=f.round('b',[3,4,5]),check=f.round('check',[0,4],'preference',{role:'probe'}),repeat={...a,id:'repeat',evidence:{...a.evidence,role:'repeat',repeatOf:'a'}};
  const p=build(f,{rounds:[a,b,check,repeat],answers:{a:f.answer(a,[70,100,0]),b:f.answer(b,[70,100,0]),check:f.answer(check,[0,100]),repeat:f.answer(repeat,[70,100,0])}});
  const finding=p.observations.find(item=>item.module==='patterns');assert.ok(finding);
  assert.equal(finding.discoveryBalance.eligibleSets,2);assert.equal(finding.discoveryBalance.supportingSets,2);assert.equal(finding.discoveryBalance.setsWithOpposingPairs,2);
  assert.equal(finding.additionalBalance.opposingSets,1);assert.equal(finding.repeatBalance.eligibleSets,1);assert.equal(finding.patternStatus,'mixed-candidate');
  assert.equal(finding.counter.length,4);assert.ok(finding.counter.some(entry=>entry.sourceRole==='later comparison'));assert.ok(finding.counter.some(entry=>entry.sourceRole==='repeated comparison'));
});

test('An opposing choice remains a named personal exception rather than population weirdness',()=>{
  const f=fixture(),p3=f.round('p3',[8,9]);f.rounds.push(p3);f.answers.p3=f.answer(p3,[0,100]);const p=build(f),pattern=p.observations.find(item=>item.module==='patterns'),exception=p.observations.find(item=>item.module==='exceptions');assert.ok(pattern.counter.some(item=>item.roundId==='p3'));assert.ok(exception);assert.deepEqual(exception.support[0].workIds,['w9','w8']);assert.match(exception.alternatives.join(' '),/No comparison with other people/);assert.equal('percentile' in exception,false);
});

test('Curiosity contrasts use the exact paintings and preserve both separate scales',()=>{
  const f=fixture(),interest=f.round('interest',[0,1,2,3],'curiosity');f.rounds.splice(1,0,interest);f.answers.interest=f.answer(interest,[0,100,20,80]);const p=build(f),item=p.observations.find(item=>item.module==='curiosity');assert.ok(item);const c=item.comparisons[0];assert.equal(c.preferenceRoundId,'p1');assert.equal(c.curiosityRoundId,'interest');assert.deepEqual(c.preference,[100,0]);assert.deepEqual(c.curiosity,[0,100]);assert.deepEqual(item.support.map(e=>e.roundId),['p1','interest']);
  const changed={...interest,works:[f.works[4],f.works[5],f.works[6],f.works[7]]};assert.equal(build(f,{rounds:[f.p1,changed],answers:{p1:f.answers.p1,interest:f.answer(changed,[0,100,20,80])}}).observations.some(item=>item.module==='curiosity'),false);
});

test('Curiosity before preference yields the same paired reversal without imputing absent or partial responses',()=>{
  const f=fixture(),interest=f.round('early-curiosity',[3,2,1,0],'curiosity'),answers={p1:f.answers.p1,'early-curiosity':f.answer(interest,[80,20,100,0])},early=build(f,{rounds:[interest,f.p1],answers}),late=build(f,{rounds:[f.p1,interest],answers}),earlyFinding=early.observations.find(item=>item.module==='curiosity'),lateFinding=late.observations.find(item=>item.module==='curiosity');
  assert.ok(earlyFinding);assert.ok(lateFinding);assert.deepEqual(earlyFinding.comparisons,lateFinding.comparisons);assert.deepEqual(earlyFinding.comparisons[0].workIds,['w0','w1']);assert.deepEqual(earlyFinding.comparisons[0].preference,[100,0]);assert.deepEqual(earlyFinding.comparisons[0].curiosity,[0,100]);assert.deepEqual(earlyFinding.support.map(item=>item.roundId),['p1','early-curiosity']);assert.equal(early.nextSteps.some(item=>item.id==='separate-curiosity'),false);
  for(const missing of ['p1','early-curiosity']){const incomplete=structuredClone(answers);delete incomplete[missing];const portrait=build(f,{rounds:[interest,f.p1],answers:incomplete});assert.equal(portrait.observations.some(item=>item.module==='curiosity'),false);assert.equal(portrait.coverage.preferenceTasks,missing==='p1'?0:1);assert.equal(portrait.coverage.curiosityTasks,missing==='early-curiosity'?0:1);}
  const partial=structuredClone(answers);delete partial['early-curiosity'].positions.w0;const portrait=build(f,{rounds:[interest,f.p1],answers:partial});assert.equal(portrait.observations.some(item=>item.module==='curiosity'),false);assert.equal(portrait.coverage.curiosityTasks,0);assert.equal(portrait.coverage.preferenceTasks,1);
});

test('Exact repeats count retained orders, reversals and near ties without a percentage',()=>{
  const f=fixture(),repeat={...f.p1,id:'repeat',works:[...f.p1.works].reverse(),evidence:{...f.p1.evidence,repeatOf:'p1',role:'repeat'}};f.rounds.push(repeat);f.answers.repeat=f.answer(repeat,[80,20,100,0]);const p=build(f);assert.equal(p.coverage.distinctPreferenceSets,2);assert.equal(p.consistency.repeatedSets,1);assert.equal(p.consistency.reversed,6);assert.equal(p.consistency.retained,0);assert.equal(p.consistency.comparisons[0].pairs.length,6);assert.equal(p.observations.find(item=>item.module==='repeats').support[1].roundId,'repeat');assert.equal('percentage' in p.consistency,false);
  f.answers.repeat=f.answer(repeat,[52,53,54,55]);const tied=build(f);assert.equal(tied.consistency.becameNearTied,6);assert.equal(tied.consistency.reversed,0);
});

test('A future original, changed scale or changed repeat identity supplies no consistency claim',()=>{
  const f=fixture(),repeat={...f.p1,id:'repeat',evidence:{...f.p1.evidence,repeatOf:'p1',role:'repeat'}},answers={...f.answers,repeat:f.answer(repeat,[100,0,80,20])};assert.equal(build(f,{rounds:[repeat,f.p1],answers}).consistency.repeatedSets,0);assert.equal(build(f,{rounds:[f.p1,{...repeat,scale:{left:'Another purpose',right:'A different choice'}}],answers}).consistency.repeatedSets,0);assert.equal(build(f,{rounds:[f.p1,{...repeat,works:f.p2.works}],answers:{...answers,repeat:f.answer({...repeat,works:f.p2.works},[100,0,80,20])}}).consistency.repeatedSets,0);
});

test('A declared repeat with a changed actual prompt is not an exact repeat',()=>{
  const f=fixture(),repeat={...f.p1,id:'repeat',title:'Which would you use to feel calmer?',evidence:{...f.p1.evidence,repeatOf:'p1',role:'repeat'}};f.rounds.push(repeat);f.answers.repeat=f.answer(repeat,[100,0,80,20]);assert.equal(build(f).consistency.repeatedSets,0);repeat.title=f.p1.title;repeat.hint='Choose for a special purpose';assert.equal(build(f).consistency.repeatedSets,0);
});

test('A contextual reversal is reported separately from a repeated preference question',()=>{
  const f=fixture(),context=f.round('ctx',[0,1,2,3],'first-stop',{family:'contextual-choice'});context.title='Where would you begin?';f.rounds.push(context);f.answers.ctx=f.answer(context,[0,100,20,80]);const p=build(f);assert.equal(p.coverage.preferenceTasks,2);assert.equal(p.consistency.repeatedSets,0);assert.equal(p.consistency.contextualDifferences.length,1);assert.equal(p.consistency.contextualDifferences[0].reversals.length,6);assert.ok(p.observations.find(item=>item.module==='context'));assert.deepEqual(p.consistency.contextualDifferences[0].reversals[0].support.map(e=>e.roundId),['p1','ctx']);
});

test('Artist, era and tradition routes explain their particular evidence and counterexamples',()=>{
  const f=fixture(),p=build(f);assert.ok(p.discovery.artists.find(item=>item.title==='Atlas Painter'));assert.ok(p.discovery.eras.find(item=>item.title==='1800–1899'));assert.ok(p.discovery.traditions.find(item=>item.title==='Quiet tradition'));
  for(const type of ['artists','eras','traditions'])for(const item of p.discovery[type]){assert.ok(item.support.length);assert.ok(item.sourceUrls.length);assert.equal('score' in item,false);for(const e of item.support)assert.ok(f.rounds.some(r=>r.id===e.roundId));}
  const single=build(f,{rounds:[f.p1]});assert.deepEqual(single.discovery.eras,[]);assert.deepEqual(single.discovery.traditions,[]);assert.ok(single.discovery.artists.every(item=>item.basis==='One artwork as a starting point'));
});

test('Broad or century-crossing dates are not silently assigned to an era',()=>{
  const f=fixture();for(const w of f.works)w.analysis.yearRange=[1850,1920];assert.deepEqual(build(f).discovery.eras,[]);for(const w of f.works)w.analysis.yearRange=[1890,1910];assert.deepEqual(build(f).discovery.eras,[]);
});

test('Painting routes suggest sourced unrated works and name a concrete connection',()=>{
  const f=fixture(),p=build(f);assert.ok(p.discovery.paintings.length);for(const item of p.discovery.paintings){assert.ok(item.workId);assert.ok(!f.rounds.some(r=>r.works.some(w=>w.id===item.workId)));assert.ok(item.support.length);assert.match(item.reason,/Compare this with/);assert.match(item.alternatives[0],/not a prediction/);assert.ok(item.sourceUrls.includes(f.works.find(w=>w.id===item.workId).sourceUrl));}
});

test('Museum routes use institution facts and never promise a current display',()=>{
  const f=fixture();f.works[0].artist='Claude Monet';f.works[0].museum='Cleveland Museum of Art';f.works[0].sourceUrl='https://www.clevelandart.org/art/1960.81';const p=build(f),cleveland=p.discovery.museums.find(item=>item.museumId==='cleveland'),london=p.discovery.museums.find(item=>item.museumId==='national-gallery');assert.ok(cleveland);assert.ok(london);assert.equal(cleveland.basis,'A selected work in the collection');assert.equal(london.basis,'Artist represented in the collection');for(const item of [cleveland,london]){assert.ok(item.sourceUrls.length);assert.match(item.alternatives.join(' '),/currently displayed/);assert.ok(item.support.every(e=>e.workIds.includes('w0')));}
});

test('Build is pure and every evidence ID resolves to an actual validated painting',()=>{
  const f=fixture(),input={works:f.works,rounds:f.rounds,answers:f.answers},before=structuredClone(input),p=build(f);assert.deepEqual(input,before);for(const item of [...p.observations,...Object.values(p.discovery).flat()])for(const evidence of [...item.support,...item.counter])for(const id of evidence.workIds)assert.ok(f.works.some(w=>w.id===id));
});

test('Meaning links use the same paintings and the correct meaning instrument',()=>{
  const f=fixture(),meaning={id:'meaning',kind:'grid',axis:'meaning',works:[...f.p1.works].reverse(),evidence:{construct:'meaning',family:'interpretive-appraisal'}};f.rounds.push(meaning);f.answers.meaning={workIds:meaning.works.map(w=>w.id),axis:'meaning',points:{w0:[0,10],w1:[100,100],w2:[25,25],w3:[80,80]},confirmed:true};const p=build(f),item=p.observations.find(item=>item.module==='meaning');assert.ok(item);assert.equal(p.coverage.meaningTasks,1);assert.equal(item.support[1].roundId,'meaning');assert.deepEqual(item.comparisons[0].workIds,['w0','w1']);assert.deepEqual(item.comparisons[0].measures[1].values,[0,100]);assert.match(item.alternatives.join(' '),/not show that symbolism caused/);
  const wrong=structuredClone(f.answers);wrong.meaning.axis='connection';assert.equal(build(f,{answers:wrong}).observations.some(item=>item.module==='meaning'),false);
  assert.equal(build(f,{rounds:[f.p1,{...meaning,axisDefinition:{xName:'An old axis'}}]}).observations.some(item=>item.module==='meaning'),false);
});

test('Before/after liking and a linked earlier claim remain one local context comparison',()=>{
  const f=fixture(),claim={id:'claim',kind:'statements',title:'Agree or disagree',works:[f.works[0]],statements:[{id:'contextEffect',text:'Learning the story behind a painting rarely changes how much I like it.'}],evidence:{statementTest:'contextEffect',contextRoundId:'story',checkId:'link'}},story={id:'story',kind:'context',contextMode:'preference-before-after-v1',works:[f.works[0]],evidence:{construct:'context-liking-change',claimRoundId:'claim',checkId:'link'}};f.rounds.push(claim,story);f.answers.claim={workIds:['w0'],claims:{contextEffect:4}};f.answers.story={workIds:['w0'],workId:'w0',before:25,after:75,storySeen:true};const p=build(f),item=p.observations.find(item=>item.module==='context-note');assert.ok(item);assert.equal(p.coverage.preferenceTasks,2);assert.equal(p.coverage.contextRatingTasks,1);assert.equal(p.contextRatings[0].change,50);assert.equal(p.contextRatings[0].claimRoundId,'claim');assert.deepEqual(item.support.map(e=>e.roundId),['claim','story']);assert.match(item.alternatives.join(' '),/cannot be attributed to the story alone/);assert.match(item.alternatives.join(' '),/allows exceptions/);
  const withoutLink={...story,evidence:{...story.evidence,checkId:'not-the-same'}};assert.equal(build(f,{rounds:[f.p1,claim,withoutLink]}).contextRatings[0].claimRoundId,null);
});

test('Missing baseline, wrong work, unseen story or off-scale context ratings are not completed context evidence',()=>{
  const f=fixture(),story={id:'story',kind:'context',contextMode:'preference-before-after-v1',works:[f.works[0]],evidence:{construct:'context-liking-change'}};for(const answer of [{workIds:['w0'],workId:'w0',after:75,storySeen:true},{workIds:['w0'],workId:'w1',before:25,after:75,storySeen:true},{workIds:['w0'],workId:'w0',before:25,after:75,storySeen:false},{workIds:['w0'],workId:'w0',before:20,after:75,storySeen:true}]){const p=build(f,{rounds:[story],answers:{story:answer}});assert.equal(p.coverage.contextRatingTasks,0);assert.deepEqual(p.contextRatings,[]);}
});

test('Valid curatorial findings are retained without becoming individual preference',()=>{
  const f=fixture(),offeredIds=f.works.slice(0,8).map(w=>w.id),positions=[[.12,.2],[.23,.2],[.7,.2],[.81,.2],[.12,.75],[.23,.75],[.7,.75],[.81,.75]];let record=createSortingRecord(f.works,{},[],{id:'sort',now:1,offeredIds});for(let i=0;i<8;i++){const result=placeSortingWork(record,offeredIds[i],positions[i]);assert.ok(result.ok);record=result.record;}record.confirmed=true;record.finishedAt=2;const p=build(f,{rounds:[],answers:{},records:[record]});assert.equal(p.coverage.preferenceTasks,0);assert.equal(p.coverage.curatorialRecords,1);assert.ok(p.curatorialObservations.length);assert.ok(p.curatorialObservations.every(item=>item.kind==='curation'));
});

test('Visual reading uses actual preferred art and exact labeled scales with collapsed evidence',()=>{
  const f=fixture(),interest=f.round('interest',[0,1,2,3],'curiosity');f.rounds.push(interest);f.answers.interest=f.answer(interest,[0,100,20,80]);const portrait=build(f),html=renderTastePortrait({portrait,works:f.works,rounds:f.rounds,answers:f.answers,image:w=>'<img data-art="'+w.id+'">',esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),keepButtons:w=>'<span data-keep-work="'+w.id+'"></span>'});assert.match(html,/journey-reading taste-portrait/);assert.match(html,/tp-constellation/);for(const hero of portrait.heroWorks)assert.ok(html.includes('data-work="'+hero.workId+'"'));assert.match(html,/More curious about this/);assert.doesNotMatch(html,/tp-measure-track/);assert.match(html,/<strong>100<small> \/ 100/);assert.match(html,/<details class="tp-evidence">/);assert.doesNotMatch(html,/\d+(?:st|nd|rd|th) percentile|compatibility score|Your personality type/);
});

test('Visual empty state renders no favourite artwork, invented scale or fake archetype',()=>{
  const portrait=buildTastePortrait(),html=renderTastePortrait({portrait,works:[],image:()=>{throw Error('No artwork should render');},esc:String});assert.doesNotMatch(html,/data-work=/);assert.doesNotMatch(html,/tp-measure-row/);assert.match(html,/completed comparisons/);
});

test('The visual reading retains old comparison evidence without promoting a two-set heuristic into a new taste family',()=>{
  const f=fixture(),portrait=build(f);assert.equal(portrait.discovery.types.length,1);
  const route=portrait.discovery.types[0];assert.ok(route.support.length>=2);
  assert.ok(portrait.axesProfile.axes.every(axis=>!axis.summaryEligible));
  const html=renderTastePortrait({portrait,works:f.works,image:work=>'<img data-art="'+work.id+'">',esc:String});
  assert.match(html,/Visual profile/);assert.match(html,/View the choices/);
  assert.doesNotMatch(html,/<section class="tp-avenues">|class="taste-quality-section"/);
  assert.match(html,/More evidence needed|Too few contrasting sets/);
});

test('The same supporting pair in otherwise different sets is not four supporting artworks',()=>{
  const f=fixture();for(const i of [2,3,4,5])delete f.works[i].features.energy;const other=f.round('other',[0,1,4,5]);const p=build(f,{rounds:[f.p1,other],answers:{p1:f.answers.p1,other:f.answer(other,[100,0,80,20])}});assert.equal(p.coverage.distinctPreferenceSets,2);assert.equal(p.observations.some(item=>item.module==='patterns'),false);
});

test('Preference probes remain counterexample evidence and are never recommended as unrated works',()=>{
  const f=fixture(),probe=f.round('probe',[8,9],'preference',{role:'probe'});f.rounds.push(probe);f.answers.probe=f.answer(probe,[0,100]);const p=build(f);assert.equal(p.coverage.distinctPreferenceSets,2);assert.ok(p.observations.find(item=>item.module==='exceptions'));assert.ok(p.discovery.paintings.every(item=>!['w8','w9'].includes(item.workId)));
});

test('Sourced catalogue institutions outside the editorial museum list remain usable',()=>{
  const f=fixture();f.works[0].museum='Mauritshuis';f.works[0].sourceUrl='https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring/';const route=build(f).discovery.museums.find(item=>item.title==='Mauritshuis');assert.ok(route);assert.equal(route.city,'');assert.equal(route.country,'');assert.equal(route.sourceUrl,f.works[0].sourceUrl);assert.match(route.reason,/supplied collection record/);
});
