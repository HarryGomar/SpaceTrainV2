// New response instruments only. Legacy coordinates never enter these readings.
const AXIS_DEFINITIONS={
  achievement:{construct:'perceived-achievement',xName:'Personal appeal',yName:'Admiration of making',left:'Not for me',right:'For me',bottom:'Little to admire',top:'Much to admire'},
  reading:{construct:'scene-and-meaning',xName:'Scene clarity',yName:'Interpretive openness',left:'Unclear scene',right:'Clear scene',bottom:'One reading',top:'Several readings'},
  returnResponse:{construct:'tension-and-return',xName:'Felt tension',yName:'Wish to return',left:'Comforting',right:'Unsettling',bottom:'Once is enough',top:'Would return'}
};
export const REFINED_READING_THRESHOLDS=Object.freeze({clearPreferenceGap:15,clearCoordinateGap:20,highCoordinate:65,maximumShortlist:3});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unique=values=>[...new Set(values)];
const numeric=value=>Number.isInteger(value)&&value>=0&&value<=100;
const ids=round=>round.works.map(work=>work.id);
const signature=round=>JSON.stringify([...ids(round)].sort());
const sameSet=(a,b)=>signature(a)===signature(b);
const exactKeys=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const short=work=>work.shortTitle||work.title;
const sourceRole=entry=>entry.round.evidence?.repeatOf?'repeated response':entry.round.evidence?.role==='probe'?'probe':entry.round.kind==='spectrum'?'unconditional preference':entry.round.kind==='choice-grid'?entry.round.selectionMode+' selection':'reported appraisal';
const scope='These are local relationships between recorded responses. Reused paintings and comparisons remain dependent evidence; no trait, causal motive or population rarity is inferred.';
const thresholdLimit='The 15-point preference gap, 20-point coordinate gap and 65-point high band are provisional design thresholds, not validated confidence estimates.';
const preferenceFamilies=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);

