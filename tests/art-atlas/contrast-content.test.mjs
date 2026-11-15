import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTRAST_CONTENT_BANK,CONTRAST_KINDS,RELATIONSHIP_OPTIONS,selectContrastContent,selectSubjectBaselinePair} from '../../public/art-atlas/contrast-content.mjs';

const works=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8'));
const notes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
const byId=new Map(works.map(work=>[work.id,work]));
const select=(kind,extra={})=>selectContrastContent({works,notes,kind,seed:'reviewed-contrast-tests',...extra});
const allIds=result=>[...result.workIds,...(result.anchorId?[result.anchorId]:[])];
const snapshot=(result,index)=>({id:'contrast-history-'+index,...result});
const ordinary=(id,workIds)=>({id,kind:'spectrum',criterion:'preference',workIds,evidence:{construct:'preference',family:'individual-choice'}});
const complete=round=>({workIds:[...round.workIds],criterion:'preference',positions:Object.fromEntries(round.workIds.map((id,i)=>[id,i?80:20])),confirmed:true});

test('The twenty-four reviewed sets use actual source-linked study works and the promised format sizes',()=>{
  assert.equal(CONTRAST_CONTENT_BANK.length,24);
  assert.equal(new Set(CONTRAST_CONTENT_BANK.map(row=>row.contentId)).size,24);
  for(const kind of CONTRAST_KINDS)assert.equal(CONTRAST_CONTENT_BANK.filter(row=>row.kind===kind).length,6);
  for(const row of CONTRAST_CONTENT_BANK){
    assert.equal(row.workIds.length,row.kind==='keep-leave'?6:row.kind==='same-subject'?2:4);
    assert.equal(new Set(row.workIds).size,row.workIds.length);
    for(const id of [...row.workIds,...(row.anchorId?[row.anchorId]:[])])assert.ok(byId.get(id)?.sourceUrl,id);
    if(row.kind==='keep-leave')assert.ok(row.workIds.every(id=>byId.get(id).recognitionTier==='landmark'));
    if(row.kind==='same-subject'){assert.equal(row.subject.reviewed,true);assert.equal(row.subject.matchLevel,'subject-family');assert.equal(row.subject.samePersonOrPlace,false);assert.ok(row.residualConfounds.length>=2);}
  }
});

test('Ready contracts have source links, clear constructs and independent anchor IDs',()=>{
  for(const kind of CONTRAST_KINDS){
    const result=select(kind);
    assert.equal(result.status,'ready');assert.equal(result.kind,'contrast');assert.equal(result.contrastKind,kind);
    assert.ok(result.title&&result.prompt&&result.hint&&result.construct);
    assert.ok(result.sourceUrls.length>=result.workIds.length);
    for(const id of allIds(result))assert.ok(result.sourceUrls.includes(byId.get(id).sourceUrl));
    assert.ok(result.curationNotes.length);assert.ok(result.residualConfounds.length);
    assert.equal(result.exposureAudit.unseenClaim,false);
    if(kind==='neighbour'){assert.ok(result.anchorId);assert.ok(!result.workIds.includes(result.anchorId));assert.equal(result.noCorrectNeighbour,true);assert.deepEqual(result.relationshipOptions,RELATIONSHIP_OPTIONS);}
  }
});

test('Seeded output is deterministic, independent of catalogue order, and does not mutate its inputs',()=>{
  const before=structuredClone({works,notes});
  const a=select('neighbour'),b=select('neighbour',{works:[...works].reverse()});
  assert.deepEqual(a,b);assert.deepEqual(select('neighbour'),a);
  assert.deepEqual({works,notes},before);
  const orders=new Set(Array.from({length:12},(_,i)=>JSON.stringify(select('neighbour',{seed:'different-'+i}).workIds)));
  assert.ok(orders.size>1);
  a.curationNotes.push('Output-only mutation');a.relationshipOptions[0].label='Changed';
  assert.notDeepEqual(select('neighbour'),a);assert.equal(RELATIONSHIP_OPTIONS[0].label,'Colour');
});

test('New content avoids an exact historical set even when its display order changes',()=>{
  const first=select('keep-leave');
  const next=select('keep-leave',{rounds:[{id:'earlier',kind:'choice-grid',workIds:[...first.workIds].reverse()}]});
  assert.equal(next.status,'ready');assert.notEqual(next.contentId,first.contentId);
  assert.ok(next.selectionAudit.rejected.some(row=>row.contentId===first.contentId));
  assert.equal(next.exposureAudit.exactSetPreviouslyPlannedOrPresented,false);
});

