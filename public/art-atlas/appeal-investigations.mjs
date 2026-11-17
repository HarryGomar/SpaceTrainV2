import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
import {resolveArtworkAttributes} from './artwork-quality-review.mjs';
import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import CURATION from './curation-notes.json' with {type:'json'};
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {sameOrdinalArtworkIdentity,artworkPreviewHashes} from './ordinal-preference-graph.mjs';
import {collectTastePatternSources,analyzeTasteDimension} from './taste-axes.mjs';
import {buildPreferenceBasis} from './profile-evidence.mjs';
import {continuousAppealValue,isContinuousPreferenceRound,withContinuousPreference} from './continuous-preference.mjs';
import {FAMILIARITY_SELECTION_PROTOCOL,isExplicitFamiliarity,choiceGridExposure} from './discovery-grid.mjs';
import {validAnswer} from './engine.mjs';
import {validGallery} from './gallery-model.mjs';

export const APPEAL_INVESTIGATION_PROTOCOL='appeal-investigation-v1';
const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);
const label=key=>ARTWORK_ATTRIBUTE_DEFINITIONS[key].label.toLowerCase();
const short=work=>work.shortTitle||work.title;
const unique=values=>[...new Set(values)];
const ids=round=>round.works.map(work=>work.id);
const pairs=items=>items.flatMap((item,index)=>items.slice(index+1).map(other=>[item,other]));
const pairKey=(a,b)=>JSON.stringify([a,b].sort());
const artist=work=>work?.artistKnown!==false&&typeof work?.artist==='string'&&!/unknown|anonymous|unidentified/i.test(work.artist)?work.artist.trim().toLowerCase()||null:null;
const value=(row,key)=>row?.values[key]??null;
const goal={local:'local',transfer:'transfer'};
const minimumGap=10;
const maxAnchorChecks=2;
const subjectFamilies=new Map(CURATION.annotations.map(item=>[item.workId,item.subjectFamily]));
const subject=work=>work?.analysis?.subjectFamily||work?.subjectFamily||subjectFamilies.get(work?.id)||null;
const eligible=work=>isStudyEligibleArtwork(work)&&work.sourceUrl&&work.image;
// Already sourced works that supply unlike treatments for the supplemental
// exploration slot. Their main-panel reservations still belong to curation.
const LANDSCAPE_EXPLORATION_IDS=new Set(['extended-cma-83462','extended-cma-150693','extended-nga-204911','study-monet-japanese-footbridge','opening-cma-106088','extended-nga-52624']);

function reviewRows(works,annotationReviews){
  const rows=new Map();
  for(const work of works){
    const review=resolveArtworkAttributes(work,{annotationReviews,currentWorks:works});
    const values=Object.fromEntries(keys.map(key=>[key,review?.attributes[key].status==='present'?1:review?.attributes[key].status==='absent'?0:null]));
    rows.set(work.id,{work,review,values,artist:artist(work)});
  }
  return rows;
}

// Unknown qualities never supply a match. The two proposed drivers are excluded
// from the control count. Medium, subject and prior exposure can still differ.
export function compareAppealControls(left,right,drivers=[]){
  const known=keys.filter(key=>!drivers.includes(key)&&value(left,key)!==null&&value(right,key)!==null);
  const differences=known.filter(key=>value(left,key)!==value(right,key));
  return {known:known.length,differences,unknown:keys.filter(key=>!drivers.includes(key)&&!known.includes(key)),usable:known.length>=8&&differences.length<=3&&known.length-differences.length>=known.length*.75};
}

