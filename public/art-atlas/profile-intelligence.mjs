import {AXES,validAnswer,matchResults} from './engine.mjs';
import {isContinuousPreferenceRound,CONTINUOUS_PROTOCOL} from './continuous-preference.mjs';
import {isComparisonPreferenceRound} from './comparison-protocol.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
import {artworkPreviewHashes,sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';
import {profileEvidence} from './profile-evidence.mjs';
import {isRecognitionWithCertainty} from './recognition-evidence.mjs';
import {isExplicitFamiliarity} from './discovery-grid.mjs';
import {validSorting,sortingDistance} from './sorting-table.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};

const unique=values=>[...new Set(values.filter(Boolean))],short=work=>work.shortTitle||work.title;
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const ids=round=>round.works.map(work=>work.id);
const setKey=round=>JSON.stringify([...ids(round)].sort());
export const INTELLIGENCE_VERSION='response-intelligence-v1';
const limits=['These are descriptions of this selection of paintings and questions, not population confidence or psychological causes.','Repeated works and different answers about one work remain related evidence.','Unmeasured answers and unknown artwork reviews remain unknown.'];

/** Wider than the preference collector: statements, matches and contexts retain
 * their own validators. No historical coordinate gains a new interpretation. */
export function collectResponseEvidence({works=[],rounds=[],answers={}}={}){
  if(!Array.isArray(works)||!Array.isArray(rounds)||!plain(answers))return [];
  const workCounts=new Map(),roundCounts=new Map();for(const w of works)workCounts.set(w?.id,(workCounts.get(w?.id)||0)+1);for(const r of rounds)roundCounts.set(r?.id,(roundCounts.get(r?.id)||0)+1);
  const known=new Map(works.filter(w=>w?.id&&workCounts.get(w.id)===1).map(w=>[w.id,w]));
  return rounds.flatMap((round,index)=>{
    if(!round||round.unavailable||roundCounts.get(round.id)!==1||!Array.isArray(round.works)||!round.works.length||round.kind==='exercise')return [];
    const offered=ids(round),answer=answers[round.id];
    if(unique(offered).length!==offered.length||offered.some(id=>!known.has(id))||round.workIds&&JSON.stringify(round.workIds)!==JSON.stringify(offered)||round.works.some(w=>!sameOrdinalArtworkIdentity(w,known.get(w.id),{requireSource:true})))return [];
    if(answer?.roundId!==undefined&&answer.roundId!==round.id)return [];
    if(round.kind==='grid'&&(!plain(answer?.points)||round.axisDefinition&&JSON.stringify(round.axisDefinition)!==JSON.stringify(AXES[round.axis])))return [];
    if(round.kind==='spectrum'&&!plain(answer?.positions))return [];
    let valid=false;try{valid=validAnswer(round,answer);}catch{}if(!valid)return [];
    return [{round,answer,index}];
  });
}

const ev=(entry,workIds,detail,label)=>profileEvidence(entry,workIds,detail,label);
function observation(id,module,title,text,support,{counter=[],workIds=[],status='provisional',...extra}={}){
  return {id:'intelligence-'+id,module,kind:'taste',title,text,support,counter,status,priority:status==='supported'?13:10,evidence:unique([...workIds,...support.flatMap(item=>item.workIds||[]),...counter.flatMap(item=>item.workIds||[])]),sourceRoundIds:unique([...support,...counter].map(item=>item.roundId)),alternatives:[...limits],...extra};
}

function spacing(entry){
  const values=entry.round.works.map(work=>({workId:work.id,value:entry.answer.positions[work.id]})).sort((a,b)=>a.value-b.value),clusters=[];
  for(const item of values){const last=clusters.at(-1);if(last&&item.value-last.minimum<=10){last.workIds.push(item.workId);last.maximum=item.value;}else clusters.push({minimum:item.value,maximum:item.value,workIds:[item.workId]});}
  return {roundId:entry.round.id,protocol:CONTINUOUS_PROTOCOL,values,mean:values.reduce((sum,item)=>sum+item.value,0)/values.length,range:values.at(-1).value-values[0].value,aboveNeutral:values.filter(item=>item.value>50).map(item=>item.workId),belowNeutral:values.filter(item=>item.value<50).map(item=>item.workId),neutral:values.filter(item=>item.value===50).map(item=>item.workId),adjacentGaps:values.slice(1).map((item,index)=>({workIds:[values[index].workId,item.workId],gap:item.value-values[index].value})),ties:clusters.flatMap(cluster=>{const groups=new Map();for(const id of cluster.workIds){const value=entry.answer.positions[id];groups.set(value,[...(groups.get(value)||[]),id]);}return [...groups].filter(([,group])=>group.length>1).map(([value,workIds])=>({value,workIds}));}),clusters};
}

function mapReadings(entries){
  const observations=[],records=[];
  for(const axis of ['connection','attention']){
    const seen=new Map();for(const entry of entries.filter(e=>e.round.kind==='grid'&&e.round.axis===axis))seen.set(setKey(entry.round),entry);
    const rows=[...seen.values()].flatMap(entry=>entry.round.works.map(work=>({entry,work,point:entry.answer.points[work.id]})));
    records.push(...rows.map(row=>({roundId:row.entry.round.id,workId:row.work.id,axis,point:[...row.point],axisDefinition:structuredClone(AXES[axis])})));
    const selected=rows.filter(row=>axis==='connection'?row.point[0]<=35&&row.point[1]>=65:row.point[0]<=35&&row.point[1]>=65);
    const counter=rows.filter(row=>axis==='connection'?row.point[0]<=35&&row.point[1]<=35:row.point[0]>=65&&row.point[1]<=35);
    if(!selected.length)continue;
    const setCount=new Set(selected.map(row=>setKey(row.entry.round))).size,workIds=unique(selected.map(row=>row.work.id)),first=selected[0],support=selected.map(row=>ev(row.entry,[row.work.id],`${short(row.work)}: ${AXES[axis].xName} ${row.point[0]}; ${AXES[axis].yName} ${row.point[1]}.`,'Recorded map response'));
    observations.push(observation(axis,axis==='connection'?'connection-and-understanding':'attention-and-appeal',axis==='connection'?'Personal before it feels understood':'Attention beyond personal appeal',axis==='connection'?`${short(first.work)} felt personally connected while remaining hard to understand.${workIds.length>1?` This occurred for ${workIds.length} works across ${setCount} map ${setCount===1?'set':'sets'}.`:''} This is your reported connection, not a test of correct interpretation.`:`${short(first.work)} held your reported attention despite limited personal appeal.${workIds.length>1?` ${workIds.length} works showed this distinction across ${setCount} map ${setCount===1?'set':'sets'}.`:''} Attention here is a direct report, not recorded viewing time.`,support,{counter:counter.map(row=>ev(row.entry,[row.work.id],`${short(row.work)}: ${AXES[axis].xName} ${row.point[0]}; ${AXES[axis].yName} ${row.point[1]}.`,'A different response')),displayWorkIds:unique([first.work.id,counter[0]?.work.id]),supportingWorkCount:workIds.length,supportingSetCount:setCount,status:workIds.length>=3&&setCount>=2?'supported':'provisional',measurementScope:axis+'-map',competingExplanations:axis==='connection'?['Personal associations and subject familiarity may contribute.']:['Surprise, subject, visual difficulty and personal interest may contribute.']}));
  }
  return {observations,records};
}

function recognitionReadings(entries,basis){
  const familiarity=new Map(),responses=[],observations=[];
  for(const entry of entries){
    if(entry.round.kind==='choice-grid'&&entry.round.selectionMode==='familiarity')for(const id of ids(entry.round)){
      const status=(isExplicitFamiliarity(entry.round)?entry.answer.familiarity?.[id]:null)||(entry.answer.selectedIds.includes(id)?'seen':'unknown');
      if(status!=='unknown')familiarity.set(id,{status,entry});
    }
    if(entry.round.kind==='match')for(const result of matchResults(entry.round,entry.answer)){
      const prior=entry.round.evidence?.exposureHistory?.works?.[result.workId],certainty=isRecognitionWithCertainty(entry.round)?entry.answer.certainty?.[result.workId]||'unmeasured':'unmeasured',known=familiarity.get(result.workId);
      const labelRoundIds=prior?.[entry.round.field+'LabelRoundIds']||[];
      responses.push({...result,roundId:entry.round.id,field:entry.round.field,certainty,priorFamiliarity:known&&known.entry.index<entry.index?known.status:'unknown',priorFamiliarityRoundId:known&&known.entry.index<entry.index?known.entry.round.id:null,labelExposure:labelRoundIds.length?'quiz-label-exposed':prior?.unknownLabelRoundIds?.length?'unknown':prior?.protocol==='artwork-exposure-v1'?'no-recorded-label-exposure':'unknown',priorLabelRoundIds:labelRoundIds,priorImageRoundIds:prior?.imageRoundIds||[]});
    }
  }
  const favourites=new Set((basis.explicitFavourites||[]).map(item=>item.workId)),dislikes=new Set((basis.explicitDislikes||[]).map(item=>item.workId)),ratings=new Map((basis.overallRatings||[]).filter(item=>item.measurementScope===CONTINUOUS_PROTOCOL).map(item=>[item.workId,item]));
  const linked=[];for(const [id,item]of familiarity){const level=ratings.get(id),positive=favourites.has(id)&&!dislikes.has(id)||!dislikes.has(id)&&level?.positive,negative=dislikes.has(id)&&!favourites.has(id)||!favourites.has(id)&&level?.negative;if(positive||negative)linked.push({workId:id,prior:item.status,appeal:positive?'positive':'negative',sourceRoundId:item.entry.round.id,preferenceRoundIds:unique([...(level?.sourceRoundIds||[]),...(basis.explicitFavourites||[]).find(row=>row.workId===id)?.sourceRoundIds||[],...(basis.explicitDislikes||[]).find(row=>row.workId===id)?.sourceRoundIds||[]])});}
  const discoveries=linked.filter(item=>item.prior==='new'&&item.appeal==='positive'),familiarLow=linked.filter(item=>item.prior==='seen'&&item.appeal==='negative');
  if(discoveries.length||familiarLow.length){const lookup=new Map(entries.flatMap(entry=>entry.round.works).map(work=>[work.id,work])),support=[...discoveries,...familiarLow].map(item=>({roundId:item.sourceRoundId,label:'Prior familiarity linked to a separate appeal response',workIds:[item.workId],detail:`${short(lookup.get(item.workId))}: ${item.prior==='new'?'reported new before today':'reported familiar before today'}; ${item.appeal==='positive'?'positive personal response':'negative personal response'} in a separate recorded question.`,preferenceRoundIds:item.preferenceRoundIds}));observations.push(observation('familiarity','recognition-and-taste','Familiarity and attraction separated',`${discoveries.length?`${discoveries.length} ${discoveries.length===1?'work reported new':'works reported new'} received a positive personal response. `:''}${familiarLow.length?`${familiarLow.length} familiar ${familiarLow.length===1?'work received':'works received'} a negative personal response. `:''}These examples connect prior encounter with taste; they do not estimate a general familiarity effect.`,support,{displayWorkIds:unique([discoveries[0]?.workId,familiarLow[0]?.workId]),status:linked.length>=4&&discoveries.length>=2&&familiarLow.length>=2?'supported':'provisional'}));}
  const taught=responses.filter(row=>row.status==='correct'&&row.labelExposure==='quiz-label-exposed');
  const choiceFor=id=>favourites.has(id)&&dislikes.has(id)?null:favourites.has(id)?'positive':dislikes.has(id)?'negative':ratings.get(id)?.positive?'positive':ratings.get(id)?.negative?'negative':null;
  const latestMatches=[...new Map(responses.map(row=>[JSON.stringify([row.workId,row.field]),row])).values()];
  const likedUncertain=latestMatches.filter(row=>choiceFor(row.workId)==='positive'&&(row.status!=='correct'||['inferred','guessed','unsure'].includes(row.certainty))),recognisedDistant=latestMatches.filter(row=>choiceFor(row.workId)==='negative'&&row.status==='correct'&&row.certainty==='recognised');
  if(likedUncertain.length||recognisedDistant.length){const selected=[...likedUncertain,...recognisedDistant],likedCount=unique(likedUncertain.map(row=>row.workId)).length,distantCount=unique(recognisedDistant.map(row=>row.workId)).length;observations.push(observation('attribution-and-choice','recognition-and-taste','Naming and personal appeal separated',`${likedCount?`${likedCount} positively received ${likedCount===1?'painting was':'paintings were'} accompanied by an uncertain, inferred, guessed or incorrect attribution. `:''}${distantCount?`${distantCount} correctly recognised ${distantCount===1?'painting received':'paintings received'} a negative personal response. `:''}These connect your label answers with separate personal choices; attribution knowledge is not a taste score.`,selected.map(row=>({roundId:row.roundId,label:'Attribution beside a separate personal response',workIds:[row.workId],detail:`${row.field}: ${row.label}: ${row.status}, ${row.certainty}; ${choiceFor(row.workId)} personal response.`,preferenceRoundIds:ratings.get(row.workId)?.sourceRoundIds||[]})),{displayWorkIds:unique([likedUncertain[0]?.workId,recognisedDistant[0]?.workId]),status:'provisional'}));}
  if(taught.length)observations.push(observation('recognition-learning','recognition-and-taste','Labels recognised after earlier exposure',`${taught.length} correct ${taught.length===1?'match followed':'matches followed'} recorded label exposure earlier in this quiz. These answers may reflect learning or recognition during the quiz; they do not establish prior knowledge.`,taught.map(row=>({roundId:row.roundId,label:'Match after recorded exposure',workIds:[row.workId],detail:`${row.label}; certainty ${row.certainty}; earlier label rounds: ${row.priorLabelRoundIds.join(', ')}.`})),{displayWorkIds:taught.slice(0,2).map(row=>row.workId)}));
  return {responses,familiarity:[...familiarity].map(([workId,item])=>({workId,status:item.status,roundId:item.entry.round.id})),linked,observations,coverage:{matches:responses.length,certaintyReported:responses.filter(row=>row.certainty!=='unmeasured').length,previouslyTaughtCorrect:taught.length,linkedWorks:linked.length,newPositive:discoveries.length,familiarNegative:familiarLow.length}};
}

function claimReadings(entries,reported){
  const observations=[],links=[],claims=entries.filter(entry=>entry.round.kind==='statements'&&entry.round.evidence?.statementTest==='contextEffect');
  for(const claim of claims){
    const statement=claim.round.statements?.find(item=>item.id==='contextEffect'),aligned=statement?.text==='Learning the story behind a painting rarely changes how much I appreciate it.';
    if(!aligned&&statement?.text!=='Learning the story behind a painting rarely changes how much I like it.')continue;
    const boundTarget=entries.find(entry=>entry.round.id===claim.round.evidence.contextRoundId);
    if(!boundTarget||claim.round.evidence.checkId!==boundTarget.round.evidence?.checkId)continue;
    const matches=(reported.responses||[]).filter(row=>row.roundId===boundTarget.round.id&&boundTarget.index>claim.index&&typeof claim.round.evidence.checkId==='string'&&claim.round.evidence.checkId.length>0);
    for(const response of matches){links.push({statementRoundId:claim.round.id,contextRoundId:response.roundId,agreement:claim.answer.claims.contextEffect,reportedChange:response.reportedChange,uncertain:response.uncertain});if(response.uncertain)continue;
      const agreement=claim.answer.claims.contextEffect,exception=aligned&&agreement>=3&&response.direction!==0;
      const title=!aligned?'Appreciation beside an expectation about liking':exception?'An exception to your expectation':agreement>=3?'This note matched your expectation':'Your expectation beside this particular note';
      const text=!aligned?`Your earlier statement concerned how much you like a painting; this note asked about appreciation. You reported ${response.label.toLowerCase()} appreciation here. Appreciation can change while personal liking stays the same, so these answers do not establish an exception or contradiction.`:exception?`You expected stories rarely to change your appreciation. For this painting, you reported ${response.label.toLowerCase()} appreciation after the note. "Rarely" allows exceptions; this one response does not establish inconsistency.`:`Your earlier statement and the later "${response.label.toLowerCase()}" response describe a general expectation and a particular note. One case does not establish how context usually affects you.`;
      observations.push(observation('context-expectation-'+response.roundId,'context-expectation',title,text,[ev(claim,[],`Agreement ${agreement} of 4: ${statement.text}`,'Earlier self-description'),{roundId:response.roundId,label:'Direct appreciation change',workIds:[response.workId],detail:response.label+' appreciation after the exact sourced note.'}],{displayWorkIds:[response.workId],measurementScope:reported.protocol,reportedChange:response.reportedChange,sourceUrls:response.sourceUrls}));
    }
  }
  return {links,observations};
}

function capturedReview(work,snapshot,works,annotationReviews){
  const original=works.find(item=>item.id===work.id),basis=snapshot?.annotationBasis;
  // A frozen check uses the editorial review captured before its answer.
  // Later metadata revisions cannot silently rewrite that earlier prediction.
  return original&&sameOrdinalArtworkIdentity(work,original,{requireSource:true})&&snapshot?.version===ARTWORK_ATTRIBUTE_VERSION&&plain(snapshot.attributes)&&basis?.sourceUrl===work.sourceUrl&&basis.image===work.image&&/^[a-f0-9]{64}$/i.test(basis.previewSha256)&&artworkPreviewHashes(work).every(value=>typeof value==='string'&&value.toLowerCase()===basis.previewSha256.toLowerCase())&&['captured-preview-hash','current-verified-asset-reference','current-verified-catalogue-reference'].includes(basis.bindingStatus)&&Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).every(key=>['present','absent','unknown'].includes(snapshot.attributes[key]?.status))?snapshot:null;
}
function diagnosticReadings(entries,works,annotationReviews,rounds){
  const observations=[],checks=[];
  for(const entry of entries){
    const d=entry.round.evidence?.diagnostic;
    if(!isContinuousPreferenceRound(entry.round)||d?.protocol!=='explanation-diagnostic-v1'||d.binding!=='bound'||d.kind!=='quality'||d.hypothesisStatus!=='frozen-before-answer'||ids(entry.round).length!==2||!Array.isArray(d.sourceRoundIds)||d.sourceRoundIds.some(id=>typeof id!=='string')||unique(d.sourceRoundIds).length!==d.sourceRoundIds.length||!Array.isArray(d.hypotheses)||d.hypotheses.length!==2||d.hypotheses.some(h=>!h||!ARTWORK_ATTRIBUTE_DEFINITIONS[h.quality]||h.title!==ARTWORK_ATTRIBUTE_DEFINITIONS[h.quality].label||![1,-1].includes(h.direction))||!Array.isArray(d.predictions)||d.predictions.length!==2||d.predictions[0]===d.predictions[1]||!d.predictions.every(id=>ids(entry.round).includes(id)))continue;
    const snapshots=d.sourceSnapshots;if(!Array.isArray(snapshots)||snapshots.length<2||JSON.stringify(snapshots.map(s=>s?.round?.id).sort())!==JSON.stringify([...d.sourceRoundIds].sort())||snapshots.some(snapshot=>{const originals=rounds.map((round,index)=>({round,index})).filter(source=>source.round?.id===snapshot?.round?.id),original=originals[0];return originals.length!==1||original.index>=entry.index||!isContinuousPreferenceRound(snapshot.round)||!validAnswer(snapshot.round,snapshot.answer)||!isContinuousPreferenceRound(original.round)||snapshot.answer.roundId!==undefined&&snapshot.answer.roundId!==snapshot.round.id||snapshot.round.works.length!==original.round.works.length||snapshot.round.works.some((work,index)=>!sameOrdinalArtworkIdentity(work,original.round.works[index],{requireSource:true}));}))continue;
    const targetReviews=entry.round.works.map(work=>capturedReview(work,d.qualitySnapshots?.[work.id],works,annotationReviews));if(targetReviews.some(review=>!review))continue;
    const predicted=d.hypotheses.map(h=>{const values=targetReviews.map(review=>review.attributes[h.quality].status==='present'?1:review.attributes[h.quality].status==='absent'?0:null);return values.includes(null)||values[0]===values[1]?null:ids(entry.round)[(values[0]-values[1])*h.direction>0?0:1];});if(JSON.stringify(predicted)!==JSON.stringify(d.predictions))continue;
    const [a,b]=ids(entry.round),gap=entry.answer.positions[a]-entry.answer.positions[b],winner=gap===0?null:gap>0?a:b,match=winner?d.predictions.indexOf(winner):-1;
    checks.push({roundId:entry.round.id,workIds:[a,b],values:[entry.answer.positions[a],entry.answer.positions[b]],signedGap:gap,winner,predictions:[...d.predictions],hypotheses:structuredClone(d.hypotheses),sourceRoundIds:[...d.sourceRoundIds],sourceSnapshots:structuredClone(snapshots),status:Math.abs(gap)<5?'close':match===0?'first-explanation':'second-explanation',discoveryVote:false});
    const preferred=winner&&entry.round.works.find(work=>work.id===winner),first=winner?d.hypotheses[match]:null,predictionText=h=>`works ${h.direction===1?'with':'without'} ${h.title.toLowerCase()}`,text=Math.abs(gap)<5?`The paintings were ${gap===0?'tied':'within '+Math.abs(gap)+' appeal points'}. This comparison did not clearly separate ${predictionText(d.hypotheses[0])} from ${predictionText(d.hypotheses[1])}.`:`${short(preferred)} came ahead by ${Math.abs(gap)} personal-appeal points. In this new comparison, the recorded direction agreed with the earlier preference for ${predictionText(first)}. This checks an earlier explanation on familiar works; it is not another independent discovery example.`;
    const training=snapshots.map(snapshot=>({roundId:snapshot.round.id,label:'Frozen earlier comparison used to select this check',sourceRole:'frozen training response',workIds:ids(snapshot.round),detail:snapshot.round.works.map(work=>`${short(work)}: ${snapshot.answer.positions[work.id]}`).join('; ')+'. These are the captured personal-appeal responses.'}));
    observations.push(observation('diagnostic-'+entry.round.id,'explanation-check',Math.abs(gap)<5?'This comparison left the explanation open':'A closer comparison of '+first.title.toLowerCase(),text,[...training,ev(entry,[a,b],`${entry.answer.positions[a]} versus ${entry.answer.positions[b]} on the original anchored appeal line. Frozen alternatives: ${d.hypotheses.map((h,i)=>predictionText(h)+' predicted '+short(entry.round.works.find(work=>work.id===d.predictions[i]))).join('; ')}.`,'Explanation check')],{displayWorkIds:winner?[winner,winner===a?b:a]:[a,b],measurementScope:CONTINUOUS_PROTOCOL,status:'provisional',sourceRoundIds:unique([...d.sourceRoundIds,entry.round.id]),competingExplanations:d.hypotheses.map(predictionText),responseGap:Math.abs(gap)}));
  }
  return {checks,observations};
}