test('All six variants can be selected once, then exhaustion is explicit',()=>{
  for(const kind of CONTRAST_KINDS){
    const rounds=[],seen=new Set();
    for(let batchIndex=0;batchIndex<6;batchIndex++){
      const result=select(kind,{rounds,batchIndex});assert.equal(result.status,'ready',kind+' '+batchIndex);
      assert.ok(!seen.has(result.contentId));seen.add(result.contentId);rounds.push(snapshot(result,batchIndex));
    }
    const exhausted=select(kind,{rounds,batchIndex:2});
    assert.equal(exhausted.status,'unavailable');assert.deepEqual(exhausted.workIds,[]);assert.match(exhausted.reason,/No unused eligible/);
  }
});

test('A recent explicit presentation favours another valid set without inventing a preference answer',()=>{
  const baseline=select('keep-leave');assert.equal(baseline.contentId,'keep-six-landmarks-a');
  const recent=baseline.workIds[0];
  const result=select('keep-leave',{rounds:[{id:'recent-image',kind:'context',workIds:[recent],presentedIds:[recent]}]});
  assert.equal(result.status,'ready');assert.notEqual(result.contentId,baseline.contentId);
  assert.equal(result.exposureAudit.recentKnownOverlap,0);
  assert.deepEqual(result.exposureAudit.previousOrdinaryPreferenceIds,[]);
});

test('A museum offering all 99 works leaves actual exposure unknown and does not exhaust the bank',()=>{
  const result=select('keep-leave',{rounds:[{id:'museum',kind:'exercise',exerciseKind:'curate',works}]});
  assert.equal(result.status,'ready');assert.deepEqual(result.exposureAudit.knownPresentedIds,[]);
  assert.equal(result.exposureAudit.unknownExposureIds.length,6);
  assert.deepEqual(result.exposureAudit.noRecordedPresentationIds,[]);
  assert.deepEqual(result.exposureAudit.previousOrdinaryPreferenceIds,[]);
  assert.equal(result.exposureAudit.unseenClaim,false);
});

test('An offered99 museum cannot erase planned question spacing when no answers exist',()=>{
  const planned={id:'planned-opening',kind:'spectrum',criterion:'preference',workIds:['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss']};
  const withoutMuseum=select('keep-leave',{rounds:[planned],answers:{}});
  const withMuseum=select('keep-leave',{rounds:[planned,{id:'offered-museum',kind:'exercise',exerciseKind:'curate',works}],answers:{}});
  assert.notEqual(withoutMuseum.contentId,'keep-six-landmarks-a');
  assert.equal(withMuseum.contentId,withoutMuseum.contentId);
  assert.equal(withMuseum.exposureAudit.recentPlannedQuestionOverlap,0);
  assert.deepEqual(withMuseum.exposureAudit.knownPresentedIds,[]);
  assert.equal(withMuseum.exposureAudit.unknownExposureIds.length,6);
  assert.equal(withMuseum.exposureAudit.unseenClaim,false);
  assert.match(withMuseum.exposureAudit.plannedSpacingScope,/not evidence of actual viewing/);
});

test('Planned candidates and their separate anchor count as specific questions, never as actual viewing',()=>{
  const six=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='keep-six-landmarks-a').workIds;
  const anchorId='van-gogh-starry-night',candidates=six.filter(id=>id!==anchorId).slice(0,4);
  const result=select('keep-leave',{works:six.map(id=>byId.get(id)),rounds:[{id:'planned-neighbour',kind:'contrast',contrastKind:'neighbour',workIds:candidates,anchorId}],answers:{}});
  assert.equal(result.status,'ready');
  assert.equal(result.exposureAudit.plannedQuestionLastIndex[anchorId],0);
  assert.equal(result.exposureAudit.plannedQuestionPresentationCounts[anchorId],1);
  assert.equal(result.exposureAudit.recentPlannedQuestionOverlap,5);
  assert.equal(result.exposureAudit.recentKnownOverlap,0);
  assert.deepEqual(result.exposureAudit.knownPresentedIds,[]);
  for(const id of [...candidates,anchorId])assert.equal(result.exposureAudit.knownPresentationCounts[id],0);
  assert.equal(result.exposureAudit.unseenClaim,false);
});

test('Planned spacing takes priority over the preferred batch label',()=>{
  const phase=select('keep-leave',{batchIndex:1});assert.equal(phase.contentId,'keep-six-landmarks-b');
  const result=select('keep-leave',{batchIndex:1,rounds:[{id:'planned-one',kind:'context',workIds:[phase.workIds[0]]}],answers:{}});
  assert.equal(result.status,'ready');assert.notEqual(result.contentId,phase.contentId);
  assert.equal(result.exposureAudit.recentPlannedQuestionOverlap,0);
  assert.deepEqual(result.exposureAudit.knownPresentedIds,[]);
});

