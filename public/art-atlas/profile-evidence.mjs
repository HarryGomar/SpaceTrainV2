import {validAnswer,AXES} from './engine.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
import {COMPARISON_PROTOCOL,COMPARISON_SCOPE,isComparisonPreferenceRound} from './comparison-protocol.mjs';
import {CONTINUOUS_PROTOCOL,CONTINUOUS_SCOPE,isContinuousPreferenceRound} from './continuous-preference.mjs';
import * as discoveryGrid from './discovery-grid.mjs';

const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unique=values=>[...new Set(values)];
const ids=round=>round.works.map(work=>work.id);
export const artworkSetKey=round=>JSON.stringify([...ids(round)].sort());
const short=work=>work.shortTitle||work.title;
export const POSITIVE_APPEAL=65;
export const LOW_APPEAL=35;

/** Validate identities and the original response instrument before using a number.
 * A stored axis definition is retained even when it differs from today's axis.
 * Such maps may be displayed, but require a separate semantic check to interpret.
 */
export function validatedProfileEntries({works=[],rounds=[],answers={}}={}){
  if(!Array.isArray(works)||!Array.isArray(rounds)||!plain(answers))return [];
  const workCounts=new Map(),roundCounts=new Map();
  for(const work of works)if(typeof work?.id==='string')workCounts.set(work.id,(workCounts.get(work.id)||0)+1);
  for(const round of rounds)if(typeof round?.id==='string')roundCounts.set(round.id,(roundCounts.get(round.id)||0)+1);
  const catalogue=new Map(works.filter(work=>workCounts.get(work?.id)===1&&typeof work.title==='string'&&work.title).map(work=>[work.id,work]));
  return rounds.flatMap((original,index)=>{
    if(!original||roundCounts.get(original.id)!==1||original.unavailable||!['spectrum','grid','choice-grid'].includes(original.kind)||!Array.isArray(original.works)||!original.works.length)return [];
    const workIds=original.works.map(work=>work?.id);
    if(new Set(workIds).size!==workIds.length||workIds.some(id=>!catalogue.has(id))||Object.hasOwn(original,'workIds')&&(!Array.isArray(original.workIds)||original.workIds.join('|')!==workIds.join('|')))return [];
    // Complete saved work objects carry their frozen descriptors. An ID-only
    // definition may use the caller's frozen catalogue, never another identity.
    const round={...original,works:original.works.map(work=>typeof work.title==='string'?work:catalogue.get(work.id))},answer=answers[round.id];
    if(answer?.roundId!==undefined&&answer.roundId!==round.id||hasComparisonMarker(round)&&!isComparisonPreferenceRound(round))return [];
    let valid=false;try{valid=validAnswer(round,answer);}catch{return [];}if(!valid)return [];
    if(round.kind==='spectrum'&&(!plain(answer.positions)||Object.keys(answer.positions).length!==workIds.length)||round.kind==='grid'&&(!AXES[round.axis]||!plain(answer.points)||Object.keys(answer.points).length!==workIds.length||round.axisDefinition!==undefined&&!plain(round.axisDefinition)))return [];
    return [{round,answer,index}];
  });
}

export const hasComparisonMarker=round=>round?.evidence?.comparisonProtocol!==undefined||round?.evidence?.measurementScope===COMPARISON_SCOPE||round?.evidence?.continuousProtocol!==undefined||round?.evidence?.measurementScope===CONTINUOUS_SCOPE;
export function isUnconditionalPreference(round){
  return (!hasComparisonMarker(round)||isComparisonPreferenceRound(round))&&round?.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&round.evidence.unconditional!==false&&!round.brief&&!round.evidence.brief&&round.evidence.family!=='contextual-choice'&&!round.anchorWorks?.length&&!round.anchorIds?.length;
}
export function profileEvidence(entry,workIds,detail,label){
  return {roundId:entry.round.id,label:label||entry.round.title||'Recorded response',detail,workIds:unique(workIds),sourceRole:entry.round.evidence?.repeatOf?'repeated response':entry.round.evidence?.role||'discovery',construct:entry.round.evidence?.construct};
}

/** Old unpaged selections offered one visible group. New paged favourites
 * require their captured page evidence; unvisited pages are never non-selection.
 */
export function favouriteExposure(round,answer){
  const offered=ids(round);
  if(round.evidence?.instrumentRevision!=='paged-favourites-v1')return {presentedIds:offered,coPresentedGroups:[offered]};
  let exposure=null;try{exposure=typeof discoveryGrid.choiceGridExposure==='function'?discoveryGrid.choiceGridExposure(round,answer):null;}catch{return null;}
  if(!exposure||!Array.isArray(exposure.presentedIds)||new Set(exposure.presentedIds).size!==exposure.presentedIds.length||exposure.presentedIds.some(id=>!offered.includes(id))||!Array.isArray(exposure.coPresentedGroups)||exposure.coPresentedGroups.some(group=>!Array.isArray(group)||new Set(group).size!==group.length||group.some(id=>!exposure.presentedIds.includes(id)))||answer.selectedIds?.some(id=>!exposure.presentedIds.includes(id)))return null;
  return {presentedIds:[...exposure.presentedIds],coPresentedGroups:exposure.coPresentedGroups.map(group=>[...group])};
}