function validAxis(round){
  const expected=AXIS_DEFINITIONS[round.axis];
  if(!expected||round.evidence?.construct!==expected.construct)return false;
  if(round.axisDefinition!==undefined){
    if(!plain(round.axisDefinition))return false;
    for(const field of ['xName','yName','left','right','bottom','top'])if(round.axisDefinition[field]!==expected[field])return false;
  }
  return true;
}
function validChoice(round,answer){
  const selected=answer.selectedIds,mode=round.selectionMode;
  if(!['familiarity','shortlist'].includes(mode)||answer.selectionMode!==mode||!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.some(id=>!ids(round).includes(id))||typeof answer.explicitNone!=='boolean'||typeof answer.unsure!=='boolean')return false;
  if(mode==='shortlist'&&round.maxChoices!==undefined&&(!Number.isInteger(round.maxChoices)||round.maxChoices<1||round.maxChoices>round.works.length))return false;
  if(selected.length>(mode==='shortlist'?round.maxChoices||3:round.works.length))return false;
  if(selected.length)return !answer.explicitNone&&!answer.unsure;
  return answer.explicitNone&&!answer.unsure||mode==='familiarity'&&answer.unsure&&!answer.explicitNone;
}
function entriesFor(works,rounds,answers){
  const workCounts=new Map(),roundCounts=new Map();
  for(const work of works)if(typeof work?.id==='string')workCounts.set(work.id,(workCounts.get(work.id)||0)+1);
  for(const round of rounds)if(typeof round?.id==='string')roundCounts.set(round.id,(roundCounts.get(round.id)||0)+1);
  const byId=new Map(works.filter(work=>workCounts.get(work?.id)===1&&typeof work.title==='string'&&work.title).map(work=>[work.id,work]));
  return rounds.flatMap((original,index)=>{
    if(!original||typeof original.id!=='string'||!original.id||roundCounts.get(original.id)!==1||original.unavailable||!Array.isArray(original.works)||original.works.length<2)return [];
    const workIds=original.works.map(work=>work?.id);
    if(new Set(workIds).size!==workIds.length||workIds.some(id=>!byId.has(id)))return [];
    const answer=answers[original.id];
    if(!plain(answer)||answer.skipped||answer.confirmed!==true||!Array.isArray(answer.workIds)||answer.workIds.join('|')!==workIds.join('|'))return [];
    const round={...original,works:workIds.map(id=>byId.get(id))};
    if(round.kind==='grid'){
      if(!validAxis(round)||answer.axis!==round.axis||!exactKeys(answer.points,workIds)||workIds.some(id=>!Array.isArray(answer.points[id])||answer.points[id].length!==2||!answer.points[id].every(numeric)))return [];
    }else if(round.kind==='spectrum'){
      if(round.criterion!=='preference'||answer.criterion!=='preference'||round.evidence?.construct!=='preference'||round.evidence?.unconditional===false||round.evidence?.family&&!preferenceFamilies.has(round.evidence.family)||round.anchorWorks?.length||round.anchorIds?.length||!exactKeys(answer.positions,workIds)||workIds.some(id=>!numeric(answer.positions[id])))return [];
    }else if(round.kind==='choice-grid'){
      if(!validChoice(round,answer))return [];
    }else return [];
    return [{round,answer,index}];
  });
}
function pairs(entry){return entry.round.works.flatMap((a,i)=>entry.round.works.slice(i+1).map(b=>[a,b]));}
function distinct(items,key=item=>signature(item.entry.round)){
  const seen=new Set();return items.filter(item=>{const value=key(item);if(seen.has(value))return false;seen.add(value);return true;});
}
function ev(entry,detail,workIds,label){return {roundId:entry.round.id,label:label||entry.round.title||'Recorded comparison',detail,workIds:unique(workIds),role:entry.round.evidence?.role||'discovery',sourceRole:sourceRole(entry),construct:entry.round.evidence?.construct||entry.round.selectionMode};}
function finding(id,module,title,text,support,counter,comparisons,extra={}){
  return {id,module,title,text,kind:'taste',support,counter,alternatives:[scope,thresholdLimit],priority:10,evidence:unique([...support,...counter].flatMap(item=>item.workIds)),comparisons,...extra};
}
const pairIds=pair=>[pair.a.id,pair.b.id];
const mapEvidence=(pair,axisLabels)=>ev(pair.entry,axisLabels.map(([label,coordinate])=>pairIds(pair).map(id=>short(pair.entry.round.works.find(work=>work.id===id))+': '+label+' '+pair.entry.answer.points[id][coordinate]).join('; ')).join('. ')+'.',pairIds(pair));
const preferenceEvidence=pair=>ev(pair.preference,pairIds(pair).map(id=>short(pair.preference.round.works.find(work=>work.id===id))+': preference '+pair.preference.answer.positions[id]).join('; ')+'.',pairIds(pair));
function mapComparison(pair,measureDefinitions,role='support'){
  return {workIds:pairIds(pair),roundId:pair.entry.round.id,sourceRoundIds:[pair.entry.round.id],role,measures:measureDefinitions.map(([key,label,coordinate])=>({key,label,values:pairIds(pair).map(id=>pair.entry.answer.points[id][coordinate])}))};
}
function preferenceFor(entry,preferences){return preferences.filter(preference=>preference.index<entry.index&&sameSet(preference.round,entry.round)).at(-1);}
function directedPreferencePairs(preference,entry){return pairs(preference).flatMap(([left,right])=>{
  const gap=preference.answer.positions[left.id]-preference.answer.positions[right.id];
  return Math.abs(gap)>=15?[{entry,preference,a:gap>0?left:right,b:gap>0?right:left,preferenceGap:Math.abs(gap)}]:[];
});}

