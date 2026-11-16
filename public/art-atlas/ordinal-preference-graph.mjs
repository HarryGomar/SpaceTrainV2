import {validAnswer} from './engine.mjs';
import {choiceGridExposure} from './discovery-grid.mjs';
import {COMPARISON_PROTOCOL,isComparisonPreferenceRound,comparisonDirection} from './comparison-protocol.mjs';

const unique=values=>[...new Set(values)],ids=round=>round.works.map(work=>work.id),key=(a,b)=>JSON.stringify([a,b].sort());
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const LIMITS=['Only orders and exact ties from the captured comparison protocol supply edges. Distances along the line are not liking intensity or confidence.','A quartet supplies related pair observations from one question, not six independent measurements. Repeats remain response history.','A component frontier describes only its recorded comparisons. No order is inferred between disconnected components, and a local winner is not automatically liked.','Explicit favourites and dislikes are separate declarations. Unselected, skipped and unsure works never become their opposites.'];
const hashes=work=>[work?.sha256,work?.previewSha256,work?.provenance?.thumbnailSha256,work?.provenance?.sha256,work?.provenance?.download?.sha256].filter(value=>value!==undefined);
export function sameOrdinalArtworkIdentity(left,right,{requireSource=false}={}){if(!left||!right||left.id!==right.id)return false;for(const field of ['sourceUrl','image']){if(requireSource&&(typeof left[field]!=='string'||typeof right[field]!=='string'))return false;if(left[field]!==undefined&&right[field]!==undefined&&left[field]!==right[field])return false;}const a=hashes(left),b=hashes(right);return !a.length||!b.length||[...a,...b].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)&&value.toLowerCase()===a[0].toLowerCase());}

export function ordinalPreferenceEntries({works=[],rounds=[],answers={}}={}){
  if(!Array.isArray(works)||!Array.isArray(rounds)||!plain(answers))return [];
  const workCounts=new Map();for(const work of works)workCounts.set(work?.id,(workCounts.get(work?.id)||0)+1);const available=new Map(works.filter(work=>typeof work?.id==='string'&&workCounts.get(work.id)===1).map(work=>[work.id,work])),counts=new Map();for(const round of rounds)counts.set(round?.id,(counts.get(round?.id)||0)+1);
  return rounds.flatMap((round,index)=>{
    if(!round||round.unavailable||counts.get(round.id)!==1||!isComparisonPreferenceRound(round)||!Array.isArray(round.works)||round.works.length<2||round.works.length>8)return [];
    const workIds=ids(round),answer=answers[round.id];if(new Set(workIds).size!==workIds.length||round.works.some(work=>!available.has(work.id)||!sameOrdinalArtworkIdentity(work,available.get(work.id)))||round.workIds!==undefined&&(!Array.isArray(round.workIds)||round.workIds.join('|')!==workIds.join('|'))||answer?.confirmed!==true||answer.roundId!==undefined&&answer.roundId!==round.id||!plain(answer.positions)||Object.keys(answer.positions).length!==workIds.length)return [];
    let valid=false;try{valid=validAnswer(round,answer);}catch{}return valid?[{round,answer,index,workIds}]:[];
  });
}

/** Strongly connected preference cycles stay visible rather than being broken
 * by a fitted score or a deterministic title-based winner. */
