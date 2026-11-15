import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STUDY_LENGTHS, STUDY_BANK_REVISION, buildStudyRounds, studyBankSummary } from '../../public/art-atlas/question-bank.mjs';
const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const catalogue=new Map(works.map(w=>[w.id,w])),all=buildStudyRounds(works,200);
const ids=art=>art.map(w=>w.id);
const sortedIds=art=>ids(art).sort().join('|');
function preferenceAnswer(round,reverse=false,key='abstraction') {
  const sorted=[...round.works].sort((a,b)=>(reverse?-1:1)*(a.features[key]-b.features[key]));
  return {workIds:ids(round.works),criterion:'preference',positions:Object.fromEntries(sorted.map((w,i)=>[w.id,Math.round(i/(sorted.length-1)*100)])),confirmed:true};
}

test('Every preset is an exact deterministic prefix of the same 200-item path',()=>{
  assert.deepEqual(STUDY_LENGTHS,[50,100,150,200]);
  for(const length of STUDY_LENGTHS){const rounds=buildStudyRounds(works,length);assert.equal(rounds.length,length);assert.deepEqual(rounds,all.slice(0,length));assert.equal(new Set(rounds.map(r=>r.id)).size,length);}
});

test('All 200 tasks bind sourced artwork objects, valid formats and explicit interpretation limits',()=>{
  for(const [index,r] of all.entries()) {
    assert.equal(r.id,'study-'+String(index+1).padStart(3,'0'));assert.equal(r.format,r.kind);assert.ok(['spectrum','grid','statements','match','context'].includes(r.kind));
    assert.ok(r.title&&r.hint);assert.ok(r.evidence.construct&&r.evidence.setId&&r.evidence.limits.length);assert.equal(r.evidence.bankRevision,STUDY_BANK_REVISION);
    assert.equal(new Set(ids(r.works)).size,r.works.length);for(const w of [...r.works,...(r.anchorWorks||[])]){assert.equal(catalogue.get(w.id),w);assert.ok(w.image&&w.sourceUrl);}
    for(const anchor of r.anchorWorks||[])assert.equal(ids(r.works).includes(anchor.id),false);
    if(r.kind==='spectrum')assert.ok(['preference','interest'].includes(r.criterion));
    if(r.kind==='grid')assert.ok(['response','connection'].includes(r.axis));
    if(r.kind==='statements')assert.equal(r.statements.length,1);
    if(r.kind==='match'){assert.equal(r.options.length,4);assert.equal(new Set(r.options.map(o=>o.label)).size,4);for(const w of r.works)assert.ok(r.options.some(o=>o.label===w[r.field]));}
  }
  assert.doesNotThrow(()=>JSON.stringify(all));
});

test('Ordinary panels compare the same artworks across preference, curiosity and the two maps',()=>{
  const panels=new Map();for(const r of all)if(r.evidence.role==='discovery'&&['preference','curiosity','response','connection'].includes(r.evidence.construct)){const key=r.evidence.setId;panels.set(key,[...(panels.get(key)||[]),r]);}
  assert.equal(panels.size,32);const seen=new Set();
  for(const panel of panels.values()){assert.equal(panel.length,4);assert.deepEqual(panel.map(r=>r.evidence.construct),['preference','curiosity','response','connection']);for(const r of panel)assert.deepEqual(ids(r.works),ids(panel[0].works));const key=sortedIds(panel[0].works);assert.equal(seen.has(key),false);seen.add(key);}
  assert.equal(new Set(all.flatMap(r=>ids(r.works))).size,works.length);
});

test('Repeated tasks are identified and preserve the original choice brief and works',()=>{
  const repeats=all.filter(r=>r.evidence.repeatOf);assert.equal(repeats.length,10);
  for(const repeat of repeats){const original=all.find(r=>r.id===repeat.evidence.repeatOf);assert.ok(original);assert.equal(repeat.evidence.role,'repeat');assert.equal(repeat.evidence.construct,'preference');assert.equal(repeat.title,original.title);assert.equal(repeat.hint,original.hint);assert.deepEqual(ids(repeat.works),ids(original.works).reverse());assert.ok(Number(repeat.id.slice(-3))-Number(original.id.slice(-3))>=10);}
});

test('Contextual choices keep their purpose and anchors separate from unconditional preference',()=>{
  const contextual=all.filter(r=>r.evidence.family==='contextual-choice');assert.equal(contextual.length,24);assert.equal(new Set(contextual.map(r=>r.evidence.construct)).size,24);
  for(const r of contextual){assert.notEqual(r.evidence.construct,'preference');assert.ok(r.scale.left&&r.scale.right);assert.equal(r.evidence.brief,r.title);assert.deepEqual(r.evidence.anchorIds,ids(r.anchorWorks));assert.match(r.evidence.limits.join(' '),/not automatically an unconditional preference/);}
  assert.equal(contextual.filter(r=>r.anchorWorks.length).length,6);
});

