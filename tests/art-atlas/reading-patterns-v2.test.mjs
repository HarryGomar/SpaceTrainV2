import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRefinedReadings} from '../../public/art-atlas/reading-patterns-v2.mjs';

const definitions={
  achievement:{xName:'Personal appeal',yName:'Admiration of making',left:'Not for me',right:'For me',bottom:'Little to admire',top:'Much to admire'},
  reading:{xName:'Scene clarity',yName:'Interpretive openness',left:'Unclear scene',right:'Clear scene',bottom:'One reading',top:'Several readings'},
  returnResponse:{xName:'Felt tension',yName:'Wish to return',left:'Comforting',right:'Unsettling',bottom:'Once is enough',top:'Would return'}
};
const constructs={achievement:'perceived-achievement',reading:'scene-and-meaning',returnResponse:'tension-and-return'};
function fixture(){
  const works=Array.from({length:12},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,sourceUrl:'https://museum.example/'+i}));
  const grid=(id,axis,indexes=[0,1,2,3],extra={})=>({id,kind:'grid',axis,title:id,works:indexes.map(i=>works[i]),axisDefinition:structuredClone(definitions[axis]),evidence:{construct:constructs[axis],role:'check',...extra}});
  const preference=(id,indexes=[0,1,2,3],extra={})=>({id,kind:'spectrum',criterion:'preference',title:'Choose by preference.',works:indexes.map(i=>works[i]),evidence:{construct:'preference',family:'individual-choice',role:'discovery',...extra}});
  const choice=(id,mode,indexes=works.map((_,i)=>i),extra={})=>({id,kind:'choice-grid',selectionMode:mode,title:id,works:indexes.map(i=>works[i]),...(mode==='shortlist'?{maxChoices:3}:{}),evidence:{role:'check',...extra}});
  const gridAnswer=(r,values)=>({workIds:r.works.map(w=>w.id),axis:r.axis,points:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true});
  const preferenceAnswer=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true});
  const choiceAnswer=(r,selected=[],extra={})=>({workIds:r.works.map(w=>w.id),selectionMode:r.selectionMode,selectedIds:selected,explicitNone:!selected.length,unsure:false,confirmed:true,...extra});
  return {works,grid,preference,choice,gridAnswer,preferenceAnswer,choiceAnswer};
}
const find=(input,id)=>buildRefinedReadings(input).find(item=>item.id===id);

test('A matched map uses the latest real preference, retaining repeat dependence and one set count',()=>{
  const f=fixture(),first=f.preference('first'),repeat=f.preference('repeat',[0,1,2,3],{repeatOf:'first',role:'repeat'}),map=f.grid('admire','achievement'),laterMap=f.grid('again','achievement',[0,1,2,3],{repeatOf:'admire'});
  const answers={first:f.preferenceAnswer(first,[95,5,50,50]),repeat:f.preferenceAnswer(repeat,[5,95,50,50]),admire:f.gridAnswer(map,[[90,90],[10,10],[50,50],[50,50]]),again:f.gridAnswer(laterMap,[[90,90],[10,10],[50,50],[50,50]])};
  const reading=find({works:f.works,rounds:[first,repeat,map,laterMap],answers},'refined-achievement');
  assert.equal(reading.readingBasis,'matched-preference');assert.equal(reading.comparisons[0].preferenceRoundId,'repeat');assert.equal(reading.supportingSetCount,1);
  assert.ok(reading.support.some(item=>item.roundId==='repeat'&&item.sourceRole==='repeated response'));assert.deepEqual(reading.comparisons[0].measures[0].values,[95,5]);
});

test('A valid unconditional probe can be a dependent matched source without becoming a discovery set',()=>{
  const f=fixture(),probe=f.preference('probe',[0,1,2,3],{role:'probe'}),map=f.grid('scene','reading'),answers={probe:f.preferenceAnswer(probe,[95,5,50,50]),scene:f.gridAnswer(map,[[90,90],[85,10],[50,50],[50,50]])};
  const reading=find({works:f.works,rounds:[probe,map],answers},'refined-reading');assert.equal(reading.supportingSetCount,1);assert.ok(reading.support.some(item=>item.roundId==='probe'&&item.sourceRole==='probe'));
});

