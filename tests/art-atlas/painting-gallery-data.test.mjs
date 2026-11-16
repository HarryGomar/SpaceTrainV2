import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPaintingGallery,filterPaintingGallery,nextGalleryContext,captureGalleryPreview,GALLERY_CONTEXT_SCOPE} from '../../public/art-atlas/painting-gallery-data.mjs';
import {journeyCurationNotes,createJourneyStimulusPlan,buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')),notes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
const legacyWorks=works.filter(work=>!work.image.startsWith('assets/classics-20261115/'));
const view=(gallery,id)=>gallery.views.find(view=>view.id===id),items=view=>view.groups.flatMap(group=>group.items);
function oldSession(){
  const catalogue=structuredClone(works.slice(0,4));catalogue[0].title='An earlier saved title';catalogue[0].artist='Earlier Artist';catalogue[0].date='An earlier recorded date';
  const round={id:'journey-001',kind:'spectrum',criterion:'preference',title:'The actual earlier question.',hint:'The actual earlier instruction.',scale:{left:'Less preferred',right:'More preferred'},workIds:catalogue.map(work=>work.id),anchorIds:[],evidence:{construct:'preference',family:'individual-choice',role:'discovery',journeyRevision:'art-profile-50-v2',panelNumber:1}},answer={workIds:[...round.workIds],criterion:'preference',positions:Object.fromEntries(round.workIds.map((id,index)=>[id,[0,25,70,100][index]])),confirmed:true};
  return {manifest:{protocol:'art-profile-50-v1',catalogue},shown:{[round.id]:round},answers:{[round.id]:answer}};
}
test('An explicit historical156-work proposal retains its exact72 reviewed works and42/42 future pools',()=>{
  const gallery=buildPaintingGallery({works:legacyWorks,notes}),first=view(gallery,'first'),next=view(gallery,'next'),later=view(gallery,'later');assert.deepEqual(gallery.coverage,{catalogue:156,first:72,next:42,later:42,plannedSetCount:18});assert.equal(first.groups.length,18);assert.equal(first.itemCount,72);
  for(const [index,group] of first.groups.entries()){assert.deepEqual(group.workIds,notes.proposedFirst18Panels[index].workIds);assert.equal(group.title,notes.proposedFirst18Panels[index].galleryTitle||notes.proposedFirst18Panels[index].title||notes.proposedFirst18Panels[index].targetContrast);assert.equal(group.kind,'planned-comparison');}
  assert.equal(next.groups.length,1);assert.equal(later.groups.length,1);assert.equal(next.groups[0].kind,'reserve-pool');assert.equal(later.groups[0].kind,'reserve-pool');assert.deepEqual(next.groups[0].workIds,notes.reservePools.batch2);assert.deepEqual(later.groups[0].workIds,notes.reservePools.batch3);assert.equal(new Set([...items(first),...items(next),...items(later)].map(item=>item.workId)).size,156);assert.equal(gallery.views.some(view=>view.id==='answered'),false);
});
test('All164 gallery entries retain actual local reproductions and institution source metadata',()=>{
  const all=view(buildPaintingGallery({works,notes}),'all');assert.equal(all.workCount,164);assert.equal(new Set(items(all).map(item=>item.workId)).size,164);for(const item of items(all)){const original=works.find(work=>work.id===item.workId);assert.deepEqual(item.work,original);assert.ok(fs.existsSync(new URL('../../public/art-atlas/'+item.work.image,import.meta.url)),item.workId);assert.ok(/^https?:/.test(item.work.sourceUrl));}
});

test('The current gallery proposal matches actual fresh v10 main panels and includes all8 new classics',()=>{
  const currentNotes=journeyCurationNotes(works),gallery=buildPaintingGallery({works,notes:currentNotes}),first=view(gallery,'first');
  assert.deepEqual(gallery.coverage,{catalogue:164,first:72,next:46,later:46,plannedSetCount:18});
  const panels=createJourneyStimulusPlan({works,seed:'fresh-gallery-v10'}),rounds=buildJourneyRounds(works,{}, {seed:'fresh-gallery-v10',panels});
  const actual=rounds.filter(round=>round.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.role==='discovery'&&Number.isInteger(round.evidence?.panelNumber)).sort((a,b)=>a.evidence.panelNumber-b.evidence.panelNumber);
  assert.equal(actual.length,18);
  for(const [index,group] of first.groups.entries())assert.deepEqual([...group.workIds].sort(),actual[index].works.map(work=>work.id).sort(),'Panel '+group.number);
  const firstIds=new Set(first.groups.flatMap(group=>group.workIds));
  for(const work of works.filter(work=>work.image.startsWith('assets/classics-20261115/')))assert(firstIds.has(work.id),work.id);
  assert.deepEqual(view(gallery,'next').groups[0].workIds,currentNotes.reservePools.batch2);
  assert.deepEqual(view(gallery,'later').groups[0].workIds,currentNotes.reservePools.batch3);
  assert.equal(new Set([...items(first),...items(view(gallery,'next')),...items(view(gallery,'later'))].map(item=>item.workId)).size,164);
});
test('Search combines accent-insensitive terms across actual artwork metadata and preserves set identities',()=>{
  const all=view(buildPaintingGallery({works,notes}),'all'),before=structuredClone(all),cezanne=filterPaintingGallery(all,'CÉZANNE'),monet=filterPaintingGallery(all,'claude monet'),mexico=filterPaintingGallery(all,'Mexico'),missing=filterPaintingGallery(all,'no such title 912345');assert.ok(items(cezanne).some(item=>item.workId==='cezanne-mountain'));assert.ok(items(monet).length>1);assert.ok(items(monet).every(item=>item.work.artist.includes('Monet')));assert.ok(items(mexico).some(item=>item.work.country==='Mexico'));assert.equal(missing.workCount,0);assert.equal(missing.groups.length,0);assert.deepEqual(all,before);
  const first=view(buildPaintingGallery({works,notes}),'first'),filtered=filterPaintingGallery(first,'Mona Lisa');assert.equal(filtered.workCount,1);assert.equal(filtered.groups[0].id,'planned:1');assert.equal(filtered.groups[0].number,1);assert.equal(filtered.totalWorkCount,72);
});
test('Your answered sets use their exact frozen works and metadata independently of the current proposal',()=>{
  const saved=oldSession(),gallery=buildPaintingGallery({works,notes,saved}),history=view(gallery,'answered'),first=view(gallery,'first'),old=items(history).find(item=>item.workId===works[0].id),current=items(view(gallery,'all')).find(item=>item.workId===works[0].id);assert.equal(history.setCount,1);assert.deepEqual(history.groups[0].workIds,saved.shown['journey-001'].workIds);assert.notDeepEqual(history.groups[0].workIds,first.groups[0].workIds);assert.equal(history.groups[0].title,'The actual earlier question.');assert.equal(old.work.title,'An earlier saved title');assert.equal(old.work.artist,'Earlier Artist');assert.equal(old.work.date,'An earlier recorded date');assert.equal(current.work.title,works[0].title);assert.notEqual(current.key,old.key);assert.equal(filterPaintingGallery(history,'Earlier Artist').workCount,1);assert.equal(filterPaintingGallery(view(gallery,'all'),'Earlier Artist').workCount,0);
});
test('Incomplete answers, contextual choices, repeats, probes and unknown historical IDs cannot become answered ordinary sets',()=>{
  const saved=oldSession(),original=structuredClone(saved.shown['journey-001']),answer=structuredClone(saved.answers['journey-001']);
  const add=(id,changeRound=()=>{},changeAnswer=()=>{})=>{const round={...structuredClone(original),id},response=structuredClone(answer);changeRound(round);changeAnswer(response);saved.shown[id]=round;saved.answers[id]=response;};
  add('unconfirmed',()=>{},answer=>answer.confirmed=false);add('skipped',()=>{},answer=>answer.skipped=true);add('partial',()=>{},answer=>delete answer.positions[original.workIds[0]]);add('conditional',round=>round.evidence.unconditional=false);add('anchored',round=>round.anchorIds=[works[7].id]);add('brief',round=>round.brief='Choose for a room.');add('repeat',round=>{round.evidence.role='repeat';round.evidence.repeatOf='journey-001';});add('probe',round=>round.evidence.role='probe');add('unknown-family',round=>round.evidence.family='contextual-choice');add('missing-frozen-work',round=>round.workIds[0]=works[10].id);add('wrong-presentation-order',()=>{},answer=>answer.workIds.reverse());
  const history=view(buildPaintingGallery({works,notes,saved}),'answered');assert.equal(history.groups.length,1);assert.equal(history.groups[0].roundId,'journey-001');assert.equal(history.workCount,4);
});
test('Saved plans and missing responses are never displayed as completed history, and missing frozen metadata has no live fallback',()=>{
  const saved=oldSession(),round=saved.shown['journey-001'];saved.plan=[structuredClone(round)];saved.shown={};let gallery=buildPaintingGallery({works,notes,saved});assert.equal(gallery.history.available,true);assert.equal(view(gallery,'answered').setCount,0);saved.shown={[round.id]:round};saved.answers={};gallery=buildPaintingGallery({works,notes,saved});assert.equal(view(gallery,'answered').setCount,0);saved.answers=oldSession().answers;saved.manifest.catalogue=saved.manifest.catalogue.slice(1);assert.equal(view(buildPaintingGallery({works,notes,saved}),'answered').setCount,0);
});
test('Missing country metadata stays unknown to search instead of being filled from current curation notes',()=>{
  const saved=oldSession();delete saved.manifest.catalogue[0].country;saved.manifest.catalogue[0].artist='A person';saved.manifest.catalogue[0].movement='An earlier description';const history=view(buildPaintingGallery({works,notes,saved}),'answered');assert.equal(items(history).find(item=>item.workId===works[0].id).work.country,undefined);assert.ok(!items(filterPaintingGallery(history,'France')).some(item=>item.workId===works[0].id));
});
test('The model rejects ambiguous identities and malformed proposals without substituting other paintings',()=>{
  const badNotes=structuredClone(notes);badNotes.proposedFirst18Panels[0].workIds[0]='not-available';const gallery=buildPaintingGallery({works,notes:badNotes});assert.deepEqual(gallery.audit.rejectedPanels,[1]);assert.equal(view(gallery,'first').groups.length,17);assert.ok(!items(view(gallery,'first')).some(item=>item.workId==='not-available'));
  const duplicate=buildPaintingGallery({works:[...works,structuredClone(works[0])],notes});assert.ok(!items(view(duplicate,'all')).some(item=>item.workId===works[0].id));assert.doesNotThrow(()=>buildPaintingGallery({works:null,notes:null,saved:[] }));
});
test('Gallery building and filtering cannot mutate captured session or source catalogue objects',()=>{
  const input={works,notes,saved:oldSession()},before=structuredClone(input),gallery=buildPaintingGallery(input);filterPaintingGallery(view(gallery,'answered'),'earlier');items(view(gallery,'answered'))[0].work.title='Changed output';items(view(gallery,'first'))[0].work.analysis.yearRange[0]=-9999;assert.deepEqual(input,before);
});
test('Gallery context stores only available IDs and opening context while preserving the earliest opening',()=>{
  const previous={firstOpenedAt:1000,lastOpenedAt:2000,workIds:['removed'],ratings:{private:'must not propagate'}},before=structuredClone(previous),context=nextGalleryContext(previous,['one','two','one',null,''],5000);assert.deepEqual(context,{firstOpenedAt:1000,lastOpenedAt:5000,workIds:['one','two'],scope:GALLERY_CONTEXT_SCOPE});assert.deepEqual(previous,before);assert.deepEqual(Object.keys(context).sort(),['firstOpenedAt','lastOpenedAt','scope','workIds']);assert.equal(nextGalleryContext({firstOpenedAt:'1000'},[],5000).firstOpenedAt,5000);assert.equal(nextGalleryContext({firstOpenedAt:9000},[],5000).firstOpenedAt,5000);
});

test('A later match records available gallery context without claiming labels were read or changing the original visit',()=>{
  const context=nextGalleryContext(null,['a','b','c'],1000),before=structuredClone(context),captured=captureGalleryPreview(context,['b','d'],2000);
  assert.deepEqual(captured,{firstOpenedAt:1000,lastOpenedAt:1000,capturedAt:2000,availableMatchedWorkIds:['b'],scope:GALLERY_CONTEXT_SCOPE});assert.deepEqual(context,before);
  context.workIds.push('d');assert.deepEqual(captured.availableMatchedWorkIds,['b']);
});

test('Absent, malformed and future gallery visits cannot become earlier match exposure',()=>{
  for(const context of [null,{}, {firstOpenedAt:2,lastOpenedAt:1,workIds:[]},{firstOpenedAt:1000,lastOpenedAt:3000,workIds:['a']}])assert.equal(captureGalleryPreview(context,['a'],2000),null);
});
