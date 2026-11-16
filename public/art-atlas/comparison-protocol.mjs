import {isContinuousPreferenceRound} from './continuous-preference.mjs';
/** Captured v12 locations provide order only. The separate continuous
 * instrument below also supports comparisons without discarding its levels. */
export const COMPARISON_PROTOCOL='within-set-preference-order-v1';
export const COMPARISON_SCOPE='within-set-ordinal-preference';
export const COMPARISON_QUESTION='Which do you prefer?';
export const COMPARISON_HINT='Use the line to order these paintings. Same position means a tie.';
export const COMPARISON_SCALE=Object.freeze({left:'Less preferred here',right:'More preferred here'});

export function isComparisonPreferenceRound(round){
  if(round?.evidence?.continuousProtocol!==undefined)return isContinuousPreferenceRound(round);
  return round?.kind==='spectrum'&&round.criterion==='preference'&&round.evidence?.construct==='preference'&&round.evidence.comparisonProtocol===COMPARISON_PROTOCOL&&round.evidence.measurementScope===COMPARISON_SCOPE&&!round.evidence.appealProtocol&&round.title===COMPARISON_QUESTION&&round.hint===COMPARISON_HINT&&Object.entries(COMPARISON_SCALE).every(([key,value])=>round.scale?.[key]===value)&&round.evidence.unconditional!==false&&!round.brief&&!round.evidence.brief&&!round.anchorWorks?.length&&!round.anchorIds?.length;
}

export function withComparisonPreference(round){
  if(round?.kind!=='spectrum'||round.criterion!=='preference'||round.evidence?.construct!=='preference'||round.evidence.unconditional===false||round.brief||round.evidence.brief||round.anchorWorks?.length||round.anchorIds?.length)throw Error('Comparison preference requires an unconditional painting spectrum.');
  if(round.evidence.repeatOf||round.evidence.role==='repeat')throw Error('A repeat must retain its original question and measurement protocol.');
  const {appealProtocol,continuousProtocol,...evidence}=round.evidence;
  return {...round,title:COMPARISON_QUESTION,hint:COMPARISON_HINT,scale:{...COMPARISON_SCALE},evidence:{...evidence,comparisonProtocol:COMPARISON_PROTOCOL,measurementScope:COMPARISON_SCOPE,positionMeaning:'order-and-exact-ties-only',showNumericScale:false}};
}

/** Legacy gaps remain their original reporting rule. One integer step in the
 * new instrument is an order, with no stronger interpretation for a big gap. */
export const responseGapRequired=round=>isComparisonPreferenceRound(round)?1:15;
export function comparisonDirection(round,answer,a,b){
  const x=answer?.positions?.[a],y=answer?.positions?.[b];
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>100||y<0||y>100)return null;
  return Math.abs(x-y)<responseGapRequired(round)?0:Math.sign(x-y);
}

export function ordinalBands(round,answer){
  if(!isComparisonPreferenceRound(round)||answer?.confirmed!==true||!Array.isArray(round.works)||!Array.isArray(answer.workIds)||answer.workIds.join('|')!==round.works.map(work=>work.id).join('|')||!answer.positions||Object.keys(answer.positions).length!==round.works.length)return null;
  const groups=new Map();for(const work of round.works){const value=answer.positions[work.id];if(!Number.isInteger(value)||value<0||value>100)return null;groups.set(value,[...(groups.get(value)||[]),work.id]);}
  const levels=[...groups].sort((a,b)=>a[0]-b[0]).map(([position,workIds])=>({position,workIds:[...workIds]}));
  return {levels,low:[...levels[0].workIds],high:[...levels.at(-1).workIds],middle:levels.slice(1,-1).flatMap(level=>level.workIds),allTied:levels.length===1,meaning:'Source-group order only; no band is an absolute like or dislike.'};
}
