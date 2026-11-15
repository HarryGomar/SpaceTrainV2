import { analyzeGallery } from './gallery-analysis.mjs';
import { analyzeRoomDecisions } from './room-study-analysis.mjs';
import {museumLibraryOrder} from './curation-priority.mjs';

export const GALLERY_PROTOCOL='open-gallery-v1';
export const ROOM_STUDY='room-relations-v1';
export const ROOM_PROMPTS=[
  {id:'entryId',title:'Which painting would you begin with?',hint:'Choose a painting on the plan.'},
  {id:'lingerRoomId',title:'Where would you spend the longest?',hint:'Choose one of the rooms you filled.'},
  {id:'bridgeIds',title:'Which two works connect across rooms?',hint:'Choose two paintings in different rooms. A connection can cross a boundary you made.'}
];
export const ROOMS=[
  {id:'g1',number:'01',x:30,y:30,w:300,h:330},
  {id:'g2',number:'02',x:330,y:30,w:340,h:330},
  {id:'g3',number:'03',x:670,y:30,w:300,h:330},
  {id:'g4',number:'04',x:30,y:360,w:300,h:370},
  {id:'g5',number:'05',x:670,y:360,w:300,h:370}
];
export const CONNECTIONS=[['hall','g2'],['hall','g4'],['hall','g5'],['g1','g2'],['g2','g3'],['g1','g4'],['g3','g5']];
const gaps={g1:{east:[[140,220]],south:[[140,220]]},g2:{west:[[140,220]],east:[[140,220]],south:[[460,540]]},g3:{west:[[140,220]],south:[[780,860]]},g4:{north:[[140,220]],east:[[500,580]]},g5:{north:[[780,860]],west:[[500,580]]}};
export const WALLS=ROOMS.flatMap(room=>['north','east','south','west'].flatMap(side=>{
  const horizontal=side==='north'||side==='south',start=horizontal?room.x:room.y,end=start+(horizontal?room.w:room.h),cuts=gaps[room.id]?.[side]||[];
  const intervals=[];let previous=start;for(const [a,b] of cuts){intervals.push([previous,a]);previous=b;}intervals.push([previous,end]);
  return intervals.map(([a,b],i)=>({id:room.id+'-'+side+'-'+i,roomId:room.id,side,x1:horizontal?a:side==='west'?room.x:room.x+room.w,y1:horizontal?(side==='north'?room.y:room.y+room.h):a,x2:horizontal?b:side==='west'?room.x:room.x+room.w,y2:horizontal?(side==='north'?room.y:room.y+room.h):b,length:b-a}));
}));
export const isGallery=r=>r?.kind==='curate'&&r.version===2&&r.protocol===GALLERY_PROTOCOL;
export const roomName=(record,id)=>record.roomNames?.[id]||'Gallery '+(ROOMS.find(r=>r.id===id)?.number||id);
export const galleryIds=record=>Object.keys(record.placements||{});
export const roomOf=(record,id)=>WALLS.find(w=>w.id===record.placements?.[id]?.wallId)?.roomId;
export function mountBox(wall,t){const [x,y]=wallPoint(wall,t),width=76,height=68;return {x:wall.side==='west'?x+8:wall.side==='east'?x-8-width:x-width/2,y:wall.side==='north'?y+8:wall.side==='south'?y-8-height:y-height/2,width,height};}
const overlap=(a,b)=>a.x<b.x+b.width+8&&a.x+a.width+8>b.x&&a.y<b.y+b.height+8&&a.y+a.height+8>b.y;
// Visible suggestions share the real placement geometry. They are alternatives,
// never reservations or measurements of how much art a room must contain.
export function gallerySlots(record){
  const occupied=Object.values(record.placements).map(p=>({wall:WALLS.find(w=>w.id===p.wallId),t:p.t})),slots=[];
  for(const wall of [...WALLS].sort((a,b)=>b.length-a.length)){
    const count=Math.floor((wall.length-80)/88)+1;if(count<1)continue;
    const ts=Array.from({length:count},(_,i)=>count===1?.5:(40+i*(wall.length-80)/(count-1))/wall.length);
    for(const t of ts){const box=mountBox(wall,t);if([...occupied,...slots.map(s=>({wall:WALLS.find(w=>w.id===s.wallId),t:s.t}))].some(p=>p.wall.roomId===wall.roomId&&(p.wall.id===wall.id&&Math.abs(p.t-t)*wall.length<88-.01||overlap(box,mountBox(p.wall,p.t)))))continue;slots.push({id:wall.id+'@'+t.toFixed(5),wallId:wall.id,roomId:wall.roomId,t});}
  }
  return slots;
}
export function createGalleryRecord(works,baselineAnswers={},options={}) {
  const id=options.id||'gallery-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),prioritised=options.presentationOrder==='landmark-first-v1',offeredIds=(prioritised?museumLibraryOrder(works):works).map(w=>w.id);let seed=[...id].reduce((s,c)=>(Math.imul(s,31)+c.charCodeAt(0))>>>0,2166136261);
  if(!prioritised)for(let i=offeredIds.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[offeredIds[i],offeredIds[j]]=[offeredIds[j],offeredIds[i]];}
  return {version:2,kind:'curate',protocol:GALLERY_PROTOCOL,id,createdAt:options.now||Date.now(),offeredIds,presentationOrder:prioritised?'landmark-first-v1':'seeded-shuffle-v1',presentedIds:[],placements:{},roomNames:Object.fromEntries(ROOMS.map(r=>[r.id,''])),baselineAnswers:structuredClone(baselineAnswers),labelExposureIds:[],...(options.roomStudy===false?{}:{roomStudy:ROOM_STUDY,phase:'arrange',roomStep:0,roomResponses:{}})};
}
export function validRoomResponses(record,complete=false){
  const a=record.roomResponses;
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!ROOM_PROMPTS.some(p=>p.id===k)))return false;
  if(a.entryId!==undefined&&!record.placements[a.entryId])return false;
  if(a.lingerRoomId!==undefined&&!galleryIds(record).some(id=>roomOf(record,id)===a.lingerRoomId))return false;
  if(a.bridgeIds!==undefined&&(!Array.isArray(a.bridgeIds)||a.bridgeIds.length>2||new Set(a.bridgeIds).size!==a.bridgeIds.length||a.bridgeIds.some(id=>!record.placements[id])||a.bridgeIds.length===2&&roomOf(record,a.bridgeIds[0])===roomOf(record,a.bridgeIds[1])))return false;
  return !complete||!!a.entryId&&!!a.lingerRoomId&&a.bridgeIds?.length===2;
}
export function galleryArrangementReady(record){
  const ids=galleryIds(record),counts=ROOMS.map(r=>ids.filter(id=>roomOf(record,id)===r.id).length);
  return ids.length>=6&&counts.filter(n=>n>=2).length>=2;
}
export function validGalleryDraft(record,works) {
  if(!isGallery(record)||typeof record.id!=='string'||!Array.isArray(record.offeredIds)||new Set(record.offeredIds).size!==record.offeredIds.length||record.offeredIds.length<6||!Array.isArray(record.presentedIds)||!record.placements||Array.isArray(record.placements)||typeof record.placements!=='object')return false;
  if(record.offeredIds.some(id=>!works.some(w=>w.id===id))||record.presentedIds.some(id=>!record.offeredIds.includes(id)))return false;
  if(!record.roomNames||typeof record.roomNames!=='object'||Array.isArray(record.roomNames)||Object.keys(record.roomNames).some(id=>!ROOMS.some(r=>r.id===id))||Object.values(record.roomNames).some(s=>typeof s!=='string'||s.length>60))return false;
  if(record.ui!==undefined&&record.ui!==null&&(typeof record.ui!=='object'||Array.isArray(record.ui)))return false;
  for(const [id,p] of Object.entries(record.placements)) {
    const wall=WALLS.find(w=>w.id===p?.wallId);if(!record.offeredIds.includes(id)||!wall||!Number.isFinite(p.t)||p.t<40/wall.length-1e-5||p.t>1-40/wall.length+1e-5)return false;
    for(const [other,q] of Object.entries(record.placements)){const otherWall=WALLS.find(w=>w.id===q?.wallId);if(other===id||!otherWall)continue;if(q.wallId===p.wallId&&Math.abs(q.t-p.t)*wall.length<88-.01)return false;if(otherWall.roomId===wall.roomId&&overlap(mountBox(wall,p.t),mountBox(otherWall,q.t)))return false;}
  }
  if(record.roomStudy!==undefined&&(record.roomStudy!==ROOM_STUDY||!['arrange','walkthrough'].includes(record.phase)||![0,1,2].includes(record.roomStep)||!validRoomResponses(record)))return false;
  return true;
}
export function validGallery(record,works,finished=true) {
  return validGalleryDraft(record,works)&&galleryIds(record).length>=4&&galleryIds(record).every(id=>record.presentedIds.includes(id))&&(!record.roomStudy||galleryArrangementReady(record)&&record.phase==='walkthrough'&&validRoomResponses(record,true))&&(!finished||record.confirmed===true&&Number.isFinite(record.finishedAt));
}
export function wallPoint(wall,t){return [wall.x1+(wall.x2-wall.x1)*t,wall.y1+(wall.y2-wall.y1)*t];}
export function nearestWall(x,y,preferredRoom=null) {
  const choices=WALLS.map(w=>{const room=ROOMS.find(r=>r.id===w.roomId),horizontal=w.y1===w.y2,t=Math.max(0,Math.min(1,horizontal?(x-w.x1)/w.length:(y-w.y1)/w.length)),point=wallPoint(w,t),inside=x>=room.x-2&&x<=room.x+room.w+2&&y>=room.y-2&&y<=room.y+room.h+2;return {wall:w,t,distance:Math.hypot(x-point[0],y-point[1]),inside};}).filter(c=>c.inside&&c.distance<38).sort((a,b)=>a.distance-b.distance||(a.wall.roomId===preferredRoom?-1:1));
  return choices[0]||null;
}
export function placePainting(record,id,wallId,desired=.5) {
  const wall=WALLS.find(w=>w.id===wallId);if(!wall||!record.offeredIds.includes(id))return {record,ok:false};
  const min=40/wall.length,max=1-min,others=Object.entries(record.placements).filter(([key,p])=>key!==id&&p.wallId===wallId).map(([,p])=>p.t),clamp=t=>Math.max(min,Math.min(max,t));
  const candidates=[clamp(desired),min,max,...others.flatMap(t=>[t-90/wall.length,t+90/wall.length]),...Array.from({length:Math.ceil(wall.length/3)},(_,i)=>min+i*3/wall.length)].filter(t=>t>=min-1e-6&&t<=max+1e-6&&others.every(other=>Math.abs(other-t)*wall.length>=88)&&Object.entries(record.placements).filter(([key])=>key!==id).every(([,p])=>{const otherWall=WALLS.find(w=>w.id===p.wallId);return otherWall.roomId!==wall.roomId||!overlap(mountBox(wall,t),mountBox(otherWall,p.t));}));
  candidates.sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));if(!candidates.length)return {record,ok:false,reason:'This stretch of wall is full. Choose another wall.'};
  const next=structuredClone(record);next.placements[id]={wallId,t:Math.round(candidates[0]*100000)/100000};next.presentedIds=[...new Set([...next.presentedIds,id])];next.confirmed=false;delete next.finishedAt;
  if(next.roomStudy){next.phase='arrange';next.roomStep=0;next.roomResponses={};}
  return {record:next,ok:true};
}
export function roomAt(x,y){return ROOMS.find(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)||null;}
// The whole floor is a target. Exact wall positions are chosen for legibility when
// a drop is far from a wall; only room membership is evidence from those drops.
export function placeInRoom(record,id,roomId,x,y){
  const room=ROOMS.find(r=>r.id===roomId);if(!room)return {record,ok:false,reason:'Choose one of the five rooms.'};
  x=Number.isFinite(x)?x:room.x+room.w/2;y=Number.isFinite(y)?y:room.y+room.h/2;
  const choices=WALLS.filter(w=>w.roomId===roomId).map(w=>{
    const t=Math.max(0,Math.min(1,w.x1===w.x2?(y-w.y1)/w.length:(x-w.x1)/w.length)),result=placePainting(record,id,w.id,t);
    if(!result.ok)return null;const p=result.record.placements[id],[px,py]=wallPoint(w,p.t);
    return {result,distance:Math.hypot(x-px,y-py)};
  }).filter(Boolean).sort((a,b)=>a.distance-b.distance);
  if(!choices.length)return {record,ok:false,reason:'This room is full. Choose another room or put a work back.'};
  const {result,distance}=choices[0];result.record.placements[id].intent=distance<=38?'wall-drop':'room-drop';
  return result;
}
export function nextArtwork(record,from,direction=1,onlyUnplaced=true) {
  const ids=record.offeredIds,index=ids.indexOf(from);for(let i=1;i<=ids.length;i++){const id=ids[(index+direction*i+ids.length*2)%ids.length];if(!onlyUnplaced||!record.placements[id])return id;}return from;
}
export function galleryFindings(works,record,previous=[]) {return [...analyzeGallery(works,record,WALLS,previous),...analyzeRoomDecisions(works,record,WALLS,CONNECTIONS)].sort((a,b)=>b.priority-a.priority);}
