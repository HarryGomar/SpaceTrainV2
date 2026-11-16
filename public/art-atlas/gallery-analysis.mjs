import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import { buildRounds, validAnswer } from './engine.mjs';
import {museumPreferenceFindings} from './museum-preferences.mjs';

const PROTOCOL='open-gallery-v1';
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const title=w=>w.shortTitle||w.title;
const finite=Number.isFinite;
const unique=values=>[...new Set(values)];
const pairs=ids=>ids.flatMap((a,index)=>ids.slice(index+1).map(b=>[a,b]));
const pairKey=([a,b])=>[a,b].sort().join('|');
const groupKey=groups=>groups.map(group=>[...group.ids].sort().join(',')).sort().join(';');
const offeredKey=record=>[...record.offeredIds].sort().join('|');
const explicitWallPositions=record=>!record.roomStudy||Object.values(record.placements).every(p=>['wall-drop','wall-adjusted'].includes(p.intent));

export function paletteDistance(a,b) {
  const first=a?.analysis?.palette?.histogram,second=b?.analysis?.palette?.histogram;
  if(!Array.isArray(first)||!Array.isArray(second)||first.length!==40||second.length!==40||[...first,...second].some(v=>!finite(v)||v<0))return null;
  const sumA=first.reduce((s,v)=>s+v,0),sumB=second.reduce((s,v)=>s+v,0);
  if(sumA<=0||sumB<=0)return null;
  return Math.sqrt(first.reduce((sum,value,index)=>sum+(Math.sqrt(value/sumA)-Math.sqrt(second[index]/sumB))**2,0)/2);
}
function dateMidpoint(w) {
  const range=w?.analysis?.yearRange;
  return Array.isArray(range)&&range.length===2&&range.every(finite)&&range[1]>=range[0]&&range[1]-range[0]<=80?(range[0]+range[1])/2:null;
}
const featureDistance=key=>(a,b)=>isReviewedVisualDescriptor(a,key)&&isReviewedVisualDescriptor(b,key)?Math.min(1,Math.abs(a.features[key]-b.features[key])):null;
export const GROUPING_CRITERIA=[
  {key:'palette',label:'sampled colour palettes',title:'Colour palettes help describe your gallery groups.',distance:paletteDistance,limit:'Colour comes from sampled digital reproductions after a small edge crop. Frames, lighting, image colour and the amount of each colour can affect this descriptor. It is not a measurement of the original painting under museum lighting.'},
  {key:'date',label:'recorded dates',title:'Nearby dates recur within galleries.',distance:(a,b)=>{const x=dateMidpoint(a),y=dateMidpoint(b);return x===null||y===null?null:Math.min(1,Math.abs(x-y)/200);},limit:'Date comparison uses the middle of the recorded ranges and a two-century distance scale. Open-ended dates, missing dates and ranges wider than 80 years are excluded. Approximate dates remain approximate; this does not establish a shared movement.'},
  {key:'movement',label:'movement or tradition labels',title:'Movement labels recur within your gallery groups.',distance:(a,b)=>{const x=a?.analysis?.movementKey,y=b?.analysis?.movementKey;return typeof x==='string'&&x&&typeof y==='string'&&y&&!/unknown|unidentified|unspecified/.test(x+' '+y)?Number(x!==y):null;},limit:'Movement and tradition labels are editorial and differ in breadth across cultures. A shared label is not proof of an identical style, and different labels do not establish dissimilarity in every respect.'},
  {key:'abstraction',label:'degrees of abstraction',title:'Similar degrees of abstraction recur within galleries.',distance:featureDistance('abstraction'),limit:'Abstraction uses a coarse editorial artwork annotation. It does not describe the complete style of a work.'},
  {key:'humanity',label:'emphasis on human figures',title:'Human figures help describe these groupings.',distance:featureDistance('humanity'),limit:'Emphasis on figures uses a coarse editorial annotation. Subject, scale, gesture and personal associations may matter for other reasons.'},
  {key:'narrative',label:'emphasis on depicted events',title:'Depicted events help describe these groupings.',distance:featureDistance('narrative'),limit:'Depicted events use a coarse editorial annotation. The system does not recognise every story, symbol or personal association.'},
  {key:'complexity',label:'compositional density',title:'Similar compositional density recurs within galleries.',distance:featureDistance('complexity'),limit:'Density uses a coarse editorial annotation. Palette, subject and technique can vary with it.'}
];

