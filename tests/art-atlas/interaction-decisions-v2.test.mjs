import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildRounds,validAnswer} from '../../public/art-atlas/engine.mjs';
import {CONTRAST_PROTOCOL,NEIGHBOUR_REASONS_PROTOCOL,buildContrastRound,validContrastAnswer,sanitizeContrastDraft,handleContrastAction,contrastAnswerSummary,renderContrastRound,upgradeActiveNeighbourRound,neighbourRelationshipLabels} from '../../public/art-atlas/contrast-rounds.mjs';
import {buildContrastReadings} from '../../public/art-atlas/contrast-readings.mjs';
import {DIFFICULT_EDIT_PROTOCOL,LEGACY_DIFFICULT_EDIT_PROTOCOL,createDifficultEditRecord,validDifficultEditDraft,validDifficultEdit,setDifficultEditRemoval,startDifficultEditComparison,chooseDifficultEditComparison,resetDifficultEditComparison,upgradeActiveDifficultEditRecord,analyzeDifficultEdit,difficultEditIds,createDifficultEdit} from '../../public/art-atlas/difficult-edit.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const image=work=>`<img data-artwork="${work.id}" src="${work.image}">`;
const neighbour=()=>buildContrastRound({works,id:'neighbour-v2',content:{status:'ready',contrastKind:'neighbour',contentId:'actual-five',title:'Which belongs beside this painting?',prompt:'Choose one connection.',hint:'Compare these four candidates.',workIds:works.slice(0,4).map(w=>w.id),anchorId:works[4].id,relationshipOptions:[{id:'colour',label:'Colour'},{id:'form',label:'Shapes'},{id:'story',label:'Subject or story'}],sourceUrls:works.slice(0,5).map(w=>w.sourceUrl)}});
const legacyNeighbour=()=>{const r=neighbour();r.evidence.protocol=CONTRAST_PROTOCOL;return r;};
const neighbourAnswer=(r,fields={})=>({...sanitizeContrastDraft(r),neighbourId:r.works[0].id,noGoodNeighbour:false,...fields,confirmed:true});
const makeEdit=(options={},baseline={})=>createDifficultEditRecord(works,baseline,[],{id:'single-edit',now:10,...options});
function legacyEdit(){const r=makeEdit();delete r.preferenceContext;delete r.preferenceSources;delete r.confirmed;return {...r,version:1,protocol:LEGACY_DIFFICULT_EDIT_PROTOCOL,alternativeRemovedId:null,comparisonBasis:null,compareChoice:null,comparisonOrder:['alternative','initial']};}
function selectedEdit(record=makeEdit()){const shown={...record,presentedIds:[...record.offeredIds]};return setDifficultEditRemoval(shown,shown.offeredIds[0],works);}
const finish=record=>({...record,confirmed:true,finishedAt:20});
function prior(record,{id='earlier-preference',index=2,positions}={}) {
  const round={id,kind:'spectrum',criterion:'preference',title:'How much do you prefer each painting?',hint:'Place all four on one scale. Equal positions are fine.',works:record.offeredIds.map(id=>structuredClone(works.find(w=>w.id===id))),evidence:{construct:'preference',family:'individual-choice',role:'discovery',unconditional:true}};
  const answer={workIds:round.works.map(w=>w.id),criterion:'preference',positions:positions||Object.fromEntries(round.works.map((w,i)=>[w.id,i===0?90:10])),confirmed:true};
  return {round,answer,index};
}
const capture=(sources,extra={})=>({preferenceContext:{roundId:'exercise-round',index:8},preferenceSources:sources,...extra});

test('New neighbours allow several toggled reasons and never silently preselect a label',()=>{
  const r=neighbour();assert.equal(r.evidence.protocol,NEIGHBOUR_REASONS_PROTOCOL);
  let a=handleContrastAction(r,sanitizeContrastDraft(r),'contrast-pick',{workId:r.works[0].id});
  assert.deepEqual(a.relationshipIds,[]);assert.equal(validContrastAnswer(r,{...a,confirmed:true}),false);
  a=handleContrastAction(r,a,'contrast-relationship',{relationshipId:'colour'});
  a=handleContrastAction(r,a,'contrast-relationship',{relationshipId:'form'});
  assert.deepEqual(a.relationshipIds,['colour','form']);assert.ok(validContrastAnswer(r,{...a,confirmed:true}));
  a=handleContrastAction(r,a,'contrast-relationship',{relationshipId:'colour'});
  assert.deepEqual(a.relationshipIds,['form']);assert.equal(a.confirmed,false);
  assert.deepEqual(neighbourRelationshipLabels(r,a),['Shapes']);
});

