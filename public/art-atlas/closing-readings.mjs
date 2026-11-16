import {validAnswer,FEATURES} from './engine.mjs';
import {isOverallAppealRound,APPEAL_PROTOCOL} from './appeal-scale.mjs';
import {validatedProfileEntries,profileEvidence,artworkSetKey,favouriteExposure} from './profile-evidence.mjs';
import {validScenarioDraft} from './scenarios.mjs';
import {FEATURE_SEMANTIC_VERSION,isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import {COMPARISON_PROTOCOL,COMPARISON_SCOPE,isComparisonPreferenceRound,comparisonDirection} from './comparison-protocol.mjs';
import {CONTINUOUS_PROTOCOL,CONTINUOUS_SCOPE,isContinuousPreferenceRound} from './continuous-preference.mjs';

export const CLOSING_READING_PROTOCOL='closing-refinement-v1';
export const ORDINAL_CLOSING_READING_PROTOCOL='closing-refinement-v2-ordinal';
export const CONTINUOUS_CLOSING_READING_PROTOCOL='closing-refinement-v3-continuous';
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
  return !!source&&source.index<checkIndex&&!round.unavailable&&isOverallAppealRound(round)&&round.evidence.appealProtocol===APPEAL_PROTOCOL&&families.has(round.evidence.family)&&workIds.length>=2&&workIds.length<=4&&new Set(workIds).size===workIds.length&&workIds.every(id=>known.has(id))&&(!Object.hasOwn(round,'workIds')||Array.isArray(round.workIds)&&round.workIds.join('|')===workIds.join('|'));
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

const ordinalLimits=['These compare a captured earlier description with the order in a later question. They do not identify a psychological cause.','Only order and exact ties are interpreted. Wider line spacing does not mean stronger liking or greater certainty.','The feature was selected after earlier choices. Other visual qualities, subjects, artists and familiarity remain possible explanations.','A new pairing can contain familiar paintings. Pairs in one question and repeated works do not provide independent replications.'];
function validOrdinalSource(source,index,known,protocol=COMPARISON_PROTOCOL){
  const round=source?.round,offered=round&&Array.isArray(round.works)?ids(round):[];
  return !!source&&source.index<index&&!round.unavailable&&(protocol===CONTINUOUS_PROTOCOL?isContinuousPreferenceRound(round):isComparisonPreferenceRound(round)&&!isContinuousPreferenceRound(round))&&families.has(round.evidence.family)&&offered.length>=2&&offered.length<=8&&new Set(offered).size===offered.length&&offered.every(id=>known.has(id))&&(!Object.hasOwn(round,'workIds')||Array.isArray(round.workIds)&&round.workIds.join('|')===offered.join('|'));
}
function frozenOrdinalHypothesis(hypothesis,index,definitions,known,registered,protocol=COMPARISON_PROTOCOL){
  const continuous=protocol===CONTINUOUS_PROTOCOL,weightBasis=continuous?'continuous-personal-appeal-gap':'within-set-order-only';
  if(!plain(hypothesis)||!FEATURES.includes(hypothesis.feature)||![-1,1].includes(hypothesis.direction)||hypothesis.measurementScope!==protocol||hypothesis.weightBasis!==weightBasis||!Array.isArray(hypothesis.trainingRoundIds)||hypothesis.trainingRoundIds.length<3||new Set(hypothesis.trainingRoundIds).size!==hypothesis.trainingRoundIds.length||!Array.isArray(hypothesis.trainingEvidence)||hypothesis.trainingEvidence.length!==hypothesis.trainingRoundIds.length||!Array.isArray(hypothesis.supportingRoundIds)||hypothesis.supportingRoundIds.length<2||new Set(hypothesis.supportingRoundIds).size!==hypothesis.supportingRoundIds.length||!plain(hypothesis.testFeatureValues))return null;
  if(literal(hypothesis.feature)&&hypothesis.featureSemanticVersion!==FEATURE_SEMANTIC_VERSION)return null;
  const sets=new Set(),artists=new Set(),snapshotIds=new Set(),groups=[];
  for(const snapshot of hypothesis.trainingEvidence){
    if(!plain(snapshot)||snapshotIds.has(snapshot.roundId)||!hypothesis.trainingRoundIds.includes(snapshot.roundId)||!registered.includes(snapshot.roundId))return null;
    const source=definitions.get(snapshot.roundId);
    if(!validOrdinalSource(source,index,known,protocol)||source.round.evidence.repeatOf||['repeat','probe','check','counterexample','heldout','holdout'].includes(source.round.evidence.role)||!sameSet(snapshot.workIds,ids(source.round))||snapshot.criterion!=='preference'||snapshot.confirmed!==true||snapshot.measurementScope!==protocol||!plain(snapshot.positions)||Object.keys(snapshot.positions).length!==snapshot.workIds.length||snapshot.workIds.some(id=>!score(snapshot.positions[id]))||!plain(snapshot.featureValues)||Object.keys(snapshot.featureValues).some(id=>!snapshot.workIds.includes(id)||!featureValue(snapshot.featureValues[id])))return null;
    let valid=false;try{valid=validAnswer(source.round,{confirmed:true,criterion:'preference',workIds:ids(source.round),positions:snapshot.positions});}catch{}if(!valid)return null;
    if(literal(hypothesis.feature)&&(!plain(snapshot.featureSemanticVersions)||snapshot.workIds.some(id=>snapshot.featureSemanticVersions[id]!==FEATURE_SEMANTIC_VERSION||!Object.hasOwn(snapshot.featureValues,id))))return null;
    const signature=artworkSetKey(source.round);if(sets.has(signature))return null;sets.add(signature);snapshotIds.add(snapshot.roundId);
    const observations=snapshot.workIds.flatMap((a,i)=>snapshot.workIds.slice(i+1).flatMap(b=>{if(!Object.hasOwn(snapshot.featureValues,a)||!Object.hasOwn(snapshot.featureValues,b))return [];const direction=comparisonDirection(source.round,{positions:snapshot.positions},a,b);return direction?[direction*(snapshot.featureValues[a]-snapshot.featureValues[b])*(continuous?Math.abs(snapshot.positions[a]-snapshot.positions[b])/100:1)]:[];}));
    if(!observations.length)return null;groups.push({roundId:snapshot.roundId,value:mean(observations)});
    for(const work of source.round.works)if(work.artistKnown!==false&&typeof work.artist==='string'&&work.artist.trim()&&!/unknown|unidentified|anonymous/i.test(work.artist))artists.add(work.artist.trim().toLowerCase());
  }
  if(sets.size<3||artists.size<4||Math.abs(mean(groups.map(group=>group.value)))<.035||Math.sign(mean(groups.map(group=>group.value)))!==hypothesis.direction||hypothesis.supportingRoundIds.some(id=>!groups.some(group=>group.roundId===id&&group.value*hypothesis.direction>=.025)))return null;
  return {feature:hypothesis.feature,direction:hypothesis.direction,measurementScope:protocol,weightBasis,trainingRoundIds:[...hypothesis.trainingRoundIds],supportingRoundIds:[...hypothesis.supportingRoundIds],trainingEvidence:structuredClone(hypothesis.trainingEvidence),testFeatureValues:structuredClone(hypothesis.testFeatureValues),sourceSetCount:sets.size,namedArtistCount:artists.size,...(literal(hypothesis.feature)?{featureSemanticVersion:FEATURE_SEMANTIC_VERSION}:{})};
}
function ordinalChecks(entry,rounds,answers,definitions,known){
  const round=entry.round,meta=round.evidence?.finalRefinement,continuous=meta?.protocol===CONTINUOUS_CLOSING_READING_PROTOCOL,protocol=continuous?CONTINUOUS_PROTOCOL:COMPARISON_PROTOCOL;
  if(![ORDINAL_CLOSING_READING_PROTOCOL,CONTINUOUS_CLOSING_READING_PROTOCOL].includes(meta?.protocol)||meta.binding!=='bound'||!Number.isInteger(meta.slot)||meta.slot<1||meta.slot>5||!['rival-check','feature-check','exception-check'].includes(meta.role)||!(continuous?isContinuousPreferenceRound(round):isComparisonPreferenceRound(round)&&!isContinuousPreferenceRound(round))||!families.has(round.evidence.family)||round.evidence.role!=='probe'||round.evidence.repeatOf||![2,4].includes(round.works.length)||!Array.isArray(meta.sourceRoundIds)||new Set(meta.sourceRoundIds).size!==meta.sourceRoundIds.length||meta.sourceRoundIds.some(id=>!validOrdinalSource(definitions.get(id),entry.index,known,protocol))||!Array.isArray(meta.hypotheses)||!Array.isArray(meta.checks))return [];
  const primary=frozenOrdinalHypothesis(meta.hypotheses[0],entry.index,definitions,known,meta.sourceRoundIds,protocol),rival=frozenOrdinalHypothesis(meta.hypotheses[1],entry.index,definitions,known,meta.sourceRoundIds,protocol);if(!primary||[primary,...(rival?[rival]:[])].some(hypothesis=>Object.entries(hypothesis.testFeatureValues).some(([id,value])=>!ids(round).includes(id)||!featureValue(value))))return [];
  if(continuous&&[primary,...(rival?[rival]:[])].some(h=>literal(h.feature)&&(!plain(meta.hypotheses.find(value=>value.feature===h.feature)?.testFeatureSemanticVersions)||ids(round).some(id=>meta.hypotheses.find(value=>value.feature===h.feature).testFeatureSemanticVersions[id]!==FEATURE_SEMANTIC_VERSION))))return [];
  const seen=new Set();
  return meta.checks.flatMap(check=>{
    if(!plain(check)||!Array.isArray(check.workIds)||check.workIds.length!==2||new Set(check.workIds).size!==2||check.workIds.some(id=>!ids(round).includes(id))||!check.workIds.includes(check.prediction)||typeof check.comparisonNovel!=='boolean'||check.artworksMayBeFamiliar!==true||check.holdoutUnit!==(check.comparisonNovel?'new-comparison':null))return [];
    const signature=key(check.workIds);if(seen.has(signature))return [];seen.add(signature);
    const predictionFor=hypothesis=>{if(!hypothesis||check.workIds.some(id=>!featureValue(hypothesis.testFeatureValues[id])))return null;const [a,b]=check.workIds,difference=(hypothesis.testFeatureValues[a]-hypothesis.testFeatureValues[b])*hypothesis.direction;return Math.abs(difference)<.25?null:difference>0?a:b;};
    if(predictionFor(primary)!==check.prediction)return [];
    if(check.workIds.some(id=>!isReviewedVisualDescriptor(round.works.find(work=>work.id===id),primary.feature)))return [];
    if(check.rivalPrediction!==null&&check.rivalPrediction!==undefined&&(!rival||rival.feature===primary.feature||check.rivalPrediction===check.prediction||predictionFor(rival)!==check.rivalPrediction||check.workIds.some(id=>!isReviewedVisualDescriptor(round.works.find(work=>work.id===id),rival.feature))))return [];
    const visibility=exposureBefore(check.workIds,entry.index,rounds,answers,known);if(check.comparisonNovel&&visibility!=='not-seen')return [];
    const other=check.workIds.find(id=>id!==check.prediction),direction=comparisonDirection(round,entry.answer,check.prediction,other);if(direction===null)return [];
    const status=direction===0?'tie':direction>0?'matched':'reversed',observedWorkId=direction===0?null:direction>0?check.prediction:other;
    return [{id:(continuous?'continuous-closing-':'ordinal-closing-')+round.id+'-'+signature,roundId:round.id,workIds:[check.prediction,other],status,observedWorkId,predictedWorkId:check.prediction,rivalPredictedWorkId:check.rivalPrediction||null,rivalStatus:check.rivalPrediction?(status==='tie'?'tie':observedWorkId===check.rivalPrediction?'matched':'reversed'):null,gap:continuous?entry.answer.positions[check.prediction]-entry.answer.positions[other]:direction,positions:Object.fromEntries(check.workIds.map(id=>[id,entry.answer.positions[id]])),measurementScope:protocol,comparisonBasis:continuous?CONTINUOUS_SCOPE:COMPARISON_SCOPE,tiePolicy:'exact-tie',comparisonNovel:check.comparisonNovel,holdoutUnit:check.holdoutUnit,visibility,artworksMayBeFamiliar:true,primary,rival:check.rivalPrediction?rival:null,sourceRoundIds:unique([...primary.trainingRoundIds,...(check.rivalPrediction?rival.trainingRoundIds:[]),round.id])}];
  });
}
function frozenOrder(snapshot,known){
  const groups=new Map();for(const id of snapshot.workIds){const value=snapshot.positions[id];groups.set(value,[...(groups.get(value)||[]),short(known.get(id))]);}
  return [...groups].sort((a,b)=>b[0]-a[0]).map(([,names])=>names.join(' tied with ')).join(' ahead of ');
}
const continuousLimits=['The later response is compared with an explanation captured before it. This is a descriptive check, not a psychological cause or calibrated prediction.','Positions retain personal-appeal levels and gaps. An exact tie differs from a close but unequal rating.','Training groups have separate contributions. Repeated paintings and pairs are dependent observations, not new independent examples.'];
function ordinalObservations(entries,allChecks,known){
  const groups=new Map();for(const check of allChecks){const token=JSON.stringify([check.measurementScope,check.primary.feature]);groups.set(token,[...(groups.get(token)||[]),check]);}
  return [...groups.values()].map(checks=>{
    const feature=checks[0].primary.feature,continuous=checks[0].measurementScope===CONTINUOUS_PROTOCOL,protocol=continuous?CONTINUOUS_PROTOCOL:COMPARISON_PROTOCOL,basis=continuous?CONTINUOUS_SCOPE:COMPARISON_SCOPE;
    const reversed=checks.filter(check=>check.status==='reversed'),matched=checks.filter(check=>check.status==='matched'),tied=checks.filter(check=>check.status==='tie'),lead=reversed[0]||matched[0]||tied[0],second=lead.status==='reversed'?matched[0]||tied[0]:lead.status==='matched'?tied[0]:null,examples=[lead,...(second?[second]:[])];
    const describe=check=>{
      const result=check.status==='tie'?`${short(known.get(check.workIds[0]))} and ${short(known.get(check.workIds[1]))} were tied, leaving the ${hypothesisLabel(check.primary)} prediction unresolved.`:`${short(known.get(check.observedWorkId))} came ahead of ${short(known.get(check.workIds.find(id=>id!==check.observedWorkId)))}, ${check.status==='matched'?'agreeing with':'against'} the captured prediction for ${hypothesisLabel(check.primary)}.${check.status==='reversed'&&check.rival?' The rival description pointed towards that work.':''}`;
      return result+(continuous?` Their personal-appeal placements were ${check.workIds.map(id=>check.positions[id]).join(' and ')}, a ${Math.abs(check.gap)}-point gap.`:'');
    };
    const outcomes=checks.map(check=>{const source=entries.find(item=>item.round.id===check.roundId);return profileEvidence(source,check.workIds,describe(check),continuous?'Closing personal appeal':'Closing preference order');});
    const hypotheses=[...new Map(checks.flatMap(check=>[check.primary,...(check.rival?[check.rival]:[])]).map(h=>[JSON.stringify([h.feature,h.direction,h.trainingRoundIds]),h])).values()];
    const training=hypotheses.flatMap(h=>h.trainingEvidence.map(snapshot=>({roundId:snapshot.roundId,label:continuous?'Captured earlier personal appeal':'Captured earlier preference order',detail:(continuous?snapshot.workIds.map(id=>short(known.get(id))+': '+snapshot.positions[id]).join('; '):frozenOrder(snapshot,known))+'. The visual description was captured before the later question.',workIds:[...snapshot.workIds],measurementScope:protocol,sourceRole:'frozen training response'})));
    const support=[...new Map([...outcomes,...training].map(item=>[JSON.stringify([item.roundId,item.workIds,item.detail]),item])).values()],counter=checks.filter(check=>check.status==='reversed').map(check=>outcomes[checks.indexOf(check)]),displayWorkIds=lead.observedWorkId?[lead.observedWorkId,lead.workIds.find(id=>id!==lead.observedWorkId)]:[...lead.workIds];
    return {id:(continuous?'continuous':'ordinal')+'-closing-check-feature-'+feature,module:'closing-checks',kind:'taste',title:reversed.length?`${featureNames[feature]} did not settle these choices.`:matched.length?`The ${featureNames[feature].toLowerCase()} prediction matched here.`:`An exact tie in the ${featureNames[feature].toLowerCase()} check.`,text:examples.map(describe).join(' '),support,counter,evidence:unique(support.flatMap(item=>item.workIds)),priority:12,feature,checks,comparisonCount:checks.length,sourceQuestionCount:unique(checks.map(check=>check.roundId)).length,distinctPairCount:unique(checks.map(check=>key(check.workIds))).length,sourceRoundIds:unique(checks.flatMap(check=>check.sourceRoundIds)),measurementScope:protocol,comparisonBasis:basis,tiePolicy:'exact-tie',readingBasis:checks.every(check=>check.comparisonNovel)?'prospective-new-comparisons':'descriptive-recheck',displayWorkIds,comparisons:examples.map(check=>({workIds:check.workIds,roundId:check.roundId,sourceRoundIds:check.sourceRoundIds,role:check.status==='reversed'?'counter':'support',predictedWorkId:check.predictedWorkId,rivalPredictedWorkId:check.rivalPredictedWorkId,comparisonBasis:basis,measures:[{key:'preference',label:continuous?'Personal appeal':'Preference within this comparison',roundId:check.roundId,values:check.workIds.map(id=>check.positions[id]),valueMeaning:continuous?'personal-appeal-level-and-gap':'order-only'}]})),displayNotes:Object.fromEntries(displayWorkIds.map(id=>[id,{description:lead.status==='tie'?'Tied in this comparison':id===lead.observedWorkId?'Came ahead in this comparison':'Came behind in this comparison',basis:continuous?'Recorded personal appeal':'Recorded comparison order'}])),outcomeCounts:{matched:matched.length,reversed:reversed.length,tied:tied.length,nearTied:0},alternatives:[...(continuous?continuousLimits:ordinalLimits),checks.every(check=>check.comparisonNovel)?'Earlier presentation records support a new pairing, rather than unseen paintings.':'At least one pairing is a descriptive recheck. Memory and earlier company remain relevant.','Training responses and descriptor values are the frozen earlier snapshots. Later edits do not refit the prediction.']};
  });
}
function ordinalFavouriteOverrides(entries,definitions,known){
  return entries.filter(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='shortlist'&&entry.round.evidence?.construct==='overall-favourites'&&entry.round.evidence.explicitFavourites===true&&[COMPARISON_PROTOCOL,CONTINUOUS_PROTOCOL].includes(entry.round.evidence.anchorComparisonProtocol)&&entry.round.evidence.finalRefinement?.protocol===(entry.round.evidence.anchorComparisonProtocol===CONTINUOUS_PROTOCOL?CONTINUOUS_CLOSING_READING_PROTOCOL:ORDINAL_CLOSING_READING_PROTOCOL)&&entry.round.evidence.finalRefinement.binding==='bound'&&entry.round.evidence.finalRefinement.role==='favourites'&&!entry.answer.unsure).flatMap(entry=>{
    const protocol=entry.round.evidence.anchorComparisonProtocol,continuous=protocol===CONTINUOUS_PROTOCOL,basis=continuous?CONTINUOUS_SCOPE:COMPARISON_SCOPE,meta=entry.round.evidence.finalRefinement,exposure=favouriteExposure(entry.round,entry.answer);if(!exposure||!Array.isArray(meta.sourceComparisons)||!meta.sourceComparisons.length||!Array.isArray(meta.sourceRoundIds)||new Set(meta.sourceRoundIds).size!==meta.sourceRoundIds.length||meta.sourceRoundIds.some(id=>!validOrdinalSource(definitions.get(id),entry.index,known,protocol)))return [];
    const snapshots=[],seen=new Set();for(const snapshot of meta.sourceComparisons){const source=definitions.get(snapshot?.roundId);if(!plain(snapshot)||seen.has(snapshot.roundId)||!meta.sourceRoundIds.includes(snapshot.roundId)||!validOrdinalSource(source,entry.index,known,protocol)||(continuous?snapshot.continuousProtocol!==CONTINUOUS_PROTOCOL:snapshot.comparisonProtocol!==COMPARISON_PROTOCOL)||snapshot.confirmed!==true||!sameSet(snapshot.workIds,ids(source.round))||!plain(snapshot.positions)||Object.keys(snapshot.positions).length!==snapshot.workIds.length||snapshot.workIds.some(id=>!score(snapshot.positions[id])))return [];let valid=false;try{valid=validAnswer(source.round,{confirmed:true,criterion:'preference',workIds:ids(source.round),positions:snapshot.positions});}catch{}if(!valid)return [];seen.add(snapshot.roundId);snapshots.push({snapshot,source});}
    const pairs=[],selected=new Set(entry.answer.selectedIds),used=new Set();
    for(const {snapshot,source}of snapshots)for(const chosen of snapshot.workIds.filter(id=>selected.has(id))){if(used.has(chosen))continue;const other=snapshot.workIds.find(id=>!selected.has(id)&&exposure.presentedIds.includes(id)&&comparisonDirection(source.round,{positions:snapshot.positions},id,chosen)===1);if(!other)continue;used.add(chosen);pairs.push({selectedWorkId:chosen,unselectedWorkId:other,sourceRoundIds:[source.round.id],sourceSnapshot:structuredClone(snapshot),earlierOrder:[other,chosen]});}
    if(!pairs.length)return [];const support=[profileEvidence(entry,unique(pairs.flatMap(pair=>[pair.selectedWorkId,pair.unselectedWorkId])),'Explicit favourites: '+entry.answer.selectedIds.map(id=>short(known.get(id))).join(', ')+'. Non-selection is not dislike.','Your favourites'),...pairs.map(pair=>({roundId:pair.sourceRoundIds[0],label:'Captured order in one earlier group',detail:`${short(known.get(pair.unselectedWorkId))} came ahead of ${short(known.get(pair.selectedWorkId))} in this original comparison.`,workIds:[pair.selectedWorkId,pair.unselectedWorkId],measurementScope:protocol}))];
    return [{id:'ordinal-closing-favourites-'+entry.round.id,module:'favourite-refinement',kind:'taste',title:'A favourite was lower in an earlier group.',text:`You selected ${short(known.get(pairs[0].selectedWorkId))} as a favourite after ${short(known.get(pairs[0].unselectedWorkId))} came ahead in their earlier group. Leaving the other work unselected does not mean it was disliked.`,support,counter:[],priority:12,evidence:unique(support.flatMap(item=>item.workIds)),pairs,readingBasis:'explicit-favourite-after-local-order',comparisonBasis:basis,presentedIds:exposure.presentedIds,comparisons:pairs.map(pair=>({workIds:[pair.selectedWorkId,pair.unselectedWorkId],sourceRoundIds:[...pair.sourceRoundIds,entry.round.id],comparisonBasis:basis,measures:[{key:'preference',label:'Earlier order in their original group',values:[pair.sourceSnapshot.positions[pair.selectedWorkId],pair.sourceSnapshot.positions[pair.unselectedWorkId]],valueMeaning:continuous?'personal-appeal-level-and-gap':'order-only'}]})),alternatives:[...(continuous?continuousLimits:ordinalLimits),'Only paintings from the same captured earlier comparison can supply this connection. Locations from separate groups are never ranked against one another.','A favourite declaration is a different question from ordering an offered group. This does not establish an error or a change in taste.','Only actually presented unselected works are used. Unvisited pages, None and Not sure do not establish dislike.']}];
  });
}

export function buildClosingReadings({works=[],rounds=[],answers={}}={}){
  works=Array.isArray(works)?works:[];rounds=Array.isArray(rounds)?rounds:[];answers=plain(answers)?answers:{};
  const entries=validatedProfileEntries({works,rounds,answers}),definitions=definitionIndex(rounds),workCounts=new Map();for(const work of works)workCounts.set(work?.id,(workCounts.get(work?.id)||0)+1);
  const known=new Map(works.filter(work=>workCounts.get(work?.id)===1&&typeof work.title==='string').map(work=>[work.id,work])),checks=[],roundObservations=[],newChecks=[];
  for(const entry of entries){const valid=validChecks(entry,rounds,answers,definitions,known);if(valid.length){checks.push(...valid);roundObservations.push(checkObservation(entry,valid,definitions,known));}newChecks.push(...ordinalChecks(entry,rounds,answers,definitions,known));}
  const ordinalRoundObservations=unique(newChecks.map(check=>check.roundId)).flatMap(roundId=>ordinalObservations(entries,newChecks.filter(check=>check.roundId===roundId),known)),favouriteRefinements=[...favouriteOverrides(entries,answers,definitions,known),...ordinalFavouriteOverrides(entries,definitions,known)],observations=[...consolidateChecks(roundObservations,known),...ordinalObservations(entries,newChecks,known),...favouriteRefinements],allChecks=[...checks,...newChecks],hasOrdinal=entries.some(entry=>entry.round.evidence?.finalRefinement?.protocol===ORDINAL_CLOSING_READING_PROTOCOL),hasContinuous=entries.some(entry=>entry.round.evidence?.finalRefinement?.protocol===CONTINUOUS_CLOSING_READING_PROTOCOL);
  return {checks:allChecks,roundObservations:[...roundObservations,...ordinalRoundObservations],favouriteRefinements,observations,coverage:{checkRounds:roundObservations.length+ordinalRoundObservations.length,ordinalCheckRounds:ordinalRoundObservations.length,overallCheckRounds:roundObservations.length,comparedPairs:allChecks.length,distinctComparedPairs:unique(allChecks.map(check=>key(check.workIds))).length,newPairChecks:allChecks.filter(check=>check.comparisonNovel).length,rechecks:allChecks.filter(check=>!check.comparisonNovel).length,favouriteRefinements:favouriteRefinements.length},limits:hasContinuous?unique([...continuousLimits,...(hasOrdinal?ordinalLimits:[]),...(checks.length?limits:[])]):hasOrdinal?(checks.length?unique([...ordinalLimits,...limits]):[...ordinalLimits]):[...limits]};
}
