import {validAnswer} from './engine.mjs';
import {artworkContextSearchText} from './artwork-context.mjs';
import {routeCollection} from './collection-routing.mjs';
import {groupReservedPaintings} from './painting-gallery-sets.mjs';

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
export function paintingSearchText(work,{includeCurrentContext=true}={}){
  return normalise([work.title,work.shortTitle,work.artist,work.date,work.movement,work.country,work.origin,work.museum,work.institution,work.medium,includeCurrentContext?artworkContextSearchText(work):''].filter(value=>typeof value==='string').join(' '));
}
const item=(work,namespace)=>({key:namespace+':'+work.id,workId:work.id,source:namespace,work:structuredClone(work),searchText:paintingSearchText(work,{includeCurrentContext:namespace==='current'})});
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
  notes=plain(notes)?notes:{};
  const pool=catalogue(works),routing=routeCollection(pool,notes.collectionRouting,notes),main=routing.main,world=routing.world,byId=new Map(pool.map(work=>[work.id,work])),briefs=Array.isArray(notes?.proposedFirst18Panels)?notes.proposedFirst18Panels:[],planned=[],rejectedPanels=[];
  for(const brief of briefs){
    const ids=brief?.workIds;if(!Number.isInteger(brief?.panel)||!Array.isArray(ids)||ids.length<2||ids.length>4||unique(ids).length!==ids.length||ids.some(id=>!byId.has(id))){rejectedPanels.push(brief?.panel??null);continue;}
    planned.push(group({id:'planned:'+brief.panel,kind:'planned-comparison',number:brief.panel,label:'Set '+String(brief.panel).padStart(2,'0'),title:brief.galleryTitle||brief.title||brief.targetContrast||'Comparison set '+brief.panel,curatorialQuestion:brief.primaryQuestion||null,scope:brief.questionUse||null},ids.map(id=>byId.get(id)),'current'));
  }
  planned.sort((a,b)=>a.number-b.number);
  const reserve=field=>unique(Array.isArray(notes?.reservePools?.[field])?notes.reservePools[field]:[]).filter(id=>byId.has(id)).map(id=>byId.get(id)),next=reserve('batch2'),later=reserve('batch3'),history=answeredGroups(saved);
  const view=(id,label,title,intro,groups,kind)=>({id,label,title,intro,kind,groups,...counts(groups)});
  const blockView=(block,id)=>{
    const reserved=reserve('batch'+block),start=(block-1)*50+1,end=block*50,label='Rounds '+start+'–'+end;
    const groups=groupReservedPaintings(reserved,{block}).map(({works,...definition})=>group(definition,works,'current'));
    return view(id,label,label,'Explore this block’s paintings in small comparison sets. These are browsing groups; your quiz adapts its comparisons to your earlier answers.',groups,'reserve');
  };
  const laterBlocks=[4,5,6].map(block=>blockView(block,'block'+block)).filter(item=>item.workCount);
  const views=[
    view('first','First comparison sets','The first comparison sets.','The current plan for the first 50 rounds. Other activities show additional paintings.',planned,'planned'),
    blockView(2,'next'),
    blockView(3,'later'),
    ...laterBlocks,
    view('all','Main collection · '+main.length,'The main collection','Classics and Americas works, with a few global anchors.',main.length?[group({id:'catalogue',kind:'catalogue',title:'',label:''},main,'current')]:[],'catalogue'),
    ...(world.length?[view('world','World collection · '+world.length,'The world collection','Additional East Asian, South Asian and Himalayan works. These remain available without filling the main quiz.',[group({id:'world-catalogue',kind:'catalogue',title:'',label:''},world,'current')],'catalogue')]:[])
  ];
  if(history.available)views.push(view('answered','Your answered sets','Your answered comparisons.','Completed ordinary preference comparisons, with the artwork details saved in your study.',history.groups,'history'));
  return {version:1,views,history:{available:history.available,answeredSetCount:history.groups.length,rejectedRoundIds:history.rejectedRoundIds},coverage:{catalogue:pool.length,main:main.length,world:world.length,first:counts(planned).workCount,next:next.length,later:later.length,plannedSetCount:planned.length},collectionRouting:routing.metadata,audit:{rejectedPanels},scope:['The first comparison sets describe the current proposal, not what any particular viewer saw.','Later pools reserve first preference comparisons. Paintings may appear earlier in other activities.','Later comparison groups adapt to earlier responses.','Saved answers use their own captured catalogue. Current metadata never fills a missing historical artwork.','The full world collection remains available separately. Main routing is editorial selection, never evidence of a personal like or dislike.']};
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
