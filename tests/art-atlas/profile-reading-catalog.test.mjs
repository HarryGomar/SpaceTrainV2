import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PROFILE_READING_CATALOG as catalogue,PROFILE_READING_LENSES as lenses,PROFILE_READING_CATALOG_VERSION} from '../../public/art-atlas/profile-reading-catalog.mjs';
import {buildTastePortrait} from '../../public/art-atlas/taste-portrait.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const ids=round=>round.works.map(work=>work.id);
const answer=(round,values)=>({confirmed:true,criterion:'preference',workIds:ids(round),positions:Object.fromEntries(round.works.map((work,index)=>[work.id,values[index]]))});
const byId=new Map(works.map(work=>[work.id,work]));
const get=id=>{assert.ok(byId.has(id),'Real illustrative artwork '+id);return byId.get(id);};
const sourcesFor=id=>catalogue.find(item=>item.id===id).sources;

test('Every family belongs to exactly one existing lens and illustrates only real sourced artwork identities',()=>{
  assert.equal(PROFILE_READING_CATALOG_VERSION,5);assert.equal(catalogue.length,51);assert.equal(new Set(catalogue.map(item=>item.id)).size,catalogue.length);const membership=lenses.flatMap(lens=>lens.readingIds.map(id=>[id,lens.id]));assert.equal(new Set(membership.map(([id])=>id)).size,membership.length);assert.equal(membership.length,catalogue.length);
  for(const item of catalogue){assert.deepEqual(membership.find(([id])=>id===item.id),[item.id,item.lensId]);assert.equal(item.example.illustrative,true);assert.ok(item.example.workIds.length);for(const id of item.example.workIds){const work=get(id);assert.ok(work.image&&work.sourceUrl);}assert.ok(item.requiredSignals.length&&item.limits.length);assert.ok(item.title&&item.description);}
});

test('Implemented source declarations point to real analytical exports and actual result fields',async()=>{
  const results=new Map();
  for(const item of catalogue.filter(item=>item.status==='implemented')){
    assert.ok(item.sources.length,item.id+' has a runtime source');
    for(const source of item.sources){
      const url=new URL('../../'+source.file,import.meta.url);assert.ok(fs.existsSync(url),source.file);const module=await import(url.href);assert.equal(typeof module[source.export],'function');const sourceKey=source.file+'|'+source.export;if(!results.has(sourceKey))results.set(sourceKey,module[source.export]({works:[],rounds:[],answers:{}}));let result=results.get(sourceKey);if(source.resultPath!=='$')for(const part of source.resultPath.split('.')){assert.ok(result&&Object.hasOwn(result,part),item.id+' source field '+source.resultPath);result=result[part];}assert.ok(Array.isArray(result),item.id+' names an actual result array');
    }
  }
});

test('Current and retained instruments stay distinct, without presenting removed appraisals as fresh v10 questions',()=>{
  const availability=id=>catalogue.find(item=>item.id===id).availability;for(const id of ['reported-density','people-and-reaction','unexpectedness-and-preference','openness-and-preference'])assert.equal(availability(id),'legacy');for(const id of ['attention-to-making','chosen-work-connections','range-in-positive-choices','favourites-and-ratings','prospective-feature-check'])assert.equal(availability(id),'current');
  assert.ok(sourcesFor('human-figures').some(source=>source.export==='buildTasteAxes'&&source.resultPath==='axes'&&source.match.key==='human-presence'));assert.ok(sourcesFor('prospective-feature-check').some(source=>source.resultPath==='closingRefinement.checks'));assert.ok(sourcesFor('admiration-and-appeal').some(source=>source.match.idIn?.includes('response-making')));assert.ok(sourcesFor('tension-and-return').some(source=>source.match.idIn?.includes('response-return-range')));
  assert.deepEqual(Object.fromEntries(['current','legacy','planned'].map(value=>[value,catalogue.filter(item=>item.availability===value).length])),{current:39,legacy:7,planned:5});for(const item of catalogue.filter(item=>item.status==='planned'))assert.deepEqual(item.sources,[]);
});

test('Every current family supplies short art-facing requirements and limits without exposing implementation rules',()=>{
  const current=catalogue.filter(item=>item.availability==='current'),technical=/checksum|sha256|features\.|measurementScope|protocol|criterion|qualified|descriptor|unassigned tag|editorial non-assignment/i;
  assert.equal(current.length,39);
  for(const item of current){
    assert.ok(Array.isArray(item.userSignals)&&item.userSignals.length>=2&&item.userSignals.length<=4,item.id+' has concise product requirements');
    assert.ok(Array.isArray(item.userLimits)&&item.userLimits.length===2,item.id+' has two plain limits');
    for(const text of [...item.userSignals,...item.userLimits]){assert.equal(typeof text,'string');assert.ok(text.trim());assert.ok(text.split(/\s+/).length<=34,item.id+' stays short');assert.doesNotMatch(text,technical);assert.doesNotMatch(text,/[\r\n]/);}
  }
  const connections=catalogue.find(item=>item.id==='chosen-work-connections');assert.match(connections.requiredSignals.join(' '),/checksum/,'Detailed developer requirements remain intact');assert.notDeepEqual(connections.userSignals,connections.requiredSignals);
  for(const id of ['admiration-and-appeal','tension-and-return','prospective-feature-check','favourites-and-ratings'])assert.ok(catalogue.find(item=>item.id===id).userSignals.length);
});

test('Real reviewed artwork examples can reach the new favourite, connection and range family source records',()=>{
  const chosen=['add-varo-harmony','bosch-garden-delights','add-carrington-dagobert','add-watts-hope','egypt-man-portrait'].map(get),lower=['mondrian-composition','add-pollock-convergence'].map(get);
  const pref=(id,offered)=>withOverallAppeal({id,kind:'spectrum',criterion:'preference',works:offered,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}}),a=pref('a',[chosen[0],chosen[1],lower[0]]),b=pref('b',[chosen[2],chosen[3],chosen[4],lower[1]]),fav={id:'favourite-example',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,works:[...chosen,...lower],evidence:{construct:'overall-favourites'}},answers={a:answer(a,[90,95,10]),b:answer(b,[90,95,90,10]),[fav.id]:{confirmed:true,workIds:ids(fav),selectionMode:'shortlist',selectedIds:chosen.map(work=>work.id),explicitNone:false,unsure:false}},portrait=buildTastePortrait({works,rounds:[a,b,fav],answers});
  assert.equal(portrait.heroWorks.filter(item=>item.basis==='overall-favourites').length,5);assert.ok(portrait.facets.observations.some(item=>item.module==='curatorial-themes'));const range=portrait.observations.find(item=>item.id==='facet-density-range');assert.ok(range);assert.equal(sourcesFor('range-in-positive-choices')[0].match.id,range.id);assert.ok(range.displayWorkIds.every(id=>range.text.includes(get(id).shortTitle||get(id).title)));assert.ok(!portrait.themes.some(theme=>theme.id===range.id));
});