function anchorEntry(entry,entries,negative=false){
  const {round,answer}=entry,construct=negative?'overall-dislikes':'overall-favourites',flag=negative?'explicitDislikes':'explicitFavourites';
  if(round.kind!=='choice-grid'||round.selectionMode!=='shortlist'||round.evidence?.construct!==construct||round.evidence[flag]===false||negative&&round.evidence[flag]!==true)return null;
  const exposure=favouriteExposure(round,answer);if(!exposure)return null;
  const marked=round.evidence.anchorComparisonProtocol!==undefined||['closing-refinement-v2-ordinal','closing-refinement-v3-continuous'].includes(round.evidence.finalRefinement?.protocol);
  if(marked){
    const protocol=round.evidence.anchorComparisonProtocol;
    if(![COMPARISON_PROTOCOL,CONTINUOUS_PROTOCOL].includes(protocol)||round.evidence[flag]!==true)return null;
    const earlier=entries.filter(source=>source.index<entry.index&&(protocol===CONTINUOUS_PROTOCOL?isContinuousPreferenceRound(source.round):isComparisonPreferenceRound(source.round)&&!isContinuousPreferenceRound(source.round)));
    if(exposure.presentedIds.some(id=>!earlier.some(source=>source.round.works.some(work=>{const chosen=round.works.find(candidate=>candidate.id===id);return work.id===id&&['sourceUrl','image'].every(key=>work[key]===chosen[key])&&['sha256','previewSha256'].every(key=>work[key]===undefined||chosen[key]===undefined||work[key]===chosen[key]);}))))return null;
  }
  return {...entry,exposure,negative};
}

/** Positive evidence is distinct from an unranked save or a local set winner.
 * Latest comparable overall responses are retained individually, never averaged.
 * A new favourites selection supersedes an earlier selection for works it offers;
 * leaving a work unselected is not converted into a negative liking score.
 */
