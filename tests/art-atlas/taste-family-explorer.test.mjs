import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {TASTE_FAMILY_DEFINITIONS,DEFAULT_TASTE_FAMILY,defaultProfileReading} from '../../public/art-atlas/taste-family-definitions.mjs';
import {PROFILE_READING_CATALOG as catalogue,PROFILE_READING_LENSES as lenses} from '../../public/art-atlas/profile-reading-catalog.mjs';
import {resolveArtworkAttributes,buildTastePatterns,TASTE_QUALITY_BUNDLES} from '../../public/art-atlas/taste-patterns.mjs';
import {TASTE_PATTERN_THRESHOLDS} from '../../public/art-atlas/taste-axes.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';
import {buildSymbolismRound} from '../../public/art-atlas/symbolism-rounds.mjs';
import {buildSymbolismReadings} from '../../public/art-atlas/symbolism-readings.mjs';
const site=new URL('../../public/art-atlas/',import.meta.url),works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8')),annotationReviews=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8')),byId=new Map(works.map(w=>[w.id,w]));
const visual=TASTE_FAMILY_DEFINITIONS.filter(f=>f.lensId==='visual-patterns'),current=catalogue.filter(item=>item.status==='implemented'&&item.availability==='current');
const review=work=>resolveArtworkAttributes(work,{annotationReviews,currentWorks:works});
const qualityKeys=key=>TASTE_QUALITY_BUNDLES.find(bundle=>bundle.key===key)?.attributes||[key];

