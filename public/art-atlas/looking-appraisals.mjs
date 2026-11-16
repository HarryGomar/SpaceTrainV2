import {hasComparisonMarker} from './profile-evidence.mjs';
import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {validAnswer} from './engine.mjs';
import {isComparisonPreferenceRound,responseGapRequired} from './comparison-protocol.mjs';
const orderOnly=round=>isComparisonPreferenceRound(round)&&!isContinuousPreferenceRound(round);

export const LOOKING_APPRAISAL_VERSION=2;
export const LOOKING_APPRAISAL_THRESHOLDS=Object.freeze({preferenceGap:15,appraisalGap:20,minimumRecurringSets:2,minimumDensitySupportSets:3,minimumDensityArtists:4});
const definitions={
  'perceived-visual-density':{label:'Visual density',title:'How much is there to take in?',hint:'Rate the amount of visual detail in each painting. This is separate from how much you like it.',left:'Visually sparse',right:'Visually dense',higher:'more visual detail',higherNote:'You found more visual detail here',positiveTitle:'Visual detail and preference aligned.',negativeTitle:'More detail did not mean more preferred.'},
  'interpretive-openness':{label:'Interpretive openness',title:'How much does each painting leave open?',hint:'Place each painting by how many possible meanings it seems to leave you. An unclear subject can still feel settled in meaning.',left:'One clear reading',right:'Several possible readings',higher:'more possible readings',higherNote:'You found more possible readings here',positiveTitle:'Possible readings and preference aligned.',negativeTitle:'More possible readings did not mean more preferred.'},
  'importance-of-figures':{label:'Importance of people',title:'How important are the people in each painting to your reaction?',hint:'Think about the people in the painting, rather than how many there are. If there are no people, use the left end.',left:'Not important',right:'Very important',higher:'greater importance of the people',higherNote:'The people mattered more to your reaction here',positiveTitle:'Importance of people and preference aligned.',negativeTitle:'The people mattered more in a work you preferred less.'},
  'reported-unexpectedness':{label:'Unexpectedness',title:'How unexpected is each painting?',hint:'Place each painting by how surprising it is to you. This is separate from whether you prefer it.',left:'As expected',right:'Unexpected',higher:'greater unexpectedness',higherNote:'You found this more unexpected',positiveTitle:'Unexpectedness and preference aligned.',negativeTitle:'Unexpectedness and preference differed.'},
  'attention-to-making':{label:'Attention to making',title:'How much are you looking at how it was made?',hint:'Think about paint, marks, lines and composition. Rate your attention to the making of each work.',left:'Little attention to its making',right:'A lot of attention to its making',higher:'more attention to its making',higherNote:'You paid more attention to the making here',positiveTitle:'Attention to making and preference aligned.',negativeTitle:'Attention to making did not follow preference.'}
};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const named=value=>typeof value==='string'&&value.trim().length>0;
const numeric=value=>Number.isInteger(value)&&value>=0&&value<=100;
const unique=values=>[...new Set(values)];
const short=work=>work.shortTitle||work.title;
const setKey=ids=>JSON.stringify([...ids].sort());
const family=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const limits=['These are reports under the original appraisal question, not unconditional preference, objective artwork measurements or a personality score.','Within-set comparisons retain the exact paintings, question, scale and source responses. Different preference sets are not calibrated or pooled as absolute ratings.','A reported appraisal beside preference does not identify what caused the preference. Repetition, labels, context and several artwork properties may contribute.'];
function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+Array.from(value,item=>canonical(item)).join(',')+']';
  if(!plain(value))throw Error('Invalid frozen definition');return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
