import test from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../../public/art-atlas/artworks.json' with {type:'json'};
import reviews from '../../public/art-atlas/artwork-attribute-reviews.json' with {type:'json'};
import {withContinuousPreference} from '../../public/art-atlas/continuous-preference.mjs';
import {withComparisonPreference} from '../../public/art-atlas/comparison-protocol.mjs';
import {selectAppealInvestigation,readAppealInvestigations,applyAppealInvestigationChecks,buildAppealExploration,selectCollectionAppeal} from '../../public/art-atlas/appeal-investigations.mjs';
import {collectTastePatternSources} from '../../public/art-atlas/taste-axes.mjs';
import {recordStudyResponse,prepareJourneySession,extendJourneySession,sessionJourneyRounds,snapshotStudyRound,journeyEvidenceRounds} from '../../public/art-atlas/deep-study.mjs';
import {appealInvestigationReadings} from '../../public/art-atlas/profile-intelligence.mjs';

const byId=new Map(catalogue.map(work=>[work.id,work]));
const ids=round=>round.works.map(work=>work.id);
const line=(id,workIds)=>withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:workIds.map(id=>byId.get(id)),evidence:{construct:'preference',family:'individual-choice',role:'discovery'}});
const respond=(round,values)=>({criterion:'preference',workIds:ids(round),positions:Object.fromEntries(ids(round).map((id,index)=>[id,values[index]])),confirmed:true});
const lilyId='monet-water-lilies',pineId='extended-cma-150693',flowersId='study-van-gogh-sunflowers';
const source=line('journey-001',[lilyId,'holbein-ambassadors']);
const candidateIds=[pineId,flowersId];
const workSet=[...new Set([...ids(source),...candidateIds])].map(id=>byId.get(id));
const args=(round,values,options={})=>({id:'journey-015',works:workSet,rounds:[round],answers:{[round.id]:respond(round,values)},candidateIds,...options});

test('A standout changes the next question, while high or low clusters and historical order leave room to explore',()=>{
  assert.equal(selectAppealInvestigation(args(source,[98,97])),null);
  assert.equal(selectAppealInvestigation(args(source,[3,2])),null);
  assert.equal(selectAppealInvestigation(args(source,[90,90])),null);
  const next=selectAppealInvestigation(args(source,[98,10]));
  assert.ok(next);
  assert.deepEqual(new Set(ids(next.round)),new Set(candidateIds));
  const check=next.round.evidence.appealInvestigation;
  assert.deepEqual(check.anchorIds,[lilyId]);
  assert.equal(check.anchorObservations[0].value,98);
  assert.equal(check.anchorObservations[0].positions['holbein-ambassadors'],10);
  assert.equal(check.controls.usable,true);
  assert.deepEqual(new Set(check.alternatives.map(item=>item.quality)),new Set(['landscape','open-expanse']));
  const {continuousProtocol,measurementScope,...evidence}=source.evidence;
  const orderOnly=withComparisonPreference({...source,evidence});
  assert.equal(selectAppealInvestigation(args(orderOnly,[98,10])),null);
});

test('An exact tie or two low values leave the proposed appeal open. An edited or relabelled source cannot refit a check',()=>{
  const base=args(source,[98,10]),next=selectAppealInvestigation(base).round;
  const profileFor=values=>readAppealInvestigations({...base,rounds:[source,next],answers:{...base.answers,[next.id]:respond(next,values)}});
  assert.equal(profileFor([88,88])[0].outcome,'close');
  const bothLow=profileFor([44,12])[0];
  assert.equal(bothLow.outcome,'neither-appealed');
  assert.equal(bothLow.favouredQuality,null);
  assert.match(appealInvestigationReadings([bothLow],workSet)[0].text,/Neither painting/);
  const leftWins=profileFor([88,12])[0];
  assert.equal(leftWins.signedGap,76);
  assert.equal(leftWins.independentOfTraining,true);
  assert.equal(leftWins.favouredQuality,next.evidence.appealInvestigation.alternatives.find(item=>item.predictedWorkId===ids(next)[0]).quality);
  const edited=readAppealInvestigations({...base,rounds:[source,next],answers:{[source.id]:respond(source,[50,50]),[next.id]:respond(next,[88,12])}});
  assert.equal(edited[0].sourceChanged,true);
  const wrongSource={...next,works:next.works.map((work,index)=>index?work:{...work,image:'assets/another-source.jpg'})};
  assert.equal(readAppealInvestigations({...base,rounds:[source,wrongSource],answers:{...base.answers,[next.id]:respond(next,[88,12])}}).length,0);
});

test('An unknown review cannot establish a diagnostic control or justify a fourth painting',()=>{
  const base=args(source,[98,10]),missing=structuredClone(reviews);
  delete missing.reviews[pineId];
  assert.equal(selectAppealInvestigation({...base,annotationReviews:missing}),null);
  const landscapeOptions={...base,works:catalogue,candidateIds:[pineId,flowersId,'extended-cma-83462','opening-cma-106088'],landscapeCheck:true};
  const quartet=buildAppealExploration(landscapeOptions),coverage=quartet.evidence.coverageAtSelection;
  assert.equal(quartet.works.length,4);
  assert.equal(new Set(quartet.works.map(work=>work.artist)).size,4);
  assert.equal(quartet.evidence.role,'discovery');
  assert.equal(coverage.landscapeWorkIds.length,3);
  assert.equal(coverage.fourthPainting.workId,quartet.works[3].id);
  for(const quality of coverage.fourthPainting.addedQualities){
    const status=reviews.reviews[coverage.fourthPainting.workId].attributes[quality].status;
    assert.ok(['present','absent'].includes(status));
    for(const id of coverage.fourthPainting.comparedWithIds)assert.equal(reviews.reviews[id].attributes[quality].status,status==='present'?'absent':'present');
  }
  assert.ok(coverage.fourthPainting.addedQualities.length>0);
  const undocumented=structuredClone(reviews);
  delete undocumented.reviews[coverage.fourthPainting.workId];
  const trio=buildAppealExploration({...landscapeOptions,annotationReviews:undocumented});
  assert.deepEqual(ids(trio),ids(quartet).slice(0,3));
  assert.equal(trio.evidence.coverageAtSelection.fourthPainting,undefined);
  const general=buildAppealExploration({...landscapeOptions,landscapeCheck:false});
  assert.equal(general.works.length,4);
  assert.equal(general.evidence.coverageAtSelection.fourthPainting.comparedWithIds.length,3);
});

