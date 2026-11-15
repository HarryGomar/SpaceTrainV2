import { buildRounds, validAnswer } from './engine.mjs';
import { paletteDistance, GROUPING_CRITERIA } from './gallery-analysis.mjs';

const STUDY='room-relations-v1';
const finite=Number.isFinite;
const unique=values=>[...new Set(values)];
const mean=values=>values.length?values.reduce((s,v)=>s+v,0)/values.length:null;
const pairs=values=>values.flatMap((a,i)=>values.slice(i+1).map(b=>[a,b]));
const title=work=>work.shortTitle||work.title;
const pairKey=([a,b])=>[a,b].sort().join('|');
const roomLabel=(record,id)=>record.roomNames?.[id]||'Gallery '+String(/\d+/.exec(id)?.[0]||id).padStart(2,'0');
function evidence(record,detail,workIds,label='Your room decisions') {
  return {roundId:'scenario:'+record.id,label,detail,workIds:unique(workIds)};
}
function finding(record,id,titleText,text,support,options={}) {
  const counter=options.counter||[];
  return {id:'room-study-'+record.id+'-'+id,title:titleText,text,kind:'curation',priority:10,support,counter,alternatives:[],...options,evidence:unique([...support,...counter].flatMap(e=>e.workIds))};
}
function inspect(works,record,walls) {
  if(!record||record.version!==2||record.kind!=='curate'||record.protocol!=='open-gallery-v1'||typeof record.id!=='string'||!record.id||record.roomStudy!==STUDY||record.phase!=='walkthrough'||record.confirmed!==true||!finite(record.finishedAt)||!Array.isArray(record.offeredIds)||!record.placements||Array.isArray(record.placements)||typeof record.placements!=='object')return null;
  const responses=record.roomResponses;
  if(!responses||typeof responses!=='object'||Array.isArray(responses)||Object.keys(responses).some(key=>!['entryId','lingerRoomId','bridgeIds'].includes(key))||typeof responses.entryId!=='string'||typeof responses.lingerRoomId!=='string'||!Array.isArray(responses.bridgeIds)||responses.bridgeIds.length!==2||new Set(responses.bridgeIds).size!==2)return null;
  const byId=new Map(works.map(w=>[w.id,w])),wallById=new Map((walls||[]).filter(w=>w?.id&&typeof w.roomId==='string').map(w=>[w.id,w])),roomByWork=new Map(),groups=new Map();
  if(new Set(record.offeredIds).size!==record.offeredIds.length||record.offeredIds.some(id=>!byId.has(id)))return null;
  for(const [id,p] of Object.entries(record.placements)) {
    const wall=wallById.get(p?.wallId);
    if(!byId.has(id)||!wall||!finite(p.t)||p.t<0||p.t>1||Array.isArray(record.offeredIds)&&!record.offeredIds.includes(id))return null;
    roomByWork.set(id,wall.roomId);groups.set(wall.roomId,[...(groups.get(wall.roomId)||[]),id]);
  }
  if(!roomByWork.has(responses.entryId)||!groups.has(responses.lingerRoomId)||responses.bridgeIds.some(id=>!roomByWork.has(id))||roomByWork.get(responses.bridgeIds[0])===roomByWork.get(responses.bridgeIds[1]))return null;
  return {byId,roomByWork,ids:[...roomByWork.keys()].sort(),groups:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([roomId,ids])=>({roomId,ids:ids.sort()})),responses};
}
function graph(connections) {
  const result=new Map();
  for(const edge of connections||[])if(Array.isArray(edge)&&edge.length===2&&edge.every(id=>typeof id==='string')&&edge[0]!==edge[1])for(const [a,b] of [edge,[edge[1],edge[0]]])result.set(a,new Set([...(result.get(a)||[]),b]));
  return result;
}
export function roomGraphDistance(connections,from,to) {
  if(from===to)return 0;const links=graph(connections),seen=new Set([from]),queue=[[from,0]];
  for(let i=0;i<queue.length;i++){const [id,distance]=queue[i];for(const next of links.get(id)||[]){if(next===to)return distance+1;if(!seen.has(next)){seen.add(next);queue.push([next,distance+1]);}}}
  return null;
}
function earlierPreference(works,record) {
  const answer=record.baselineAnswers?.preferenceRank;if(!answer)return null;
  try {const round=buildRounds(works,record.baselineAnswers)[0];return validAnswer(round,answer)?answer:null;}catch{return null;}
}
function entryFinding(works,record,info) {
  const {entryId,lingerRoomId}=info.responses,entryRoom=info.roomByWork.get(entryId),linger=info.groups.find(g=>g.roomId===lingerRoomId),pref=earlierPreference(works,record);
  const rated=pref?info.ids.filter(id=>finite(pref.positions[id])).sort((a,b)=>pref.positions[b]-pref.positions[a]):[],higher=rated.find(id=>id!==entryId&&finite(pref.positions[entryId])&&pref.positions[id]-pref.positions[entryId]>=15);
  const support=[evidence(record,'Chosen starting work: '+title(info.byId.get(entryId))+' in '+roomLabel(record,entryRoom)+'.',[entryId],'Starting point')];
  let titleText,text;
  if(higher){
    const wasFavourite=pref.positions[higher]===Math.max(...Object.values(pref.positions));
    titleText=wasFavourite?'The starting point differed from an earlier favourite.':'The starting point differed from an earlier preference comparison.';
    text=`You rated ${title(info.byId.get(higher))} above ${title(info.byId.get(entryId))} earlier. Both are hung in this exhibition, but you chose the latter to begin the visit.`;
    support.push({...evidence(record,`Captured earlier preference: ${title(info.byId.get(higher))} ${pref.positions[higher]}; ${title(info.byId.get(entryId))} ${pref.positions[entryId]}.`,[higher,entryId],'Earlier preference snapshot'),sourceRoundId:'preferenceRank'});
    if(entryRoom!==lingerRoomId){text+=' You reserved the longest stop for a different gallery, '+roomLabel(record,lingerRoomId)+'.';if(info.roomByWork.get(higher)===lingerRoomId)text+=' The higher-rated work hangs in that longer-stop room.';support.push(evidence(record,'Chosen longest stop: '+roomLabel(record,lingerRoomId)+'.',linger.ids,'Longest stop'));}
  }else if(entryRoom!==lingerRoomId){
    titleText='The beginning and the longest stop serve different rooms.';
    text=`You begin with ${title(info.byId.get(entryId))} in ${roomLabel(record,entryRoom)}, but give the longest stop to ${roomLabel(record,lingerRoomId)}. The arrival choice and the room worth more time separated in this layout.`;
    support.push(evidence(record,'Chosen longest stop: '+roomLabel(record,lingerRoomId)+'.',linger.ids,'Longest stop'));
  }else return null;
  return finding(record,'entry-and-linger',titleText,text,support,{priority:higher?13:10,alternatives:['A starting point can reflect sequence, accessibility or the rest of the exhibition. It is not another individual preference rating.','The longest-stop response is an imagined allocation of time, not measured viewing time or proof that every work in that room is preferred.']});
}
function descriptors() {
  return [
    {key:'palette',label:'sampled colour palettes',distance:paletteDistance,limit:'The palette descriptor comes from digital reproductions. Frames, lighting and reproduction colour can influence it.'},
    {key:'date',label:'recorded dates',distance:(a,b)=>GROUPING_CRITERIA.find(c=>c.key==='date').distance(a,b),limit:'Dates use recorded ranges and their approximate midpoints. Open-ended and very broad ranges provide no chronological comparison.'},
    {key:'humanity',label:'emphasis on human figures',distance:(a,b)=>featureDistance(a,b,'humanity'),limit:'Emphasis on figures is a coarse editorial annotation, not a complete account of subject or meaning.'},
    {key:'narrative',label:'emphasis on depicted events',distance:(a,b)=>featureDistance(a,b,'narrative'),limit:'Depicted events use a coarse editorial annotation. The system does not recognise every story or association.'}
  ];
}
function featureDistance(a,b,key){return finite(a?.features?.[key])&&finite(b?.features?.[key])?Math.abs(a.features[key]-b.features[key]):null;}
function bridgeFinding(record,info,connections) {
  const [aId,bId]=info.responses.bridgeIds,a=info.byId.get(aId),b=info.byId.get(bId),aRoom=info.roomByWork.get(aId),bRoom=info.roomByWork.get(bId),steps=roomGraphDistance(connections,aRoom,bRoom),allPairs=pairs(info.ids).filter(([x,y])=>info.roomByWork.get(x)!==info.roomByWork.get(y));
  const candidates=descriptors().map(descriptor=>{const value=descriptor.distance(a,b),values=allPairs.map(([x,y])=>descriptor.distance(info.byId.get(x),info.byId.get(y))).filter(v=>v!==null&&finite(v)),baseline=mean(values),range=values.length?Math.max(...values)-Math.min(...values):0;return {descriptor,value,baseline,range,gain:value===null||baseline===null?0:baseline-value};}).filter(c=>c.value!==null&&c.range>=.3&&c.value<=.25&&c.gain>=.15).sort((a,b)=>b.gain-a.gain);
  const candidate=candidates[0],support=[evidence(record,'Chosen cross-room link: '+title(a)+' in '+roomLabel(record,aRoom)+' with '+title(b)+' in '+roomLabel(record,bRoom)+'.',[aId,bId],'Chosen cross-room link')],counter=[];
  let text=`You explicitly linked ${title(a)} in ${roomLabel(record,aRoom)} with ${title(b)} in ${roomLabel(record,bRoom)}.`;
  if(steps===1)text+=' Their galleries share a direct connection in the plan.';
  else if(steps!==null)text+=` Their galleries are ${steps} connections apart in the plan, so this link reaches beyond directly neighbouring rooms.`;
  if(candidate){
    const d=candidate.descriptor;
    if(d.key==='palette')text+=' The sampled reproductions also have relatively similar colour distributions within the works you hung.';
    else if(d.key==='date')text+=' Their recorded dates sit relatively close together within the works you hung.';
    else text+=' Their '+d.label+' is also similar in the current artwork annotations.';
    text+=' This offers a possible connection; your reason remains open.';
    support.push(evidence(record,d.key==='date'?title(a)+': '+a.date+'. '+title(b)+': '+b.date+'.':'Descriptor comparison: relatively close '+d.label+' within this selected set.',[aId,bId],'Possible descriptor connection'));
    const contrast=descriptors().filter(other=>other.key!==d.key).map(other=>({descriptor:other,value:other.distance(a,b)})).filter(other=>other.value!==null&&other.value>=.6).sort((a,b)=>b.value-a.value)[0];
    if(contrast)counter.push(evidence(record,contrast.descriptor.key==='date'?`The same works have different recorded date ranges: ${title(a)} ${a.date}; ${title(b)} ${b.date}.`:'The same pair differs in '+contrast.descriptor.label+'. The link is not a similarity across every measured feature.',[aId,bId],'A difference within the link'));
  }
  return finding(record,'chosen-bridge',steps>1?'Your chosen connection reaches across the plan.':'A chosen connection crosses the gallery boundary.',text,support,{counter,priority:candidate?12:8,alternatives:[...(candidate?[candidate.descriptor.limit]:[]),'The cross-room connection is your explicit choice. A descriptor that fits it does not establish what caused that choice.','Several descriptors were considered. A fresh comparison or your own explanation is needed to distinguish them.','Connection counts come from the supplied gallery graph, including the entrance hall. They are not measurements of walking distance or time.']});
}
function permutations(values) {
  if(!values.length)return [[]];return values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(tail=>[value,...tail]));
}
function arrangementValues(assignment,physicalPairs,groupDistances) {
  const direct=[],remote=[];
  for(const p of physicalPairs){const value=groupDistances.get(pairKey([assignment[p.a],assignment[p.b]]));if(value===null||value===undefined)continue;(p.steps===1?direct:remote).push(value);}
  return {direct,remote,delta:direct.length>=2&&remote.length>=2?mean(remote)-mean(direct):null};
}
function adjacencyFinding(record,info,connections) {
  if(info.groups.length<4||info.ids.length<8)return null;
  const groups=info.groups,physicalPairs=pairs(groups.map((_,i)=>i)).map(([a,b])=>({a,b,steps:roomGraphDistance(connections,groups[a].roomId,groups[b].roomId)}));
  if(physicalPairs.some(p=>p.steps===null)||physicalPairs.filter(p=>p.steps===1).length<2||physicalPairs.filter(p=>p.steps>1).length<2)return null;
  const layouts=permutations(groups.map((_,i)=>i)),actual=groups.map((_,i)=>i),candidates=[];
  for(const descriptor of descriptors()) {
    const distances=new Map();for(const [a,b] of pairs(actual)){const values=groups[a].ids.flatMap(x=>groups[b].ids.map(y=>descriptor.distance(info.byId.get(x),info.byId.get(y)))).filter(v=>v!==null&&finite(v));distances.set(pairKey([a,b]),values.length>=Math.ceil(groups[a].ids.length*groups[b].ids.length*.8)?mean(values):null);}
    const known=[...distances.values()].filter(v=>v!==null),range=known.length?Math.max(...known)-Math.min(...known):0,observed=arrangementValues(actual,physicalPairs,distances),distribution=layouts.map(layout=>arrangementValues(layout,physicalPairs,distances).delta).filter(v=>v!==null),baseline=mean(distribution);
    if(known.length<Math.ceil(physicalPairs.length*.8)||range<.3||observed.delta===null||baseline===null||distribution.length<24)continue;
    const direction=Math.sign(observed.delta-baseline),gain=Math.abs(observed.delta-baseline),tail=distribution.filter(v=>direction*(v-observed.delta)>=-1e-8).length/distribution.length,distinct=new Set(distribution.map(v=>v.toFixed(6))).size;
    const overall=mean(known),support=physicalPairs.filter(p=>p.steps===1&&distances.get(pairKey([p.a,p.b]))!==null&&direction*(overall-distances.get(pairKey([p.a,p.b])))>=.08),remote=physicalPairs.filter(p=>p.steps>1&&distances.get(pairKey([p.a,p.b]))!==null&&direction*(distances.get(pairKey([p.a,p.b]))-overall)>=.08);
    if(gain>=.15&&Math.abs(observed.delta)>=.15&&tail<=.15&&distinct>=4&&support.length>=2&&remote.length)candidates.push({descriptor,distances,observed,direction,gain,support,remote,distribution});
  }
  const candidate=candidates.sort((a,b)=>b.gain-a.gain)[0];if(!candidate)return null;
  const {descriptor,direction,distances}=candidate;
  const describe=(p,role)=>{const a=groups[p.a],b=groups[p.b],ids=[...a.ids,...b.ids];return evidence(record,roomLabel(record,a.roomId)+' and '+roomLabel(record,b.roomId)+(p.steps===1?' have a direct connection.':' are '+p.steps+' graph connections apart.')+' Their groups have '+(role==='support'?(direction>0?'closer':'more different'):(direction>0?'more different':'closer'))+' '+descriptor.label+'.',ids,p.steps===1?'Neighbouring gallery groups':'More distant gallery groups');};
  const support=[...candidate.support.slice(0,2).map(p=>describe(p,'support')),...candidate.remote.slice(0,1).map(p=>describe(p,'remote'))];
  const overall=mean([...distances.values()].filter(v=>v!==null)),opposing=physicalPairs.find(p=>{const v=distances.get(pairKey([p.a,p.b]));return v!==null&&(p.steps===1?direction*(v-overall)>=.05:direction*(overall-v)>=.05);});
  const counter=opposing?[evidence(record,roomLabel(record,groups[opposing.a].roomId)+' and '+roomLabel(record,groups[opposing.b].roomId)+' are a limit: their descriptor relationship goes against the main neighbouring-versus-distant contrast.',[...groups[opposing.a].ids,...groups[opposing.b].ids],'A different room relationship')]:[];
  return finding(record,'room-adjacency-'+descriptor.key,direction>0?'Neighbouring rooms share a closer relationship.':'Neighbouring rooms carry a stronger contrast.',`In this plan, directly connected gallery groups have ${direction>0?'closer':'more different'} ${descriptor.label} than more distant gallery groups. That contrast is stronger than in most permutations of these intact room groups across the same occupied physical rooms.`,support,{counter,priority:11,feature:descriptor.key,scope:'room-adjacency',alternatives:[`The comparison uses ${candidate.distribution.length} permutations of intact room groups. These are dependent descriptive alternatives, not independent responses, a significance test or a confidence percentage.`,descriptor.limit,'Several descriptors were checked, and only the strongest qualifying spatial contrast is shown. Their relationships can coincide.','The graph distinguishes a direct connection from a route through the hall or another gallery. It does not measure actual walking distance, viewing time or an intended route.','This comparison treats groups as movable units. It does not establish that every abstract permutation would fit the same physical wall positions.','Room membership is used here; automatic wall spacing and fine wall adjustments do not provide evidence for this finding. Adjacency does not prove an intention to create the contrast.']});
}

export function analyzeRoomDecisions(works,record,walls,connections) {
  const info=inspect(works,record,walls);if(!info)return [];
  const result=[],entry=entryFinding(works,record,info),bridge=bridgeFinding(record,info,connections),adjacency=adjacencyFinding(record,info,connections);
  if(entry)result.push(entry);result.push(bridge);if(adjacency)result.push(adjacency);
  return result.slice(0,3);
}
