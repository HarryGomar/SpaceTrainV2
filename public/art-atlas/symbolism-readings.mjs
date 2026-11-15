import {validAnswer} from './engine.mjs';
import {isSymbolismRound,validSymbolismAnswer,symbolismResult} from './symbolism-rounds.mjs';

const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const named=value=>typeof value==='string'&&value.trim().length>0;
const unique=values=>[...new Set(values)];
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const short=work=>work.shortTitle||work.title;
const families=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const count=(number,singular,plural=singular+'s')=>number+' '+(number===1?singular:plural);
const steps=number=>count(Math.abs(number),'step');
const scope=[
  'These are observed changes on the same five-point appeal scale. The steps are ordered response categories, not equal units of feeling.',
  'Reading the note, seeing the painting again, elapsed time and the questions occur together. The note alone cannot be identified as the cause.',
  'Each painting contributes once to the cross-work count. Returns to the same painting remain visible but do not add independent replications.'
];

function entriesFor(works,rounds,answers){
  const workCounts=new Map(),roundCounts=new Map();
  for(const work of works)if(named(work?.id))workCounts.set(work.id,(workCounts.get(work.id)||0)+1);
  for(const round of rounds)if(named(round?.id))roundCounts.set(round.id,(roundCounts.get(round.id)||0)+1);
  const byId=new Map(works.filter(work=>workCounts.get(work?.id)===1&&named(work.title)).map(work=>[work.id,work]));
  const entries=[],excluded=[];
  rounds.forEach((raw,index)=>{
    if(!plain(raw)||!named(raw.id)||roundCounts.get(raw.id)!==1||raw.unavailable){if(isSymbolismRound(raw))excluded.push({roundId:raw?.id||null,reason:'duplicate-or-unavailable-question'});return;}
    const workIds=Array.isArray(raw.works)?raw.works.map(work=>work?.id):raw.workIds;
    if(!Array.isArray(workIds)||!workIds.length||new Set(workIds).size!==workIds.length||workIds.some(id=>!byId.has(id))||Array.isArray(raw.works)&&Object.hasOwn(raw,'workIds')&&!same(workIds,raw.workIds)){if(isSymbolismRound(raw))excluded.push({roundId:raw.id,reason:'unknown-or-conflicting-artwork-identities'});return;}
    const round={...raw,works:Array.isArray(raw.works)?raw.works:workIds.map(id=>byId.get(id))},answer=answers[raw.id];
    if(!plain(answer)||answer.skipped||Object.hasOwn(answer,'roundId')&&answer.roundId!==round.id){if(isSymbolismRound(raw))excluded.push({roundId:raw.id,reason:answer?.skipped?'skipped':'missing-response'});return;}
    let valid=false;try{valid=isSymbolismRound(round)?validSymbolismAnswer(round,answer):validAnswer(round,answer);}catch{}
    if(valid)entries.push({round,answer,index});else if(isSymbolismRound(raw))excluded.push({roundId:raw.id,reason:'incomplete-or-incompatible-response'});
  });
  return {entries,excluded};
}
const ordinary=entry=>entry.round.kind==='spectrum'&&entry.round.criterion==='preference'&&entry.round.evidence?.construct==='preference'&&families.has(entry.round.evidence.family)&&entry.round.evidence.unconditional!==false&&!entry.round.anchorWorks?.length&&!entry.round.anchorIds?.length&&!entry.round.brief&&!entry.round.evidence?.brief;
const noteDetail=response=>`${short(response.entry.round.works[0])}: appeal ${response.beforeStep} / 5 before the note and ${response.afterStep} / 5 after; ${response.changeSteps>0?'up '+steps(response.changeSteps):response.changeSteps<0?'down '+steps(response.changeSteps):'unchanged'}.`;
function evidence(response,label='Before and after reading'){
  const round=response.entry.round;
  return {roundId:round.id,label,detail:noteDetail(response),workIds:[response.workId],role:round.evidence.role||'discovery',sourceRole:'same-scale-before-after',construct:round.evidence.construct,contentId:response.contentId,contentRevision:response.contentRevision,sourceUrls:[...response.sourceUrls],interpretationLimit:round.contextNote.interpretationLimit};
}
function comparison(response,role='support'){
  return {workIds:[response.workId],contextRoundId:response.roundId,sourceRoundIds:[response.roundId],role,measures:[{key:'preference',label:'Before the note',values:[response.before]},{key:'context',label:'After the note',values:[response.after]}]};
}
function finding(id,title,text,support,counter=[],comparisons=[],alternatives=[],priority=10){
  return {id,module:'symbolism',title,text,kind:'taste',priority,support,counter,comparisons,evidence:unique([...support,...counter].flatMap(item=>item.workIds)),sourceUrls:unique([...support,...counter].flatMap(item=>item.sourceUrls||[])),alternatives:[...scope,...alternatives]};
}
function firstByWork(responses){const seen=new Set();return responses.filter(response=>{if(seen.has(response.workId))return false;seen.add(response.workId);return true;});}