function recordedHistory(rounds,answers){
  const exposure=new Map(),recognition=new Map(),compared=new Set(),rated=new Set();
  for(const round of rounds){
    const answer=answers[round.id],record=answer?.record,choice=round.kind==='choice-grid'?choiceGridExposure(round,answer):null;
    const shown=round.kind==='statements'?[]:round.kind==='exercise'?(record?.presentedIds||[]):round.kind==='choice-grid'?(choice?.presentedIds||[]):[...ids(round),...(round.anchorIds||[])];
    for(const id of new Set(shown))exposure.set(id,(exposure.get(id)||0)+1);
    if(isContinuousPreferenceRound(round)){
      for(const [a,b] of pairs(ids(round)))compared.add(pairKey(a,b));
      for(const id of ids(round))if(continuousAppealValue(round,answer,id)!==null)rated.add(id);
    }
    if(round.kind==='choice-grid'&&(isExplicitFamiliarity(round)||round.evidence?.familiarityProtocol===FAMILIARITY_SELECTION_PROTOCOL)&&validAnswer(round,answer)){
      for(const id of ids(round)){
        const before=isExplicitFamiliarity(round)?answer.familiarity?.[id]:answer.selectedIds?.includes(id)?'seen':null;
        if(!['seen','new'].includes(before))continue;
        const prior=recognition.get(id)?.reportedBefore;
        recognition.set(id,{...recognition.get(id),reportedBefore:prior&&prior!==before?'mixed':before,familiarityRoundId:round.id});
      }
    }
    if(round.kind==='match'&&round.field==='artist'&&validAnswer(round,answer)){
      for(const work of round.works){
        const guess=answer.guesses?.[work.id];
        if(guess===undefined)continue;
        const status=guess==='unsure'?'unsure':round.options?.find(option=>option.id===guess)?.label===work.artist?'cued-correct':'cued-other';
        recognition.set(work.id,{...recognition.get(work.id),attribution:status,attributionRoundId:round.id,certainty:answer.certainty?.[work.id]||null,feedbackSeen:answer.feedbackSeen===true});
      }
    }
  }
  return {exposure,recognition,compared,rated};
}

function earlierSources(works,rounds,answers){
  const byId=new Map(works.map(work=>[work.id,work]));
  const shown=rounds.filter(round=>!round?.unavailable&&round?.works?.length&&round.works.every(work=>sameOrdinalArtworkIdentity(work,byId.get(work.id),{requireSource:true})));
  const sources=collectTastePatternSources({works,rounds:shown,answers});
  return {shown,sources,scope:sources.preferenceScopes.find(scope=>scope.channel==='personal-appeal'),history:recordedHistory(shown,answers)};
}

function localAnchors(scope,basis,shown,rows){
  const anchors=new Map(),declared=new Map([...basis.favourites.map(item=>[item.workId,{item,direction:1}]),...basis.dislikes.map(item=>[item.workId,{item,direction:-1}])]);
  for(const set of scope?.sets||[]){
    for(const item of set.items){
      const peers=set.items.filter(row=>row!==item),direction=Math.sign(item.value-50),isolated=peers.length?Math.min(...peers.map(other=>Math.abs(item.value-other.value))):0;
      const polar=peers.filter(other=>Math.sign(other.value-50)===-direction).sort((a,b)=>Math.abs(item.value-b.value)-Math.abs(item.value-a.value))[0];
      const gap=polar?Math.abs(item.value-polar.value):0;
      if(Math.abs(item.value-50)<25||isolated<12&&gap<35)continue;
      const previous=shown.filter(round=>round.evidence?.appealInvestigation?.anchorIds?.includes(item.work.id)&&round.evidence?.appealInvestigation?.scope==='local');
      if(previous.length>=maxAnchorChecks)continue;
      const repeats=scope.checks.filter(check=>check.entry.round.evidence?.repeatOf===set.entry.round.id).flatMap(check=>check.items.filter(other=>other.work.id===item.work.id));
      if(repeats.some(other=>(other.value-50)*direction<=-15))continue;
      const consistentRepeat=repeats.some(other=>(other.value-50)*direction>=25);
      anchors.set(item.work.id,{id:item.work.id,direction,source:{roundId:set.entry.round.id,workId:item.work.id,value:item.value,positions:{...set.entry.answer.positions}},priority:Math.abs(item.value-50)*.45+Math.min(35,isolated)*.6+Math.min(70,gap)*.2+Number(consistentRepeat)*4-previous.length*18});
    }
  }
  for(const [id,{item,direction}] of declared){
    if(shown.filter(round=>round.evidence?.appealInvestigation?.anchorIds?.includes(id)).length>=maxAnchorChecks)continue;
    const previous=anchors.get(id),rating=basis.ratings.find(row=>row.workId===id&&isContinuousPreferenceRound(row.entry.round));
    // A changed rating is preserved alongside the declaration. Do not use
    // mutually opposite reports to initiate a one-directional prediction.
    if(rating&&Math.sign(rating.score-50)===-direction)continue;
    const declaration={roundId:item.entry.round.id,workId:id,type:direction===1?'favourite':'dislike'};
    anchors.set(id,{id,direction,source:rating?{roundId:rating.entry.round.id,workId:id,value:rating.score,positions:{...rating.entry.answer.positions},declaration}:{declaration},priority:Math.max(27,previous?.priority||0)+18});
  }
  const ordered=[...anchors.values()].filter(item=>rows.get(item.id)?.artist).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  return ordered.slice(0,8).map(anchor=>{
    const opposite=ordered.find(other=>other.direction===-anchor.direction&&declared.has(other.id)&&
      compareAppealControls(rows.get(anchor.id),rows.get(other.id)).usable);
    return {...anchor,opposite:opposite||null};
  });
}