function inspect(works,record,walls) {
  if(!record||record.kind!=='curate'||record.protocol!==PROTOCOL||!record.confirmed||!finite(record.finishedAt)||!record.placements||!Array.isArray(record.offeredIds)||!Array.isArray(record.presentedIds))return null;
  const byId=new Map(works.map(w=>[w.id,w])),wallById=new Map(walls.filter(w=>w?.id&&typeof w.roomId==='string').map(w=>[w.id,w])),entries=Object.entries(record.placements);
  if(entries.some(([id,p])=>!byId.has(id)||!record.offeredIds.includes(id)||!p||!wallById.has(p.wallId)||!finite(p.t)||p.t<0||p.t>1))return null;
  const groups=new Map();
  for(const [id,placement] of entries){const roomId=wallById.get(placement.wallId).roomId;groups.set(roomId,[...(groups.get(roomId)||[]),id]);}
  return {byId,wallById,ids:entries.map(([id])=>id).sort(),groups:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([roomId,ids])=>({roomId,ids:ids.sort()}))};
}
function random(seed) {
  let value=[...seed].reduce((s,c)=>(Math.imul(s,31)+c.charCodeAt(0))>>>0,2166136261);
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function shuffled(values,next) {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function alternateGroups(info,limit=256) {
  const ordered=[...info.groups].sort((a,b)=>a.ids.length-b.ids.length||a.roomId.localeCompare(b.roomId)),counts=ordered.map(g=>g.ids.length),observed=groupKey(info.groups),seen=new Set([observed]),result=[];
  const next=random(PROTOCOL+'|'+info.ids.join('|')+'|'+counts.join(','));
  for(let attempt=0;attempt<4096&&result.length<limit;attempt++) {
    const ids=shuffled(info.ids,next);let start=0;
    const groups=ordered.map((g,index)=>{const group={roomId:g.roomId,ids:ids.slice(start,start+counts[index])};start+=counts[index];return group;});
    const key=groupKey(groups);if(seen.has(key))continue;seen.add(key);result.push(groups);
  }
  return result;
}
function pairValues(ids,criterion,byId) {
  return pairs(ids).map(ids=>({ids,value:criterion.distance(byId.get(ids[0]),byId.get(ids[1]))})).filter(p=>p.value!==null&&finite(p.value));
}
function scoreGroups(groups,criterion,byId) {
  const rooms=groups.map(group=>{const values=pairValues(group.ids,criterion,byId);return {...group,pairs:values,score:mean(values.map(p=>p.value))};}).filter(g=>g.score!==null);
  return {rooms,value:mean(rooms.map(g=>g.score)),pairCount:rooms.reduce((s,g)=>s+g.pairs.length,0)};
}
function correlation(first,second) {
  const values=first.map((value,index)=>[value,second[index]]).filter(pair=>pair.every(v=>v!==null&&finite(v)));
  if(values.length<5)return 0;
  const a=mean(values.map(p=>p[0])),b=mean(values.map(p=>p[1]));
  const numerator=values.reduce((s,p)=>s+(p[0]-a)*(p[1]-b),0),denominator=Math.sqrt(values.reduce((s,p)=>s+(p[0]-a)**2,0)*values.reduce((s,p)=>s+(p[1]-b)**2,0));
  return denominator?numerator/denominator:0;
}
function metricsFor(info) {
  if(info.ids.length<6||info.groups.filter(g=>g.ids.length>=2).length<2)return [];
  const alternatives=alternateGroups(info),allPairs=pairs(info.ids);
  return GROUPING_CRITERIA.map(criterion=>{
    const observed=scoreGroups(info.groups,criterion,info.byId),allValues=allPairs.map(ids=>criterion.distance(info.byId.get(ids[0]),info.byId.get(ids[1]))),known=allValues.filter(v=>v!==null&&finite(v)),baseline=mean(known);
    const distribution=alternatives.map(groups=>scoreGroups(groups,criterion,info.byId).value).filter(v=>v!==null&&finite(v));
    const alternativeMean=mean(distribution),gain=observed.value===null||alternativeMean===null?0:alternativeMean-observed.value;
    const position=observed.value===null?1:(1+distribution.filter(v=>v<=observed.value+1e-8).length)/(distribution.length+1);
    const supportRooms=baseline===null?[]:observed.rooms.filter(g=>g.ids.length>=2&&g.score<=baseline-.08);
    const coverage=allPairs.length?known.length/allPairs.length:0,range=known.length?Math.max(...known)-Math.min(...known):0;
    return {key:criterion.key,criterion,value:observed.value,baseline,gain,position,alternativeCount:distribution.length,alternativeMean,rooms:observed.rooms,supportRooms,allValues,coverage,range,eligible:coverage>=.6&&range>=.25&&observed.pairCount>=3&&supportRooms.length>=2&&distribution.length>=8&&gain>=.08&&position<=.2};
  });
}
export function galleryGroupingMetrics(works,record,walls) {
  const info=inspect(works,record,walls);return info?metricsFor(info):[];
}
function roomLabel(record,id) {
  const number=/\d+/.exec(id)?.[0]||id,label='Gallery '+String(number).padStart(2,'0'),name=record.roomNames?.[id];
  return name?label+' · '+name:label;
}
function evidence(record,detail,ids,label='Your exhibition') {
  return {roundId:'scenario:'+record.id,label,detail,workIds:unique(ids)};
}
function finding(record,id,titleText,text,support,options={}) {
  const counter=options.counter||[];
  return {id:'gallery-'+record.id+'-'+id,title:titleText,text,kind:'curation',priority:10,support,counter,...options,alternatives:[...(options.alternatives||[]),'The tray sequence, automatic spacing and convenience can influence a layout. Repeating with a different tray order can test whether a connection survives.'],evidence:unique([...support,...counter].flatMap(e=>e.workIds))};
}
function roomEvidence(works,record,room,metric) {
  const names=room.ids.map(id=>{const w=works.find(w=>w.id===id);return title(w)+(metric.key==='date'?' ['+w.date+']':metric.key==='movement'?' ['+w.movement+']':'');});
  return evidence(record,roomLabel(record,room.roomId)+': '+names.join('; ')+'.',room.ids,roomLabel(record,room.roomId));
}
function samePool(first,second){return first.protocol===second.protocol&&first.roomStudy===second.roomStudy&&offeredKey(first)===offeredKey(second);}
function neighborPairs(record,wallById,ids) {
  const walls=new Map();
  for(const id of ids){const p=record.placements[id];walls.set(p.wallId,[...(walls.get(p.wallId)||[]),{id,t:p.t}]);}
  return [...walls].flatMap(([wallId,mounted])=>{const ordered=mounted.sort((a,b)=>a.t-b.t);return ordered.slice(1).map((item,index)=>({ids:[ordered[index].id,item.id],wallId,roomId:wallById.get(wallId).roomId}));});
}
function neighborFinding(works,record,info,metrics) {
  if(!explicitWallPositions(record))return null;
  const neighbors=neighborPairs(record,info.wallById,info.ids);
  if(neighbors.length<4||unique(neighbors.map(p=>p.roomId)).length<2)return null;
  const next=random('wall-neighbors|'+info.ids.join('|')),slots=info.groups.map(group=>({ids:group.ids,slots:group.ids.map(id=>record.placements[id])})),alternatives=[];
  for(let i=0;i<128;i++){const placements={};for(const group of slots){const order=shuffled(group.ids,next);order.forEach((id,index)=>placements[id]=group.slots[index]);}alternatives.push(neighborPairs({...record,placements},info.wallById,info.ids));}
  const candidates=metrics.map(metric=>{
    const scored=neighbors.map(p=>({...p,value:metric.criterion.distance(info.byId.get(p.ids[0]),info.byId.get(p.ids[1]))})).filter(p=>p.value!==null&&finite(p.value)),value=mean(scored.map(p=>p.value));
    const distribution=alternatives.map(ps=>mean(ps.map(p=>metric.criterion.distance(info.byId.get(p.ids[0]),info.byId.get(p.ids[1]))).filter(v=>v!==null&&finite(v)))).filter(v=>v!==null),avg=mean(distribution);
    const support=scored.filter(p=>metric.baseline!==null&&p.value<=metric.baseline-.1);
    return {metric,scored,value,gain:value===null||avg===null?0:avg-value,position:value===null?1:(1+distribution.filter(v=>v<=value+1e-8).length)/(distribution.length+1),support};
  }).filter(c=>c.scored.length>=4&&c.gain>=.08&&c.position<=.2&&unique(c.support.map(p=>p.roomId)).length>=2).sort((a,b)=>b.gain-a.gain);
  const candidate=candidates[0];if(!candidate)return null;
  const shown=[...new Map(candidate.support.map(p=>[p.roomId,p])).values()];
  for(const p of candidate.support)if(shown.length<4&&!shown.includes(p))shown.push(p);
  const support=shown.slice(0,4).map(p=>evidence(record,roomLabel(record,p.roomId)+', '+info.wallById.get(p.wallId).side+' wall: '+p.ids.map(id=>title(info.byId.get(id))).join(' beside ')+'.',p.ids,'Wall neighbours'));
  const exception=candidate.scored.filter(p=>candidate.metric.baseline!==null&&p.value>=candidate.metric.baseline+.1).sort((a,b)=>b.value-a.value)[0];
  const counter=exception?[evidence(record,roomLabel(record,exception.roomId)+' also contains a neighbouring pair that differs in this feature: '+exception.ids.map(id=>title(info.byId.get(id))).join(' beside ')+'.',exception.ids,'A different wall pair')]:[];
  return finding(record,'neighbors-'+candidate.metric.key,'The wall neighbours add another connection.',`Immediately neighbouring works have closer ${candidate.metric.criterion.label} than most reorderings of these works within their existing galleries and wall positions. This describes a local arrangement in addition to room membership.`,support,{counter,priority:9,alternatives:['The comparison holds each gallery group and its wall positions fixed, then changes which work occupies each position. It uses 128 deterministic reorderings, which are not independent observations or a significance test.',candidate.metric.criterion.limit,'This pattern may reflect the same relationships that shaped the larger gallery groups. It does not establish a separate motive.']});
}
function groupingFindings(works,record,info,metrics,previous,walls) {
  const candidates=metrics.filter(m=>m.eligible).sort((a,b)=>b.gain-a.gain),selected=[],findings=[];
  const previousInfo=previous&&inspect(works,previous,walls),previousMetrics=previousInfo?metricsFor(previousInfo):[];
  for(const metric of candidates){if(selected.some(other=>Math.abs(correlation(other.allValues,metric.allValues))>=.7))continue;selected.push(metric);if(selected.length===2)break;}
  for(const metric of selected) {
    const support=metric.supportRooms.map(room=>roomEvidence(works,record,room,metric)),supportLabels=metric.supportRooms.map(room=>roomLabel(record,room.roomId));
    const contrary=metric.rooms.filter(room=>!metric.supportRooms.some(r=>r.roomId===room.roomId)).sort((a,b)=>b.score-a.score)[0];
    const within=metric.supportRooms.flatMap(room=>room.pairs.filter(p=>p.value>=Math.max(.45,room.score+.25)).map(pair=>({room,pair}))).sort((a,b)=>b.pair.value-a.pair.value)[0];
    const exception=contrary?{room:contrary,pair:contrary.pairs.slice().sort((a,b)=>b.value-a.value)[0],detail:'does not show the same close grouping'}:within?{...within,detail:'contains a pair that differs despite the closer average grouping'}:null;
    const counter=exception?[evidence(record,roomLabel(record,exception.room.roomId)+' '+exception.detail+'. '+exception.pair.ids.map(id=>title(info.byId.get(id))).join(' and ')+' are a limit to that description.',exception.pair.ids,roomLabel(record,exception.room.roomId))]:[];
    const correlated=candidates.filter(other=>other.key!==metric.key&&Math.abs(correlation(metric.allValues,other.allValues))>=.7).map(other=>other.criterion.label);
    const old=previousMetrics.find(m=>m.key===metric.key&&m.eligible);
    let text=`In ${supportLabels.join(' and ')}, works have closer ${metric.criterion.label} than the selected works taken together. The whole arrangement also groups that feature more closely than most alternative assignments of these same works with the same number of places in each gallery.`;
    if(old){text+=' A similar grouping appeared in the previous exhibition made from the same offered collection.';support.push(...old.supportRooms.slice(0,2).map(room=>roomEvidence(works,previous,room,old)));}
    findings.push(finding(record,'grouping-'+metric.key,metric.criterion.title,text,support,{counter,priority:old?14:12,feature:metric.key,alternatives:[`The comparison uses ${metric.alternativeCount} distinct alternative groupings. Gallery occupancies and selected artworks stay fixed. The ranking is descriptive, not a confidence level, significance test or count of independent observations.`,metric.criterion.limit,...(correlated.length?['These same choices also align in '+correlated.join(' and ')+'. The arrangement cannot isolate which feature guided you.']:['Subject, technique and personal associations may also explain these groups.']),...(old?['A repeated exhibition can reflect memory or deliberate reuse. Two layouts from the same collection do not establish a stable trait.']:[])]}));
  }
  return findings;
}
function localGalleryFinding(works,record,info,metrics) {
  const subsets=new Map(),candidates=[];
  for(const metric of metrics.filter(m=>['palette','date','movement'].includes(m.key)&&m.coverage>=.8&&m.range>=.3&&m.baseline!==null)) {
    for(const room of metric.rooms.filter(r=>r.ids.length>=3&&r.pairs.length===pairs(r.ids).length&&metric.baseline-r.score>=.2)) {
      const size=room.ids.length;
      if(!subsets.has(size)){
        const next=random('local-gallery|'+info.ids.join('|')+'|'+size),seen=new Set(),values=[];
        for(let attempt=0;attempt<4096&&values.length<256;attempt++){const ids=shuffled(info.ids,next).slice(0,size).sort(),key=ids.join('|');if(!seen.has(key)){seen.add(key);values.push(ids);}}
        subsets.set(size,values);
      }
      const current=[...room.ids].sort().join('|'),distribution=subsets.get(size).filter(ids=>ids.join('|')!==current).map(ids=>{const values=pairValues(ids,metric.criterion,info.byId);return values.length===pairs(ids).length?mean(values.map(p=>p.value)):null;}).filter(v=>v!==null);
      const position=(1+distribution.filter(v=>v<=room.score+1e-8).length)/(distribution.length+1);
      if(distribution.length>=8&&position<=.15)candidates.push({metric,room,gain:metric.baseline-room.score,alternativeCount:distribution.length});
    }
  }
  const chosen=candidates.sort((a,b)=>b.gain-a.gain)[0];if(!chosen)return null;
  const {metric,room}=chosen,label=roomLabel(record,room.roomId),movementLabels=unique(room.ids.map(id=>info.byId.get(id).movement));
  const sharedLabel=metric.key==='movement'&&movementLabels.length===1?movementLabels[0]:null;
  const titleText=sharedLabel?label+' groups works labelled '+sharedLabel+'.':metric.key==='palette'?'A palette connection inside '+label+'.':'A chronological connection inside '+label+'.';
  const text=sharedLabel?`The ${room.ids.length} works in ${label} share the catalogue label "${sharedLabel}". This is a clear connection inside one gallery. It does not establish a repeated grouping rule across the exhibition.`:`The ${room.ids.length} works in ${label} have closer ${metric.criterion.label} than most equally sized subsets of the selected works. This describes a connection inside one gallery; a repeated rule across galleries remains unestablished.`;
  const other=metric.rooms.filter(r=>r.roomId!==room.roomId&&r.score>=room.score+.15).sort((a,b)=>b.score-a.score)[0];
  const counter=other?[roomEvidence(works,record,other,metric)]:[];
  if(counter.length)counter[0].detail+=' This gallery does not show the same close connection.';
  return finding(record,'local-'+metric.key,titleText,text,[roomEvidence(works,record,room,metric)],{feature:metric.key,scope:'gallery',galleryId:room.roomId,counter,priority:8,alternatives:[`This local comparison uses ${chosen.alternativeCount} other equally sized subsets of the selected works. It is a descriptive check, not a confidence level, significance test or independent replication.`,metric.criterion.limit,'Only the strongest qualifying local connection is shown after the exhibition-wide checks remain unresolved. Checking several descriptors can produce a local pattern by chance.','The other galleries do not yet establish this as a repeated or general rule. Colour, subject, dates and personal associations may offer other explanations.']});
}
function retainedGroups(record,info,previous,walls,works) {
  if(!previous)return null;const old=inspect(works,previous,walls);if(!old)return null;
  const common=info.ids.filter(id=>old.ids.includes(id));if(common.length<4)return null;
  const pairSet=groups=>new Set(groups.flatMap(g=>pairs(g.ids.filter(id=>common.includes(id)))).map(pairKey));
  const before=pairSet(old.groups),after=pairSet(info.groups),kept=[...before].filter(p=>after.has(p)),split=[...before].filter(p=>!after.has(p)),formed=[...after].filter(p=>!before.has(p));
  const oldNeighbors=new Set(neighborPairs(previous,old.wallById,common).map(p=>pairKey(p.ids))),newNeighbors=new Set(neighborPairs(record,info.wallById,common).map(p=>pairKey(p.ids))),changedNeighbors=explicitWallPositions(record)&&explicitWallPositions(previous)&&([...oldNeighbors].some(p=>!newNeighbors.has(p))||[...newNeighbors].some(p=>!oldNeighbors.has(p)));
  const sameGroups=!split.length&&!formed.length;
  return finding(record,'revisit',sameGroups&&changedNeighbors?'The groups stayed; the wall neighbours changed.':'What stayed together across layouts.',`${common.length} works appeared in both exhibitions. Among those works, ${kept.length} same-gallery pairs stayed together, ${split.length} separated, and ${formed.length} new same-gallery pairs formed.${sameGroups&&changedNeighbors?' The room groups stayed while at least one immediate wall neighbour changed.':''}`,[evidence(previous,'Earlier grouping among the works shared by both exhibitions.',common,'Earlier exhibition'),evidence(record,'Later grouping among the same shared works.',common,'Later exhibition')],{priority:10,alternatives:['These are exact pair counts within two arrangements, not independent responses or a taste-consistency percentage.','The offered collection and protocol match. Memory, a new intention or practical placement choices may explain either reuse or change.']});
}
function omissionFinding(works,record,info) {
  const answers=record.baselineAnswers||{},pref=answers.preferenceRank;
  let round;try{round=buildRounds(works,answers)[0];}catch{return null;}
  if(!validAnswer(round,pref))return null;
  const visible=new Set(record.presentedIds),omitted=record.offeredIds.filter(id=>visible.has(id)&&!info.ids.includes(id)&&finite(pref.positions[id])&&pref.positions[id]>=65).sort((a,b)=>pref.positions[b]-pref.positions[a]);
  for(const left of omitted){const kept=info.ids.find(id=>finite(pref.positions[id])&&pref.positions[left]-pref.positions[id]>=15);if(!kept)continue;
    return finding(record,'omission','A highly rated work stayed off the walls.',`You rated ${title(info.byId.get(left))} above ${title(info.byId.get(kept))} earlier. In this exhibition, the first was presented but left unhung, while the second received a place. Individual preference and exhibition fit may differ here.`,[evidence(record,'The first work was presented but not hung; the second was hung.',[left,kept]),{roundId:'preferenceRank',label:'Earlier preference',detail:`${title(info.byId.get(left))}: ${pref.positions[left]}; ${title(info.byId.get(kept))}: ${pref.positions[kept]}.`,workIds:[left,kept]}],{priority:11,alternatives:['Only works recorded as presented can support this omission comparison. Presentation is not proof of attention.','Leaving a work out is not a dislike. Redundancy, grouping, available wall positions or a different intention may explain the choice.']});
  }
  return null;
}

export function analyzeGallery(works,record,walls,previousRecords=[]) {
  const info=inspect(works,record,walls);if(!info)return [];
  const previous=[...previousRecords].reverse().find(r=>r?.id!==record.id&&r?.protocol===PROTOCOL&&Array.isArray(r.offeredIds)&&samePool(record,r)&&inspect(works,r,walls));
  const metrics=metricsFor(info),findings=groupingFindings(works,record,info,metrics,previous,walls);
  if(!findings.length){const local=localGalleryFinding(works,record,info,metrics);if(local)findings.push(local);}
  if(!findings.length)findings.push(finding(record,'grouping-open','The grouping rule remains open.',info.ids.length<6||info.groups.filter(g=>g.ids.length>=2).length<2?'There are not yet enough works grouped across galleries to compare a recurring rule. Keep these placements as a record and try more works in at least two galleries.':'No measured feature clearly distinguishes these gallery groups from alternative assignments of the same works. Your room names and the paintings themselves remain evidence beyond these descriptors.',[evidence(record,'Works currently hung, grouped by gallery.',info.ids)],{priority:3,alternatives:['An unresolved model does not mean the arrangement lacks coherence. It may depend on relationships these descriptors do not capture.','Palette, dates, movement labels and the visual annotations are possible descriptions, not causes established by this exercise.']}));
  const neighbor=neighborFinding(works,record,info,metrics),revisit=retainedGroups(record,info,previous,walls,works),omission=omissionFinding(works,record,info);
  if(neighbor)findings.push(neighbor);if(revisit)findings.push(revisit);if(omission)findings.push(omission);
  return [...findings,...museumPreferenceFindings(works,record)];
}
