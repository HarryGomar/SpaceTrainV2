import {validAnswer} from './engine.mjs';
import {isComparisonPreferenceRound} from './comparison-protocol.mjs';

export function contextPurpose(brief=''){
  if(/weeks|longer|live with/i.test(brief))return 'longer looking';
  if(/studying|study|examine|investigat/i.test(brief))return 'study';
  if(/room|wall|hang|together|beside/i.test(brief))return 'this arrangement';
  return null;
}

/** Label observed choices on the artworks. A lower placement is never a dislike. */
export function comparisonReadout(item,{works=[],rounds=[],answers={}}={}){
  const known=new Set(works.map(work=>work.id));let pair=item?.comparisons?.[0];
  if(pair?.kind==='categorical-contrast'){
    const ids=pair.workIds,tones=['preference','curiosity','response','meaning','curation','connection','neutral'];
    if(!Array.isArray(ids)||ids.length<1||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)||!Array.isArray(pair.notes?.[id])||!pair.notes[id].length||pair.notes[id].some(note=>!/^[-a-z]+$/.test(note.role)||!tones.includes(note.tone)||typeof note.text!=='string')))return null;
    return {workIds:[...ids],single:false,measures:[],notes:structuredClone(pair.notes)};
  }
  if(pair?.kind==='matched-selection'&&Array.isArray(pair.workIds)&&pair.workIds.length>=1&&pair.workIds.length<=12&&new Set(pair.workIds).size===pair.workIds.length&&pair.workIds.every(id=>known.has(id)&&pair.selectedWorkIds?.includes(id))){
    const marked=new Set(pair.markedFamiliarIds||[]);return {workIds:[...pair.workIds],single:false,measures:[],displayNote:pair.workIds.length>3?'Showing 3 of '+pair.workIds.length+' selected works.':null,notes:Object.fromEntries(pair.workIds.map(id=>[id,[{role:'shortlisted',tone:'preference',text:'You kept this'},{role:'familiarity',tone:'curiosity',text:marked.has(id)?'Marked familiar':'Not marked familiar'}]]))};
  }
  if(!pair){
    const source=item?.support?.find(entry=>!/frozen/i.test(entry.label||'')&&entry.workIds?.length===2&&rounds.some(round=>round.id===entry.roundId));
    const round=rounds.find(round=>round.id===source?.roundId),answer=answers[source?.roundId];let valid=false;
    try{valid=round?.kind==='spectrum'&&round.criterion==='preference'&&validAnswer(round,answer);}catch{}
    if(valid)pair={workIds:source.workIds,preferenceRoundId:round.id,measures:[{key:'preference',label:'Preference',values:source.workIds.map(id=>answer.positions[id])}]};
  }
  if(!pair||![1,2].includes(pair.workIds?.length)||new Set(pair.workIds).size!==pair.workIds.length||!pair.workIds.every(id=>known.has(id)))return null;
  const measures=pair.measures||[{key:'preference',label:'Preference',values:pair.preference},{key:'curiosity',label:'Want to understand',values:pair.curiosity}];
  if(!measures.length||measures.some(measure=>!Array.isArray(measure.values)||measure.values.length!==pair.workIds.length||measure.values.some(value=>!Number.isFinite(value)||value<0||value>100)))return null;
  const notes=Object.fromEntries(pair.workIds.map(id=>[id,[]]));
  if(pair.workIds.length===2)for(const measure of measures){
    const difference=measure.values[0]-measure.values[1];
    const sourceIds=[measure.roundId,pair.preferenceRoundId,...(item?.support||[]).filter(source=>pair.workIds.every(id=>source.workIds?.includes(id))).map(source=>source.roundId)],ordinal=measure.key==='preference'&&sourceIds.some(id=>{const round=rounds.find(round=>round.id===id),answer=answers[id];return isComparisonPreferenceRound(round)&&pair.workIds.every((workId,index)=>round.works.some(work=>work.id===workId)&&answer?.positions?.[workId]===measure.values[index]);});
    if(Math.abs(difference)<(ordinal?1:15)){if(measure.key==='preference')for(const id of pair.workIds)notes[id].push({role:ordinal?'tie':'near-tie',tone:'neutral',text:ordinal?'Equal preference':'Similar preference'});continue;}
    const winner=pair.workIds[difference>0?0:1],other=pair.workIds[difference>0?1:0];
    if(measure.key==='preference'||measure.key==='appeal'){
      notes[winner].push({role:'preferred',tone:'preference',text:measure.key==='appeal'?'More for you':item?.module==='context'?'Your earlier preference':'You preferred this'});
      notes[other].push({role:'less-preferred',tone:'neutral',text:measure.key==='appeal'?'Less for you':'Lower in that comparison'});
    }else{
      const text={curiosity:'More curious about this',admiration:'More to admire in the making',clarity:'A clearer scene for you',openness:'More possible readings',tension:'More unsettling for you',return:'Stronger wish to return',meaning:'You found more meaning here',interpretation:'You wanted to interpret this more',context:contextPurpose(item?.brief)==='longer looking'?'Your choice for longer looking':contextPurpose(item?.brief)==='study'?'Your choice for study':'Your choice for the stated task'}[measure.key];
      if(text)notes[winner].push({role:measure.key,tone:['curiosity','clarity'].includes(measure.key)?'curiosity':measure.key==='return'?'preference':measure.key==='tension'?'response':'meaning',text});
    }
  }
  return {workIds:[...pair.workIds],notes,measures,single:pair.workIds.length===1};
}
