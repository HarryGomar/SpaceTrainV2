import {AXES} from './engine.mjs';
import {validatedProfileEntries,artworkSetKey,isUnconditionalPreference,profileEvidence,buildPreferenceBasis} from './profile-evidence.mjs';

const unique=values=>[...new Set(values)];
const short=work=>work.shortTitle||work.title;
const EXPECTED={
  achievement:{construct:'perceived-achievement',xName:'Personal appeal',yName:'Admiration of making',left:'Not for me',right:'For me',bottom:'Little to admire',top:'Much to admire'},
  reading:{construct:'scene-and-meaning',xName:'Scene clarity',yName:'Interpretive openness',left:'Unclear scene',right:'Clear scene',bottom:'One reading',top:'Several readings'},
  returnResponse:{construct:'tension-and-return',xName:'Felt tension',yName:'Wish to return',left:'Comforting',right:'Unsettling',bottom:'Once is enough',top:'Would return'}
};
const limits=['These connect your recorded judgments of specific works. They do not identify a cause, objective artistic merit or a personality type.','The 15-point order gap, 20-point appraisal gap and 65/35 descriptive bands are provisional rules. They are not calibrated probabilities.','Different pairs within a set and repeated appearances of one painting are dependent evidence. Counts distinguish actual works and artwork sets.'];
const axisDefinition=round=>round.axisDefinition||AXES[round.axis];
function interpretable(entry){
  const expected=EXPECTED[entry.round.axis],definition=axisDefinition(entry.round);
  return !!expected&&entry.round.evidence?.construct===expected.construct&&definition&&['xName','yName','left','right','bottom','top'].every(key=>definition[key]===expected[key]);
}
function latestSets(entries){
  const sets=new Map();for(const entry of entries)sets.set(artworkSetKey(entry.round),entry);return [...sets.values()];
}
function evidence(entry,workIds){
  const definition=axisDefinition(entry.round);
  return profileEvidence(entry,workIds,workIds.map(id=>{const work=entry.round.works.find(work=>work.id===id),point=entry.answer.points[id];return `${short(work)}: ${definition.xName} ${point[0]}; ${definition.yName} ${point[1]}`;}).join('. ')+'.');
}
function observation(id,module,title,text,support,counter=[],comparisons=[],extra={}){
  return {id:'response-'+id,module,kind:'taste',title,text,support,counter,comparisons,alternatives:[...limits],priority:11,evidence:unique([...support,...counter].flatMap(item=>item.workIds)),...extra};
}
function measureComparison(item,role='support'){
  const entry=item.entry,definition=axisDefinition(entry.round),workIds=item.workIds;
  return {roundId:entry.round.id,sourceRoundIds:unique([...(item.preference?[item.preference.round.id]:[]),entry.round.id]),workIds,role,measures:[...(item.preference?[{key:'preference',label:'Earlier preference in this set',values:workIds.map(id=>item.preference.answer.positions[id])}]:[]),{key:entry.round.axis+'-x',label:definition.xName,values:workIds.map(id=>entry.answer.points[id][0])},{key:entry.round.axis+'-y',label:definition.yName,values:workIds.map(id=>entry.answer.points[id][1])}]};
}
function uniqueSetCases(cases){
  const selected=new Map();for(const item of cases){const key=artworkSetKey(item.entry.round),previous=selected.get(key);if(!previous||item.strength>previous.strength)selected.set(key,item);}return [...selected.values()];
}
function makingReading(maps,preferences){
  const cases=maps.flatMap(entry=>{
    const preference=preferences.filter(other=>other.index<entry.index&&artworkSetKey(other.round)===artworkSetKey(entry.round)).at(-1);
    return entry.round.works.flatMap((left,index)=>entry.round.works.slice(index+1).flatMap(right=>{
      const gap=preference?preference.answer.positions[left.id]-preference.answer.positions[right.id]:entry.answer.points[left.id][0]-entry.answer.points[right.id][0];
      if(Math.abs(gap)<15)return [];
      const a=gap>0?left:right,b=gap>0?right:left,admirationGap=entry.answer.points[a.id][1]-entry.answer.points[b.id][1];
      if(Math.abs(admirationGap)<20)return [];
      return [{entry,preference,a,b,workIds:[a.id,b.id],admirationGap,strength:Math.abs(gap)+Math.abs(admirationGap)}];
    }));
  });
  const supporting=uniqueSetCases(cases.filter(item=>item.admirationGap>0)),opposing=uniqueSetCases(cases.filter(item=>item.admirationGap<0));
  if(supporting.length<2||unique(supporting.flatMap(item=>item.workIds)).length<4)return null;
  const chosen=supporting.slice(0,3),exceptions=opposing.slice(0,2),supportFor=item=>[
    ...(item.preference?[profileEvidence(item.preference,item.workIds,item.workIds.map(id=>`${short(item.preference.round.works.find(work=>work.id===id))}: preference ${item.preference.answer.positions[id]}`).join('; ')+'.')]:[]),evidence(item.entry,item.workIds)
  ];
  const first=supporting[0],exception=opposing[0];
  return observation('making','making-and-taste',opposing.length?'Admiration and appeal align, with exceptions.':'Admiration accompanies appeal.',`${supporting.length} distinct sets included a clearer choice for the painting you also admired more, including ${short(first.a)} over ${short(first.b)}.${exception?` ${short(exception.b)} shows the separation: you admired its making more while ${short(exception.a)} was preferred.`:''}`,chosen.flatMap(supportFor),exceptions.flatMap(supportFor),[...chosen.map(item=>measureComparison(item)),...exceptions.map(item=>measureComparison(item,'counter'))],{
    displayWorkIds:first.workIds,
    supportingSetCount:supporting.length,counterSetCount:opposing.length,setsWithBothDirections:unique(supporting.filter(item=>opposing.some(other=>artworkSetKey(other.entry.round)===artworkSetKey(item.entry.round))).map(item=>artworkSetKey(item.entry.round))).length,
    sourceSetCount:unique(cases.map(item=>artworkSetKey(item.entry.round))).length,
    readingBasis:cases.every(item=>item.preference)?'matched-preference':'reported-appeal-and-making',
    alternatives:[...limits,'A set can contain both aligned and opposing pairs, so supporting and counter counts can overlap. A high admiration coordinate is not a test of objective skill or effort.','When a separate earlier preference question offered this exact set, its order is retained separately from the map’s personal-appeal coordinate.']
  });
}
function preferredRows(maps,preferences,basis){
  const positive=new Map(basis.seeds.map(seed=>[seed.work.id,seed]));
  return maps.flatMap(entry=>{
    const preference=preferences.filter(other=>other.index<entry.index&&artworkSetKey(other.round)===artworkSetKey(entry.round)).at(-1);
    const maximum=preference?Math.max(...Object.values(preference.answer.positions)):null;
    return entry.round.works.flatMap(work=>{
      const seed=positive.get(work.id);
      if(seed)return [{entry,work,point:entry.answer.points[work.id],preference:seed.entry,preferenceSupport:seed.support,basis:seed.basis}];
      // An old local leader supplies an exact-set relation, not an absolute high.
      if(!basis.absoluteScaleAvailable&&!basis.favouriteRoundIds.length&&preference&&preference.answer.positions[work.id]>=maximum-10&&preference.round.works.some(other=>preference.answer.positions[work.id]-preference.answer.positions[other.id]>=15))return [{entry,work,point:entry.answer.points[work.id],preference,preferenceSupport:[profileEvidence(preference,[work.id],`${short(work)} led at least one clear comparison in this exact artwork set. Its position is not interpreted as absolute liking.`)],basis:'within-set-leader'}];
      return [];
    });
  });
}
function uniqueRows(rows){const selected=new Map();for(const row of rows)selected.set(row.work.id,row);return [...selected.values()];}
const rowSetCount=rows=>unique(rows.map(row=>artworkSetKey(row.entry.round))).length;
const rowEvidence=rows=>rows.flatMap(row=>[...(row.preferenceSupport||[]),evidence(row.entry,[row.work.id])]);
function readingReading(maps,preferences,basis){
  const rows=uniqueRows(preferredRows(maps,preferences,basis)),clearOpen=rows.filter(row=>row.point[0]>=65&&row.point[1]>=65),unclearOpen=rows.filter(row=>row.point[0]<=35&&row.point[1]>=65),closed=rows.filter(row=>row.point[1]<=35),local=rows.some(row=>row.basis==='within-set-leader');
  let selected,title,text;
  if(clearOpen.length>=2&&unclearOpen.length>=2&&rowSetCount([...clearOpen,...unclearOpen])>=2){
    selected=[...clearOpen,...unclearOpen];title='Several readings, with and without a clear scene.';
    text=`The works ${local?'ranked higher within their offered sets':'you positively chose'} included both ${short(clearOpen[0].work)}, with a clear scene, and ${short(unclearOpen[0].work)}, with a less clear scene. You left room for several readings in both.`;
  }else if(clearOpen.length>=3&&rowSetCount(clearOpen)>=2){
    selected=clearOpen;title='Clear scenes with room to interpret.';
    text=`${short(clearOpen[0].work)} and ${short(clearOpen[1].work)} joined ${local?'higher positions within their offered sets':'positive overall choices'} with a clear scene and several possible readings. This combination appeared in ${rowSetCount(clearOpen)} map sets.`;
  }else if(unclearOpen.length>=3&&rowSetCount(unclearOpen)>=2){
    selected=unclearOpen;title='Open readings in less explicit scenes.';
    text=`${short(unclearOpen[0].work)} and ${short(unclearOpen[1].work)} joined ${local?'higher positions within their offered sets':'positive overall choices'} with less explicit scenes and several possible readings. This combination appeared in ${rowSetCount(unclearOpen)} map sets.`;
  }else return null;
  const counter=closed;
  return observation('reading','scene-and-meaning',title,text,rowEvidence(selected),rowEvidence(counter),selected.slice(0,3).map(row=>measureComparison({entry:row.entry,workIds:[row.work.id]})),{
    supportingWorkCount:selected.length,supportingSetCount:rowSetCount(selected),counterWorkCount:counter.length,readingBasis:local?'exact-set-local-choices':'positive-overall-choices',displayWorkIds:title==='Several readings, with and without a clear scene.'?[clearOpen[0].work.id,unclearOpen[0].work.id]:selected.slice(0,2).map(row=>row.work.id),
    alternatives:[...limits,'Scene clarity and number of possible readings are your own appraisals, not properties assigned by an algorithm. Their combination does not show why you liked a work.',...(local?['Some linked preferences are local comparison leaders. Their numerical positions are not pooled across sets as overall liking.']:[])]
  });
}
function returnReading(maps){
  const rows=uniqueRows(maps.flatMap(entry=>entry.round.works.map(work=>({entry,work,point:entry.answer.points[work.id]})))),comfort=rows.filter(row=>row.point[0]<=35&&row.point[1]>=65),tension=rows.filter(row=>row.point[0]>=65&&row.point[1]>=65);
  if(comfort.length<2||tension.length<2||rowSetCount([...comfort,...tension])<2)return null;
  const selected=[...comfort,...tension],counter=rows.filter(row=>row.point[1]<=35&&(row.point[0]<=35||row.point[0]>=65));
  return observation('return-range','tension-and-return','Comfort and tension both invite a return.',`${short(comfort[0].work)} felt comforting; ${short(tension[0].work)} felt unsettling. You wanted to return to both. Across ${rowSetCount(selected)} map sets, ${comfort.length} comforting and ${tension.length} unsettling works received a stronger wish to return.`,rowEvidence(selected),rowEvidence(counter),[comfort[0],tension[0],...counter.slice(0,1)].map((row,index)=>measureComparison({entry:row.entry,workIds:[row.work.id]},index>=2?'counter':'support')),
    {supportingWorkCount:selected.length,supportingSetCount:rowSetCount(selected),comfortWorkIds:comfort.map(row=>row.work.id),tensionWorkIds:tension.map(row=>row.work.id),counterWorkCount:counter.length,displayWorkIds:[comfort[0].work.id,tension[0].work.id],priority:12,alternatives:[...limits,'Wish to return is a reported intention on this map, not observed repeat viewing or an unconditional preference score.','The same tension end can include works you would and would not return to. The counterexamples retain those boundaries.']});
}