test('Nine visual families and one sourced-symbolism family are real current entries,with Stories within scenes first',()=>{
  assert.equal(visual.length,9);assert.equal(TASTE_FAMILY_DEFINITIONS.length,10);assert.equal(lenses.length,6);assert.equal(lenses[0].title,'Taste connections');assert.equal(lenses[0].readingIds[0],DEFAULT_TASTE_FAMILY);assert.equal(defaultProfileReading(current,'').id,'stories-within-scenes');assert.equal(defaultProfileReading(current,'#not-a-family').id,'stories-within-scenes');assert.equal(defaultProfileReading(current,'#precision-and-materials').id,'precision-and-materials');assert.equal(defaultProfileReading([]),null);
  for(const family of TASTE_FAMILY_DEFINITIONS){assert.ok(current.some(item=>item.id===family.id));assert.equal(family.example.illustrative,true);assert.ok(family.researchSources.every(source=>/^https:\/\//.test(source.url)));assert.match(family.implementationNote,/Illustrations|sourced symbolism/i);}
});

test('Every pictured visual example has the actual source-bound attributes claimed,not an artist or movement default',()=>{
  for(const family of visual)for(const claim of family.example.claims){const work=byId.get(claim.workId);assert.ok(work);const resolved=review(work);assert.ok(resolved,work.id);for(const key of claim.attributes)assert.equal(resolved.attributes[key].status,'present',family.id+': '+work.id+' '+key);assert.equal(resolved.annotationBasis.sourceUrl,work.sourceUrl);}
});

test('Each visual family can be produced by its actual mapped model using synthetic choices on real reviewed paintings',()=>{
  for(const family of visual){
    const keys=qualityKeys(family.qualityKeys[0]),known=works.filter(work=>work.studyEligible!==false&&work.artistKnown!==false&&review(work)),seenArtists=new Set(),high=[];
    for(const work of known.filter(work=>keys.every(key=>review(work).attributes[key].status==='present'))){if(seenArtists.has(work.artist))continue;seenArtists.add(work.artist);high.push(work);if(high.length===3)break;}
    const low=known.filter(work=>!high.includes(work)&&keys.some(key=>review(work).attributes[key].status==='absent')).slice(0,3);assert.equal(high.length,3,family.id);assert.equal(low.length,3,family.id);
    const rounds=high.map((work,index)=>withOverallAppeal({id:family.id+'-'+index,kind:'spectrum',criterion:'preference',works:[work,low[index]],evidence:{construct:'preference',family:'individual-choice',role:'discovery'}})),answers=Object.fromEntries(rounds.map(r=>[r.id,{workIds:r.works.map(w=>w.id),criterion:'preference',positions:{[r.works[0].id]:90,[r.works[1].id]:10},confirmed:true}])),model=buildTastePatterns({works,rounds,answers,annotationReviews,currentWorks:works}),source=family.sources.find(source=>source.resultPath==='appeal.patterns'&&source.match.qualityKey===family.qualityKeys[0]);assert.ok(source);assert.ok(model.appeal.patterns.some(pattern=>pattern.qualityKey===source.match.qualityKey&&pattern.summaryEligible),family.id+' maps to a real qualifying model record');
  }
});

test('Symbols and allegory require the actual sourced note and response,not visible fantasy or inferred symbolism',()=>{
  const family=TASTE_FAMILY_DEFINITIONS.find(f=>f.id==='symbols-and-allegory');assert.ok(family.sources.every(s=>s.export==='buildSymbolismReadings'));assert.ok(!family.sources.some(s=>s.module==='taste-patterns'));assert.equal(family.example.documentarySources.length,2);
  const round=buildSymbolismRound({id:'example-note',works,contentId:'ambassadors-skull'}),answer={workIds:round.works.map(w=>w.id),workId:round.works[0].id,before:25,after:75,storySeen:true};const readings=buildSymbolismReadings({works,rounds:[round],answers:{[round.id]:answer}});assert.ok(readings.length);assert.ok(readings.every(r=>r.module==='symbolism'&&r.sourceUrls.length));assert.deepEqual(buildSymbolismReadings({works,rounds:[round],answers:{[round.id]:{...answer,storySeen:false}}}),[]);
});

test('The six broad axes name the current model and three-set diversity requirement,not the old two-set prototype',()=>{
  for(const id of ['human-figures','representation','colour-intensity','density-and-activity','depicted-action','setting-and-atmosphere']){const family=catalogue.find(item=>item.id===id);assert.ok(family.sources.every(s=>s.export==='buildTasteAxes'&&s.resultPath==='axes'));const requirements=family.requiredSignals.join(' ');assert.match(requirements,/three distinct discovery sets/i);assert.match(requirements,/six different paintings/i);assert.match(requirements,/three named/i);assert.doesNotMatch(requirements,/two supporting|four different works|two completed/i);}
  assert.equal(TASTE_PATTERN_THRESHOLDS.minimumSets,3);assert.equal(TASTE_PATTERN_THRESHOLDS.minimumWorks,6);assert.equal(TASTE_PATTERN_THRESHOLDS.minimumPreferredArtists,3);
});

test('Explorer keeps category corners and left selection dots,opens the real default and shows plain evidence in a fixed dialog',async()=>{
  const html=fs.readFileSync(new URL('profiles.html',site),'utf8'),dom=new JSDOM(html,{url:'https://example.org/art-atlas/profiles.html',pretendToBeVisual:true}),keys=['document','window','location','history','fetch'],previous=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  try{
    Object.assign(globalThis,{document:dom.window.document,window:dom.window,location:dom.window.location,history:dom.window.history,fetch:async()=>({ok:true,json:async()=>works})});await import('../../public/art-atlas/profile-explorer.mjs?editorial-families-test');
    const app=dom.window.document.querySelector('#profile-explorer');assert.equal(app.querySelector('.explorer-detail h2').textContent,'Stories within scenes');assert.equal(app.querySelectorAll('.explorer-lenses button').length,6);assert.equal(app.querySelector('[data-lens=visual-patterns]').getAttribute('aria-pressed'),'true');const chosen=app.querySelector('[data-reading=stories-within-scenes]');assert.equal(chosen.getAttribute('aria-pressed'),'true');assert.ok(chosen.querySelector('i'));assert.deepEqual([...app.querySelectorAll('[data-art]')].map(el=>el.dataset.art),['velazquez-las-meninas','bosch-garden-delights']);assert.match(app.querySelector('.explorer-example').textContent,/Illustrative example/);assert.equal(app.querySelector('.explorer-heading p'),null);
    app.querySelector('[data-evidence]').click();const evidence=dom.window.document.querySelector('#explorer-evidence');assert.equal(evidence.open,true);assert.ok(evidence.querySelector('a[href*=s41562]'));assert.doesNotMatch(evidence.textContent,/checksum|measurementScope|protocol|features\./);evidence.close();
    app.querySelector('[data-lens=meaning-and-context]').click();assert.equal(app.querySelector('.explorer-detail h2').textContent,'Symbols & allegory');app.querySelector('[data-evidence]').click();assert.ok(evidence.querySelector('a[href*=nationalgallery]'));assert.match(evidence.textContent,/museum-sourced note/i);assert.doesNotMatch(app.textContent,/proposed|legacy|v10|personality type assigned/i);
  }finally{for(const key of keys){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];}dom.window.close();}
});
