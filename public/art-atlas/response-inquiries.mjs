import {AXES} from './engine.mjs';
import {validatedProfileEntries} from './profile-evidence.mjs';
import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {compareResponsePoints} from './response-portrait.mjs';

export const RESPONSE_INQUIRY_PROTOCOL='live-response-question-v1';
const unique=a=>[...new Set(a)],ids=r=>r.works.map(w=>w.id),short=w=>w.shortTitle||w.title;
const definitions=[
  {axis:'returnResponse',categoryId:'return',construct:'tension-and-return',
    title:'How does each painting feel, and would you return?',
    question:'Does wanting another look extend beyond this particular unsettling painting?',
    matchedQuestion:'Does the wish to return differ again at similar levels of tension?'},
  {axis:'attention',categoryId:'attention',construct:'reported-attention',
    title:'What appeals to you, and what holds your attention?',
    question:'Does the pull to keep looking differ from appeal for other paintings too?',
    matchedQuestion:'Does attention differ again when paintings appeal about equally?'},
  {axis:'achievement',categoryId:'admiration',construct:'perceived-achievement',
    title:'What appeals to you, and what do you admire?',
    question:'Does admiration separate from personal appeal in a new comparison?',
    matchedQuestion:'Does personal appeal differ again between paintings you admire about equally?'},
  {axis:'connection',categoryId:'connection',construct:'connection',
    title:'What feels understandable, and what feels personal?',
    question:'Does a personal connection extend beyond the work that felt hard to understand?',
    matchedQuestion:'Does connection differ again between paintings you find similarly understandable?'}
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
    const rows = maps.flatMap(entry => entry.round.works
      .filter(work => ratings.has(work.id) && allowed.has(work.id) && !avoid.has(work.id))
      .map(work => ({entry, work, point: entry.answer.points[work.id], appeal: ratings.get(work.id)})));
    const isReturn = definition.axis === 'returnResponse';
    const earlierQuestions = rounds.filter(r => r.evidence?.responseInquiry?.axis === definition.axis).length;
    for (const anchor of rows) {
      if (used.has(anchor.work.id)) continue;
      const isolated = anchor.point[1] >= 65 &&
        (isReturn ? anchor.appeal.value <= 60 && anchor.point[0] >= 65 : anchor.point[0] <= 35);
      const otherRows = rows.filter(row => row.work.id !== anchor.work.id);
      const match = otherRows.filter(row => row.entry === anchor.entry).flatMap(row => {
        const contrast = compareResponsePoints(definition.axis, anchor.point, row.point);
        if (!contrast || contrast.responseGap <= 0) return [];
        return [{row, strength: contrast.responseGap - contrast.heldGap}];
      }).sort((a, b) => b.strength - a.strength)[0];
      if (!isolated && !match) continue;
      const boundary = match?.row || otherRows.find(row =>
        Math.abs(row.appeal.value - anchor.appeal.value) <= 15 && row.point[1] <= 35 &&
        (isReturn ? row.point[0] >= 65 : Math.abs(row.point[0] - anchor.point[0]) <= 15)
      );
      const fresh=[...ratings.values()].filter(row=>allowed.has(row.work.id)&&!avoid.has(row.work.id)&&!measured.has(row.work.id)&&isStudyEligibleArtwork(row.work)&&row.work.artist&&row.work.artist!==anchor.work.artist).sort((a,b)=>Math.abs(a.value-anchor.appeal.value)-Math.abs(b.value-anchor.appeal.value)||a.work.id.localeCompare(b.work.id));
      const selected=[anchor.appeal,...(boundary?[boundary.appeal]:[])],artists=new Set(selected.map(row=>row.work.artist));
      for(const row of fresh){if(artists.has(row.work.artist))continue;selected.push(row);artists.add(row.work.artist);if(selected.length===3)break;}
      if(selected.length!==3||!selected.some(row=>!measured.has(row.work.id)))continue;
      const gap = match?.strength ?? (anchor.point[1] - (isReturn ? anchor.appeal.value : anchor.point[0]));
      proposals.push({definition, anchor, boundary, selected, measured, matched: !!match,
        priority: (gap + Number(!!boundary) * 15) / (6 * (1 + earlierQuestions))});
    }
  }
  proposals.sort((a,b)=>b.priority-a.priority||a.anchor.work.id.localeCompare(b.anchor.work.id));
  const best=proposals[0];if(!best)return null;
  const {definition,anchor,boundary,selected,matched}=best,sourceRoundIds=unique([anchor.entry.round.id,...selected.map(row=>row.entry.round.id),...(boundary?[boundary.entry.round.id]:[])]);
  const question = matched ? definition.matchedQuestion : definition.question;
  const focusWorks = [anchor.work, ...(matched ? [boundary.work] : [])].map(short);
  const reason = `Follow up on ${focusWorks.join(' and ')}. ${question}`;
  const evidence={protocol:RESPONSE_INQUIRY_PROTOCOL,batchIndex,axis:definition.axis,anchorId:anchor.work.id,boundaryId:boundary?.work.id||null,sourceRoundIds,question,cost:{paintings:3,placements:3,separateJudgments:6},selectionMethod:matched?'matched-response-contrast-and-a-missing-measure':'reported-dissociation-and-a-missing-measure',sourceMap:{roundId:anchor.entry.round.id,title:anchor.entry.round.title,hint:anchor.entry.round.hint,axisDefinition:structuredClone(anchor.entry.round.axisDefinition||AXES[definition.axis]),points:structuredClone(anchor.entry.answer.points)},selectionRatings:selected.map(row=>({workId:row.work.id,value:row.value,roundId:row.entry.round.id})),unmeasuredWorkIds:selected.filter(row=>!best.measured.has(row.work.id)).map(row=>row.work.id),prediction:null};
  return {round:{id,kind:'grid',axis:definition.axis,axisDefinition:structuredClone(AXES[definition.axis]),title:definition.title,hint:'Use each axis separately. The paintings may land together or apart.',works:selected.map(row=>row.work),evidence:{construct:definition.construct,family:'response-map',role:'probe',unconditional:false,independentDiscovery:false,responseInquiry:evidence}},focus:({attention:'attention-and-appeal',connection:'connection-and-understanding',returnResponse:'unease-and-return',achievement:'admiration-and-appeal'})[definition.axis],reason,sourceRoundIds,categoryId:definition.categoryId};
}
