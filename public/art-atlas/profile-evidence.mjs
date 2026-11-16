import {validAnswer,AXES} from './engine.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
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
    let valid=false;try{valid=validAnswer(round,answer);}catch{return [];}if(!valid)return [];
    if(round.kind==='spectrum'&&!plain(answer.positions)||round.kind==='grid'&&(!AXES[round.axis]||!plain(answer.points)||round.axisDefinition!==undefined&&!plain(round.axisDefinition)))return [];
    return [{round,answer,index}];
  });
}

export function isUnconditionalPreference(round){
  return round?.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&round.evidence.unconditional!==false&&!round.brief&&!round.evidence.brief&&round.evidence.family!=='contextual-choice'&&!round.anchorWorks?.length&&!round.anchorIds?.length;
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

/** Positive evidence is distinct from an unranked save or a local set winner.
 * Latest comparable overall responses are retained individually, never averaged.
 * A new favourites selection supersedes an earlier selection for works it offers;
 * leaving a work unselected is not converted into a negative liking score.
 */
export function buildPreferenceBasis(entries=[]){
  const overallEntries=entries.filter(entry=>isUnconditionalPreference(entry.round)&&isOverallAppealRound(entry.round));
  const ratings=new Map(),favouriteStates=new Map();
  for(const entry of overallEntries)for(const work of entry.round.works){
    const previous=ratings.get(work.id),score=entry.answer.positions[work.id];
    const evidence=profileEvidence(entry,[work.id],`${short(work)}: overall appeal ${score} on the recorded 0–100 scale.`, 'Overall appeal');
    ratings.set(work.id,{work,workId:work.id,score,entry,sourceRoundIds:unique([...(previous?.sourceRoundIds||[]),entry.round.id]),support:[evidence],history:[...(previous?.history||[]),{roundId:entry.round.id,score}],basis:'overall-appeal',positive:score>=POSITIVE_APPEAL});
  }
  const favourites=entries.filter(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='shortlist'&&entry.round.evidence?.construct==='overall-favourites'&&favouriteExposure(entry.round,entry.answer));
  for(const entry of favourites)for(const work of entry.round.works.filter(work=>favouriteExposure(entry.round,entry.answer).presentedIds.includes(work.id))){
    favouriteStates.set(work.id,{work,selected:entry.answer.selectedIds.includes(work.id),entry});
  }
  const selected=[...favouriteStates.values()].filter(item=>item.selected).map(item=>{
    const rating=ratings.get(item.work.id);
    return {work:item.work,workId:item.work.id,basis:'overall-favourites',positive:true,score:rating?.score??null,entry:item.entry,sourceRoundIds:unique([item.entry.round.id,...(rating?.sourceRoundIds||[])]),support:[profileEvidence(item.entry,[item.work.id],`${short(item.work)} was explicitly included in your favourites selection. The selected works were not ranked.`, 'Your favourites'),...(rating?.support||[])],counter:rating&&rating.score<=LOW_APPEAL?[...rating.support]:[],history:rating?.history||[]};
  });
  const selectedIds=new Set(selected.map(item=>item.work.id));
  // Favourites have equal status. Their offered order is only a display order.
  const orderedRatings=[...ratings.values()].sort((a,b)=>b.score-a.score||a.entry.index-b.entry.index||ids(a.entry.round).indexOf(a.work.id)-ids(b.entry.round).indexOf(b.work.id));
  const overallSeeds=orderedRatings.filter(item=>item.positive&&!selectedIds.has(item.work.id)).map(item=>({...item,counter:[]}));
  const heroSeeds=[...selected,...orderedRatings.filter(item=>!selectedIds.has(item.work.id)).map(item=>({...item,counter:[]}))];
  return {
    seeds:[...selected,...overallSeeds],heroSeeds,ratings:orderedRatings,favourites:selected,
    basis:selected.length?'overall-favourites':overallEntries.length?'overall-appeal':'within-set-comparisons',
    absoluteScaleAvailable:overallEntries.length>0,
    sourceRoundIds:unique([...overallEntries,...favourites].map(entry=>entry.round.id)),
    overallRoundIds:overallEntries.map(entry=>entry.round.id),favouriteRoundIds:favourites.map(entry=>entry.round.id),
    positiveBand:POSITIVE_APPEAL,lowBand:LOW_APPEAL,
    limits:['Only questions carrying the exact overall-appeal protocol share its liking anchors. Older comparison placements remain within their original sets.','The 65/35 descriptive bands are provisional interface rules, not population cut-offs or confidence estimates.','A favourites selection is positive and unranked. Non-selection, collecting, recognition and museum placement are not dislike.','Repeated ratings remain a response history for the same work; they do not add independent artworks or replications.']
  };
}