function validEntries(works,rounds,answers){
  const workCounts=new Map(),roundCounts=new Map();for(const work of works)if(named(work?.id))workCounts.set(work.id,(workCounts.get(work.id)||0)+1);for(const round of rounds)if(named(round?.id))roundCounts.set(round.id,(roundCounts.get(round.id)||0)+1);
  const byId=new Map(works.filter(work=>plain(work)&&workCounts.get(work.id)===1).map(work=>[work.id,work])),entries=[],excluded=[];
  for(const [index,raw] of rounds.entries()){
    if(!plain(raw)||raw.kind!=='spectrum')continue;const isAppraisal=raw.evidence?.family==='looking-appraisal'&&Object.hasOwn(definitions,raw.evidence?.construct),fail=reason=>{if(isAppraisal)excluded.push({roundId:raw.id||null,reason});};
    if(!named(raw.id)||roundCounts.get(raw.id)!==1||raw.unavailable){fail('unavailable-or-ambiguous-round');continue;}
    const ids=Array.isArray(raw.works)?Array.from(raw.works,work=>work?.id):raw.workIds;
    if(!Array.isArray(ids)||ids.length<2||ids.length>4||!Array.from(ids).every(named)||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id))||Array.isArray(raw.works)&&Object.hasOwn(raw,'workIds')&&(!Array.isArray(raw.workIds)||raw.workIds.join('|')!==ids.join('|'))){fail('unknown-or-conflicting-artwork-identities');continue;}
    const answer=answers[raw.id],round={...raw,works:ids.map(id=>byId.get(id))};
    if(!plain(answer)||!plain(answer.positions)||Object.keys(answer.positions).length!==ids.length||ids.some(id=>!numeric(answer.positions[id]))||Object.hasOwn(answer,'roundId')&&answer.roundId!==raw.id){fail('missing-or-incomplete-response');continue;}
    let valid=false;try{valid=validAnswer(round,answer);}catch{}if(!valid){fail('invalid-or-unconfirmed-response');continue;}
    entries.push({round,answer,index,ids:[...ids],isAppraisal});
  }
  return {entries,excluded};
}
const unconditional=entry=>entry.round.criterion==='preference'&&entry.round.evidence?.construct==='preference'&&(!hasComparisonMarker(entry.round)||isComparisonPreferenceRound(entry.round))&&family.has(entry.round.evidence?.family)&&entry.round.evidence?.unconditional!==false&&!entry.round.brief&&!entry.round.evidence?.brief&&!entry.round.anchorWorks?.length&&!entry.round.anchorIds?.length&&!entry.round.contextMode&&typeof entry.round.title==='string'&&typeof entry.round.hint==='string'&&(!Object.hasOwn(entry.round,'scale')||plain(entry.round.scale)&&named(entry.round.scale.left)&&named(entry.round.scale.right));
function question(entry){const r=entry.round;return {roundId:r.id,title:r.title,hint:r.hint,criterion:r.criterion,construct:r.evidence?.construct||null,scale:structuredClone(r.scale||null),sourceRole:r.evidence?.role||'unknown'};}
function appraisalResponse(entry){
  const r=entry.round,d=definitions[r.evidence.construct];if(r.criterion!=='preference'||!named(r.title)||typeof r.hint!=='string'||!plain(r.scale)||!named(r.scale.left)||!named(r.scale.right)||r.scale.left===r.scale.right)return null;
  let signature;try{signature=canonical({construct:r.evidence.construct,title:r.title,hint:r.hint,criterion:r.criterion,scale:r.scale,instrumentRevision:r.evidence.instrumentRevision||null});if(Object.hasOwn(entry.answer,'scale')&&canonical(entry.answer.scale)!==canonical(r.scale))return null;}catch{return null;}
  const recognised=r.title===d.title&&r.hint===d.hint&&r.scale.left===d.left&&r.scale.right===d.right;
  return {id:'looking-'+r.id,roundId:r.id,roundTitle:r.title,construct:r.evidence.construct,label:recognised?d.label:r.title,recognizedMeaning:recognised,signature,questionDefinition:question(entry),domain:[0,100],workIds:[...entry.ids],points:entry.ids.map(workId=>({workId,value:entry.answer.positions[workId],roundId:r.id})),sourceRoundIds:[r.id],sourceRole:r.evidence.role||'check',limits:[...limits,...(Array.isArray(r.evidence.limits)?r.evidence.limits.filter(named):[])]};
}
function mapPanel(appraisal,preference,response){
  const x=question(preference),y=question(appraisal),roundNumber=/^journey-(\d+)$/.exec(appraisal.round.id),axisDefinition={xName:orderOnly(preference.round)?'Preference order':isContinuousPreferenceRound(preference.round)?'Personal appeal':'Preference',yName:response.label,left:x.scale?.left||'Less preferred',right:x.scale?.right||'More preferred',bottom:y.scale.left,top:y.scale.right};
  return {id:'appraisal-'+appraisal.round.id+'-preference-'+preference.round.id,kind:'matched-preference-appraisal',title:'Preference and '+response.label.toLowerCase()+(roundNumber?' · Round '+Number(roundNumber[1]):''),axisId:'appraisal-'+response.construct,axisDefinition,signature:canonical({x,y,workIds:[...appraisal.ids].sort()}),definitionSource:'two-frozen-spectrum-questions',domain:[0,100],coordinates:{x:'left-to-right',y:'bottom-to-top'},construct:response.construct,workIds:[...appraisal.ids],sourceRoundIds:[preference.round.id,appraisal.round.id],questionDefinitions:[x,y],preferenceRoundId:preference.round.id,appraisalRoundId:appraisal.round.id,points:appraisal.ids.map(workId=>({id:preference.round.id+':'+appraisal.round.id+':'+workId,workId,x:preference.answer.positions[workId],y:appraisal.answer.positions[workId],roundId:appraisal.round.id,roundTitle:appraisal.round.title,sourceRole:appraisal.round.evidence.role||'check',sourceRoundIds:[preference.round.id,appraisal.round.id],preferenceRoundId:preference.round.id,appraisalRoundId:appraisal.round.id})),limits:[...limits,'One exact artwork set supplies each panel. Different sets and repeats are separate panels; no coordinates are averaged.']};
}
function pairedComparisons(appraisal,preference){
  return preference.round.works.flatMap((left,index)=>preference.round.works.slice(index+1).map(right=>{
    const prefGap=preference.answer.positions[left.id]-preference.answer.positions[right.id],a=prefGap>=0?left:right,b=prefGap>=0?right:left,appraisalGap=appraisal.answer.positions[a.id]-appraisal.answer.positions[b.id],preferenceGap=Math.abs(prefGap),ordinal=orderOnly(preference.round),status=preferenceGap<responseGapRequired(preference.round)?ordinal?'preference-tie':'preference-near-tie':Math.abs(appraisalGap)<20?'appraisal-near-tie':appraisalGap>0?'aligned':'opposed';
    return {a,b,workIds:[a.id,b.id],preferenceGap,ordinal,appraisalGap,status,appraisal,preference};
  }));
}
function evidence(entry,workIds,label){return {roundId:entry.round.id,label,detail:workIds.map(id=>short(entry.round.works.find(work=>work.id===id))+': '+entry.answer.positions[id]).join('; ')+'.',workIds:[...workIds],sourceRole:entry.round.evidence?.role||'unknown',construct:entry.round.evidence?.construct};}
function comparison(pair,response,role){return {workIds:[...pair.workIds],preferenceRoundId:pair.preference.round.id,appraisalRoundId:pair.appraisal.round.id,sourceRoundIds:[pair.preference.round.id,pair.appraisal.round.id],role,appraisalHigherNote:definitions[response.construct].higherNote,measures:[{key:'preference',label:'Earlier preference',values:pair.workIds.map(id=>pair.preference.answer.positions[id])},{key:'reported-appraisal',label:response.label,values:pair.workIds.map(id=>pair.appraisal.answer.positions[id]),scale:structuredClone(response.questionDefinition.scale)}]};}
function densitySupport(sets){
  const artists=group=>unique(group.flatMap(set=>set.preference.round.works).filter(work=>work.artistKnown!==false&&named(work.artist)&&!/unknown|unidentified|anonymous/i.test(work.artist)).map(work=>work.artist.trim().toLowerCase()));
  // Three different set IDs do not supply three non-overlapping examples.
  // Check the actual frozen artwork identities; retain all other sets as raw evidence.
  for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){
    if(sets[i].appraisal.ids.some(id=>sets[j].appraisal.ids.includes(id)))continue;
    for(let k=j+1;k<sets.length;k++){
      const group=[sets[i],sets[j],sets[k]],ids=group.flatMap(set=>set.appraisal.ids);
      if(new Set(ids).size!==ids.length)continue;
      const artistCount=artists(group).length;
      if(artistCount>=LOOKING_APPRAISAL_THRESHOLDS.minimumDensityArtists)return {sets:group,artistCount};
    }
  }
  return {sets:[],artistCount:0};
}
function observationsFor(matches){
  const instruments=new Map();for(const match of matches.filter(match=>match.response.recognizedMeaning)){const key=match.response.signature+'|'+(orderOnly(match.preference.round)?'ordinal':match.preference.round.evidence?.continuousProtocol||match.preference.round.evidence?.appealProtocol||'legacy'),list=instruments.get(key)||[];list.push(match);instruments.set(key,list);}
  const findings=[];
  for(const [signature,all] of instruments){
    // A later report of the same exact set remains available but never creates a new support set.
    const distinct=[...new Map(all.map(match=>[setKey(match.appraisal.ids),match])).values()],sets=distinct.map(match=>{const comparisons=pairedComparisons(match.appraisal,match.preference),aligned=comparisons.filter(pair=>pair.status==='aligned'),opposed=comparisons.filter(pair=>pair.status==='opposed');return {...match,comparisons,aligned,opposed,status:aligned.length>opposed.length?'aligned':opposed.length>aligned.length?'opposed':aligned.length?'mixed':'unassessed'};}),assessed=sets.filter(set=>set.status!=='unassessed'),alignedSets=sets.filter(set=>set.status==='aligned'),opposedSets=sets.filter(set=>set.status==='opposed'),direction=opposedSets.length>alignedSets.length?-1:1,recurring=(direction>0?alignedSets:opposedSets).length>=2&&(direction>0?alignedSets:opposedSets).length>(direction>0?opposedSets:alignedSets).length;
    const strength=pair=>(pair.ordinal?0:pair.preferenceGap)+Math.abs(pair.appraisalGap),local=all.flatMap(match=>pairedComparisons(match.appraisal,match.preference).filter(pair=>pair.status==='opposed').map(pair=>({...pair,response:match.response}))).sort((a,b)=>strength(b)-strength(a));
    if(!recurring&&!local.length)continue;
    const response=all[0].response,d=definitions[response.construct],positive=recurring&&direction>0,isDensity=response.construct==='perceived-visual-density',qualified=isDensity?densitySupport(sets.filter(set=>set.status===(positive?'aligned':'opposed'))):null;
    if(isDensity&&(!recurring||qualified.sets.length<LOOKING_APPRAISAL_THRESHOLDS.minimumDensitySupportSets))continue;
    const strongest=pairs=>[...pairs].sort((a,b)=>strength(b)-strength(a)),supporting=recurring?(qualified?.sets||sets.filter(set=>set.status===(positive?'aligned':'opposed'))).flatMap(set=>strongest(positive?set.aligned:set.opposed).slice(0,1)).slice(0,3):local.slice(0,1),counterSets=sets.flatMap(set=>strongest(positive?set.opposed:set.aligned).slice(0,1)),counterKeys=new Set(counterSets.map(pair=>pair.appraisal.round.id+'|'+pair.workIds.join('|'))),counter=[...counterSets,...strongest(sets.flatMap(set=>positive?set.opposed:set.aligned)).filter(pair=>!counterKeys.has(pair.appraisal.round.id+'|'+pair.workIds.join('|')))],lead=supporting[0];if(!lead)continue;
    const supportDirection=positive?'aligned':'opposed',supportSetCount=sets.filter(set=>set.status===supportDirection).length,counterSetCount=sets.filter(set=>set.status===(positive?'opposed':'aligned')).length,setsWithCounters=sets.filter(set=>(positive?set.opposed:set.aligned).length).length;
    const text=recurring?`${isDensity?'Across '+qualified.sets.length+' non-overlapping artwork sets':'In '+supportSetCount+' of '+assessed.length+' distinct artwork sets'}, ${d.higher} accompanied ${positive?'higher':'lower'} preference overall.${counterSetCount?' '+counterSetCount+' set'+(counterSetCount===1?' went':'s went')+' the other way.':''}${setsWithCounters?' '+setsWithCounters+' set'+(setsWithCounters===1?' also contained':'s also contained')+' comparisons going the other way.':''}`:`You preferred ${short(lead.a)}. You reported ${d.higher} in ${short(lead.b)}. These are two responses about the same offered set.`;
    const pairEvidence=pair=>[evidence(pair.preference,pair.workIds,'Earlier preference'),evidence(pair.appraisal,pair.workIds,response.questionDefinition.title)];
    findings.push({id:'looking-'+response.construct+'-'+all[0].appraisal.round.id,module:'looking-appraisals',kind:'taste',construct:response.construct,title:positive?d.positiveTitle:d.negativeTitle,text,priority:recurring?10:9,patternScope:recurring?'recurring-within-instrument':'one-set-relationship',appraisalDefinition:structuredClone(response.questionDefinition),definitionSignature:signature,support:supporting.flatMap(pairEvidence),counter:counter.slice(0,3).flatMap(pairEvidence),comparisons:[...supporting.map(pair=>comparison(pair,response,'support')),...counter.slice(0,1).map(pair=>comparison(pair,response,'counter'))],evidence:unique([...supporting,...counter.slice(0,3)].flatMap(pair=>pair.workIds)),evidenceBalance:{distinctSets:sets.length,assessedSets:assessed.length,alignedSets:alignedSets.length,opposedSets:opposedSets.length,mixedSets:sets.filter(set=>set.status==='mixed').length,setsWithCounterPairs:setsWithCounters,...(qualified?{nonOverlappingSupportSets:qualified.sets.length,supportArtistCount:qualified.artistCount}:{}),sets:sets.map(set=>({workIds:[...set.appraisal.ids],preferenceRoundId:set.preference.round.id,appraisalRoundId:set.appraisal.round.id,status:set.status,alignedPairs:set.aligned.map(pair=>[...pair.workIds]),opposedPairs:set.opposed.map(pair=>[...pair.workIds])}))},alternatives:[...limits,'Continuous personal-appeal questions retain their recorded levels and gaps. Earlier order-only comparisons use exact ties; older rating instruments retain their original 15-point display rule. Appraisal contrasts use 20 points. These reporting rules are not confidence estimates.','Distinct offered sets may share paintings. Pair observations inside a set are dependent. Opposing pairs remain evidence even inside a set that leans the other way overall.',...(isDensity?['A density headline requires three non-overlapping supporting sets and at least four named artists. This is a conservative display rule, not statistical independence, a causal test or a calibrated evidence threshold.']:[])]});
  }
  return findings.sort((a,b)=>b.priority-a.priority||b.evidenceBalance.distinctSets-a.evidenceBalance.distinctSets).slice(0,2);
}