function achievementReading(entries,preferences){
  const maps=entries.filter(entry=>entry.round.axis==='achievement');
  const matched=maps.flatMap(entry=>{
    const preference=preferenceFor(entry,preferences);if(!preference)return [];
    return directedPreferencePairs(preference,entry).flatMap(pair=>{const admirationGap=entry.answer.points[pair.a.id][1]-entry.answer.points[pair.b.id][1];return Math.abs(admirationGap)>=20?[{...pair,admirationGap,strength:pair.preferenceGap+Math.abs(admirationGap)}]:[];});
  });
  const gridOnly=maps.flatMap(entry=>pairs(entry).flatMap(([left,right])=>{
    const gap=entry.answer.points[left.id][0]-entry.answer.points[right.id][0];if(Math.abs(gap)<15)return [];
    const a=gap>0?left:right,b=gap>0?right:left,admirationGap=entry.answer.points[a.id][1]-entry.answer.points[b.id][1];
    return Math.abs(admirationGap)>=20?[{entry,a,b,admirationGap,strength:Math.abs(gap)+Math.abs(admirationGap)}]:[];
  }));
  const linked=matched.some(pair=>pair.admirationGap<=-20),candidates=(linked?matched:gridOnly).sort((a,b)=>b.strength-a.strength||a.entry.index-b.entry.index);
  const support=distinct(candidates.filter(pair=>pair.admirationGap<=-20)),counter=distinct(candidates.filter(pair=>pair.admirationGap>=20));
  if(!support.length)return null;
  const pair=support[0],selected=support.slice(0,3),opposing=counter.slice(0,2),labels=[['personal appeal',0],['admiration of making',1]];
  const evidence=item=>[...(linked?[preferenceEvidence(item)]:[]),mapEvidence(item,labels)];
  const comparison=(item,role='support')=>({...mapComparison(item,linked?[['admiration','Admiration of making',1]]:[['appeal','Personal appeal',0],['admiration','Admiration of making',1]],role),...(linked?{preferenceRoundId:item.preference.round.id,sourceRoundIds:[item.preference.round.id,item.entry.round.id],measures:[{key:'preference',label:'Earlier preference',values:pairIds(item).map(id=>item.preference.answer.positions[id])},{key:'admiration',label:'Admiration of making',values:pairIds(item).map(id=>item.entry.answer.points[id][1])}]}:{})});
  return finding('refined-achievement','making-and-taste',linked?'You admired paintings you preferred less.':'Your taste and admiration differed.',`${linked?'You preferred '+short(pair.a)+' to '+short(pair.b)+'. ':short(pair.a)+' was more for you, while '}${short(pair.b)} received more admiration for its making.${support.length>1?' This split appeared in '+support.length+' distinct artwork sets.':' This is a local comparison within one artwork set.'}${counter.length?' Other recorded comparisons aligned '+(linked?'preference':'appeal')+' and admiration.':''}`,selected.flatMap(evidence),opposing.flatMap(evidence),[...selected.map(item=>comparison(item)),...opposing.slice(0,1).map(item=>comparison(item,'counter'))],{
    readingBasis:linked?'matched-preference':'grid-only',supportingSetCount:support.length,counterSetCount:counter.length,sourceUrls:['https://journals.sagepub.com/doi/10.1177/0956797611400915','https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for'],
    alternatives:[scope,thresholdLimit,'Personal appeal is the coordinate on this appraisal grid. It is not added as an unconditional preference answer.',linked?'The preference question preceded the map and offered the exact same artwork set. The two decisions are linked by artwork identity, not by substituting appeal for preference.':'This finding compares two coordinates from one appraisal instrument. No separate preference choice supports it.','Admiration is a reported judgment, not objective skill, effort, quality or value. Several features and associations can explain the split.','A work set contributes at most once to each count. Different pairs or later maps of that same set can supply counterevidence.']
  });
}

