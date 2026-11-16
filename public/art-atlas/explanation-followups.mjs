import {withContinuousPreference,isContinuousPreferenceRound} from './continuous-preference.mjs';
import {collectTastePatternSources} from './taste-axes.mjs';
import {resolveArtworkAttributes} from './taste-patterns.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {validSorting,sortingDistance} from './sorting-table.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {mainCollectionWorks} from './collection-routing.mjs';
import {sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';

export const DIAGNOSTIC_PROTOCOL='explanation-diagnostic-v1';
const unique=values=>[...new Set(values)],ids=round=>round.works.map(work=>work.id),pairs=values=>values.flatMap((a,i)=>values.slice(i+1).map(b=>[a,b]));
const key=values=>JSON.stringify([...values].sort());
const qualityKeys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS),title=k=>ARTWORK_ATTRIBUTE_DEFINITIONS[k].label;
const limits=['This comparison was selected from actual earlier responses to separate possible explanations. It is not an independent population test.','Source-bound qualities are editorial descriptions. Artist, subject, familiarity, reproduction and other qualities may still differ.','A relatedness choice is not another preference vote.'];
export const isDiagnosticRound=round=>round?.evidence?.diagnostic?.protocol===DIAGNOSTIC_PROTOCOL;

export function buildDiagnosticRound({works=[],id,kind='quality',seed='diagnostic'}={}){
  const placeholder=works.filter(work=>work?.id&&work.title).slice(0,4);
  const round={id,kind:kind==='grouping'?'choice-grid':'spectrum',works:placeholder,anchorWorks:[],title:kind==='grouping'?'Which would you add to the group you made?':'How much do these appeal to you?',hint:kind==='grouping'?'Choose either, both, neither, or Not sure. Judge their relationship to your earlier group.':'',...(kind==='grouping'?{selectionMode:'relatedness',maxChoices:placeholder.length,allowUnsure:true}:{criterion:'preference'}),unavailable:true,unavailableReason:'This question needs actual earlier responses.',evidence:{construct:kind==='grouping'?'grouping-relatedness-check':'preference',family:kind==='grouping'?'relationship-followup':'individual-choice',role:'probe',unconditional:kind!=='grouping',diagnostic:{protocol:DIAGNOSTIC_PROTOCOL,binding:'deferred',kind,seed:String(seed)},limits:[...limits]}};
  return kind==='grouping'?round:withContinuousPreference(round);
}

function reviewsFor(works,annotationReviews){const cache=new Map();return work=>{if(!cache.has(work))cache.set(work,resolveArtworkAttributes(work,{annotationReviews,currentWorks:works}));return cache.get(work);};}
const status=(read,work,quality)=>read(work)?.attributes[quality]?.status||'unknown';
const value=(read,work,quality)=>status(read,work,quality)==='present'?1:status(read,work,quality)==='absent'?0:null;
function historyBefore(round,rounds,answers){
  const n=id=>/^journey-\d+$/.test(id)?Number(id.slice(8)):null,target=n(round.id),counts=new Map();for(const r of rounds)counts.set(r?.id,(counts.get(r?.id)||0)+1);
  const history=rounds.filter(r=>r&&r.id!==round.id&&counts.get(r.id)===1&&(!target||!n(r.id)||n(r.id)<target));
  return {history,answers:Object.fromEntries(history.filter(r=>answers[r.id]).map(r=>[r.id,answers[r.id]]))};
}
function finish(round,works,workIds,diagnostic,anchors=[]){
  const byId=new Map(works.map(work=>[work.id,work])),result={...structuredClone(round),works:workIds.map(id=>byId.get(id)),workIds:[...workIds],anchorWorks:anchors.map(id=>byId.get(id)),anchorIds:[...anchors],evidence:{...round.evidence,diagnostic:{...round.evidence.diagnostic,...diagnostic,binding:'bound'}}};
  if(result.kind==='choice-grid')result.maxChoices=workIds.length;
  delete result.unavailable;delete result.unavailableReason;return result;
}
function fallback(round,works,history,answers,reason){
  const sources=collectTastePatternSources({works,rounds:history,answers}),entries=sources.preferenceScopes.flatMap(scope=>scope.sets).filter(set=>isContinuousPreferenceRound(set.entry.round));
  const chosen=unique(entries.slice(-3).flatMap(set=>set.items.map(item=>item.work.id))).slice(0,4);
  if(chosen.length<2)return {...structuredClone(round),unavailable:true,unavailableReason:reason,evidence:{...round.evidence,diagnostic:{...round.evidence.diagnostic,binding:'unavailable',reason}}};
  const base=withContinuousPreference({...round,kind:'spectrum',criterion:'preference',title:'How much do these appeal to you?',hint:'',anchorWorks:[],evidence:{...round.evidence,construct:'preference',family:'individual-choice',unconditional:true}});delete base.selectionMode;delete base.maxChoices;delete base.allowUnsure;
  return finish(base,works,chosen,{kind:'appeal-fallback',requestedKind:round.evidence.diagnostic.kind,reason,sourceRoundIds:entries.slice(-3).map(set=>set.entry.round.id),prediction:null});
}