test('Admiration links to the earlier preference question without substituting later grid appeal',()=>{
  const f=fixture(),p=f.preference('p'),r=f.grid('admire','achievement'),answers={p:f.preferenceAnswer(p,[95,5,50,50]),admire:f.gridAnswer(r,[[10,10],[90,90],[50,50],[50,50]])};
  const finding=find({works:f.works,rounds:[p,r],answers},'refined-achievement');
  assert.equal(finding.readingBasis,'matched-preference');assert.match(finding.title,/admired paintings you preferred less/);
  assert.deepEqual(finding.comparisons[0].workIds,['w0','w1']);assert.deepEqual(finding.comparisons[0].measures.map(item=>[item.key,item.values]),[['preference',[95,5]],['admiration',[10,90]]]);
  assert.deepEqual(finding.support.map(item=>item.roundId),['p','admire']);assert.equal(finding.comparisons[0].preferenceRoundId,'p');
  assert.equal(find({works:f.works,rounds:[r,p],answers},'refined-achievement'),undefined,'A future preference cannot become earlier evidence');
});

test('An appraisal-only separation is labelled separately from an ordinary preference conflict',()=>{
  const f=fixture(),p=f.preference('p'),r=f.grid('admire','achievement'),answers={p:f.preferenceAnswer(p,[5,95,50,50]),admire:f.gridAnswer(r,[[90,10],[10,90],[50,50],[50,50]])};
  const finding=find({works:f.works,rounds:[p,r],answers},'refined-achievement');
  assert.equal(finding.readingBasis,'grid-only');assert.doesNotMatch(finding.title,/preferred less/);assert.deepEqual(finding.comparisons[0].measures.map(item=>item.key),['appeal','admiration']);assert.deepEqual(finding.support.map(item=>item.roundId),['admire']);
});

test('Empty, partial and invalid outer inputs do not manufacture readings',()=>{
  assert.deepEqual(buildRefinedReadings(),[]);assert.deepEqual(buildRefinedReadings({works:null}),[]);assert.deepEqual(buildRefinedReadings({answers:[]}),[]);
  const f=fixture(),r=f.grid('a','achievement'),answer=f.gridAnswer(r,[[90,10],[10,90],[60,60],[30,30]]);
  for(const mutate of [a=>delete a.points.w0,a=>a.confirmed=false,a=>a.skipped=true,a=>a.axis='response',a=>a.points.w0=[null,90],a=>a.points.w0=[NaN,90],a=>a.points.w0=[90.5,90],a=>a.points.extra=[20,20],a=>a.workIds.reverse()]){
    const copy=structuredClone(answer);mutate(copy);assert.deepEqual(buildRefinedReadings({works:f.works,rounds:[r],answers:{a:copy}}),[]);
  }
});

test('Appeal and admiration reversals retain separate coordinates and exact evidence',()=>{
  const f=fixture(),r=f.grid('a','achievement'),input={works:f.works,rounds:[r],answers:{a:f.gridAnswer(r,[[90,10],[10,90],[70,70],[30,30]])}},finding=find(input,'refined-achievement');
  assert.ok(finding);assert.equal(finding.supportingSetCount,1);assert.match(finding.text,/local comparison/);
  assert.deepEqual(finding.comparisons[0].workIds,['w0','w1']);
  assert.deepEqual(finding.comparisons[0].measures,[{key:'appeal',label:'Personal appeal',values:[90,10]},{key:'admiration',label:'Admiration of making',values:[10,90]}]);
  assert.equal(finding.support[0].roundId,'a');assert.equal(finding.support[0].role,'check');assert.equal(finding.support[0].sourceRole,'reported appraisal');
  assert.match(finding.alternatives.join(' '),/not added as an unconditional preference/);assert.ok(finding.counter.length);
});

test('Different set labels and repeated maps do not inflate support counts',()=>{
  const f=fixture(),first=f.grid('a','achievement'),repeat=f.grid('again','achievement',[3,2,1,0],{repeatOf:'a',role:'repeat'}),second=f.grid('b','achievement',[4,5,6,7]);
  const rounds=[first,repeat,second],answers={a:f.gridAnswer(first,[[90,10],[10,90],[50,50],[50,50]]),again:f.gridAnswer(repeat,[[50,50],[50,50],[10,90],[90,10]]),b:f.gridAnswer(second,[[90,10],[10,90],[50,50],[50,50]])};
  const reading=find({works:f.works,rounds,answers},'refined-achievement');assert.equal(reading.supportingSetCount,2);assert.equal(reading.support.length,2);
  assert.match(reading.text,/2 distinct artwork sets/);
});

