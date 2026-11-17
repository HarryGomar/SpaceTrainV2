import {AXES} from './engine.mjs';
import {validatedProfileEntries} from './profile-evidence.mjs';
import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';

export const RESPONSE_INQUIRY_PROTOCOL='live-response-question-v1';
const unique=a=>[...new Set(a)],ids=r=>r.works.map(w=>w.id),short=w=>w.shortTitle||w.title;
const definitions=[
  {axis:'returnResponse',categoryId:'return',construct:'tension-and-return',title:'How does each painting feel, and would you return?',question:'Does wanting another look extend beyond this particular unsettling painting?'},
  {axis:'attention',categoryId:'attention',construct:'reported-attention',title:'What appeals to you, and what holds your attention?',question:'Does the pull to keep looking differ from appeal for other paintings too?'},
  {axis:'achievement',categoryId:'admiration',construct:'perceived-achievement',title:'What appeals to you, and what do you admire?',question:'Does admiration separate from personal appeal in a new comparison?'},
  {axis:'connection',categoryId:'connection',construct:'connection',title:'What feels understandable, and what feels personal?',question:'Does a personal connection extend beyond the work that felt hard to understand?'}
];

/** The live uncertainty chooses the response measure. No answer on the new
 * axis is inferred from an appeal score or from a catalogue annotation. */
export function selectResponseInquiry({id,works=[],rounds=[],answers={},candidateIds,avoidIds=[],batchIndex=0}={}){
  if(rounds.some(r=>r.evidence?.responseInquiry?.protocol===RESPONSE_INQUIRY_PROTOCOL&&r.evidence.responseInquiry.batchIndex===batchIndex))return null;
  const known=new Map(works.map(w=>[w.id,w])),allowed=new Set(candidateIds||works.map(w=>w.id)),avoid=new Set(avoidIds);
  const entries=validatedProfileEntries({works,rounds,answers}).filter(e=>e.answer.confirmed===true&&e.round.works.every(w=>sameOrdinalArtworkIdentity(w,known.get(w.id),{requireSource:true})));
  const ratings=new Map();
  for(const entry of entries.filter(e=>isContinuousPreferenceRound(e.round)))for(const work of entry.round.works.filter(isStudyEligibleArtwork))ratings.set(work.id,{work,value:entry.answer.positions[work.id],entry});
  const proposals=[];
  for(const definition of definitions){
    const maps=entries.filter(e=>e.round.kind==='grid'&&e.round.axis===definition.axis&&['xName','yName','left','right','bottom','top'].every(k=>(e.round.axisDefinition||AXES[definition.axis])[k]===AXES[definition.axis][k]));
    const measured=new Set(maps.flatMap(e=>ids(e.round)));
    const used=new Set(rounds.filter(r=>r.evidence?.responseInquiry?.axis===definition.axis).map(r=>r.evidence.responseInquiry.anchorId));
    const rows=maps.flatMap(entry=>entry.round.works.map(work=>({entry,work,point:entry.answer.points[work.id],appeal:ratings.get(work.id)})));
    const anchors=rows.filter(row=>row.appeal&&!used.has(row.work.id)&&(definition.axis==='returnResponse'?row.appeal.value<=60&&row.point[0]>=65&&row.point[1]>=65:row.point[0]<=35&&row.point[1]>=65));
    for(const anchor of anchors){
      if(!allowed.has(anchor.work.id)||avoid.has(anchor.work.id))continue;
      const boundary=rows.find(row=>row.work.id!==anchor.work.id&&allowed.has(row.work.id)&&!avoid.has(row.work.id)&&row.appeal&&Math.abs(row.appeal.value-anchor.appeal.value)<=15&&(definition.axis==='returnResponse'?row.point[0]>=65&&row.point[1]<=35:Math.abs(row.point[0]-anchor.point[0])<=15&&row.point[1]<=35));
      const fresh=[...ratings.values()].filter(row=>allowed.has(row.work.id)&&!avoid.has(row.work.id)&&!measured.has(row.work.id)&&isStudyEligibleArtwork(row.work)&&row.work.artist&&row.work.artist!==anchor.work.artist).sort((a,b)=>Math.abs(a.value-anchor.appeal.value)-Math.abs(b.value-anchor.appeal.value)||a.work.id.localeCompare(b.work.id));
      const selected=[anchor.appeal,...(boundary?[boundary.appeal]:[])],artists=new Set(selected.map(row=>row.work.artist));
      for(const row of fresh){if(artists.has(row.work.artist))continue;selected.push(row);artists.add(row.work.artist);if(selected.length===3)break;}
      if(selected.length!==3||!selected.some(row=>!measured.has(row.work.id)))continue;
      const gap=anchor.point[1]-(definition.axis==='returnResponse'?anchor.appeal.value:anchor.point[0]),earlierQuestions=rounds.filter(r=>r.evidence?.responseInquiry?.axis===definition.axis).length;
      proposals.push({definition,anchor,boundary,selected,measured,priority:(gap+Number(!!boundary)*15)/(6*(1+earlierQuestions))});
    }
  }
  proposals.sort((a,b)=>b.priority-a.priority||a.anchor.work.id.localeCompare(b.anchor.work.id));
  const best=proposals[0];if(!best)return null;
  const {definition,anchor,boundary,selected}=best,sourceRoundIds=unique([anchor.entry.round.id,...selected.map(row=>row.entry.round.id),...(boundary?[boundary.entry.round.id]:[])]);
  const reason=`Follow up on ${short(anchor.work)}. ${definition.question}`;
  const evidence={protocol:RESPONSE_INQUIRY_PROTOCOL,batchIndex,axis:definition.axis,anchorId:anchor.work.id,boundaryId:boundary?.work.id||null,sourceRoundIds,question:definition.question,cost:{paintings:3,placements:3,separateJudgments:6},selectionMethod:'reported-dissociation-and-a-missing-measure',sourceMap:{roundId:anchor.entry.round.id,title:anchor.entry.round.title,hint:anchor.entry.round.hint,axisDefinition:structuredClone(anchor.entry.round.axisDefinition||AXES[definition.axis]),points:structuredClone(anchor.entry.answer.points)},selectionRatings:selected.map(row=>({workId:row.work.id,value:row.value,roundId:row.entry.round.id})),unmeasuredWorkIds:selected.filter(row=>!best.measured.has(row.work.id)).map(row=>row.work.id),prediction:null};
  return {round:{id,kind:'grid',axis:definition.axis,axisDefinition:structuredClone(AXES[definition.axis]),title:definition.title,hint:'Use each axis separately. The paintings may land together or apart.',works:selected.map(row=>row.work),evidence:{construct:definition.construct,family:'response-map',role:'probe',unconditional:false,independentDiscovery:false,responseInquiry:evidence}},focus:({attention:'attention-and-appeal',connection:'connection-and-understanding',returnResponse:'unease-and-return',achievement:'admiration-and-appeal'})[definition.axis],reason,sourceRoundIds,categoryId:definition.categoryId};
}