test('Changing a neighbour or choosing no good neighbour clears every reported reason',()=>{
  const r=neighbour(),a=neighbourAnswer(r,{relationshipIds:['colour','form']});
  const none=handleContrastAction(r,a,'contrast-none');
  assert.equal(none.neighbourId,null);assert.equal(none.noGoodNeighbour,true);assert.deepEqual(none.relationshipIds,[]);
  assert.ok(validContrastAnswer(r,{...none,confirmed:true}));
  const changed=handleContrastAction(r,a,'contrast-pick',{workId:r.works[1].id});
  assert.deepEqual(changed.relationshipIds,[]);assert.equal(validContrastAnswer(r,{...changed,confirmed:true}),false);
  assert.equal(validContrastAnswer(r,{...none,relationshipIds:['colour'],confirmed:true}),false);
});

test('V2 rejects duplicate, unknown, mixed-version and incomplete reasons',()=>{
  const r=neighbour(),a=neighbourAnswer(r,{relationshipIds:['form']});
  assert.ok(validContrastAnswer(r,a));
  for(const bad of [{...a,relationshipIds:['form','form']},{...a,relationshipIds:['invented']},{...a,relationshipIds:null},{...a,relationshipIds:[]},{...a,relationshipId:'form'},{...a,workIds:[...a.workIds].reverse()},{...a,confirmed:false}])assert.equal(validContrastAnswer(r,bad),false);
  const oldOnly={...a,relationshipId:'form'};delete oldOnly.relationshipIds;
  assert.deepEqual(sanitizeContrastDraft(r,oldOnly).relationshipIds,[],'An old singular field cannot silently answer a different saved instrument.');
});

test('Several labels describe one recorded pairing, not several pattern-support sets',()=>{
  const r=neighbour(),p=prior({offeredIds:r.works.map(w=>w.id)}),chosen=r.works[0].id,other=r.works[1].id;
  p.answer.positions[chosen]=10;p.answer.positions[other]=90;
  const one=neighbourAnswer(r,{relationshipIds:['form']}),two=neighbourAnswer(r,{relationshipIds:['form','colour']});
  const run=a=>buildContrastReadings({works,rounds:[p.round,r],answers:{[p.round.id]:p.answer,[r.id]:a}})[0];
  const a=run(one),b=run(two);
  assert.equal(b.supportingSetCount,1);assert.equal(a.supportingSetCount,b.supportingSetCount);
  assert.deepEqual(a.support.map(e=>e.roundId),b.support.map(e=>e.roundId));
  assert.equal(b.support.filter(e=>e.roundId===r.id).length,1);
  assert.match(b.support.find(e=>e.roundId===r.id).detail,/Reported connections: Shapes and Colour/);
  assert.match(b.text,/You named shapes and colour as connections/);
  assert.ok(b.alternatives.some(t=>t.includes('one pairing decision')));
  assert.deepEqual(buildContrastReadings({works,rounds:[r],answers:{[r.id]:two}}),[]);
});

test('A frozen v1 neighbour keeps its single-label validation, summary and reading without mutation',()=>{
  const r=legacyNeighbour(),a=neighbourAnswer(r,{relationshipId:'form'}),before=structuredClone({r,a});
  assert.ok(validContrastAnswer(r,a));assert.equal(validContrastAnswer(r,{...a,relationshipId:'unknown'}),false);
  const summary=contrastAnswerSummary(r,a);assert.equal(summary.relationshipId,'form');assert.equal(Object.hasOwn(summary,'relationshipIds'),false);
  const p=prior({offeredIds:r.works.map(w=>w.id)});p.answer.positions[r.works[0].id]=10;p.answer.positions[r.works[1].id]=90;
  const f=buildContrastReadings({works,rounds:[p.round,r],answers:{[p.round.id]:p.answer,[r.id]:a}})[0];
  assert.match(f.text,/You connected them through shapes/);assert.match(f.support[1].detail,/Reported connection: Shapes/);
  assert.equal(renderContrastRound(r,a,{image}).includes('Choose all that apply'),false);
  assert.equal(upgradeActiveNeighbourRound(r,a,{active:true,now:4}).changed,false);
  assert.deepEqual({r,a},before);
});

