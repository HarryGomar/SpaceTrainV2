import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {validAnswer} from './engine.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
import {isComparisonPreferenceRound,comparisonDirection} from './comparison-protocol.mjs';
const orderOnly=round=>isComparisonPreferenceRound(round)&&!isContinuousPreferenceRound(round);

export const MUSEUM_PREFERENCE_PROTOCOL='museum-preference-snapshot-v2';
const LEGACY_MUSEUM_PREFERENCE_PROTOCOL='museum-preference-snapshot-v1';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const short=work=>work.shortTitle||work.title;
const identity=(a,b)=>a?.id===b?.id&&a.title===b.title&&a.artist===b.artist&&a.image===b.image&&a.sourceUrl===b.sourceUrl;

function usableSources(works,context,sources){
  if(!plain(context)||typeof context.roundId!=='string'||!Number.isInteger(context.index)||context.index<0||!Array.isArray(sources))return [];
  const counts=new Map();for(const item of sources)if(item?.round?.id)counts.set(item.round.id,(counts.get(item.round.id)||0)+1);
  return sources.filter(source=>{
    const round=source?.round;if(!round||round.id===context.roundId||counts.get(round.id)!==1||!Number.isInteger(source.index)||source.index<0||source.index>=context.index||round.unavailable||!isOverallAppealRound(round)&&!isComparisonPreferenceRound(round)||!Array.isArray(round.works))return false;
    if(round.works.some(work=>works.filter(candidate=>identity(candidate,work)).length!==1))return false;
    try{return validAnswer(round,source.answer);}catch{return false;}
  }).sort((a,b)=>a.index-b.index);
}

export function captureMuseumPreferences(works,options={}){
  const sources=usableSources(works,options.preferenceContext,options.preferenceSources);
  return {protocol:MUSEUM_PREFERENCE_PROTOCOL,context:sources.length?structuredClone(options.preferenceContext):null,sources:sources.map(source=>({index:source.index,round:{...structuredClone(source.round),works:source.round.works.map(work=>({id:work.id,title:work.title,shortTitle:work.shortTitle,artist:work.artist,image:work.image,sourceUrl:work.sourceUrl}))},answer:structuredClone(source.answer)}))};
}

function ratings(works,record){
  const snapshot=record.preferenceSnapshot;if(![MUSEUM_PREFERENCE_PROTOCOL,LEGACY_MUSEUM_PREFERENCE_PROTOCOL].includes(snapshot?.protocol))return new Map();
  const result=new Map();for(const source of usableSources(works,snapshot.context,snapshot.sources).filter(source=>isOverallAppealRound(source.round)))for(const work of source.round.works)result.set(work.id,{work,score:source.answer.positions[work.id],scope:source.round.evidence.continuousProtocol||source.round.evidence.appealProtocol,source});
  return result;
}
function earlierEvidence(...items){
  return [...new Map(items.map(item=>[item.source.round.id,item.source])).values()].map(source=>({roundId:source.round.id,label:'Earlier overall appeal',workIds:items.filter(item=>item.source.round.id===source.round.id).map(item=>item.work.id),detail:items.filter(item=>item.source.round.id===source.round.id).map(item=>`${short(item.work)}: ${item.score} / 100`).join('; ')+'.'}));
}
function museumEvidence(record,ids,detail){return {roundId:'scenario:'+record.id,label:'Your museum',workIds:ids,detail};}
function finding(record,id,title,text,support,options={}){const counter=options.counter||[];return {id:'museum-preference-'+record.id+'-'+id,module:'curation',kind:'curation',title,text,priority:12,support,counter,...options,evidence:[...new Set([...support,...counter].flatMap(item=>item.workIds))],alternatives:['These are captured ratings on the same overall-appeal instrument, followed by an arrangement with a different purpose.','Only shown questions and actually presented museum works contribute. Presentation does not prove attention or deliberate consideration.','Leaving a painting out is not a dislike. Grouping, redundancy, wall space and the rest of the exhibition may affect the decision.','The comparison describes these particular choices. It does not establish a hidden motive or a personality trait.']};}

