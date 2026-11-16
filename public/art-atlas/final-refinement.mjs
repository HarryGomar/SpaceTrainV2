import {validAnswer} from './engine.mjs';
import {APPEAL_PROTOCOL,withOverallAppeal,isOverallAppealRound} from './appeal-scale.mjs';
import {summarizePreferenceHypotheses,preferenceMeasurementKey} from './adaptive-selection.mjs';
import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import * as choiceGrid from './discovery-grid.mjs';

export const FINAL_REFINEMENT_PROTOCOL='closing-refinement-v1';
const ROLES=['favourites','cross-set','rival-check','exception-check','spaced-return'];
const FAMILY=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const ids=round=>(round.works||[]).map(work=>work.id),unique=values=>[...new Set(values)],sig=values=>JSON.stringify([...values].sort()),pairKey=(a,b)=>sig([a,b]);
const pairs=values=>values.flatMap((a,i)=>values.slice(i+1).map(b=>[a,b]));
const number=id=>/^journey-(\d+)$/.test(id)?Number(id.slice(8)):null;
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const LIMITS=['Closing questions are selected from earlier captured answers, using explicit design heuristics rather than optimal information gain.','Recorded appeal, an explicit favourite selection and a repeated comparison are different evidence. No choice here establishes a personality or a cause of preference.'];
export const isFinalRefinementRound=round=>round?.evidence?.finalRefinement?.protocol===FINAL_REFINEMENT_PROTOCOL;

/** Deferred definitions have real placeholder identities but make no prediction. */
export function buildFinalRefinementRounds({works=[],offset=0,seed='closing-refinement'}={}){
  const placeholder=[...works].filter(work=>work?.id&&work.title).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,4);
  if(placeholder.length<4)throw Error('Closing questions require four available paintings.');
  return ROLES.map((role,index)=>{
    const round={id:'journey-'+String(offset+46+index).padStart(3,'0'),kind:index===0?'choice-grid':'spectrum',title:index===0?'Which are your favourites so far?':'How much does each painting appeal to you?',hint:index===0?'Choose up to five. Choose None if none feels like a favourite.':'',works:[...placeholder],...(index===0?{selectionMode:'shortlist',maxChoices:Math.min(5,placeholder.length)}:{criterion:'preference'}),unavailable:true,unavailableReason:'This closing question needs the earlier completed choices.',evidence:{construct:index===0?'overall-favourites':'preference',family:index===0?'explicit-favourites':'individual-choice',role:'probe',unconditional:index!==0,...(index===0?{explicitFavourites:true}:{}),finalRefinement:{protocol:FINAL_REFINEMENT_PROTOCOL,slot:index+1,role,binding:'deferred',seed:String(seed),offset},limits:[...LIMITS]}};
    return index===0?round:withOverallAppeal(round);
  });
}