function sceneReading(entries,preferences){
  const candidates=entries.filter(entry=>entry.round.axis==='reading').flatMap(entry=>{
    const preference=preferenceFor(entry,preferences);if(!preference)return [];
    return directedPreferencePairs(preference,entry).map(pair=>{
      const a=entry.answer.points[pair.a.id],b=entry.answer.points[pair.b.id],clarityGap=a[0]-b[0],opennessGap=a[1]-b[1];
      const mode=opennessGap>=20&&a[0]>=65&&b[0]>=65&&Math.abs(clarityGap)<20?'open-clear':opennessGap>=20&&clarityGap<=-20?'open-less-clear':clarityGap>=20&&opennessGap<=-20?'clear-less-open':null;
      return {...pair,clarityGap,opennessGap,mode,strength:pair.preferenceGap+Math.abs(clarityGap)+Math.abs(opennessGap)};
    });
  }).sort((a,b)=>b.strength-a.strength||a.entry.index-b.entry.index);
  const modes=['open-clear','open-less-clear','clear-less-open'].map(mode=>({mode,support:distinct(candidates.filter(pair=>pair.mode===mode))})).filter(item=>item.support.length).sort((a,b)=>b.support.length-a.support.length||b.support[0].strength-a.support[0].strength);
  if(!modes.length)return null;
  const {mode,support}=modes[0],pair=support[0],counter=distinct(candidates.filter(item=>mode==='clear-less-open'?item.clarityGap<=-20:item.opennessGap<=-20));
  const title=mode==='open-clear'?'A clear scene can leave meaning open.':mode==='open-less-clear'?'A less clear scene could still be preferred.':'A clearer scene, fewer possible readings.';
  const detail=mode==='open-clear'?`You placed both scenes toward clear, while ${short(pair.a)} left more possible readings open.`:mode==='open-less-clear'?`${short(pair.b)} was clearer to you, while ${short(pair.a)} left more possible readings open.`:`You placed ${short(pair.a)} as clearer but with fewer possible readings than ${short(pair.b)}.`;
  const selected=support.slice(0,3),opposing=counter.slice(0,2),labels=[['scene clarity',0],['interpretive openness',1]];
  const evidence=item=>[preferenceEvidence(item),mapEvidence(item,labels)];
  const comparison=(item,role='support')=>({...mapComparison(item,[['clarity','Scene clarity',0],['openness','Interpretive openness',1]],role),preferenceRoundId:item.preference.round.id,sourceRoundIds:[item.preference.round.id,item.entry.round.id],measures:[{key:'preference',label:'Unconditional preference',values:pairIds(item).map(id=>item.preference.answer.positions[id])},...mapComparison(item,[['clarity','Scene clarity',0],['openness','Interpretive openness',1]]).measures]});
  return finding('refined-reading','scene-and-meaning',title,`You preferred ${short(pair.a)} to ${short(pair.b)}. ${detail}${support.length>1?' This relationship appeared in '+support.length+' distinct artwork sets.':' The link is local to this matched artwork set.'}${counter.length?' Other comparisons went against this direction.':''}`,selected.flatMap(evidence),opposing.flatMap(evidence),[...selected.map(item=>comparison(item)),...opposing.slice(0,1).map(item=>comparison(item,'counter'))],{
    patternVariant:mode,supportingSetCount:support.length,counterSetCount:counter.length,sourceUrls:['https://pmc.ncbi.nlm.nih.gov/articles/PMC3210939/','https://link.springer.com/article/10.3758/s13428-026-03107-9'],
    alternatives:[scope,thresholdLimit,'The preference and scene/meaning appraisal concern the exact same offered set. Their response order and repeated viewing can influence the link.','These are reported scene clarity and possible meanings. Neither tests a correct interpretation or measures intelligence or a tolerance-for-ambiguity trait.','The comparison does not isolate clarity or openness as the cause of preference. A changed pair with similar subjects would test the explanation.','Repeated maps of the same paintings do not supply additional distinct sets.']
  });
}