test('Explicit museum events count only the actually recorded images, not the entire offered tray',()=>{
  const round={id:'museum',kind:'exercise',exerciseKind:'curate',works};
  const a={record:{presentedIds:['study-leonardo-mona-lisa'],placements:{}}};
  const result=select('keep-leave',{rounds:[round],answers:{museum:a}});
  assert.equal(result.status,'ready');
  for(const id of allIds(result))assert.equal(result.exposureAudit.knownPresentationCounts[id],id==='study-leonardo-mona-lisa'?1:0);
  assert.deepEqual(result.exposureAudit.previousOrdinaryPreferenceIds,[]);
  const allShown=select('keep-leave',{rounds:[{...round,presentedIds:works.map(work=>work.id)}]});
  assert.equal(allShown.status,'ready');assert.equal(allShown.exposureAudit.knownPresentedIds.length,6);
  assert.deepEqual(allShown.exposureAudit.noRecordedPresentationIds,[]);assert.equal(allShown.exposureAudit.unseenClaim,false);
});

test('Actual ordinary preference answers stay distinct from contextual, unconfirmed and non-preference responses',()=>{
  const round={id:'rated',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice'}};
  const answer={confirmed:true,criterion:'preference',workIds:works.map(work=>work.id),positions:Object.fromEntries(works.map(work=>[work.id,50]))};
  const good=select('keep-leave',{rounds:[round],answers:{rated:answer}});
  assert.equal(good.exposureAudit.previousOrdinaryPreferenceIds.length,6);
  assert.equal(good.exposureAudit.knownPresentedIds.length,6);
  for(const variant of [{round,answer:{...answer,confirmed:false}},{round:{...round,evidence:{...round.evidence,unconditional:false}},answer},{round:{...round,criterion:'interest'},answer:{...answer,criterion:'interest'}},{round:{...round,anchorIds:[works[0].id]},answer}]){
    const result=select('keep-leave',{rounds:[variant.round],answers:{rated:variant.answer}});
    assert.deepEqual(result.exposureAudit.previousOrdinaryPreferenceIds,[]);
  }
});

test('All six chronology sets freeze the twelve reused source-linked intervals and avoid answer-order leakage',()=>{
  const rounds=[];
  for(let batchIndex=0;batchIndex<6;batchIndex++){
    const result=select('chronology',{batchIndex,rounds});assert.equal(result.status,'ready');
    assert.equal(result.hideDatesUntilFeedback,true);assert.equal(result.canonicalOrder.length,4);
    assert.notDeepEqual(result.workIds,result.canonicalOrder);
    let end=-Infinity;
    for(const id of result.canonicalOrder){
      const record=result.dateEvidence[id];assert.deepEqual(record.yearRange,byId.get(id).analysis.yearRange);
      assert.ok(record.yearRange[0]>end);end=record.yearRange[1];
      assert.match(record.sourceUrl,/^https:\/\//);assert.ok(record.displayDate);assert.ok(record.uncertaintyNote);
      assert.ok(result.sourceUrls.includes(record.sourceUrl));
    }
    assert.ok(Object.values(result.dateEvidence).some(record=>record.approximate));
    rounds.push(snapshot(result,batchIndex));
  }
});

test('Unknown, changed or overlapping date intervals require review rather than a guessed order',()=>{
  const before=select('chronology');
  const badIds=new Set(before.workIds);
  const modified=works.map(work=>badIds.has(work.id)?{...work,analysis:{...work.analysis,yearRange:[1000,1950]}}:work);
  const alternative=select('chronology',{works:modified});assert.equal(alternative.status,'ready');assert.notEqual(alternative.contentId,before.contentId);
  assert.ok(alternative.selectionAudit.rejected.some(row=>/date ranges/.test(row.reason)));
  const noDates=works.map(work=>({...work,analysis:{...work.analysis,yearRange:null}}));
  const none=select('chronology',{works:noDates});assert.equal(none.status,'unavailable');assert.deepEqual(none.workIds,[]);
});

test('Reviewed same-subject preferences respect the first64 and later cumulative rating allocations',()=>{
  const currentFirst=new Set(notes.proposedFirst18Panels.flatMap(panel=>panel.workIds));
  const rounds=[];
  for(let i=0;i<4;i++){const selected=select('same-subject',{rounds,batchIndex:0});assert.equal(selected.status,'ready');assert.ok(selected.workIds.every(id=>currentFirst.has(id)));rounds.push(snapshot(selected,i));}
  const waiting=select('same-subject',{rounds,batchIndex:0});assert.equal(waiting.status,'unavailable');
  assert.ok(waiting.rejected.some(row=>/reserved/.test(row.reason)));
  const flowers=select('same-subject',{rounds,batchIndex:1});assert.equal(flowers.status,'ready');assert.equal(flowers.contentId,'subject-flowers');
  assert.equal(flowers.subject.reviewed,true);assert.equal(flowers.subject.samePersonOrPlace,false);
  rounds.push(snapshot(flowers,4));
  const objects=select('same-subject',{rounds,batchIndex:1});assert.equal(objects.status,'ready');assert.equal(objects.contentId,'subject-object-still-lifes');
});

test('Existing content identities stay stable and all six keep/leave sets use different landmark works',()=>{
  const original=['keep-six-landmarks-a','keep-six-landmarks-b','keep-six-landmarks-c','neighbour-starry-night','neighbour-milkmaid','neighbour-great-wave','chronology-spring-to-scream','chronology-pearl-to-mondrian','chronology-ancient-to-gothic','subject-mountains','subject-portraits','subject-flowers'];
  assert.deepEqual(CONTRAST_CONTENT_BANK.slice(0,12).map(row=>row.contentId),original);
  const keepIds=CONTRAST_CONTENT_BANK.filter(row=>row.kind==='keep-leave').flatMap(row=>row.workIds);
  assert.equal(keepIds.length,36);assert.equal(new Set(keepIds).size,36);
});

test('Two first64 reviewed pairs meet the unchanged .25 complexity gate without editing descriptors',()=>{
  const first=new Set(notes.proposedFirst18Panels.flatMap(panel=>panel.workIds));
  const pairs=['subject-mountains','subject-adults-children'].map(id=>CONTRAST_CONTENT_BANK.find(row=>row.contentId===id));
  assert.equal(new Set(pairs.flatMap(row=>row.workIds)).size,4);
  for(const row of pairs){assert.equal(row.subject.reviewed,true);assert.ok(row.workIds.every(id=>first.has(id)));const [a,b]=row.workIds.map(id=>byId.get(id));assert.ok(Math.abs(a.features.complexity-b.features.complexity)>=.25);}
  for(const id of ['subject-portraits','subject-object-still-lifes']){const row=CONTRAST_CONTENT_BANK.find(row=>row.contentId===id),[a,b]=row.workIds.map(id=>byId.get(id));assert.ok(Math.abs(a.features.abstraction-b.features.abstraction)>=.25);}
});

test('Missing source links, duplicate identities and decorative substitutions are rejected without fabricated fillers',()=>{
  const onlyA=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='keep-six-landmarks-a').workIds.map(id=>byId.get(id));
  assert.equal(select('keep-leave',{works:onlyA}).status,'ready');
  assert.equal(select('keep-leave',{works:onlyA.map((w,i)=>i? w:{...w,sourceUrl:''})}).status,'unavailable');
  assert.equal(select('keep-leave',{works:[...onlyA,onlyA[0]]}).status,'unavailable');
  assert.equal(select('keep-leave',{works:onlyA.map((w,i)=>i? w:{...w,decorativeOnly:true})}).status,'unavailable');
  assert.equal(select('invented-kind').status,'unavailable');
});

test('The selector needs no invented visual features and not-shown definitions create no exposure claim',()=>{
  const withoutFeatures=works.map(({features,...rest})=>rest);
  assert.equal(select('same-subject',{works:withoutFeatures}).status,'ready');
  const result=select('keep-leave',{rounds:[{id:'text-only',kind:'statements',works,evidence:{stimulusVisibility:'not-shown'}}]});
  assert.equal(result.status,'ready');assert.deepEqual(result.exposureAudit.knownPresentedIds,[]);assert.deepEqual(result.exposureAudit.unknownExposureIds,[]);
});

test('Completed exact-pair sources outrank planned opportunities and recent exposure without using their rank direction',()=>{
  const mountainIds=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='subject-mountains').workIds,portraitIds=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='subject-portraits').workIds;
  const mountain=ordinary('completed-mountains',mountainIds),portrait=ordinary('planned-portraits',portraitIds),rounds=[mountain,portrait,{id:'recent-mountain',kind:'context',workIds:[mountainIds[0]],presentedIds:[mountainIds[0]]}];
  const answer=complete(mountain),result=select('same-subject',{rounds,answers:{[mountain.id]:answer},batchIndex:1});
  assert.equal(result.contentId,'subject-mountains');assert.equal(result.baselineLinks.completedPairCount,1);assert.equal(result.baselineLinks.plannedPairCount,0);
  assert.deepEqual(result.baselineLinks.sourceRoundIds,[mountain.id]);assert.equal(result.baselineLinks.numericRankingsInferred,false);assert.equal(result.selectionAudit.baselineFallback,false);
  const reversed={...answer,positions:Object.fromEntries(mountainIds.map(id=>[id,100-answer.positions[id]]))};
  assert.deepEqual(select('same-subject',{rounds,answers:{[mountain.id]:reversed},batchIndex:1}),result);
});

