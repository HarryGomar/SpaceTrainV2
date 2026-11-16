import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteBoundaries,TASTE_BOUNDARY_RULES,TASTE_BOUNDARY_THRESHOLDS} from '../../public/art-atlas/taste-boundaries.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from '../../public/art-atlas/artwork-attribute-definitions.mjs';
import {withOverallAppeal} from '../../public/art-atlas/appeal-scale.mjs';

function fixture(count=3){
  const works=Array.from({length:count*4},(_,i)=>({id:'w'+i,title:'Painting '+i,artist:'Artist '+i,image:'assets/w'+i+'.jpg',sourceUrl:'https://museum.example/w'+i,sha256:(i+1).toString(16).padStart(64,'0')}));
  const annotationReviews={version:ARTWORK_ATTRIBUTE_VERSION,reviews:Object.fromEntries(works.map((w,i)=>[w.id,{version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:{sourceUrl:w.sourceUrl,image:w.image,previewSha256:w.sha256},reviewedAsset:{image:w.image,sha256:w.sha256,width:640,height:500,mediaBinding:'exact-local-preview',compositionMatch:'same-composition'},sourceUrls:[w.sourceUrl],attributes:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,{status:key==='precise-rendering'||key==='human-relationships'&&i%2===0?'present':'absent',reason:'Visible reviewed detail for '+key,evidenceKind:'visual-review'}]))}]))};
  const round=(id,indexes,extra={})=>withOverallAppeal({id,kind:'spectrum',criterion:'preference',works:indexes.map(i=>works[i]),evidence:{construct:'preference',family:'individual-choice',role:'discovery',...extra}});
  const answer=(r,values)=>({workIds:r.works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(r.works.map((w,i)=>[w.id,values[i]])),confirmed:true});
  const rounds=Array.from({length:count},(_,i)=>round('p'+i,[i*4,i*4+1,i*4+2,i*4+3])),answers=Object.fromEntries(rounds.map(r=>[r.id,answer(r,[90,10,80,20])]));
  const favourites=selected=>{const r={id:'favourites',kind:'choice-grid',selectionMode:'shortlist',maxChoices:5,works,evidence:{construct:'overall-favourites'}},a={workIds:works.map(w=>w.id),selectionMode:'shortlist',selectedIds:selected,explicitNone:selected.length===0,unsure:false,confirmed:true};rounds.push(r);answers[r.id]=a;};
  return {works,rounds,answers,annotationReviews,round,answer,favourites};
}
const attr=(f,id,key,status)=>f.annotationReviews.reviews[id].attributes[key].status=status;
const main=model=>model.findings.find(item=>item.id.startsWith('taste-boundary:precision-relationships:'));

test('A shared quality can yield a specific, source-bound high-versus-low contrast across artists and sets',()=>{
  const f=fixture(),before=structuredClone({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews}),model=buildTasteBoundaries(f),finding=main(model);
  assert.ok(finding);assert.equal(finding.direction,1);assert.equal(finding.sharedQuality,'precise-rendering');assert.equal(finding.contrastQuality,'human-relationships');assert.equal(finding.highWorkIds.length,6);assert.equal(finding.lowWorkIds.length,6);assert.equal(finding.coverage.distinctDiscoverySets,3);assert.equal(finding.supportPairs.length,3);assert.equal(new Set(finding.supportPairs.map(pair=>pair.roundId)).size,3);assert.equal(finding.coverage.highArtists,6);assert.equal(finding.coverage.lowArtists,6);assert.deepEqual(finding.displayWorkIds,['w0','w1']);assert.equal(finding.support[0].annotationBasis[0].bindingStatus,'captured-preview-hash');assert.match(finding.text,/Painting 0/);assert.match(finding.text,/Painting 1/);assert.equal(finding.exploratory,true);assert.equal(finding.independentReplicationClaim,false);assert.doesNotMatch(finding.text,/cause|probability|percentile|personality/);assert.deepEqual({works:f.works,rounds:f.rounds,answers:f.answers,annotationReviews:f.annotationReviews},before);
});

test('Rules are a finite predeclared list covering all16 source-reviewed criteria',()=>{
  assert.equal(TASTE_BOUNDARY_RULES.length,16);assert.equal(new Set(TASTE_BOUNDARY_RULES.map(r=>r.id)).size,16);assert.deepEqual([...new Set(TASTE_BOUNDARY_RULES.flatMap(r=>[r.shared,r.contrast]))].sort(),Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).sort());assert.equal(TASTE_BOUNDARY_THRESHOLDS.minimumHighWorks,3);assert.equal(TASTE_BOUNDARY_THRESHOLDS.minimumArtistsPerSide,3);
});

test('A common quality by itself, homogeneous ratings and near-neutral responses do not manufacture boundaries',()=>{
  for(const values of [[100,100,100,100],[0,0,0,0],[60,40,55,45]]){const f=fixture();for(const r of f.rounds)f.answers[r.id]=f.answer(r,values);assert.deepEqual(buildTasteBoundaries(f).findings,[]);}
  const f=fixture();for(const w of f.works)attr(f,w.id,'human-relationships','present');assert.deepEqual(buildTasteBoundaries(f).findings,[]);
});

