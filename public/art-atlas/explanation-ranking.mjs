const unique=values=>[...new Set(values.filter(Boolean))];
const evidenceIds=items=>unique((items||[]).flatMap(item=>item.workIds||[]));
const winners=items=>unique((items||[]).map(item=>item.workIds?.[0]));
const tokens=pattern=>new Set((pattern.recurringSupport?.length?pattern.recurringSupport:pattern.support||[]).map(item=>JSON.stringify([item.roundId,[...(item.workIds||[])].sort()])));
const overlap=(a,b)=>{const left=tokens(a),right=tokens(b);return left.size&&right.size?[...left].filter(key=>right.has(key)).length/Math.min(left.size,right.size):0;};

export function canDescribeOverallTaste(pattern){
  if(pattern.channel==='admiration-of-making'||pattern.overallEligible===false)return false;
  return pattern.summaryEligible===true&&pattern.direction!==-1&&['qualified','descriptive','descriptive-association'].includes(pattern.status);
}

/** Editorial evidence ordering, never a confidence estimate. Each task remains
 * one source. Shared favourite features and comparative distinctions differ. */
export function rankExplanationPatterns(patterns=[],{favouriteIds=[],dislikeIds=[],ratings=[]}={}){
  const favourites=new Set(favouriteIds),levels=new Map(ratings.filter(item=>item.positive===true&&Number.isFinite(item.score)).map(item=>[item.workId||item.work?.id,item.score]));
  const ranked=patterns.map(original=>{
    const item={...original},baseline=item.exposureBaseline||{},favourite=item.channel==='explicit-favourites';
    const selectedKnown=baseline.selectedKnown||item.knownWorkCount||0,total=baseline.ratedKnown||baseline.presentedPoolKnown||0,withQuality=baseline.ratedKnown?baseline.ratedWithQuality:baseline.presentedPoolWithQuality;
    const enrichment=favourite&&selectedKnown&&total?(baseline.selectedWithQuality??item.supportingWorkCount??0)/selectedKnown-(withQuality||0)/total:null;
    const supporting=item.supportingSetCount||0,opposing=item.opposingSetCount||0,mixed=item.mixedSetCount||0,eligible=item.eligibleSetCount||supporting+opposing+mixed;
    const explicitCounters=unique(item.explicitDislikesWithQuality||[]),lowSameQuality=unique([...(item.lowerRatedWithQuality||[]),...(item.ratingAssociation?.lowerRatedFavouredWorkIds||[])]),counterIds=unique([...explicitCounters,...lowSameQuality,...winners(item.counter)]);
    const sourceSupport=item.recurringSupport?.length?item.recurringSupport:item.support||[],supportIds=unique(item.favouriteWorkIds?.length?item.favouriteWorkIds:winners(sourceSupport));
    const supportingExamples=[...supportIds];
    const presence=item.recordQuality||{},present=new Set(presence.presentWorkIds||[]),absent=new Set(presence.absentWorkIds||[]);
    const matchingFavourites=favouriteIds.filter(id=>present.has(id)),otherFavourites=favouriteIds.filter(id=>absent.has(id)),matchingDislikes=dislikeIds.filter(id=>present.has(id));
    const knownFavourites=matchingFavourites.length+otherFavourites.length;
    const broader=item.favouriteRatingContext||item.globalAssociation||item.ratingAssociation,broadAgrees=broader?.summaryEligible===true&&broader.direction===item.direction;
    const recordFit={favouritesWithQuality:matchingFavourites,favouritesWithoutQuality:otherFavourites,unknownFavourites:favouriteIds.filter(id=>!present.has(id)&&!absent.has(id)),explicitDislikesWithQuality:matchingDislikes,explicitDislikesWithoutQuality:dislikeIds.filter(id=>absent.has(id)),ratedWithQuality:ratings.filter(row=>present.has(row.workId||row.work?.id)).length,ratedWithoutQuality:ratings.filter(row=>absent.has(row.workId||row.work?.id)).length,positiveWithQuality:ratings.filter(row=>row.positive===true&&present.has(row.workId||row.work?.id)).length,negativeWithQuality:ratings.filter(row=>row.negative===true&&present.has(row.workId||row.work?.id)).length,broadAppealDifference:broader?.difference??null,broadAssociationEligible:broadAgrees||item.status==='descriptive-association'&&item.summaryEligible===true,broadAssociationOpposed:broader?.summaryEligible===true&&broader.direction===-item.direction,favouriteSpecific:favourite&&!!item.favouriteRatingContext&&!broadAgrees};
    const favouriteAgreement=matchingFavourites.length>=3&&matchingFavourites.length>=knownFavourites*.5;
    item.localPatternEligible=item.summaryEligible===true;
    const knownDislikes=dislikeIds.filter(id=>present.has(id)||absent.has(id)).length,distinguishesDislikes=knownDislikes<3||knownFavourites<3||matchingFavourites.length/knownFavourites-matchingDislikes.length/knownDislikes>=.15;
    item.overallEligible=(!favourite||distinguishesDislikes)&&item.channel!=='admiration-of-making'&&item.summaryEligible===true&&(favourite||item.status==='descriptive-association'||!item.recordQuality||knownFavourites<3||favouriteAgreement||broader?.summaryEligible===true&&broader.direction===item.direction);
    if(knownFavourites>=3&&matchingFavourites.length===0)item.overallEligible=false;
    item.recordFit=recordFit;
    // The existing source-specific qualification gates remain authoritative.
    // Enrichment alone has no independent comparison-set evidence.
    const discriminating=item.status==='qualified'&&supporting>=3&&eligible>=3;
    const balance=eligible?(supporting-opposing)/eligible:0;
    const strength=(item.support||[]).filter(row=>Number.isFinite(row.responseGap)).reduce((best,row)=>Math.max(best,Math.abs(row.responseGap)),0)/100;
    const score=(discriminating?50:0)+(item.status==='descriptive-association'&&item.summaryEligible?20:0)+(favourite?12+Math.max(0,enrichment||0)*20:0)+balance*12+Math.min(supporting,8)+strength*3-Math.min(counterIds.length,6)*2+(favouriteAgreement?6:0)+(recordFit.broadAssociationEligible&&favouriteAgreement?8:0);
    const sortedSupport=supportIds.filter(id=>!explicitCounters.includes(id)).sort((a,b)=>Number(favourites.has(b))-Number(favourites.has(a))+(levels.get(b)||0)/100-(levels.get(a)||0)/100);
    const exception=explicitCounters[0]||counterIds.find(id=>!sortedSupport.slice(0,2).includes(id));
    item.explanationEvidence={kind:discriminating?'comparative':favourite?'shared-favourites':'association',score,enrichment,distinctSupportingSets:supporting,opposingSets:opposing,mixedSets:mixed,eligibleSets:eligible,explicitCounterWorkIds:explicitCounters,counterWorkIds:counterIds,supportingWorkIds:supportingExamples,selectionRule:'Comparative support, observed separation and exceptions; not statistical confidence.'};
    const foil=!favourite?sourceSupport.find(row=>row.workIds?.[0]===sortedSupport[0]&&row.workIds.length===2)?.workIds[1]:null;
    item.displayWorkIds=unique([sortedSupport[0],foil||sortedSupport[1],exception]);
    item.displayRoles=Object.fromEntries(item.displayWorkIds.map(id=>[id,id===sortedSupport[0]?favourites.has(id)?'favourite':'support':explicitCounters.includes(id)?'explicit-dislike':otherFavourites.includes(id)?'favourite-exception':lowSameQuality.includes(id)?'counter':counterIds.includes(id)?'counterexample':id===foil?'comparison':favourites.has(id)?'favourite':'support']));
    return item;
  });
  for(const item of ranked){
    const rivals=ranked.filter(other=>other!==item&&other.channel===item.channel&&other.qualityKey!==item.qualityKey&&other.direction===item.direction&&other.summaryEligible&&overlap(item,other)>=.8).sort((a,b)=>b.explanationEvidence.score-a.explanationEvidence.score).slice(0,3);
    item.competingExplanations=rivals.map(other=>({id:other.id,qualityKey:other.qualityKey,title:other.title,sharedEvidence:true}));
    item.explanationEvidence.unresolvedRivals=rivals.length;
  }
  return ranked.sort((a,b)=>b.explanationEvidence.score-a.explanationEvidence.score||Number(b.summaryEligible)-Number(a.summaryEligible)||a.id.localeCompare(b.id));
}

export function selectPrincipalExplanations(patterns=[],limit=3){
  const selected=[];
  for(const item of patterns){
    if(!canDescribeOverallTaste(item)||item.direction!==1)continue;
    if(selected.some(other=>item.attributes?.every(key=>other.attributes?.includes(key))||overlap(item,other)>=.8))continue;
    selected.push(item);if(selected.length===limit)break;
  }
  return selected;
}