function priorUse(rounds,scope,key,direction,anchorId){
  return rounds.some(round=>{
    const check=round.evidence?.appealInvestigation;
    return check?.scope===scope&&(!anchorId||check.anchorIds.includes(anchorId))&&check.alternatives.some(item=>item.quality===key&&item.direction===direction);
  });
}

function targetContrast({rivals,rows,candidates,history,anchor,opposite,scope,allowed,usedEarly}){
  const drivers=rivals.map(item=>item.quality),anchorArtist=rows.get(anchor?.id)?.artist,oppositeArtist=rows.get(opposite?.id)?.artist;
  const side=(index,other)=>candidates.flatMap(row=>{
    const id=row.work.id,early=!allowed.has(id);
    if(id===anchor?.id||id===opposite?.id||!row.artist||row.artist===anchorArtist||row.artist===oppositeArtist||early&&usedEarly||
      value(row,rivals[index].quality)!==(rivals[index].direction===1?1:0)||
      value(row,rivals[other].quality)!==(rivals[other].direction===1?0:1))return [];
    const fit=anchor?compareAppealControls(rows.get(anchor.id),row,drivers):null;
    if(fit&&(fit.known<7||fit.differences.length>5))return [];
    if(scope==='transfer'&&history.rated.has(id))return [];
    const recorded=history.recognition.get(id),anchorRecognition=history.recognition.get(anchor?.id);
    const familiarityTest=anchorRecognition?.reportedBefore==='seen'||anchorRecognition?.attribution==='cued-correct'&&anchorRecognition?.feedbackSeen&&anchorRecognition.certainty!=='guessed';
    const priority=(history.rated.has(id)?0:5)-Math.min(3,history.exposure.get(id)||0)-(early?4:0)+(fit?(fit.known-fit.differences.length*2)*.55:0)+(familiarityTest&&recorded?.reportedBefore==='new'?2:0)-(recorded?.feedbackSeen?2:0);
    return [{row,early,priority,recorded}];
  }).sort((a,b)=>b.priority-a.priority||a.row.work.id.localeCompare(b.row.work.id)).slice(0,16);
  const left=side(0,1),right=side(1,0);
  let best=null;
  for(const a of left)for(const b of right){
    const aId=a.row.work.id,bId=b.row.work.id;
    if(a.row.artist===b.row.artist||a.early&&b.early||history.compared.has(pairKey(aId,bId)))continue;
    if(scope==='local'&&history.rated.has(aId)&&history.rated.has(bId))continue;
    const controls=compareAppealControls(a.row,b.row,drivers);
    if(!controls.usable)continue;
    const leftRecognition=a.recorded?.reportedBefore,rightRecognition=b.recorded?.reportedBefore;
    const subjectMatch=subject(a.row.work)&&subject(a.row.work)===subject(b.row.work);
    const score=a.priority+b.priority+controls.known*.35-controls.differences.length*2+Number(!!subjectMatch)*2+(a.row.work.medium&&a.row.work.medium===b.row.work.medium?1:0)+(leftRecognition&&rightRecognition&&leftRecognition===rightRecognition?2:0)-(leftRecognition&&rightRecognition&&leftRecognition!==rightRecognition?4:0)-(a.recorded?.feedbackSeen!==b.recorded?.feedbackSeen?1:0);
    if(!best||score>best.score)best={left:a,right:b,controls,score};
  }
  return best;
}

