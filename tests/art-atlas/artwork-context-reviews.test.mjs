import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {journeyCurationNotes} from '../../public/art-atlas/journey-bank.mjs';
const site=new URL('../../public/art-atlas/',import.meta.url);
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const attributes=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('artwork-context-reviews.json',site),'utf8'));
const originalIds=Object.keys(JSON.parse(fs.readFileSync(new URL('../../tools/artwork-attribute-observations-20261115.json',import.meta.url),'utf8')));
const originals=originalIds.map(id=>data.records[id]);
const earlyNotes=JSON.parse(fs.readFileSync(new URL('../../tools/early-context-observations-20261116.json',import.meta.url),'utf8'));

test('All merged context records bind their reviewed source identities and retain the original96 fixture',()=>{
  assert.equal(data.version,'artwork-context-v1');
  assert.equal(originalIds.length,96);assert.ok(data.reviewedCount>=96);
  assert.equal(data.reviewedCount,Object.keys(data.records).length);
  for(const id of originalIds)assert.ok(data.records[id],id);
  for(const [id,record] of Object.entries(data.records)){
    assert.deepEqual(record.sourceIdentity,attributes.reviews[id].sourceIdentity,id);
    assert.ok(attributes.reviews[id],id);
    const sourceUrls=record.sourceUrls||[record.sourceIdentity.sourceUrl];
    assert(sourceUrls.includes(record.sourceIdentity.sourceUrl));
    assert(sourceUrls.every(url=>/^https:\/\//.test(url)));
  }
  for(const id of journeyCurationNotes(works).proposedFirst18Panels.flatMap(panel=>panel.workIds))assert(data.records[id],id);
});

test('Documented facts, prior imported facts, editorial judgements and unknowns retain separate evidence kinds',()=>{
  for(const record of Object.values(data.records)){
    const original=originals.includes(record);
    for(const fact of Object.values(record.facts)){
      assert(['unknown','reported','documented'].includes(fact.status));
      if(fact.status==='unknown'){
        assert.ok(!Object.hasOwn(fact,'value')||fact.value===null);
        if(original){assert(fact.reason);assert(!Object.hasOwn(fact,'value'));}
      }else{assert(fact.sourceUrl?.startsWith('https://'));if(original||fact.evidenceKind)assert(data.evidenceKinds[fact.evidenceKind]);assert(Object.hasOwn(fact,'value'));}
    }
    for(const label of record.editorial.movementLabels)assert.equal(label.evidenceKind,'catalogue-editorial-classification');
    for(const label of record.editorial.reviewedLabels){assert.equal(label.evidenceKind,'assistant-contextual-classification');assert(label.reason.length>30);assert(label.kind&&label.label);}
  }
  assert.equal(originals.filter(record=>record.facts.reportedDate.evidenceKind==='primary-api-metadata').length,22);
  assert.equal(data.records['cassatt-omnibus'].facts.medium.value,'color drypoint and aquatint');
  assert.equal(data.records['japanese-waves'].facts.medium.value,'fan painting mounted as a hanging scroll; ink and color with gold on paper');
  assert.equal(data.records['blanchard-still-life'].facts.medium.value,'oil, sand, and mixed media collage on canvas');
});

test('Creation location, depicted location, source culture and the old country grouping cannot substitute for each other',()=>{
  const twilight=data.records['opening-cma-141639'];
  assert.equal(twilight.facts.creationPlace.value,'New York studio');
  assert.equal(twilight.facts.depictedPlace.value,'Wilderness near Mount Katahdin, Maine');
  const sunflower=data.records['study-van-gogh-sunflowers'];
  assert.equal(sunflower.facts.creationPlace.value,'Arles, France');
  assert.equal(sunflower.editorial.catalogueCountryContext.value,'Netherlands');
  assert.equal(data.records['add-siqueiros-madre-nina'].facts.medium.status,'unknown');
  assert.equal(data.records['add-siqueiros-madre-nina'].facts.creationPlace.status,'unknown');
  assert(data.records['add-siqueiros-madre-nina'].editorial.reviewedLabels.some(label=>label.kind==='artist-context'&&/not proof.*mural/.test(label.reason)));
  for(const record of originals)assert.equal(record.facts.artistNationality.status,'unknown','Creator descriptions were not silently promoted to nationality.');
  for(const record of Object.values(data.records))if(record.facts.artistNationality?.status!=='unknown'&&record.facts.artistNationality)assert.ok(record.facts.artistNationality.sourceUrl,'A newly documented nationality needs its own source.');
});

test('Different abstract treatments stay distinct, while date normalization and open-ended wording retain their original limits',()=>{
  const labels=id=>data.records[id].editorial.reviewedLabels.map(label=>label.label);
  assert(labels('add-rothko-orange-yellow').includes('Colour-field abstraction'));
  assert(labels('add-pollock-convergence').includes('Gestural abstraction'));
  assert(labels('add-herrera-cobalt-white').includes('Hard-edged geometric abstraction'));
  assert(labels('add-kandinsky-composition-seven').includes('Prewar nonfigurative painting'));
  assert(!labels('add-kandinsky-composition-seven').includes('Abstract Expressionism'));
  const shen=data.records['shen-clouds'];
  assert.equal(shen.editorial.chronologicalInterval.status,'unknown');
  assert.equal(shen.facts.reportedDate.value,'after 1490');
  assert.match(shen.facts.sourceIndexRange.scope,/not a statistical confidence interval/);
  assert.match(data.records['study-munch-scream'].editorial.chronologicalInterval.scope,/Existing editorial interval/);
});

test('The current first50 and entire second-block reserve have exact source-bound context records',()=>{
  const notes=journeyCurationNotes(works),first=new Set(notes.proposedFirst18Panels.flatMap(panel=>panel.workIds));
  assert.equal(first.size,72);
  const allocation=new Set([...first,...notes.reservePools.batch2]);
  assert.equal(notes.reservePools.batch2.length,55);
  assert.equal(allocation.size,127);
  for(const id of allocation){assert.ok(data.records[id],id);assert.deepEqual(data.records[id].sourceIdentity,attributes.reviews[id].sourceIdentity,id);}
  assert.equal(Object.keys(earlyNotes).length,21);
  for(const id of Object.keys(earlyNotes)){
    assert.ok(data.records[id].reviewMethod.length>60,id);
    assert.equal(data.records[id].editorial.reviewedLabels[0].label,earlyNotes[id].label,id);
  }
});

test('New context facts preserve source qualifications, exact technique and independent indexing intervals',()=>{
  assert.equal(data.records['brueghel-sight'].facts.medium.value,'Oil on panel');
  assert.equal(data.records['brueghel-sight'].facts.medium.sourceUrl,'https://canon.codart.nl/artwork/the-five-senses/');
  assert.equal(data.records['brueghel-sight'].facts.reportedDate.status,'reported');
  assert.match(data.records['brueghel-sight'].sourceLimit,/403/);
  assert.equal(data.records['tanner-waters'].facts.medium.value,'etching');
  assert.deepEqual(data.records['tanner-waters'].facts.sourceIndexRange.value,[1905,1915]);
  assert.equal(data.records['klee-carnival'].facts.medium.value,'watercolor');
  assert.equal(data.records['redon-violette'].facts.medium.value,'pastel on gray wove paper');
  assert.equal(data.records['add-malevich-football-player'].facts.medium.value,'Oil on canvas');
  assert.equal(data.records['add-kandinsky-impression-concert'].facts.medium.status,'unknown');
  assert.equal(data.records['add-kandinsky-impression-concert'].facts.sourceWorkType.value,'Oil painting');
  assert.equal(data.records['add-de-chirico-engineer'].facts.creationPlace.value,'Ferrara, Italy');
  assert.equal(data.records['add-atl-climatic-eruption'].facts.depictedPlace.value,'Paricutín volcano, Michoacán, Mexico');
  assert.equal(data.records['add-atl-climatic-eruption'].facts.creationPlace.status,'unknown');
  assert.equal(data.records['piazza-san-marco'].facts.sourceCreatorAttribution.value[0].qualifier,'attributed to');
});

test('Stańczyk points to the1862 painting while the wrong reproductive-print reference remains an explicit audit',()=>{
  const work=works.find(work=>work.id==='matejko-stanczyk'),record=data.records[work.id];
  assert.equal(work.sourceUrl,'https://artsandculture.google.com/asset/sta%C5%84czyk-jan-matejko/4AHFtRqeObzoRw');
  assert.equal(work.date,'1862');assert.equal(record.facts.reportedDate.value,'1862');
  assert.equal(record.facts.medium.value,'Oil on canvas');
  assert.equal(record.sourceIdentityCorrection.previousSourceUrl,'https://cyfrowe.mnw.pl/pl/zbiory/962339');
  assert.deepEqual(record.sourceIdentityCorrection,work.provenance.sourceIdentityCorrection);
  assert.equal(record.sourceIdentityCorrection.previewSha256,record.sourceIdentity.previewSha256);
  assert.match(record.sourceIdentityCorrection.reason,/wood engraving/);
});
