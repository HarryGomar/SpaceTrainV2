import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeStudy, validStudyAnswer, sanitizeStudyDraft, snapshotStudyRound, restoreStudyRound, prepareStudySession, sessionStudyRounds } from '../../public/art-atlas/deep-study.mjs';
import { buildStudyRounds } from '../../public/art-atlas/question-bank.mjs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import { correctOption } from '../../public/art-atlas/engine.mjs';
import {allowsMultipleNeighbourReasons} from '../../public/art-atlas/contrast-rounds.mjs';
const real=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const works=real.slice(0,12).map((w,i)=>({...w,artist:'Artist '+i,artistKnown:true,features:{...w.features,abstraction:.5,energy:i/11,complexity:.5,humanity:.5,narrative:.5,atmosphere:.5,color:.5}}));
function spectrum(id,art=works.slice(0,4),construct='preference',setId='set-one',role='discovery') {return {id,kind:'spectrum',format:'spectrum',criterion:construct==='curiosity'?'interest':'preference',title:'Which do you prefer?',hint:'Place the works.',works:art,evidence:{construct,setId,role}};}
function answer(r,values) {return {workIds:r.works.map(w=>w.id),criterion:r.criterion,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true};}
function grid(id,art=works.slice(0,4),axis='response',setId='set-one') {return {id,kind:'grid',format:'grid',axis,title:'Response',hint:'Map each work.',works:art,evidence:{construct:axis==='connection'?'connection':'response',setId,role:'discovery'}};}
function points(r,values) {return {workIds:r.works.map(w=>w.id),axis:r.axis,points:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true};}

test('Frozen study definitions retain shown works, anchors, scales and evidence independently of later generation',()=>{
  const r=spectrum('freeze');r.anchorWorks=[works[5]];r.scale={left:'Less fitting',right:'More fitting'};const saved=snapshotStudyRound(r);r.works.reverse();r.scale.left='Changed';
  const restored=restoreStudyRound(saved,works);assert.deepEqual(restored.works.map(w=>w.id),saved.workIds);assert.equal(restored.anchorWorks[0].id,works[5].id);assert.equal(restored.scale.left,'Less fitting');
  assert.equal(restoreStudyRound({...saved,workIds:['missing']},works),null);assert.equal(restoreStudyRound({...saved,criterion:'unknown'},works),null);
});

test('Every actual contrast survives serialization with its original candidates, anchor, metadata and categorical answer',()=>{
  const contrasts=buildJourneyRounds(real).filter(round=>round.kind==='contrast');assert.deepEqual(contrasts.map(round=>round.contrastKind),['chronology','neighbour','keep-leave','same-subject']);const responses={};
  for(const original of contrasts){
    const round=structuredClone(original),saved=snapshotStudyRound(round),frozen=structuredClone(saved),workIds=round.works.map(work=>work.id),base={workIds,contrastKind:round.contrastKind,confirmed:true};
    const response=round.contrastKind==='chronology'?{...base,orderedIds:[...workIds].reverse(),uncertainIds:[workIds[0]],orderReviewed:true}:round.contrastKind==='neighbour'?{...base,neighbourId:workIds[1],noGoodNeighbour:false,...(allowsMultipleNeighbourReasons(round)?{relationshipIds:round.relationshipOptions?.length?[round.relationshipOptions[0].id]:[]}:round.relationshipOptions?.length?{relationshipId:round.relationshipOptions[0].id}:{})}:round.contrastKind==='keep-leave'?{...base,keepId:workIds[0],leaveId:workIds.at(-1)}:{...base,preferredId:null,noPreference:true};
    round.title='A later question';round.works.reverse();round.sourceUrls.push('https://example.org/later-source');round.evidence.construct='another-construct';if(round.dateEvidence)Object.values(round.dateEvidence)[0].yearRange[0]=-99999;if(round.subject)round.subject.label='A later subject';if(round.relationshipOptions)round.relationshipOptions[0].label='A later relation';
    const restored=restoreStudyRound(saved,real);assert.ok(restored,original.contrastKind);assert.deepEqual(snapshotStudyRound(restored),frozen);assert.deepEqual(saved,frozen);assert.ok(validStudyAnswer(restored,response));assert.equal(validStudyAnswer(restored,{...response,confirmed:false}),false);assert.equal(validStudyAnswer(restored,{...response,workIds:[...workIds].reverse()}),false);assert.equal(restoreStudyRound({...saved,workIds:['missing',...saved.workIds.slice(1)]},real),null);if(original.contrastKind==='neighbour')assert.equal(restoreStudyRound({...saved,anchorIds:[]},real),null);responses[restored.id]=response;
  }
  const result=analyzeStudy(real,contrasts,responses);assert.equal(result.answered,4);assert.equal(result.predictionChecks,0);assert.equal(result.repeatsCompared,0);assert.equal(result.findings.some(finding=>finding.feature),false,'Contextual and knowledge choices cannot become an unconditional preference explanation');
});

