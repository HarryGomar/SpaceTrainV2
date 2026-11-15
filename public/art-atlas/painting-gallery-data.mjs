import {validAnswer} from './engine.mjs';

export const GALLERY_CONTEXT_KEY='art-atlas-gallery-context-v1';
export const GALLERY_CONTEXT_SCOPE='Gallery opened; which artwork labels were actually read is unknown.';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unique=values=>[...new Set(values)];
const text=value=>typeof value==='string'&&value.trim().length>0;
const normalise=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const safeUrl=value=>{try{return ['https:','http:'].includes(new URL(value).protocol);}catch{return false;}};
function catalogue(works){
  const list=Array.isArray(works)?works:[],counts=new Map();for(const work of list)if(text(work?.id))counts.set(work.id,(counts.get(work.id)||0)+1);
  return list.filter(work=>plain(work)&&counts.get(work.id)===1&&text(work.title)&&text(work.image)&&work.image.startsWith('assets/')&&!work.image.includes('..')&&safeUrl(work.sourceUrl)).map(work=>structuredClone(work));
}
export function paintingSearchText(work){
  return normalise([work.title,work.shortTitle,work.artist,work.date,work.movement,work.country,work.origin,work.museum,work.institution,work.medium].filter(value=>typeof value==='string').join(' '));
}
const item=(work,namespace)=>({key:namespace+':'+work.id,workId:work.id,source:namespace,work:structuredClone(work),searchText:paintingSearchText(work)});
const group=(definition,works,namespace)=>({...definition,workIds:works.map(work=>work.id),items:works.map(work=>item(work,namespace))});
const counts=groups=>({setCount:groups.length,workCount:unique(groups.flatMap(group=>group.workIds)).length,itemCount:groups.reduce((sum,group)=>sum+group.items.length,0)});

function answeredGroups(saved){
  if(!plain(saved)||saved.manifest?.protocol!=='art-profile-50-v1'||!Array.isArray(saved.manifest.catalogue))return {available:false,groups:[],rejectedRoundIds:[]};
  const pool=catalogue(saved.manifest.catalogue),byId=new Map(pool.map(work=>[work.id,work])),shown=plain(saved.shown)?Object.entries(saved.shown):[],answers=plain(saved.answers)?saved.answers:{},idCounts=new Map(),groups=[],rejected=[];
  for(const [,snapshot] of shown)if(text(snapshot?.id))idCounts.set(snapshot.id,(idCounts.get(snapshot.id)||0)+1);
  for(const [key,snapshot] of shown){
    if(!plain(snapshot)||snapshot.kind!=='spectrum'||snapshot.criterion!=='preference'||snapshot.evidence?.construct!=='preference')continue;
    const evidence=snapshot.evidence;
    if(!['individual-choice','feature-check','unconditional-preference','adaptive-preference'].includes(evidence.family)||!['discovery','exploration'].includes(evidence.role)||evidence.repeatOf||evidence.unconditional===false||snapshot.brief||evidence.brief||snapshot.anchorIds?.length||snapshot.anchorWorks?.length||evidence.stimulusVisibility==='not-shown')continue;
    const ids=snapshot.workIds,answer=answers[snapshot.id];
    if(key!==snapshot.id||idCounts.get(snapshot.id)!==1||typeof snapshot.title!=='string'||typeof snapshot.hint!=='string'||!Array.isArray(ids)||ids.length<2||ids.length>4||unique(ids).length!==ids.length||ids.some(id=>!byId.has(id))||!plain(answer?.positions)){rejected.push(snapshot.id||key);continue;}
    const round={...structuredClone(snapshot),works:ids.map(id=>byId.get(id))};let valid=false;try{valid=validAnswer(round,answer);}catch{}
    if(!valid){rejected.push(snapshot.id);continue;}
    const number=/^journey-(\d+)$/.exec(snapshot.id),roundNumber=number?Number(number[1]):null;
    groups.push(group({id:'answered:'+snapshot.id,kind:'answered-comparison',roundId:snapshot.id,roundNumber,label:roundNumber?'Round '+roundNumber:'Answered comparison',title:snapshot.title,instruction:snapshot.hint,panelNumber:Number.isInteger(evidence.panelNumber)?evidence.panelNumber:null,sourceRevision:evidence.journeyRevision||null},round.works,'saved'));
  }
  groups.sort((a,b)=>(a.roundNumber??Infinity)-(b.roundNumber??Infinity)||a.roundId.localeCompare(b.roundId));
  return {available:true,groups,rejectedRoundIds:rejected};
}