export function buildLookingAppraisals({works=[],rounds=[],answers={}}={}){
  works=Array.isArray(works)?works:[];rounds=Array.isArray(rounds)?rounds:[];answers=plain(answers)?answers:{};const {entries,excluded}=validEntries(works,rounds,answers),preferences=entries.filter(unconditional),responses=[],panels=[],matches=[];
  for(const entry of entries.filter(entry=>entry.isAppraisal)){const response=appraisalResponse(entry);if(!response){excluded.push({roundId:entry.round.id,reason:'missing-or-conflicting-frozen-scale'});continue;}const preference=preferences.filter(pref=>pref.index<entry.index&&setKey(pref.ids)===setKey(entry.ids)).at(-1);responses.push(response);if(preference){response.preferenceRoundId=preference.round.id;panels.push(mapPanel(entry,preference,response));matches.push({appraisal:entry,preference,response});}}
  return {version:LOOKING_APPRAISAL_VERSION,responses,panels,observations:observationsFor(matches),coverage:{validResponses:responses.length,matchedResponses:panels.length,unmatchedRoundIds:responses.filter(response=>!response.preferenceRoundId).map(response=>response.roundId),distinctAppraisalSets:new Set(responses.map(response=>response.signature+'|'+setKey(response.workIds))).size,constructs:unique(responses.map(response=>response.construct)),excluded},limits:[...limits]};
}
