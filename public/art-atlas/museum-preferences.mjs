import {validAnswer} from './engine.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';

export const MUSEUM_PREFERENCE_PROTOCOL='museum-preference-snapshot-v1';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const short=work=>work.shortTitle||work.title;
const identity=(a,b)=>a?.id===b?.id&&a.title===b.title&&a.artist===b.artist&&a.image===b.image&&a.sourceUrl===b.sourceUrl;

function usableSources(works,context,sources){
  if(!plain(context)||typeof context.roundId!=='string'||!Number.isInteger(context.index)||context.index<0||!Array.isArray(sources))return [];
  const counts=new Map();for(const item of sources)if(item?.round?.id)counts.set(item.round.id,(counts.get(item.round.id)||0)+1);
  return sources.filter(source=>{
    const round=source?.round;if(!round||round.id===context.roundId||counts.get(round.id)!==1||!Number.isInteger(source.index)||source.index<0||source.index>=context.index||round.unavailable||!isOverallAppealRound(round)||!Array.isArray(round.works))return false;
    if(round.works.some(work=>works.filter(candidate=>identity(candidate,work)).length!==1))return false;
    try{return validAnswer(round,source.answer);}catch{return false;}
  }).sort((a,b)=>a.index-b.index);
}

export function captureMuseumPreferences(works,options={}){
  const sources=usableSources(works,options.preferenceContext,options.preferenceSources);
  return {protocol:MUSEUM_PREFERENCE_PROTOCOL,context:sources.length?structuredClone(options.preferenceContext):null,sources:sources.map(source=>({index:source.index,round:{...structuredClone(source.round),works:source.round.works.map(work=>({id:work.id,title:work.title,shortTitle:work.shortTitle,artist:work.artist,image:work.image,sourceUrl:work.sourceUrl}))},answer:structuredClone(source.answer)}))};
}

function ratings(works,record){
  const snapshot=record.preferenceSnapshot;if(snapshot?.protocol!==MUSEUM_PREFERENCE_PROTOCOL)return new Map();
  const result=new Map();for(const source of usableSources(works,snapshot.context,snapshot.sources))for(const work of source.round.works)result.set(work.id,{work,score:source.answer.positions[work.id],source});
  return result;
}
function earlierEvidence(...items){
  return [...new Map(items.map(item=>[item.source.round.id,item.source])).values()].map(source=>({roundId:source.round.id,label:'Earlier overall appeal',workIds:items.filter(item=>item.source.round.id===source.round.id).map(item=>item.work.id),detail:items.filter(item=>item.source.round.id===source.round.id).map(item=>`${short(item.work)}: ${item.score} / 100`).join('; ')+'.'}));
}
function museumEvidence(record,ids,detail){return {roundId:'scenario:'+record.id,label:'Your museum',workIds:ids,detail};}
function finding(record,id,title,text,support,options={}){const counter=options.counter||[];return {id:'museum-preference-'+record.id+'-'+id,module:'curation',kind:'curation',title,text,priority:12,support,counter,...options,evidence:[...new Set([...support,...counter].flatMap(item=>item.workIds))],alternatives:['These are captured ratings on the same overall-appeal instrument, followed by an arrangement with a different purpose.','Only shown questions and actually presented museum works contribute. Presentation does not prove attention or deliberate consideration.','Leaving a painting out is not a dislike. Grouping, redundancy, wall space and the rest of the exhibition may affect the decision.','The comparison describes these particular choices. It does not establish a hidden motive or a personality trait.']};}

/** Captured before arranging: never fill an earlier preference from a later answer. */
export function museumPreferenceFindings(works,record){
  if(!record?.confirmed||!Number.isFinite(record.finishedAt)||!record.placements||!Array.isArray(record.presentedIds)||!Array.isArray(record.offeredIds))return [];
  const known=ratings(works,record),hung=Object.keys(record.placements).filter(id=>known.has(id)),omitted=record.offeredIds.filter(id=>record.presentedIds.includes(id)&&!record.placements[id]&&known.has(id));
  const output=[],candidates=omitted.flatMap(left=>hung.map(right=>({left:known.get(left),right:known.get(right)}))).filter(pair=>pair.left.score>=70&&pair.left.score-pair.right.score>=20).sort((a,b)=>(b.left.score-b.right.score)-(a.left.score-a.right.score));
  if(candidates.length){
    const {left,right}=candidates[0],support=[...earlierEvidence(left,right),museumEvidence(record,[left.work.id,right.work.id],`${short(left.work)} was presented but left unhung. ${short(right.work)} received a place.`)];
    const opposite=hung.flatMap(first=>omitted.map(second=>({first:known.get(first),second:known.get(second)}))).find(pair=>pair.first.score-pair.second.score>=20);
    const counter=opposite?[...earlierEvidence(opposite.first,opposite.second),museumEvidence(record,[opposite.first.work.id,opposite.second.work.id],'This hung/omitted pair follows the earlier appeal order.')]:[];
    output.push(finding(record,'omission','A higher-rated painting stayed off the walls.',`You rated ${short(left.work)} ${left.score} and ${short(right.work)} ${right.score} on the overall-appeal scale. In your museum, the first was shown but left unhung, while the second received a place.`,support,{counter}));
  }
  const entry=known.get(record.roomResponses?.entryId),higher=entry?hung.map(id=>known.get(id)).filter(item=>item.work.id!==entry.work.id&&item.score-entry.score>=20).sort((a,b)=>b.score-a.score)[0]:null;
  if(higher)output.push(finding(record,'entry','Your opening work differed from a higher-rated choice.',`Both paintings hang in your museum. You chose ${short(entry.work)} to begin the visit, although you had given ${short(higher.work)} a higher overall-appeal rating.`,[...earlierEvidence(entry,higher),museumEvidence(record,[entry.work.id,higher.work.id],'The first work was explicitly chosen as the entrance painting; the other was also hung.')],{priority:11}));
  return output;
}
