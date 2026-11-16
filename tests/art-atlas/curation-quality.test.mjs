import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chooseQualityCrossing,qualityDiagnostic,QUALITY_COMPARISONS} from '../../public/art-atlas/curation-quality.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
function crossing(){const keys=QUALITY_COMPARISONS[0],rows=works.map(work=>({id:work.id,work,landmark:false})),all=qualityDiagnostic(rows,keys);return {keys,rows:['00','01','10','11'].map(cell=>rows.find(row=>row.id===all.cells[cell][0]))};}

test('A reviewed crossing retains all four source-bound quality cells and compulsory fresh slots',()=>{
  const {keys,rows}=crossing();assert.ok(rows.every(Boolean));const freshIds=new Set(rows.map(row=>row.id)),selected=chooseQualityCrossing({candidates:rows,keys,benefit:()=>1,requiredFresh:4,fresh:row=>freshIds.has(row.id),maximumLandmarks:2});assert.ok(selected);assert.equal(selected.qualityDiagnostic.status,'four-cells');assert.equal(selected.chosen.filter(row=>freshIds.has(row.id)).length,4);assert.ok(Object.values(selected.qualityDiagnostic.cells).every(ids=>ids.length===1));assert.ok(selected.qualityDiagnostic.sourceBindings.every(binding=>binding.sourceBound&&binding.reviewedPreviewSha256));
  assert.equal(chooseQualityCrossing({candidates:rows,keys,benefit:()=>1,requiredFresh:4,fresh:row=>row.id!==rows[0].id}),null,'An attractive contrast cannot bypass mandatory novelty.');
  assert.equal(chooseQualityCrossing({candidates:rows,keys,benefit:()=>1,avoidPair:(a,b)=>a.id===rows[0].id||b.id===rows[0].id}),null,'A protected comparison cannot be reintroduced to complete a crossing.');
});

test('A changed image or source is unknown, and three known cells are explicitly partial',()=>{
  const {keys,rows}=crossing(),changed=rows.map((row,i)=>i?row:{...row,work:{...row.work,image:'assets/unreviewed-replacement.jpg'}}),diagnostic=qualityDiagnostic(changed,keys);assert.deepEqual(diagnostic.unknownWorkIds,[rows[0].id]);assert.equal(diagnostic.status,'three-cells');assert.equal(diagnostic.sourceBindings[0].sourceBound,false);assert.deepEqual(Object.values(diagnostic.sourceBindings[0].statuses),['unknown','unknown']);assert.equal(Object.values(diagnostic.cells).flat().includes(rows[0].id),false);
  const conflicting=rows.map((row,i)=>i?row:{...row,work:{...row.work,previewSha256:'0'.repeat(64)}});assert.deepEqual(qualityDiagnostic(conflicting,keys).unknownWorkIds,[rows[0].id]);
});