function groupingReadings(entries,{works,rounds,annotationReviews}){
  const responses=entries.filter(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='relatedness'&&entry.round.evidence?.diagnostic?.binding==='bound'),observations=[],validated=[];
  for(const entry of responses){
    const diagnostic=entry.round.evidence.diagnostic,chosen=entry.answer.selectedIds,rivals=diagnostic.rivals;
    if(!Array.isArray(rivals)||rivals.some(rival=>!plain(rival)))continue;
    const selected=rivals.filter(rival=>chosen.includes(rival.workId)),names=selected.map(rival=>rival.qualityTitle);
    if(diagnostic.protocol!=='explanation-diagnostic-v1'||diagnostic.kind!=='grouping'||rivals.length!==2||new Set(rivals.map(rival=>rival.quality)).size!==2||rivals.some(rival=>!ARTWORK_ATTRIBUTE_DEFINITIONS[rival.quality]||rival.qualityTitle!==ARTWORK_ATTRIBUTE_DEFINITIONS[rival.quality].label)||new Set(rivals.map(rival=>rival.workId)).size!==2||rivals.some(rival=>!ids(entry.round).includes(rival.workId)))continue;
    const source=rounds.filter(round=>round?.id===diagnostic.sourceRoundId),snapshot=diagnostic.sourceSnapshot,record=snapshot?.answer?.record,anchors=entry.round.anchorWorks||[];
    if(source.length!==1||rounds.indexOf(source[0])>=entry.index||source[0].kind!=='exercise'||source[0].exerciseKind!=='sorting'||snapshot?.round?.id!==source[0].id||snapshot.answer?.skipped||snapshot.answer?.roundId!==undefined&&snapshot.answer.roundId!==source[0].id||JSON.stringify(snapshot.answer?.workIds)!==JSON.stringify(ids(source[0]))||record?.id!==diagnostic.sourceRecordId||anchors.length!==2||!Array.isArray(diagnostic.anchorIds)||JSON.stringify(anchors.map(w=>w.id))!==JSON.stringify(diagnostic.anchorIds)||!Array.isArray(snapshot.round.works)||snapshot.round.works.length!==source[0].works.length||snapshot.round.works.some((work,index)=>!sameOrdinalArtworkIdentity(work,source[0].works[index],{requireSource:true})))continue;
    let valid=false;try{valid=validSorting(record,snapshot.round.works);}catch{}if(!valid||anchors.some(work=>!record.positions[work.id])||sortingDistance(...anchors.map(work=>record.positions[work.id]))/Math.hypot(1.5,1)>.22)continue;
    const reviewed=[...anchors,...entry.round.works].map(work=>capturedReview(work,diagnostic.qualitySnapshots?.[work.id],works,annotationReviews));if(reviewed.some(review=>!review)||!reviewed.slice(0,2).every(review=>rivals.every(rival=>review.attributes[rival.quality].status==='present')))continue;
    if(rivals.some((rival,index)=>{const review=diagnostic.qualitySnapshots[rival.workId];return review.attributes[rival.quality].status!=='present'||review.attributes[rivals[1-index].quality].status!=='absent';}))continue;
    const text=entry.answer.unsure?'You left the relationship open. The earlier group supports more than one explanation.':chosen.length===0?'You chose neither offered companion. The earlier grouping needs another explanation or another contrast.':selected.length===1?`You added ${short(entry.round.works.find(work=>work.id===chosen[0]))} beside the group you made. This check favours ${names[0].toLowerCase()} as one relationship to explore; it does not establish what caused the original grouping or how much you like the companion.`:'You chose companions for both proposed relationships. These answers do not yet separate the explanations.';
    validated.push(entry);
    observations.push(observation('grouping-'+entry.round.id,'grouping-followup',selected.length===1?'A closer look at your grouping':'Your grouping remains open',text,[{roundId:source[0].id,label:'Your earlier sorting',workIds:anchors.map(work=>work.id),detail:anchors.map(short).join(' and ')+' were placed near each other within a more spread-out sorting. Both carry the two reviewed qualities being compared.'},ev(entry,chosen.length?chosen:ids(entry.round),(chosen.length?'Selected companions: '+chosen.map(id=>short(entry.round.works.find(work=>work.id===id))).join(', '):entry.answer.unsure?'Not sure':'Neither companion')+'. Offered relationships: '+rivals.map(rival=>short(entry.round.works.find(work=>work.id===rival.workId))+' carries '+rival.qualityTitle.toLowerCase()+' without the other reviewed quality').join('; ')+'.','Relatedness check')],{status:'provisional',displayWorkIds:unique([...(entry.round.anchorWorks||[]).map(work=>work.id).slice(0,1),...chosen.slice(0,1)]),sourceRoundIds:unique([diagnostic.sourceRoundId,entry.round.id]),competingExplanations:rivals.map(rival=>rival.qualityTitle),groupingSource:diagnostic.sourceSnapshot,preferenceVote:false}));
  }
  return {responses:validated.map(entry=>({roundId:entry.round.id,selectedIds:[...entry.answer.selectedIds],unsure:entry.answer.unsure,sourceRoundId:entry.round.evidence.diagnostic.sourceRoundId})),observations};
}