/** The live proposal and the viewer's frozen answers are separate sources. */
export function buildPaintingGallery({works=[],notes={},saved=null}={}){
  const pool=catalogue(works),byId=new Map(pool.map(work=>[work.id,work])),briefs=Array.isArray(notes?.proposedFirst18Panels)?notes.proposedFirst18Panels:[],planned=[],rejectedPanels=[];
  for(const brief of briefs){
    const ids=brief?.workIds;if(!Number.isInteger(brief?.panel)||!Array.isArray(ids)||ids.length<2||ids.length>4||unique(ids).length!==ids.length||ids.some(id=>!byId.has(id))){rejectedPanels.push(brief?.panel??null);continue;}
    planned.push(group({id:'planned:'+brief.panel,kind:'planned-comparison',number:brief.panel,label:'Set '+String(brief.panel).padStart(2,'0'),title:brief.galleryTitle||brief.title||brief.targetContrast||'Comparison set '+brief.panel,curatorialQuestion:brief.primaryQuestion||null,scope:brief.questionUse||null},ids.map(id=>byId.get(id)),'current'));
  }
  planned.sort((a,b)=>a.number-b.number);
  const reserve=field=>unique(Array.isArray(notes?.reservePools?.[field])?notes.reservePools[field]:[]).filter(id=>byId.has(id)).map(id=>byId.get(id)),next=reserve('batch2'),later=reserve('batch3'),history=answeredGroups(saved);
  const view=(id,label,title,intro,groups,kind)=>({id,label,title,intro,kind,groups,...counts(groups)});
  const views=[
    view('first','First comparison sets','The first comparison sets.','The current plan for the first 50 rounds. Other activities show additional paintings.',planned,'planned'),
    view('next','Next '+next.length,'The next paintings.','Reserved for first preference ratings in the second block. Their comparison groups depend on earlier answers.',next.length?[group({id:'reserve:next',kind:'reserve-pool',title:'Paintings for the second block',label:'Rounds 51–100'},next,'current')]:[],'reserve'),
    view('later','Following '+later.length,'Further into the collection.','Reserved for first preference ratings in the third block. Later comparison groups depend on earlier answers.',later.length?[group({id:'reserve:later',kind:'reserve-pool',title:'Paintings for the third block',label:'Rounds 101–150'},later,'current')]:[],'reserve'),
    view('all','All '+pool.length,'The collection.','Every painting available in the current study collection.',pool.length?[group({id:'catalogue',kind:'catalogue',title:'',label:''},pool,'current')]:[],'catalogue')
  ];
  if(history.available)views.push(view('answered','Your answered sets','Your answered comparisons.','Completed ordinary preference comparisons, with the artwork details saved in your study.',history.groups,'history'));
  return {version:1,views,history:{available:history.available,answeredSetCount:history.groups.length,rejectedRoundIds:history.rejectedRoundIds},coverage:{catalogue:pool.length,first:counts(planned).workCount,next:next.length,later:later.length,plannedSetCount:planned.length},audit:{rejectedPanels},scope:['The first comparison sets describe the current proposal, not what any particular viewer saw.','The 18- and 17-work pools reserve first preference ratings. Paintings may appear earlier in other activities.','Later comparison groups adapt to earlier responses.','Saved answers use their own captured catalogue. Current metadata never fills a missing historical artwork.']};
}

export function filterPaintingGallery(view,query=''){
  const terms=normalise(query).split(' ').filter(Boolean),groups=view.groups.map(group=>({...group,items:group.items.filter(item=>terms.every(term=>item.searchText.includes(term)))})).filter(group=>group.items.length).map(group=>({...group,workIds:group.items.map(item=>item.workId)}));
  return {...view,groups,...counts(groups),query:String(query),totalWorkCount:view.workCount,totalSetCount:view.setCount};
}

/** Presentation context only. It contains no ratings or claim that labels were read. */
export function nextGalleryContext(previous,workIds,now=Date.now()){
  const at=Number.isFinite(now)&&now>=0?now:Date.now(),first=plain(previous)&&Number.isFinite(previous.firstOpenedAt)&&previous.firstOpenedAt>=0?Math.min(previous.firstOpenedAt,at):at;
  return {firstOpenedAt:first,lastOpenedAt:at,workIds:unique((Array.isArray(workIds)?workIds:[]).filter(text)),scope:GALLERY_CONTEXT_SCOPE};
}

/** A gallery visit can cue a later label game, but does not prove a label was read. */
export function captureGalleryPreview(context,workIds,now=Date.now()){
  if(!plain(context)||!Number.isFinite(context.firstOpenedAt)||!Number.isFinite(context.lastOpenedAt)||context.firstOpenedAt<0||context.firstOpenedAt>context.lastOpenedAt||context.lastOpenedAt>now||!Array.isArray(context.workIds))return null;
  const available=new Set(context.workIds.filter(text));
  return {firstOpenedAt:context.firstOpenedAt,lastOpenedAt:context.lastOpenedAt,capturedAt:now,availableMatchedWorkIds:unique(workIds.filter(id=>available.has(id))),scope:GALLERY_CONTEXT_SCOPE};
}
