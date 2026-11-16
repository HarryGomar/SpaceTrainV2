import { FEATURES, feature, buildRounds, validAnswer } from './engine.mjs';
import { isGallery,createGalleryRecord,validGalleryDraft,validGallery,galleryIds,roomOf,galleryFindings } from './gallery-model.mjs';
import { isSorting,createSortingRecord,validSortingDraft,validSorting,sortingIds,analyzeSorting } from './sorting-table.mjs';
import { isDifficultEdit,createDifficultEditRecord,validDifficultEditDraft,validDifficultEdit,difficultEditIds,analyzeDifficultEdit } from './difficult-edit.mjs';

export const SCENARIOS = [
  { id:'sorting', title:'Sorting table.', short:'Sorting table', description:'Arrange eight paintings freely. Bring related works together and leave space between those that feel apart.', instruction:'Put works that belong together near each other. You decide what connects them.' },
  { id:'difficult-edit', title:'Difficult edit.', short:'Difficult edit', description:'Four works, three places. Choose the painting to leave out.', instruction:'Keep three paintings that work together. Put one back.' },
  { id:'curate', title:'Build your museum.', short:'Your museum', description:'Place paintings in five connected rooms. Make your own groups, then choose a starting work, a longer stop and a connection across rooms.', instruction:'Put paintings that belong together in the same room. You decide the groups.' },
  { id:'pair', title:'Choose a companion.', short:'A neighbouring work', description:'One painting is already on the wall. Choose the work you would hang beside it.', instruction:'Choose one work to hang beside the painting on the left. A shared quality or a deliberate contrast can both work.' },
  { id:'bridge', title:'Connect two rooms.', short:'A transition', description:'Find a painting that can carry a visitor between two different parts of an exhibition.', instruction:'Choose a work that makes the transition between these two paintings interesting to you.' },
  { id:'edit', title:'One wall. Two places.', short:'The edit', description:'Three works are available. Keep two together and put one back.', instruction:'Choose the painting you would put back. Think about this wall as a pair, rather than ranking three individual favourites.' }
];
export const SLOT_IDS = ['r1a','r1b','r2a','r2b','r3a','r3b'];
export const SLOT_LABELS = ['Opening work · Room 1','Second work · Room 1','First work · Room 2','Second work · Room 2','First work · Room 3','Closing work · Room 3'];
export const ROOM_STUDY = 'three-briefs-v1';
export const ROOM_BRIEFS = [
  {id:'opening',title:'First encounter',prompt:'Choose two works you would want to see first.'},
  {id:'study',title:'A closer look',prompt:'Choose two works you would spend time trying to understand.'},
  {id:'return',title:'Another visit',prompt:'Choose two works you would come back to see again.'}
];
export const ROOM_QUESTIONS = [
  {id:'lastMinutes',title:'Five minutes left.',prompt:'Which room gets the rest of your time?',context:'Choose for yourself.'},
  {id:'guest',title:'Someone joins you.',prompt:'Someone who is new to art can see only one room. Which would you choose for them?',context:'Choose for a new visitor.'}
];
export const hasRoomBriefs = record => record?.kind==='curate' && record.roomStudy===ROOM_STUDY;
export const roomWorkIds = (record,roomId) => {const index=ROOM_BRIEFS.findIndex(r=>r.id===roomId);return index<0?[]:SLOT_IDS.slice(index*2,index*2+2).map(slot=>record.layout[slot]).filter(Boolean);};
export function upgradeEmptyExhibition(record) {
  if(record?.kind!=='curate' || record.roomStudy!==undefined || Object.keys(record.layout||{}).length)return record;
  return {...record,roomStudy:ROOM_STUDY,phase:'arrange',roomStep:0,roomResponses:{}};
}
export function resetRoomResponses(record) {
  const next=structuredClone(record);
  if(hasRoomBriefs(next)){next.phase='arrange';next.roomStep=0;next.roomResponses={};}
  delete next.finishedAt;next.confirmed=false;return next;
}
export const REASONS = ['Visual appearance','Subject','Atmosphere','Deliberate contrast','Personal connection','Hard to say'];
const idList = works => works.map(w=>w.id);
const get = (works,id) => works.find(w=>w.id===id);
const unique = values => [...new Set(values.filter(Boolean))];
const title = w => w.shortTitle || w.title;
const average = values => values.reduce((s,v)=>s+v,0) / (values.length || 1);
const difference = (a,b,key) => Math.abs(feature(a,key)-feature(b,key));
const distance = (a,b) => average(FEATURES.map(key=>difference(a,b,key)));
export const selectedIds = record => isSorting(record)?sortingIds(record):isDifficultEdit(record)?difficultEditIds(record):isGallery(record)?galleryIds(record):record.kind === 'curate' ? SLOT_IDS.map(slot=>record.layout?.[slot]).filter(Boolean) : record.kind === 'edit' ? record.offeredIds.filter(id=>id!==record.choiceId) : record.choiceId ? unique([...record.anchorIds,record.choiceId]) : [];
export const validKind = kind => SCENARIOS.some(s=>s.id===kind);