export function buildPreferenceBasis(entries=[]){
  const overallEntries=entries.filter(entry=>isUnconditionalPreference(entry.round)&&isOverallAppealRound(entry.round));
  const ratings=new Map(),favouriteStates=new Map(),dislikeStates=new Map(),currentAnchors=new Map(),anchorHistories=new Map(),lastDeclarations=new Map();
  for(const entry of overallEntries)for(const work of entry.round.works){
    const previous=ratings.get(work.id),score=entry.answer.positions[work.id],continuous=isContinuousPreferenceRound(entry.round);
    const evidence=profileEvidence(entry,[work.id],`${short(work)}: ${continuous?'personal':'overall'} appeal ${score} on the recorded 0–100 scale.${continuous?` ${score>50?'Above':score<50?'Below':'At'} the neutral anchor.`:''}`, continuous?'Personal appeal':'Overall appeal');
    ratings.set(work.id,{work,workId:work.id,score,entry,sourceRoundIds:unique([...(previous?.sourceRoundIds||[]),entry.round.id]),support:[evidence],history:[...(previous?.history||[]),{roundId:entry.round.id,score,...(continuous?{measurementScope:CONTINUOUS_PROTOCOL}:{})}],basis:continuous?'personal-appeal':'overall-appeal',measurementScope:continuous?CONTINUOUS_PROTOCOL:'overall-appeal-v1',positive:continuous?score>50:score>=POSITIVE_APPEAL,negative:continuous?score<50:score<=LOW_APPEAL,neutral:continuous&&score===50});
  }
  const favourites=entries.flatMap(entry=>{const value=anchorEntry(entry,entries);return value?[value]:[];}),dislikeEntries=entries.flatMap(entry=>{const value=anchorEntry(entry,entries,true);return value?[value]:[];});
  for(const entry of [...favourites,...dislikeEntries].sort((a,b)=>a.index-b.index)){
    if(entry.answer.unsure===true)continue;
    const states=entry.negative?dislikeStates:favouriteStates,type=entry.negative?'dislike':'favourite';
    for(const work of entry.round.works.filter(work=>entry.exposure.presentedIds.includes(work.id))){
      const selected=entry.answer.selectedIds.includes(work.id);states.set(work.id,{work,selected,entry});
      anchorHistories.set(work.id,[...(anchorHistories.get(work.id)||[]),{roundId:entry.round.id,type,selected,index:entry.index}]);
      if(selected){currentAnchors.set(work.id,{type,entry});lastDeclarations.set(work.id,{type,entry});}
      else if(currentAnchors.get(work.id)?.type===type)currentAnchors.delete(work.id);
    }
  }
  const favouriteDeclarations=[...favouriteStates.values()].filter(item=>item.selected).map(item=>{
    const rating=ratings.get(item.work.id);
    return {work:item.work,workId:item.work.id,basis:'overall-favourites',positive:true,score:rating?.score??null,entry:item.entry,sourceRoundIds:unique([item.entry.round.id,...(rating?.sourceRoundIds||[])]),support:[profileEvidence(item.entry,[item.work.id],`${short(item.work)} was explicitly included in your favourites selection. The selected works were not ranked.`, 'Your favourites'),...(rating?.support||[])],counter:rating?.negative?[...rating.support]:[],history:rating?.history||[]};
  });
  const dislikeDeclarations=[...dislikeStates.values()].filter(item=>item.selected).map(item=>{
    const rating=ratings.get(item.work.id),positive=favouriteDeclarations.find(seed=>seed.work.id===item.work.id);
    return {work:item.work,workId:item.work.id,basis:'overall-dislikes',negative:true,score:rating?.score??null,entry:item.entry,sourceRoundIds:unique([item.entry.round.id,...(rating?.sourceRoundIds||[])]),support:[profileEvidence(item.entry,[item.work.id],`${short(item.work)} was explicitly selected as disliked. Other paintings were not assigned the opposite response.`,'Your dislikes')],counter:[...(positive?.support||[]),...(rating?.positive?rating.support:[])],history:rating?.history||[]};
  });
  for(const item of favouriteDeclarations){const negative=dislikeDeclarations.find(seed=>seed.work.id===item.work.id);if(negative)item.counter.push(...negative.support);}
  const selected=favouriteDeclarations.filter(item=>currentAnchors.get(item.work.id)?.type==='favourite'),dislikes=dislikeDeclarations.filter(item=>currentAnchors.get(item.work.id)?.type==='dislike');
  const selectedIds=new Set(selected.map(item=>item.work.id));
  // Favourites have equal status. Their offered order is only a display order.
  const orderedRatings=[...ratings.values()].sort((a,b)=>b.score-a.score||a.entry.index-b.entry.index||ids(a.entry.round).indexOf(a.work.id)-ids(b.entry.round).indexOf(b.work.id));
  const dislikeIds=new Set(dislikes.map(item=>item.work.id)),overallSeeds=orderedRatings.filter(item=>item.positive&&!selectedIds.has(item.work.id)&&!dislikeIds.has(item.work.id)&&!(lastDeclarations.get(item.work.id)?.type==='dislike'&&lastDeclarations.get(item.work.id).entry.index>item.entry.index)).map(item=>({...item,counter:[]}));
  const seeds=[...selected,...overallSeeds],heroSeeds=seeds,negativeSeeds=[...dislikes,...orderedRatings.filter(item=>item.negative&&!dislikeIds.has(item.work.id)&&!selectedIds.has(item.work.id)).map(item=>({...item,counter:[]}))];
  return {
    seeds,heroSeeds,ratings:orderedRatings,favourites:selected,dislikes,negativeSeeds,
    favouriteDeclarations,dislikeDeclarations,anchorHistory:[...anchorHistories].map(([workId,history])=>({workId,history,current:currentAnchors.get(workId)?.type||null})),
    favouriteCandidates:[...favouriteStates.values()],dislikeCandidates:[...dislikeStates.values()],
    basis:selected.length?'overall-favourites':overallEntries.some(entry=>isContinuousPreferenceRound(entry.round))?'personal-appeal':overallEntries.length?'overall-appeal':entries.some(entry=>isComparisonPreferenceRound(entry.round))?COMPARISON_SCOPE:'within-set-comparisons',
    absoluteScaleAvailable:overallEntries.length>0,
    sourceRoundIds:unique([...overallEntries,...favourites,...dislikeEntries].map(entry=>entry.round.id)),
    overallRoundIds:overallEntries.map(entry=>entry.round.id),favouriteRoundIds:favourites.map(entry=>entry.round.id),
    dislikeRoundIds:dislikeEntries.map(entry=>entry.round.id),negativeWorkIds:negativeSeeds.map(item=>item.work.id),conflictingAnchorWorkIds:favouriteDeclarations.filter(item=>dislikeDeclarations.some(negative=>negative.workId===item.workId)).map(item=>item.work.id),
    positiveBand:POSITIVE_APPEAL,lowBand:LOW_APPEAL,continuousNeutral:50,continuousRoundIds:overallEntries.filter(entry=>isContinuousPreferenceRound(entry.round)).map(entry=>entry.round.id),
    limits:['The new personal-appeal scale records levels and differences: above 50 is above neutral, below 50 is below neutral. Older order-only questions retain only their original group ordering.','The 65/35 descriptive bands identify high and low ratings for stronger example contrasts. They are provisional interface rules, not population cut-offs or confidence estimates.','Favourite and dislike selections are separate unranked declarations. Non-selection only withdraws the same declaration for actually presented works; it never supplies the opposite. An unsure answer leaves earlier declarations unchanged.','Repeated ratings remain a response history for the same work; they do not add independent artworks or replications.']
  };
}