test('A legacy capped keep snapshot and its partial draft retain their cap rather than acquiring the new uncapped prompt',()=>{
  const offered=real.slice(0,12),round={id:'saved-keep',kind:'choice-grid',format:'choice-grid',selectionMode:'shortlist',maxChoices:3,title:'Which would you keep?',hint:'Choose up to three paintings.',works:offered,evidence:{journeyRevision:'art-profile-50-v5',construct:'capped-contextual-selection',family:'selection-grid',role:'check'}},saved=snapshotStudyRound(round),restored=restoreStudyRound(saved,real),selectedIds=offered.slice(0,3).map(work=>work.id),response={workIds:offered.map(work=>work.id),selectionMode:'shortlist',selectedIds,explicitNone:false,unsure:false,confirmed:true};
  assert.equal(restored.maxChoices,3);assert.equal(restored.hint,round.hint);assert.ok(validStudyAnswer(restored,response));assert.equal(validStudyAnswer(restored,{...response,selectedIds:offered.slice(0,4).map(work=>work.id)}),false);const draft=sanitizeStudyDraft(restored,response);assert.deepEqual(draft.selectedIds,selectedIds);assert.equal(draft.confirmed,false);assert.deepEqual(snapshotStudyRound(restored),saved);
});

test('Incomplete and skipped decisions cannot become observations or neutral answers',()=>{
  const r=spectrum('partial'),a=answer(r,[100,70,30,0]);a.confirmed=false;
  const result=analyzeStudy(works,[r],{partial:a});assert.equal(result.answered,0);assert.deepEqual(result.findings,[]);
  delete a.positions[works[3].id];const clean=sanitizeStudyDraft(r,a);assert.equal(Object.keys(clean.positions).length,3);assert.equal(clean.positions[works[3].id],undefined);
  assert.equal(analyzeStudy(works,[r],{partial:{skipped:true}}).answered,0);
});

test('Contextual spectra stay out of the unconditional preference explanation',()=>{
  const rounds=[0,1,2].map((i)=>({...spectrum('context-'+i,[works[i],works[i+3],works[i+6],works[i+9]],'collection-intent','ctx-'+i),evidence:{construct:'collection-intent',setId:'ctx-'+i,role:'discovery',family:'contextual-choice'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r,[0,30,70,100])]));
  const result=analyzeStudy(works,rounds,answers);assert.equal(result.answered,3);assert.equal(result.findings.some(f=>f.feature),false);
});

test('Preference and curiosity reversals keep following comparisons as counterevidence',()=>{
  const a=spectrum('p-one',works.slice(0,2),'preference','one'),b=spectrum('i-one',a.works,'curiosity','one'),c=spectrum('p-two',works.slice(2,4),'preference','two'),d=spectrum('i-two',c.works,'curiosity','two');
  const responses={'p-one':answer(a,[100,0]),'i-one':answer(b,[0,100]),'p-two':answer(c,[100,0]),'i-two':answer(d,[100,0])};
  const f=analyzeStudy(works,[a,b,c,d],responses).findings.find(f=>f.id==='study-curiosity');assert.ok(f);assert.equal(f.support.length,2);assert.equal(f.counter.length,2);assert.deepEqual(f.support[0].workIds,a.works.map(w=>w.id));assert.deepEqual(f.counter[0].workIds,c.works.map(w=>w.id));
});