function candidates(works, excluded, count) {
  if (count<=0) return [];
  const pool=works.filter(w=>!excluded.includes(w.id)), chosen=[];
  // A varied choice set. This does not isolate a feature or make a causal experiment.
  const mexican=pool.find(w=>w.country==='Mexico' && w.artistKnown!==false);
  if (mexican) chosen.push(mexican);
  while (chosen.length<count && chosen.length<pool.length) {
    const rest=pool.filter(w=>!chosen.includes(w));
    rest.sort((a,b)=> {
      const spread=w=>chosen.length ? Math.min(...chosen.map(other=>distance(w,other))) : feature(w,'atmosphere');
      return spread(b)-spread(a) || a.id.localeCompare(b.id);
    });
    chosen.push(rest[0]);
  }
  return chosen;
}
function rotateChoices(ids,seed) {
  const result=[...ids];let state=[...seed].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2166136261);
  for(let i=result.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function baselineQuartet(works, answers) {
  const r=buildRounds(works,answers)[0], a=answers?.preferenceRank;
  return validAnswer(r,a) ? [...r.works].sort((x,y)=>a.positions[y.id]-a.positions[x.id]) : r.works;
}
export function createScenario(kind, works, baselineAnswers={}, records=[], options={}) {
  if (!validKind(kind)) throw Error('Unknown scenario.');
  if(kind==='sorting')return createSortingRecord(works,baselineAnswers,records,options);
  if(kind==='difficult-edit')return createDifficultEditRecord(works,baselineAnswers,records,options);
  if(kind==='curate'&&!options.legacy)return createGalleryRecord(works,baselineAnswers,options);
  const quartet=baselineQuartet(works,baselineAnswers), exhibition=[...records].reverse().find(r=>r.kind==='curate' && validScenario(r,works));
  const base={ version:1, id:options.id || 'scenario-'+Date.now()+'-'+Math.random().toString(36).slice(2,8), kind, createdAt:options.now || Date.now(), baselineAnswers:structuredClone(baselineAnswers), presentedIds:[], reason:null };
  if (kind==='curate') {
    const core=buildRounds(works,baselineAnswers)[0].works;
    const additions=works.filter(w=>w.coreQuiz===false), chosen=[...core];
    for (const w of additions.filter(w=>w.country==='Mexico' && w.artistKnown!==false).slice(0,2)) if(!chosen.includes(w)) chosen.push(w);
    for (const country of ['Brazil','Uruguay','Ethiopia','India','Korea','Nepal','China']) {
      const next=additions.find(w=>w.country===country && !chosen.includes(w)); if(next && chosen.length<12) chosen.push(next);
    }
    for (const w of candidates(works,idList(chosen),12-chosen.length)) chosen.push(w);
    // Interleave the reference quartet and other traditions across three four-work trays.
    const arranged=[chosen[0],chosen[4],chosen[8],chosen[2],chosen[5],chosen[1],chosen[9],chosen[6],chosen[3],chosen[7],chosen[10],chosen[11]].filter(Boolean);
    return upgradeEmptyExhibition({...base,offeredIds:idList(arranged),anchorIds:[],layout:{},roomNames:['','',''],page:0,presentedIds:idList(arranged.slice(0,4))});
  }
  const exhibitionIds=exhibition?selectedIds(exhibition):[],galleryPair=isGallery(exhibition)?exhibitionIds.filter(id=>roomOf(exhibition,id)===roomOf(exhibition,exhibitionIds[0])).slice(0,2):null;
  const anchors=kind==='bridge' ? exhibition ? isGallery(exhibition)?[exhibitionIds[0],exhibitionIds.find(id=>roomOf(exhibition,id)!==roomOf(exhibition,exhibitionIds[0]))||exhibitionIds.at(-1)]:[exhibition.layout.r1a,exhibition.layout.r3b] : [quartet[0].id,quartet.at(-1).id] : kind==='edit' ? exhibition ? isGallery(exhibition)?(galleryPair.length===2?galleryPair:exhibitionIds.slice(0,2)):[exhibition.layout.r1a,exhibition.layout.r1b] : idList(quartet.slice(0,2)) : [exhibitionIds[0] || quartet[0].id];
  let offered;
  if (kind==='edit') {
    const extra=works.filter(w=>!anchors.includes(w.id)).sort((a,b)=>distance(a,get(works,anchors[0]))-distance(b,get(works,anchors[0])) || a.id.localeCompare(b.id))[0];
    offered=[...anchors,extra.id];
  } else offered=idList(candidates(works,anchors,4));
  offered=rotateChoices(offered,base.id);
  return {...base,offeredIds:offered,anchorIds:anchors,presentedIds:unique([...anchors,...offered]),choiceId:null};
}
export function validScenarioDraft(record, works) {
  if(isSorting(record))return validSortingDraft(record,works);
  if(isDifficultEdit(record))return validDifficultEditDraft(record,works);
  if(isGallery(record))return validGalleryDraft(record,works);
  if (!record || record.version!==1 || !validKind(record.kind) || typeof record.id!=='string' || !Array.isArray(record.offeredIds) || !Array.isArray(record.anchorIds) || !Array.isArray(record.presentedIds)) return false;
  const all=idList(works), offered=record.offeredIds, anchors=record.anchorIds;
  if (unique(offered).length!==offered.length || unique(anchors).length!==anchors.length || [...offered,...anchors,...record.presentedIds].some(id=>!all.includes(id))) return false;
  if (record.reason!==null && record.reason!==undefined && !REASONS.includes(record.reason)) return false;
  if (record.kind==='curate') {
    if (offered.length!==12 || anchors.length || !record.layout || !Array.isArray(record.roomNames) || record.roomNames.length!==3 || record.roomNames.some(v=>typeof v!=='string' || v.length>80)) return false;
    if(record.roomStudy!==undefined && !hasRoomBriefs(record))return false;
    if(hasRoomBriefs(record)) {
      if(!['arrange','walkthrough'].includes(record.phase) || ![0,1].includes(record.roomStep) || !record.roomResponses || Array.isArray(record.roomResponses) || typeof record.roomResponses!=='object')return false;
      if(Object.entries(record.roomResponses).some(([key,id])=>!ROOM_QUESTIONS.some(q=>q.id===key)||!ROOM_BRIEFS.some(r=>r.id===id)))return false;
      if(record.phase==='arrange' && Object.keys(record.roomResponses).length)return false;
      if(record.phase==='walkthrough' && (!SLOT_IDS.every(slot=>record.layout[slot]) || !offered.every(id=>record.presentedIds.includes(id)) || record.roomStep===1&&!record.roomResponses.lastMinutes))return false;
    }
    const entries=Object.entries(record.layout);
    return entries.every(([slot,id])=>SLOT_IDS.includes(slot) && offered.includes(id)) && unique(entries.map(([,id])=>id)).length===entries.length && record.presentedIds.every(id=>offered.includes(id));
  }
  if (offered.length!==(record.kind==='edit'?3:4) || anchors.length!==(record.kind==='bridge'||record.kind==='edit'?2:1)) return false;
  if (record.kind!=='edit' && offered.some(id=>anchors.includes(id))) return false;
  if (record.kind==='edit' && !anchors.every(id=>offered.includes(id))) return false;
  return !record.choiceId || offered.includes(record.choiceId);
}
export function validScenario(record,works,requireFinished=true) {
  if(isSorting(record))return validSorting(record,works,requireFinished);
  if(isDifficultEdit(record))return validDifficultEdit(record,works,requireFinished);
  if(isGallery(record))return validGallery(record,works,requireFinished);
  if (!validScenarioDraft(record,works) || requireFinished && (!Number.isFinite(record.finishedAt) || !record.confirmed)) return false;
  if (record.kind==='curate') return validArrangement(record,works) && (!hasRoomBriefs(record) || record.phase==='walkthrough' && ROOM_QUESTIONS.every(q=>record.roomResponses[q.id]));
  return record.offeredIds.includes(record.choiceId);
}
export function validArrangement(record,works) {
  if(isSorting(record))return validSorting(record,works,false);
  if(isDifficultEdit(record))return validDifficultEdit(record,works,false);
  if(isGallery(record))return validGallery(record,works,false);
  return record?.kind==='curate' && validScenarioDraft(record,works) && SLOT_IDS.every(slot=>record.layout[slot]) && record.offeredIds.every(id=>record.presentedIds.includes(id));
}
export function moveToSlot(record,id,slot) {
  if (record.kind!=='curate' || !record.offeredIds.includes(id) || !SLOT_IDS.includes(slot)) return record;
  const next=structuredClone(record), old=SLOT_IDS.find(key=>next.layout[key]===id), displaced=next.layout[slot];
  if (old===slot) return next;
  if (old) delete next.layout[old];
  if (displaced && old) next.layout[old]=displaced;
  next.layout[slot]=id; return resetRoomResponses(next);
}
function pairings(ids) {
  if(!ids.length) return [[]];
  const [first,...rest]=ids, result=[];
  rest.forEach((other,i)=> { for(const tail of pairings(rest.filter((_,j)=>j!==i))) result.push([[first,other],...tail]); });
  return result;
}
export function groupingEvidence(works,record) {
  if(record.kind!=='curate' || !validScenario(record,works)) return [];
  const chosen=selectedIds(record), observed=[chosen.slice(0,2),chosen.slice(2,4),chosen.slice(4,6)], alternatives=pairings(chosen);
  return FEATURES.map(key=> {
    const gap=pair=>difference(get(works,pair[0]),get(works,pair[1]),key), value=average(observed.map(gap)), distribution=alternatives.map(p=>average(p.map(gap)));
    const range=Math.max(...chosen.map(id=>feature(get(works,id),key)))-Math.min(...chosen.map(id=>feature(get(works,id),key)));
    return {key,value,range,mean:average(distribution),similarRank:1+distribution.filter(v=>v<value-1e-6).length,contrastRank:1+distribution.filter(v=>v>value+1e-6).length,pairCount:alternatives.length,pairs:observed.map((ids,i)=>({ids,room:i+1,gap:gap(ids)}))};
  });
}
const labels={abstraction:'abstraction',energy:'visual activity',complexity:'compositional density',humanity:'human presence',narrative:'depicted events',atmosphere:'setting and atmosphere',color:'colour intensity'};
const ev=(record,detail,ids)=>({roundId:'scenario:'+record.id,label:SCENARIOS.find(s=>s.id===record.kind).short,detail,workIds:unique(ids)});
function finding(record,id,titleText,text,support,options={}) {
  return {id:'scenario-'+record.id+'-'+id,title:titleText,text,kind:'curation',priority:8,support,counter:[],alternatives:[],...options,evidence:unique([...support,...(options.counter||[])].flatMap(e=>e.workIds))};
}
function roomReadings(works,record) {
  if(!hasRoomBriefs(record))return [];
  const findings=[],own=ROOM_BRIEFS.find(r=>r.id===record.roomResponses.lastMinutes),guest=ROOM_BRIEFS.find(r=>r.id===record.roomResponses.guest);
  const roomEvidence=(id,detail)=>ev(record,detail+' '+roomWorkIds(record,id).map(id=>title(get(works,id))).join(' beside ')+'.',roomWorkIds(record,id));
  const same=own.id===guest.id;
  findings.push(finding(record,'room-audience',same?'The same room served two different visits.':'Different rooms for you and a new visitor.',same?`You gave your last five minutes to "${own.title}" and chose that room to introduce a visitor who is new to art. The same pair met both of those briefs in this exhibition.`:`You gave your last five minutes to "${own.title}", but chose "${guest.title}" to introduce a visitor who is new to art. Your own final stop and your introduction used different pairs from the same exhibition.`,[roomEvidence(own.id,'Your choice for the last five minutes:'),roomEvidence(guest.id,'Your choice for a new visitor:')],{priority:same?9:14,alternatives:['The follow-up questions change both the audience and the available time. They cannot isolate which part explains the difference.','These are choices for an imagined visit. They do not establish actual viewing time, general expertise or a personality trait.']}));
  const rounds=buildRounds(works,record.baselineAnswers||{}),pref=record.baselineAnswers?.preferenceRank,interest=record.baselineAnswers?.interestRank;
  if(!validAnswer(rounds[0],pref))return findings;
  const pairs=roomWorkIds(record,'study').flatMap(a=>roomWorkIds(record,'return').map(b=>({a,b,gap:pref.positions[b]-pref.positions[a]}))).filter(p=>p.gap>=15).sort((a,b)=>b.gap-a.gap);
  const p=pairs[0];if(!p)return findings;
  const a=get(works,p.a),b=get(works,p.b),hasInterest=validAnswer(rounds.find(r=>r.id==='interestRank'),interest),curiosityGap=hasInterest?interest.positions[p.a]-interest.positions[p.b]:null;
  const baselineEvidence={roundId:'preferenceRank',label:'Earlier preference',detail:`${title(a)}: ${pref.positions[p.a]}; ${title(b)}: ${pref.positions[p.b]} on the preference scale.`,workIds:[p.a,p.b]};
  const curiosityEvidence=hasInterest?{roundId:'interestRank',label:'Earlier curiosity',detail:`${title(a)}: ${interest.positions[p.a]}; ${title(b)}: ${interest.positions[p.b]} on the curiosity scale.`,workIds:[p.a,p.b]}:null;
  let text=`You rated ${title(b)} above ${title(a)} for preference, then put ${title(a)} in "A closer look" and ${title(b)} in "Another visit".`;
  if(curiosityGap>=15)text+=` Your earlier curiosity order went the other way. The distinction between preference and study appeared in both the quiz and the exhibition.`;
  else text+=' A lower preference did not prevent a work from getting a place for study.';
  findings.push(finding(record,'room-study-preference','A place for study can differ from a place to return to.',text,[baselineEvidence,roomEvidence('study','Brief: choose two works to spend time trying to understand.'),roomEvidence('return','Brief: choose two works to come back to see again.'),...(curiosityGap>=15?[curiosityEvidence]:[])],{priority:curiosityGap>=15?15:12,counter:curiosityGap<=-15?[curiosityEvidence]:[],alternatives:['The room briefs explicitly distinguish study from a return visit. This connects responses in different formats; it does not establish an unconscious motive.','A pair has to work together and only two places were available in each room. The individual preference order may not describe that fit.',...(curiosityGap<=-15?['The earlier curiosity order also favoured the return-visit work. The study-room assignment does not reproduce that curiosity comparison.']:[])]}));
  return findings;
}
export function analyzeScenarios(works,records) {
  const valid=records.filter(r=>validScenario(r,works)), findings=[], exhibitions=valid.filter(r=>r.kind==='curate');
  const sorted=valid.filter(isSorting).at(-1),edited=valid.filter(isDifficultEdit).at(-1);
  if(sorted)findings.push(...analyzeSorting(works,sorted,valid.filter(r=>r.id!==sorted.id&&r.finishedAt<=sorted.createdAt)));
  if(edited)findings.push(...analyzeDifficultEdit(works,edited,valid.filter(r=>r.id!==edited.id&&r.finishedAt<=edited.createdAt)));
  const lastExhibition=exhibitions.at(-1),latest=isGallery(lastExhibition)?null:lastExhibition;
  if(isGallery(lastExhibition))findings.push(...galleryFindings(works,lastExhibition,exhibitions.filter(isGallery)));
  if(latest) {
    findings.push(...roomReadings(works,latest));
    const chosen=selectedIds(latest), omitted=latest.offeredIds.filter(id=>!chosen.includes(id));
    const dimensions=groupingEvidence(works,latest).filter(d=>d.range>=.4 && Math.abs(d.value-d.mean)>=.09 && (d.similarRank<=2 || d.contrastRank<=2)).sort((a,b)=>Math.abs(b.value-b.mean)-Math.abs(a.value-a.mean));
    if(dimensions.length) {
      const d=dimensions[0], similar=d.similarRank<=2;
      const support=d.pairs.map(p=>ev(latest,`Room ${p.room}${latest.roomNames[p.room-1]?' · '+latest.roomNames[p.room-1]:''}: ${p.ids.map(id=>title(get(works,id))).join(' beside ')}.`,p.ids));
      const exception=d.pairs.find(p=>similar?p.gap>=.35:p.gap<=.15);
      findings.push(finding(latest,'grouping',similar?`Similar ${labels[d.key]} within rooms.`:`Contrasts in ${labels[d.key]} within rooms.`,`This arrangement keeps ${labels[d.key]} ${similar?'more similar':'further apart'} within rooms than most other ways of pairing these same six works. The grouping is an observation about this exhibition, not a rule about your personality.`,support,{priority:11,feature:d.key,counter:exception?[ev(latest,`Room ${exception.room} ${similar?'keeps a larger difference':'contains a closer pair'} in this feature.`,exception.ids)]:[],alternatives:['The comparison covers all 15 pairings of these six works. It is descriptive, not a significance test or 15 independent observations.','The annotations describe broad features. They do not capture full palettes, symbolic meaning or your personal associations. Several features may explain the same grouping.',...(hasRoomBriefs(latest)?['Each room had a different brief. This arrangement cannot establish how you would group works without those instructions.']:[])]}));
    } else findings.push(finding(latest,'grouping-open','The room groupings leave their rule open.','No single annotated feature clearly distinguishes these pairings from other pairings of the same six works. Your own room titles and the paintings themselves remain part of the evidence.',[ev(latest,'Your six selected works, in room order.',chosen)],{alternatives:['A coherent exhibition can depend on relationships our seven annotations do not describe. This does not mean the arrangement lacks coherence.']}));
    const r=buildRounds(works,latest.baselineAnswers || {})[0], pref=latest.baselineAnswers?.preferenceRank;
    if(validAnswer(r,pref)) {
      const left=omitted.filter(id=>pref.positions[id]>=65).sort((a,b)=>pref.positions[b]-pref.positions[a])[0];
      const kept=left && chosen.find(id=>pref.positions[id]!==undefined && pref.positions[left]-pref.positions[id]>=12);
      if(kept) findings.push(finding(latest,'omission','A favourite can stay outside the exhibition.',`You rated ${title(get(works,left))} above ${title(get(works,kept))} earlier, but kept the latter and left the former out of this six-work exhibition. Individual preference and fit within a group led to different decisions.`,[ev(latest,'Both works were offered and presented. Only the second was hung.',[left,kept]),{roundId:'preferenceRank',label:'Earlier preference',detail:`Preference positions: ${pref.positions[left]} for ${title(get(works,left))}; ${pref.positions[kept]} for ${title(get(works,kept))}.`,workIds:[left,kept]}],{priority:12,alternatives:['Six places were available for twelve works. A work may be omitted because of fit, repetition or limited space. Omission is not treated as dislike.']}));
    }
    const opening=get(works,latest.layout.r1a), closing=get(works,latest.layout.r3b), delta=feature(opening,'energy')-feature(closing,'energy');
    if(!hasRoomBriefs(latest)&&Math.abs(delta)>=.35) findings.push(finding(latest,'route',delta>0?'The visit opens with more visual activity.':'The visit builds toward more visual activity.',`${title(opening)} opens the first room; ${title(closing)} closes the last. Their annotated visual activity ${delta>0?'decreases':'increases'} between those endpoints. This describes the route you made, rather than the energy you personally feel.`,[ev(latest,'Opening and closing works.',[opening.id,closing.id])],{alternatives:['Only the endpoints are compared here. The full sequence can include pauses or reversals.']}));
    const previous=[...exhibitions].reverse().find(r=>r.id!==latest.id && r.roomStudy===latest.roomStudy && [...r.offeredIds].sort().join('|')===[...latest.offeredIds].sort().join('|'));
    if(previous) {
      const before=selectedIds(previous), retained=chosen.filter(id=>before.includes(id));
      const samePairs=before.every(id=> {if(!chosen.includes(id))return false;const oldSlot=SLOT_IDS.findIndex(s=>previous.layout[s]===id),newSlot=SLOT_IDS.findIndex(s=>latest.layout[s]===id);const oldPartner=before[oldSlot%2?oldSlot-1:oldSlot+1],newPartner=chosen[newSlot%2?newSlot-1:newSlot+1];return oldPartner===newPartner;});
      const changedRoles=hasRoomBriefs(latest)?retained.filter(id=>Math.floor(SLOT_IDS.findIndex(s=>previous.layout[s]===id)/2)!==Math.floor(SLOT_IDS.findIndex(s=>latest.layout[s]===id)/2)):[];
      const roleNote=changedRoles.length?` ${changedRoles.length} retained works moved to a room with a different brief.${samePairs?' Their partners stayed the same.':''}`:'';
      const roomDetail=record=>hasRoomBriefs(record)?ROOM_BRIEFS.map(room=>room.title+': '+roomWorkIds(record,room.id).map(id=>title(get(works,id))).join(' beside ')).join('; '):'';
      findings.push(finding(latest,'revisit',retained.length===6 && !samePairs?'The works stayed; their relationships changed.':samePairs&&changedRoles.length?'Their partners stayed; their room roles changed.':'What stayed across two exhibitions.',`${retained.length} of the six works appeared in both exhibitions made from the same offered set.${retained.length===6&&!samePairs?' You kept the selection while changing at least one pairing. Selection and organisation are separate parts of these decisions.':''}${roleNote}`, [ev(previous,'The earlier exhibition. '+roomDetail(previous),before),ev(latest,'The later exhibition. '+roomDetail(latest),chosen)],{priority:10,alternatives:['A repeated task can involve memory, a different intention or deliberate experimentation. This is not a taste-consistency percentage.']}));
    }
  }
  const companion=[...valid].reverse().find(r=>r.kind==='pair'),edit=[...valid].reverse().find(r=>r.kind==='edit');
  if(companion && edit && companion.choiceId===edit.choiceId && selectedIds(edit).includes(companion.anchorIds[0])) {
    const returned=get(works,edit.choiceId),anchor=get(works,companion.anchorIds[0]),other=selectedIds(edit).find(id=>id!==anchor.id);
    findings.push(finding(edit,'company','The same work had a different role in a different group.',`In the companion exercise, you paired ${title(returned)} with ${title(anchor)}. In the edit, you kept ${title(anchor)} with ${title(get(works,other))} and returned ${title(returned)}. The shared painting stayed while its company changed.`,[ev(companion,'The chosen companion and its anchor.',[anchor.id,returned.id]),ev(edit,'The same anchor, the retained neighbour and the returned work.',[anchor.id,other,returned.id])],{priority:13,alternatives:['The tasks ask different questions and offer different alternatives. This contrast does not establish why you changed the pairing or whether your individual preference changed.','A new candidate, repetition or a different intention may explain the decision. A follow-up using the same alternatives could distinguish these explanations.']}));
  }
  for(const kind of ['pair','bridge','edit']) {
    const record=[...valid].reverse().find(r=>r.kind===kind); if(!record)continue;
    const picked=get(works,record.choiceId), anchors=record.anchorIds.map(id=>get(works,id)), kept=selectedIds(record);
    const reason=record.reason && record.reason!=='Hard to say'?` You described ${kind==='edit'?'the edit':'the link'} as "${record.reason.toLowerCase()}".`:'';
    const detail=kind==='edit'?`You put ${title(picked)} back and kept ${kept.map(id=>title(get(works,id))).join(' with ')} on this wall.`:kind==='bridge'?`You chose ${title(picked)} to connect ${anchors.map(title).join(' with ')}.`:`You chose ${title(picked)} to hang beside ${title(anchors[0])}.`;
    const titleText=kind==='edit'?'The edit describes fit within a pair.':kind==='bridge'?'A connection between two parts of the visit.':'What you chose as a neighbour.';
    findings.push(finding(record,kind,titleText,detail+reason,[ev(record,kind==='edit'?'The three offered works and your returned painting.':'The anchors and chosen work.',unique([...record.anchorIds,record.choiceId,...(kind==='edit'?record.offeredIds:[])]))],{alternatives:['This was a contextual selection task. Its result is not automatically added as an individual preference or dislike. Your stated reason is kept as your report, not verified by the visual annotations.'],priority:kind==='bridge'?7:6}));
  }
  return {findings,records:valid,exhibitions:exhibitions.length,enough:exhibitions.length>0 || valid.some(r=>isSorting(r)||isDifficultEdit(r)) || valid.length>=2,evidence:unique(valid.flatMap(selectedIds))};
}