function historyFor(round,works,rounds,answers){
  const byId=new Map(works.map(work=>[work.id,work])),counts=new Map();for(const item of rounds)counts.set(item?.id,(counts.get(item?.id)||0)+1);
  const current=number(round.id),history=rounds.filter(item=>item&&item.id!==round.id&&counts.get(item.id)===1&&(!current||!number(item.id)||number(item.id)<current)),preferences=[];
  for(const [index,source] of history.entries()){
    const workIds=ids(source),e=source.evidence,a=answers[source.id];
    if(source.workIds!==undefined&&(!Array.isArray(source.workIds)||source.workIds.join('|')!==workIds.join('|')))continue;
    if(source.unavailable||source.kind!=='spectrum'||source.criterion!=='preference'||e?.construct!=='preference'||!FAMILY.has(e.family)||e.unconditional===false||source.brief||e.brief||source.anchorWorks?.length||source.anchorIds?.length||workIds.length<2||workIds.length>4||new Set(workIds).size!==workIds.length||workIds.some(id=>!byId.has(id))||a?.confirmed!==true||!Array.isArray(a.workIds)||a.workIds.join('|')!==workIds.join('|')||!a.positions||Array.isArray(a.positions)||Object.keys(a.positions).length!==workIds.length||workIds.some(id=>!Number.isInteger(a.positions[id]))||a.roundId!==undefined&&a.roundId!==source.id)continue;
    let valid=false;try{valid=validAnswer(source,a);}catch{}if(valid)preferences.push({round:source,answer:a,index,workIds,scope:preferenceMeasurementKey(source)});
  }
  return {byId,history,preferences,overall:preferences.filter(entry=>isOverallAppealRound(entry.round))};
}
function exposure(round,answers){
  if(round.unavailable||round.kind==='statements'||round.evidence?.stimulusVisibility==='not-shown')return {presented:[],groups:[],unknown:[]};
  if(round.kind==='choice-grid'&&round.evidence?.explicitFavourites){const shown=choiceGrid.choiceGridExposure?.(round,answers[round.id]);return shown?{presented:shown.presentedIds,groups:shown.coPresentedGroups,unknown:[]}:{presented:ids(round),groups:[],unknown:ids(round)};}
  if(round.kind!=='exercise'){const presented=unique([...ids(round),...(round.anchorWorks||[]).map(work=>work.id),...(round.anchorIds||[])]);return {presented,groups:[presented],unknown:[]};}
  const record=answers[round.id]?.record,presented=Array.isArray(round.presentedIds)?round.presentedIds:Array.isArray(record?.presentedIds)?record.presentedIds:[];
  if(Array.isArray(round.coPresentedGroups))return {presented,groups:round.coPresentedGroups,unknown:round.exposureUnknownWorkIds||[]};
  if(!record)return {presented,groups:[],unknown:ids(round)};
  const placed=Object.keys(record.placements||{}),groups=round.exerciseKind==='curate'?[placed]:[presented];
  return {presented,groups,unknown:round.exerciseKind==='curate'?presented.filter(id=>!placed.includes(id)):[]};
}
function latestRatings(entries){const ratings=new Map();for(const entry of entries)for(const workId of entry.workIds)ratings.set(workId,{workId,value:entry.answer.positions[workId],roundId:entry.round.id,index:entry.index});return [...ratings.values()];}
function delayedSource(state,answers,excluded=new Set()){
  const last=new Map();for(const [index,round] of state.history.entries())for(const id of exposure(round,answers).presented)last.set(id,index);
  return state.preferences.filter(entry=>!entry.round.evidence?.repeatOf&&!['repeat','probe','check','counterexample','heldout','holdout'].includes(entry.round.evidence?.role)&&entry.round.evidence?.panelNumber!==1&&number(entry.round.id)!==1&&entry.workIds.every(id=>!excluded.has(id))&&state.history.length-Math.max(...entry.workIds.map(id=>last.get(id)??entry.index))-1>=8).sort((a,b)=>Math.max(...a.workIds.map(id=>last.get(id)??a.index))-Math.max(...b.workIds.map(id=>last.get(id)??b.index))||a.round.id.localeCompare(b.round.id))[0]||null;
}
function meta(round,fields){return {...round.evidence.finalRefinement,binding:'bound',...fields};}
function unavailable(round,reason,state){return {...structuredClone(round),unavailable:true,unavailableReason:reason,evidence:{...round.evidence,finalRefinement:meta(round,{binding:'unavailable',sourceRoundIds:state.overall.map(entry=>entry.round.id),reason})}};}
function finish(round,selected,state,fields={}){
  const selectedRatings=latestRatings(state.overall).filter(item=>selected.includes(item.workId)).map(item=>({...item}));
  const result={...structuredClone(round),works:selected.map(id=>state.byId.get(id)),workIds:[...selected],anchorIds:[],anchorWorks:[],evidence:{...round.evidence,finalRefinement:meta(round,{selectionRatings:selectedRatings,...fields}),limits:[...LIMITS]}};delete result.unavailable;delete result.unavailableReason;return result;
}
function earlierFavourites(state,answers){return [...state.history].reverse().find(source=>source.kind==='choice-grid'&&source.evidence?.explicitFavourites===true&&(()=>{try{return validAnswer(source,answers[source.id]);}catch{return false;}})());}
function selectFour(candidates,state,seed){
  const chosen=[];for(const item of candidates){if(chosen.includes(item.workId))continue;chosen.push(item.workId);if(chosen.length===4)break;}
  return chosen.sort((a,b)=>hash(seed+'|'+a)-hash(seed+'|'+b));
}
function savedReservation(state){const grid=state.history.find(source=>source.evidence?.explicitFavourites&&source.evidence?.finalRefinement?.repeatReservation);return grid?.evidence.finalRefinement.repeatReservation||null;}