function crossWorkReading(responses){
  if(responses.length<2)return null;
  const up=responses.filter(response=>response.changeSteps>0),down=responses.filter(response=>response.changeSteps<0),unchanged=responses.filter(response=>!response.changeSteps),mixed=up.length&&down.length;
  const counts=`Across ${count(responses.length,'painting')}, appeal increased for ${up.length}, decreased for ${down.length} and stayed the same for ${unchanged.length}.`;
  const select=values=>[...values].sort((a,b)=>Math.abs(b.changeSteps)-Math.abs(a.changeSteps));
  const strongest=select(responses)[0],sample=mixed?[select(up)[0],select(down)[0],...unchanged.slice(0,1)]:[strongest,...responses.filter(response=>response!==strongest).slice(0,2)];
  const title=mixed?'The reveals moved appeal in different directions.':up.length?'Appeal rose after some of the reveals.':down.length?'Appeal fell after some of the reveals.':'The reveals left appeal unchanged.';
  return finding('symbolism-across-works',title,counts+' '+(mixed?`${short(sample[0].entry.round.works[0])} gained ${steps(sample[0].changeSteps)}; ${short(sample[1].entry.round.works[0])} lost ${steps(sample[1].changeSteps)}.`:noteDetail(strongest)),sample.map(response=>evidence(response)),[],sample.map(response=>comparison(response)),[
    'Different notes reveal different things: an artist’s account, a devotional purpose, a literary symbol or later reception. The count does not treat them as interchangeable information.',
    'An unchanged response can reflect a settled preference, already known information or a change too small for these five categories. It does not establish resistance to context.'
  ],12);
}
function priorChoiceReading(responses,preferences){
  const linked=responses.flatMap(response=>{
    if(!response.changeSteps)return [];
    const previous=preferences.filter(entry=>entry.index<response.entry.index&&entry.round.works.some(work=>work.id===response.workId)).at(-1);if(!previous)return [];
    const target=previous.answer.positions[response.workId];
    const candidates=previous.round.works.filter(work=>work.id!==response.workId).map(work=>({work,gap:target-previous.answer.positions[work.id]})).filter(item=>response.changeSteps>0?item.gap<=-15:item.gap>=15).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
    return candidates.length?[{response,previous,...candidates[0]}]:[];
  }).sort((a,b)=>Math.abs(b.response.changeSteps)-Math.abs(a.response.changeSteps));
  if(!linked.length)return null;
  const sample=linked[0],{response,previous,work,gap}=sample,up=response.changeSteps>0,painting=short(response.entry.round.works[0]),other=short(work),workIds=[response.workId,work.id];
  const prefEvidence={roundId:previous.round.id,label:'Earlier comparison',detail:`${painting}: preference ${previous.answer.positions[response.workId]} / 100; ${other}: ${previous.answer.positions[work.id]} / 100, under the earlier comparison’s own scale.`,workIds,role:previous.round.evidence.role||'discovery',sourceRole:'earlier-unconditional-preference',construct:'preference'};
  const title=up?'An earlier lower choice gained appeal.':'An earlier stronger choice lost appeal.';
  const body=`You had placed ${painting} ${gap<0?'below':'above'} ${other}. In the later single-painting exercise, its appeal moved from ${response.beforeStep} to ${response.afterStep} / 5 after the note. The other painting was not rated again here.`;
  const categorical={kind:'categorical-contrast',workIds,sourceRoundIds:[previous.round.id,response.roundId],notes:{[response.workId]:[{role:'earlier-preference',tone:'preference',text:`Earlier preference: ${previous.answer.positions[response.workId]} / 100`},{role:'context',tone:'neutral',text:`Appeal: ${response.beforeStep} → ${response.afterStep} / 5`}],[work.id]:[{role:'earlier-preference',tone:'preference',text:`Earlier preference: ${previous.answer.positions[work.id]} / 100`},{role:'not-rerated',tone:'neutral',text:'Not rated after the note'}]}};
  return finding('symbolism-earlier-choice',title,body,[prefEvidence,evidence(response)],[],[categorical,comparison(response)],[
    'The earlier within-set preference and the later single-painting appeal use different instruments. Their numeric values are not subtracted, pooled or used to infer a new rank.',
    'Only a further matched comparison could show whether the order of these two paintings changed. A gain in single-work appeal is not a reversal of preference.',
    'The 15-point earlier gap is a provisional display threshold, not a confidence estimate.'
  ],13);
}
function claimReading(responses,entries){
  const candidates=responses.flatMap(response=>{
    const target=response.entry.round.evidence,claim=entries.find(entry=>entry.index<response.entry.index&&entry.round.id===target.claimRoundId&&entry.round.kind==='statements'&&entry.round.evidence?.statementTest==='contextEffect'&&entry.round.evidence.contextRoundId===response.roundId&&named(target.checkId)&&entry.round.evidence.checkId===target.checkId&&entry.round.statements?.some(statement=>statement.id==='contextEffect'&&statement.text==='Learning the story behind a painting rarely changes how much I like it.'));
    return claim&&claim.answer.claims.contextEffect>=3&&response.changeSteps!==0?[{response,claim}]:[];
  });
  if(!candidates.length)return null;
  const {response,claim}=candidates[0],claimEvidence={roundId:claim.round.id,label:'Your earlier description',detail:'You agreed with “Learning the story behind a painting rarely changes how much I like it.” Agreement: '+claim.answer.claims.contextEffect+' on the 0–4 agreement scale.',workIds:[response.workId],role:claim.round.evidence.role||'check',sourceRole:'prospective-context-claim',construct:claim.round.evidence.construct||'self-description'};
  return finding('symbolism-context-claim','One reveal qualified your earlier description.',`You had said a painting’s story rarely changes your response. For ${short(response.entry.round.works[0])}, appeal moved from ${response.beforeStep} to ${response.afterStep} / 5 after reading. “Rarely” allows exceptions; this records one.`,[claimEvidence,evidence(response)],[],[comparison(response)],[
    'One exception does not refute a statement about what rarely happens. This does not measure honesty, self-knowledge or consistency as a personal trait.',
    'The earlier statement may itself direct attention to a later change.'
  ],11);
}
function interpretationReading(responses){
  const unchanged=responses.filter(response=>response.changedWhat==='interpretation-changed'&&!response.changeSteps);
  if(!unchanged.length)return null;const response=unchanged[0];
  return finding('symbolism-interpretation-without-appeal','A different reading, the same appeal.',`For ${short(response.entry.round.works[0])}, you reported reading the painting differently while keeping appeal at ${response.beforeStep} / 5. A change in interpretation and a change in appeal were separate here.`,[evidence(response,'Changed interpretation; unchanged appeal')],[],[comparison(response)],['The interpretation change is an optional report. No particular interpretation, comprehension gain or reason for the unchanged response is inferred.'],9);
}