const categoryDefinitions=[
  ['appeal','What captivates you','Compare two similarly appealing works that differ in the leading explanation.'],
  ['admiration','Admiration and personal appeal','Compare admiration and appeal on another style or subject.'],
  ['attention','Attention and personal appeal','Report attention separately for works with similar personal appeal.'],
  ['connection','Personal connection and understanding','Compare what feels personal with what feels understandable.'],
  ['return','Unsettling works and returning','Compare an unsettling work you would revisit with one you would leave.'],
  ['context','Information and appreciation','Try another sourced note and retain no-change and uncertain answers.'],
  ['recognition','Familiarity, knowledge and discovery','Compare a familiar work with an unfamiliar work sharing the proposed connection.'],
  ['grouping','The relationships you make','Choose companions where the leading explanations of your actual group disagree.'],
  ['company','When company changes a response','Return to the same painting beside different works under the same question.']
];
function categories({patterns,responsePortrait,maps,context,recognition,grouping,arrangementQualities,entries,recordCount,existingObservations}){
  return categoryDefinitions.map(([id,title,next])=>{
    const matching=id==='appeal'?patterns.filter(p=>p.channel!=='admiration-of-making'):id==='admiration'?[...existingObservations.filter(o=>o.module==='making-and-taste'),...patterns.filter(p=>p.channel==='admiration-of-making')]:id==='attention'?maps.observations.filter(o=>o.module==='attention-and-appeal'):id==='connection'?maps.observations.filter(o=>o.module==='connection-and-understanding'):id==='return'?existingObservations.filter(o=>o.module==='tension-and-return'):id==='context'?[...(context.observations||[])]:id==='recognition'?recognition.observations:id==='grouping'?[...grouping.observations,...(arrangementQualities.findings||[])]:[];
    const tested=id==='appeal'?entries.some(e=>isContinuousPreferenceRound(e.round)||isComparisonPreferenceRound(e.round)):id==='admiration'?entries.some(e=>e.round.axis==='achievement'):id==='attention'?maps.records.some(r=>r.axis==='attention'):id==='connection'?maps.records.some(r=>r.axis==='connection'):id==='return'?entries.some(e=>e.round.axis==='returnResponse'):id==='context'?(context.responses||[]).length>0:id==='recognition'?recognition.responses.length>0||entries.some(entry=>entry.round.kind==='choice-grid'&&entry.round.selectionMode==='familiarity'):id==='grouping'?recordCount>0||matching.length>0:false;
    const supported=matching.filter(item=>item.status==='supported'||item.status==='qualified'||item.supportingSetCount>=2&&item.supportingWorkCount>=3),provisional=matching.filter(item=>!supported.includes(item)&&item.status!=='mixed'),status=supported.length?'supported':provisional.length?'provisional':tested?'open':'not-explored',first=supported[0]||provisional[0];
    return {id,title,readingTitle:first?.title||title,displayWorkIds:[...(first?.displayWorkIds||[])],status,statusLabel:{supported:'Recurring evidence',provisional:'Early indication',open:'Still open','not-explored':'Not yet explored'}[status],conclusion:first?.text||(tested?'Your completed answers do not yet separate a recurring explanation.':'This distinction has not yet been measured with the required questions.'),findingIds:matching.map(item=>item.id),support:first?.support||[],counter:first?.counter||[],competingExplanations:first?.competingExplanations||[],sourceRoundIds:unique(matching.flatMap(item=>item.sourceRoundIds||item.support?.map(row=>row.roundId)||[])),nextComparison:{title:next,reason:status==='supported'?'Test the boundary with another informative comparison.':status==='not-explored'?'Collect the missing distinction before drawing a conclusion.':'Separate the remaining explanations before strengthening this reading.'},limits:[...limits]};
  });
}

