import {SYMBOLISM_CONTENT_BANK,getSymbolismContent} from './symbolism-content.mjs';

export const SYMBOLISM_PROTOCOL = 'symbolism-preference-v1';
export const SYMBOLISM_CONTEXT_MODE = 'preference-before-after-v1';
export const SYMBOLISM_CRITERION = 'personal-appeal-v1';
export const SYMBOLISM_SCALE = Object.freeze({id:'appeal-five-point-v1',values:[0,25,50,75,100],labels:['No appeal','Little appeal','Some appeal','Strong appeal','Very strong appeal']});
export const SYMBOLISM_PROMPTS = Object.freeze({before:'How much does this painting appeal to you?',after:'How much does it appeal now?'});
export const SYMBOLISM_CHANGED_WHAT = Object.freeze([
  {id:'interpretation-changed',label:'I read it differently'},
  {id:'noticed-detail',label:'I noticed a detail'},
  {id:'personal-connection',label:'It felt more personal'},
  {id:'no-specific-change',label:'Nothing specific'},
  {id:'unsure',label:'Not sure'}
]);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const named = value => typeof value === 'string' && value.trim().length > 0;
const numeric = value => SYMBOLISM_SCALE.values.includes(value);
const url = value => {try{return new URL(value).protocol==='https:';}catch{return false;}};
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const optional = (object,key,test) => !Object.hasOwn(object,key) || test(object[key]);
const preferenceFamilies = new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const known = works => {
  const counts=new Map();for(const work of works||[])if(named(work?.id))counts.set(work.id,(counts.get(work.id)||0)+1);
  return new Map((works||[]).filter(work=>counts.get(work?.id)===1&&named(work.title)&&named(work.image)&&url(work.sourceUrl)).map(work=>[work.id,work]));
};

// Route malformed typed records to strict validation rather than to legacy context.
export const isSymbolismRound = round => plain(round) && (Object.hasOwn(round,'symbolismProtocol') || round.evidence?.family==='symbolism-reveal');
const hasSymbolismNote=round=>isSymbolismRound(round)||round?.kind==='context'&&round.contextContentProtocol===SYMBOLISM_PROTOCOL&&round.contextNote?.workId===round.works?.[0]?.id;

export function availableSymbolismContent(works=[]) {
  const byId=known(works);
  return SYMBOLISM_CONTENT_BANK.filter(content=>byId.has(content.workId)).map(content=>structuredClone(content));
}

/** History here is question definitions, not a claim that every note was read. */
export function selectSymbolismContent({works=[],rounds=[],answers={},preferredWorkIds=[],excludeContentIds=[],excludeWorkIds=[],allowRevisit=false}={}) {
  const available=availableSymbolismContent(works).filter(content=>!excludeContentIds.includes(content.id)&&!excludeWorkIds.includes(content.workId));
  const rated=new Set();
  for(const round of rounds){
    const answer=answers[round?.id],offered=Array.isArray(round?.works)?round.works.map(work=>work?.id):round?.workIds;
    if(round?.kind!=='spectrum'||round.criterion!=='preference'||round.evidence?.construct!=='preference'||!preferenceFamilies.has(round.evidence.family)||round.evidence?.unconditional===false||round.anchorWorks?.length||round.anchorIds?.length||round.brief||round.evidence?.brief||!Array.isArray(offered)||offered.length<2||new Set(offered).size!==offered.length||!plain(answer)||answer.skipped||answer.confirmed!==true||answer.criterion!=='preference'||!equal(answer.workIds,offered)||!plain(answer.positions)||Object.keys(answer.positions).length!==offered.length||offered.some(id=>!Number.isInteger(answer.positions[id])||answer.positions[id]<0||answer.positions[id]>100))continue;
    for(const id of offered)rated.add(id);
  }
  const priority=content=>{const preferred=preferredWorkIds.indexOf(content.workId);return preferred>=0?preferred:preferredWorkIds.length+(rated.has(content.workId)?0:1);};
  available.sort((a,b)=>priority(a)-priority(b));
  const used=new Set(rounds.filter(hasSymbolismNote).map(round=>round.contextNote?.id));
  const fresh=available.find(content=>!used.has(content.id));
  if(fresh)return {status:'ready',content:fresh,revisit:false};
  if(allowRevisit&&available.length){
    const last=new Map();rounds.forEach((round,index)=>{if(hasSymbolismNote(round))last.set(round.contextNote?.id,index);});
    available.sort((a,b)=>(last.get(a.id)??-1)-(last.get(b.id)??-1));
    return {status:'ready',content:available[0],revisit:true};
  }
  return {status:'unavailable',content:null,reason:available.length?'All available sourced reveals are already planned.':'No sourced reveal has its exact artwork and a declared image in this catalogue.'};
}