export function analyzeSymbolism({works=[],rounds=[],answers={}}={}){
  const {entries,excluded}=entriesFor(works,rounds,answers);
  const responses=entries.filter(entry=>isSymbolismRound(entry.round)).map(entry=>({...symbolismResult(entry.round,entry.answer),entry})),first=firstByWork(responses),firstIds=new Set(first.map(response=>response.roundId)),returns=responses.filter(response=>!firstIds.has(response.roundId));
  const summary={responseCount:responses.length,distinctWorkCount:first.length,firstPairedWorkCount:first.length,increased:first.filter(response=>response.changeSteps>0).length,decreased:first.filter(response=>response.changeSteps<0).length,unchanged:first.filter(response=>!response.changeSteps).length,returnCount:returns.length,knownDetailCount:first.filter(response=>response.detailKnown==='known').length,newDetailCount:first.filter(response=>response.detailKnown==='new').length,detailFamiliarityUnreportedCount:first.filter(response=>!response.detailKnown||response.detailKnown==='unsure').length,scope:'First completed paired response per painting; not a population estimate or a causal effect.'};
  const observations=[crossWorkReading(first),priorChoiceReading(first,entries.filter(ordinary)),claimReading(first,entries),interpretationReading(first)].filter(Boolean);
  if(!observations.length&&first.length===1){const response=first[0];observations.push(finding('symbolism-single-response',response.changeSteps>0?'Appeal rose after the reveal.':response.changeSteps<0?'Appeal fell after the reveal.':'Appeal stayed the same after the reveal.',noteDetail(response),[evidence(response)],[],[comparison(response)],['One painting supplies a local observation. More distinct paintings are needed before describing a recurring response.'],7));}
  const serialize=response=>{const {entry,...result}=response;return {...result,title:short(entry.round.works[0]),noteTitle:entry.round.contextNote.title,noteText:entry.round.contextNote.text,interpretationLimit:entry.round.contextNote.interpretationLimit,sourceRole:entry.round.evidence.role||'discovery',questionDefinition:{title:entry.round.title,prompts:structuredClone(entry.round.contextPrompts),scale:structuredClone(entry.round.contextScale)},firstForWork:firstIds.has(response.roundId),support:[evidence(response)],comparisons:[comparison(response)]};};
  return {protocol:'symbolism-preference-v1',responses:responses.map(serialize),firstResponses:first.map(serialize),returns:returns.map(serialize),summary,observations,excluded,limits:[...scope]};
}

export const buildSymbolismReadings = input => analyzeSymbolism(input).observations;