test('Tension and involvement readings never reinterpret the legacy pleasantness map',()=>{
  const p=spectrum('p',works.slice(0,2)),g=grid('g',p.works),responses={p:answer(p,[100,0]),g:points(g,[[80,20],[20,90]])};
  let result=analyzeStudy(works,[p,g],responses);assert.ok(result.findings.some(f=>f.id==='study-tension'));assert.ok(result.findings.some(f=>f.id==='study-involvement'));
  g.axis='feeling';responses.g.axis='feeling';result=analyzeStudy(works,[p,g],responses);assert.equal(result.findings.some(f=>f.id==='study-tension'||f.id==='study-involvement'),false);
});

test('Visual recurrence needs distinct actual artwork sets rather than renamed repeats',()=>{
  const same=[0,1,2].map(i=>spectrum('same-'+i,[works[0],works[3],works[7],works[11]],'preference','renamed-'+i)),answers=Object.fromEntries(same.map(r=>[r.id,answer(r,[0,30,70,100])]));
  assert.equal(analyzeStudy(works,same,answers).findings.some(f=>f.feature==='energy'),false);
  const distinct=[spectrum('a',[works[0],works[3],works[7],works[11]],'preference','a'),spectrum('b',[works[1],works[4],works[8],works[10]],'preference','b'),spectrum('c',[works[2],works[5],works[6],works[9]],'preference','c')],different=Object.fromEntries(distinct.map(r=>[r.id,answer(r,[0,30,70,100])]));
  assert.ok(analyzeStudy(works,distinct,different).findings.some(f=>f.feature==='energy'));
});

test('An intentional repeat needs the same works and criterion before describing a changed order',()=>{
  const a=spectrum('before',works.slice(0,2)),b=spectrum('after',[...a.works].reverse(),'preference','set-one','repeat');b.evidence.repeatOf='before';
  const responses={before:answer(a,[100,0]),after:answer(b,[100,0])};assert.ok(analyzeStudy(works,[a,b],responses).findings.some(f=>f.id==='study-repeat'));
  b.criterion='interest';responses.after.criterion='interest';assert.equal(analyzeStudy(works,[a,b],responses).findings.some(f=>f.id==='study-repeat'),false);
});

test('Stable repeats are counted as compared tasks without inventing a reversal',()=>{
  const a=spectrum('before',works.slice(0,2)),b=spectrum('after',[...a.works].reverse(),'preference','set-one','repeat');b.evidence.repeatOf='before';
  const result=analyzeStudy(works,[a,b],{before:answer(a,[100,0]),after:answer(b,[0,100])});
  assert.equal(result.repeatsCompared,1);assert.equal(result.repeatsWithClearReversal,0);assert.equal(result.findings.some(f=>f.id==='study-repeat'),false);
});

test('A neutral self-description stays uncommitted and a reversing comparison supports its exception',()=>{
  const p=spectrum('p'),i=spectrum('i',p.works,'curiosity'),s={id:'s',kind:'statements',format:'statements',title:'Describe your taste',hint:'One statement',works:p.works,statements:[{id:'curiosity',text:'My preferred works are also the ones I want to understand.'}],evidence:{setId:'set-one',construct:'self-description',role:'check',statementTest:'curiosity'}};
  const responses={p:answer(p,[100,70,30,0]),i:answer(i,[100,0,60,30]),s:{workIds:p.works.map(w=>w.id),claims:{curiosity:2}}};assert.ok(validStudyAnswer(s,responses.s));let result=analyzeStudy(works,[p,i,s],responses);assert.equal(result.checks[0].status,'mixed');assert.equal(result.findings.some(f=>f.id==='study-statement-curiosity'),false);
  responses.s.claims.curiosity=4;result=analyzeStudy(works,[p,i,s],responses);const f=result.findings.find(f=>f.id==='study-statement-curiosity');assert.ok(f);assert.deepEqual(f.support[1].workIds,[works[1].id,works[2].id]);assert.ok(f.counter.length);
});

