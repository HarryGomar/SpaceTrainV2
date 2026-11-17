import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import WORKS from '../../public/art-atlas/artworks.json' with {type:'json'};
import REVIEWS from '../../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {imageDimensions} from '../../scripts/art-atlas/import-study-media.mjs';
import {resolveArtworkAttributes} from '../../public/art-atlas/artwork-quality-review.mjs';
import {journeyCurationNotes} from '../../public/art-atlas/journey-bank.mjs';
import {prepareJourneySession,sessionJourneyRounds,snapshotStudyRound} from '../../public/art-atlas/deep-study.mjs';

const added=['canon-hopper-nighthawks','canon-picasso-guernica'];
test('The five canonical additions form informative actual first-block comparisons without increasing its size',()=>{
  const panels=journeyCurationNotes(WORKS).proposedFirst18Panels,all=panels.flatMap(panel=>panel.workIds),together=(...ids)=>panels.some(panel=>ids.every(id=>panel.workIds.includes(id)));
  assert.equal(panels.length,18);assert.equal(new Set(all).size,72);
  for(const id of [...added,'canon-goya-third-may','study-wood-american-gothic','req-rivera-alameda'])assert.ok(all.includes(id));
  assert.ok(together('van-gogh-night-cafe','canon-hopper-nighthawks'));
  assert.ok(together('canon-kahlo-two-fridas','study-wood-american-gothic'));
  assert.ok(together('bosch-garden-delights','req-rivera-alameda'));
  assert.ok(together('goya-saturn','canon-goya-third-may'));
  assert.ok(together('canon-siqueiros-collective-suicide','canon-picasso-guernica'));
});

test('Both institutional reproductions retain real dimensions, exact hashes and independently reviewed unknowns',()=>{
  for(const id of added){
    const work=WORKS.find(item=>item.id===id),bytes=fs.readFileSync(new URL('../../public/art-atlas/'+work.image,import.meta.url)),size=imageDimensions(bytes),review=resolveArtworkAttributes(work,{annotationReviews:REVIEWS});
    assert.equal(size.width,work.width);assert.equal(size.height,work.height);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),work.sha256);
    assert.ok(review);assert.equal(Object.keys(review.attributes).length,16);assert.ok(Object.values(review.attributes).some(value=>value.status==='unknown'));
    assert.equal(work.image,work.imageLarge);assert.equal(work.provenance.sourceLimited,true);assert.doesNotMatch(work.rights,/^CC0$|^Public domain$/);
  }
  const webp=WORKS.find(work=>work.id==='canon-picasso-guernica'),bytes=fs.readFileSync(new URL('../../public/art-atlas/'+webp.image,import.meta.url));
  assert.equal(imageDimensions(bytes).mime,'image/webp');assert.throws(()=>imageDimensions(bytes.subarray(0,30)));
});

test('Already shown v16 questions keep their instruments when the catalogue and fresh curation expand',()=>{
  const previous=prepareJourneySession(null,WORKS.filter(work=>!added.includes(work.id)),123),rounds=sessionJourneyRounds(previous).slice(0,3);
  previous.manifest.journeyRevision='art-profile-50-v16';
  for(const round of rounds){round.evidence.journeyRevision='art-profile-50-v16';previous.shown[round.id]=snapshotStudyRound(round);previous.answers[round.id]={workIds:round.works.map(work=>work.id),skipped:true};}
  const frozen=structuredClone(previous.shown),answers=structuredClone(previous.answers),upgraded=prepareJourneySession(previous,WORKS,456);
  for(const id of Object.keys(frozen)){assert.deepEqual(upgraded.shown[id],frozen[id]);assert.deepEqual(upgraded.answers[id],answers[id]);}
});