test('Only an active unconfirmed v1 neighbour can opt into plural reasons, with an exact archive',()=>{
  const r=legacyNeighbour(),a={...neighbourAnswer(r,{relationshipId:'colour'}),confirmed:false},before=structuredClone({r,a});
  assert.equal(upgradeActiveNeighbourRound(r,a).changed,false);
  const upgraded=upgradeActiveNeighbourRound(r,a,{active:true,now:40});
  assert.equal(upgraded.changed,true);assert.deepEqual(upgraded.draft.relationshipIds,['colour']);
  assert.equal(Object.hasOwn(upgraded.draft,'relationshipId'),false);assert.equal(upgraded.draft.confirmed,false);
  assert.ok(validContrastAnswer(upgraded.round,{...upgraded.draft,confirmed:true}));
  assert.deepEqual(upgraded.archive.question,before.r);assert.deepEqual(upgraded.archive.answer,before.a);assert.deepEqual({r,a},before);
  assert.equal(upgradeActiveNeighbourRound(r,{...a,skipped:true},{active:true}).changed,false);
  assert.equal(upgradeActiveNeighbourRound(r,{...a,workIds:[...a.workIds].reverse()},{active:true}).changed,false);
  assert.equal(upgradeActiveNeighbourRound(upgraded.round,upgraded.draft,{active:true}).changed,false);
  assert.match(renderContrastRound(upgraded.round,upgraded.draft,{image}),/Choose all that apply/);
});

test('The new edit needs one explicit removal and all four actual reproductions, then can finish directly',()=>{
  const r=makeEdit();assert.equal(r.version,2);assert.equal(r.protocol,DIFFICULT_EDIT_PROTOCOL);assert.ok(validDifficultEditDraft(r,works));
  assert.equal(validDifficultEdit(r,works,false),false);
  const selected=setDifficultEditRemoval(r,r.offeredIds[0],works);assert.equal(validDifficultEdit(selected,works,false),false);
  const ready={...selected,presentedIds:[...r.offeredIds]};assert.ok(validDifficultEdit(ready,works,false));assert.equal(validDifficultEdit(ready,works),false);
  assert.ok(validDifficultEdit(finish(ready),works));assert.equal(difficultEditIds(ready).length,3);
  for(const key of ['compareChoice','comparisonOrder','comparisonBasis','alternativeRemovedId'])assert.equal(Object.hasOwn(ready,key),false);
  assert.equal(startDifficultEditComparison(ready,works),ready);assert.equal(chooseDifficultEditComparison(ready,'initial',works),ready);assert.equal(resetDifficultEditComparison(ready,works),ready);
});

test('Without independent prior questions the new edit supplies only its exact decision ledger',()=>{
  const r=finish(selectedEdit()),f=analyzeDifficultEdit(works,r);
  assert.equal(f.length,1);assert.equal(f[0].readingBasis,'decision-ledger');assert.equal(f[0].pattern,false);
  assert.deepEqual(f[0].support[0].workIds,r.offeredIds);assert.equal(f[0].support[0].roundId,'scenario:'+r.id);
  assert.equal(/held up|alternative|consistent|why you|original edit/i.test(f.map(row=>row.title+' '+row.text).join(' ')),false);
  const oldRound=buildRounds(works,{})[0],legacyAnswers={preferenceRank:{workIds:oldRound.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(oldRound.works.map((w,i)=>[w.id,i?0:100])),confirmed:true}};
  assert.ok(validAnswer(oldRound,legacyAnswers.preferenceRank));
  assert.equal(analyzeDifficultEdit(works,finish(selectedEdit(makeEdit({},legacyAnswers)))).length,1,'Actual old values alone cannot supply the missing frozen earlier question.');
});

test('A new edit can connect an actual earlier complete preference with exact source IDs and preserved counterrelations',()=>{
  const seed=makeEdit(),p=prior(seed);p.answer.positions[seed.offeredIds[0]]=80;p.answer.positions[seed.offeredIds[2]]=100;
  const r=makeEdit(capture([p])),f=analyzeDifficultEdit(works,finish(selectedEdit(r)));
  const connection=f.find(row=>row.readingBasis==='matched-earlier-preference');assert.ok(connection);
  assert.equal(connection.support[0].roundId,p.round.id);assert.equal(connection.support[0].prompt,p.round.title);
  assert.deepEqual(connection.support[0].workIds,[r.offeredIds[0],r.offeredIds[1]]);
  assert.match(connection.support[0].detail,/80/);assert.match(connection.support[0].detail,/10/);
  assert.equal(connection.counter.length,1);assert.ok(connection.counter[0].workIds.includes(r.offeredIds[2]));
  assert.ok(connection.alternatives.some(t=>t.includes('do not establish why')));
  assert.equal(connection.comparisons[0].kind,'categorical-contrast');
  p.answer.positions[p.round.works[0].id]=0;p.round.title='Edited later';
  assert.equal(r.preferenceSources[0].answer.positions[r.offeredIds[0]],80);assert.notEqual(r.preferenceSources[0].round.title,p.round.title);
});

