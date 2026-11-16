import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
import {resolveArtworkAttributes} from './taste-patterns.mjs';
import {collectTastePatternSources} from './taste-axes.mjs';
import {buildPreferenceBasis,profileEvidence,POSITIVE_APPEAL,LOW_APPEAL} from './profile-evidence.mjs';
import {APPEAL_PROTOCOL,isOverallAppealRound} from './appeal-scale.mjs';

export const TASTE_BOUNDARIES_VERSION='taste-boundaries-v1';
export const EXPLICIT_BOUNDARY_SCOPE='explicit-favourite-dislike-choices';
export const TASTE_BOUNDARY_THRESHOLDS=Object.freeze({high:POSITIVE_APPEAL,low:LOW_APPEAL,minimumHighWorks:3,minimumLowWorks:3,minimumArtistsPerSide:3,minimumDiscoverySets:3,minimumSetsPerSide:2,minimumSameSetContrasts:2,minimumBandSeparation:.5,dominanceRatio:2});

// A fixed, finite editorial list developed during prototyping, not a
// preregistered experiment. Every rule compares a quality inside a shared one.
export const TASTE_BOUNDARY_RULES=Object.freeze([
  ['story-space','narrative-detail','layered-space','Stories organised through space','Story clues beyond spatial layers'],
  ['pattern-relationships','pattern-rhythm','human-relationships','Pattern with an encounter','Pattern beyond human exchanges'],
  ['precision-relationships','precise-rendering','human-relationships','Detail with an encounter','Detail beyond human exchanges'],
  ['pattern-space','pattern-rhythm','layered-space','Pattern with depth','Pattern beyond spatial layers'],
  ['precision-light','precise-rendering','dramatic-light','Detail shaped by light','Detail beyond dramatic lighting'],
  ['story-light','narrative-detail','dramatic-light','Stories shaped by light','Story clues beyond dramatic lighting'],
  ['space-relationships','layered-space','human-relationships','Spaces with an encounter','Spatial layers beyond human exchanges'],
  ['figures-light','intimate-figures','dramatic-light','Figures shaped by light','Close figures beyond dramatic lighting'],
  ['figures-gesture','intimate-figures','visible-gesture','Figures in action','Close figures beyond bodily action'],
  ['gesture-staging','visible-gesture','theatrical-staging','Action in a staged scene','Action beyond theatrical staging'],
  ['landscape-imagination','landscape','imagined-world','Unusual worlds in natural settings','Natural settings beyond fantasy'],
  ['landscape-expanse','landscape','open-expanse','Room within the landscape','Natural settings beyond open expanses'],
  ['geometry-story','geometric-structure','narrative-detail','Structure with story clues','Geometry beyond story clues'],
  ['imagination-space','imagined-world','layered-space','Imagined worlds with depth','Fantasy beyond spatial layers'],
  ['marks-distortion','visible-paint-marks','expressive-distortion','Marks that alter familiar forms','Paint marks beyond distorted forms'],
  ['precision-material','precise-rendering','material-detail','Detail in material surfaces','Precise edges beyond material detail']
].map(([id,shared,contrast,title,absentTitle])=>Object.freeze({id,shared,contrast,title,absentTitle})));

