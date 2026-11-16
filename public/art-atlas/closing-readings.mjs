import {validAnswer,FEATURES} from './engine.mjs';
import {isOverallAppealRound,APPEAL_PROTOCOL} from './appeal-scale.mjs';
import {validatedProfileEntries,profileEvidence,artworkSetKey,favouriteExposure} from './profile-evidence.mjs';
import {validScenarioDraft} from './scenarios.mjs';
import {FEATURE_SEMANTIC_VERSION,isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';

export const CLOSING_READING_PROTOCOL='closing-refinement-v1';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unique=values=>[...new Set(values)];
const ids=round=>(round.works||[]).map(work=>work.id);
const key=values=>JSON.stringify([...values].sort());
const sameSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&new Set(b).size===b.length&&key(a)===key(b);
const score=value=>Number.isInteger(value)&&value>=0&&value<=100;
const featureValue=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const short=work=>work.shortTitle||work.title;
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const literal=feature=>['narrative','atmosphere'].includes(feature);
const families=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const descriptions={abstraction:['more representational work','more abstract work'],energy:['quieter compositions','more visual activity'],complexity:['sparser compositions','denser compositions'],humanity:['less human presence','more human presence'],narrative:['less depicted bodily action','more depicted bodily action'],atmosphere:['less pictured setting','more pictured setting'],color:['restrained colour','more intense colour']};
const hypothesisLabel=hypothesis=>descriptions[hypothesis.feature][hypothesis.direction>0?1:0];
const featureNames={abstraction:'Representation',energy:'Visual activity',complexity:'Compositional detail',humanity:'Human presence',narrative:'Depicted action',atmosphere:'Pictured setting',color:'Colour intensity'};
const limits=['These are checks of earlier provisional descriptions of your choices, not tests of an unconscious motive or a personality type.','The feature, rival and comparisons were chosen after earlier answers. Correlated properties, subjects, artists and familiarity remain alternative explanations.','Pairs inside one four-work answer and repeated paintings are dependent. A new pairing is not a new artwork or an independent replication.','A gap below 15 points is described as a near tie. This is a provisional design threshold, not confidence or an accuracy percentage.'];

function definitionIndex(rounds){
  const counts=new Map();for(const round of rounds)if(typeof round?.id==='string')counts.set(round.id,(counts.get(round.id)||0)+1);
  return new Map(rounds.flatMap((round,index)=>round&&counts.get(round.id)===1?[[round.id,{round,index}]]:[]));
}
function validSource(source,checkIndex,known){
  const round=source?.round,workIds=round&&ids(round);
  return !!source&&source.index<checkIndex&&!round.unavailable&&isOverallAppealRound(round)&&families.has(round.evidence.family)&&workIds.length>=2&&workIds.length<=4&&new Set(workIds).size===workIds.length&&workIds.every(id=>known.has(id))&&(!Object.hasOwn(round,'workIds')||Array.isArray(round.workIds)&&round.workIds.join('|')===workIds.join('|'));
}
function frozenHypothesis(hypothesis,checkIndex,definitions,known,metadataSources){
  if(!plain(hypothesis)||!FEATURES.includes(hypothesis.feature)||![-1,1].includes(hypothesis.direction)||hypothesis.measurementScope!==APPEAL_PROTOCOL||!Array.isArray(hypothesis.trainingRoundIds)||hypothesis.trainingRoundIds.length<3||new Set(hypothesis.trainingRoundIds).size!==hypothesis.trainingRoundIds.length||!Array.isArray(hypothesis.trainingEvidence)||hypothesis.trainingEvidence.length!==hypothesis.trainingRoundIds.length||!Array.isArray(hypothesis.supportingRoundIds)||hypothesis.supportingRoundIds.length<2||new Set(hypothesis.supportingRoundIds).size!==hypothesis.supportingRoundIds.length)return null;
  if(literal(hypothesis.feature)&&hypothesis.featureSemanticVersion!==FEATURE_SEMANTIC_VERSION)return null;
  const snapshots=new Map(),sets=new Set(),artists=new Set(),groups=[];
  for(const snapshot of hypothesis.trainingEvidence){
    if(!plain(snapshot)||snapshots.has(snapshot.roundId)||!hypothesis.trainingRoundIds.includes(snapshot.roundId)||!metadataSources.includes(snapshot.roundId))return null;
    const source=definitions.get(snapshot.roundId);
    if(!validSource(source,checkIndex,known)||source.round.evidence.repeatOf||['repeat','probe','check','counterexample','heldout','holdout'].includes(source.round.evidence.role)||!sameSet(snapshot.workIds,ids(source.round))||snapshot.criterion!=='preference'||snapshot.confirmed!==true||snapshot.measurementScope!==APPEAL_PROTOCOL||!plain(snapshot.positions)||!plain(snapshot.featureValues)||Object.keys(snapshot.positions).length!==snapshot.workIds.length||snapshot.workIds.some(id=>!score(snapshot.positions[id]))||Object.keys(snapshot.featureValues).some(id=>!snapshot.workIds.includes(id)||!featureValue(snapshot.featureValues[id])))return null;
    // Validate the frozen full answer against the actual earlier definition.
    // Current answer values are intentionally not used to refit this snapshot.
    let valid=false;try{valid=validAnswer(source.round,{confirmed:true,criterion:'preference',workIds:ids(source.round),positions:snapshot.positions});}catch{}if(!valid)return null;
    if(literal(hypothesis.feature)&&(!plain(snapshot.featureSemanticVersions)||snapshot.workIds.some(id=>snapshot.featureSemanticVersions[id]!==FEATURE_SEMANTIC_VERSION||!Object.hasOwn(snapshot.featureValues,id))))return null;
    const signature=artworkSetKey(source.round);if(sets.has(signature))return null;sets.add(signature);
    const observations=snapshot.workIds.flatMap((a,index)=>snapshot.workIds.slice(index+1).flatMap(b=>{
      if(!Object.hasOwn(snapshot.featureValues,a)||!Object.hasOwn(snapshot.featureValues,b))return [];
      const gap=snapshot.positions[a]-snapshot.positions[b];return Math.abs(gap)>=10?[Math.sign(gap)*(snapshot.featureValues[a]-snapshot.featureValues[b])*Math.min(1,Math.abs(gap)/50)]:[];
    }));
    if(!observations.length)return null;const value=mean(observations);groups.push({roundId:snapshot.roundId,value});
    for(const id of snapshot.workIds){const work=source.round.works.find(work=>work.id===id);if(work.artistKnown!==false&&typeof work.artist==='string'&&work.artist.trim()&&!/unknown|unidentified|anonymous/i.test(work.artist))artists.add(work.artist.trim().toLowerCase());}
    snapshots.set(snapshot.roundId,snapshot);
  }
  if(sets.size<3||artists.size<4||Math.abs(mean(groups.map(group=>group.value)))<.035||Math.sign(mean(groups.map(group=>group.value)))!==hypothesis.direction||hypothesis.supportingRoundIds.some(id=>!groups.some(group=>group.roundId===id&&group.value*hypothesis.direction>=.025)))return null;
  return {feature:hypothesis.feature,direction:hypothesis.direction,measurementScope:APPEAL_PROTOCOL,trainingRoundIds:[...hypothesis.trainingRoundIds],supportingRoundIds:[...hypothesis.supportingRoundIds],trainingEvidence:structuredClone(hypothesis.trainingEvidence),sourceSetCount:sets.size,namedArtistCount:artists.size,...(literal(hypothesis.feature)?{featureSemanticVersion:FEATURE_SEMANTIC_VERSION}:{})};
}

/** Verify novelty from actual visibility. Offered museum libraries do not prove
 * all paintings were seen; missing imported exercise metadata remains unknown.
 */
function exposureBefore(pair,index,rounds,answers,known){
  const together=group=>pair.every(id=>group.includes(id));
  for(const round of rounds.slice(0,index)){
    if(!round||round.unavailable||round.kind==='statements'||round.evidence?.stimulusVisibility==='not-shown')continue;
    if(!Array.isArray(round.works)||round.works.some(work=>!known.has(work?.id)))return 'unknown';
    const anchors=[...(round.anchorWorks||[]).map(work=>work?.id),...(round.anchorIds||[])];if(anchors.some(id=>!known.has(id)))return 'unknown';
    if(round.kind==='choice-grid'&&round.evidence?.instrumentRevision==='paged-favourites-v1'){
      const observed=favouriteExposure(round,answers[round.id]);if(!observed)return 'unknown';if(observed.coPresentedGroups.some(together))return 'seen';continue;
    }
    if(Array.isArray(round.exposureUnknownWorkIds)&&round.exposureUnknownWorkIds.some(id=>pair.includes(id)))return 'unknown';
    if(Array.isArray(round.coPresentedGroups)){
      if(round.coPresentedGroups.some(group=>!Array.isArray(group)||group.some(id=>!known.has(id))))return 'unknown';
      if(round.coPresentedGroups.some(together))return 'seen';continue;
    }
    if(round.kind==='exercise'){
      const record=answers[round.id]?.record;
      if(!plain(record)||record.kind!==round.exerciseKind||!sameSet(record.offeredIds,ids(round)))return 'unknown';
      let valid=false;try{valid=validScenarioDraft(record,[...known.values()]);}catch{}if(!valid||!Array.isArray(record.presentedIds)||new Set(record.presentedIds).size!==record.presentedIds.length||record.presentedIds.some(id=>!ids(round).includes(id)))return 'unknown';
      if(round.exerciseKind==='curate'){
        if(!plain(record.placements))return 'unknown';const mounted=Object.keys(record.placements);
        if(mounted.some(id=>!record.presentedIds.includes(id)))return 'unknown';if(together(mounted))return 'seen';
        if(record.presentedIds.some(id=>pair.includes(id)&&!mounted.includes(id)))return 'unknown';
      }else if(together(record.presentedIds))return 'seen';
      continue;
    }
    const presented=round.presentedIds===undefined?[...ids(round),...anchors]:round.presentedIds;
    if(!Array.isArray(presented)||presented.some(id=>!known.has(id)))return 'unknown';if(together(presented))return 'seen';
  }
  return 'not-seen';
}
function trainingEvidence(hypothesis,definitions,known){
  return hypothesis.trainingEvidence.map(snapshot=>({roundId:snapshot.roundId,label:'Captured earlier '+hypothesisLabel(hypothesis)+' comparison',detail:snapshot.workIds.map(id=>`${short(known.get(id))}: overall appeal ${snapshot.positions[id]}${Object.hasOwn(snapshot.featureValues,id)?', descriptor '+snapshot.featureValues[id]:', descriptor unknown'}`).join('; ')+'.',workIds:[...snapshot.workIds],measurementScope:APPEAL_PROTOCOL,sourceRole:'frozen training response'}));
}
function validChecks(entry,rounds,answers,definitions,known){
  const round=entry.round,meta=round.evidence?.finalRefinement;
  if(meta?.protocol!==CLOSING_READING_PROTOCOL||meta.binding!=='bound'||![3,4].includes(meta.slot)||!['rival-check','feature-check','exception-check'].includes(meta.role)||!isOverallAppealRound(round)||!families.has(round.evidence.family)||round.evidence.role!=='probe'||round.evidence.repeatOf||round.works.length!==4||!Array.isArray(meta.sourceRoundIds)||new Set(meta.sourceRoundIds).size!==meta.sourceRoundIds.length||meta.sourceRoundIds.some(id=>!validSource(definitions.get(id),entry.index,known))||!Array.isArray(meta.hypotheses)||!Array.isArray(meta.checks))return [];
  const primary=frozenHypothesis(meta.hypotheses[0],entry.index,definitions,known,meta.sourceRoundIds),rival=frozenHypothesis(meta.hypotheses[1],entry.index,definitions,known,meta.sourceRoundIds);if(!primary)return [];
  const seen=new Set();
  return meta.checks.flatMap(check=>{
    if(!plain(check)||!Array.isArray(check.workIds)||check.workIds.length!==2||new Set(check.workIds).size!==2||check.workIds.some(id=>!ids(round).includes(id))||!check.workIds.includes(check.prediction)||typeof check.comparisonNovel!=='boolean'||check.artworksMayBeFamiliar!==true||check.holdoutUnit!==(check.comparisonNovel?'new-comparison':null))return [];
    const signature=key(check.workIds);if(seen.has(signature))return [];seen.add(signature);
    const [a,b]=check.workIds.map(id=>round.works.find(work=>work.id===id));
    if(!isReviewedVisualDescriptor(a,primary.feature)||!isReviewedVisualDescriptor(b,primary.feature))return [];
    const difference=(a.features[primary.feature]-b.features[primary.feature])*primary.direction;
    if(Math.abs(difference)<.25||check.prediction!==(difference>0?a.id:b.id))return [];
    if(check.rivalPrediction!==null&&check.rivalPrediction!==undefined){
      if(!rival||rival.feature===primary.feature||!check.workIds.includes(check.rivalPrediction)||check.rivalPrediction===check.prediction||!isReviewedVisualDescriptor(a,rival.feature)||!isReviewedVisualDescriptor(b,rival.feature))return [];
      const rivalDifference=(a.features[rival.feature]-b.features[rival.feature])*rival.direction;
      if(Math.abs(rivalDifference)<.25||check.rivalPrediction!==(rivalDifference>0?a.id:b.id))return [];
    }
    const visibility=exposureBefore(check.workIds,entry.index,rounds,answers,known);
    if(check.comparisonNovel&&visibility!=='not-seen')return [];
    const other=check.workIds.find(id=>id!==check.prediction),gap=entry.answer.positions[check.prediction]-entry.answer.positions[other],status=Math.abs(gap)<15?'near-tie':gap>0?'matched':'reversed',observedWorkId=status==='near-tie'?null:gap>0?check.prediction:other;
    return [{id:'closing-'+round.id+'-'+signature,roundId:round.id,workIds:[check.prediction,other],status,observedWorkId,predictedWorkId:check.prediction,rivalPredictedWorkId:check.rivalPrediction||null,rivalStatus:check.rivalPrediction?(status==='near-tie'?'near-tie':observedWorkId===check.rivalPrediction?'matched':'reversed'):null,gap,positions:Object.fromEntries(check.workIds.map(id=>[id,entry.answer.positions[id]])),comparisonNovel:check.comparisonNovel,holdoutUnit:check.holdoutUnit,visibility,artworksMayBeFamiliar:true,primary:structuredClone(primary),rival:check.rivalPrediction?structuredClone(rival):null,testFeatureValues:{[primary.feature]:Object.fromEntries(check.workIds.map(id=>[id,round.works.find(work=>work.id===id).features[primary.feature]])),...(check.rivalPrediction?{[rival.feature]:Object.fromEntries(check.workIds.map(id=>[id,round.works.find(work=>work.id===id).features[rival.feature]]))}:{})},sourceRoundIds:unique([...primary.trainingRoundIds,...(check.rivalPrediction?rival.trainingRoundIds:[]),round.id])}];
  });
}
function checkObservation(entry,checks,definitions,known){
  const metadata=entry.round.evidence.finalRefinement,novel=checks.every(check=>check.comparisonNovel),primary=checks[0].primary,statements=checks.map(check=>{
    const predicted=known.get(check.predictedWorkId),other=known.get(check.workIds[1]);
    return check.status==='near-tie'?`${short(predicted)} and ${short(other)} ended near-tied, so this pair did not separate the earlier explanation${check.rival?'s':''}.`:check.rival?`${short(known.get(check.observedWorkId))} rated higher, matching the earlier ${hypothesisLabel(check.status==='matched'?check.primary:check.rival)} description rather than ${hypothesisLabel(check.status==='matched'?check.rival:check.primary)}.`:`${short(known.get(check.observedWorkId))} rated higher${check.status==='matched'?', as the earlier '+hypothesisLabel(primary)+' description predicted':', reversing the earlier '+hypothesisLabel(primary)+' prediction'}.`;
  });
  const sourceHypotheses=[primary,...checks.filter(check=>check.rival).map(check=>check.rival)],uniqueHypotheses=[...new Map(sourceHypotheses.map(hypothesis=>[hypothesis.feature,hypothesis])).values()],support=[profileEvidence(entry,unique(checks.flatMap(check=>check.workIds)),statements.join(' '),'Closing overall-appeal comparison'),...uniqueHypotheses.flatMap(hypothesis=>trainingEvidence(hypothesis,definitions,known))];
  const outcomes=new Set(checks.map(check=>check.status)),title=checks.some(check=>check.rival&&check.rivalStatus==='matched')?'A comparison favoured the rival explanation.':outcomes.size>1?'The earlier explanation met a mixed check.':checks.every(check=>check.status==='matched')?'The earlier explanation matched this comparison.':checks.every(check=>check.status==='near-tie')?'This comparison left the explanation open.':'This comparison crossed the earlier explanation.';
  const reversed=checks.filter(check=>check.status==='reversed'),counter=reversed.length?[profileEvidence(entry,unique(reversed.flatMap(check=>check.workIds)),'The actual higher-rated painting went against the captured primary prediction.','A result against the primary explanation')]:[];
  return {id:'closing-check-'+entry.round.id,module:'closing-checks',kind:'taste',title,text:statements.join(' '),support,counter,priority:12,evidence:unique(support.flatMap(item=>item.workIds)),comparisonCount:checks.length,sourceRoundIds:unique(checks.flatMap(check=>check.sourceRoundIds)),readingBasis:novel?'prospective-new-comparisons':'descriptive-recheck',closingRole:metadata.role,checks,
    comparisons:checks.map(check=>({workIds:check.workIds,roundId:entry.round.id,sourceRoundIds:check.sourceRoundIds,role:check.status==='reversed'?'counter':'support',predictedWorkId:check.predictedWorkId,rivalPredictedWorkId:check.rivalPredictedWorkId,measures:[{key:'preference',label:'Overall appeal in this comparison',values:check.workIds.map(id=>entry.answer.positions[id])}]})),
    alternatives:[...limits,novel?'Actual earlier presentation records support a new pairing. The individual paintings may already be familiar.':'At least one pairing has no verified new-pair status. Memory, previously seen company and changed context can contribute; no independent held-out comparison is claimed.','Training values and predictions are the captured earlier snapshots. Later answer or descriptor edits do not refit them.']};
}
function favouriteOverrides(entries,answers,definitions,known){
  return entries.filter(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='shortlist'&&entry.round.evidence?.construct==='overall-favourites'&&entry.round.evidence.finalRefinement?.protocol===CLOSING_READING_PROTOCOL&&entry.round.evidence.finalRefinement.binding==='bound'&&entry.round.evidence.finalRefinement.role==='favourites').flatMap(entry=>{
    const captured=entry.round.evidence.finalRefinement.candidateRatings;
    if(!Array.isArray(captured)||captured.length!==entry.round.works.length||new Set(captured.map(item=>item?.workId)).size!==captured.length)return [];
    const ratings=new Map();
    for(const item of captured){
      const source=definitions.get(item?.roundId);if(!plain(item)||!ids(entry.round).includes(item.workId)||!score(item.value)||!validSource(source,entry.index,known)||!ids(source.round).includes(item.workId))return [];
      let valid=false;try{valid=validAnswer(source.round,answers[source.round.id]);}catch{}if(!valid)return [];
      ratings.set(item.workId,item);
    }
    const observed=favouriteExposure(entry.round,entry.answer);if(!observed)return [];
    const selected=entry.answer.selectedIds.map(id=>ratings.get(id)),outside=captured.filter(item=>observed.presentedIds.includes(item.workId)&&!entry.answer.selectedIds.includes(item.workId)),pairs=selected.flatMap(chosen=>outside.filter(other=>other.value-chosen.value>=15).map(other=>({selectedWorkId:chosen.workId,unselectedWorkId:other.workId,selectedBefore:chosen.value,unselectedBefore:other.value,sourceRoundIds:unique([chosen.roundId,other.roundId])}))).sort((a,b)=>(b.unselectedBefore-b.selectedBefore)-(a.unselectedBefore-a.selectedBefore));
    // One representative per selected painting; unselected alternatives are not
    // repeated as an artificial pile of independent counterexamples.
    const seenSelected=new Set(),uniquePairs=pairs.filter(pair=>{if(seenSelected.has(pair.selectedWorkId))return false;seenSelected.add(pair.selectedWorkId);return true;});if(!uniquePairs.length)return [];
    const support=[profileEvidence(entry,unique(uniquePairs.flatMap(pair=>[pair.selectedWorkId,pair.unselectedWorkId])),'Explicit favourites: '+entry.answer.selectedIds.map(id=>short(known.get(id))).join(', ')+'. Other offered paintings were not selected; that does not establish dislike.','Your favourites')];
    for(const pair of uniquePairs)for(const id of [pair.selectedWorkId,pair.unselectedWorkId]){const item=ratings.get(id);support.push({roundId:item.roundId,label:'Captured earlier overall appeal',detail:`${short(known.get(id))}: ${item.value} on its earlier overall-appeal scale.`,workIds:[id]});}
    return [{id:'closing-favourites-'+entry.round.id,module:'favourite-refinement',kind:'taste',title:'Your favourites refined the earlier ratings.',text:`You explicitly chose ${short(known.get(uniquePairs[0].selectedWorkId))} as a favourite, while leaving ${short(known.get(uniquePairs[0].unselectedWorkId))} outside that selection despite its higher captured earlier rating. The favourites question added information about these exact works.`,support,counter:[],priority:12,evidence:unique(support.flatMap(item=>item.workIds)),pairs:uniquePairs,readingBasis:'explicit-favourite-refinement',presentedIds:observed.presentedIds,comparisons:uniquePairs.map(pair=>({workIds:[pair.selectedWorkId,pair.unselectedWorkId],sourceRoundIds:[...pair.sourceRoundIds,entry.round.id],measures:[{key:'preference',label:'Captured earlier overall appeal',values:[pair.selectedBefore,pair.unselectedBefore]}]})),alternatives:[...limits,'An explicit favourite selection and a continuous rating are different decisions. Their difference is not a false answer or proof that taste changed.','Only actually presented unselected paintings supply this comparison. Unvisited pages and unavailable works remain unknown; non-selection is not treated as dislike.','Earlier values are the captured candidate ratings, retained as presentation history rather than recomputed after this selection.']}];
  });
}

function consolidateChecks(roundObservations,known){
  const groups=new Map();for(const observation of roundObservations){const feature=observation.checks[0].primary.feature;groups.set(feature,[...(groups.get(feature)||[]),observation]);}
  const uniqueEvidence=items=>{const seen=new Set();return items.filter(item=>{const signature=JSON.stringify([item.roundId,item.workIds,item.detail]);if(seen.has(signature))return false;seen.add(signature);return true;});};
  return [...groups].map(([feature,observations])=>{
    const checks=observations.flatMap(item=>item.checks),reversed=checks.filter(check=>check.status==='reversed'),matched=checks.filter(check=>check.status==='matched'),near=checks.filter(check=>check.status==='near-tie'),lead=reversed[0]||matched[0]||near[0],otherCase=lead.status==='reversed'?matched[0]||near[0]:lead.status==='matched'?near[0]:null,examples=[lead,...(otherCase?[otherCase]:[])];
    const title=reversed.length?`${featureNames[feature]} did not settle these choices.`:matched.length?`The ${featureNames[feature].toLowerCase()} prediction matched here.`:`No clear order in the ${featureNames[feature].toLowerCase()} check.`;
    const text=examples.map(check=>{
      const predicted=known.get(check.predictedWorkId),other=known.get(check.workIds.find(id=>id!==check.predictedWorkId));
      if(check.status==='near-tie')return `${short(predicted)} and ${short(other)} were near-tied, leaving the ${hypothesisLabel(check.primary)} prediction unresolved.`;
      if(check.status==='matched')return `${short(predicted)} came ahead of ${short(other)}, agreeing with the captured prediction for ${hypothesisLabel(check.primary)}.`;
      return `${short(other)} came ahead of ${short(predicted)}, against the captured prediction for ${hypothesisLabel(check.primary)}.${check.rival?` The rival description, ${hypothesisLabel(check.rival)}, pointed towards ${short(other)}.`:''}`;
    }).join(' ');
    const support=uniqueEvidence(observations.flatMap(item=>item.support)),counter=uniqueEvidence(observations.flatMap(item=>item.counter)),displayWorkIds=lead.observedWorkId?[lead.observedWorkId,lead.workIds.find(id=>id!==lead.observedWorkId)]:[...lead.workIds];
    const orderedComparisons=examples.map(check=>{const workIds=check.observedWorkId?[check.observedWorkId,check.workIds.find(id=>id!==check.observedWorkId)]:check.workIds;return {workIds,roundId:check.roundId,sourceRoundIds:check.sourceRoundIds,role:check.status==='reversed'?'counter':'support',predictedWorkId:check.predictedWorkId,rivalPredictedWorkId:check.rivalPredictedWorkId,measures:[{key:'preference',label:'Overall appeal in this comparison',values:workIds.map(id=>check.positions[id])}]};});
    return {id:'closing-check-feature-'+feature,module:'closing-checks',kind:'taste',title,text,support,counter,evidence:unique([...support,...counter].flatMap(item=>item.workIds)),priority:12,feature,checks,comparisonCount:checks.length,sourceQuestionCount:observations.length,distinctPairCount:unique(checks.map(check=>key(check.workIds))).length,sourceRoundIds:unique(checks.flatMap(check=>check.sourceRoundIds)),readingBasis:checks.every(check=>check.comparisonNovel)?'prospective-new-comparisons':'descriptive-recheck',sourceFindingIds:observations.map(item=>item.id),comparisons:orderedComparisons,displayWorkIds,displayNotes:Object.fromEntries(displayWorkIds.map(id=>[id,{description:lead.status==='near-tie'?'Near-tied in this comparison':id===lead.observedWorkId?'Rated higher in this comparison':'Rated lower in this comparison',basis:id===lead.predictedWorkId?'Captured primary prediction':id===lead.rivalPredictedWorkId?'Captured rival prediction':'Overall appeal'}])),outcomeCounts:{matched:matched.length,reversed:reversed.length,nearTied:near.length},alternatives:unique([...limits,...observations.flatMap(item=>item.alternatives), 'Checks sharing a primary feature are displayed together. Directions and frozen training sources can differ between questions; they are not pooled into an accuracy rate or counted as independent replications.'])};
  });
}

export function buildClosingReadings({works=[],rounds=[],answers={}}={}){
  works=Array.isArray(works)?works:[];rounds=Array.isArray(rounds)?rounds:[];answers=plain(answers)?answers:{};
  const entries=validatedProfileEntries({works,rounds,answers}),definitions=definitionIndex(rounds),workCounts=new Map();for(const work of works)workCounts.set(work?.id,(workCounts.get(work?.id)||0)+1);
  const known=new Map(works.filter(work=>workCounts.get(work?.id)===1&&typeof work.title==='string').map(work=>[work.id,work])),checks=[],roundObservations=[];
  for(const entry of entries){const valid=validChecks(entry,rounds,answers,definitions,known);if(valid.length){checks.push(...valid);roundObservations.push(checkObservation(entry,valid,definitions,known));}}
  const favouriteRefinements=favouriteOverrides(entries,answers,definitions,known),observations=[...consolidateChecks(roundObservations,known),...favouriteRefinements];
  return {checks,roundObservations,favouriteRefinements,observations,coverage:{checkRounds:roundObservations.length,comparedPairs:checks.length,distinctComparedPairs:unique(checks.map(check=>key(check.workIds))).length,newPairChecks:checks.filter(check=>check.comparisonNovel).length,rechecks:checks.filter(check=>!check.comparisonNovel).length,favouriteRefinements:favouriteRefinements.length},limits:[...limits]};
}