test('A prospective check requires earlier discovery answers frozen before its response',()=>{
  const prior=[spectrum('p1',works.slice(0,2),'preference','one'),spectrum('p2',works.slice(2,4),'preference','two'),spectrum('p3',works.slice(4,6),'preference','three')],responses=Object.fromEntries(prior.map(r=>[r.id,answer(r,[0,100])])),check=spectrum('check',works.slice(6,8),'preference','check','counterexample');
  check.evidence={...check.evidence,heldOut:true,provisionalPrediction:works[7].id,trainingRoundIds:prior.map(r=>r.id),trainingAnswers:structuredClone(responses)};responses.check=answer(check,[100,0]);let result=analyzeStudy(works,[...prior,check],responses);assert.equal(result.predictionChecks,1);assert.ok(result.findings.some(f=>f.id==='study-prediction'));
  responses.p1.positions[works[0].id]=100;assert.equal(check.evidence.trainingAnswers.p1.positions[works[0].id],0);
  check.evidence.trainingRoundIds=['p1','p2','check'];assert.equal(analyzeStudy(works,[...prior,check],responses).predictionChecks,0);
});

test('A role reversal retains the contextual brief and anchors instead of becoming a dislike',()=>{
  const p=spectrum('pref'),c=spectrum('context',p.works,'companion');c.evidence={construct:'companion',setId:'set-one',family:'contextual-choice',role:'discovery'};c.title='Which work belongs beside this anchor?';c.anchorWorks=[works[5]];
  const result=analyzeStudy(works,[p,c],{pref:answer(p,[100,70,30,0]),context:answer(c,[0,30,70,100])}),f=result.findings.find(f=>f.id==='study-contextual-fit');assert.ok(f);assert.ok(f.evidence.includes(works[5].id));assert.match(f.text,/ordinary preference task/);
});

test('The actual 200-decision path can be answered and read with evidence tied to its real shown rounds',()=>{
  const base=buildStudyRounds(real,200,{}),rounds=[],answers={};
  for(let index=0;index<base.length;index++){
    const original=base[index],r=original.evidence.heldOut?buildStudyRounds(real,200,answers)[index]:original;
    if(r.evidence.provisionalPrediction)r.evidence.trainingAnswers=Object.fromEntries(r.evidence.trainingRoundIds.map(id=>[id,structuredClone(answers[id])]));
    rounds.push(r);let a={workIds:r.works.map(w=>w.id)};
    if(r.kind==='spectrum'){const sorted=[...r.works].sort((a,b)=>(a.features.energy-b.features.energy)*(r.evidence.construct==='curiosity'?-1:1));a={...a,criterion:r.criterion,confirmed:true,positions:Object.fromEntries(sorted.map((w,i)=>[w.id,Math.round(i/(sorted.length-1)*100)]))};}
    if(r.kind==='grid')a={...a,axis:r.axis,confirmed:true,points:Object.fromEntries(r.works.map(w=>[w.id,[Math.round(w.features.energy*100),Math.round((1-w.features.energy)*100)]]))};
    if(r.kind==='statements')a.claims=Object.fromEntries(r.statements.map(s=>[s.id,2]));
    if(r.kind==='match')a={...a,field:r.field,confirmed:true,guesses:Object.fromEntries(r.works.map(w=>[w.id,correctOption(r,w)]))};
    if(r.kind==='context')a={...a,workId:r.works[0].id,change:'more'};
    assert.ok(validStudyAnswer(r,a),'valid answer for '+r.id);answers[r.id]=a;
  }
  const result=analyzeStudy(real,rounds,answers);assert.equal(result.answered,200);assert.ok(result.findings.length);assert.ok(result.predictionChecks>0);
  for(const f of result.findings)for(const e of [...f.support,...f.counter]){assert.ok(rounds.some(r=>r.id===e.roundId));for(const id of e.workIds)assert.ok(real.some(w=>w.id===id));}
});

test('A session pins the catalogue and all four path prefixes across collection expansion and resume',()=>{
  const original=prepareStudySession(null,real,10),first=sessionStudyRounds(original,50),shown=first[0];
  original.shown[shown.id]=snapshotStudyRound(shown);original.answers[shown.id]=answer(shown,[100,70,30,0]);
  const extra={...structuredClone(real[0]),id:'new-catalogue-artwork',title:'New catalogue work'},expanded=[...real,extra],resumed=prepareStudySession(JSON.parse(JSON.stringify(original)),expanded,20);
  assert.equal(resumed.manifest.id,original.manifest.id);assert.deepEqual(resumed.manifest.catalogueIds,original.manifest.catalogueIds);assert.equal(resumed.manifest.catalogueIds.includes(extra.id),false);
  assert.deepEqual(resumed.answers,original.answers);assert.deepEqual(resumed.shown,original.shown);
  const identity=r=>({id:r.id,works:r.works.map(w=>w.id),title:r.title,kind:r.kind,criterion:r.criterion,axis:r.axis});
  assert.deepEqual(sessionStudyRounds(resumed,50).map(identity),first.map(identity));
  for(const length of [50,100,150])assert.deepEqual(sessionStudyRounds(resumed,200).slice(0,length).map(identity),sessionStudyRounds(resumed,length).map(identity));
  const separate=prepareStudySession(null,expanded,30);assert.ok(separate.manifest.catalogueIds.includes(extra.id));assert.notEqual(separate.manifest.id,original.manifest.id);
});