function bindProposal({id,scope,rivals,target,anchor,history,rows,sourceRoundIds=[],answers,seed}){
  const workIds=[target.left.row.work.id,target.right.row.work.id],anchorIds=anchor?[anchor.id,...(anchor.opposite?[anchor.opposite.id]:[])]:[];
  const flipped=Array.from(seed+id).reduce((sum,char)=>sum+char.charCodeAt(0),0)%2;
  const works=(flipped?[...workIds].reverse():workIds).map(id=>rows.get(id).work);
  const alternatives=rivals.map((item,index)=>({...item,predictedWorkId:workIds[index],title:label(item.quality)}));
  const roundIds=unique([...sourceRoundIds,...[anchor,anchor?.opposite].flatMap(item=>[item?.source.roundId,item?.source.declaration?.roundId]).filter(Boolean)]);
  const investigation={protocol:APPEAL_INVESTIGATION_PROTOCOL,scope,anchorIds,alternatives,sourceRoundIds:roundIds,anchorObservations:[anchor,anchor?.opposite].filter(Boolean).map(item=>item.source),controls:target.controls,training:sourceRoundIds.map(roundId=>({roundId,positions:{...answers[roundId].positions}})),
    qualitySnapshots:Object.fromEntries(unique([...anchorIds,...workIds]).map(id=>{const {review,values}=rows.get(id);return [id,{values,sourceUrl:review.annotationBasis.sourceUrl,image:review.annotationBasis.image,previewSha256:review.annotationBasis.previewSha256}];})),
    earlierExposure:Object.fromEntries(unique([...anchorIds,...workIds]).map(id=>[id,{recordedPresentations:history.exposure.get(id)||0,...history.recognition.get(id)}])),
    previouslyRatedIds:workIds.filter(id=>history.rated.has(id)),pulledForwardIds:[target.left,target.right].filter(item=>item.early).map(item=>item.row.work.id),comparisonNovel:true,frozenBeforeAnswer:true};
  const [a,b]=alternatives,reason=anchor?
    `See whether your response to ${short(rows.get(anchor.id).work)} carries over when ${a.title} and ${b.title} are separated.`:
    `Compare two paintings you have yet to rate to see whether ${a.title} or ${b.title} better accounts for your earlier choices.`;
  const focus=scope+':'+(anchorIds.join('|')||alternatives.map(item=>item.quality+':'+item.direction).sort().join('|'));
  return {round:withContinuousPreference({id,kind:'spectrum',criterion:'preference',works,evidence:{construct:'preference',family:'individual-choice',role:'probe',unconditional:true,appealInvestigation:investigation}}),focus,reason,sourceRoundIds:roundIds};
}

/** Select one comparison at presentation time from earlier shown definitions.
 * Thresholds, ranking and the shortlist size are editorial design choices.
 */
