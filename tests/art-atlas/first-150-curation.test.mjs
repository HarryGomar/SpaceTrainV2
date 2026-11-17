import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalogue from '../../public/art-atlas/artworks.json' with {type:'json'};
import plan from '../../public/art-atlas/first-150-curation.json' with {type:'json'};
import reviews from '../../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {resolveArtworkAttributes} from '../../public/art-atlas/artwork-quality-review.mjs';
import {prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,validStudyAnswer} from '../../public/art-atlas/deep-study.mjs';
import {isContinuousPreferenceRound} from '../../public/art-atlas/continuous-preference.mjs';
import {buildPaintingGallery} from '../../public/art-atlas/painting-gallery-data.mjs';
import {journeyCurationNotes} from '../../public/art-atlas/journey-bank.mjs';

const manifestSets=[plan.openingPanels.flatMap(panel=>panel.workIds),...plan.laterBlocks.map(block=>block.workIds)];
const isAddition=work=>work.image.startsWith('assets/first-150-20261117/add-');
const exactFile=(file,sha)=>assert.equal(createHash('sha256').update(readFileSync(new URL('../../public/art-atlas/'+file,import.meta.url))).digest('hex'),sha,file);
const ids=round=>round.works.map(work=>work.id);

test('The released gallery and source reviews use the declared cohorts and exact reproductions',()=>{
  assert.deepEqual(manifestSets.map(set=>set.length),[72,55,55]);
  assert.equal(new Set(manifestSets.flat()).size,182);
  assert.equal(plan.deferrals.length,26);
  assert.ok(plan.deferrals.every(id=>!manifestSets.flat().includes(id)));
  const additions=catalogue.filter(isAddition);
  assert.equal(additions.length,17);
  for(const work of additions){
    assert.ok(work.creditLine&&work.provenance.sourceImageSha256&&work.provenance.compositionScope!=='detail');
    assert.ok(manifestSets.some(set=>set.includes(work.id)));
    exactFile(work.image,work.sha256);
    exactFile(work.imageLarge,work.provenance.largeSha256);
    const review=resolveArtworkAttributes(work,{annotationReviews:reviews,currentWorks:catalogue});
    assert.ok(review,work.id);
    assert.equal(Object.keys(review.attributes).length,16);
  }
  const gold=additions.find(work=>work.id==='add-warhol-gold-marilyn'),haring=additions.find(work=>work.id==='add-haring-untitled-1982');
  assert.equal(reviews.reviews[gold.id].attributes['pattern-rhythm'].status,'absent');
  assert.equal(reviews.reviews[haring.id].attributes['pattern-rhythm'].status,'present');
  const gallery=buildPaintingGallery({works:catalogue,notes:journeyCurationNotes(catalogue)});
  assert.deepEqual([gallery.coverage.first,gallery.coverage.next,gallery.coverage.later],[72,55,55]);
});

test('Fresh runs reach every declared ordinary work and paired anchor in its block while following a strong Warhol response',()=>{
  let data=prepareJourneySession(null,catalogue,100);
  data.manifest.id='declared-curation-verification';
  const nominated=new Set();
  for(let batch=0;batch<3;batch++){
    const ordinary=[];
    for(let index=batch*50;index<(batch+1)*50;index++){
      data.index=index;
      const round=sessionJourneyRounds(data)[index],workIds=ids(round);
      if(!round.unavailable)data.shown[round.id]=snapshotStudyRound(round);
      if(!round.unavailable&&isContinuousPreferenceRound(round)){
        assert.ok(workIds.every(id=>!plan.deferrals.includes(id)),round.id);
        const positions=Object.fromEntries(round.works.map(work=>[work.id,work.id==='add-warhol-gold-marilyn'?98:batch===0?49:Math.round(10+work.features.color*85)]));
        const answer={workIds,criterion:'preference',positions,confirmed:true};
        assert.ok(validStudyAnswer(round,answer),round.id);
        data.answers[round.id]=answer;
        if(round.evidence.panelNumber)ordinary.push(round);
        for(const id of round.evidence.appealInvestigation?.anchorIds||[])nominated.add(id);
      }else data.answers[round.id]={workIds,skipped:true};
    }
    assert.equal(ordinary.length,18);
    const shown=new Set(ordinary.flatMap(ids));
    for(const id of manifestSets[batch])assert.ok(shown.has(id),id);
    if(batch){
      for(const pair of plan.laterBlocks[batch-1].comparisons)assert.ok(ordinary.some(round=>pair.workIds.every(id=>ids(round).includes(id))),pair.title);
      assert.deepEqual(data.batches.at(-1).selection.audit.missingDeclaredWorkIds,[]);
    }
    if(batch<2)data=extendJourneySession(data,catalogue,200+batch);
  }
  assert.equal(data.plan.length,150);
  assert.ok(nominated.has('add-warhol-gold-marilyn'));
});