test('Planned ordinary sources create labelled opportunities, never completed ratings or viewing claims',()=>{
  const pair=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='subject-adults-children').workIds,source=ordinary('pending-source',pair);
  const result=select('same-subject',{rounds:[source]});
  assert.equal(result.contentId,'subject-adults-children');assert.equal(result.baselineLinks.completedPairCount,0);assert.equal(result.baselineLinks.plannedPairCount,1);
  assert.deepEqual(result.exposureAudit.previousOrdinaryPreferenceIds,[]);assert.deepEqual(result.exposureAudit.knownPresentedIds,[]);assert.equal(result.exposureAudit.unseenClaim,false);
  assert.equal(result.exposureAudit.exactSetPreviouslyPlannedOrPresented,true);assert.match(result.exposureAudit.crossSourceRevisit,/different instruction/);
  const consumed=select('same-subject',{rounds:[source,snapshot(result,1)]});
  assert.notEqual(consumed.contentId,result.contentId);assert.ok(consumed.selectionAudit.rejected.some(row=>row.contentId===result.contentId));
});

test('Skipped, partial, contextual and malformed sources cannot count as completed or planned pair evidence',()=>{
  const pair=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='subject-mountains').workIds,pool=pair.map(id=>byId.get(id)),source=ordinary('source',pair),answer=complete(source);
  const badAnswers=[{...answer,skipped:true},{...answer,confirmed:false},{...answer,positions:{[pair[0]]:20.5,[pair[1]]:80}},{...answer,workIds:[...pair].reverse()},{...answer,positions:{[pair[0]]:20}}];
  for(const bad of badAnswers){const result=select('same-subject',{works:pool,rounds:[source],answers:{source:bad}});assert.equal(result.status,'unavailable');}
  for(const contextual of [{...source,brief:'Choose for this room.'},{...source,evidence:{...source.evidence,unconditional:false}},{...source,anchorIds:[pair[0]]}]){
    const result=select('same-subject',{works:pool,rounds:[contextual],answers:{source:answer}});assert.equal(result.status,'unavailable');
  }
  const standalone=select('same-subject',{works:pool});assert.equal(standalone.status,'ready');assert.equal(standalone.selectionAudit.baselineFallback,true);assert.match(standalone.selectionAudit.baselineFallbackReason,/standalone categorical/);
});