export function selectAppealInvestigation({id,works=[],rounds=[],answers={},candidateIds,earlyIds=[],avoidIds=[],batchIndex=0,mode=goal.local,seed='',annotationReviews=REVIEWS}={}){
  const {shown,sources,scope,history}=earlierSources(works,rounds,answers);
  if(!scope?.sets.length)return null;
  const rows=reviewRows(works,annotationReviews),allowed=new Set(candidateIds||works.map(work=>work.id)),early=new Set(earlyIds),avoid=new Set(avoidIds);
  const candidates=[...rows.values()].filter(row=>row.review&&eligible(row.work)&&!avoid.has(row.work.id)&&(allowed.has(row.work.id)||early.has(row.work.id)));
  const usedEarly=shown.some(round=>(round.evidence?.batchIndex??0)===batchIndex&&round.evidence?.appealInvestigation?.pulledForwardIds?.length);
  const select=(rivals,anchor,sourceRoundIds)=>{
    const target=targetContrast({rivals,rows,candidates,history,anchor,opposite:anchor?.opposite,scope:mode,allowed,usedEarly:usedEarly||!anchor});
    return target?{id,scope:mode,rivals,target,anchor,history,rows,sourceRoundIds,answers,seed}:null;
  };
  if(mode===goal.transfer){
    const recurring=keys.flatMap(quality=>{
      const result=analyzeTasteDimension(scope,work=>value(rows.get(work.id),quality));
      const direction=result.candidateDirection,training=result.recurringSupport.length?result.recurringSupport:result.support;
      if(!direction||result.supportingSetCount<2||result.opposingSetCount>=result.supportingSetCount||priorUse(shown,mode,quality,direction))return [];
      return [{quality,direction,recurring:result.summaryEligible,support:result.supportingSetCount,roundIds:unique(training.map(item=>item.roundId)),supportIds:unique(training.flatMap(item=>item.workIds))}];
    }).sort((a,b)=>b.support-a.support||a.quality.localeCompare(b.quality)).slice(0,6);
    const proposals=pairs(recurring).filter(([a,b])=>a.direction===b.direction&&(a.recurring||b.recurring)).map(rivals=>select(rivals,null,unique(rivals.flatMap(item=>item.roundIds)))).filter(Boolean);
    proposals.sort((a,b)=>b.target.score-a.target.score);
    return proposals[0]?bindProposal(proposals[0]):null;
  }
  const anchors=localAnchors(scope,buildPreferenceBasis(sources.entries),shown,rows);
  const previous=shown.some(round=>round.evidence?.appealInvestigation)?readAppealInvestigations({works,rounds:shown,answers}).filter(item=>item.scope==='local'&&!item.sourceChanged):[];
  let best=null;
  for(const anchor of anchors){
    const row=rows.get(anchor.id);
    const retained=previous.findLast(item=>item.anchorIds[0]===anchor.id)?.favouredQuality;
    const drivers=keys.filter(quality=>value(row,quality)===1&&(quality===retained||!priorUse(shown,mode,quality,anchor.direction,anchor.id)));
    for(const qualities of pairs(drivers)){
      if(retained&&!qualities.includes(retained))continue;
      const contrastsBoundary=anchor.opposite&&qualities.some(key=>value(rows.get(anchor.opposite.id),key)===0);
      const rivals=qualities.map(quality=>({quality,direction:anchor.direction}));
      const proposal=select(rivals,anchor,[]);
      if(!proposal)continue;
      const score=anchor.priority+proposal.target.score+Number(!!contrastsBoundary)*8;
      if(!best||score>best.score)best={proposal,score};
    }
  }
  return best?bindProposal(best.proposal):null;
}

/** A genuine explore slot. Breadth is measured from answered appeal sets and
 * distinct artists, including the natural-settings quality within that sample.
 */
