const unique=values=>[...new Set(values.filter(Boolean))];
const evidenceIds=items=>unique((items||[]).flatMap(item=>item.workIds||[]));
const winners=items=>unique((items||[]).map(item=>item.workIds?.[0]));
const tokens=pattern=>new Set((pattern.recurringSupport?.length?pattern.recurringSupport:pattern.support||[]).map(item=>JSON.stringify([item.roundId,[...(item.workIds||[])].sort()])));
const overlap=(a,b)=>{const left=tokens(a),right=tokens(b);return left.size&&right.size?[...left].filter(key=>right.has(key)).length/Math.min(left.size,right.size):0;};

/** Editorial evidence ordering, never a confidence estimate. Each task remains
 * one source. Shared favourite features and comparative distinctions differ. */
export function rankExplanationPatterns(patterns=[],{favouriteIds=[],ratings=[]}={}){
  const favourites=new Set(favouriteIds),levels=new Map(ratings.filter(item=>item.positive===true&&Number.isFinite(item.score)).map(item=>[item.workId||item.work?.id,item.score]));
  const ranked=patterns.map(original=>{
    const item={...original},baseline=item.exposureBaseline||{},favourite=item.channel==='explicit-favourites';
    const selectedKnown=baseline.selectedKnown||item.knownWorkCount||0,total=baseline.ratedKnown||baseline.presentedPoolKnown||0,withQuality=baseline.ratedKnown?baseline.ratedWithQuality:baseline.presentedPoolWithQuality;
    const enrichment=favourite&&selectedKnown&&total?(baseline.selectedWithQuality??item.supportingWorkCount??0)/selectedKnown-(withQuality||0)/total:null;
    const supporting=item.supportingSetCount||0,opposing=item.opposingSetCount||0,mixed=item.mixedSetCount||0,eligible=item.eligibleSetCount||supporting+opposing+mixed;
    const explicitCounters=unique(item.explicitDislikesWithQuality||[]),counterIds=unique([...explicitCounters,...(item.lowerRatedWithQuality||[]),...(item.ratingAssociation?.lowerRatedFavouredWorkIds||[]),...winners(item.counter)]);
    const sourceSupport=item.recurringSupport?.length?item.recurringSupport:item.support||[],supportIds=unique(item.favouriteWorkIds?.length?item.favouriteWorkIds:winners(sourceSupport));
    const supportingExamples=[...supportIds];
    // The existing source-specific qualification gates remain authoritative.
    // Enrichment alone has no independent comparison-set evidence.
    const discriminating=item.status==='qualified'&&supporting>=3&&eligible>=3;
    const balance=eligible?(supporting-opposing)/eligible:0;
    const strength=(item.support||[]).filter(row=>Number.isFinite(row.responseGap)).reduce((best,row)=>Math.max(best,Math.abs(row.responseGap)),0)/100;
    const score=(discriminating?50:0)+(item.status==='descriptive-association'?20:0)+(favourite?12+Math.max(0,enrichment||0)*20:0)+balance*12+Math.min(supporting,8)+strength*3-Math.min(counterIds.length,6)*2;
    const sortedSupport=supportIds.filter(id=>!counterIds.includes(id)).sort((a,b)=>Number(favourites.has(b))-Number(favourites.has(a))+(levels.get(b)||0)/100-(levels.get(a)||0)/100);
    const exception=explicitCounters[0]||counterIds.find(id=>!sortedSupport.slice(0,2).includes(id));
    item.explanationEvidence={kind:discriminating?'comparative':favourite?'shared-favourites':'association',score,enrichment,distinctSupportingSets:supporting,opposingSets:opposing,mixedSets:mixed,eligibleSets:eligible,explicitCounterWorkIds:explicitCounters,counterWorkIds:counterIds,supportingWorkIds:supportingExamples,selectionRule:'Comparative support, observed separation and exceptions; not statistical confidence.'};
    const foil=!favourite?sourceSupport.find(row=>row.workIds?.[0]===sortedSupport[0]&&row.workIds.length===2)?.workIds[1]:null;
    item.displayWorkIds=unique([sortedSupport[0],foil||sortedSupport[1],exception]);
    item.displayRoles=Object.fromEntries(item.displayWorkIds.map(id=>[id,explicitCounters.includes(id)?'explicit-dislike':counterIds.includes(id)?'counterexample':id===foil?'comparison':favourites.has(id)?'favourite':'support']));
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
    if(!item.summaryEligible||item.direction!==1||!['qualified','descriptive','descriptive-association'].includes(item.status))continue;
    if(selected.some(other=>item.attributes?.every(key=>other.attributes?.includes(key))||overlap(item,other)>=.8))continue;
    selected.push(item);if(selected.length===limit)break;
  }
  return selected;
}