test('Three high,three low and known artists on both sides are real minimums',()=>{
  const few=fixture(2);assert.deepEqual(buildTasteBoundaries(few).findings,[]);
  for(const side of [0,1]){const f=fixture();for(const [i,w] of f.works.entries())if(i%2===side)w.artist='One Painter';const model=buildTasteBoundaries(f);assert.deepEqual(model.findings,[]);assert.ok(model.rulesChecked.find(r=>r.id==='precision-relationships').reasons.includes('too-few-known-artists'));}
  const f=fixture();for(const [i,w] of f.works.entries())if(i%2)w.artist='Unidentified artist';assert.deepEqual(buildTasteBoundaries(f).findings,[]);
});

test('Attribution qualifiers and workshop names do not become extra independent named artists',()=>{
  const f=fixture();const variants=['Workshop of One Painter','Circle of One Painter','Attributed to One Painter'];for(const [i,w] of f.works.entries())if(i%2===0)w.artist=variants[Math.floor(i/4)];assert.deepEqual(buildTasteBoundaries(f).findings,[]);
});

test('Unreviewed,unknown and source-mismatched qualities are excluded rather than interpreted as absence',()=>{
  for(const mutate of [f=>{for(const w of f.works.filter((_,i)=>i%2))delete f.annotationReviews.reviews[w.id];},f=>{for(const w of f.works.filter((_,i)=>i%2))attr(f,w.id,'human-relationships','unknown');},f=>{for(const w of f.works.filter((_,i)=>i%2===0))w.sha256='f'.repeat(64);},f=>{f.annotationReviews.version='another';}]){
    const f=fixture();mutate(f);const model=buildTasteBoundaries(f);assert.deepEqual(model.findings,[]);const audit=model.rulesChecked.find(r=>r.id==='precision-relationships');assert.ok(audit.coverage.unknownSharedQuality+audit.coverage.unknownContrastWithinShared>0);
  }
});

test('Legacy relative spectra, contextual preferences and appraisal labels are not pooled into overall high or low',()=>{
  for(const mode of ['legacy','context','appraisal']){const f=fixture();for(const r of f.rounds){if(mode==='legacy'){delete r.evidence.appealProtocol;delete r.evidence.measurementScope;r.scale={left:'Less preferred',right:'More preferred'};}else if(mode==='context'){r.evidence.unconditional=false;}else r.evidence.construct='looking-appraisal';}const model=buildTasteBoundaries(f);assert.deepEqual(model.findings,[]);assert.equal(model.coverage.distinctDiscoveryWorks,0);}
});

test('Incomplete,malformed,hidden and identity-mismatched answers cannot supply a third discovery set',()=>{
  for(const mutate of [f=>f.answers.p2.confirmed=false,f=>delete f.answers.p2.positions.w8,f=>f.answers.p2.positions.w8=undefined,f=>f.answers.p2.workIds.reverse(),f=>f.answers.p2.roundId='another',f=>f.rounds[2].evidence.stimulusVisibility='not-shown']){const f=fixture();mutate(f);assert.deepEqual(buildTasteBoundaries(f).findings,[]);}
});

test('Exact repeats, probes and repeated artworks do not enlarge discovery coverage',()=>{
  const f=fixture(),r={...f.rounds[0],id:'later-repeat',evidence:{...f.rounds[0].evidence,role:'repeat',repeatOf:'p0'}};f.rounds.push(r);f.answers[r.id]=f.answer(r,[90,10,80,20]);const model=buildTasteBoundaries(f);assert.equal(model.coverage.distinctDiscoverySets,3);assert.equal(model.coverage.distinctDiscoveryWorks,12);assert.equal(main(model).highWorkIds.length,6);
  const probe=fixture();for(const r of probe.rounds)r.evidence.role='probe';assert.deepEqual(buildTasteBoundaries(probe).findings,[]);
  const repeated=fixture();repeated.rounds[2]={...repeated.rounds[0],id:'p2'};repeated.answers.p2=repeated.answer(repeated.rounds[2],[90,10,80,20]);assert.deepEqual(buildTasteBoundaries(repeated).findings,[]);
});

test('All opposing high and low examples remain visible, not only the first two',()=>{
  const f=fixture(4);f.answers.p3=f.answer(f.rounds[3],[10,90,20,80]);const finding=main(buildTasteBoundaries(f));assert.ok(finding);assert.equal(finding.counterWorkIds.length,4);assert.deepEqual(finding.counterWorkIds.sort(),['w12','w13','w14','w15']);assert.equal(finding.counterExamples.length,4);assert.equal(finding.counter.length,4);assert.equal(finding.coverage.highWithContrast,6);assert.equal(finding.coverage.highWithoutContrast,2);assert.equal(finding.coverage.lowWithContrast,2);assert.equal(finding.coverage.lowWithoutContrast,6);
});

