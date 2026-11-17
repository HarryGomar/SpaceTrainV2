import {AXES,validAnswer} from './engine.mjs';
import {isContinuousPreferenceRound} from './continuous-preference.mjs';
import {buildDiagnosticRound,bindDiagnosticRound} from './explanation-followups.mjs';
import {APPEAL_INVESTIGATION_PROTOCOL,selectAppealInvestigation,selectCollectionAppeal} from './appeal-investigations.mjs';
import {sameOrdinalArtworkIdentity} from './ordinal-preference-graph.mjs';
import {museumPreferenceFindings} from './museum-preferences.mjs';
import {validGallery} from './gallery-model.mjs';

export const PROFILE_REFINEMENT_PROTOCOL='optional-profile-refinement-v1';
export const PROFILE_REFINEMENT_LIMIT=10;
const ids=round=>round.works.map(work=>work.id),key=values=>JSON.stringify([...values].sort());
const valid=(round,answer)=>{try{return !round.unavailable&&validAnswer(round,answer);}catch{return false;}};
const focusOf=round=>round.evidence?.profileRefinement?.focus;
const mapOptions=[
  {axis:'attention',focus:'attention-and-appeal',title:'What holds your attention?',reason:'Compare what you like with what holds your attention across more paintings.'},
  {axis:'connection',focus:'connection-and-understanding',title:'What feels personal, and what feels understandable?',reason:'Explore whether a personal connection can recur even when a painting feels hard to understand.'},
  {axis:'returnResponse',focus:'unease-and-return',title:'How does each painting feel, and would you return to it?',reason:'Compare how a painting feels with whether you would choose to revisit it.'},
  {axis:'achievement',focus:'admiration-and-appeal',title:'What do you admire, and what appeals to you?',reason:'Compare what you admire in how a painting was made with how much you personally like it.'}
];

/** Select a question only when existing answers supply a specific uncertainty.
 * The priority and stopping rules are editorial, not calibrated information gain.
 * The host freezes the returned definition before showing it to the participant. */