test('Reserved feature checks have distinct pairs and cannot train their own provisional direction',()=>{
  const checks=all.filter(r=>r.evidence.heldOut);assert.equal(checks.length,16);assert.equal(new Set(checks.map(r=>sortedIds(r.works))).size,16);
  for(const r of checks)for(const prior of r.evidence.trainingRoundIds){const source=all.find(x=>x.id===prior);assert.ok(source);assert.ok(prior<r.id);assert.equal(source.evidence.role,'discovery');assert.equal(source.evidence.construct,'preference');}
  const check=checks[0],ownAndFuture={[check.id]:preferenceAnswer(check),'study-200':{confirmed:true,positions:{}}};
  const rebuilt=buildStudyRounds(works,200,ownAndFuture).find(r=>r.id===check.id);assert.deepEqual(rebuilt,check);
  const first=all[0],early={[first.id]:preferenceAnswer(first,false,check.evidence.contrastKey)},undertrained=buildStudyRounds(works,200,early).find(r=>r.id===check.id);
  assert.deepEqual(undertrained.evidence.trainingRoundIds,[first.id]);assert.equal(undertrained.evidence.provisionalPrediction,null);
  const later=checks[1],sources=all.filter(r=>r.id<later.id&&r.evidence.role==='discovery'&&r.evidence.construct==='preference'),earlier=Object.fromEntries(sources.map(r=>[r.id,preferenceAnswer(r,false,later.evidence.contrastKey)])),adapted=buildStudyRounds(works,200,earlier).find(r=>r.id===later.id);
  assert.ok(sources.length>=3);assert.ok(adapted.works.some(w=>w.id===adapted.evidence.provisionalPrediction));
  for(const r of sources)earlier[r.id]=preferenceAnswer(r,true,later.evidence.contrastKey);const reversed=buildStudyRounds(works,200,earlier).find(r=>r.id===later.id);assert.notEqual(adapted.evidence.provisionalPrediction,reversed.evidence.provisionalPrediction);
});

test('New comparison checks exclude every earlier co-presented work pair, including anchors',()=>{
  const exposed=new Set();for(const r of all){if(r.evidence.heldOut){assert.equal(exposed.has(sortedIds(r.works)),false);assert.equal(r.evidence.holdoutUnit,'new-comparison');assert.equal(r.evidence.artworksMayBeFamiliar,true);}const art=[...r.works,...(r.anchorWorks||[])];for(let i=0;i<art.length;i++)for(let j=i+1;j<art.length;j++)exposed.add(sortedIds([art[i],art[j]]));}
});

test('Adaptive binding reads actual shown definitions rather than regenerated round identities',()=>{
  const sources=all.filter(r=>r.evidence.construct==='preference'&&r.evidence.role==='discovery').slice(0,3),shown=sources.map(r=>({...r,works:[...r.works].reverse(),evidence:{...r.evidence,bankRevision:'saved-definition'}})),check=all.filter(r=>r.evidence.heldOut)[1],answers=Object.fromEntries(shown.map(r=>[r.id,preferenceAnswer(r,false,check.evidence.contrastKey)]));
  const rebuilt=buildStudyRounds(works,200,answers,{history:shown});for(const r of shown)assert.deepEqual(rebuilt.find(x=>x.id===r.id),r);assert.deepEqual(rebuilt.find(r=>r.id===check.id).evidence.trainingRoundIds,shown.map(r=>r.id));
});

test('Unknown descriptors are not silently imputed as zero; small catalogues label exhausted checks honestly',()=>{
  const missing=structuredClone(works);delete missing[0].features.energy;assert.throws(()=>buildStudyRounds(missing,50),/unknown values/);
  const small=buildStudyRounds(works.slice(0,12),200);assert.equal(small.length,200);for(const r of small.filter(r=>r.evidence.family==='feature-check'&&!r.evidence.comparisonNovel)){assert.equal(r.evidence.heldOut,false);assert.equal(r.evidence.provisionalPrediction,null);}
});

test('Cued labels and source notes come after the longer blind-choice portion',()=>{
  assert.equal(all.slice(0,190).some(r=>r.kind==='match'||r.kind==='context'),false);
  for(const r of all.filter(r=>r.kind==='match'&&r.field==='artist'))for(const w of r.works){assert.notEqual(w.artistKnown,false);assert.doesNotMatch(w.artist,/unidentified|unknown|anonymous|workshop|circle/i);}
  for(const r of all.filter(r=>r.kind==='context')){assert.ok(r.works[0].note&&r.works[0].sourceUrl);assert.equal(r.evidence.labelExposure,'after-cued-labels');assert.match(r.evidence.limits.join(' '),/causal effect is unresolved/);}
});

test('Only the three established self-description links are marked for comparison',()=>{
  const statements=all.filter(r=>r.kind==='statements');assert.equal(statements.length,12);assert.equal(new Set(statements.flatMap(r=>r.statements.map(s=>s.id))).size,12);
  assert.deepEqual(statements.filter(r=>r.evidence.statementTest).map(r=>r.evidence.statementTest),['quiet','curiosity','clarity']);
});

test('The summary reports actual task instances and catalogue coverage without a validity score',()=>{
  const summary=studyBankSummary(works);assert.equal(summary.interactions,200);assert.equal(summary.artworks,works.length);assert.equal(summary.repeats,10);assert.equal(summary.reservedChecks,16);assert.deepEqual(summary.byKind,{spectrum:114,grid:64,statements:12,match:5,context:5});assert.equal(summary.confidence,undefined);
  assert.throws(()=>buildStudyRounds(works,75),/50, 100, 150 or 200/);assert.throws(()=>buildStudyRounds(works.slice(0,8),50),/twelve distinct/);assert.throws(()=>buildStudyRounds([...works,works[0]],50),/twelve distinct/);
});