function ordinalFindings(works,record){
  const snapshot=record.preferenceSnapshot;if(snapshot?.protocol!==MUSEUM_PREFERENCE_PROTOCOL)return [];
  const sources=usableSources(works,snapshot.context,snapshot.sources).filter(source=>orderOnly(source.round)),presented=new Set(record.presentedIds),hung=new Set(Object.keys(record.placements)),pairs=new Map();
  // A comparison is usable only when both works shared the original question.
  for(const source of sources)for(let i=0;i<source.round.works.length;i++)for(let j=i+1;j<source.round.works.length;j++){
    const a=source.round.works[i],b=source.round.works[j];if(!presented.has(a.id)||!presented.has(b.id))continue;
    const direction=comparisonDirection(source.round,source.answer,a.id,b.id);if(!direction)continue;
    const preferred=direction>0?a:b,other=direction>0?b:a;pairs.set([a.id,b.id].sort().join('|'),{source,preferred,other});
  }
  const prior=pair=>({roundId:pair.source.round.id,label:'Earlier preference order',workIds:[pair.preferred.id,pair.other.id],detail:`You preferred ${short(pair.preferred)} to ${short(pair.other)} within their original painting group.`,sourceRole:'captured before arranging'});
  const limits=['The earlier pair shared one comparison question. Positions establish order, not absolute liking or strength.','The arrangement has a different purpose. An omission can reflect fit, repetition or space; it is not a dislike.','Other earlier painting groups are not compared by their raw point positions.'];
  const output=[],omission=[...pairs.values()].find(pair=>!hung.has(pair.preferred.id)&&hung.has(pair.other.id));
  if(omission)output.push({id:'museum-preference-'+record.id+'-ordinal-omission',module:'curation',kind:'curation',title:'A preferred painting stayed outside this arrangement.',text:`You preferred ${short(omission.preferred)} to ${short(omission.other)} earlier. In this museum, you placed ${short(omission.other)} and left ${short(omission.preferred)} unhung.`,priority:10,comparisonBasis:'same-pair-ordinal-preference',support:[prior(omission),museumEvidence(record,[omission.preferred.id,omission.other.id],'Both were presented; the earlier preferred work was left unhung.')],counter:[],evidence:[omission.preferred.id,omission.other.id],alternatives:limits});
  const opening=[...pairs.values()].find(pair=>pair.other.id===record.roomResponses?.entryId&&hung.has(pair.preferred.id)&&hung.has(pair.other.id));
  if(opening)output.push({id:'museum-preference-'+record.id+'-ordinal-entry',module:'curation',kind:'curation',title:'You chose a different painting to open the museum.',text:`You preferred ${short(opening.preferred)} to ${short(opening.other)} earlier, then chose ${short(opening.other)} to begin this arrangement. Both works hang in your museum.`,priority:9,comparisonBasis:'same-pair-ordinal-preference',support:[prior(opening),museumEvidence(record,[opening.preferred.id,opening.other.id],'The earlier lower-ranked work was deliberately chosen as the entrance painting.')],counter:[],evidence:[opening.preferred.id,opening.other.id],alternatives:limits});
  return output;
}

/** Captured before arranging: never fill an earlier preference from a later answer. */
export function museumPreferenceFindings(works,record){
  if(!record?.confirmed||!Number.isFinite(record.finishedAt)||!record.placements||!Array.isArray(record.presentedIds)||!Array.isArray(record.offeredIds))return [];
  const known=ratings(works,record),hung=Object.keys(record.placements).filter(id=>known.has(id)),omitted=record.offeredIds.filter(id=>record.presentedIds.includes(id)&&!record.placements[id]&&known.has(id));
  const output=[],candidates=omitted.flatMap(left=>hung.map(right=>({left:known.get(left),right:known.get(right)}))).filter(pair=>pair.left.scope===pair.right.scope&&pair.left.score>=70&&pair.left.score-pair.right.score>=20).sort((a,b)=>(b.left.score-b.right.score)-(a.left.score-a.right.score));
  if(candidates.length){
    const {left,right}=candidates[0],support=[...earlierEvidence(left,right),museumEvidence(record,[left.work.id,right.work.id],`${short(left.work)} was presented but left unhung. ${short(right.work)} received a place.`)];
    const opposite=hung.flatMap(first=>omitted.map(second=>({first:known.get(first),second:known.get(second)}))).find(pair=>pair.first.scope===pair.second.scope&&pair.first.score-pair.second.score>=20);
    const counter=opposite?[...earlierEvidence(opposite.first,opposite.second),museumEvidence(record,[opposite.first.work.id,opposite.second.work.id],'This hung/omitted pair follows the earlier appeal order.')]:[];
    output.push(finding(record,'omission','A higher-rated painting stayed off the walls.',`You rated ${short(left.work)} ${left.score} and ${short(right.work)} ${right.score} on the overall-appeal scale. In your museum, the first was shown but left unhung, while the second received a place.`,support,{counter}));
  }
  const entry=known.get(record.roomResponses?.entryId),higher=entry?hung.map(id=>known.get(id)).filter(item=>item.work.id!==entry.work.id&&item.scope===entry.scope&&item.score-entry.score>=20).sort((a,b)=>b.score-a.score)[0]:null;
  if(higher)output.push(finding(record,'entry','Your opening work differed from a higher-rated choice.',`Both paintings hang in your museum. You chose ${short(entry.work)} to begin the visit, although you had given ${short(higher.work)} a higher overall-appeal rating.`,[...earlierEvidence(entry,higher),museumEvidence(record,[entry.work.id,higher.work.id],'The first work was explicitly chosen as the entrance painting; the other was also hung.')],{priority:11}));
  return [...output,...ordinalFindings(works,record)];
}