test('Known production-v1 sessions adopt the original 27 references and preserve shown questions and raw answers',()=>{
  const first=buildStudyRounds(real,50)[0],snapshot=snapshotStudyRound(first);snapshot.evidence.bankRevision='art-study-200-v1';
  const raw={version:1,target:50,index:1,screen:'question',answers:{[first.id]:answer(first,[100,70,30,0]),'unmapped-answer':{original:'retain this'}},shown:{[first.id]:snapshot}};
  const extra={...structuredClone(real[0]),id:'new-art'},adopted=prepareStudySession(raw,[...real,extra],100);
  assert.equal(adopted.manifest.historicalPool,'known-production-v1-27');assert.equal(adopted.manifest.metadataProvenance,'adopted-current-metadata');assert.equal(adopted.manifest.catalogueIds.includes(extra.id),false);
  assert.deepEqual(adopted.shown,raw.shown);assert.deepEqual(adopted.answers,raw.answers);assert.deepEqual(adopted.plan[0],snapshot);
  const unknown=structuredClone(raw);unknown.shown[first.id].evidence.bankRevision='unknown-protocol';
  const uncertain=prepareStudySession(unknown,[...real,extra],110);assert.equal(uncertain.manifest.historicalPool,'unknown-at-adoption');assert.deepEqual(uncertain.shown,unknown.shown);
});

test('Actual shown definitions feed future check training without inserting unseen responses into the history',()=>{
  const state=prepareStudySession(null,real,10),base=sessionStudyRounds(state,200),prior=base.filter(r=>r.evidence?.construct==='preference'&&r.evidence.role==='discovery').slice(0,3);
  prior.forEach((r,index)=>{const actual={...r,works:real.slice(index*4,index*4+4)};state.shown[r.id]=snapshotStudyRound(actual);state.answers[r.id]=answer(actual,[0,30,70,100]);});
  const generated=sessionStudyRounds(state,200),check=generated.find(r=>r.evidence?.provisionalPrediction);
  assert.ok(check);for(const r of prior)assert.ok(check.evidence.trainingRoundIds.includes(r.id));
  const unshown=base.find(r=>r.evidence?.construct==='preference'&&r.evidence.role==='discovery'&&!prior.some(p=>p.id===r.id));state.answers[unshown.id]=answer(unshown,[100,70,30,0]);
  const after=sessionStudyRounds(state,200).find(r=>r.id===check.id);assert.equal(after.evidence.trainingRoundIds.includes(unshown.id),false);
  after.evidence.trainingAnswers=Object.fromEntries(after.evidence.trainingRoundIds.map(id=>[id,structuredClone(state.answers[id])]));state.shown[after.id]=snapshotStudyRound(after);
  const frozen=structuredClone(state.shown[after.id]);state.answers[prior[0].id].positions[prior[0].works[0].id]=100;
  assert.deepEqual(snapshotStudyRound(sessionStudyRounds(state,200).find(r=>r.id===after.id)),frozen);
});

