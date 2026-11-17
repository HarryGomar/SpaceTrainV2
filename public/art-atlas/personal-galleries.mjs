import {MUSEUMS} from './museums.mjs';
import {isGallery,validGallery,ROOMS,roomOf,roomName} from './gallery-model.mjs';
import {validScenario,SLOT_IDS} from './scenarios.mjs';

export const PERSONAL_GALLERIES_KEY='art-atlas-personal-galleries-v1';
export const PERSONAL_GALLERIES_PROTOCOL='personal-galleries-v1';
export const PERSONAL_FLOOR_GRID=Object.freeze({columns:6,rows:5});
export const PERSONAL_ROOM_SLOTS=Object.freeze([
  {id:'north-left',side:'north',label:'North wall, left',x:33,y:10},
  {id:'north-right',side:'north',label:'North wall, right',x:67,y:10},
  {id:'east-upper',side:'east',label:'East wall, upper',x:88,y:36},
  {id:'east-lower',side:'east',label:'East wall, lower',x:88,y:65},
  {id:'south-right',side:'south',label:'South wall, right',x:67,y:90},
  {id:'south-left',side:'south',label:'South wall, left',x:33,y:90},
  {id:'west-lower',side:'west',label:'West wall, lower',x:12,y:65},
  {id:'west-upper',side:'west',label:'West wall, upper',x:12,y:36}
]);
const slotIds=new Set(PERSONAL_ROOM_SLOTS.map(slot=>slot.id));
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,179}$/.test(value);
const name=(value,max=80)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
const unique=values=>[...new Set(values)];
const normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const link=value=>{try{return typeof value==='string'&&['https:','http:'].includes(new URL(value).protocol);}catch{return false;}};
const image=value=>typeof value==='string'&&/^assets\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(value)&&!value.includes('..');
const useful=value=>name(value)&&!/unknown|unidentified|unspecified|anonymous|private collection/i.test(value);
const id=(prefix,now)=>prefix+'-'+(typeof now==='number'&&Number.isFinite(now)?now:Date.now()).toString(36)+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,12));
const validTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const knownFields=['id','title','shortTitle','artist','artistKnown','date','movement','museum','country','medium','sourceUrl','image','imageLarge','width','height','largeWidth','largeHeight','alt','rights','rightsUrl','credit','sha256'];
const floorCellKey=({column,row})=>column+':'+row;
const floorDistance=(a,b)=>Math.abs(a.column-b.column)+Math.abs(a.row-b.row);
const floorCentre={column:2,row:2};
const floorCells=Array.from({length:PERSONAL_FLOOR_GRID.columns*PERSONAL_FLOOR_GRID.rows},(_,index)=>({
  column:index%PERSONAL_FLOOR_GRID.columns,row:Math.floor(index/PERSONAL_FLOOR_GRID.columns)
})).sort((a,b)=>floorDistance(a,floorCentre)-floorDistance(b,floorCentre));
const validFloorCell=cell=>plain(cell)&&Number.isInteger(cell.column)&&Number.isInteger(cell.row)&&
  cell.column>=0&&cell.column<PERSONAL_FLOOR_GRID.columns&&cell.row>=0&&cell.row<PERSONAL_FLOOR_GRID.rows;

/** Older galleries have a default floor plan until their first room edit. */
export function personalRoomPositions(gallery){
  return gallery.floorPlan?structuredClone(gallery.floorPlan):
    Object.fromEntries(gallery.rooms.map((room,index)=>[room.id,{...floorCells[index]}]));
}

function availableFloorCell(plan,nearRoomId){
  const occupied=new Set(Object.values(plan).map(floorCellKey));
  const free=floorCells.filter(cell=>!occupied.has(floorCellKey(cell)));
  const near=Object.hasOwn(plan,nearRoomId)?plan[nearRoomId]:null;
  return {...(near&&free.find(cell=>floorDistance(cell,near)===1)||free[0])};
}

function validFloorPlan(plan,roomIds){
  if(!plain(plan)||Object.keys(plan).length!==roomIds.size)return false;
  const occupied=new Set();
  for(const [id,cell] of Object.entries(plan)){
    if(!roomIds.has(id)||!validFloorCell(cell)||occupied.has(floorCellKey(cell)))return false;
    occupied.add(floorCellKey(cell));
  }
  return true;
}