/** Pure: callers supply actual earlier shown definitions, then freeze on entry. */
export function bindFinalRefinementRound({round,works=[],rounds=[],answers={},seed}={}){
  if(!isFinalRefinementRound(round))return round;
  if(round.evidence.finalRefinement.binding==='bound')return structuredClone(round);
  const state=historyFor(round,works,rounds,answers),slot=round.evidence.finalRefinement.slot,salt=String(seed??round.evidence.finalRefinement.seed),rated=latestRatings(state.overall).sort((a,b)=>b.value-a.value||hash(salt+'|candidate|'+a.workId)-hash(salt+'|candidate|'+b.workId)),ratedById=new Map(rated.map(item=>[item.workId,item]));
  if(slot===1){
    if(state.overall.length<3||rated.length<8)return unavailable(round,'Complete at least three earlier appeal questions before selecting favourites.',state);
    const candidates=rated,protectedIds=new Set(candidates.slice(0,18).map(item=>item.workId)),repeat=delayedSource(state,answers,protectedIds),reservation=repeat?{sourceRoundId:repeat.round.id,workIds:[...repeat.workIds],measurementScope:repeat.scope,minimumGap:8}:null;
    const result=finish(round,candidates.map(item=>item.workId),state,{role:'favourites',candidateSourceRoundIds:unique(candidates.map(item=>item.roundId)),candidateRatings:candidates.map(item=>({...item})),candidateSelection:'All paintings with earlier confirmed overall appeal; highest recorded appeal first, latest response per painting without averaging.',candidateScope:'all-earlier-rated-overall-appeal',pageSize:18,repeatReservation:reservation,repeatFallbackReason:reservation?null:'No delayed source avoids the first page. All favourites remain available; the final question may use a new comparison instead.'});
    result.maxChoices=5;result.evidence.explicitFavourites=true;result.evidence.instrumentRevision='paged-favourites-v1';return result;
  }
  if(rated.length<4)return unavailable(round,'Four paintings with earlier confirmed overall appeal are needed for this comparison.',state);
  const reservation=savedReservation(state),recent=unique(state.history.slice(-8).flatMap(source=>exposure(source,answers).presented)),reservationWasExposed=reservation?.workIds.some(id=>recent.includes(id)),reserved=new Set(reservationWasExposed?[]:reservation?.workIds||[]),available=rated.filter(item=>!reserved.has(item.workId)),favourites=earlierFavourites(state,answers),selectedIds=favourites?answers[favourites.id].selectedIds:[],preferred=[...selectedIds.map(id=>ratedById.get(id)).filter(Boolean),...available],sourceRoundIds=unique(state.overall.map(entry=>entry.round.id));
  if(slot===5){
    const reservedSource=reservation&&state.preferences.find(entry=>entry.round.id===reservation.sourceRoundId&&sig(entry.workIds)===sig(reservation.workIds)),validDelay=delayedSource({...state,preferences:reservedSource?[reservedSource]:state.preferences},answers),source=validDelay;
    if(source){
      const result=finish(round,[...source.workIds].reverse(),state,{role:'spaced-return',sourceRoundIds:[source.round.id],repeatOf:source.round.id,measurementScope:source.scope,minimumGap:8,delayBasis:'Actual intervening shown questions since the latest captured exposure of any source painting.'});
      result.title=source.round.title;result.hint=source.round.hint;result.scale=structuredClone(source.round.scale);result.evidence={...result.evidence,role:'repeat',repeatOf:source.round.id,exactRepeat:true,sourceRoundId:source.round.id,presentationOrder:'reversed-from-source',sourcePrompt:{title:source.round.title,hint:source.round.hint,criterion:source.round.criterion,scale:structuredClone(source.round.scale)}};
      delete result.evidence.appealProtocol;delete result.evidence.measurementScope;if(isOverallAppealRound(source.round)){result.evidence.appealProtocol=source.round.evidence.appealProtocol;result.evidence.measurementScope=source.round.evidence.measurementScope;}return result;
    }
    const recentIds=new Set(state.history.slice(-3).flatMap(source=>exposure(source,answers).presented)),spaced=available.filter(item=>!recentIds.has(item.workId)),pool=spaced.length>=4?spaced:available,chosen=selectFour(pool,state,salt+'|closing'),earlierSets=new Set(state.overall.map(entry=>sig(entry.workIds)));
    if(earlierSets.has(sig(chosen))){const replacement=pool.find(item=>!chosen.includes(item.workId)&&!earlierSets.has(sig([...chosen.slice(0,3),item.workId])));if(replacement)chosen[3]=replacement.workId;}
    return chosen.length===4&&!earlierSets.has(sig(chosen))?finish(round,chosen,state,{role:'closing-comparison',sourceRoundIds:unique(chosen.map(id=>ratedById.get(id).roundId)),comparisonSetNovelty:'different-from-earlier-exact-sets',repeatFallbackReason:'No unchanged source retained eight intervening captured questions. This uses a different quartet, not an exact repeat.'}):unavailable(round,'No safely delayed repeat or genuinely different closing quartet is available.',state);
  }
  if(slot===2){const chosen=selectFour(preferred.filter(item=>!reserved.has(item.workId)||selectedIds.includes(item.workId)),state,salt+'|cross-set');return chosen.length===4?finish(round,chosen,state,{role:'cross-set',sourceRoundIds:unique(chosen.map(id=>ratedById.get(id).roundId)),favouritesRoundId:favourites?.id||null,explicitFavouriteIds:chosen.filter(id=>selectedIds.includes(id)),explicitNoFavourites:!!favourites&&!selectedIds.length}):unavailable(round,'Four available paintings are needed for the cross-set comparison.',state);}
  const hypotheses=summarizePreferenceHypotheses({works,rounds:state.history,answers,measurementScope:APPEAL_PROTOCOL}),primary=hypotheses[0],rival=hypotheses.find(item=>item.feature!==primary?.feature),seenPairs=new Set(),unknown=new Set();
  for(const source of state.history){const observed=exposure(source,answers);for(const group of observed.groups)for(const [a,b] of pairs(unique(group)))seenPairs.add(pairKey(a,b));observed.unknown.forEach(id=>unknown.add(id));}
  const lastImages=new Set(state.history.length?exposure(state.history.at(-1),answers).presented:[]),notJustShown=available.filter(item=>!lastImages.has(item.workId)),comparisonPool=notJustShown.length>=4?notJustShown:available;
  const proposals=primary?pairs(comparisonPool).flatMap(([a,b])=>{
    const wa=state.byId.get(a.workId),wb=state.byId.get(b.workId);if(!isReviewedVisualDescriptor(wa,primary.feature)||!isReviewedVisualDescriptor(wb,primary.feature))return [];
    const difference=(wa.features[primary.feature]-wb.features[primary.feature])*primary.direction;if(Math.abs(difference)<.25)return [];
    const other=rival&&isReviewedVisualDescriptor(wa,rival.feature)&&isReviewedVisualDescriptor(wb,rival.feature)?(wa.features[rival.feature]-wb.features[rival.feature])*rival.direction:null,disagree=other!==null&&Math.abs(other)>=.25&&difference*other<0,novel=!seenPairs.has(pairKey(a.workId,b.workId))&&!unknown.has(a.workId)&&!unknown.has(b.workId),counter=(a.value-b.value)*difference<0;
    return [{workIds:[a.workId,b.workId],prediction:difference>0?a.workId:b.workId,rivalPrediction:disagree?(other>0?a.workId:b.workId):null,comparisonNovel:novel,score:(novel?6:0)+(slot===3&&disagree?5:0)+(slot===4&&counter?4:0)+Math.abs(difference)*2-Math.abs(a.value-b.value)/100}];
  }).sort((a,b)=>b.score-a.score||hash(salt+'|'+sig(a.workIds))-hash(salt+'|'+sig(b.workIds))):[];
  const chosen=[],checks=[];for(const proposal of proposals){if(proposal.workIds.some(id=>chosen.includes(id)))continue;chosen.push(...proposal.workIds);checks.push(proposal);if(chosen.length===4)break;}
  for(const item of comparisonPool){if(chosen.length===4)break;if(!chosen.includes(item.workId))chosen.push(item.workId);}
  if(chosen.length<4)return unavailable(round,'Four available paintings are needed for this refinement.',state);
  return finish(round,chosen,state,{role:slot===3?(checks.some(check=>check.rivalPrediction)?'rival-check':'feature-check'):'exception-check',sourceRoundIds,hypothesisStatus:primary?'provisional':'insufficient-earlier-directional-evidence',hypotheses:primary?[structuredClone(primary),...(rival?[structuredClone(rival)]:[])]:[],checks:checks.map(({score,...check})=>({...check,holdoutUnit:check.comparisonNovel?'new-comparison':null,artworksMayBeFamiliar:true})),selectionReason:primary?'Compare earlier-rated works in new company, including competing descriptor directions or an earlier exception when available.':'Compare earlier-rated works across sets without inventing a directional hypothesis.'});
}