export const TASTE_BOUNDARY_LIMITS=Object.freeze([
  'These are exploratory contrasts among the paintings you rated, not psychological traits or explanations of what caused your choices.',
  'The shared quality is held in common descriptively. Subject, colour, artist, reproduction and other qualities still differ; this is not a controlled experiment.',
  'Three high and three low works, artist variety and several discovery sets are minimum reporting rules, not significance tests or confidence estimates.',
  'Only the recorded overall-liking scale supplies high and low ratings here. Favourites are positive and unranked; leaving a painting unselected never means dislike.',
  'Repeated or later ratings do not add independent artworks. Revised rating bands and favourites that contradict an earlier low score are kept outside the clean comparison.',
  'The sixteen conditional questions are fixed in this implementation. They were developed during prototyping, not preregistered. A finding selected from them is exploratory and needs a new comparison to test it.'
]);
const unique=values=>[...new Set(values)],normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),short=work=>work.shortTitle||work.title;
const artist=work=>{
  const text=typeof work?.artist==='string'?work.artist.trim():'';
  if(work.artistKnown===false||!text||/unknown|unidentified|anonymous|workshop|studio|circle|follower|imitator|attributed|tradition|possibly|school|;|\s&\s|\sand\s/i.test(text))return null;
  return normal(text.replace(/\([^)]*\)/g,''));
};
const band=value=>value>=POSITIVE_APPEAL?'high':value<=LOW_APPEAL?'low':'middle';
const pairKey=(a,b)=>JSON.stringify([a,b].sort());
const label=key=>ARTWORK_ATTRIBUTE_DEFINITIONS[key].label.toLowerCase();
function evidence(item,detail,labelText){return {...profileEvidence(item.entry,[item.work.id],detail,labelText),score:item.value,annotationBasis:item.review?.annotationBasis};}
function row(item){return {workId:item.work.id,roundId:item.entry.round.id,discoverySet:item.setKey,value:item.value,band:item.band,artist:artist(item.work),latestRoundId:item.latest?.entry.round.id||item.entry.round.id,latestValue:item.latest?.score??item.value,explicitFavourite:item.favourite,annotationBasis:item.review?.annotationBasis};}
function sameIdentity(a,b){return ['id','sourceUrl','image'].every(key=>a?.[key]===b?.[key])&&(!a.sha256||!b.sha256||a.sha256===b.sha256);}