function bindQuality(round,works,history,answers,read){
  const scope=collectTastePatternSources({works,rounds:history,answers}).preferenceScopes.find(scope=>scope.channel==='personal-appeal');
  if(!scope||scope.sets.length<3)return fallback(round,works,history,answers,'At least three earlier anchored-appeal groups are needed.');
  const hypotheses=qualityKeys.flatMap(quality=>{
    const groups=scope.sets.flatMap(set=>{const withQuality=set.items.filter(item=>value(read,item.work,quality)===1),without=set.items.filter(item=>value(read,item.work,quality)===0);if(!withQuality.length||!without.length)return [];const mean=items=>items.reduce((sum,item)=>sum+item.value,0)/items.length;return [{roundId:set.entry.round.id,gap:mean(withQuality)-mean(without),workIds:set.items.map(item=>item.work.id)}];});
    if(groups.length<2)return [];const signed=groups.reduce((sum,group)=>sum+group.gap,0)/groups.length,direction=Math.sign(signed),support=groups.filter(group=>group.gap*direction>=5);if(!direction||Math.abs(signed)<5||support.length<2)return [];
    return [{quality,title:title(quality),direction,meanGroupGap:signed,supportingGroups:support.length,groups,trainingRoundIds:groups.map(group=>group.roundId)}];
  }).sort((a,b)=>b.supportingGroups-a.supportingGroups||Math.abs(b.meanGroupGap)-Math.abs(a.meanGroupGap)||a.quality.localeCompare(b.quality));
  const rated=[...new Map(scope.sets.flatMap(set=>set.items).map(item=>[item.work.id,item.work])).values()],seenPairs=new Set(scope.sets.concat(scope.checks).flatMap(set=>pairs(ids(set.entry.round)).map(pair=>key(pair)))),proposals=[];
  for(let i=0;i<Math.min(hypotheses.length,8);i++)for(let j=i+1;j<Math.min(hypotheses.length,8);j++)for(const [a,b]of pairs(rated)){
    if(seenPairs.has(key([a.id,b.id]))||a.artist===b.artist)continue;
    const left=hypotheses[i],right=hypotheses[j],av=value(read,a,left.quality),bv=value(read,b,left.quality),ar=value(read,a,right.quality),br=value(read,b,right.quality);
    if([av,bv,ar,br].includes(null))continue;const first=(av-bv)*left.direction,second=(ar-br)*right.direction;if(!first||!second||first*second>=0)continue;
    const otherDifferences=qualityKeys.filter(k=>![left.quality,right.quality].includes(k)).filter(k=>value(read,a,k)!==null&&value(read,b,k)!==null&&value(read,a,k)!==value(read,b,k)).length;
    proposals.push({workIds:[a.id,b.id],hypotheses:[left,right],predictions:[first>0?a.id:b.id,second>0?a.id:b.id],score:left.supportingGroups+right.supportingGroups-otherDifferences*.15});
  }
  proposals.sort((a,b)=>b.score-a.score||key(a.workIds).localeCompare(key(b.workIds)));const chosen=proposals[0];
  if(!chosen)return fallback(round,works,history,answers,'The reviewed catalogue did not offer a safe new pair where two supported explanations disagree.');
  const trainingRoundIds=unique(chosen.hypotheses.flatMap(h=>h.trainingRoundIds)),sources=scope.sets.filter(set=>trainingRoundIds.includes(set.entry.round.id)).map(set=>({round:structuredClone(set.entry.round),answer:structuredClone(set.entry.answer)}));
  return finish(round,works,chosen.workIds,{kind:'quality',hypotheses:chosen.hypotheses,predictions:chosen.predictions,sourceRoundIds:trainingRoundIds,sourceSnapshots:sources,qualitySnapshots:Object.fromEntries(chosen.workIds.map(id=>[id,read(works.find(work=>work.id===id))])),comparisonNovel:true,holdoutUnit:'new-comparison-of-earlier-rated-works',hypothesisStatus:'frozen-before-answer'});
}