export function buildAppealExploration({id,works=[],rounds=[],answers={},candidateIds,earlyIds=[],avoidIds=[],seed='',landscapeCheck=false,annotationReviews=REVIEWS}={}){
  const {sources,scope,history}=earlierSources(works,rounds,answers),rows=reviewRows(works,annotationReviews);
  const allowed=new Set(candidateIds||works.map(work=>work.id)),avoid=new Set(avoidIds),artists=new Set(),regions=new Set(),selected=[];
  const discovery=(scope?.sets||[]).flatMap(set=>set.items);
  // Prefer explicitly reviewed landscape/water subjects. Open, unpeopled
  // terrain also supplies a landscape comparison even without a genre label.
  const landscape=row=>row&&value(row,'landscape')===1&&(LANDSCAPE_EXPLORATION_IDS.has(row.work.id)||subject(row.work)==='landscape-or-water'||value(row,'open-expanse')===1&&value(row,'intimate-figures')===0&&value(row,'human-relationships')===0);
  const sampledLandscapes=new Set(discovery.filter(item=>landscape(rows.get(item.work.id))).map(item=>artist(item.work)).filter(Boolean));
  const counts=new Map();
  for(const {work} of discovery)counts.set(artist(work),(counts.get(artist(work))||0)+1);
  const earlyLandscapes=new Set(landscapeCheck?earlyIds.filter(id=>LANDSCAPE_EXPLORATION_IDS.has(id)&&landscape(rows.get(id))):[]);
  const pool=[...rows.values()].filter(row=>eligible(row.work)&&row.artist&&(allowed.has(row.work.id)||earlyLandscapes.has(row.work.id))&&!avoid.has(row.work.id));
  const seedOrder=workId=>Array.from(seed+'|'+id+'|'+workId).reduce((n,char)=>Math.imul(n^char.charCodeAt(0),16777619),2166136261)>>>0;
  const landscapeTarget=landscapeCheck?2:sampledLandscapes.size<Math.max(4,Math.ceil(counts.size*.18))?1:0;
  const strength=row=>Number(!history.rated.has(row.work.id))*14-Math.min(4,history.exposure.get(row.work.id)||0)-Math.min(3,counts.get(row.artist)||0)*1.25+
    Number(!!landscape(row)&&selected.filter(landscape).length<landscapeTarget)*(landscapeCheck?12:5)+
    Number(!!row.work.country&&!regions.has(row.work.country))*1.5+
    Number(landscapeCheck&&selected.length===1&&!!row.work.movement&&row.work.movement!==selected[0].work.movement)*2;
  for(let index=0;index<3;index++){
    let proposals=pool.filter(row=>!artists.has(row.artist)&&selected.every(other=>!history.compared.has(pairKey(row.work.id,other.work.id)))&&
      (!earlyLandscapes.has(row.work.id)||selected.filter(landscape).length<landscapeTarget&&!selected.some(other=>earlyLandscapes.has(other.work.id))));
    if(landscapeCheck&&selected.filter(landscape).length<landscapeTarget){
      const landscapes=proposals.filter(landscape);
      if(landscapes.length)proposals=landscapes;
    }
    proposals.sort((a,b)=>strength(b)-strength(a)||seedOrder(a.work.id)-seedOrder(b.work.id)||a.work.id.localeCompare(b.work.id));
    const row=proposals[0];
    if(!row)break;
    selected.push(row);artists.add(row.artist);regions.add(row.work.country);
  }
  if(selected.length<2)return null;
  return withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:selected.map(row=>row.work),evidence:{construct:'preference',family:'individual-choice',role:'discovery',unconditional:true,selectionMethod:landscapeCheck?'landscape-exploration':'breadth-after-open-investigation',coverageAtSelection:{answeredSets:scope?.sets.length||0,landscapeArtists:sampledLandscapes.size,landscapeWorkIds:selected.filter(landscape).map(row=>row.work.id),supplementalLandscapeIds:selected.filter(row=>earlyLandscapes.has(row.work.id)).map(row=>row.work.id),validEntries:sources.entries.length}}});
}