test('Substantial opposition in either rating band suppresses the boundary',()=>{
  const f=fixture();f.answers.p2=f.answer(f.rounds[2],[10,90,20,80]);assert.equal(main(buildTasteBoundaries(f)),undefined);
});

test('A whole-question response shift needs actual same-set contrast evidence',()=>{
  const f=fixture(6);for(const [i,r] of f.rounds.entries()){for(const w of r.works)attr(f,w.id,'human-relationships',i<3?'present':'absent');f.answers[r.id]=f.answer(r,r.works.map(()=>i<3?90:10));}const model=buildTasteBoundaries(f);assert.deepEqual(model.findings,[]);const rule=model.rulesChecked.find(r=>r.id==='precision-relationships');assert.equal(rule.coverage.distinctDiscoverySets,6);assert.equal(rule.coverage.sameSetContrasts,0);assert.ok(rule.reasons.includes('too-few-same-set-contrasts'));
});

test('A reverse direction remains a specific contrast with the actual high and low illustration roles',()=>{
  const f=fixture();for(const r of f.rounds)f.answers[r.id]=f.answer(r,[10,90,20,80]);const finding=main(buildTasteBoundaries(f));assert.ok(finding);assert.equal(finding.direction,-1);assert.deepEqual(finding.displayWorkIds,['w1','w0']);assert.match(finding.displayNotes.w1,/High/);assert.match(finding.displayNotes.w0,/Low/);
});

test('Explicit favourites can corroborate or challenge, while unselected works remain actual ratings only',()=>{
  const f=fixture();f.favourites(['w0','w4','w8']);let model=buildTasteBoundaries(f);assert.equal(model.coverage.explicitFavourites,3);assert.equal(main(model).coverage.lowWithoutContrast,6);assert.ok(main(model).high.filter(r=>r.explicitFavourite).length===3);
  const conflict=fixture();conflict.favourites(['w1','w5','w9']);model=buildTasteBoundaries(conflict);const finding=main(model);assert.ok(finding);assert.ok(['w1','w5','w9'].every(id=>!finding.lowWorkIds.includes(id)));assert.equal(finding.coverage.revisedOrConflictedWorks,3);assert.ok(finding.counter.some(e=>e.construct==='overall-favourites'));assert.ok(finding.sourceRoundIds.includes('favourites'));
});

test('Later comparable reversals remove stale low examples instead of silently preserving the old finding',()=>{
  const f=fixture();for(const original of [...f.rounds]){const r={...original,id:'repeat-'+original.id,evidence:{...original.evidence,role:'repeat',repeatOf:original.id}};f.rounds.push(r);f.answers[r.id]=f.answer(r,[90,90,80,85]);}const model=buildTasteBoundaries(f);assert.deepEqual(model.findings,[]);assert.equal(model.coverage.initialLowWorks,6);assert.equal(model.coverage.stableLowWorks,0);assert.equal(model.coverage.revisedOrConflictedWorks,6);
});

test('One revised example remains named counterevidence without becoming a new independent painting',()=>{
  const f=fixture(4),r={...f.rounds[0],id:'repeat',evidence:{...f.rounds[0].evidence,role:'repeat',repeatOf:'p0'}};f.rounds.push(r);f.answers.repeat=f.answer(r,[90,90,80,20]);const model=buildTasteBoundaries(f),finding=main(model);assert.ok(finding);assert.equal(model.coverage.distinctDiscoveryWorks,16);assert.equal(finding.revisedExamples.length,1);assert.equal(finding.revisedExamples[0].workId,'w1');assert.ok(finding.counter.some(e=>e.roundId==='repeat'));assert.ok(!finding.lowWorkIds.includes('w1'));
});

test('Nested claims with the same high and low paintings collapse without losing their alternative audit',()=>{
  const f=fixture();for(const w of f.works)attr(f,w.id,'pattern-rhythm','present');const model=buildTasteBoundaries(f);assert.ok(model.coverage.qualifiedBeforeCollapse>=2);assert.equal(model.findings.length,1);assert.ok(model.findings[0].relatedRuleIds.length);assert.ok(model.findings[0].relatedContrasts[0].supportPairs.length>=2);assert.equal(model.coverage.distinctDiscoveryWorks,12);
});

test('A revised middle rating that now supports the contrast is a response revision,not opposing evidence',()=>{
  const f=fixture(4);f.answers.p0=f.answer(f.rounds[0],[50,10,80,20]);const r={...f.rounds[0],id:'repeat',evidence:{...f.rounds[0].evidence,role:'repeat',repeatOf:'p0'}};f.rounds.push(r);f.answers.repeat=f.answer(r,[90,10,80,20]);const finding=main(buildTasteBoundaries(f));assert.ok(finding);assert.ok(!finding.counter.some(e=>e.workIds.includes('w0')));assert.ok(finding.responseRevisions.some(e=>e.workIds.includes('w0')));assert.ok(!finding.dependentCounterWorkIds.includes('w0'));
});