function bindGrouping(round,works,history,answers,read){
  const sources=history.filter(source=>source.kind==='exercise'&&source.exerciseKind==='sorting').flatMap(source=>{const a=answers[source.id];let valid=false;try{valid=!a?.skipped&&(a?.roundId===undefined||a.roundId===source.id)&&Array.isArray(a?.workIds)&&JSON.stringify(a.workIds)===JSON.stringify(ids(source))&&validSorting(a.record,source.works);}catch{}return valid?[{source,answer:a,record:a.record}]:[];}).reverse();
  const pool=mainCollectionWorks(works).filter(isStudyEligibleArtwork),byId=new Map(works.map(work=>[work.id,work]));
  for(const source of sources){
    const offered=ids(source.source),positions=source.record.positions,distances=pairs(offered).map(pair=>({pair,distance:sortingDistance(positions[pair[0]],positions[pair[1]])/Math.hypot(1.5,1)})).sort((a,b)=>a.distance-b.distance);
    if(!distances.length||distances.at(-1).distance<.3)continue;
    for(const near of distances.filter(pair=>pair.distance<=.22).slice(0,6)){
      const anchors=near.pair.map(id=>byId.get(id)),shared=qualityKeys.filter(k=>anchors.every(work=>value(read,work,k)===1));
      for(const [first,second]of pairs(shared)){
        const candidates=quality=>pool.filter(work=>!offered.includes(work.id)&&value(read,work,quality)===1&&value(read,work,quality===first?second:first)===0);
        const a=candidates(first),b=candidates(second);let chosen=null;
        for(const left of a)for(const right of b){if(left.id===right.id||left.artist===right.artist||anchors.some(work=>work.artist===left.artist||work.artist===right.artist))continue;const difference=qualityKeys.filter(k=>![first,second].includes(k)&&value(read,left,k)!==null&&value(read,right,k)!==null&&value(read,left,k)!==value(read,right,k)).length,score=difference+(left.movement===anchors[0].movement?2:0)+(right.movement===anchors[0].movement?2:0);if(!chosen||score<chosen.score)chosen={left,right,score};}
        if(!chosen)continue;
        return finish(round,works,[chosen.left.id,chosen.right.id],{kind:'grouping',sourceRoundId:source.source.id,sourceRecordId:source.record.id,sourceRoundIds:[source.source.id],sourceSnapshot:{round:structuredClone(source.source),answer:structuredClone(source.answer)},anchorIds:[...near.pair],anchorDistance:near.distance,rivals:[{quality:first,qualityTitle:title(first),workId:chosen.left.id},{quality:second,qualityTitle:title(second),workId:chosen.right.id}],qualitySnapshots:Object.fromEntries([...near.pair,chosen.left.id,chosen.right.id].map(id=>[id,read(byId.get(id))])),predictionKind:'relationship-not-preference'},near.pair);
      }
    }
  }
  return fallback(round,works,history,answers,'No completed earlier sorting group and source-bound rival companions met the relationship-check requirements.');
}

/** Called only before first presentation. Captured questions are immutable. */
export function bindDiagnosticRound({round,works=[],rounds=[],answers={},annotationReviews=REVIEWS}={}){
  if(!isDiagnosticRound(round))return round;
  if(round.evidence.diagnostic.binding==='bound')return structuredClone(round);
  const captured=historyBefore(round,rounds,answers),byId=new Map(works.map(work=>[work.id,work])),history=captured.history.filter(source=>source.works?.every(work=>sameOrdinalArtworkIdentity(work,byId.get(work.id),{requireSource:true}))),earlierAnswers=captured.answers,read=reviewsFor(works,annotationReviews);
  return round.evidence.diagnostic.kind==='grouping'?bindGrouping(round,works,history,earlierAnswers,read):bindQuality(round,works,history,earlierAnswers,read);
}