function frontiers(workIds,edges){
  const neighbours=new Map(workIds.map(id=>[id,[]]));for(const edge of edges){if(edge.aWins)neighbours.get(edge.a).push(edge.b);if(edge.bWins)neighbours.get(edge.b).push(edge.a);}
  let next=0;const indexes=new Map(),low=new Map(),stack=[],stacked=new Set(),groups=[];
  function visit(id){indexes.set(id,next);low.set(id,next++);stack.push(id);stacked.add(id);for(const other of neighbours.get(id)){if(!indexes.has(other)){visit(other);low.set(id,Math.min(low.get(id),low.get(other)));}else if(stacked.has(other))low.set(id,Math.min(low.get(id),indexes.get(other)));}if(low.get(id)===indexes.get(id)){const group=[];let other;do{other=stack.pop();stacked.delete(other);group.push(other);}while(other!==id);groups.push(group.sort());}}
  workIds.forEach(id=>{if(!indexes.has(id))visit(id);});const membership=new Map(groups.flatMap((group,index)=>group.map(id=>[id,index]))),incoming=new Set();for(const [id,others]of neighbours)for(const other of others)if(membership.get(id)!==membership.get(other))incoming.add(membership.get(other));
  return {observedFrontierIds:groups.filter((_,index)=>!incoming.has(index)).flat().sort(),cycles:groups.filter(group=>group.length>1).map(group=>({workIds:group,sourceRoundIds:unique(edges.filter(edge=>group.includes(edge.a)&&group.includes(edge.b)).flatMap(edge=>edge.sourceRoundIds)),meaning:'Recorded preference directions form a cycle; this group has no resolved strict order.'}))};
}

function explicitAnchors(works,rounds,answers,entries){
  const available=new Set(works.map(work=>work.id)),counts=new Map();rounds.forEach(round=>counts.set(round?.id,(counts.get(round?.id)||0)+1));const positive=new Map(),negative=new Map(),current=new Map(),declarations=[],questions=[];
  for(let index=0;index<rounds.length;index++){
    const round=rounds[index],type=round?.evidence?.construct==='overall-favourites'&&round.evidence.explicitFavourites===true?'positive':round?.evidence?.construct==='overall-dislikes'&&round.evidence.explicitDislikes===true?'negative':null;
    if(!type||round.unavailable||counts.get(round.id)!==1||round.kind!=='choice-grid'||round.selectionMode!=='shortlist'||!Array.isArray(round.works)||round.evidence.anchorComparisonProtocol!==undefined&&round.evidence.anchorComparisonProtocol!==COMPARISON_PROTOCOL)continue;
    const answer=answers[round.id],workIds=ids(round);if(new Set(workIds).size!==workIds.length||round.workIds!==undefined&&(!Array.isArray(round.workIds)||round.workIds.join('|')!==workIds.join('|'))||workIds.some(id=>!available.has(id))||answer?.confirmed!==true||answer.roundId!==undefined&&answer.roundId!==round.id)continue;
    let valid=false;try{valid=validAnswer(round,answer);}catch{}if(!valid)continue;const exposure=round.evidence.instrumentRevision==='paged-favourites-v1'?choiceGridExposure(round,answer):{presentedIds:[...workIds],coPresentedGroups:[[...workIds]]};if(!exposure)continue;
    const prior=entries.filter(entry=>entry.index<index),priorIds=new Set(prior.flatMap(entry=>entry.workIds));if((round.evidence.anchorComparisonProtocol===COMPARISON_PROTOCOL?exposure.presentedIds:answer.selectedIds).some(id=>!priorIds.has(id)||!prior.some(entry=>entry.round.works.some(work=>work.id===id&&sameOrdinalArtworkIdentity(work,round.works.find(item=>item.id===id),{requireSource:true})))))continue;
    questions.push({roundId:round.id,type,selectedIds:[...answer.selectedIds],presentedIds:[...exposure.presentedIds],explicitNone:answer.explicitNone===true,unsure:answer.unsure===true});
    if(answer.unsure)continue;
    const states=type==='positive'?positive:negative;
    for(const work of round.works.filter(work=>exposure.presentedIds.includes(work.id))){const selected=answer.selectedIds.includes(work.id);if(!selected){states.delete(work.id);if(current.get(work.id)?.kind===type)current.delete(work.id);continue;}const sources=prior.filter(entry=>entry.workIds.includes(work.id)).map(entry=>entry.round.id),previous=states.get(work.id),detail=type==='positive'?'Explicitly selected as a favourite. The selection is unranked.':'Explicitly selected as disliked. Being lowest in another group was not used as a substitute.';
      const declaration={workId:work.id,work,kind:type,basis:type==='positive'?'explicit-favourite':'explicit-dislike',sourceRoundIds:unique([...(previous?.sourceRoundIds||[]),...sources,round.id]),anchorRoundIds:unique([...(previous?.anchorRoundIds||[]),round.id]),comparisonSourceRoundIds:sources,support:[{roundId:round.id,label:type==='positive'?'Your favourites':'Your dislikes',workIds:[work.id],detail}]};states.set(work.id,declaration);current.set(work.id,declaration);declarations.push(declaration);}
  }
  const item=value=>({...value,currentType:current.get(value.workId)?.kind||'unknown',contradictingAnchorRoundIds:unique(declarations.filter(other=>other.workId===value.workId&&other.kind!==value.kind).flatMap(other=>other.anchorRoundIds))});
  return {explicitPositive:[...current.values()].filter(value=>value.kind==='positive').map(item),explicitNegative:[...current.values()].filter(value=>value.kind==='negative').map(item),declarationHistory:declarations.map(item),anchorQuestions:questions};
}