test('A four-work edit can capture an earlier full-catalogue source sharing only two paintings without changing its own offer',()=>{
  const seed=makeEdit(),quartet=seed.offeredIds.map(id=>works.find(w=>w.id===id)),outside=works.filter(w=>!seed.offeredIds.includes(w.id)).slice(0,2);
  const p=prior({offeredIds:[seed.offeredIds[0],seed.offeredIds[1],...outside.map(w=>w.id)]});
  const options={id:'quartet-only',now:10,...capture([p]),preferenceCatalogue:works};
  const r=createDifficultEditRecord(quartet,{},[],options);
  assert.deepEqual([...r.offeredIds].sort(),[...seed.offeredIds].sort());assert.ok(validDifficultEditDraft(r,quartet));
  assert.equal(r.preferenceSources.length,1);assert.equal(r.preferenceSources[0].round.works.length,4);
  assert.deepEqual(r.preferenceSources[0].round.works.map(w=>w.id),p.answer.workIds);
  assert.equal(Object.hasOwn(r,'preferenceCatalogue'),false,'The full catalogue validates the capture; it is not duplicated inside the exercise.');
  const complete=finish(selectedEdit(r)),connection=analyzeDifficultEdit(works,complete).find(f=>f.readingBasis==='matched-earlier-preference');
  assert.ok(connection);assert.equal(connection.support[0].roundId,p.round.id);
  assert.deepEqual(connection.support[0].workIds,seed.offeredIds.slice(0,2));
  assert.deepEqual(connection.support[0].sourceWorkIds,p.answer.workIds);
  assert.equal(analyzeDifficultEdit(quartet,complete).length,1,'An analyser without the full source catalogue cannot invent the missing source identities.');
  const migrated=upgradeActiveDifficultEditRecord(selectedEdit(legacyEdit()),quartet,{active:true,now:30,...capture([p]),preferenceCatalogue:works});
  assert.equal(migrated.changed,true);assert.equal(migrated.record.preferenceSources.length,1);
  assert.ok(analyzeDifficultEdit(works,finish(migrated.record)).some(f=>f.readingBasis==='matched-earlier-preference'));
});

test('The full preference catalogue must match every offered painting and each complete source identity',()=>{
  const seed=makeEdit(),quartet=seed.offeredIds.map(id=>works.find(w=>w.id===id)),outside=works.filter(w=>!seed.offeredIds.includes(w.id)).slice(0,2);
  const p=prior({offeredIds:[seed.offeredIds[0],seed.offeredIds[1],...outside.map(w=>w.id)]}),bad=[];
  for(const key of ['title','artist','image','sourceUrl']){const catalogue=structuredClone(works);catalogue.find(w=>w.id===seed.offeredIds[3])[key]='Changed '+key;bad.push(catalogue);}
  bad.push(works.filter(w=>w.id!==seed.offeredIds[3]));
  bad.push([...works,structuredClone(quartet[3])]);
  bad.push([...works,structuredClone(outside[0])]);
  const changedOutside=structuredClone(works);changedOutside.find(w=>w.id===outside[0].id).image='different-source.jpg';bad.push(changedOutside);
  bad.push(null,{});
  for(const catalogue of bad){
    const options={id:'guarded-quartet',now:10,...capture([p]),preferenceCatalogue:catalogue};
    const r=createDifficultEditRecord(quartet,{},[],options);assert.ok(validDifficultEditDraft(r,quartet));assert.deepEqual(r.preferenceSources,[]);
    assert.equal(analyzeDifficultEdit(works,finish(selectedEdit(r))).length,1);
    const migration=upgradeActiveDifficultEditRecord(selectedEdit(legacyEdit()),quartet,{active:true,now:30,...capture([p]),preferenceCatalogue:catalogue});
    assert.equal(migration.changed,true);assert.deepEqual(migration.record.preferenceSources,[]);
  }
});

