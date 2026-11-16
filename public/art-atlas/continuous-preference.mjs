/** These anchors define personal appeal. Coordinates and gaps both retain
 * their recorded meaning; the numbers are not confidence or probabilities. */
export const CONTINUOUS_PROTOCOL='personal-appeal-continuous-v1';
export const CONTINUOUS_SCOPE='personal-appeal-continuous';
export const CONTINUOUS_QUESTION='How much do these appeal to you?';
export const CONTINUOUS_HINT='Rate each painting for yourself. They can all be high, low or equal. Larger gaps mean a stronger difference in appeal.';
export const CONTINUOUS_SCALE=Object.freeze({left:'Strongly dislike',middle:'Neutral',right:'Strongly like'});

export function isContinuousPreferenceRound(round){
  const evidence=round?.evidence;
  return round?.kind==='spectrum'&&round.criterion==='preference'&&evidence?.construct==='preference'&&evidence.continuousProtocol===CONTINUOUS_PROTOCOL&&evidence.measurementScope===CONTINUOUS_SCOPE&&evidence.appealProtocol===undefined&&evidence.comparisonProtocol===undefined&&round.title===CONTINUOUS_QUESTION&&round.hint===CONTINUOUS_HINT&&Object.keys(round.scale||{}).length===3&&Object.entries(CONTINUOUS_SCALE).every(([key,value])=>round.scale[key]===value)&&evidence.unconditional!==false&&!round.brief&&!evidence.brief&&!round.anchorWorks?.length&&!round.anchorIds?.length;
}

export function withContinuousPreference(round){
  if(round?.kind!=='spectrum'||round.criterion!=='preference'||round.evidence?.construct!=='preference'||round.evidence.unconditional===false||round.brief||round.evidence.brief||round.anchorWorks?.length||round.anchorIds?.length)throw Error('Personal appeal requires an unconditional painting spectrum.');
  if(round.evidence.repeatOf||round.evidence.role==='repeat')throw Error('A repeat must retain its original question and measurement protocol.');
  const {appealProtocol,comparisonProtocol,continuousProtocol,...evidence}=round.evidence;
  return {...round,title:CONTINUOUS_QUESTION,hint:CONTINUOUS_HINT,scale:{...CONTINUOUS_SCALE},evidence:{...evidence,continuousProtocol:CONTINUOUS_PROTOCOL,measurementScope:CONTINUOUS_SCOPE,positionMeaning:'personal-appeal-level-and-gap',showNumericScale:true}};
}

export function continuousAppealValue(round,answer,workId){
  if(!isContinuousPreferenceRound(round)||answer?.confirmed!==true||answer.skipped||!Array.isArray(round.works)||new Set(round.works.map(work=>work.id)).size!==round.works.length||round.workIds!==undefined&&(!Array.isArray(round.workIds)||round.workIds.join('|')!==round.works.map(work=>work.id).join('|'))||!Array.isArray(answer.workIds)||answer.workIds.join('|')!==round.works.map(work=>work.id).join('|')||answer.roundId!==undefined&&answer.roundId!==round.id||!answer.positions||Array.isArray(answer.positions)||Object.keys(answer.positions).length!==round.works.length||!round.works.some(work=>work.id===workId)||round.works.some(work=>!Number.isInteger(answer.positions[work.id])||answer.positions[work.id]<0||answer.positions[work.id]>100))return null;
  return answer.positions[workId];
}

export function continuousPairSignal(round,answer,a,b){
  const left=continuousAppealValue(round,answer,a),right=continuousAppealValue(round,answer,b);if(left===null||right===null||a===b)return null;
  const gap=left-right;
  return {left,right,gap,direction:Math.sign(gap),weight:Math.abs(gap)/100,bothLiked:left>50&&right>50,bothDisliked:left<50&&right<50,meaning:'Recorded personal appeal and its difference; not confidence or a probability.'};
}