test('A later opposing map can qualify as counterevidence without another supporting set',()=>{
  const f=fixture(),first=f.grid('a','achievement'),later=f.grid('again','achievement',[0,1,2,3],{repeatOf:'a',role:'repeat'}),answers={a:f.gridAnswer(first,[[90,10],[10,90],[50,50],[50,50]]),again:f.gridAnswer(later,[[90,90],[10,10],[50,50],[50,50]])};
  const reading=find({works:f.works,rounds:[first,later],answers},'refined-achievement');assert.equal(reading.supportingSetCount,1);assert.ok(reading.counter.some(item=>item.roundId==='again'&&item.sourceRole==='repeated response'));
});

test('Legacy axes, changed definitions and changed constructs cannot become new appraisals',()=>{
  const f=fixture(),base=f.grid('a','achievement'),answer=f.gridAnswer(base,[[90,10],[10,90],[50,50],[50,50]]);
  for(const round of [{...base,axis:'response'},{...base,evidence:{construct:'preference'}},{...base,axisDefinition:{...definitions.achievement,left:'Unpleasant'}},{...base,axisDefinition:{...definitions.returnResponse}}])assert.deepEqual(buildRefinedReadings({works:f.works,rounds:[round],answers:{a:answer}}),[]);
  const response=f.grid('a','returnResponse');response.axis='response';response.evidence.construct='tension-and-return';assert.deepEqual(buildRefinedReadings({works:f.works,rounds:[response],answers:{a:{...answer,axis:'response'}}}),[]);
});

test('Scene clarity and openness connect to unconditional preference on exactly the same set',()=>{
  const f=fixture(),p=f.preference('p'),r=f.grid('scene','reading',[3,2,1,0]),answers={p:f.preferenceAnswer(p,[95,5,60,50]),scene:f.gridAnswer(r,[[50,50],[50,50],[85,10],[90,90]])};
  const finding=find({works:f.works,rounds:[p,r],answers},'refined-reading');assert.ok(finding);assert.equal(finding.patternVariant,'open-clear');
  assert.deepEqual(finding.support.map(item=>item.roundId),['p','scene']);assert.deepEqual(finding.comparisons[0].workIds,['w0','w1']);
  assert.deepEqual(finding.comparisons[0].measures.map(item=>[item.key,item.values]),[['preference',[95,5]],['clarity',[90,85]],['openness',[90,10]]]);
  const wrong=f.grid('scene','reading',[4,5,6,7]);assert.equal(find({works:f.works,rounds:[p,wrong],answers:{...answers,scene:f.gridAnswer(wrong,[[90,90],[85,10],[50,50],[50,50]])}},'refined-reading'),undefined);
});

test('The two scene tradeoffs preserve what was clearer and what was preferred',()=>{
  const f=fixture(),p=f.preference('p'),r=f.grid('scene','reading');
  const input={works:f.works,rounds:[p,r],answers:{p:f.preferenceAnswer(p,[95,5,50,50]),scene:f.gridAnswer(r,[[20,90],[90,20],[50,50],[50,50]])}};
  let finding=find(input,'refined-reading');assert.equal(finding.patternVariant,'open-less-clear');assert.match(finding.text,/Painting 1 was clearer/);
  input.answers.scene=f.gridAnswer(r,[[90,20],[20,90],[50,50],[50,50]]);finding=find(input,'refined-reading');assert.equal(finding.patternVariant,'clear-less-open');assert.match(finding.text,/clearer but with fewer/);
});

