import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRounds, buildProfile, FEATURES } from '../../public/art-atlas/engine.mjs';
import { createScenario, validScenario, validScenarioDraft, validArrangement, moveToSlot, SLOT_IDS, selectedIds, groupingEvidence, analyzeScenarios, upgradeEmptyExhibition, resetRoomResponses, hasRoomBriefs } from '../../public/art-atlas/scenarios.mjs';
import { museumMatches } from '../../public/art-atlas/museums.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
function exhibition(pool=works,baseline={}) {
  let r=createScenario('curate',pool,baseline,[],{id:'exhibition-one',now:1,legacy:true});
  for(let i=0;i<6;i++)r=moveToSlot(r,r.offeredIds[i],SLOT_IDS[i]);
  return {...r,presentedIds:[...r.offeredIds],phase:'walkthrough',roomStep:1,roomResponses:{lastMinutes:'study',guest:'opening'},confirmed:true,finishedAt:2};
}
function preference(pool=works) {const r=buildRounds(pool)[0];return {workIds:r.works.map(w=>w.id),criterion:'preference',confirmed:true,positions:Object.fromEntries(r.works.map((w,i)=>[w.id,[100,70,40,0][i]]))};}

test('Adding international works cannot change an existing quiz round or its chosen artworks',()=>{
  const core=works.filter(w=>w.coreQuiz!==false),a={preferenceRank:preference()};
  assert.deepEqual(buildRounds(works,a).map(r=>r.works.map(w=>w.id)),buildRounds(core,a).map(r=>r.works.map(w=>w.id)));
});
test('An exhibition offers twelve distinct works with two cleared Mexican paintings and missing placements',()=>{
  const r=createScenario('curate',works,{},[],{id:'draft',legacy:true});
  assert.equal(r.offeredIds.length,12);assert.equal(new Set(r.offeredIds).size,12);
  assert.ok(r.offeredIds.filter(id=>works.find(w=>w.id===id).country==='Mexico').length>=2);
  assert.equal(Object.keys(r.layout).length,0);assert.equal(r.presentedIds.length,4);assert.ok(validScenarioDraft(r,works));assert.equal(validScenario(r,works,false),false);
});
test('All three groups must be presented before omissions can support a completed exhibition',()=>{
  const complete=exhibition(),draft={...complete,presentedIds:complete.offeredIds.slice(0,8)};
  assert.equal(validScenario(draft,works),false);assert.equal(analyzeScenarios(works,[draft]).findings.length,0);
  assert.ok(validScenario(complete,works));
});
test('Moving an already hung work swaps occupants and never duplicates a painting',()=>{
  const r=exhibition(),old=structuredClone(r),a=r.layout.r1a,b=r.layout.r1b,next=moveToSlot(r,a,'r1b');
  assert.equal(next.layout.r1a,b);assert.equal(next.layout.r1b,a);assert.equal(new Set(selectedIds(next)).size,6);assert.deepEqual(r,old);assert.equal(next.confirmed,false);
  assert.equal(validScenario(next,works),false);assert.ok(validArrangement(next,works));assert.deepEqual(next.roomResponses,{});assert.equal(validScenario(next,works,false),false);
});
test('Malformed layouts and unknown artwork identities do not become evidence',()=>{
  const r=exhibition();r.layout.r2a=r.layout.r1a;assert.equal(validScenario(r,works),false);
  r.layout.r2a='invented';assert.equal(validScenarioDraft(r,works),false);assert.deepEqual(analyzeScenarios(works,[r]).findings,[]);
});
test('Grouping compares the actual three pairs with all fifteen pairings of those same six works',()=>{
  const values=[0,.05,.45,.5,.95,1],pool=works.map((w,i)=>({...w,features:Object.fromEntries(FEATURES.map(k=>[k,k==='energy'?(values[i]??.5):.5]))}));
  let r=exhibition(pool);r.offeredIds=pool.slice(0,12).map(w=>w.id);r.presentedIds=[...r.offeredIds];r.layout=Object.fromEntries(SLOT_IDS.map((slot,i)=>[slot,pool[i].id]));
  const e=groupingEvidence(pool,r).find(d=>d.key==='energy');assert.equal(e.pairCount,15);assert.equal(e.similarRank,1);
  const f=analyzeScenarios(pool,[r]).findings.find(f=>f.feature==='energy');assert.ok(f);assert.match(f.title,/Similar/);assert.match(f.alternatives.join(' '),/not a significance test/);
  assert.equal(f.support.length,3);for(const item of f.support)assert.equal(item.workIds.length,2);
});
test('Leaving an earlier favourite out describes exhibition fit, and only if that work was offered',()=>{
  const baseline={preferenceRank:preference()},first=baseline.preferenceRank.workIds[0],second=baseline.preferenceRank.workIds[1];
  let r=exhibition(works,baseline);const kept=[second,...r.offeredIds.filter(id=>id!==first&&id!==second).slice(0,5)];r.layout=Object.fromEntries(SLOT_IDS.map((slot,i)=>[slot,kept[i]]));
  let f=analyzeScenarios(works,[r]).findings.find(f=>f.id.endsWith('-omission'));assert.ok(f);assert.match(f.alternatives.join(' '),/Omission is not treated as dislike/);
  const replacement=works.find(w=>!r.offeredIds.includes(w.id));r.offeredIds=r.offeredIds.map(id=>id===first?replacement.id:id);r.presentedIds=[...r.offeredIds];
  assert.ok(validScenario(r,works));assert.equal(analyzeScenarios(works,[r]).findings.some(f=>f.id.endsWith('-omission')),false);
});
test('The same selected works can support a changed grouping without a claimed change in taste',()=>{
  const a=exhibition(),b={...structuredClone(a),id:'exhibition-two',finishedAt:3};[b.layout.r1b,b.layout.r2a]=[b.layout.r2a,b.layout.r1b];
  const f=analyzeScenarios(works,[a,b]).findings.find(f=>f.id.endsWith('-revisit'));assert.ok(f);assert.match(f.title,/relationships changed/);assert.match(f.text,/6 of the six/);assert.match(f.alternatives.join(' '),/not a taste-consistency percentage/);
});
test('Companion, bridge and editing records retain their contextual choice sets',()=>{
  for(const kind of ['pair','bridge','edit']) {
    const r=createScenario(kind,works,{},[],{id:kind});assert.equal(validScenario(r,works,false),false);
    r.choiceId=r.offeredIds[0];r.confirmed=true;r.finishedAt=2;assert.ok(validScenario(r,works));
    const f=analyzeScenarios(works,[r]).findings[0];assert.ok(f);assert.match(f.alternatives.join(' '),/not automatically added as an individual preference or dislike/);
    if(kind==='edit'){assert.equal(selectedIds(r).length,2);assert.equal(selectedIds(r).includes(r.choiceId),false);}
    else assert.equal(selectedIds(r).includes(r.choiceId),true);
  }
});
test('Short exercise choice order is frozen within a task and can vary across tasks',()=>{
  const first=createScenario('pair',works,{},[],{id:'pair-one'}),again=createScenario('pair',works,{},[],{id:'pair-one'}),other=createScenario('pair',works,{},[],{id:'pair-two'});
  assert.deepEqual(first.offeredIds,again.offeredIds);assert.deepEqual([...first.offeredIds].sort(),[...other.offeredIds].sort());assert.notDeepEqual(first.offeredIds,other.offeredIds);
});