export function buildProfileIntelligence({works=[],rounds=[],answers={},tastePatterns={},responsePortrait={},reportedContextChanges={},preferenceEvidence={},arrangementQualities={},saved={},records=[],existingObservations=responsePortrait.observations||[],annotationReviews=REVIEWS}={}){
  const entries=collectResponseEvidence({works,rounds,answers}),continuous=entries.filter(e=>isContinuousPreferenceRound(e.round)),maps=mapReadings(entries),recognition=recognitionReadings(entries,preferenceEvidence),claims=claimReadings(entries,reportedContextChanges),grouping=groupingReadings(entries,{works,rounds,annotationReviews}),diagnostics=diagnosticReadings(entries,works,annotationReviews,rounds),observations=[...maps.observations,...recognition.observations,...claims.observations,...grouping.observations,...diagnostics.observations];
  const ledger=entries.map(({round,answer,index})=>({roundId:round.id,index,kind:round.kind,construct:round.evidence?.construct||null,workIds:ids(round),measurementScope:isContinuousPreferenceRound(round)?CONTINUOUS_PROTOCOL:isComparisonPreferenceRound(round)?'order-only':isOverallAppealRound(round)?'captured-overall-appeal':round.kind==='grid'?round.axis:round.evidence?.instrumentRevision||round.kind,...(round.kind==='spectrum'?{positions:structuredClone(answer.positions),gapInterpretation:isContinuousPreferenceRound(round)?'reported-personal-appeal-difference':isComparisonPreferenceRound(round)?'order-and-exact-ties-only':'original-instrument'}:{}),...(round.kind==='grid'?{points:structuredClone(answer.points),axisDefinition:structuredClone(round.axisDefinition||AXES[round.axis])}:{}),...(round.kind==='choice-grid'?{selectedIds:[...answer.selectedIds],explicitNone:answer.explicitNone===true,unsure:answer.unsure===true,selectionMode:round.selectionMode,...(isExplicitFamiliarity(round)?{familiarity:structuredClone(answer.familiarity||{})}:{})}:{}),...(round.kind==='statements'?{claims:structuredClone(answer.claims)}:{})}));
  const result={version:INTELLIGENCE_VERSION,observations,categories:categories({patterns:tastePatterns.patterns||[],responsePortrait,maps,context:reportedContextChanges,recognition,grouping,arrangementQualities,entries,recordCount:records.length,existingObservations}),recognition,contextExpectations:claims,grouping,diagnostics,maps:maps.records,appealSpacing:continuous.map(spacing),responseLedger:ledger,collectionIntentions:Object.entries(saved).filter(([,value])=>value?.look||value?.study).map(([workId,value])=>({workId,look:value.look===true,study:value.study===true,preferenceVote:false})),limits:[...limits]};
  result.nextSteps=result.categories.filter(category=>category.status!=='supported').map(category=>({id:'refine-'+category.id,title:category.nextComparison.title,reason:category.nextComparison.reason,categoryId:category.id,status:category.status,roundIds:category.sourceRoundIds}));
  return result;
}
