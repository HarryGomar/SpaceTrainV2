import {validSymbolismDefinition,SYMBOLISM_PROTOCOL,SYMBOLISM_CONTEXT_MODE,SYMBOLISM_CRITERION,SYMBOLISM_SCALE,SYMBOLISM_PROMPTS} from './symbolism-rounds.mjs';
import {CONTINUOUS_PROTOCOL,isContinuousPreferenceRound,continuousAppealValue} from './continuous-preference.mjs';

export const CONTEXT_CHANGE_PROTOCOL='reported-appreciation-change-v1';
export const CONTEXT_CHANGE_MODE='reported-context-change-v1';
export const CONTEXT_CHANGE_PROMPT='How much does knowing this change your appreciation?';
export const CONTEXT_CHANGE_OPTIONS=Object.freeze([{value:0,label:'Much less'},{value:25,label:'A little less'},{value:50,label:'No change'},{value:75,label:'A little more'},{value:100,label:'Much more'}]);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value),named=value=>typeof value==='string'&&value.trim().length>0,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),numeric=value=>CONTEXT_CHANGE_OPTIONS.some(option=>option.value===value),https=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
const ids=round=>round.works.map(work=>work.id),hashes=work=>[work?.sha256,work?.previewSha256,work?.provenance?.sha256,work?.provenance?.thumbnailSha256,work?.provenance?.download?.sha256].filter(value=>value!==undefined);
function sameIdentity(a,b){if(!a||!b||a.id!==b.id||a.image!==b.image||a.sourceUrl!==b.sourceUrl)return false;const ah=hashes(a),bh=hashes(b);return !ah.length||!bh.length||[...ah,...bh].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)&&value.toLowerCase()===ah[0].toLowerCase());}
export const isContextChangeRound=round=>!!round&&(Object.hasOwn(round,'contextProtocol')||round.contextMode===CONTEXT_CHANGE_MODE||round.evidence?.family==='context-change-report'||round.evidence?.construct==='reported-context-appreciation-change');

/** The sourced note is retained verbatim. Only the response instrument changes. */
export function withContextChange(round){
  if(round?.kind!=='context'||!Array.isArray(round.works)||round.works.length!==1)throw Error('A context-change question needs one exact painting.');
  const symbolic=validSymbolismDefinition(round),work=round.works[0];
  if(!symbolic&&(!named(work.note)||!https(work.sourceUrl)))throw Error('A context-change question needs its sourced note.');
  const {symbolismProtocol,contextScale,contextPrompts,contextCriterion,...base}=structuredClone(round),contextNote=symbolic?structuredClone(round.contextNote):{id:'catalogue-note:'+work.id,revision:'catalogue-note-v1',workId:work.id,title:'About the painting',text:work.note,sourceUrls:[work.sourceUrl],sources:[{id:'collection-record',publisher:work.institution||'Collection record',title:work.title,url:work.sourceUrl}],interpretationLimit:'This is the short note supplied with this exact reproduction.'};
  return {...base,contextMode:CONTEXT_CHANGE_MODE,contextProtocol:CONTEXT_CHANGE_PROTOCOL,contextContentProtocol:symbolic?SYMBOLISM_PROTOCOL:'catalogue-note-v1',contextPrompts:{before:'Look at the painting.',after:CONTEXT_CHANGE_PROMPT},contextChangeOptions:structuredClone(CONTEXT_CHANGE_OPTIONS),contextNote,title:'Look at the painting.',hint:'Read the note, then say whether it changes your appreciation.',evidence:{...base.evidence,construct:'reported-context-appreciation-change',family:'context-change-report',contentId:contextNote.id,sourceUrls:[...contextNote.sourceUrls],unconditional:false,limits:['This directly reports a change in appreciation. It is not a second absolute appeal rating or an inferred after-score.','Reading, repeated viewing, elapsed time and question framing occur together. The response does not establish a causal effect of the note.']}};
}