export function buildSymbolismRound({id,works=[],contentId,evidence={},rounds=[],answers={},preferredWorkIds=[],excludeContentIds=[],excludeWorkIds=[],allowRevisit=false}={}) {
  if(!named(id))return null;
  const selection=contentId?{content:getSymbolismContent(contentId)}:selectSymbolismContent({works,rounds,answers,preferredWorkIds,excludeContentIds,excludeWorkIds,allowRevisit});
  const content=selection.content,work=content&&known(works).get(content.workId);
  if(!content||!work)return null;
  const previous=rounds.filter(hasSymbolismNote).filter(round=>round.contextNote?.id===content.id);
  return {
    id,kind:'context',format:'context',works:[structuredClone(work)],criterion:'preference',
    contextMode:SYMBOLISM_CONTEXT_MODE,symbolismProtocol:SYMBOLISM_PROTOCOL,contextCriterion:SYMBOLISM_CRITERION,
    title:SYMBOLISM_PROMPTS.before,hint:'Rate the painting, then read the note.',
    contextPrompts:structuredClone(SYMBOLISM_PROMPTS),contextScale:structuredClone(SYMBOLISM_SCALE),contextNote:content,
    evidence:{...structuredClone(evidence),construct:'context-liking-change',family:'symbolism-reveal',role:previous.length?'repeat':'discovery',contentId:content.id,sourceUrls:[...content.sourceUrls],unconditional:false,
      ...(previous.length?{storyPreviouslyPlanned:true,previousRevealRoundIds:previous.map(round=>round.id)}:{}),
      limits:['The paired responses use the same five-point appeal scale. Circle spacing does not establish equal psychological intervals.','Reading, another look, elapsed time and the question framing occur together. A change cannot be attributed to the note alone.']}
  };
}

export function validSymbolismDefinition(round) {
  if(!plain(round)||round.kind!=='context'||round.contextMode!==SYMBOLISM_CONTEXT_MODE||round.symbolismProtocol!==SYMBOLISM_PROTOCOL||round.contextCriterion!==SYMBOLISM_CRITERION||round.criterion!=='preference'||!named(round.id)||!Array.isArray(round.works)||round.works.length!==1||!known(round.works).has(round.works[0]?.id))return false;
  const workId=round.works[0].id,note=round.contextNote,evidence=round.evidence;
  if(round.unavailable||!plain(note)||!named(note.id)||!SYMBOLISM_CONTENT_BANK.some(content=>content.id===note.id&&content.workId===workId)||!named(note.revision)||note.workId!==workId||!named(note.title)||!named(note.text)||!named(note.interpretationLimit)||!equal(round.contextScale,SYMBOLISM_SCALE)||!equal(round.contextPrompts,SYMBOLISM_PROMPTS))return false;
  const registered=getSymbolismContent(note.id);
  if(!Array.isArray(note.sourceUrls)||!note.sourceUrls.length||new Set(note.sourceUrls).size!==note.sourceUrls.length||!note.sourceUrls.every(url)||!equal(note.sourceUrls,registered.sourceUrls)||!Array.isArray(note.sources)||!note.sources.length||note.sources.some(source=>!named(source.id)||!named(source.publisher)||!named(source.title)||!note.sourceUrls.includes(source.url)))return false;
  const statuses=['visible-detail','museum-interpretation','qualified-museum-interpretation','artist-account-reported-by-museum','historical-context','historical-reception'];
  if(!Array.isArray(note.claims)||!note.claims.length||new Set(note.claims.map(claim=>claim?.id)).size!==note.claims.length||note.claims.some(claim=>!named(claim?.id)||!named(claim.text)||!statuses.includes(claim.status)||!Array.isArray(claim.sourceUrls)||!claim.sourceUrls.length||claim.sourceUrls.some(source=>!note.sourceUrls.includes(source))))return false;
  if(!plain(evidence)||evidence.construct!=='context-liking-change'||evidence.family!=='symbolism-reveal'||evidence.contentId!==note.id||!equal(evidence.sourceUrls,note.sourceUrls)||evidence.unconditional!==false)return false;
  return !Object.hasOwn(round,'workIds')||equal(round.workIds,[workId]);
}