test('A changed companion is linked across tasks only when the same anchor stays and the chosen companion is returned',()=>{
  const pair=createScenario('pair',works,{},[],{id:'shared-pair'}),edit=createScenario('edit',works,{},[],{id:'shared-edit'});
  const anchor=pair.anchorIds[0],returned=pair.offeredIds[0],other=works.find(w=>![anchor,returned].includes(w.id)).id;
  Object.assign(pair,{choiceId:returned,confirmed:true,finishedAt:2});
  Object.assign(edit,{anchorIds:[anchor,returned],offeredIds:[anchor,returned,other],presentedIds:[anchor,returned,other],choiceId:returned,confirmed:true,finishedAt:3});
  const f=analyzeScenarios(works,[pair,edit]).findings.find(f=>f.id.endsWith('-company'));
  assert.ok(f);assert.equal(f.support.length,2);assert.match(f.alternatives.join(' '),/does not establish why/);
  edit.choiceId=anchor;
  assert.equal(analyzeScenarios(works,[pair,edit]).findings.find(f=>f.id.endsWith('-company')),undefined);
});
test('A completed exhibition can produce a scoped profile without a long prerequisite quiz',()=>{
  const r=exhibition(),p=buildProfile(works,{},[r]);assert.ok(p.enough);assert.equal(p.answered,0);assert.equal(p.scenarioCount,1);assert.equal(p.exhibitionCount,1);
  assert.ok(p.findings.length);for(const f of p.findings)for(const e of [...f.support,...f.counter])for(const id of e.workIds)assert.ok(works.some(w=>w.id===id));
  assert.match(p.basis,/Omission is not dislike/);
});
test('Curation keeps its baseline snapshot when later quiz answers change',()=>{
  const baseline={preferenceRank:preference()},r=exhibition(works,baseline),id=baseline.preferenceRank.workIds[0];baseline.preferenceRank.positions[id]=0;
  assert.equal(r.baselineAnswers.preferenceRank.positions[id],100);
});
test('Museum suggestions separate study from looking and can filter to Mexico',()=>{
  const study={'mondrian-composition':{study:true}},lookResult=museumMatches(works,[],{},study,{purpose:'look'}),studyResult=museumMatches(works,[],{},study,{purpose:'study'});
  assert.equal(lookResult.personalized,false);assert.ok(studyResult.personalized);assert.equal(studyResult.items[0].id,'kunstmuseum');
  const mexico=museumMatches(works,[],{},{'velasco-valley-mexico':{look:true}},{region:'Mexico'});assert.equal(mexico.items.length,3);assert.ok(mexico.items.every(m=>m.country==='Mexico'));assert.equal(mexico.items[0].id,'munal');assert.match(mexico.items[0].reason,/Velasco/);
});
test('A museum artist connection does not claim the selected painting is held there or on view',()=>{
  const result=museumMatches(works,[],{},{'figari-candombe-moon':{look:true}}),m=result.items.find(m=>m.id==='mnav');
  assert.equal(works.find(w=>w.id==='figari-candombe-moon').museum,'Museo Nacional de Bellas Artes, Buenos Aires');assert.match(m.reason,/work by that artist/);assert.doesNotMatch(m.reason,/on display|this painting is held/i);
  assert.match(result.method,/do not mean the exact selected work is held there/);assert.ok(m.sourceUrl.startsWith('https://mnav.gub.uy/'));
});