export function reportedGridMaps({works=[],rounds=[],answers={}}={}){
  return validatedProfileEntries({works,rounds,answers}).filter(entry=>entry.round.kind==='grid'&&Object.hasOwn(EXPECTED,entry.round.axis)).map(entry=>({
    id:'reported-map-'+entry.round.id,roundId:entry.round.id,axis:entry.round.axis,title:entry.round.title||axisDefinition(entry.round).xName+' / '+axisDefinition(entry.round).yName,
    axisDefinition:structuredClone(axisDefinition(entry.round)),axisSignature:JSON.stringify(axisDefinition(entry.round)),workIds:entry.round.works.map(work=>work.id),
    points:entry.round.works.map(work=>({workId:work.id,x:entry.answer.points[work.id][0],y:entry.answer.points[work.id][1]})),sourceRoundIds:[entry.round.id],
    scope:'Recorded coordinates on this original map. Repeated works are shown separately; different axis definitions and preference sets are not pooled.',interpretable:interpretable(entry)
  }));
}

export function buildResponsePortrait({works=[],rounds=[],answers={}}={}){
  const entries=validatedProfileEntries({works,rounds,answers}),basis=buildPreferenceBasis(entries),preferences=entries.filter(entry=>isUnconditionalPreference(entry.round)),maps=entries.filter(entry=>entry.round.kind==='grid'&&interpretable(entry));
  const byAxis=axis=>latestSets(maps.filter(entry=>entry.round.axis===axis)),making=makingReading(byAxis('achievement'),preferences),reading=readingReading(byAxis('reading'),preferences,basis),returnRange=returnReading(byAxis('returnResponse')),observations=[making,reading,returnRange].filter(Boolean);
  return {observations,reportedGridMaps:reportedGridMaps({works,rounds,answers}),themes:observations.map(item=>({id:item.id,title:item.id==='response-making'?'Taste & craft':item.id==='response-reading'?'Layered readings':'Comfort & tension',findingIds:[item.id],workIds:item.evidence,support:item.support,counter:item.counter,priority:item.priority,basis:item.readingBasis||'reported-response-pattern'})),coverage:{achievementSets:byAxis('achievement').length,readingSets:byAxis('reading').length,returnSets:byAxis('returnResponse').length,reportedMaps:maps.length},limits:[...limits]};
}