export function validSymbolismAnswer(round,answer) {
  if(!validSymbolismDefinition(round)||!plain(answer)||answer.skipped||!equal(answer.workIds,[round.works[0].id])||answer.workId!==round.works[0].id||answer.storySeen!==true||!numeric(answer.before)||!numeric(answer.after))return false;
  return optional(answer,'criterion',value=>value==='preference')&&optional(answer,'symbolismProtocol',value=>value===SYMBOLISM_PROTOCOL)&&optional(answer,'contentId',value=>value===round.contextNote.id)&&optional(answer,'beforeLocked',value=>numeric(value)&&value===answer.before)&&optional(answer,'detailKnown',value=>['new','known','unsure'].includes(value))&&optional(answer,'changedWhat',value=>SYMBOLISM_CHANGED_WHAT.some(option=>option.id===value));
}

export function sanitizeSymbolismDraft(round,answer={}) {
  if(!validSymbolismDefinition(round))return null;
  const workId=round.works[0].id,base={workIds:[workId],workId,criterion:'preference',symbolismProtocol:SYMBOLISM_PROTOCOL,contentId:round.contextNote.id,storySeen:false,stage:'before'};
  if(!plain(answer)||answer.workId!==workId||!equal(answer.workIds,[workId])||!optional(answer,'symbolismProtocol',value=>value===SYMBOLISM_PROTOCOL)||!optional(answer,'contentId',value=>value===round.contextNote.id)||!optional(answer,'criterion',value=>value==='preference'))return base;
  const before=numeric(answer.beforeLocked)?answer.beforeLocked:answer.before;
  if(numeric(before))base.before=before;
  if(answer.storySeen===true&&numeric(before)){
    Object.assign(base,{storySeen:true,stage:'after',beforeLocked:before});
    if(numeric(answer.after))base.after=answer.after;
    if(['new','known','unsure'].includes(answer.detailKnown))base.detailKnown=answer.detailKnown;
    if(SYMBOLISM_CHANGED_WHAT.some(option=>option.id===answer.changedWhat))base.changedWhat=answer.changedWhat;
  }
  return base;
}

/** Pure phase transitions keep the pre-note response fixed after disclosure. */
export function reduceSymbolismDraft(round,draft,action={}) {
  const next=sanitizeSymbolismDraft(round,draft);if(!next)return null;
  if(action.type==='rate-before'&&!next.storySeen&&numeric(action.value))next.before=action.value;
  if(action.type==='reveal'&&!next.storySeen&&numeric(next.before))Object.assign(next,{storySeen:true,stage:'after',beforeLocked:next.before});
  if(action.type==='rate-after'&&next.storySeen&&numeric(action.value))next.after=action.value;
  if(action.type==='detail-known'&&next.storySeen&&['new','known','unsure'].includes(action.value))next.detailKnown=action.value;
  if(action.type==='changed-what'&&next.storySeen&&SYMBOLISM_CHANGED_WHAT.some(option=>option.id===action.value))next.changedWhat=action.value;
  if(action.type==='skip')next.skipped=true;
  return next;
}

export function symbolismResult(round,answer) {
  if(!validSymbolismAnswer(round,answer))return null;
  const change=answer.after-answer.before;
  return {roundId:round.id,workId:round.works[0].id,contentId:round.contextNote.id,contentRevision:round.contextNote.revision,before:answer.before,after:answer.after,change,beforeStep:answer.before/25+1,afterStep:answer.after/25+1,changeSteps:change/25,direction:change>0?'increased':change<0?'decreased':'unchanged',detailKnown:answer.detailKnown||null,changedWhat:answer.changedWhat||null,sourceUrls:[...round.contextNote.sourceUrls]};
}
