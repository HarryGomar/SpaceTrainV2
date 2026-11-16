import {CONTINUOUS_PROTOCOL,isContinuousPreferenceRound} from './continuous-preference.mjs';

export const CONTINUOUS_PROFILE_RULES=Object.freeze({maximumPairGap:75,minimumMeanDirectionalGap:5,clusterSpan:10,largeAdjacentGap:30});
const unique=values=>[...new Set(values)],short=work=>work.shortTitle||work.title;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;

/** A comparison group has bounded leverage. Pairs are dependent observations,
 * and are averaged over every eligible contrast, including exact ties. */
export function continuousGroupBalance(round,pairs,opportunities){
  if(!isContinuousPreferenceRound(round))return null;
  const denominator=Math.max(1,opportunities),weight=pair=>Math.min(pair.responseGap,CONTINUOUS_PROFILE_RULES.maximumPairGap)/100;
  const positiveWeight=pairs.filter(pair=>pair.vote>0).reduce((sum,pair)=>sum+weight(pair),0)/denominator,negativeWeight=pairs.filter(pair=>pair.vote<0).reduce((sum,pair)=>sum+weight(pair),0)/denominator,contribution=positiveWeight-negativeWeight;
  const minimum=CONTINUOUS_PROFILE_RULES.minimumMeanDirectionalGap/100,status=contribution>=minimum&&positiveWeight>=2*negativeWeight?'positive':contribution<=-minimum&&negativeWeight>=2*positiveWeight?'negative':'mixed';
  return {positiveWeight,negativeWeight,contribution,status,weightBasis:'capped-appeal-gap-one-contribution-per-group',maximumContribution:CONTINUOUS_PROFILE_RULES.maximumPairGap/100,meanDirectionalGap:contribution*100,weakContrast:Math.abs(contribution)<minimum};
}

/** Direct descriptions of levels and spacing, kept outside inferred qualities. */
export function buildContinuousResponseProfile(scope={sets:[],checks:[]}){
  const sets=(scope.sets||[]).filter(set=>isContinuousPreferenceRound(set.entry.round)).map(set=>{
    const items=set.items.map(item=>({workId:item.work.id,value:item.value,work:item.work})),ordered=[...items].sort((a,b)=>a.value-b.value),values=items.map(item=>item.value),clusters=[];
    for(const item of ordered){const group=clusters.at(-1);if(group&&item.value-group[0].value<=CONTINUOUS_PROFILE_RULES.clusterSpan)group.push(item);else clusters.push([item]);}
    const adjacentGaps=ordered.slice(1).map((item,index)=>({workIds:[ordered[index].workId,item.workId],gap:item.value-ordered[index].value})),largestGap=[...adjacentGaps].sort((a,b)=>b.gap-a.gap)[0]||null;
    return {roundId:set.entry.round.id,title:set.entry.round.title,workIds:items.map(item=>item.workId),points:items.map(({workId,value})=>({workId,value})),minimum:Math.min(...values),maximum:Math.max(...values),mean:mean(values),spread:Math.max(...values)-Math.min(...values),aboveNeutral:items.filter(item=>item.value>50).map(item=>item.workId),belowNeutral:items.filter(item=>item.value<50).map(item=>item.workId),neutral:items.filter(item=>item.value===50).map(item=>item.workId),clusters:clusters.filter(group=>group.length>=2).map(group=>({workIds:group.map(item=>item.workId),minimum:group[0].value,maximum:group.at(-1).value,span:group.at(-1).value-group[0].value})),adjacentGaps,largestGap,items,entry:set.entry};
  });
  const observations=[],described=new Set();
  const add=(set,key,title,text,workIds)=>{
    if(described.has(key)||observations.length>=3)return;described.add(key);
    const source={roundId:set.roundId,label:'Personal appeal',detail:`${set.items.map(item=>short(item.work)+': '+item.value).join('; ')}.`,workIds:[...set.workIds],sourceRole:'discovery',construct:'preference'};
    observations.push({id:'continuous-spacing-'+key,module:'response-spacing',kind:'taste',title,text,priority:8,status:'direct-response-description',summaryEligible:false,measurementScope:CONTINUOUS_PROTOCOL,sourceRoundIds:[set.roundId],support:[source],counter:[],evidence:[...set.workIds],displayWorkIds:workIds,comparisons:[{workIds,preferenceRoundId:set.roundId,measures:[{key:'preference',label:'Personal appeal',roundId:set.roundId,values:workIds.map(id=>set.points.find(item=>item.workId===id).value)}]}],alternatives:['This describes the positions you recorded in this group. It does not identify a psychological trait or explain what caused the response.','The same paintings and repeated comparisons remain dependent evidence. Position differences are personal scale differences, not probabilities or population scores.']});
  };
  for(const set of [...sets].sort((a,b)=>a.spread-b.spread)){
    const ordered=[...set.items].sort((a,b)=>a.value-b.value),display=[ordered.at(-1)?.workId,ordered[0]?.workId].filter((id,index,all)=>id&&all.indexOf(id)===index);
    if(set.workIds.length>=3&&set.spread<=CONTINUOUS_PROFILE_RULES.clusterSpan&&set.aboveNeutral.length===set.workIds.length)add(set,'liked-cluster','Close in appeal, all above neutral.',`Every painting in this group sat above neutral, between ${set.minimum} and ${set.maximum}. Their close positions record similar appeal, including the lower of the two shown.`,display);
    if(set.workIds.length>=3&&set.spread<=CONTINUOUS_PROFILE_RULES.clusterSpan&&set.belowNeutral.length===set.workIds.length)add(set,'disliked-cluster','Close in appeal, all below neutral.',`Every painting in this group sat below neutral, between ${set.minimum} and ${set.maximum}. The highest placement still records low appeal.`,display);
  }
  for(const set of [...sets].sort((a,b)=>(b.largestGap?.gap||0)-(a.largestGap?.gap||0)))if(set.largestGap?.gap>=CONTINUOUS_PROFILE_RULES.largeAdjacentGap)add(set,'separation','A clear separation in this group.',`${set.largestGap.gap} points separated two neighbouring placements. That gap distinguishes a wider difference in appeal from a close ordering.`,[...set.largestGap.workIds].reverse());
  const items=[...new Map(sets.flatMap(set=>set.items).map(item=>[item.workId,item])).values()];
  return {protocol:CONTINUOUS_PROTOCOL,sets:sets.map(({items,entry,...set})=>set),coverage:{distinctDiscoverySets:sets.length,distinctWorks:items.length,aboveNeutral:items.filter(item=>item.value>50).length,belowNeutral:items.filter(item=>item.value<50).length,neutral:items.filter(item=>item.value===50).length,dependentChecks:(scope.checks||[]).filter(set=>isContinuousPreferenceRound(set.entry.round)).length},observations,rules:{...CONTINUOUS_PROFILE_RULES},limits:['The midpoint is the question’s neutral anchor. These are personal reports, not ratings relative to other people.','Panel means and ranges describe the answered groups and may reflect the paintings offered. They are not stable personality traits.']};
}