export function personalWorkSnapshot(work){
  if(!plain(work)||!identifier(work.id)||!name(work.title,500)||!image(work.image)||!link(work.sourceUrl))return null;
  for(const key of ['shortTitle','artist','date','movement','museum','country','medium','alt','rights','credit'])if(work[key]!==undefined&&(typeof work[key]!=='string'||work[key].length>3000))return null;
  for(const key of ['width','height','largeWidth','largeHeight'])if(work[key]!==undefined&&(!Number.isInteger(work[key])||work[key]<=0||work[key]>32000))return null;
  if(work.artistKnown!==undefined&&typeof work.artistKnown!=='boolean'||work.imageLarge!==undefined&&!image(work.imageLarge)||work.rightsUrl!==undefined&&!link(work.rightsUrl)||work.sha256!==undefined&&!/^[a-f0-9]{64}$/i.test(work.sha256))return null;
  if(work.analysis!==undefined&&!plain(work.analysis))return null;
  if(work.analysis?.yearRange!==undefined&&work.analysis.yearRange!==null&&(!Array.isArray(work.analysis.yearRange)||work.analysis.yearRange.length!==2||!work.analysis.yearRange.every(Number.isFinite)||work.analysis.yearRange[1]<work.analysis.yearRange[0]))return null;
  if(work.analysis?.curatorialFacets!==undefined&&!plain(work.analysis.curatorialFacets))return null;
  try{
  const snapshot=Object.fromEntries(knownFields.filter(key=>work[key]!==undefined).map(key=>[key,structuredClone(work[key])]));
  if(work.analysis?.curatorialFacets)snapshot.analysis={curatorialFacets:structuredClone(work.analysis.curatorialFacets)};
  if(work.analysis?.yearRange)snapshot.analysis={...snapshot.analysis,yearRange:structuredClone(work.analysis.yearRange)};
  if(typeof work.analysis?.movementKey==='string')snapshot.analysis={...snapshot.analysis,movementKey:work.analysis.movementKey};
  return snapshot;
  }catch{return null;}
}
export const personalGalleryWorkIds=gallery=>unique((gallery?.rooms||[]).flatMap(room=>Object.values(room.layout||{})));
export function validPersonalGalleries(state){
  if(!plain(state)||state.version!==1||state.protocol!==PERSONAL_GALLERIES_PROTOCOL||!Array.isArray(state.galleries)||state.galleries.length>100)return false;
  const galleries=new Set();
  for(const gallery of state.galleries){
    if(!plain(gallery)||!identifier(gallery.id)||galleries.has(gallery.id)||!name(gallery.title)||!validTime(gallery.createdAt)||!validTime(gallery.updatedAt)||gallery.updatedAt<gallery.createdAt||!Array.isArray(gallery.rooms)||gallery.rooms.length>24||!plain(gallery.workSnapshots))return false;galleries.add(gallery.id);
    const rooms=new Set(),paintings=new Set();
    for(const [workId,work]of Object.entries(gallery.workSnapshots))if(workId!==work?.id||!personalWorkSnapshot(work))return false;
    for(const room of gallery.rooms){
      if(!plain(room)||!identifier(room.id)||rooms.has(room.id)||!name(room.name,60)||!plain(room.layout))return false;rooms.add(room.id);
      for(const [slot,workId]of Object.entries(room.layout)){if(!slotIds.has(slot)||!identifier(workId)||paintings.has(workId)||!Object.hasOwn(gallery.workSnapshots,workId))return false;paintings.add(workId);}
    }
    if(Object.hasOwn(gallery,'floorPlan')&&!validFloorPlan(gallery.floorPlan,rooms))return false;
  }
  return true;
}
export const emptyPersonalGalleries=()=>({version:1,protocol:PERSONAL_GALLERIES_PROTOCOL,galleries:[]});
export function readPersonalGalleries(raw){
  if(raw===null||raw===undefined||raw==='')return {ok:true,state:emptyPersonalGalleries(),unreadableSource:null};
  let source;try{source=typeof raw==='string'?JSON.parse(raw):raw;}catch{return {ok:false,state:null,unreadableSource:raw};}
  return validPersonalGalleries(source)?{ok:true,state:structuredClone(source),unreadableSource:null}:{ok:false,state:null,unreadableSource:raw};
}
const failure=(state,message)=>({ok:false,state,message});
function edit(state,galleryId,change,now){
  if(!validPersonalGalleries(state))return failure(state,'These saved galleries could not be read.');
  const next=structuredClone(state),gallery=next.galleries.find(item=>item.id===galleryId);if(!gallery)return failure(state,'That gallery is unavailable.');
  const result=change(gallery);if(result?.ok===false)return failure(state,result.message);
  gallery.updatedAt=Math.max(gallery.updatedAt,validTime(now)?now:Date.now());
  return validPersonalGalleries(next)?{ok:true,state:next,galleryId,...result}:failure(state,'The change could not be saved.');
}
export function addPersonalGallery(state,{title='Untitled gallery',now=Date.now(),galleryId=id('gallery',now),roomId=id('room',now)}={}){
  if(!validPersonalGalleries(state)||state.galleries.length>=100||!name(title)||!validTime(now)||!identifier(galleryId)||state.galleries.some(item=>item.id===galleryId)||!identifier(roomId))return failure(state,'Choose a name for the new gallery.');
  const next=structuredClone(state);next.galleries.push({id:galleryId,title:title.trim(),createdAt:now,updatedAt:now,rooms:[{id:roomId,name:'Room 1',layout:{}}],floorPlan:{[roomId]:{...floorCentre}},workSnapshots:{}});return {ok:true,state:next,galleryId,roomId};
}
export function renamePersonalGallery(state,galleryId,title,now=Date.now()){
  return edit(state,galleryId,gallery=>{if(!name(title))return {ok:false,message:'Give the gallery a name of up to 80 characters.'};gallery.title=title.trim();},now);
}
export function addPersonalRoom(state,galleryId,{roomName:label,now=Date.now(),roomId=id('room',now),nearRoomId}={}){
  return edit(state,galleryId,gallery=>{
    if(gallery.rooms.length>=24)return {ok:false,message:'This gallery has 24 rooms. You can start another gallery.'};
    const title=label||'Room '+(gallery.rooms.length+1);
    if(!identifier(roomId)||gallery.rooms.some(room=>room.id===roomId)||!name(title,60))return {ok:false,message:'Choose another room name.'};
    const plan=personalRoomPositions(gallery);
    plan[roomId]=availableFloorCell(plan,nearRoomId);
    gallery.floorPlan=plan;
    gallery.rooms.push({id:roomId,name:title.trim(),layout:{}});
    return {roomId};
  },now);
}
export function movePersonalRoom(state,galleryId,roomId,position,now=Date.now()){
  return edit(state,galleryId,gallery=>{
    if(!gallery.rooms.some(room=>room.id===roomId))return {ok:false,message:'That room is unavailable.'};
    if(!validFloorCell(position))return {ok:false,message:'Choose a space inside the floor plan.'};
    const plan=personalRoomPositions(gallery),destination=floorCellKey(position);
    const swap=gallery.rooms.find(other=>other.id!==roomId&&floorCellKey(plan[other.id])===destination);
    if(swap)plan[swap.id]=plan[roomId];
    plan[roomId]={column:position.column,row:position.row};
    gallery.floorPlan=plan;
    return {roomId,swappedRoomId:swap?.id||null};
  },now);
}
export function renamePersonalRoom(state,galleryId,roomId,title,now=Date.now()){
  return edit(state,galleryId,gallery=>{const room=gallery.rooms.find(room=>room.id===roomId);if(!room||!name(title,60))return {ok:false,message:'Give the room a name of up to 60 characters.'};room.name=title.trim();return {roomId};},now);
}
export function removePersonalRoom(state,galleryId,roomId,now=Date.now()){
  return edit(state,galleryId,gallery=>{
    const room=gallery.rooms.find(room=>room.id===roomId);
    if(!room)return {ok:false,message:'That room is unavailable.'};
    if(Object.keys(room.layout).length)return {ok:false,message:'Move or remove the paintings before removing this room.'};
    const plan=personalRoomPositions(gallery);
    delete plan[roomId];
    gallery.floorPlan=plan;
    gallery.rooms=gallery.rooms.filter(room=>room.id!==roomId);
    return {roomId:gallery.rooms[0]?.id||null};
  },now);
}
export function placePersonalWork(state,galleryId,roomId,slotId,workId,works,{now=Date.now()}={}){
  return edit(state,galleryId,gallery=>{
    const room=gallery.rooms.find(room=>room.id===roomId);if(!room||!slotIds.has(slotId))return {ok:false,message:'Choose a wall space.'};
    const matches=Array.isArray(works)?works.filter(work=>work?.id===workId):[],snapshot=Object.hasOwn(gallery.workSnapshots,workId)?gallery.workSnapshots[workId]:matches.length===1?personalWorkSnapshot(matches[0]):null;
    if(!snapshot)return {ok:false,message:'That painting is unavailable.'};
    let origin=null;for(const otherRoom of gallery.rooms)for(const [slot,placedId]of Object.entries(otherRoom.layout))if(placedId===workId)origin={room:otherRoom,slot};
    const occupied=room.layout[slotId];if(occupied&&occupied!==workId&&!origin)return {ok:false,message:'Choose an empty wall space, or remove this painting first.'};
    if(origin){delete origin.room.layout[origin.slot];if(occupied&&occupied!==workId)origin.room.layout[origin.slot]=occupied;}
    room.layout[slotId]=workId;gallery.workSnapshots[workId]=structuredClone(snapshot);return {roomId,workId};
  },now);
}
export function removePersonalWork(state,galleryId,workId,now=Date.now()){
  return edit(state,galleryId,gallery=>{let found=false;for(const room of gallery.rooms)for(const [slot,id]of Object.entries(room.layout))if(id===workId){delete room.layout[slot];found=true;}return found?{workId}:{ok:false,message:'This painting is not on a wall.'};},now);
}
export function resolvePersonalWork(gallery,workId,works=[]){
  const snapshot=gallery?.workSnapshots?.[workId];if(!snapshot)return {work:null,unavailable:true};
  const current=works.filter(work=>work?.id===workId);
  const conflict=current.length>1||current.length===1&&['title','artist','sourceUrl','image'].some(key=>(snapshot[key]??null)!==(current[0][key]??null));
  return {work:structuredClone(snapshot),unavailable:conflict,fromSnapshot:true};
}
export function personalGallerySearch(works,query=''){
  const terms=normal(query).split(' ').filter(Boolean),counts=new Map();for(const work of works||[])counts.set(work?.id,(counts.get(work?.id)||0)+1);
  return (works||[]).filter(work=>counts.get(work?.id)===1&&personalWorkSnapshot(work)&&terms.every(term=>normal([work.title,work.shortTitle,work.artist,work.date,work.country,work.movement,work.museum].join(' ')).includes(term)));
}

