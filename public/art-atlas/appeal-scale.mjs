/** The labels are anchors on a continuous input, not five response choices. */
export const APPEAL_PROTOCOL='overall-appeal-v1';
export const APPEAL_SCOPE='overall-appeal';
export const APPEAL_SCALE=Object.freeze({left:'Strongly dislike',middle:'Neutral',right:'Strongly like'});
export const APPEAL_QUESTION='How much do you like each painting overall?';
export const APPEAL_HINT='Rate the whole painting, including its subject and style. All four can be high, low or equal.';

export function isOverallAppealRound(round){
  return round?.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&round.evidence.appealProtocol===APPEAL_PROTOCOL&&round.evidence.measurementScope===APPEAL_SCOPE&&Object.entries(APPEAL_SCALE).every(([key,value])=>round.scale?.[key]===value)&&round.evidence.unconditional!==false&&!round.brief&&!round.evidence.brief&&!round.anchorWorks?.length&&!round.anchorIds?.length;
}

export function withOverallAppeal(round){
  if(round?.kind!=='spectrum'||round.criterion!=='preference'||round.evidence?.construct!=='preference')throw Error('Overall appeal requires an ordinary preference spectrum.');
  if(round.evidence.repeatOf||round.evidence.role==='repeat')throw Error('A repeated instrument must retain its captured question and scale.');
  return {...round,title:APPEAL_QUESTION,hint:APPEAL_HINT,scale:{...APPEAL_SCALE},evidence:{...round.evidence,appealProtocol:APPEAL_PROTOCOL,measurementScope:APPEAL_SCOPE}};
}