test('Incomplete, contextual, future, self, duplicate, changed-identity and unconfirmed sources cannot manufacture an edit exception',()=>{
  const r=makeEdit(),p=prior(r),bad=[];
  const copy=fn=>{const a=structuredClone(p);fn(a);bad.push(a);};
  copy(a=>{delete a.answer.positions[r.offeredIds[1]];});
  copy(a=>{a.answer.positions[r.offeredIds[1]]=null;});
  copy(a=>{a.answer.confirmed=false;});
  copy(a=>{a.round.evidence.unconditional=false;});
  copy(a=>{a.round.evidence.construct='attention-to-making';});
  copy(a=>{a.round.evidence.repeatOf='prior';a.round.evidence.role='repeat';});
  copy(a=>{a.index=8;});
  copy(a=>{a.round.id='exercise-round';});
  copy(a=>{a.round.id='';});
  copy(a=>{a.round.works[0].image='replacement.jpg';});
  for(const source of bad){const record=finish(selectedEdit(makeEdit(capture([source]))));assert.equal(analyzeDifficultEdit(works,record).length,1);}
  const duplicate=finish(selectedEdit(makeEdit(capture([p,structuredClone(p)]))));assert.equal(analyzeDifficultEdit(works,duplicate).length,1);
  const sameIndex=structuredClone(p);sameIndex.round.id='another-id';
  assert.equal(analyzeDifficultEdit(works,finish(selectedEdit(makeEdit(capture([p,sameIndex]))))).length,1);
});

test('The latest valid earlier pair source prevents cherry-picking an older edit reversal',()=>{
  const r=makeEdit(),first=prior(r,{index:1}),last=prior(r,{id:'later-preference',index:6,positions:Object.fromEntries(r.offeredIds.map((id,i)=>[id,i?100:0]))});
  assert.equal(analyzeDifficultEdit(works,finish(selectedEdit(makeEdit(capture([first,last]))))).length,1);
});

test('Legacy compare phase and completed v1 readings remain intact; only the active edit phase can migrate',()=>{
  const old=legacyEdit(),edited=selectedEdit(old),before=structuredClone(edited);
  assert.equal(upgradeActiveDifficultEditRecord(edited,works).changed,false);
  const migration=upgradeActiveDifficultEditRecord(edited,works,{active:true,now:30});
  assert.equal(migration.changed,true);assert.ok(validDifficultEdit(migration.record,works,false));assert.equal(migration.record.removedId,edited.removedId);
  assert.deepEqual(migration.archive.record,before);assert.deepEqual(edited,before);
  const comparing=startDifficultEditComparison(edited,works),complete=finish(chooseDifficultEditComparison(comparing,'initial',works));
  assert.ok(validDifficultEdit(complete,works));const reading=analyzeDifficultEdit(works,complete);assert.match(reading[0].title,/original edit held up/);
  for(const record of [comparing,complete]){const snapshot=structuredClone(record);assert.equal(upgradeActiveDifficultEditRecord(record,works,{active:true}).changed,false);assert.deepEqual(record,snapshot);}
});

test('V2 rejects disguised legacy comparison fields and invalid identities rather than treating them as a completed single edit',()=>{
  const r=finish(selectedEdit());
  for(const bad of [{...r,phase:'compare'},{...r,compareChoice:'initial'},{...r,comparisonOrder:['initial','alternative']},{...r,alternativeRemovedId:null},{...r,presentedIds:r.presentedIds.slice(1)},{...r,offeredIds:[r.offeredIds[0],r.offeredIds[0],...r.offeredIds.slice(2)]},{...r,protocol:LEGACY_DIFFICULT_EDIT_PROTOCOL}])assert.equal(validDifficultEdit(bad,works),false);
  assert.deepEqual(analyzeDifficultEdit(works,{...r,confirmed:false}),[]);
});

test('New markup has one finish path and no wall comparison while a frozen v1 comparison still renders both walls',()=>{
  const render=record=>createDifficultEdit({app:{querySelector(){return null;},addEventListener(){}},getRecord:()=>record,setRecord(){},getWorks:()=>works,image,esc:String,save(){},rerender(){},inspect(){}}).markup();
  const single=render(selectedEdit());assert.match(single,/data-action="lab-finish"/);assert.equal(single.includes('data-action="difficult-compare"'),false);assert.equal(single.includes('Wall A'),false);assert.equal(single.includes('01 / 02'),false);
  const old=render(startDifficultEditComparison(selectedEdit(legacyEdit()),works));assert.match(old,/Wall A/);assert.match(old,/Wall B/);assert.match(old,/02 \/ 02/);
});