test('The existing bridge prepares only an unused reviewed pair inside preceding ordinary questions',()=>{
  const prior=notes.proposedFirst18Panels.map(panel=>ordinary('panel-'+panel.panel,panel.workIds));
  const used=CONTRAST_CONTENT_BANK.find(row=>row.contentId==='subject-adults-children');
  prior.push({id:'used-subject',kind:'contrast',contrastKind:'same-subject',contentId:used.contentId,workIds:used.workIds});
  const preparation=selectSubjectBaselinePair({works,notes,rounds:prior,seed:'preparation',batchIndex:0});
  assert.equal(preparation.status,'ready');assert.equal(preparation.preparesContrastContentId,'subject-mountains');assert.equal(preparation.statusAtSelection,'planned-individual-ratings');
  assert.ok(preparation.workIds.every(id=>prior.filter(row=>row.kind==='spectrum').some(row=>row.workIds.includes(id))));
  assert.equal(preparation.ordinaryPoolSourceRoundIds.length,2);
  const onlyCategorical=selectSubjectBaselinePair({works,notes,rounds:[{id:'keep',kind:'contrast',contrastKind:'keep-leave',workIds:preparation.workIds}],batchIndex:0});
  assert.equal(onlyCategorical.status,'unavailable');
  const baseline=ordinary('now-paired',preparation.workIds),again=selectSubjectBaselinePair({works,notes,rounds:[...prior,baseline],batchIndex:0});
  assert.notEqual(again.preparesContrastContentId,preparation.preparesContrastContentId);
});