export function validContextChangeDefinition(round){
  if(!plain(round)||round.kind!=='context'||round.contextMode!==CONTEXT_CHANGE_MODE||round.contextProtocol!==CONTEXT_CHANGE_PROTOCOL||!Array.isArray(round.works)||round.works.length!==1||!named(round.id)||round.unavailable||!equal(round.contextChangeOptions,CONTEXT_CHANGE_OPTIONS)||!equal(round.contextPrompts,{before:'Look at the painting.',after:CONTEXT_CHANGE_PROMPT})||round.symbolismProtocol!==undefined)return false;
  const work=round.works[0],note=round.contextNote,e=round.evidence;if(!named(work?.id)||!named(work.title)||!named(work.image)||!https(work.sourceUrl)||!plain(note)||!named(note.id)||!named(note.revision)||note.workId!==work.id||!named(note.text)||!Array.isArray(note.sourceUrls)||!note.sourceUrls.length||!note.sourceUrls.every(https)||!Array.isArray(note.sources)||!note.sources.length||note.sources.some(source=>!named(source.publisher)||!named(source.title)||!note.sourceUrls.includes(source.url))||!plain(e)||e.construct!=='reported-context-appreciation-change'||e.family!=='context-change-report'||e.unconditional!==false||e.contentId!==note.id||!equal(e.sourceUrls,note.sourceUrls)||round.workIds!==undefined&&!equal(round.workIds,[work.id]))return false;
  if(round.contextContentProtocol===SYMBOLISM_PROTOCOL){const legacy={...round,contextMode:SYMBOLISM_CONTEXT_MODE,symbolismProtocol:SYMBOLISM_PROTOCOL,contextCriterion:SYMBOLISM_CRITERION,criterion:'preference',contextScale:SYMBOLISM_SCALE,contextPrompts:SYMBOLISM_PROMPTS,evidence:{...e,construct:'context-liking-change',family:'symbolism-reveal'}};return validSymbolismDefinition(legacy);}
  return round.contextContentProtocol==='catalogue-note-v1'&&note.id==='catalogue-note:'+work.id&&note.text===work.note&&equal(note.sourceUrls,[work.sourceUrl]);
}

export function validContextChangeAnswer(round,answer){
  if(!validContextChangeDefinition(round)||!plain(answer)||answer.skipped||!equal(answer.workIds,ids(round))||answer.workId!==round.works[0].id||answer.contextProtocol!==CONTEXT_CHANGE_PROTOCOL||answer.contentId!==round.contextNote.id||answer.storySeen!==true||answer.confirmed!==true||answer.before!==undefined||answer.after!==undefined)return false;
  return answer.uncertain===true?answer.reportedChange===undefined:answer.uncertain===false&&numeric(answer.reportedChange);
}

export function sanitizeContextChangeDraft(round,answer={}){
  if(!validContextChangeDefinition(round))return null;const workId=round.works[0].id,base={workIds:[workId],workId,contextProtocol:CONTEXT_CHANGE_PROTOCOL,contentId:round.contextNote.id,storySeen:false,uncertain:false,confirmed:false,stage:'painting'};
  if(!plain(answer)||answer.workId!==workId||!equal(answer.workIds,[workId])||answer.contextProtocol!==CONTEXT_CHANGE_PROTOCOL||answer.contentId!==round.contextNote.id)return base;
  if(answer.storySeen===true){base.storySeen=true;base.stage='change';if(answer.uncertain===true)base.uncertain=true;else if(numeric(answer.reportedChange))base.reportedChange=answer.reportedChange;}
  return base;
}

export function reduceContextChangeDraft(round,draft,action={}){
  const next=sanitizeContextChangeDraft(round,draft);if(!next)return null;
  if(action.type==='reveal'){next.storySeen=true;next.stage='change';}
  if(action.type==='change'&&next.storySeen&&numeric(action.value)){next.reportedChange=action.value;next.uncertain=false;}
  if(action.type==='unsure'&&next.storySeen){delete next.reportedChange;next.uncertain=true;}
  if(action.type==='confirm'&&validContextChangeAnswer(round,{...next,confirmed:true}))next.confirmed=true;
  return next;
}

/** Optional earlier appeal is source evidence, never a synthetic after-score. */
export function bindContextChangeRound({round,rounds=[],answers={}}={}){
  if(!validContextChangeDefinition(round)||round.evidence.priorAppeal!==undefined)return round;const counts=new Map();rounds.forEach(source=>counts.set(source?.id,(counts.get(source?.id)||0)+1));
  const target=/^journey-(\d+)$/.exec(round.id),work=round.works[0];
  for(const source of [...rounds].reverse()){
    const n=/^journey-(\d+)$/.exec(source?.id||'');if(!source||source.id===round.id||counts.get(source.id)!==1||target&&n&&Number(n[1])>=Number(target[1])||!isContinuousPreferenceRound(source)||!Array.isArray(source.works))continue;
    const original=source.works.find(item=>item.id===work.id),value=continuousAppealValue(source,answers[source.id],work.id);if(!sameIdentity(original,work)||value===null)continue;
    return {...structuredClone(round),evidence:{...round.evidence,priorAppeal:{roundId:source.id,workId:work.id,value,continuousProtocol:CONTINUOUS_PROTOCOL,sourceIdentity:{id:original.id,sourceUrl:original.sourceUrl,image:original.image,...(hashes(original).length?{previewSha256:hashes(original)[0]}:{})},sourceWorkIds:ids(source),sourceQuestion:{title:source.title,hint:source.hint,scale:structuredClone(source.scale),evidence:structuredClone(source.evidence)},sourceAnswer:structuredClone(answers[source.id]),basis:'Actual earlier continuous personal-appeal response captured before this note.'}}};
  }
  return round;
}