test('Missing legacy artwork IDs stay unavailable with their exact records retained instead of receiving substitutes',()=>{
  const r=buildStudyRounds(real,50)[0],saved=snapshotStudyRound(r),rawAnswer=answer(r,[100,70,30,0]);saved.workIds[0]='unavailable-original-artwork';saved.evidence.bankRevision='art-study-200-v1';rawAnswer.workIds[0]='unavailable-original-artwork';
  const oldPosition=rawAnswer.positions[r.works[0].id];delete rawAnswer.positions[r.works[0].id];rawAnswer.positions['unavailable-original-artwork']=oldPosition;
  const raw={version:1,target:50,shown:{[r.id]:saved},answers:{[r.id]:rawAnswer}},adopted=prepareStudySession(raw,real,20),rounds=sessionStudyRounds(adopted,50);
  assert.ok(rounds[0].unavailable);assert.deepEqual(adopted.shown[r.id],saved);assert.deepEqual(adopted.answers[r.id],rawAnswer);assert.equal(analyzeStudy(adopted.manifest.catalogue,rounds,adopted.answers).answered,0);
  const later={...structuredClone(real[0]),id:'unavailable-original-artwork'},resumed=prepareStudySession(adopted,[...real,later],30);
  assert.ok(sessionStudyRounds(resumed,50)[0].unavailable);assert.deepEqual(resumed.answers[r.id],rawAnswer);
});

test('Captured descriptors and axis definitions cannot silently acquire a later meaning',()=>{
  const state=prepareStudySession(null,real,10),original=structuredClone(state.manifest.catalogue[0]),changed=structuredClone(real);changed[0].features.energy=1-original.features.energy;changed[0].image='assets/art/replacement.jpg';
  const resumed=prepareStudySession(state,changed,20);assert.deepEqual(resumed.manifest.catalogue[0],original);
  const round=sessionStudyRounds(state,50).find(r=>r.kind==='grid'),snapshot=snapshotStudyRound(round);snapshot.axisDefinition.left='A different question';state.shown[round.id]=snapshot;
  assert.ok(sessionStudyRounds(state,50).find(r=>r.id===round.id).unavailable);assert.equal(state.shown[round.id].axisDefinition.left,'A different question');
});

test('A pending pinned comparison keeps its artworks and drops a prediction when the binder returns another question',()=>{
  const state=prepareStudySession(null,real,10),index=state.plan.findIndex(r=>r.evidence?.family==='feature-check'),planned=state.plan[index],unused=real.find(w=>!planned.workIds.includes(w.id));
  planned.workIds[0]=unused.id;const resolved=sessionStudyRounds(state,200)[index];
  assert.deepEqual(resolved.works.map(w=>w.id),planned.workIds);assert.equal(resolved.evidence.provisionalPrediction,null);assert.match(resolved.evidence.prospectiveCheckUnavailable,/pinned question/);
});

test('Opposing comparisons inside a net-supporting set remain in feature evidence',()=>{
  const pool=works.map((w,index)=>({...w,features:{...w.features,energy:[0,.2,.7,1][index%4]}})),rounds=[0,1,2].map(index=>spectrum('inside-'+index,pool.slice(index*4,index*4+4),'preference','inside-'+index)),answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r,[0,50,100,60])]));
  const f=analyzeStudy(pool,rounds,answers).findings.find(f=>f.feature==='energy'&&f.direction===1);assert.ok(f);assert.ok(f.counter.length);assert.match(f.counter[0].detail,/inside an otherwise supporting set/);
});

test('An absent descriptor is excluded while a measured zero remains informative',()=>{
  const absent=works.map((w,index)=>({...w,features:{...w.features,energy:index%4<2?undefined:1}})),rounds=Array.from({length:3},(_,i)=>spectrum('missing-'+i,absent.slice(i*4,i*4+4),'preference','missing-'+i)),responses=Object.fromEntries(rounds.map(r=>[r.id,answer(r,[0,0,100,100])]));
  assert.equal(analyzeStudy(absent,rounds,responses).findings.some(f=>f.feature==='energy'),false);
  const measured=absent.map(w=>({...w,features:{...w.features,energy:w.features.energy??0}})),measuredRounds=rounds.map((r,i)=>({...r,works:measured.slice(i*4,i*4+4)}));assert.ok(analyzeStudy(measured,measuredRounds,responses).findings.some(f=>f.feature==='energy'));
});

test('A personal connection and reported uncertainty imply no temporal or causal sequence',()=>{
  const p=spectrum('pref',works.slice(0,2)),c=grid('connection',p.works,'connection'),result=analyzeStudy(works,[p,c],{pref:answer(p,[100,0]),connection:points(c,[[10,90],[90,10]])}),f=result.findings.find(f=>f.id==='study-connection');
  assert.ok(f);assert.doesNotMatch(f.title+' '+f.text,/preceded|came before|caused|came first/i);assert.match(f.text,/these responses/);
});