function collect({works,rounds,answers,annotationReviews,currentWorks}){
  const sources=collectTastePatternSources({works,rounds,answers}),scope=sources.preferenceScopes.find(s=>s.key===APPEAL_PROTOCOL),allEntries=sources.entries.filter(entry=>isOverallAppealRound(entry.round)&&entry.round.evidence?.stimulusVisibility!=='not-shown'),basis=buildPreferenceBasis(allEntries.concat(sources.entries.filter(entry=>entry.round.kind==='choice-grid'))),latest=new Map(basis.ratings.map(item=>[item.work.id,item])),favourites=new Set(basis.favourites.map(item=>item.work.id)),items=[];
  const seen=new Set(),sets=[];
  for(const set of scope?.sets||[]){
    if(set.entry.round.evidence?.stimulusVisibility==='not-shown')continue;
    const fresh=[];
    for(const item of set.items){
      if(seen.has(item.work.id))continue;seen.add(item.work.id);
      const last=latest.get(item.work.id),initialBand=band(item.value),same=last&&sameIdentity(item.work,last.work),revised=!same||band(last.score)!==initialBand,favourite=favourites.has(item.work.id),favouriteConflict=initialBand==='low'&&favourite,review=resolveArtworkAttributes(item.work,{annotationReviews,currentWorks});
      const entry={...item,setKey:set.setKey,band:initialBand,latest:last,review,favourite,revised,favouriteConflict,stable:!revised&&!favouriteConflict};items.push(entry);fresh.push(entry);
    }
    if(fresh.length)sets.push({...set,items:fresh});
  }
  return {items,sets,sources,basis,scope,allEntries};
}
function selectPairs(pairs){
  // Evidence examples use distinct paintings and distinct original discovery
  // sets. All available pairs remain an audit, never independent sample counts.
  const bySet=new Map();for(const pair of pairs){const list=bySet.get(pair.setKey)||[];list.push(pair);bySet.set(pair.setKey,list);}
  const groups=[...bySet.values()].map(list=>list.sort((a,b)=>b.gap-a.gap));let result=[];
  function visit(index,chosen,used){if(chosen.length>=3){result=chosen;return;}if(index>=groups.length||result.length)return;for(const pair of groups[index]){if(used.has(pair.high.work.id)||used.has(pair.low.work.id))continue;visit(index+1,[...chosen,pair],new Set([...used,pair.high.work.id,pair.low.work.id]));if(result.length)return;}visit(index+1,chosen,used);}
  visit(0,[],new Set());
  if(!result.length)for(const list of groups){const available=list.find(pair=>!result.some(other=>[other.high.work.id,other.low.work.id].some(id=>id===pair.high.work.id||id===pair.low.work.id)));if(available)result.push(available);if(result.length===2)break;}
  return result;
}
function inspectRule(rule,model){
  const ledger=model.items.map(item=>{
    const gate=item.review?.attributes[rule.shared]?.status||'unknown',split=item.review?.attributes[rule.contrast]?.status||'unknown';return {...item,gate,split};
  }),shared=ledger.filter(item=>item.gate==='present'),known=shared.filter(item=>item.split!=='unknown'),stable=known.filter(item=>item.stable),high=stable.filter(item=>item.band==='high'),low=stable.filter(item=>item.band==='low'),hp=high.filter(item=>item.split==='present'),ha=high.filter(item=>item.split==='absent'),lp=low.filter(item=>item.split==='present'),la=low.filter(item=>item.split==='absent');
  const difference=high.length&&low.length?hp.length/high.length-lp.length/low.length:0,direction=Math.sign(difference),positive=direction<0?ha:hp,negative=direction<0?lp:la,highCounters=direction<0?hp:ha,lowCounters=direction<0?la:lp,sourceSets=unique([...high,...low].map(item=>item.setKey));
  const pairs=[];
  for(const h of positive)for(const l of negative)if(h.setKey===l.setKey&&h.entry.round.id===l.entry.round.id)pairs.push({high:h,low:l,setKey:h.setKey,roundId:h.entry.round.id,gap:h.value-l.value});
  const examples=selectPairs(pairs),highArtists=unique(positive.map(item=>artist(item.work)).filter(Boolean)),lowArtists=unique(negative.map(item=>artist(item.work)).filter(Boolean));
  const coverage={answeredWorks:model.items.length,sharedQualityWorks:shared.length,knownContrastWorks:known.length,unknownSharedQuality:ledger.filter(item=>item.gate==='unknown').length,unknownContrastWithinShared:shared.filter(item=>item.split==='unknown').length,highWithContrast:hp.length,highWithoutContrast:ha.length,lowWithContrast:lp.length,lowWithoutContrast:la.length,middleWorks:stable.filter(item=>item.band==='middle').length,revisedOrConflictedWorks:known.filter(item=>!item.stable).length,highArtists:highArtists.length,lowArtists:lowArtists.length,highDiscoverySets:unique(positive.map(item=>item.setKey)).length,lowDiscoverySets:unique(negative.map(item=>item.setKey)).length,distinctDiscoverySets:sourceSets.length,sameSetContrasts:examples.length,coPresentedPairOpportunities:pairs.length};
  const reasons=[];if(positive.length<3||negative.length<3)reasons.push('too-few-high-or-low-examples');if(highArtists.length<3||lowArtists.length<3)reasons.push('too-few-known-artists');if(sourceSets.length<3||coverage.highDiscoverySets<2||coverage.lowDiscoverySets<2)reasons.push('too-few-discovery-sets');if(examples.length<2)reasons.push('too-few-same-set-contrasts');if(!direction||Math.abs(difference)<.5||positive.length<2*highCounters.length||negative.length<2*lowCounters.length)reasons.push('contrasts-do-not-separate-both-bands');
  const audit={id:rule.id,sharedQuality:rule.shared,contrastQuality:rule.contrast,direction,qualified:reasons.length===0,reasons,coverage};if(reasons.length)return {audit,finding:null};
  const presentDirection=direction>0,first=examples[0],second=examples[1],positiveDescription=presentDirection?label(rule.contrast):'no emphasised '+label(rule.contrast),counterItems=[...highCounters,...lowCounters],revised=known.filter(item=>!item.stable),support=examples.map(pair=>({...profileEvidence(pair.high.entry,[pair.high.work.id,pair.low.work.id],`${short(pair.high.work)}: ${pair.high.value}; ${short(pair.low.work)}: ${pair.low.value}. Both have ${label(rule.shared)}; their reviewed ${label(rule.contrast)} differs.`, 'A contrast within the same question'),annotationBasis:[pair.high.review.annotationBasis,pair.low.review.annotationBasis]}));
  const counter=counterItems.map(item=>evidence(item,`${short(item.work)} received ${item.value}, ${item.band==='high'?'despite being on the lower-rated side of this contrast':'despite sharing the quality more common among the high-rated examples'}.`,'A counterexample')),responseRevisions=[],dependentCounterWorkIds=[];
  for(const item of revised){
    responseRevisions.push(evidence(item,item.favouriteConflict?`${short(item.work)} was initially low-rated (${item.value}) and also selected as a favourite. It is not used as a clean low example.`:`${short(item.work)} initially received ${item.value}; the latest comparable response is ${item.latest?.score??'unavailable'}. It is outside the stable high/low comparison.`,'A revised or conflicting response'));
    const expectedHigh=item.split===(presentDirection?'present':'absent'),latestOpposes=item.latest&&sameIdentity(item.work,item.latest.work)&&(band(item.latest.score)==='high'&&!expectedHigh||band(item.latest.score)==='low'&&expectedHigh);
    if(item.latest&&item.latest.entry.round.id!==item.entry.round.id){const later=profileEvidence(item.latest.entry,[item.work.id],`${short(item.work)}: ${item.latest.score} on the later overall-liking question. This is the same painting, not another independent example.`,'Later rating');responseRevisions.push(later);if(latestOpposes){counter.push({...later,label:'A later counterexample'});dependentCounterWorkIds.push(item.work.id);}}
    if(item.favouriteConflict){const favourite=model.basis.favourites.find(f=>f.work.id===item.work.id);if(favourite){const selected=favourite.support.filter(e=>e.construct==='overall-favourites');responseRevisions.push(...selected);if(!expectedHigh){counter.push(...selected);dependentCounterWorkIds.push(item.work.id);}}}
  }
  const workIds=unique([...positive,...negative].map(item=>item.work.id));
  const finding={id:'taste-boundary:'+rule.id+':'+direction,module:'taste-boundaries',kind:'pattern',title:presentDirection?rule.title:rule.absentTitle,text:`Within paintings sharing ${label(rule.shared)}, ${short(first.high.work)} and ${short(second.high.work)} were high-rated, while ${short(first.low.work)} and ${short(second.low.work)} were low. ${presentDirection?'The presence of ':'An explicitly reviewed absence of '}${label(rule.contrast)} separates most of these examples.`,priority:13,status:'exploratory-contrast',summaryEligible:true,exploratory:true,independentReplicationClaim:false,measurementScope:APPEAL_PROTOCOL,comparisonBasis:'shared-reviewed-quality:overall-appeal',sharedQuality:rule.shared,contrastQuality:rule.contrast,direction,positiveDescription,support,counter,alternatives:[...TASTE_BOUNDARY_LIMITS],evidence:workIds,workIds,displayWorkIds:[first.high.work.id,first.low.work.id],displayNotes:{[first.high.work.id]:'High overall liking',[first.low.work.id]:'Low overall liking'},sourceRoundIds:unique([...positive,...negative,...revised].flatMap(item=>[item.entry.round.id,...(item.latest?[item.latest.entry.round.id]:[])])),supportPairs:examples.map(pair=>({roundId:pair.roundId,highWorkId:pair.high.work.id,lowWorkId:pair.low.work.id,highValue:pair.high.value,lowValue:pair.low.value})),highWorkIds:positive.map(item=>item.work.id),lowWorkIds:negative.map(item=>item.work.id),counterWorkIds:counterItems.map(item=>item.work.id),coverage,high:positive.map(row),low:negative.map(row),counterExamples:counterItems.map(row),revisedExamples:revised.map(row),relatedRuleIds:[]};
  finding.sourceRoundIds=unique([...finding.sourceRoundIds,...support.map(item=>item.roundId),...counter.map(item=>item.roundId)]);
  finding.responseRevisions=responseRevisions;finding.dependentCounterWorkIds=unique(dependentCounterWorkIds);finding.sourceRoundIds=unique([...finding.sourceRoundIds,...responseRevisions.map(item=>item.roundId)]);
  return {audit,finding};
}
function nestedDuplicate(a,b){
  const contained=(left,right)=>left.every(id=>right.includes(id));
  return contained(a.highWorkIds,b.highWorkIds)&&contained(a.lowWorkIds,b.lowWorkIds)||contained(b.highWorkIds,a.highWorkIds)&&contained(b.lowWorkIds,a.lowWorkIds);
}