/** Completed quiz galleries use their own saved catalogue and remain read-only.
 * Archives are supplied by the caller after any read-only archive lookup.
 */
export function extractQuizGalleries(sessions=[]){
  const candidates=[],unavailable=[];
  for(const session of sessions){
    if(!plain(session)||session.unavailable||!identifier(session.manifest?.id)){if(session?.archiveStorage)unavailable.push({studyId:session.id,reason:'The saved quiz could not be opened.'});continue;}
    const pool=session.manifest.catalogue;if(!Array.isArray(pool)||new Set(pool.map(work=>work?.id)).size!==pool.length)continue;
    const shown=plain(session.shown)?session.shown:Object.fromEntries((Array.isArray(session.rounds)?session.rounds:[]).map(round=>[round.id,round]));
    for(const [roundId,answer]of Object.entries(plain(session.answers)?session.answers:{})){
      const record=answer?.record;if(!plain(answer)||record?.kind!=='curate'||record.confirmed!==true||answer.skipped)continue;
      const definition=shown[roundId],offered=definition?.workIds;
      if(definition?.id!==roundId||definition.kind!=='exercise'||definition.exerciseKind!=='curate'||!Array.isArray(offered)||new Set(offered).size!==offered.length||!Array.isArray(answer.workIds)||answer.workIds.join('|')!==offered.join('|')||!Array.isArray(record.offeredIds)||record.offeredIds.length!==offered.length||record.offeredIds.some(id=>!offered.includes(id)))continue;
      let valid=false;try{valid=isGallery(record)?validGallery(record,pool):validScenario(record,pool);}catch{}if(!valid){unavailable.push({studyId:session.manifest.id,recordId:record.id,reason:'The original room arrangement is unavailable.',sourceRecord:structuredClone(record)});continue;}
      const workIds=isGallery(record)?Object.keys(record.placements):SLOT_IDS.map(slot=>record.layout[slot]).filter(Boolean),sourceWorks=pool.filter(work=>workIds.includes(work.id));
      const workSnapshots=Object.fromEntries(sourceWorks.flatMap(work=>{const snapshot=personalWorkSnapshot(work);return snapshot?[[work.id,snapshot]]:[];}));
      const rooms=isGallery(record)?ROOMS.map(room=>({id:room.id,name:roomName(record,room.id),workIds:workIds.filter(id=>roomOf(record,id)===room.id)})).filter(room=>room.workIds.length):[0,1,2].map(index=>({id:'legacy-room-'+index,name:record.roomNames?.[index]||'Room '+(index+1),workIds:SLOT_IDS.slice(index*2,index*2+2).map(slot=>record.layout[slot]).filter(Boolean)}));
      candidates.push({id:'quiz:'+session.manifest.id+':'+record.id,quiz:true,title:'Quiz gallery',sourceStudyId:session.manifest.id,roundId,finishedAt:record.finishedAt||session.finishedAt||session.manifest.createdAt||0,rooms,workSnapshots,sourceRecord:structuredClone(record),scope:'Original completed quiz arrangement. Browsing does not change its rooms, answers or profile evidence.'});
    }
  }
  const counts=new Map();for(const gallery of candidates)counts.set(gallery.id,(counts.get(gallery.id)||0)+1);
  return {galleries:candidates.filter(gallery=>counts.get(gallery.id)===1).sort((a,b)=>b.finishedAt-a.finishedAt),unavailable};
}