export function selectCollectionAppeal({id,works=[],rounds=[],answers={},saved={},candidateIds,avoidIds=[],annotationReviews=REVIEWS}={}){
  const {shown,sources,history}=earlierSources(works,rounds,answers),rows=reviewRows(works,annotationReviews),avoid=new Set(avoidIds);
  const allowed=new Set(candidateIds||works.map(work=>work.id)),intentions=new Map();
  for(const entry of sources.entries)if(entry.round.kind==='choice-grid'&&entry.round.evidence?.construct==='unranked-subset-selection'){
    for(const workId of entry.answer.selectedIds)intentions.set(workId,{from:'keep',roundId:entry.round.id});
  }
  for(const round of shown)if(round.kind==='exercise'&&round.exerciseKind==='curate'&&!answers[round.id]?.skipped){
    const record=answers[round.id]?.record;
    if(!validGallery(record,round.works))continue;
    for(const workId of Object.keys(record.placements||{}))if(record.presentedIds?.includes(workId))intentions.set(workId,{from:'room',roundId:round.id});
  }
  for(const [workId,state] of Object.entries(saved))if((state?.look===true||state?.study===true)&&!intentions.has(workId))intentions.set(workId,{from:state.look?'look':'study'});
  const previous=new Set(shown.map(round=>round.evidence?.collectionAppeal?.workId));
  for(const [workId,intent] of intentions){
    const anchor=rows.get(workId);
    if(!anchor?.review||!eligible(anchor.work)||!anchor.artist||history.rated.has(workId)||previous.has(workId))continue;
    const peers=[...rows.values()].filter(row=>allowed.has(row.work.id)&&!avoid.has(row.work.id)&&eligible(row.work)&&row.artist&&row.artist!==anchor.artist).flatMap(row=>{
      const controls=compareAppealControls(anchor,row);
      return controls.usable?[{row,score:controls.known-controls.differences.length*3+(subject(anchor.work)&&subject(anchor.work)===subject(row.work)?3:0)-(history.exposure.get(row.work.id)||0)}]:[];
    }).sort((a,b)=>b.score-a.score||a.row.work.id.localeCompare(b.row.work.id));
    if(!peers.length)continue;
    const compared=peers[0].row.work;
    const action={keep:'kept',room:'placed in your room',look:'saved for another look',study:'saved for study'}[intent.from];
    return {round:withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:[compared,anchor.work],evidence:{construct:'preference',family:'individual-choice',role:'probe',unconditional:true,collectionAppeal:{workId,...intent}}}),
      focus:'collection-appeal:'+workId,reason:`Compare the personal appeal of ${short(anchor.work)}, which you ${action}, and ${short(compared)}.`,sourceRoundIds:intent.roundId?[intent.roundId]:[]};
  }
  return null;
}

function frozenValues(work,snapshot){
  if(!snapshot||snapshot.sourceUrl!==work.sourceUrl||snapshot.image!==work.image||!(/^[a-f0-9]{64}$/i.test(snapshot.previewSha256))||
    artworkPreviewHashes(work).some(hash=>typeof hash!=='string'||hash.toLowerCase()!==snapshot.previewSha256.toLowerCase())||
    keys.some(key=>![null,0,1].includes(snapshot.values?.[key])))return null;
  return {values:snapshot.values};
}

/** A frozen prediction changes a conclusion only after a valid response to
 * that exact comparison. Reused works stay dependent and edits cannot refit it.
 */