test('The room study needs both visit decisions, without inventing an answer for an unchosen room',()=>{
  const d=resetRoomResponses(exhibition());assert.ok(validArrangement(d,works));assert.equal(validScenario(d,works,false),false);
  d.phase='walkthrough';assert.ok(validScenarioDraft(d,works));
  d.roomResponses.lastMinutes='return';d.roomStep=1;assert.ok(validScenarioDraft(d,works));assert.equal(validScenario(d,works,false),false);
  d.roomResponses.guest='opening';assert.ok(validScenario(d,works,false));assert.equal(validScenario(d,works),false);
  d.confirmed=true;d.finishedAt=3;assert.ok(validScenario(d,works));
  for(const invalid of [{lastMinutes:'fourth',guest:'opening'},{lastMinutes:'return',guest:'study',invented:'opening'}])assert.equal(validScenario({...d,roomResponses:invalid},works),false);
  assert.equal(validScenarioDraft({...d,phase:'arrange'},works),false);
});

test('A no-op placement keeps visit responses, while a changed arrangement clears them',()=>{
  const r=exhibition();assert.deepEqual(moveToSlot(r,r.layout.r1a,'r1a').roomResponses,r.roomResponses);
  const changed=moveToSlot(r,r.layout.r1a,'r2a');assert.equal(changed.phase,'arrange');assert.deepEqual(changed.roomResponses,{});assert.equal(changed.roomStep,0);assert.equal(changed.finishedAt,undefined);
});

test('Older free exhibitions stay valid and their existing placements are never given new briefs',()=>{
  const legacy=exhibition();for(const key of ['roomStudy','phase','roomStep','roomResponses'])delete legacy[key];
  assert.ok(validScenario(legacy,works));assert.equal(hasRoomBriefs(legacy),false);assert.deepEqual(upgradeEmptyExhibition(legacy),legacy);
  const empty={...legacy,layout:{},confirmed:false};delete empty.finishedAt;
  const upgraded=upgradeEmptyExhibition(empty);assert.ok(hasRoomBriefs(upgraded));assert.deepEqual(upgraded.offeredIds,empty.offeredIds);assert.deepEqual(upgraded.baselineAnswers,empty.baselineAnswers);assert.equal(empty.roomStudy,undefined);
});