function reviewedTags(work){
  const facet=work.analysis?.curatorialFacets;if(facet?.version!=='curatorial-facets-v1'||facet.reviewed!==true||facet.reviewedImage!==work.image||!Array.isArray(facet.sourceUrls)||!facet.sourceUrls.includes(work.sourceUrl)||!Array.isArray(facet.tags)||facet.tags.some(tag=>!Object.hasOwn(tagLabels,tag))||!/^[a-f0-9]{64}$/i.test(facet.reviewedImageSha256||'')||work.sha256!==undefined&&work.sha256!==facet.reviewedImageSha256)return null;
  return facet.tags;
}
const tagLabels={'narrative-detail':'narrative clues','imagined-world':'imagined worlds','dramatic-light':'dramatic light','layered-space':'layered space','geometric-structure':'geometric structure','visible-gesture':'bodily gestures','intimate-figures':'near-view figures',landscape:'landscape'};
/** Collection links, not a world-museum model or a preference score. */
export function personalMuseumConnections(selectedWorks=[],catalogue=[],museumFacts=MUSEUMS){
  const counts=new Map();for(const work of Array.isArray(selectedWorks)?selectedWorks:[])counts.set(work?.id,(counts.get(work?.id)||0)+1);
  const selected=(Array.isArray(selectedWorks)?selectedWorks:[]).filter(work=>counts.get(work?.id)===1&&personalWorkSnapshot(work));if(!selected.length)return [];
  catalogue=Array.isArray(catalogue)?catalogue:[];museumFacts=Array.isArray(museumFacts)?museumFacts:[];
  const catalogueCounts=new Map();for(const work of catalogue)catalogueCounts.set(work?.id,(catalogueCounts.get(work?.id)||0)+1);catalogue=catalogue.filter(work=>catalogueCounts.get(work?.id)===1);
  const institutions=new Map();
  for(const work of catalogue){if(!personalWorkSnapshot(work)||!useful(work.museum)||/private collection|artist.s collection|location unknown/i.test(work.museum))continue;const key=normal(work.museum),old=institutions.get(key)||{name:work.museum,works:[],fact:null};old.works.push(work);institutions.set(key,old);}
  for(const museum of museumFacts){if(!useful(museum.name)||!link(museum.sourceUrl))continue;const key=normal(museum.name),old=institutions.get(key)||{name:museum.name,works:[],fact:null};old.fact=museum;institutions.set(key,old);}
  const results=[];
  for(const [key,institution]of institutions){
    const held=selected.filter(work=>normal(work.museum)===key&&link(work.sourceUrl)),artists=selected.filter(work=>!held.some(other=>other.id===work.id)&&work.artistKnown!==false&&useful(work.artist)&&institution.fact?.artists?.some(artist=>normal(artist)===normal(work.artist))),themePairs=[],usedSampleWorks=new Set();
    for(const work of selected){
      if(held.some(other=>other.id===work.id))continue;
      const tags=reviewedTags(work),matches=institution.works.filter(other=>other.id!==work.id).flatMap(other=>{
        const otherTags=reviewedTags(other),shared=tags&&otherTags?tags.filter(tag=>otherTags.includes(tag)&&Object.hasOwn(tagLabels,tag)):[],sameMovement=useful(work.movement)&&useful(other.movement)&&normal(work.analysis?.movementKey||work.movement)===normal(other.analysis?.movementKey||other.movement);
        return shared.length>=2||sameMovement?[{workId:work.id,institutionWorkId:other.id,connections:[...(sameMovement?[work.movement]:[]),...shared.map(tag=>tagLabels[tag])],sourceUrl:other.sourceUrl}]:[];
      }).sort((a,b)=>b.connections.length-a.connections.length);
      const chosen=matches.find(pair=>!usedSampleWorks.has(pair.institutionWorkId))||matches[0];if(chosen){themePairs.push(chosen);usedSampleWorks.add(chosen.institutionWorkId);}
    }
    const themes=themePairs.length>=2&&new Set(themePairs.map(pair=>pair.institutionWorkId)).size>=2?themePairs:[];
    if(!held.length&&!artists.length&&!themes.length)continue;
    const direct=held.length>0,sourceUrl=direct?held[0].sourceUrl:institution.fact?.sourceUrl||institution.works.find(work=>themes.some(pair=>pair.institutionWorkId===work.id))?.sourceUrl;
    if(!link(sourceUrl))continue;
    const connections=unique(themes.flatMap(pair=>pair.connections));
    results.push({id:'collection-'+key.replaceAll(' ','-'),name:institution.name,title:institution.name,sourceUrl,visitUrl:institution.fact?.visitUrl||sourceUrl,city:institution.fact?.city||'',country:institution.fact?.country||'',basis:direct?'Paintings in this collection':artists.length?'Artists represented here':'Connections in our collection sample',text:direct?`${held.length} of your selected paintings ${held.length===1?'is':'are'} identified with this collection in the artwork records.`:artists.length?`This collection represents ${unique(artists.map(work=>work.artist)).join(', ')}.`:`Other paintings from this collection in our library share ${connections.slice(0,3).join(', ')} with works in your gallery.`,heldWorkIds:held.map(work=>work.id),artistWorkIds:artists.map(work=>work.id),themePairs:themes,workIds:unique([...held,...artists].map(work=>work.id).concat(themes.map(pair=>pair.workId))),catalogueWorkIds:unique(themes.map(pair=>pair.institutionWorkId)),sourceUrls:unique([sourceUrl,...held.map(work=>work.sourceUrl),...(institution.fact?[institution.fact.sourceUrl]:[]),...themes.map(pair=>pair.sourceUrl)]),coverage:{galleryWorks:selected.length,heldWorks:held.length,artistConnections:artists.length,sampledThemeConnections:themes.length,institutionWorksInLibrary:institution.works.length},limits:['These are collection connections within the sourced library, not a search of every museum or a measured world-closest match.','A collection record does not guarantee that the painting is currently on display.','Arranging paintings here is a creative choice. These free galleries are not added to quiz preference evidence.']});
  }
  return results.sort((a,b)=>b.heldWorkIds.length-a.heldWorkIds.length||b.artistWorkIds.length-a.artistWorkIds.length||b.themePairs.length-a.themePairs.length);
}