test('Grid appeal and contextual or curiosity numbers cannot substitute for ordinary preference',()=>{
  const f=fixture(),r=f.grid('scene','reading'),p=f.preference('p'),answer=f.gridAnswer(r,[[90,90],[85,10],[50,50],[50,50]]),pref=f.preferenceAnswer(p,[95,5,50,50]);
  for(const wrong of [{...p,criterion:'interest',evidence:{construct:'curiosity'}},{...p,evidence:{construct:'preference',family:'contextual-choice'}},{...p,anchorWorks:[f.works[8]]},{...p,evidence:{construct:'preference',family:'individual-choice',unconditional:false}}])assert.equal(find({works:f.works,rounds:[wrong,r],answers:{p:{...pref,criterion:wrong.criterion},scene:answer}},'refined-reading'),undefined);
  const appeal=f.grid('appeal','achievement');assert.equal(find({works:f.works,rounds:[appeal,r],answers:{appeal:f.gridAnswer(appeal,[[95,5],[5,95],[50,50],[50,50]]),scene:answer}},'refined-reading'),undefined);
});

test('Return to an unsettling work remains intention and can conflict with ordinary preference',()=>{
  const f=fixture(),p=f.preference('p'),r=f.grid('return','returnResponse'),input={works:f.works,rounds:[p,r],answers:{p:f.preferenceAnswer(p,[5,95,50,50]),return:f.gridAnswer(r,[[90,90],[10,20],[50,50],[50,50]])}};
  const finding=find(input,'refined-return');assert.ok(finding);assert.match(finding.title,/revisit paintings you preferred less/);assert.match(finding.text,/preferred Painting 1/);
  assert.deepEqual(finding.support.map(item=>item.roundId),['p','return']);assert.deepEqual(finding.comparisons[0].measures.map(item=>item.key),['preference','tension','return']);
  assert.match(finding.alternatives.join(' '),/stated intention/);assert.match(finding.alternatives.join(' '),/No return visit/);
});

test('Return comparisons work without preference but do not infer a split or actual visit',()=>{
  const f=fixture(),r=f.grid('return','returnResponse'),answers={return:f.gridAnswer(r,[[90,90],[10,20],[50,50],[50,50]])},finding=find({works:f.works,rounds:[r],answers},'refined-return');
  assert.ok(finding);assert.equal(finding.support.length,1);assert.deepEqual(finding.comparisons[0].measures.map(item=>item.key),['tension','return']);assert.match(finding.text,/intention reported/);
  answers.return=f.gridAnswer(r,[[90,20],[10,90],[50,50],[50,50]]);assert.equal(find({works:f.works,rounds:[r],answers},'refined-return'),undefined);
});

test('A shuffled shortlist links categorical selections to the exact earlier familiarity grid',()=>{
  const f=fixture(),fam=f.choice('fam','familiarity'),keep=f.choice('keep','shortlist',[11,10,9,8,7,6,5,4,3,2,1,0],{familiarityRoundId:'fam'}),answers={fam:f.choiceAnswer(fam,['w0','w1','w2','w3']),keep:f.choiceAnswer(keep,['w0','w6','w9'])};
  const reading=find({works:f.works,rounds:[fam,keep],answers},'refined-familiarity');assert.ok(reading);assert.match(reading.text,/2 were not marked familiar/);assert.equal(reading.supportingSetCount,1);
  assert.deepEqual(reading.support.map(item=>item.roundId),['fam','keep']);assert.deepEqual(reading.comparisons[0].selectedMarkedFamiliarIds,['w0']);assert.deepEqual(reading.comparisons[0].selectedNotMarkedFamiliarIds,['w6','w9']);assert.deepEqual(reading.comparisons[0].measures,[]);
  assert.match(reading.alternatives.join(' '),/Unselected works are not disliked/);assert.match(reading.alternatives.join(' '),/not proof that a work was never seen/);assert.match(reading.alternatives.join(' '),/familiarity caused/);
});

test('An explicit familiarity None supports unmarked wording; unsure or missing linkage suppresses it',()=>{
  const f=fixture(),fam=f.choice('fam','familiarity'),keep=f.choice('keep','shortlist',undefined,{familiarityRoundId:'fam'}),base={works:f.works,rounds:[fam,keep],answers:{fam:f.choiceAnswer(fam),keep:f.choiceAnswer(keep,['w6'])}};
  assert.match(find(base,'refined-familiarity').text,/1 was not marked familiar/);
  const unsure=structuredClone(base);unsure.answers.fam={...unsure.answers.fam,explicitNone:false,unsure:true};assert.equal(find(unsure,'refined-familiarity'),undefined);
  const missing=structuredClone(base);delete missing.rounds[1].evidence.familiarityRoundId;assert.equal(find(missing,'refined-familiarity'),undefined);
  assert.equal(find({...base,rounds:[keep,fam]},'refined-familiarity'),undefined);
});