test('A free exhibition and a room-briefs exhibition are not presented as repeated equivalent tasks',()=>{
  const guided=exhibition(),legacy={...structuredClone(guided),id:'legacy'};for(const key of ['roomStudy','phase','roomStep','roomResponses'])delete legacy[key];
  assert.equal(analyzeScenarios(works,[legacy,guided]).findings.some(f=>f.id.endsWith('-revisit')),false);
});

test('Room assignments can connect opposing preference and curiosity comparisons with exact evidence',()=>{
  const pref=preference(),curiosity={...structuredClone(pref),criterion:'interest',positions:Object.fromEntries(pref.workIds.map((id,i)=>[id,[0,30,60,100][i]]))},r=exhibition(works,{preferenceRank:pref,interestRank:curiosity});
  const [a,b,c,d]=pref.workIds,extra=r.offeredIds.filter(id=>!pref.workIds.includes(id));
  r.layout={r1a:b,r1b:c,r2a:d,r2b:extra[0],r3a:a,r3b:extra[1]};
  const f=analyzeScenarios(works,[r]).findings.find(f=>f.id.endsWith('-room-study-preference'));assert.ok(f);assert.match(f.text,/both the quiz and the exhibition/);assert.ok(f.support.some(e=>e.roundId==='preferenceRank'));assert.ok(f.support.some(e=>e.roundId==='interestRank'));assert.equal(f.counter.length,0);
  r.baselineAnswers.interestRank.positions={...pref.positions};const reversed=analyzeScenarios(works,[r]).findings.find(f=>f.id.endsWith('-room-study-preference'));assert.equal(reversed.counter[0].roundId,'interestRank');assert.match(reversed.alternatives.join(' '),/does not reproduce/);
  delete r.baselineAnswers.preferenceRank;assert.equal(analyzeScenarios(works,[r]).findings.some(f=>f.id.endsWith('-room-study-preference')),false);
});

test('The visitor comparison keeps the two room choices and the changed question contexts visible',()=>{
  const r=exhibition(),f=analyzeScenarios(works,[r]).findings.find(f=>f.id.endsWith('-room-audience'));
  assert.ok(f);assert.equal(f.support.length,2);assert.equal(f.support[0].workIds.length,2);assert.equal(f.support[1].workIds.length,2);assert.match(f.alternatives.join(' '),/both the audience and the available time/);
  r.roomResponses.guest='study';const same=analyzeScenarios(works,[r]).findings.find(f=>f.id.endsWith('-room-audience'));assert.match(same.title,/same room/);
});

test('Museum connections use the study-room brief for study and exclude it from looking signals',()=>{
  const r=exhibition(),mondrian='mondrian-composition',oldSlot=SLOT_IDS.find(slot=>r.layout[slot]===mondrian);
  if(oldSlot)[r.layout[oldSlot],r.layout.r2a]=[r.layout.r2a,mondrian];else r.layout.r2a=mondrian;
  const study=museumMatches(works,[r],{},{},{purpose:'study'}),look=museumMatches(works,[r],{},{},{purpose:'look'});
  assert.equal(study.signalCount,2);assert.equal(look.signalCount,4);assert.ok(study.personalized);assert.match(study.items.find(m=>m.id==='kunstmuseum').reason,/closer-look room/);assert.equal(look.items.some(m=>m.evidence.includes(mondrian)),false);
});

test('Moving whole pairs between briefs changes roles without claiming changed partners or endpoint choices',()=>{
  const a=exhibition(),b={...structuredClone(a),id:'roles-two',finishedAt:3};
  [b.layout.r1a,b.layout.r2a]=[b.layout.r2a,b.layout.r1a];[b.layout.r1b,b.layout.r2b]=[b.layout.r2b,b.layout.r1b];
  const result=analyzeScenarios(works,[a,b]),f=result.findings.find(f=>f.id.endsWith('-revisit'));
  assert.match(f.title,/partners stayed/);assert.match(f.text,/4 retained works/);assert.equal(result.findings.some(f=>f.id.endsWith('-route')),false);
});