test('A failed prospective transfer qualifies the same broad explanation. A selected or repeated comparison adds no discovery votes',()=>{
  const base=args(source,[98,10]),next=selectAppealInvestigation(base).round;
  const newPair=[...ids(next),'goya-saturn'];
  const later=line('journey-024',newPair),works=[...workSet,byId.get('goya-saturn')];
  const rounds=[source,next,later],answers={...base.answers,[next.id]:respond(next,[80,20]),[later.id]:respond(later,[70,25,85])};
  const scope=collectTastePatternSources({works,rounds,answers}).preferenceScopes[0];
  assert.deepEqual(scope.sets.map(set=>set.entry.round.id),[source.id]);
  assert.deepEqual(scope.levelSets.at(-1).items.map(item=>item.work.id),['goya-saturn']);
  const played=readAppealInvestigations({works,rounds,answers})[0];
  const transfer={...played,scope:'transfer'};
  const patterns=played.alternatives.map(item=>({channel:'personal-appeal',qualityKey:item.quality,direction:item.direction,status:'qualified',summaryEligible:true,text:'Earlier contrast.',sourceRoundIds:[source.id]}));
  const updated=applyAppealInvestigationChecks(patterns,[transfer]);
  assert.equal(updated.find(item=>item.qualityKey!==played.favouredQuality).status,'mixed');
  assert.equal(updated.find(item=>item.qualityKey!==played.favouredQuality).summaryEligible,false);
  assert.equal(updated.find(item=>item.qualityKey===played.favouredQuality).investigation.status,'transferred-once');
});

test('An explicitly saved work can receive its first rating, and unselected works supply no negative evidence',()=>{
  const base=args(source,[60,60]);
  const offer=selectCollectionAppeal({...base,works:catalogue,candidateIds:[lilyId,...candidateIds],saved:{[pineId]:{look:true}}});
  assert.ok(offer);
  assert.ok(ids(offer.round).includes(pineId));
  assert.equal(offer.round.evidence.collectionAppeal.from,'look');
  assert.equal(offer.round.evidence.role,'probe');
  assert.equal(selectCollectionAppeal({...base,saved:{[pineId]:{look:false,study:false}}}),null);
});

test('The normal journey binds coverage and attribution from actual history, and retains the original answer on edit',()=>{
  const data=prepareJourneySession(null,catalogue,100);
  for(let index=0;index<27;index++){
    data.index=index;
    const round=sessionJourneyRounds(data)[index];
    data.shown[round.id]=snapshotStudyRound(round);
    if(round.kind==='spectrum'&&round.criterion==='preference'&&!round.unavailable)data.answers[round.id]=respond(round,round.works.map((_,i)=>65-i));
    else data.answers[round.id]={workIds:ids(round),skipped:true};
  }
  const attribution=data.shown['journey-017'];
  assert.equal(attribution.evidence.selectionMethod,'taste-linked-from-answered-appeal');
  assert.ok(attribution.evidence.sourceRoundIds.every(id=>data.answers[id]?.confirmed));
  const landscape=data.shown['journey-027'];
  assert.equal(landscape.evidence.selectionMethod,'landscape-exploration');
  assert.ok(landscape.evidence.coverageAtSelection.landscapeWorkIds.length>=2);
  assert.ok(landscape.evidence.coverageAtSelection.supplementalLandscapeIds.length<=1);
  const first=journeyEvidenceRounds(data)[0],original=structuredClone(data.answers[first.id]);
  recordStudyResponse(data,first,respond(first,first.works.map(()=>50)),200);
  assert.deepEqual(data.answerRevisions[0].answer,original);
  assert.deepEqual(data.answerRevisions[0].question,data.shown[first.id]);
  assert.deepEqual(data.shown[first.id],snapshotStudyRound(first));
});

test('A comparison accepted after round 100 stays after its evidence on restore',()=>{
  const original=prepareJourneySession(null,catalogue,100);
  original.plan.forEach(round=>{original.answers[round.id]={skipped:true,workIds:round.workIds};original.shown[round.id]=structuredClone(round);});
  const data=extendJourneySession(original,catalogue,200);
  const followup=line('profile-refine-01',[pineId,flowersId]);
  followup.evidence.profileRefinement={afterBaseRoundCount:100};
  data.profileRefinement={protocol:'optional-profile-refinement-v1',baseTarget:50,plan:[snapshotStudyRound(followup)]};
  const after=journeyEvidenceRounds(prepareJourneySession(data,catalogue,300));
  assert.equal(after[99].id,'journey-100');
  assert.equal(after[100].id,'profile-refine-01');
});
