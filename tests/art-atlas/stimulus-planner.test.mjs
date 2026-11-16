import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planStimulusPanels,FIRST_PANEL_SIZES} from '../../public/art-atlas/stimulus-planner.mjs';
import {planAdaptivePanels} from '../../public/art-atlas/adaptive-selection.mjs';
import {buildJourneyRounds} from '../../public/art-atlas/journey-bank.mjs';
import {legacyV8Rounds} from './helpers/legacy-v8.mjs';
import {FEATURE_SEMANTIC_VERSION} from '../../public/art-atlas/visual-descriptor-semantics.mjs';
const reviewedNotes=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/curation-notes.json',import.meta.url),'utf8'));
const legacyIds=new Set([...reviewedNotes.proposedFirst18Panels.flatMap(panel=>panel.workIds),...reviewedNotes.reservePools.batch2,...reviewedNotes.reservePools.batch3]);
const actual=JSON.parse(fs.readFileSync(new URL('../../public/art-atlas/artworks.json',import.meta.url),'utf8')).filter(work=>legacyIds.has(work.id));
const featureKeys=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
function synthetic(count=99){const countries=['France','Mexico','China','India','Egypt','United States'],years=[1100,1500,1700,1820,1880,1920];return Array.from({length:count},(_,i)=>({id:'w'+String(i).padStart(3,'0'),title:'Work '+i,artist:'Artist '+i,featureSemanticVersion:FEATURE_SEMANTIC_VERSION,sourceUrl:'https://museum.example/'+i,image:'art-'+i+'.jpg',country:countries[i%6],movement:'Tradition '+i%20,recognitionTier:i<50?'landmark':i<86?'established':'discovery',features:Object.fromEntries(featureKeys.map((f,k)=>[f,((i*(k+3)+k)%11)/10])),analysis:{yearRange:[years[i%6],years[i%6]]}}));}
function responsesFor(plan,works,batchIndex=0,prefix='source'){
  const byId=new Map(works.map(work=>[work.id,work])),rounds=plan.panels.map((panel,i)=>({id:prefix+'-'+(i+1),kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Equal positions are fine.',scale:{left:'Less preferred',right:'More preferred'},works:panel.workIds.map(id=>byId.get(id)),evidence:{construct:'preference',family:'individual-choice',role:panel.role==='repeat'?'repeat':panel.role==='exploration'||panel.role==='discovery'?'discovery':'probe',batchIndex,setId:prefix+'-set-'+i,...(panel.repeatOf?{repeatOf:panel.repeatOf}:{})}})),answers=Object.fromEntries(rounds.map(round=>[round.id,{workIds:round.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.abstraction*100)])),confirmed:true}]));return {rounds,answers};
}
const set=items=>new Set(items);

test('The real first block uses72 unique works, map quartets, a four-icon opener and restrained landmark use',()=>{
  const p=planStimulusPanels({works:actual,seed:'first-block'});assert.equal(p.status,'complete');assert.equal(p.panels.length,18);assert.deepEqual(p.panels.map(panel=>panel.workIds.length),Array(18).fill(4));assert.equal(p.coverage.selectedSlots,72);assert.equal(p.coverage.uniqueWorkCount,72);assert.deepEqual(p.panels[0].workIds,['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss']);
  assert.ok(p.audit.panels.slice(1).every(panel=>panel.landmarkCount<=2));assert.ok(p.audit.panels.reduce((n,panel)=>n+panel.landmarkCount,0)<=38);assert.ok(p.coverage.minimumTargets.era.met);assert.ok(p.coverage.minimumTargets.region.met);assert.ok(p.coverage.minimumTargets.country.met);assert.ok(p.coverage.minimumTargets.tradition.met);assert.ok(p.audit.annotationMatchedContrasts>0);assert.ok(p.audit.regionalTransferPanels.length>0);
  assert.equal(p.reservations.batch2.length,42);assert.equal(p.reservations.batch3.length,42);assert.equal(new Set([...p.coverage.selectedWorkIds,...p.reservations.batch2,...p.reservations.batch3]).size,actual.length);assert.equal(p.reservations.scope,'first-preference-ratings');
});

test('The reviewed72/42/42 allocation is honoured with actual eras, countries, traditions and no reserved first-rating leakage',()=>{
  const first=planStimulusPanels({works:actual,curationNotes:reviewedNotes,seed:'reviewed-allocation'});assert.equal(first.complete,true);assert.deepEqual(first.audit.rejectedBriefs,[]);assert.equal(first.coverage.uniqueWorkCount,72);assert.equal(first.coverage.selectedSlots,72);assert.equal(first.audit.panels.reduce((count,panel)=>count+panel.landmarkCount,0),43);
  for(let i=0;i<18;i++)assert.deepEqual(new Set(first.panels[i].workIds),new Set(reviewedNotes.proposedFirst18Panels.find(panel=>panel.panel===i+1).workIds));
  assert.deepEqual(first.reservations.batch2,reviewedNotes.reservePools.batch2);assert.deepEqual(first.reservations.batch3,reviewedNotes.reservePools.batch3);assert.ok(first.coverage.minimumTargets.era.met);assert.ok(first.coverage.minimumTargets.region.met);assert.ok(first.coverage.minimumTargets.country.met);assert.ok(first.coverage.minimumTargets.tradition.met);
  const h=responsesFor(first,actual),second=planStimulusPanels({works:actual,...h,batchIndex:1,seed:'reviewed-allocation',curationNotes:reviewedNotes,reservationPlan:first.reservations});assert.equal(second.complete,true);assert.deepEqual(new Set(second.coverage.firstRatingWorkIds),new Set(reviewedNotes.reservePools.batch2));
  const h2=responsesFor(second,actual,1,'reviewed-two'),third=planStimulusPanels({works:actual,rounds:[...h.rounds,...h2.rounds],answers:{...h.answers,...h2.answers},batchIndex:2,seed:'reviewed-allocation',curationNotes:reviewedNotes,reservationPlan:first.reservations});assert.equal(third.complete,true);assert.deepEqual(new Set(third.coverage.firstRatingWorkIds),new Set(reviewedNotes.reservePools.batch3));assert.equal(new Set([...first.coverage.selectedWorkIds,...second.coverage.selectedWorkIds,...third.coverage.selectedWorkIds]).size,actual.length);
});

test('Seeded output is deterministic and catalogue order does not change its choices or evidence',()=>{
  const works=synthetic(),a=planStimulusPanels({works,seed:'one'}),b=planStimulusPanels({works:[...works].reverse(),seed:'one'});assert.deepEqual(a,b);const c=planStimulusPanels({works,seed:'two'});assert.notDeepEqual(a.panels.map(p=>p.workIds),c.panels.map(p=>p.workIds));
});

test('The actual canonical-anchor and tradition-anchor vocabulary changes an otherwise equal selection',()=>{
  const works=synthetic(12).map(work=>({...work,recognitionTier:'established',country:'France',movement:'Shared tradition',analysis:{yearRange:[1900,1900]},features:Object.fromEntries(featureKeys.map(feature=>[feature,.5]))})),notes={annotations:[{workId:works[10].id,importanceTier:'canonical-anchor'},{workId:works[11].id,importanceTier:'tradition-anchor'}]},p=planStimulusPanels({works,curationNotes:notes,panelCount:1,panelSizes:[2],seed:'importance-vocabulary'});assert.deepEqual(new Set(p.panels[0].workIds),new Set([works[10].id,works[11].id]));
});

test('Explicit editorial briefs retain concrete questions, pairs, confounds, sources and preference-only reserves',()=>{
  const works=synthetic(),chosen=works.slice(50,54).map(w=>w.id),notes={annotations:works.map(work=>({workId:work.id,importanceTier:'tradition-anchor',regionKey:work.country,eraKey:'era-'+work.analysis.yearRange[0],traditionKey:work.movement,subjectFamily:'landscape',sourceUrls:['https://institution.example/'+work.id]})),proposedFirst18Panels:[{panel:1,workIds:chosen,targetFeature:'energy',contrastPairs:[[chosen[0],chosen[2]],[chosen[1],chosen[3]]],primaryQuestion:'Does depicted activity change the choice?',sharedGround:'Related subjects.',confounds:['Dates and materials differ.']}],reservePools:{batch2:works.slice(64,82).map(w=>w.id),batch3:works.slice(82).map(w=>w.id)}};
  const before=structuredClone(notes),result=planStimulusPanels({works,curationNotes:notes,seed:'briefs'});assert.deepEqual(result.panels[0].workIds,chosen);assert.equal(result.panels[0].editorialBrief.primaryQuestion,'Does depicted activity change the choice?');assert.deepEqual(result.panels[0].plannerDiagnostic.pairs.map(pair=>pair.workIds),notes.proposedFirst18Panels[0].contrastPairs);assert.ok(result.audit.panels[0].sourceUrls.includes('https://institution.example/'+chosen[0]));assert.ok(!result.coverage.selectedWorkIds.some(id=>notes.reservePools.batch3.includes(id)));assert.deepEqual(result.reservations.batch2,notes.reservePools.batch2);result.panels[0].editorialBrief.confounds.push('Changed output copy');assert.deepEqual(notes,before);
});

test('An invalid or reserved editorial proposal is rejected visibly rather than replacing a work or leaking a reserve',()=>{
  const works=synthetic(),reserved=works.slice(-17).map(w=>w.id),notes={proposedFirst18Panels:[{panel:1,workIds:[reserved[0],reserved[1],reserved[2],'missing']}],reservePools:{batch3:reserved}};const p=planStimulusPanels({works,curationNotes:notes,seed:'rejected'});assert.equal(p.audit.rejectedBriefs.length,1);assert.ok(!p.coverage.selectedWorkIds.some(id=>reserved.includes(id)));assert.ok(!p.coverage.selectedWorkIds.includes('missing'));
});

test('Known zero descriptors are compared, but unknown features and metadata never become zero or a known region',()=>{
  const works=synthetic(70).map(work=>({...work,recognitionTier:'established',features:undefined,country:undefined,movement:undefined,analysis:{yearRange:null}})),p=planStimulusPanels({works,seed:'unknown'});assert.equal(p.complete,true);assert.equal(p.audit.annotationMatchedContrasts,0);assert.equal(p.coverage.unknownMetadataCounts.region,p.coverage.uniqueWorkCount);assert.equal(p.coverage.minimumTargets.region.achieved,0);assert.ok(p.panels.every(panel=>panel.plannerDiagnostic.targetGap===null));assert.ok(p.audit.panels.every(panel=>!panel.diagnostic.regionTransfer));
  const four=synthetic(4).map((work,i)=>({...work,recognitionTier:'established',features:Object.fromEntries(featureKeys.map(feature=>[feature,feature==='energy'?i%2:0]))})),ids=four.map(w=>w.id),notes={annotations:[{workId:ids[0],regionKey:'a'},{workId:ids[2],regionKey:'b'},{workId:ids[3],regionKey:'b'}],proposedFirst18Panels:[{panel:1,workIds:ids,targetFeature:'energy',contrastPairs:[[ids[0],ids[1]],[ids[2],ids[3]]]}]};delete four[1].country;
  const pair=planStimulusPanels({works:four,curationNotes:notes,panelCount:1,panelSizes:[4]}).panels[0].plannerDiagnostic;assert.equal(pair.pairs[0].targetGap,1);assert.equal(pair.pairs[0].otherFeatureGaps.abstraction,0);assert.equal(pair.pairs[0].annotationMatched,true);assert.equal(pair.regionTransfer,false,'One known region in a pair does not identify the unknown one');
});

test('One large competing feature cannot be hidden inside a low mean confound score',()=>{
  const works=synthetic(4).map((work,i)=>({...work,recognitionTier:'established',features:Object.fromEntries(featureKeys.map(feature=>[feature,['energy','narrative'].includes(feature)?i%2:0]))})),workIds=works.map(work=>work.id),p=planStimulusPanels({works,panelCount:1,panelSizes:[4],curationNotes:{proposedFirst18Panels:[{panel:1,workIds,targetFeature:'energy',contrastPairs:[[workIds[0],workIds[1]]]}]}}),pair=p.panels[0].plannerDiagnostic.pairs[0];assert.ok(pair.meanOtherFeatureGap<.22);assert.equal(pair.maximumOtherFeatureGap,1);assert.equal(pair.annotationMatched,false);assert.ok(pair.residualConfounds.some(reason=>/more than 0.35/.test(reason)));
});

test('A semantic brief with no measured feature difference remains visible without a false numeric diagnostic claim',()=>{
  const works=synthetic(4).map(work=>({...work,recognitionTier:'established',features:Object.fromEntries(featureKeys.map(feature=>[feature,.5]))})),workIds=works.map(work=>work.id),p=planStimulusPanels({works,panelCount:1,panelSizes:[4],curationNotes:{proposedFirst18Panels:[{panel:1,workIds,targetFeature:'narrative',primaryQuestion:'Which scene suggests a story?'}]}});assert.equal(p.complete,true);assert.equal(p.panels[0].editorialBrief.primaryQuestion,'Which scene suggests a story?');assert.equal(p.panels[0].plannerDiagnostic.targetGap,0);assert.equal(p.audit.annotationMatchedContrasts,0);assert.equal(p.audit.annotationDiagnosticGaps.length,1);assert.equal(p.audit.annotationDiagnosticGaps[0].targetFeature,'narrative');assert.equal(p.audit.annotationDiagnosticGaps[0].largestRecordedGap,0);
  const unknown=planStimulusPanels({works:works.map(work=>({...work,features:undefined})),panelCount:1,panelSizes:[4],curationNotes:{proposedFirst18Panels:[{panel:1,workIds,targetFeature:'narrative'}]}});assert.equal(unknown.audit.annotationDiagnosticGaps[0].largestRecordedGap,null,'Unknown contrast is not a zero difference');
});

test('Whole-panel feature range stays distinct from close adjacent pairs and genuine declared contrast pairs',()=>{
  const values=[0,.05,.95,1],works=synthetic(4).map((work,i)=>({...work,recognitionTier:'established',features:Object.fromEntries(featureKeys.map(feature=>[feature,feature==='energy'?values[i]:.5]))})),workIds=works.map(work=>work.id),p=planStimulusPanels({works,panelCount:1,panelSizes:[4],curationNotes:{proposedFirst18Panels:[{panel:1,workIds,targetFeature:'energy'}]}}),d=p.panels[0].plannerDiagnostic;assert.equal(d.pairBasis,'descriptive-adjacent');assert.equal(d.targetSpread,1);assert.deepEqual(d.targetRange,[0,1]);assert.ok(d.pairs.every(pair=>pair.targetGap<.1));assert.deepEqual(p.audit.annotationDiagnosticGaps,[]);assert.equal(p.audit.annotationMatchedContrasts,0);
});

test('Later curation preserves every protected adaptive object and excludes its works from new exploration',()=>{
  const first=planStimulusPanels({works:actual,seed:'protect'}),h=responsesFor(first,actual),original=planAdaptivePanels({works:actual,rounds:h.rounds,answers:h.answers,batchIndex:1,seed:'protect'}),before=structuredClone(original),later=planStimulusPanels({works:actual,...h,batchIndex:1,seed:'protect',adaptivePlan:original,reservationPlan:first.reservations});
  assert.equal(later.complete,true);const protectedIds=set(original.panels.filter(p=>p.role!=='exploration').flatMap(p=>p.workIds));assert.ok(protectedIds.size);for(let i=0;i<18;i++)if(original.panels[i].role!=='exploration')assert.deepEqual(later.panels[i],original.panels[i]);else if(!later.audit.panels[i].preservedAdaptive)assert.ok(later.panels[i].workIds.every(id=>!protectedIds.has(id)));
  assert.deepEqual(original,before);assert.deepEqual(later.coverage.actualRoles,original.coverage.actualRoles);assert.ok(later.coverage.explorationShare>=.6);assert.ok(Object.values(later.coverage.plannedUses).every(count=>count<=2));
});

test('The three blocks can add42 and42 first ratings without calling earlier grid exposure unfamiliarity',()=>{
  const first=planStimulusPanels({works:actual,seed:'three-blocks'}),h=responsesFor(first,actual),seenBefore=first.reservations.batch2.slice(0,12),byId=new Map(actual.map(w=>[w.id,w]));h.rounds.push({id:'earlier-familiarity-grid',kind:'choice-grid',selectionMode:'familiarity',works:seenBefore.map(id=>byId.get(id))});
  const second=planStimulusPanels({works:actual,...h,batchIndex:1,seed:'three-blocks',reservationPlan:first.reservations});assert.equal(second.complete,true);assert.equal(second.coverage.firstRatingWorkIds.length,42);assert.ok(second.coverage.firstRatingTargetMet);assert.ok(!second.coverage.selectedWorkIds.some(id=>first.reservations.batch3.includes(id)));assert.ok(second.coverage.firstRatingWorkIds.some(id=>seenBefore.includes(id)));assert.ok(second.coverage.actualSessionUnpresentedIds.every(id=>!seenBefore.includes(id)));
  const h2=responsesFor(second,actual,1,'block-two'),third=planStimulusPanels({works:actual,rounds:[...h.rounds,...h2.rounds],answers:{...h.answers,...h2.answers},batchIndex:2,seed:'three-blocks',reservationPlan:first.reservations});assert.equal(third.complete,true);assert.equal(third.coverage.firstRatingWorkIds.length,42);assert.ok(third.coverage.firstRatingTargetMet);assert.equal(new Set([...first.coverage.selectedWorkIds,...second.coverage.selectedWorkIds,...third.coverage.selectedWorkIds]).size,actual.length);
});

test('A later phase can request more prospective challenges without losing protected source snapshots',()=>{
  const first=planStimulusPanels({works:actual,seed:'phase-budget'}),h=responsesFor(first,actual),p=planStimulusPanels({works:actual,...h,batchIndex:2,seed:'phase-budget',reservationPlan:first.reservations,quotas:{exactRepeats:2,recontextualizations:1,challenges:4}});assert.equal(p.complete,true);assert.equal(p.coverage.actualRoles.repeat,2);assert.equal(p.coverage.actualRoles.recontextualization,1);assert.equal(p.coverage.actualRoles.challenge,4);assert.equal(p.coverage.actualRoles.exploration,11);assert.ok(p.panels.filter(panel=>panel.role==='challenge').every(panel=>panel.provisionalHypothesis.trainingEvidence.length>=3));
});

test('A supplied information-role comparison can override a reserve, with an explicit audit rather than a false unseen guarantee',()=>{
  const works=synthetic(),reserved=works.slice(-17).map(w=>w.id),panels=Array.from({length:18},(_,i)=>({panelIndex:i,workIds:works.slice((i*3)%60,(i*3)%60+3).map(w=>w.id),construct:'preference',role:'exploration'}));panels[3]={panelIndex:3,workIds:[reserved[0],works[10].id],construct:'preference',role:'challenge',comparisonNovel:true,provisionalPrediction:reserved[0],provisionalHypothesis:{feature:'energy',trainingEvidence:[{roundId:'source',positions:{retained:0}}]}};
  const p=planStimulusPanels({works,batchIndex:1,seed:'override',adaptivePlan:{panels},reservationPlan:{batch3:reserved}});assert.deepEqual(p.panels[3],panels[3]);assert.deepEqual(p.reservations.protectedAdaptiveOverrides,[reserved[0]]);assert.ok(p.limits.some(limit=>/first unconditional preference/.test(limit)));
});

test('Omissions, recognition, unconfirmed answers and explicit contextual choices do not mark a work as previously preference-rated',()=>{
  const works=synthetic(),first=planStimulusPanels({works,seed:'eligible'}),h=responsesFor(first,works),good=h.rounds[0];h.rounds[1].evidence.family='contextual-choice';h.rounds[2].evidence.unconditional=false;h.answers[h.rounds[3].id].confirmed=false;h.rounds[4].evidence.construct='attention-to-making';
  const later=planStimulusPanels({works,...h,batchIndex:1,seed:'eligible',reservationPlan:first.reservations});assert.ok(later.coverage.eligiblePreferenceRoundIds.includes(good.id));for(const round of h.rounds.slice(1,5))assert.ok(!later.coverage.eligiblePreferenceRoundIds.includes(round.id));
});

test('Unknown exercise exposure stays unknown and cannot be reported as an unpresented selection',()=>{
  const works=synthetic(),round={id:'museum',kind:'exercise',exerciseKind:'curate',works},p=planStimulusPanels({works,rounds:[round],batchIndex:1,seed:'unknown-exercise'});assert.equal(p.coverage.exposureUnknownWorkIds.length,works.length);assert.deepEqual(p.coverage.actualSessionUnpresentedIds,[]);assert.ok(p.coverage.exposureUnknownRoundIds.includes('museum'));assert.ok(p.coverage.exposureUnknownIds.length);
});

test('The first-rating goal remains unmet when the entire catalogue has already been rated',()=>{
  const works=synthetic(),round={id:'all-rated',kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice',role:'discovery'}},answers={'all-rated':{workIds:works.map(w=>w.id),criterion:'preference',positions:Object.fromEntries(works.map(w=>[w.id,50])),confirmed:true}},p=planStimulusPanels({works,rounds:[round],answers,batchIndex:2,seed:'already-rated'});assert.equal(p.coverage.firstRatingAvailable,0);assert.equal(p.coverage.firstRatingTargetFeasible,false);assert.equal(p.coverage.firstRatingTargetMet,false);assert.deepEqual(p.coverage.firstRatingWorkIds,[]);
});

test('Explicit avoid-pair notes constrain new questions but never rewrite a protected comparison',()=>{
  const works=synthetic(),a=works[60].id,b=works[61].id,notes={annotations:[{workId:a,avoidPairIds:[b]}],proposedFirst18Panels:[{panel:1,workIds:works.slice(60,64).map(w=>w.id)}]},p=planStimulusPanels({works,curationNotes:notes,seed:'avoid'});assert.equal(p.audit.rejectedBriefs.length,1);assert.ok(p.panels.every(panel=>!(panel.workIds.includes(a)&&panel.workIds.includes(b))));
});

test('Missing protected identities fail closed, while an insufficient catalogue reports a partial plan',()=>{
  const works=synthetic(),bad={panels:Array.from({length:18},()=>({workIds:['missing',works[0].id],construct:'preference',role:'repeat'}))},blocked=planStimulusPanels({works,batchIndex:1,adaptivePlan:bad});assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.panels,[]);const short=planStimulusPanels({works:synthetic(8)});assert.equal(short.complete,false);assert.equal(short.status,'partial');assert.ok(short.audit.shortageReason);assert.ok(short.coverage.selectedWorkIds.every(id=>synthetic(8).some(work=>work.id===id)));
});

test('The planner does not mutate works, history, curation notes or preserved source snapshots',()=>{
  const works=synthetic(),first=planStimulusPanels({works,seed:'pure'}),h=responsesFor(first,works),input={works,...h,batchIndex:1,seed:'pure',reservationPlan:first.reservations,curationNotes:{annotations:[{workId:works[0].id,importanceTier:'canonical',sourceUrls:['https://institution.example/0']}] }},before=structuredClone(input),p=planStimulusPanels(input);assert.deepEqual(input,before);if(p.panels[0].plannerDiagnostic)p.panels[0].plannerDiagnostic.residualConfounds.push('changed');assert.deepEqual(input,before);
});

test('Actual all-skipped and sparse first50 histories avoid the prior final images without changing the other17 panels',()=>{
  const first=legacyV8Rounds(actual),before=structuredClone(first),lastIds=first[49].works.map(work=>work.id),ordinary=first.filter(round=>round.evidence.construct==='preference'&&round.evidence.panelNumber);
  for(const [completed,badId] of [[0,'green-tara'],[8,'ethiopian-apostles']]){
    const answers=Object.fromEntries(first.map(round=>[round.id,{workIds:round.works.map(work=>work.id),skipped:true}]));
    for(const round of ordinary.slice(0,completed))answers[round.id]={workIds:round.works.map(work=>work.id),criterion:'preference',positions:Object.fromEntries(round.works.map(work=>[work.id,Math.round(work.features.energy*100)])),confirmed:true};
    const input={works:actual,rounds:first,answers,batchIndex:1,seed:'editorial-release-audit-1',curationNotes:reviewedNotes},plan=planStimulusPanels(input),audit=plan.audit.boundarySpacing;
    assert.equal(audit.sourceRoundId,'journey-050');const originallyOverlapped=audit.originalWorkIds.some(id=>lastIds.includes(id));assert.equal(audit.status,originallyOverlapped?'applied':'clear');assert.equal(audit.fallback,false);assert.deepEqual(audit.remainingOverlapIds,[]);assert.ok(plan.panels[0].workIds.every(id=>!lastIds.includes(id)));
    // Swap two independent appraisals. This preserves every cumulative image
    // count and every ordinary source, but ends on a different specific set.
    const alternate=[...first];[alternate[47],alternate[49]]=[alternate[49],alternate[47]];
    const control=planStimulusPanels({...input,rounds:alternate});assert.equal(control.audit.boundarySpacing.status,'clear');
    assert.deepEqual(plan.panels.slice(1),control.panels.slice(1));assert.equal(plan.coverage.firstRatingWorkIds.length,control.coverage.firstRatingWorkIds.length);
    assert.deepEqual(plan.reservations,control.reservations);assert.ok(plan.panels.every(panel=>panel.workIds.every(id=>!reviewedNotes.reservePools.batch3.includes(id))));assert.ok(Object.values(plan.coverage.plannedUses).every(count=>count<=2));
  }
  assert.deepEqual(first,before);
});

test('The boundary guard includes separate anchors and skips, while a museum offered tray and text-only references do not reset it',()=>{
  const works=synthetic(24),adaptivePlan={panels:[{workIds:works.slice(0,2).map(work=>work.id),construct:'preference',role:'exploration'}]},options={works,batchIndex:1,panelCount:1,panelSizes:[2],adaptivePlan,seed:'boundary-anchor',curationNotes:{reservePools:{batch2:[],batch3:[]}}},baseline=planStimulusPanels(options),anchorId=baseline.panels[0].workIds[0],anchor=works.find(work=>work.id===anchorId),candidate=works.find(work=>!baseline.panels[0].workIds.includes(work.id));
  const neighbour={id:'last-specific',kind:'contrast',contrastKind:'neighbour',works:[candidate],anchorWorks:[anchor],evidence:{}},museum={id:'offered-tray',kind:'exercise',exerciseKind:'curate',works},reference={id:'text-reference',kind:'statements',works:[anchor],evidence:{stimulusVisibility:'not-shown'}},answers={'last-specific':{skipped:true,workIds:[candidate.id]}};
  const plan=planStimulusPanels({...options,rounds:[neighbour,museum,reference],answers});
  assert.equal(plan.audit.boundarySpacing.sourceRoundId,neighbour.id);assert.deepEqual(new Set(plan.audit.boundarySpacing.avoidWorkIds),new Set([candidate.id,anchorId]));assert.ok(plan.panels[0].workIds.every(id=>![candidate.id,anchorId].includes(id)));assert.equal(plan.audit.boundarySpacing.fallback,false);
});

test('A protected first comparison retains exact identities and records its boundary exception',()=>{
  const works=synthetic(12),workIds=works.slice(0,2).map(work=>work.id),protectedPanel={workIds,construct:'preference',role:'repeat',exactRepeat:true,repeatOf:'ordinary-source',sourceRoundId:'ordinary-source',promptSnapshot:{title:'Which do you prefer?',hint:'Equal positions are fine.'}},source={id:'ordinary-source',kind:'spectrum',criterion:'preference',title:'Which do you prefer?',hint:'Equal positions are fine.',works:works.slice(0,2),evidence:{construct:'preference',family:'individual-choice',batchIndex:0}},last={id:'last-specific',kind:'context',works:[works[0]]},adaptivePlan={panels:[protectedPanel]},before=structuredClone(adaptivePlan);
  const plan=planStimulusPanels({works,rounds:[source,last],answers:{'last-specific':{skipped:true}},batchIndex:1,panelCount:1,panelSizes:[2],adaptivePlan});
  assert.deepEqual(plan.panels[0],protectedPanel);assert.deepEqual(adaptivePlan,before);assert.equal(plan.audit.boundarySpacing.status,'protected-exception');assert.equal(plan.audit.boundarySpacing.fallback,true);assert.deepEqual(plan.audit.boundarySpacing.remainingOverlapIds,[works[0].id]);assert.match(plan.audit.boundarySpacing.fallbackReason,/protected adaptive/);
});

test('An insufficient unavoided catalogue records boundary fallback instead of altering other constraints',()=>{
  const works=synthetic(4),last={id:'all-four-shown',kind:'context',works},adaptivePlan={panels:[{workIds:works.slice(0,2).map(work=>work.id),construct:'preference',role:'exploration'}]};
  const plan=planStimulusPanels({works,rounds:[last],answers:{[last.id]:{skipped:true}},batchIndex:1,panelCount:1,panelSizes:[2],adaptivePlan,curationNotes:{reservePools:{batch2:[],batch3:[]}}});
  assert.equal(plan.complete,true);assert.equal(plan.audit.boundarySpacing.status,'fallback');assert.equal(plan.audit.boundarySpacing.fallback,true);assert.equal(plan.audit.boundarySpacing.remainingOverlapIds.length,2);assert.ok(plan.audit.boundarySpacing.fallbackReason);assert.ok(plan.audit.warnings.some(row=>row.panel===1));assert.equal(new Set(plan.panels[0].workIds).size,2);assert.ok(Object.values(plan.coverage.plannedUses).every(count=>count<=2));
});

test('Fresh exploratory contrasts can yield a little descriptor separation to avoid repeatedly presented paintings',()=>{
  const works=synthetic(24).map((work,index)=>({...work,country:'France',movement:'One tradition',recognitionTier:'established',analysis:{yearRange:[1800,1800]},features:Object.fromEntries(featureKeys.map(key=>[key,key==='abstraction'?[0,1,.2,.8][index]??.5:.5]))}));
  const protectedPanel={workIds:works.slice(-2).map(work=>work.id),construct:'preference',role:'challenge',comparisonNovel:true,provisionalPrediction:null};
  const adaptivePlan={panels:[protectedPanel,{workIds:works.slice(0,2).map(work=>work.id),construct:'preference',role:'exploration'}]},options={works,batchIndex:1,panelCount:2,panelSizes:[2,2],adaptivePlan,seed:'exposure-versus-contrast',curationNotes:{reservePools:{batch2:[],batch3:[]}}};
  const before=planStimulusPanels(options);assert.deepEqual(new Set(before.panels[1].workIds),new Set([works[0].id,works[1].id]));
  const rounds=Array.from({length:3},(_,index)=>({id:'earlier-image-'+index,kind:'context',works:works.slice(0,2),evidence:{construct:'source-note'}})),after=planStimulusPanels({...options,rounds});
  assert.deepEqual(after.panels[0],protectedPanel);assert.ok(after.panels[1].workIds.every(id=>![works[0].id,works[1].id].includes(id)));assert.ok(after.panels[1].plannerDiagnostic.targetGap>=.3,'Exposure balancing must retain a useful known contrast');
  assert.deepEqual(adaptivePlan.panels[0],protectedPanel);
});