export function readAppealInvestigations({works=[],rounds=[],answers={}}={}){
  const {shown,sources}=earlierSources(works,rounds,answers),byId=new Map(shown.map((round,index)=>[round.id,{round,index}]));
  const byWorkId=new Map(works.map(work=>[work.id,work]));
  return sources.entries.flatMap(({round,answer})=>{
    const test=round.evidence?.appealInvestigation,index=byId.get(round.id)?.index;
    if(!isContinuousPreferenceRound(round)||test?.protocol!==APPEAL_INVESTIGATION_PROTOCOL||test.frozenBeforeAnswer!==true||!Object.values(goal).includes(test.scope)||round.works.length!==2||!Array.isArray(test.sourceRoundIds)||!test.sourceRoundIds.length||new Set(test.sourceRoundIds).size!==test.sourceRoundIds.length||!test.sourceRoundIds.every(id=>byId.has(id)&&byId.get(id).index<index)||
      !Array.isArray(test.alternatives)||test.alternatives.length!==2||test.alternatives.some(item=>!keys.includes(item?.quality)||![1,-1].includes(item.direction))||test.alternatives[0].quality===test.alternatives[1].quality||test.alternatives[0].predictedWorkId===test.alternatives[1].predictedWorkId||!Array.isArray(test.anchorIds)||!Array.isArray(test.anchorObservations))return [];
    if(test.anchorObservations.some(item=>!item||!item.roundId&&!item.declaration||item.roundId&&!test.sourceRoundIds.includes(item.roundId)||item.declaration&&!test.sourceRoundIds.includes(item.declaration.roundId))||
      !Array.isArray(test.training)||test.training.some(item=>!item?.positions||!test.sourceRoundIds.includes(item.roundId)))return [];
    const anchors=test.anchorIds.map(id=>byWorkId.get(id));
    if(test.scope===goal.local&&(anchors.length<1||anchors.length>2||anchors.length!==test.anchorObservations.length||
      anchors.some((work,index)=>!work||!frozenValues(work,test.qualitySnapshots?.[work.id])||work.id!==(test.anchorObservations[index].workId||test.anchorObservations[index].declaration?.workId))||
      test.alternatives.some(item=>test.qualitySnapshots[anchors[0].id].values[item.quality]!==1)))return [];
    if(test.scope===goal.transfer&&(anchors.length||test.training.length<3))return [];
    const review=round.works.map(work=>frozenValues(work,test.qualitySnapshots?.[work.id]));
    if(review.some(item=>!item)||!compareAppealControls(review[0],review[1],test.alternatives.map(item=>item.quality)).usable)return [];
    for(const alternative of test.alternatives){
      const values=review.map(row=>value(row,alternative.quality));
      if(values.includes(null)||values[0]===values[1]||round.works[(values[0]-values[1])*alternative.direction>0?0:1].id!==alternative.predictedWorkId)return [];
    }
    const prevRound=shown.slice(0,index);
    const history=recordedHistory(prevRound,answers),workIds=ids(round);
    if(history.compared.has(pairKey(...workIds)))return [];
    const sourceChanged=[...test.anchorObservations,...(test.training||[])].some(item=>item.roundId&&Object.entries(item.positions||{}).some(([id,n])=>continuousAppealValue(byId.get(item.roundId)?.round,answers[item.roundId],id)!==n)||
      item.declaration&&!answers[item.declaration.roundId]?.selectedIds?.includes(item.declaration.workId));
    const values=workIds.map(id=>answer.positions[id]),gap=values[0]-values[1],winner=gap>0?workIds[0]:workIds[1];
    const favoured=test.alternatives.find(item=>item.predictedWorkId===winner),direction=test.alternatives.every(item=>item.direction===test.alternatives[0].direction)?test.alternatives[0].direction:0;
    const outcome=Math.abs(gap)<minimumGap?'close':direction===1&&Math.max(...values)<=50?'neither-appealed':direction===-1&&Math.min(...values)>=50?'neither-disliked':'separated';
    return [{...test,roundId:round.id,workIds,values,signedGap:gap,outcome,favouredQuality:outcome==='separated'?favoured.quality:null,favouredDirection:outcome==='separated'?favoured.direction:null,sourceChanged,independentOfTraining:workIds.every(id=>!history.rated.has(id))}];
  });
}

export function applyAppealInvestigationChecks(patterns,checks){
  return patterns.map(pattern=>{
    if(pattern.channel!=='personal-appeal'||pattern.bundle||!pattern.direction)return pattern;
    const relevant=checks.filter(check=>check.scope===goal.transfer&&check.independentOfTraining&&!check.sourceChanged&&check.alternatives.some(item=>item.quality===pattern.qualityKey&&item.direction===pattern.direction));
    if(!relevant.length)return pattern;
    const strong=relevant.filter(check=>check.favouredQuality===pattern.qualityKey&&check.favouredDirection===pattern.direction);
    const opposing=relevant.filter(check=>check.outcome==='separated'&&!strong.includes(check));
    const weaker=relevant.filter(check=>check.outcome==='neither-appealed'||check.outcome==='neither-disliked');
    const check=opposing[0]||weaker[0]||strong[0]||relevant[0];
    const update=opposing.length?'challenged':weaker.length?'did-not-transfer':strong.length?'transferred-once':'open';
    const text=opposing.length?' A later comparison with two previously unrated paintings favoured another explanation. This pattern is still open.':weaker.length?' The new paintings stayed on the same side of neutral, so the proposed transfer remains open.':strong.length?' The direction also held in one new comparison where the two explanations pointed to different paintings.':' A later comparison left the two explanations close.';
    return {...pattern,...(opposing.length||weaker.length?{status:'mixed',summaryEligible:false,priority:5}:{}),text:pattern.text+text,investigation:{status:update,roundIds:relevant.map(item=>item.roundId),alternatives:check.alternatives},sourceRoundIds:unique([...pattern.sourceRoundIds,...relevant.map(item=>item.roundId)])};
  });
}