const explicitLimits=[
  'This compares explicit favourite and dislike declarations. No line position is converted to an absolute like, dislike or numerical rating.',
  'Clean contrasts use paintings actually presented in both anchor pools. Unvisited pages and works from different pools remain outside that comparison; unselected paintings are never dislikes.',
  'Three works and three known artists on each supporting side, with at least three original comparison sets overall, are minimum descriptive rules. Original sets describe stimulus variety, not independent replications of the later pooled selections.',
  'These sixteen fixed conditional rules are exploratory. Shared qualities, other subjects, artists, reproductions and prior exposure can explain the same distinction; no cause, population type or calibrated confidence is established.',
  'The declarations can come from different questions and times. The latest explicit opposite controls the current cohort; earlier declarations remain response history. None withdraws that declaration only, and Not sure changes nothing.',
  'Only source- and preview-bound visual reviews are used. A missing or uncertain review is unknown, rather than an absence of the quality.'
];
function collectExplicit(sources,{annotationReviews,currentWorks}){
  const basis=buildPreferenceBasis(sources.entries),favouritePool=new Set(basis.favouriteCandidates.map(item=>item.work.id)),dislikePool=new Set(basis.dislikeCandidates.map(item=>item.work.id)),commonPool=new Set([...favouritePool].filter(id=>dislikePool.has(id))),sets=sources.preferenceScopes.flatMap(scope=>scope.sets).filter(set=>set.entry.round.evidence?.stimulusVisibility!=='not-shown'),items=[];
  for(const [declaration,anchors]of [['favourite',basis.favourites],['dislike',basis.dislikes]])for(const anchor of anchors){
    const origin=sets.filter(set=>set.entry.index<anchor.entry.index&&set.items.some(item=>sameIdentity(item.work,anchor.work))).sort((a,b)=>a.entry.index-b.entry.index)[0],review=resolveArtworkAttributes(anchor.work,{annotationReviews,currentWorks});
    items.push({work:anchor.work,entry:anchor.entry,anchor,declaration,review,origin,setKey:origin?.setKey||null,inSharedPool:commonPool.has(anchor.work.id),eligible:!!origin&&commonPool.has(anchor.work.id)});
  }
  return {basis,items,sets,favouritePool,dislikePool,commonPool,poolSourceRoundIds:unique([...basis.favouriteCandidates,...basis.dislikeCandidates].map(item=>item.entry.round.id))};
}
function explicitRow(item){return {workId:item.work.id,roundId:item.entry.round.id,declaration:item.declaration,basis:item.declaration==='favourite'?'explicit-favourite':'explicit-dislike',artist:artist(item.work),comparisonRoundId:item.origin?.entry.round.id||null,discoverySet:item.setKey,annotationBasis:item.review?.annotationBasis};}
function explicitEvidence(item,detail){return {...profileEvidence(item.entry,[item.work.id],detail,item.declaration==='favourite'?'Your favourite':'Explicitly disliked'),basis:item.declaration==='favourite'?'explicit-favourite':'explicit-dislike',annotationBasis:item.review.annotationBasis};}
function explicitPairs(favourites,dislikes){
  const pairs=favourites.flatMap(high=>dislikes.map(low=>({high,low,coPresented:high.origin.entry.round.id===low.origin.entry.round.id}))).sort((a,b)=>Number(b.coPresented)-Number(a.coPresented)),chosen=[],favArtists=new Set(),disArtists=new Set();
  for(const pair of pairs){const a=artist(pair.high.work),b=artist(pair.low.work);if(!a||!b||favArtists.has(a)||disArtists.has(b))continue;chosen.push(pair);favArtists.add(a);disArtists.add(b);if(chosen.length===3)break;}
  return chosen;
}
function inspectExplicitRule(rule,model){
  const ledger=model.items.map(item=>({...item,gate:item.review?.attributes[rule.shared]?.status||'unknown',split:item.review?.attributes[rule.contrast]?.status||'unknown'})),eligible=ledger.filter(item=>item.eligible),shared=eligible.filter(item=>item.gate==='present'),known=shared.filter(item=>item.split!=='unknown'),favourites=known.filter(item=>item.declaration==='favourite'),dislikes=known.filter(item=>item.declaration==='dislike'),fp=favourites.filter(item=>item.split==='present'),fa=favourites.filter(item=>item.split==='absent'),dp=dislikes.filter(item=>item.split==='present'),da=dislikes.filter(item=>item.split==='absent'),difference=favourites.length&&dislikes.length?fp.length/favourites.length-dp.length/dislikes.length:0,direction=Math.sign(difference),positive=direction<0?fa:fp,negative=direction<0?dp:da,favouriteCounters=direction<0?fp:fa,dislikeCounters=direction<0?da:dp,examples=explicitPairs(positive,negative),favouriteArtists=unique(positive.map(item=>artist(item.work)).filter(Boolean)),dislikeArtists=unique(negative.map(item=>artist(item.work)).filter(Boolean)),sourceSets=unique([...favourites,...dislikes].map(item=>item.setKey));
  const coverage={currentFavourites:model.basis.favourites.length,currentDislikes:model.basis.dislikes.length,sharedPresentedPoolWorks:model.commonPool.size,eligibleAnchorWorks:eligible.length,sharedQualityWorks:shared.length,knownContrastWorks:known.length,unknownSharedQuality:eligible.filter(item=>item.gate==='unknown').length,unknownContrastWithinShared:shared.filter(item=>item.split==='unknown').length,favouritesWithContrast:fp.length,favouritesWithoutContrast:fa.length,dislikesWithContrast:dp.length,dislikesWithoutContrast:da.length,favouriteArtists:favouriteArtists.length,dislikeArtists:dislikeArtists.length,distinctDiscoverySets:sourceSets.length,favouriteDiscoverySets:unique(positive.map(item=>item.setKey)).length,dislikeDiscoverySets:unique(negative.map(item=>item.setKey)).length,distinctSupportingWorkPairs:examples.length,coPresentedExamples:examples.filter(pair=>pair.coPresented).length,favouriteCounterWorks:favouriteCounters.length,dislikeCounterWorks:dislikeCounters.length};
  const reasons=[];if(positive.length<3||negative.length<3)reasons.push('too-few-explicit-favourite-or-dislike-examples');if(favouriteArtists.length<3||dislikeArtists.length<3)reasons.push('too-few-known-artists');if(sourceSets.length<3||coverage.favouriteDiscoverySets<2||coverage.dislikeDiscoverySets<2)reasons.push('too-few-original-discovery-sets');if(examples.length<3)reasons.push('too-few-diverse-work-pairs');if(!direction||Math.abs(difference)<.5||positive.length<2*favouriteCounters.length||negative.length<2*dislikeCounters.length)reasons.push('declarations-do-not-separate-both-sides');
  const audit={id:rule.id,sharedQuality:rule.shared,contrastQuality:rule.contrast,direction,qualified:reasons.length===0,reasons,coverage};if(reasons.length)return {audit,finding:null};
  const first=examples[0],counterItems=[...favouriteCounters,...dislikeCounters],support=examples.flatMap(pair=>[explicitEvidence(pair.high,`${short(pair.high.work)} was explicitly selected as a favourite. Both examples share reviewed ${label(rule.shared)}.`),explicitEvidence(pair.low,`${short(pair.low.work)} was explicitly selected as disliked. The reviewed contrast is ${label(rule.contrast)}.`)]),counter=counterItems.map(item=>explicitEvidence(item,`${short(item.work)} was ${item.declaration==='favourite'?'a favourite despite being on the other reviewed side':'explicitly disliked despite carrying the side more common among the favourites'}.`)),responseRevisions=[];
  for(const item of [...positive,...negative,...counterItems])for(const earlier of item.anchor.counter||[])if(['overall-favourites','overall-dislikes'].includes(earlier.construct))responseRevisions.push({...earlier,sourceRole:'earlier declaration retained alongside the current choice'});
  const supportPairs=examples.map(pair=>({highWorkId:pair.high.work.id,lowWorkId:pair.low.work.id,highLabel:'Favourite',lowLabel:'Disliked',highBasis:'explicit-favourite',lowBasis:'explicit-dislike',favouriteRoundId:pair.high.entry.round.id,dislikeRoundId:pair.low.entry.round.id,comparisonRoundIds:unique([pair.high.origin.entry.round.id,pair.low.origin.entry.round.id]),coPresented:pair.coPresented})),workIds=unique([...positive,...negative].map(item=>item.work.id)),displayWorkIds=[first.high.work.id,first.low.work.id],sourceRoundIds=unique([...positive,...negative,...counterItems].flatMap(item=>[item.entry.round.id,item.origin.entry.round.id]).concat(responseRevisions.map(item=>item.roundId)));
  const finding={id:'taste-boundary:explicit:'+rule.id+':'+direction,module:'taste-boundaries',kind:'pattern',title:direction>0?rule.title:rule.absentTitle,text:`${short(first.high.work)} was a favourite and ${short(first.low.work)} was explicitly disliked. Both show ${label(rule.shared)}; ${direction>0?'the presence of ':'a reviewed absence of '}${label(rule.contrast)} distinguishes most of these declared examples.`,status:'explicit-choice-contrast',priority:14,summaryEligible:true,exploratory:true,independentReplicationClaim:false,measurementScope:EXPLICIT_BOUNDARY_SCOPE,comparisonBasis:'shared-reviewed-quality:explicit-favourite-vs-dislike',sharedQuality:rule.shared,contrastQuality:rule.contrast,direction,support,counter,evidence:unique([...workIds,...counterItems.map(item=>item.work.id)]),workIds,displayWorkIds,displayNotes:{[displayWorkIds[0]]:'Favourite',[displayWorkIds[1]]:'Explicitly disliked'},sourceRoundIds,supportPairs,highWorkIds:positive.map(item=>item.work.id),lowWorkIds:negative.map(item=>item.work.id),counterWorkIds:counterItems.map(item=>item.work.id),high:positive.map(explicitRow),low:negative.map(explicitRow),counterExamples:counterItems.map(explicitRow),responseRevisions,annotationBasis:[...positive,...negative,...counterItems].map(item=>({workId:item.work.id,...item.review.annotationBasis})),sourceUrls:unique([...positive,...negative,...counterItems].flatMap(item=>item.review.sourceUrls)),coverage,anchorPools:{favouritePresentedIds:[...model.favouritePool],dislikePresentedIds:[...model.dislikePool],sharedPresentedIds:[...model.commonPool],sourceRoundIds:model.poolSourceRoundIds,qualificationScope:'shared-actually-presented-anchor-pool'},alternatives:[...explicitLimits],relatedRuleIds:[]};
  return {audit,finding};
}
function explicitBoundaries(sources,options){
  const model=collectExplicit(sources,options),results=TASTE_BOUNDARY_RULES.map(rule=>inspectExplicitRule(rule,model)),candidates=results.map(result=>result.finding).filter(Boolean).sort((a,b)=>b.coverage.coPresentedExamples-a.coverage.coPresentedExamples||b.highWorkIds.length+b.lowWorkIds.length-a.highWorkIds.length-a.lowWorkIds.length||a.counterWorkIds.length-b.counterWorkIds.length),findings=[];
  for(const candidate of candidates){const duplicate=findings.find(old=>nestedDuplicate(old,candidate));if(duplicate){duplicate.relatedRuleIds.push(candidate.id);duplicate.relatedContrasts||=[];duplicate.relatedContrasts.push({id:candidate.id,sharedQuality:candidate.sharedQuality,contrastQuality:candidate.contrastQuality,direction:candidate.direction,coverage:candidate.coverage,supportPairs:candidate.supportPairs,counter:candidate.counter,sourceRoundIds:candidate.sourceRoundIds});}else findings.push(candidate);}
  return {scope:EXPLICIT_BOUNDARY_SCOPE,findings,rulesChecked:results.map(result=>result.audit),anchors:model.items.map(explicitRow),coverage:{currentFavourites:model.basis.favourites.length,currentDislikes:model.basis.dislikes.length,sharedPresentedPoolWorks:model.commonPool.size,eligibleAnchorWorks:model.items.filter(item=>item.eligible).length,reviewedAnchorWorks:model.items.filter(item=>item.review).length,unreviewedAnchorWorks:model.items.filter(item=>!item.review).length,excludedDifferentPoolWorkIds:model.items.filter(item=>!item.inSharedPool).map(item=>item.work.id),excludedNoDiscoverySourceWorkIds:model.items.filter(item=>!item.origin).map(item=>item.work.id),poolSourceRoundIds:model.poolSourceRoundIds,qualifiedBeforeCollapse:candidates.length,distinctFindings:findings.length},limits:[...explicitLimits]};
}