export function buildOrdinalPreferenceGraph({works=[],rounds=[],answers={}}={}){
  const entries=ordinalPreferenceEntries({works,rounds,answers}),nodes=new Map(),pairs=new Map();
  for(const entry of entries){for(const work of entry.round.works)nodes.set(work.id,work);for(let i=0;i<entry.workIds.length;i++)for(let j=i+1;j<entry.workIds.length;j++){
    const [a,b]=[entry.workIds[i],entry.workIds[j]].sort(),pair=key(a,b),edge=pairs.get(pair)||{a,b,aWins:0,bWins:0,ties:0,sourceRoundIds:[],observations:[]},direction=comparisonDirection(entry.round,entry.answer,a,b);if(direction===null)continue;
    if(direction>0)edge.aWins++;else if(direction<0)edge.bWins++;else edge.ties++;edge.sourceRoundIds.push(entry.round.id);edge.observations.push({roundId:entry.round.id,direction,role:entry.round.evidence.role||'discovery',repeatOf:entry.round.evidence.repeatOf||null,independentPairMeasurement:false});pairs.set(pair,edge);
  }}
  const parent=new Map([...nodes.keys()].map(id=>[id,id]));const root=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;};for(const edge of pairs.values()){const a=root(edge.a),b=root(edge.b);if(a!==b)parent.set(b,a);}const grouped=new Map();for(const id of nodes.keys()){const r=root(id);grouped.set(r,[...(grouped.get(r)||[]),id]);}
  const edges=[...pairs.values()].sort((a,b)=>key(a.a,a.b).localeCompare(key(b.a,b.b))),components=[...grouped.values()].map(workIds=>{workIds.sort();const local=edges.filter(edge=>workIds.includes(edge.a)&&workIds.includes(edge.b));return {id:'comparison-component:'+workIds[0],workIds,sourceRoundIds:unique(local.flatMap(edge=>edge.sourceRoundIds)),...frontiers(workIds,local),rankingScope:'Only this connected set of recorded comparisons; its frontier is not an absolute favourite claim.'};}).sort((a,b)=>b.workIds.length-a.workIds.length||a.id.localeCompare(b.id));
  return {version:'ordinal-preference-graph-v1',protocol:COMPARISON_PROTOCOL,components,edges,...explicitAnchors(works,rounds,answers,entries),coverage:{comparisonRoundCount:entries.length,distinctSourceSetCount:new Set(entries.map(entry=>JSON.stringify([...entry.workIds].sort()))).size,comparedWorkCount:nodes.size,connectedComponentCount:components.length,uniquePairCount:edges.length,explicitTiePairCount:edges.filter(edge=>edge.ties).length,repeatedPairCount:edges.filter(edge=>edge.observations.length>1).length,contradictoryPairCount:edges.filter(edge=>edge.aWins&&edge.bWins).length},globalAbsoluteRankingAvailable:false,limits:[...LIMITS]};
}