export function nextProfileRefinement({works=[],rounds=[],answers={},attempts=[],saved={},seed='profile',annotationReviews,selection,afterBaseRoundCount=50}={}){
  if(attempts.length>=PROFILE_REFINEMENT_LIMIT)return null;
  const byId=new Map(works.map(work=>[work.id,work]));
  const history=rounds.filter(round=>round?.works?.length&&round.works.every(work=>sameOrdinalArtworkIdentity(work,byId.get(work.id),{requireSource:true})));
  const entries=history.filter(round=>valid(round,answers[round.id]));
  const id='profile-refine-'+String(attempts.length+1).padStart(2,'0');
  const attempted=focus=>attempts.filter(round=>focusOf(round)===focus).length;
  function finish(round,focus,reason,sourceRoundIds,categoryId='appeal'){
    return {round:{...round,evidence:{...round.evidence,batchIndex:selection?.batchIndex,profileRefinement:{protocol:PROFILE_REFINEMENT_PROTOCOL,focus,reason,categoryId,afterBaseRoundCount,sourceRoundIds:[...sourceRoundIds],slot:attempts.length+1,limit:PROFILE_REFINEMENT_LIMIT,selectionMethod:'editorial-uncertainty-and-disagreement',discoveryVote:false}}},focus,reason,categoryId,limit:PROFILE_REFINEMENT_LIMIT};
  }
  const parameters={works,rounds:history,answers,id,seed,annotationReviews,...selection};
  const focusedAttempts=attempts.filter(round=>round.evidence?.appealInvestigation?.scope==='local').length;
  const local=focusedAttempts<3?selectAppealInvestigation(parameters):null;
  if(local)return finish(local.round,local.focus,local.reason,local.sourceRoundIds);
  for(const source of history.filter(round=>round.kind==='exercise'&&round.exerciseKind==='curate')){
    const focus='museum-fit:'+source.id,record=answers[source.id]?.record;
    if(attempted(focus)||!record||!validGallery(record,source.works))continue;
    const comparison=museumPreferenceFindings(works,record).find(item=>item.museumComparison?.anchorIds.length>=2)?.museumComparison;
    if(!comparison)continue;
    const workIds=[comparison.higherRatedId,comparison.selectedId],anchorIds=comparison.anchorIds.slice(0,4);
    const round={id,kind:'choice-grid',title:'Which would you place beside this group?',hint:'Imagine the same place is available for either painting. Choose each one that fits the group, or choose None of these or Not sure.',works:workIds.map(id=>byId.get(id)),anchorWorks:anchorIds.map(id=>byId.get(id)),anchorIds,selectionMode:'relatedness',maxChoices:2,allowUnsure:true,evidence:{construct:'museum-fit-check',family:'relationship-followup',role:'probe',unconditional:false,sourceMuseum:{roundId:source.id,workIds:ids(source),record:structuredClone(record),comparison}}};
    return finish(round,focus,`Compare ${byId.get(workIds[0]).shortTitle||byId.get(workIds[0]).title} and ${byId.get(workIds[1]).shortTitle||byId.get(workIds[1]).title} beside the paintings you hung in that room.`,[source.id],'grouping');
  }
  const transfer=selectAppealInvestigation({...parameters,mode:'transfer'});
  if(transfer)return finish(transfer.round,transfer.focus,transfer.reason,transfer.sourceRoundIds);
  // A second identical companion task cannot clarify an already tested group.
  const checkedGroups=new Set(history.filter(round=>round.evidence?.diagnostic?.kind==='grouping'&&round.evidence.diagnostic.binding==='bound').map(round=>round.evidence.diagnostic.sourceRoundId));
  const groupingQuestion=buildDiagnosticRound({works,id,kind:'grouping',seed});
  groupingQuestion.evidence.diagnostic.policy=APPEAL_INVESTIGATION_PROTOCOL;
  const grouping=bindDiagnosticRound({round:groupingQuestion,works,rounds:history.filter(round=>!checkedGroups.has(round.id)),answers,annotationReviews,selection});
  if(!grouping.unavailable&&grouping.evidence.diagnostic.kind==='grouping'){
    const diagnostic=grouping.evidence.diagnostic,focus='grouping:'+diagnostic.sourceRoundId;
    if(!attempted(focus))return finish(grouping,focus,`Choose a companion for the group you made. Each offered painting shares a different feature: ${diagnostic.rivals.map(rival=>rival.qualityTitle.toLowerCase()).join(' or ')}.`,diagnostic.sourceRoundIds,'grouping');
  }
  const ratings=new Map();
  for(const round of entries.filter(isContinuousPreferenceRound))for(const work of round.works)ratings.set(work.id,{work,value:answers[round.id].positions[work.id],roundId:round.id});
  for(const option of mapOptions){
    if(attempted(option.focus))continue;
    const maps=entries.filter(round=>round.kind==='grid'&&round.axis===option.axis);
    if(!maps.length||new Set(maps.map(round=>key(ids(round)))).size>=3)continue;
    const held=option.axis==='achievement'?1:0,otherAxis=1-held;
    const rows=maps.flatMap(round=>round.works.map(work=>({work,round,point:answers[round.id].points[work.id]}))),interesting=rows.filter(row=>option.axis==='returnResponse'?row.point[0]>=65&&row.point[1]>=65:row.point[0]<=35&&row.point[1]>=65||rows.some(other=>other.round===row.round&&other.work.id!==row.work.id&&Math.abs(row.point[held]-other.point[held])<=12&&Math.abs(row.point[otherAxis]-other.point[otherAxis])>=30));
    if(!interesting.length)continue;
    const focusWork=interesting[0],measured=new Set(maps.flatMap(ids)),baseline=ratings.get(focusWork.work.id)?.value;
    const candidates=[...ratings.values()].filter(item=>!measured.has(item.work.id)).sort((a,b)=>(baseline===undefined?b.value-a.value:Math.abs(a.value-baseline)-Math.abs(b.value-baseline))||a.work.id.localeCompare(b.work.id));
    const selected=[{work:focusWork.work,value:baseline,roundId:ratings.get(focusWork.work.id)?.roundId}],artists=new Set([focusWork.work.artist]);
    for(const item of candidates){if(artists.has(item.work.artist))continue;selected.push(item);artists.add(item.work.artist);if(selected.length===4)break;}
    if(selected.length<4)continue;
    const construct={attention:'reported-attention',connection:'connection',returnResponse:'tension-and-return',achievement:'perceived-achievement'}[option.axis];
    const round={id,kind:'grid',axis:option.axis,axisDefinition:structuredClone(AXES[option.axis]),title:option.title,hint:'Place each painting using both axes. Each response is separate.',works:selected.map(item=>item.work),evidence:{construct,family:'response-map',role:'probe',unconditional:false,selectionRatings:selected.map(item=>({workId:item.work.id,value:item.value,roundId:item.roundId})),selectionLimit:'Earlier appeal helps select a comparison; it does not predict the response on the other axis.'}};
    const categoryId={attention:'attention',connection:'connection',returnResponse:'return',achievement:'admiration'}[option.axis];
    const title=focusWork.work.shortTitle||focusWork.work.title;
    return finish(round,option.focus,`Return to ${title} and report the same two judgments for three other paintings. ${option.reason}`,[...new Set([focusWork.round.id,...selected.map(item=>item.roundId).filter(Boolean)])],categoryId);
  }
  if(!attempts.some(round=>round.evidence?.collectionAppeal)){
    const collection=selectCollectionAppeal({...parameters,saved});
    if(collection)return finish(collection.round,collection.focus,collection.reason,collection.sourceRoundIds);
  }
  return null;
}

export function renderProfileRefinementOffer(offer,{esc}={}){
  if(!offer)return '';
  return '<aside class="tp-refinement-offer" aria-label="Optional focused comparisons"><div><small>Optional comparisons · up to 10</small><p>'+esc(offer.reason)+'</p></div><button type="button" class="text-button" data-action="deep-refine">'+(offer.resume?'Continue refining':'Refine reading')+' <span aria-hidden="true">&#8599;</span></button></aside>';
}
