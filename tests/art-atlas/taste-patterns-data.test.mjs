import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createJourneyStimulusPlan} from '../../public/art-atlas/journey-bank.mjs';
import {resolveArtworkAttributes} from '../../public/art-atlas/taste-patterns.mjs';
import {legacyV8Rounds} from './helpers/legacy-v8.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const annotationReviews=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artwork-attribute-reviews.json',import.meta.url),'utf8'));
test('Every current or historical ordinary first72 work has a usable, source-bound current interpretation',()=>{
  const current=createJourneyStimulusPlan({works}).panels.flatMap(panel=>panel.workIds),historical=legacyV8Rounds(works).filter(round=>round.kind==='spectrum'&&round.evidence.construct==='preference'&&round.evidence.panelNumber).flatMap(round=>round.works.map(work=>work.id));
  assert.equal(new Set(current).size,72);assert.equal(new Set(historical).size,72);
  for(const id of new Set([...current,...historical])){const work=works.find(item=>item.id===id),result=resolveArtworkAttributes(work,{annotationReviews});assert.ok(result,id+' needs a source/hash-bound review');assert.equal(Object.keys(result.attributes).length,16);assert.equal(result.annotationBasis.interpretation,'current-editorial-interpretation');}
});
test('Source reviews cannot move to a different painting under an unchanged historical ID',()=>{
  const first=structuredClone(works.find(work=>work.id==='bosch-garden-delights')),other=works.find(work=>work.id==='holbein-ambassadors');Object.assign(first,{sourceUrl:other.sourceUrl,image:other.image});assert.equal(resolveArtworkAttributes(first,{annotationReviews}),null);
});