function returnReading(entries,preferences){
  const candidates=entries.filter(entry=>entry.round.axis==='returnResponse').flatMap(entry=>pairs(entry).flatMap(([left,right])=>{
    const returnGap=entry.answer.points[left.id][1]-entry.answer.points[right.id][1];if(Math.abs(returnGap)<20)return [];
    const a=returnGap>0?left:right,b=returnGap>0?right:left,ap=entry.answer.points[a.id],bp=entry.answer.points[b.id];
    return [{entry,a,b,tensionGap:ap[0]-bp[0],highReturn:ap[1]>=65,highTension:ap[0]>=65,preference:preferenceFor(entry,preferences),strength:Math.abs(returnGap)+Math.abs(ap[0]-bp[0])}];
  })).sort((a,b)=>b.strength-a.strength||a.entry.index-b.entry.index);
  const support=distinct(candidates.filter(pair=>pair.highReturn&&pair.highTension&&pair.tensionGap>=20)),counter=distinct(candidates.filter(pair=>pair.tensionGap<=-20));
  if(!support.length)return null;
  const hasPreferenceSplit=pair=>pair.preference&&pair.preference.answer.positions[pair.b.id]-pair.preference.answer.positions[pair.a.id]>=15;
  const pair=support.find(hasPreferenceSplit)||support[0],selected=[pair,...support.filter(item=>item!==pair)].slice(0,3),opposing=counter.slice(0,2),labels=[['felt tension',0],['wish to return',1]],split=hasPreferenceSplit(pair);
  const evidence=item=>[...(item.preference?[preferenceEvidence(item)]:[]),mapEvidence(item,labels)];
  const comparison=(item,role='support')=>({...mapComparison(item,[['tension','Felt tension',0],['return','Wish to return',1]],role),...(item.preference?{preferenceRoundId:item.preference.round.id,sourceRoundIds:[item.preference.round.id,item.entry.round.id]}:{}),measures:[...(item.preference?[{key:'preference',label:'Unconditional preference',values:pairIds(item).map(id=>item.preference.answer.positions[id])}]:[]),...mapComparison(item,[['tension','Felt tension',0],['return','Wish to return',1]]).measures]});
  return finding('refined-return','tension-and-return',split?'You wanted to revisit paintings you preferred less.':'You wanted to return to unsettling work.',`${split?'You preferred '+short(pair.b)+', but reported a stronger wish to return to '+short(pair.a)+'.':short(pair.a)+' received a stronger wish to return than '+short(pair.b)+'.'} You also placed ${short(pair.a)} as more unsettling.${support.length>1?' That combination appeared in '+support.length+' distinct artwork sets.':' This is an intention reported in one matched set.'}${counter.length?' Other comparisons favoured returning to the more comforting work.':''}`,selected.flatMap(evidence),opposing.flatMap(evidence),[...selected.map(item=>comparison(item)),...opposing.slice(0,1).map(item=>comparison(item,'counter'))],{
    supportingSetCount:support.length,counterSetCount:counter.length,sourceUrls:['https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0178899'],
    alternatives:[scope,thresholdLimit,'Wish to return is a stated intention. No return visit, dwell time or future behaviour has been observed.','Comforting/unsettling is this instrument\'s felt-tension coordinate. It is not substituted for old pleasantness, activation or involvement axes.','Subject, familiarity and personal associations may contribute. This does not imply a general attraction to discomfort.','A work set contributes once even if it is mapped again; retained and opposing pair relationships remain dependent evidence.']
  });
}