/** Conditional descriptive boundaries, never an unbounded search for a type. */
export function buildTasteBoundaries({works=[],rounds=[],answers={},attributeReviews,annotationReviews=attributeReviews||{},currentWorks=[]}={}){
  const model=collect({works,rounds,answers,annotationReviews,currentWorks}),results=TASTE_BOUNDARY_RULES.map(rule=>inspectRule(rule,model)),candidates=results.map(result=>result.finding).filter(Boolean).sort((a,b)=>b.coverage.sameSetContrasts-a.coverage.sameSetContrasts||b.highWorkIds.length+b.lowWorkIds.length-a.highWorkIds.length-a.lowWorkIds.length||a.counterWorkIds.length-b.counterWorkIds.length),findings=[];
  for(const candidate of candidates){const duplicate=findings.find(old=>nestedDuplicate(old,candidate));if(duplicate){duplicate.relatedRuleIds.push(candidate.id);duplicate.relatedContrasts||=[];duplicate.relatedContrasts.push({id:candidate.id,sharedQuality:candidate.sharedQuality,contrastQuality:candidate.contrastQuality,direction:candidate.direction,coverage:candidate.coverage,supportPairs:candidate.supportPairs,counter:candidate.counter,sourceRoundIds:candidate.sourceRoundIds});continue;}findings.push(candidate);}
  const explicitChoices=explicitBoundaries(model.sources,{annotationReviews,currentWorks});
  return {version:TASTE_BOUNDARIES_VERSION,scope:model.allEntries.length?APPEAL_PROTOCOL:explicitChoices.anchors.length?EXPLICIT_BOUNDARY_SCOPE:APPEAL_PROTOCOL,findings:[...findings,...explicitChoices.findings],overallFindings:findings,explicitChoices,rulesChecked:results.map(result=>result.audit),coverage:{validOverallRounds:model.allEntries.length,distinctDiscoverySets:model.sets.length,distinctDiscoveryWorks:model.items.length,reviewedWorks:model.items.filter(item=>item.review).length,unreviewedWorks:model.items.filter(item=>!item.review).length,initialHighWorks:model.items.filter(item=>item.band==='high').length,initialLowWorks:model.items.filter(item=>item.band==='low').length,stableHighWorks:model.items.filter(item=>item.band==='high'&&item.stable).length,stableLowWorks:model.items.filter(item=>item.band==='low'&&item.stable).length,revisedOrConflictedWorks:model.items.filter(item=>!item.stable).length,explicitFavourites:model.basis.favourites.length,predeclaredRules:TASTE_BOUNDARY_RULES.length,qualifiedBeforeCollapse:candidates.length,distinctFindings:findings.length+explicitChoices.findings.length,overallDistinctFindings:findings.length,explicitChoiceFindings:explicitChoices.findings.length,currentExplicitFavourites:explicitChoices.coverage.currentFavourites,currentExplicitDislikes:explicitChoices.coverage.currentDislikes},limits:model.allEntries.length?[...TASTE_BOUNDARY_LIMITS]:explicitChoices.anchors.length?[...explicitLimits]:[...TASTE_BOUNDARY_LIMITS]};
}