test('Shortlist caps, confirmation, flags and membership fail closed',()=>{
  const f=fixture(),fam=f.choice('fam','familiarity'),keep=f.choice('keep','shortlist',undefined,{familiarityRoundId:'fam'}),base={works:f.works,rounds:[fam,keep],answers:{fam:f.choiceAnswer(fam,['w0']),keep:f.choiceAnswer(keep,['w1','w2','w3'])}};
  for(const mutate of [x=>x.answers.keep.selectedIds.push('w4'),x=>x.answers.keep.selectedIds=['w1','w1'],x=>x.answers.keep.selectedIds=['missing'],x=>x.answers.keep.explicitNone=true,x=>x.answers.keep.unsure=true,x=>delete x.answers.keep.explicitNone,x=>x.answers.keep.confirmed=false,x=>x.answers.fam.confirmed=false,x=>x.answers.keep.workIds.reverse(),x=>x.rounds[1].maxChoices=x.rounds[1].works.length+1]){
    const input=structuredClone(base);mutate(input);assert.equal(find(input,'refined-familiarity'),undefined);
  }
  const none=structuredClone(base);none.answers.keep=f.choiceAnswer(keep);assert.equal(find(none,'refined-familiarity'),undefined);
});

test('Same-offered-set copies do not inflate matched shortlist counts',()=>{
  const f=fixture(),fam=f.choice('fam','familiarity'),one=f.choice('keep','shortlist',undefined,{familiarityRoundId:'fam'}),two={...one,id:'again'},answers={fam:f.choiceAnswer(fam,['w0']),keep:f.choiceAnswer(one,['w0','w1']),again:f.choiceAnswer(two,['w2','w3'])};
  const reading=find({works:f.works,rounds:[fam,one,two],answers},'refined-familiarity');assert.equal(reading.supportingSetCount,1);assert.equal(reading.comparisons.length,1);
});

test('Ambiguous artwork or round identities reject both affected sources',()=>{
  const f=fixture(),r=f.grid('a','achievement'),answers={a:f.gridAnswer(r,[[90,10],[10,90],[50,50],[50,50]])};
  assert.deepEqual(buildRefinedReadings({works:f.works,rounds:[r,structuredClone(r)],answers}),[]);
  assert.deepEqual(buildRefinedReadings({works:[...f.works,structuredClone(f.works[0])],rounds:[r],answers}),[]);
  const missing={...r,works:[{id:'missing'},...r.works.slice(1)]};assert.deepEqual(buildRefinedReadings({works:f.works,rounds:[missing],answers}),[]);
});

test('The builder is pure and all findings retain resolvable roles and comparisons',()=>{
  const f=fixture(),a=f.grid('a','achievement'),p=f.preference('p'),r=f.grid('scene','reading'),back=f.grid('return','returnResponse'),input={works:f.works,rounds:[a,p,r,back],answers:{a:f.gridAnswer(a,[[90,10],[10,90],[50,50],[50,50]]),p:f.preferenceAnswer(p,[95,5,50,50]),scene:f.gridAnswer(r,[[90,90],[85,10],[50,50],[50,50]]),return:f.gridAnswer(back,[[90,90],[10,20],[50,50],[50,50]])}},copy=structuredClone(input),findings=buildRefinedReadings(input);
  assert.deepEqual(input,copy);assert.equal(findings.length,3);
  for(const item of findings){assert.ok(item.sourceUrls.length);for(const evidence of [...item.support,...item.counter]){assert.ok(input.rounds.some(round=>round.id===evidence.roundId));assert.ok(evidence.role);assert.ok(evidence.sourceRole);assert.ok(evidence.workIds.every(id=>input.works.some(work=>work.id===id)));}for(const comparison of item.comparisons)for(const measure of comparison.measures)assert.equal(measure.values.length,comparison.workIds.length);}
});