function familiarityReading(entries){
  const comparisons=distinct(entries.filter(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='shortlist'&&entry.answer.selectedIds.length).flatMap(entry=>{
    const source=entry.round.evidence?.familiarityRoundId,familiarity=entries.find(other=>other.round.id===source&&other.index<entry.index&&other.round.kind==='choice-grid'&&other.round.selectionMode==='familiarity'&&sameSet(other.round,entry.round));
    if(!familiarity||familiarity.answer.unsure)return [];
    const selected=[...entry.answer.selectedIds],marked=new Set(familiarity.answer.selectedIds),markedSelected=selected.filter(id=>marked.has(id)),unmarkedSelected=selected.filter(id=>!marked.has(id));
    return [{entry,familiarity,selected,markedSelected,unmarkedSelected,offeredMarked:ids(entry.round).filter(id=>marked.has(id)),offeredUnmarked:ids(entry.round).filter(id=>!marked.has(id))}];
  }));
  if(!comparisons.length)return null;
  const sample=comparisons[0],selected=comparisons.slice(0,3),number=sample.selected.length;
  const text=`Of the ${number} painting${number===1?'':'s'} you kept from this ${sample.entry.round.works.length}-work grid, ${sample.unmarkedSelected.length} ${sample.unmarkedSelected.length===1?'was':'were'} not marked familiar before today and ${sample.markedSelected.length} ${sample.markedSelected.length===1?'was':'were'} marked familiar.${comparisons.length>1?' Matched records are available for '+comparisons.length+' distinct offered sets.':''} This records the overlap between familiarity and your shortlist.`;
  const support=selected.flatMap(item=>[
    ev(item.familiarity,'Marked familiar: '+(item.offeredMarked.map(id=>short(item.familiarity.round.works.find(work=>work.id===id))).join('; ')||'none explicitly')+'. Not marked familiar: '+item.offeredUnmarked.length+'.',ids(item.familiarity.round),'Earlier familiarity selection'),
    ev(item.entry,'Kept: '+item.selected.map(id=>short(item.entry.round.works.find(work=>work.id===id))).join('; ')+'. '+item.unmarkedSelected.length+' not marked familiar; '+item.markedSelected.length+' marked familiar. Capacity '+(item.entry.round.maxChoices||3)+'.',item.selected,'Later shortlist')
  ]);
  return finding('refined-familiarity','familiarity-shortlist','Familiarity and your shortlist.',text,support,[],selected.map(item=>({kind:'matched-selection',workIds:item.selected,sourceRoundIds:[item.familiarity.round.id,item.entry.round.id],familiarityRoundId:item.familiarity.round.id,shortlistRoundId:item.entry.round.id,offeredWorkIds:ids(item.entry.round),selectedWorkIds:item.selected,markedFamiliarIds:item.offeredMarked,notMarkedFamiliarIds:item.offeredUnmarked,selectedMarkedFamiliarIds:item.markedSelected,selectedNotMarkedFamiliarIds:item.unmarkedSelected,capacity:item.entry.round.maxChoices||3,measures:[]})),{
    supportingSetCount:comparisons.length,counterSetCount:0,priority:7,sourceUrls:['https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full'],
    alternatives:[scope,'Not marked familiar describes the confirmed earlier grid response. It is not proof that a work was never seen, and recognition is not expertise.','Selections retain the limit of their original question. New grids allow any number; earlier grids can be capped at three. Unselected works are not disliked, equally ranked or converted to preference numbers.','The offered mix, fame, subject, reproduction, position and repeated viewing can affect selection. This does not establish that familiarity caused a choice or a novelty-seeking trait.','Repeated copies of the same offered set do not add distinct-set support. An unsure familiarity answer suppresses this reading.']
  });
}

/** Descriptive readings for explicitly versioned new instruments, without mutation. */
export function buildRefinedReadings({works=[],rounds=[],answers={}}={}){
  if(!Array.isArray(works)||!Array.isArray(rounds)||!plain(answers))return [];
  const entries=entriesFor(works,rounds,answers),preferences=entries.filter(entry=>entry.round.kind==='spectrum');
  return [achievementReading(entries,preferences),sceneReading(entries,preferences),returnReading(entries,preferences),familiarityReading(entries)].filter(Boolean).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
}
