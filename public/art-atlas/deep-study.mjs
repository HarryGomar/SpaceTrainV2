import {nextProfileRefinement,PROFILE_REFINEMENT_PROTOCOL,PROFILE_REFINEMENT_LIMIT} from './profile-refinement.mjs';
import {quizCollectionChoices} from './collection-controls.mjs';
import {isReviewedVisualDescriptor,FEATURE_SEMANTIC_VERSION} from './visual-descriptor-semantics.mjs';
import {isDiagnosticRound,bindDiagnosticRound} from './explanation-followups.mjs';
import {simplifyActiveInteraction} from './quiet-interactions.mjs';
import {captureArtworkExposure} from './recognition-evidence.mjs';
import {museumOffer,restrictMuseumDraft,MUSEUM_OFFER_SCOPE} from './museum-offer.mjs';
import {isOverallAppealRound} from './appeal-scale.mjs';
import {CONTINUOUS_PROTOCOL} from './continuous-preference.mjs';
import {COMPARISON_PROTOCOL,isComparisonPreferenceRound} from './comparison-protocol.mjs';
import {isFinalRefinementRound,bindFinalRefinementRound} from './final-refinement.mjs';
import {createStudyArchiveStore,storeStudyArchives,loadStudyArchives,encodeStudyWithArchives} from './study-archives.mjs';
import {createActiveStudyPersistence,loadActiveStudy,isActiveStudyReference} from './active-study-storage.mjs';
import {discoveryGridMarkup,toggleGridChoice,expandKeepSelectionRound,setChoiceGridPage,PAGED_FAVOURITES,isExplicitFamiliarity} from './discovery-grid.mjs';
import {isSymbolismRound,validSymbolismDefinition,reduceSymbolismDraft} from './symbolism-rounds.mjs';
import {isContextChangeRound,validContextChangeDefinition,bindContextChangeRound,reduceContextChangeDraft,CONTEXT_CHANGE_PROMPT,CONTEXT_CHANGE_OPTIONS} from './context-change.mjs';
import {createContrastController,validContrastDefinition,upgradeActiveNeighbourRound} from './contrast-rounds.mjs';
import {applyTaskSignals} from './task-signals.mjs';
import { buildStudyRounds, STUDY_LENGTHS, STUDY_BANK_REVISION, MAX_STUDY_LENGTH } from './question-bank.mjs';
import { createInteractions } from './interactions.mjs';
import { renderStudyTitle } from './experience-view.mjs';
import {buildJourneyRounds,createJourneyStimulusPlan,bindJourneyStimulusPlan,journeyAdaptiveQuotas,JOURNEY_PROTOCOL,JOURNEY_REVISION,JOURNEY_LENGTH,JOURNEY_MAX_LENGTH} from './journey-bank.mjs';
import {reservationPoolKeys} from './stimulus-planner.mjs';
import {updateArtworkCorners} from './artwork-corners.mjs';
import {captureGalleryPreview,GALLERY_CONTEXT_KEY} from './painting-gallery-data.mjs';
import {planAdaptivePanels} from './adaptive-selection.mjs';
import {buildTastePortrait} from './taste-portrait.mjs';
import {renderTastePortrait} from './taste-portrait-view.mjs';
import {buildTasteConnections} from './taste-connections.mjs';
import {createScenario,validScenario,validScenarioDraft,analyzeScenarios} from './scenarios.mjs';
import {createSortingTable} from './sorting-table.mjs';
import {createDifficultEdit,upgradeActiveDifficultEditRecord} from './difficult-edit.mjs';
import {createGalleryStudio} from './gallery-studio.mjs';
import {isGallery} from './gallery-model.mjs';
import { AGREEMENT, FEATURES, AXES, validAnswer, sanitizeDraft, describePoint, matchResults, feature } from './engine.mjs';

const KEY='art-profile-deep-study-v1';
const short=w=>w.shortTitle||w.title;
const unique=items=>[...new Set(items)];
const ids=r=>r.works.map(w=>w.id);
const sameSet=(a,b)=>[...ids(a)].sort().join('|')===[...ids(b)].sort().join('|');
const LEGACY_BANK_REVISION='art-study-200-v1';
const LEGACY_CATALOGUE_IDS=['monet-water-lilies','morisot-reading','cassatt-omnibus','mondrian-composition','klee-tightrope','hokusai-mount-fuji','hiroshige-sudden-shower','rousseau-tiger-buffalo','redon-violette','shen-clouds','onchi-mother-child','bonheur-horses','cezanne-mountain','tanner-waters','monet-spring-flowers','klee-carnival','velasco-valley-mexico','herran-la-ofrenda','almeida-junior-saudade','figari-candombe-moon','teotihuacan-mural','ethiopian-apostles','bengal-todi-ragini','chitarman-tiered-court','joseon-seven-jeweled-mountain','hua-yan-children-garden','nepal-chakrasamvara-mandala'];
const average=values=>values.reduce((sum,value)=>sum+value,0)/(values.length||1);
const featureNames={abstraction:['representation','abstraction'],energy:['quieter images','greater visual activity'],complexity:['sparser compositions','denser compositions'],humanity:['less human presence','more human presence'],narrative:['less depicted action','more depicted action'],atmosphere:['less emphasis on setting','more emphasis on setting'],color:['restrained colour','intense colour']};
export function validStudyAnswer(round,answer) {
  if(round.kind==='exercise')return !!answer&&!answer.skipped&&Array.isArray(answer.workIds)&&answer.workIds.join('|')===ids(round).join('|')&&answer.record?.kind===round.exerciseKind&&Array.isArray(answer.record.offeredIds)&&answer.record.offeredIds.length===round.works.length&&answer.record.offeredIds.every(id=>ids(round).includes(id))&&validScenario(answer.record,round.works);
  if(round.kind!=='statements')return validAnswer(round,answer);
  return !!answer&&!answer.skipped&&Array.isArray(answer.workIds)&&answer.workIds.join('|')===ids(round).join('|')&&answer.claims&&Object.keys(answer.claims).length===round.statements.length&&round.statements.every(s=>Number.isInteger(answer.claims[s.id])&&answer.claims[s.id]>=0&&answer.claims[s.id]<=4);
}
export function sanitizeStudyDraft(round,answer={}) {
  if(round.kind!=='statements')return sanitizeDraft(round,answer);
  return {workIds:ids(round),claims:Object.fromEntries(round.statements.filter(s=>Number.isInteger(answer.claims?.[s.id])&&answer.claims[s.id]>=0&&answer.claims[s.id]<=4).map(s=>[s.id,answer.claims[s.id]]))};
}
export function snapshotStudyRound(round) {
  const {works,anchorWorks,...definition}=round;
  return {...structuredClone(definition),...(round.kind==='grid'?{axisDefinition:structuredClone(round.axisDefinition||AXES[round.axis])}:{}),workIds:ids(round),anchorIds:(anchorWorks||[]).map(w=>w.id)};
}
export function restoreStudyRound(snapshot,works) {
  if(!snapshot||typeof snapshot.id!=='string'||!['spectrum','grid','choice-grid','contrast','statements','match','context','exercise'].includes(snapshot.kind)||!Array.isArray(snapshot.workIds)||!snapshot.workIds.length||unique(snapshot.workIds).length!==snapshot.workIds.length)return null;
  if(snapshot.kind==='exercise'&&!['sorting','difficult-edit','curate'].includes(snapshot.exerciseKind))return null;
  const lookup=new Map(works.map(w=>[w.id,w])),anchors=snapshot.anchorIds||[];
  if(!snapshot.workIds.every(id=>lookup.has(id))||!Array.isArray(anchors)||!anchors.every(id=>lookup.has(id)))return null;
  if(typeof snapshot.title!=='string'||typeof snapshot.hint!=='string'||snapshot.kind==='grid'&&!AXES[snapshot.axis]||snapshot.kind==='spectrum'&&!['preference','interest'].includes(snapshot.criterion))return null;
  if(snapshot.kind==='grid'&&snapshot.axisDefinition&&JSON.stringify(snapshot.axisDefinition)!==JSON.stringify(AXES[snapshot.axis]))return null;
  if(snapshot.kind==='statements'&&(!Array.isArray(snapshot.statements)||!snapshot.statements.length||snapshot.statements.some(s=>typeof s.id!=='string'||typeof s.text!=='string')))return null;
  if(snapshot.kind==='match'&&(!Array.isArray(snapshot.options)||snapshot.options.some(o=>typeof o.id!=='string'||typeof o.label!=='string')))return null;
  if(snapshot.kind==='match'&&!['artist','movement'].includes(snapshot.field))return null;
  const restored={...structuredClone(snapshot),works:snapshot.workIds.map(id=>lookup.get(id)),anchorWorks:anchors.map(id=>lookup.get(id))};
  return snapshot.kind==='contrast'&&!validContrastDefinition(restored)||isContextChangeRound(snapshot)&&!validContextChangeDefinition(restored)||isSymbolismRound(snapshot)&&!validSymbolismDefinition(restored)?null:restored;
}
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
const shownIds=shown=>unique(Object.values(shown).flatMap(s=>[...(Array.isArray(s?.workIds)?s.workIds:[]),...(Array.isArray(s?.anchorIds)?s.anchorIds:[])]).filter(id=>typeof id==='string'));
const protocolId=index=>'study-'+String(index+1).padStart(3,'0');
const instrumentSnapshot=(snapshot,manifest)=>snapshot?.kind==='grid'&&!snapshot.axisDefinition&&manifest.axisDefinitions?.[snapshot.axis]?{...snapshot,axisDefinition:manifest.axisDefinitions[snapshot.axis]}:snapshot;
const sessionHistory=data=>Object.values(data.shown||{}).map(s=>restoreStudyRound(instrumentSnapshot(s,data.manifest),data.manifest.catalogue)).filter(Boolean);
function unavailableRound(snapshot,index,reason) {return {id:snapshot?.id||protocolId(index),kind:'unavailable',format:'unavailable',title:snapshot?.title||'Saved decision unavailable',hint:'',works:[],evidence:{construct:'unavailable'},unavailable:true,unavailableReason:reason,unavailableWorkIds:snapshot?.workIds||[]};}
/** Pin a session's stimulus universe and pending definitions without rewriting any old response. */
export function prepareStudySession(saved,currentWorks,now=Date.now()) {
  const source=plainObject(saved)?structuredClone(saved):{},answers=plainObject(source.answers)?source.answers:{},shown=plainObject(source.shown)?source.shown:{};
  const target=STUDY_LENGTHS.includes(source.target)?source.target:50;
  const data={...source,version:1,target,index:Number.isInteger(source.index)?Math.max(0,Math.min(target-1,source.index)):0,screen:['home','question','reading'].includes(source.screen)?source.screen:'home',answers,shown,startedAt:source.startedAt||null,finishedAt:source.finishedAt||null,archives:Array.isArray(source.archives)?source.archives:[]};
  if(source.answers&&!plainObject(source.answers))data.unmappedAnswers=source.answers;
  const currentById=new Map(currentWorks.filter(w=>w&&typeof w.id==='string').map(w=>[w.id,w]));
  if(!plainObject(source.manifest)||!Array.isArray(source.manifest.catalogueIds)||!Array.isArray(source.manifest.catalogue)) {
    const references=shownIds(shown),revisions=unique(Object.values(shown).map(s=>s?.evidence?.bankRevision).filter(Boolean));
    const adopting=source.version===1,knownLegacy=adopting&&(revisions.length?revisions.every(r=>r===LEGACY_BANK_REVISION):references.every(id=>LEGACY_CATALOGUE_IDS.includes(id)));
    const catalogueIds=unique([...(knownLegacy?LEGACY_CATALOGUE_IDS:currentWorks.map(w=>w.id)),...references]);
    data.manifest={version:1,id:'study-session-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,8),createdAt:now,bankRevision:STUDY_BANK_REVISION,catalogueIds,catalogue:catalogueIds.flatMap(id=>currentById.has(id)?[structuredClone(currentById.get(id))]:[]),axisDefinitions:structuredClone(AXES),metadataProvenance:adopting?'adopted-current-metadata':'captured-at-session-start',axisDefinitionProvenance:adopting?'adopted-current-definitions':'captured-at-session-start',historicalPool:adopting?(knownLegacy?'known-production-v1-27':'unknown-at-adoption'):'captured-at-session-start',adoptedShownRevisions:revisions,unavailableIds:catalogueIds.filter(id=>!currentById.has(id)),identityLimit:'Artwork metadata and supplied image revision fields are retained. Image bytes are not stored in browser state.'};
  }
  if(!data.manifest.axisDefinitions){data.manifest.axisDefinitions=structuredClone(AXES);data.manifest.axisDefinitionProvenance='adopted-current-definitions';}
  const pool=data.manifest.catalogue,history=sessionHistory(data),eligibleAnswers=Object.fromEntries(history.filter(r=>validStudyAnswer(r,answers[r.id])).map(r=>[r.id,answers[r.id]]));
  const storedPlan=Array.isArray(source.plan)?source.plan:[],planLength=Math.max(200,target,storedPlan.length);
  let generated=[];
  try {generated=buildStudyRounds(pool,Math.min(MAX_STUDY_LENGTH,planLength),eligibleAnswers,{history});}catch(error){data.catalogueIssue=String(error.message||error);}
  data.plan=Array.from({length:planLength},(_,index)=>{
    const id=protocolId(index),prior=storedPlan.find(r=>r?.id===id),actual=shown[id];
    if(actual)return structuredClone(actual);
    if(prior)return structuredClone(prior);
    return generated[index]?snapshotStudyRound(generated[index]):{id,title:'Pending decision unavailable',kind:'unavailable',workIds:[],anchorIds:[],unavailableReason:data.catalogueIssue||'The saved catalogue is incomplete.'};
  });
  return data;
}
const questionIdentity=round=>JSON.stringify({id:round.id,kind:round.kind,criterion:round.criterion,axis:round.axis,works:ids(round),anchors:(round.anchorWorks||[]).map(w=>w.id),construct:round.evidence?.construct,contrastKey:round.evidence?.contrastKey});
/** Refresh prospective-check metadata from actual shown history, retaining the pinned question. */
export function sessionStudyRounds(data,target=data.target) {
  const pool=data.manifest?.catalogue||[],history=sessionHistory(data),eligible=Object.fromEntries(history.filter(r=>validStudyAnswer(r,data.answers?.[r.id])).map(r=>[r.id,data.answers[r.id]]));
  let regenerated=[];try{regenerated=buildStudyRounds(pool,Math.min(MAX_STUDY_LENGTH,Math.max(200,target)),eligible,{history});}catch{/* Past definitions and answers remain available even when future binding cannot run. */}
  return data.plan.slice(0,target).map((planned,index)=>{
    const shown=data.shown?.[planned.id],snapshot=shown||planned,round=restoreStudyRound(instrumentSnapshot(snapshot,data.manifest),pool);
    if(!round)return unavailableRound(snapshot,index,'A saved artwork or response instrument is unavailable. Its original record is retained.');
    if(!shown&&data.answers?.[planned.id])return unavailableRound(snapshot,index,'This saved response has no presentation record. It is retained without guessing which stimulus was answered.');
    if(shown)return round;
    if(round.evidence?.family==='feature-check') {
      const candidate=regenerated[index],evidence={...round.evidence,provisionalPrediction:null,trainingRoundIds:[],heldOut:false,comparisonNovel:false,holdoutUnit:null};delete evidence.trainingAnswers;
      if(candidate&&questionIdentity(candidate)===questionIdentity(round)){for(const key of ['provisionalPrediction','trainingRoundIds','heldOut','comparisonNovel','holdoutUnit','artworksMayBeFamiliar','selectionMethod','featureSemanticVersion'])if(candidate.evidence?.[key]!==undefined)evidence[key]=structuredClone(candidate.evidence[key]);}
      else evidence.prospectiveCheckUnavailable='The current binder did not reproduce this pinned question identity.';
      return {...round,evidence};
    }
    return round;
  });
}
function ev(round,index,detail,workIds) {
  return {roundId:round.id,label:'Decision '+(index+1),prompt:round.title,detail,workIds:unique(workIds),role:round.evidence?.role||'discovery'};
}
function finding(id,title,text,support,{counter=[],alternatives=[],priority=5,...rest}={}) {
  return {id,title,text,support,counter,alternatives,priority,evidence:unique([...support,...counter].flatMap(e=>e.workIds)),...rest};
}
function pairs(round,answer) {
  const result=[];
  for(let i=0;i<round.works.length;i++)for(let j=i+1;j<round.works.length;j++){
    const left=round.works[i],right=round.works[j],gap=answer.positions[left.id]-answer.positions[right.id];
    if(Math.abs(gap)>=15)result.push({a:gap>0?left:right,b:gap>0?right:left,gap:Math.abs(gap)});
  }
  return result;
}
const taskKey=round=>round.evidence?.setId||[...ids(round)].sort().join('|');
const workSetKey=round=>[...ids(round)].sort().join('|');
const canonical=(round,construct)=>round.evidence?.construct===construct;
const independentRole=round=>!['repeat','heldout','check','counterexample'].includes(round.evidence?.role)&&!round.evidence?.repeatOf;
export function analyzeStudy(works,rounds,answers) {
  const reportedEntries=rounds.map((round,index)=>({round,index,answer:answers[round.id]})).filter(e=>validStudyAnswer(e.round,e.answer));
  // The old generic reader uses gap/intensity heuristics. Fresh ordinal
  // comparisons are read by the dedicated graph, axes and quality modules.
  const entries=reportedEntries.filter(entry=>entry.round.evidence?.comparisonProtocol===undefined&&entry.round.evidence?.continuousProtocol===undefined&&entry.round.evidence?.anchorComparisonProtocol===undefined);
  const findings=[],checks=[],scope='These tasks reuse a small catalogue. Related comparisons and repeated works are dependent evidence. The pattern describes these decisions, not a validated personality trait or a cause.';
  const pref=entries.filter(e=>e.round.kind==='spectrum'&&canonical(e.round,'preference'));
  const discovery=pref.filter(e=>independentRole(e.round));
  const groups=new Map();
  for(const e of entries){const key=taskKey(e.round);groups.set(key,[...(groups.get(key)||[]),e]);}
  const relations={curiosity:[],involvement:[],tension:[],connection:[]};
  for(const group of groups.values()){
    const p=group.find(e=>e.round.kind==='spectrum'&&canonical(e.round,'preference')&&independentRole(e.round));if(!p)continue;
    const interest=group.find(e=>e.round.kind==='spectrum'&&canonical(e.round,'curiosity')&&sameSet(p.round,e.round));
    const response=group.find(e=>e.round.kind==='grid'&&e.round.axis==='response'&&canonical(e.round,'response')&&sameSet(p.round,e.round));
    const connection=group.find(e=>e.round.kind==='grid'&&e.round.axis==='connection'&&canonical(e.round,'connection')&&sameSet(p.round,e.round));
    const pairEvidence=pair=>ev(p.round,p.index,`${short(pair.a)}: ${p.answer.positions[pair.a.id]}; ${short(pair.b)}: ${p.answer.positions[pair.b.id]} on the preference scale.`,[pair.a.id,pair.b.id]);
    for(const pair of pairs(p.round,p.answer)){
      if(interest){const gap=interest.answer.positions[pair.a.id]-interest.answer.positions[pair.b.id];if(Math.abs(gap)>=15)relations.curiosity.push({key:workSetKey(p.round),reverse:gap<0,pair,support:[pairEvidence(pair),ev(interest.round,interest.index,`${short(pair.a)}: ${interest.answer.positions[pair.a.id]}; ${short(pair.b)}: ${interest.answer.positions[pair.b.id]} on the curiosity scale.`,[pair.a.id,pair.b.id])]});}
      if(response){const a=response.answer.points[pair.a.id],b=response.answer.points[pair.b.id],responseEvidence=ev(response.round,response.index,`${short(pair.a)}: ${describePoint('response',a)}. ${short(pair.b)}: ${describePoint('response',b)}.`,[pair.a.id,pair.b.id]);
        if(Math.abs(a[1]-b[1])>=20)relations.involvement.push({key:workSetKey(p.round),reverse:a[1]<b[1],pair,support:[pairEvidence(pair),responseEvidence]});
        if(Math.abs(a[0]-b[0])>=20)relations.tension.push({key:workSetKey(p.round),reverse:a[0]>b[0],pair,support:[pairEvidence(pair),responseEvidence]});
      }
      if(connection){const a=connection.answer.points[pair.a.id],b=connection.answer.points[pair.b.id];if(a[0]<=35&&a[1]>=65)relations.connection.push({key:workSetKey(p.round),reverse:true,pair,support:[pairEvidence(pair),ev(connection.round,connection.index,`${short(pair.a)}: ${describePoint('connection',a)}. ${short(pair.b)}: ${describePoint('connection',b)}.`,[pair.a.id,pair.b.id])]});}
    }
  }
  const relationCopy={
    curiosity:{title:'Preference and curiosity did not always choose the same works.',text:(sample,n)=>`You preferred ${short(sample.pair.a)}, but wanted to understand ${short(sample.pair.b)} more.${n>1?' This reversal appeared in '+n+' different artwork sets.':''} Wanting to investigate a work and preferring it separated here.`},
    involvement:{title:'Attention and preference separated.',text:(sample,n)=>`You preferred ${short(sample.pair.a)}, while ${short(sample.pair.b)} held more of your attention.${n>1?' The same distinction appeared in '+n+' different artwork sets.':''} Involvement alone did not explain your preference order.`},
    tension:{title:'Being at ease was not always a condition of preference.',text:(sample,n)=>`You preferred ${short(sample.pair.a)} despite reporting more tension than for ${short(sample.pair.b)}.${n>1?' This appeared in '+n+' different artwork sets.':''} Tension and preference were compatible in those comparisons.`},
    connection:{title:'Connection and understanding could separate.',text:(sample,n)=>`${short(sample.pair.a)} was preferred while feeling personal and hard to understand.${n>1?' This combination appeared in '+n+' different artwork sets.':''} Personal connection and reported understanding separated in these responses.`}
  };
  for(const [key,items] of Object.entries(relations)){
    const reverse=items.filter(x=>x.reverse),bySet=[...new Map(reverse.map(x=>[x.key,x])).values()];if(!bySet.length)continue;
    const positive=[...new Map(items.filter(x=>!x.reverse).map(x=>[x.key,x])).values()];
    findings.push(finding('study-'+key,relationCopy[key].title,relationCopy[key].text(bySet[0],bySet.length),bySet.slice(0,3).flatMap(x=>x.support),{counter:positive.slice(0,2).flatMap(x=>x.support),alternatives:[scope,'Subject, familiarity, difficulty and personal associations may all contribute. Several explanations can fit the same choices.'],priority:10+Math.min(3,bySet.length)}));
  }
  const contextual=[];
  for(const e of entries.filter(e=>e.round.kind==='spectrum'&&e.round.evidence?.family==='contextual-choice')){
    const p=(groups.get(taskKey(e.round))||[]).find(x=>x.round.kind==='spectrum'&&canonical(x.round,'preference')&&sameSet(x.round,e.round));if(!p)continue;
    const reverse=pairs(p.round,p.answer).find(pair=>e.answer.positions[pair.b.id]-e.answer.positions[pair.a.id]>=15);if(!reverse)continue;
    contextual.push({p,context:e,pair:reverse});
  }
  if(contextual.length){const selected=contextual.slice(0,3),sample=selected[0],pair=sample.pair;findings.push(finding('study-contextual-fit','A role could change the choice.',`You preferred ${short(pair.a)} to ${short(pair.b)} in the ordinary preference task. For "${sample.context.round.title}", their clear order reversed. Choosing a work for a particular role did not reproduce that individual preference.${contextual.length>1?' Other contextual tasks also produced reversals.':''}`,selected.flatMap(x=>[ev(x.p.round,x.p.index,`${short(x.pair.a)}: ${x.p.answer.positions[x.pair.a.id]}; ${short(x.pair.b)}: ${x.p.answer.positions[x.pair.b.id]} on preference.`,[x.pair.a.id,x.pair.b.id]),ev(x.context.round,x.context.index,`${short(x.pair.a)}: ${x.context.answer.positions[x.pair.a.id]}; ${short(x.pair.b)}: ${x.context.answer.positions[x.pair.b.id]} under this brief.`,[x.pair.a.id,x.pair.b.id,...(x.context.round.anchorWorks||[]).map(w=>w.id)])]),{priority:11,alternatives:[scope,'A contextual spectrum measures the task in its prompt. An effective companion, first stop or study choice is not automatically an unconditional favourite.','Pairing, purpose, offered alternatives and repetition can all contribute to the difference.']}));}
  for(const e of entries.filter(e=>e.round.kind==='statements'&&e.round.evidence?.statementTest)){
    if(!['quiet','curiosity','clarity'].includes(e.round.evidence.statementTest))continue;
    const test=e.round.evidence.statementTest,group=groups.get(taskKey(e.round))||[],p=group.find(x=>canonical(x.round,'preference')&&x.round.kind==='spectrum'&&sameSet(x.round,e.round)),statement=e.round.statements[0],rating=e.answer.claims[statement.id];
    const related=group.find(x=>test==='quiet'?canonical(x.round,'response')&&x.round.axis==='response':test==='curiosity'?canonical(x.round,'curiosity'):canonical(x.round,'connection')&&x.round.axis==='connection');
    const comparisons=[];
    if(p&&related&&sameSet(p.round,related.round))for(const pair of pairs(p.round,p.answer)){
      const a=test==='curiosity'?related.answer.positions[pair.a.id]:related.answer.points[pair.a.id][0],b=test==='curiosity'?related.answer.positions[pair.b.id]:related.answer.points[pair.b.id][0],gap=(a-b)*(test==='quiet'?-1:1);
      if(Math.abs(gap)>=(test==='curiosity'?15:20))comparisons.push({pair,direction:Math.sign(gap)});
    }
    const following=comparisons.filter(x=>x.direction>0),reversing=comparisons.filter(x=>x.direction<0),enough=comparisons.length>=2&&unique(comparisons.flatMap(x=>[x.pair.a.id,x.pair.b.id])).length>=3;
    let status='open',detail='Too few clearly separated responses exist here to check this description.';
    if(enough){if(following.length&&reversing.length){status='mixed';detail='Some comparisons follow this description and others reverse it.';}else if(rating>=3){status=following.length?'fits':'exception';detail=following.length?'The clear comparisons fit the description here.':'The clear comparisons show an exception to the description here.';}else if(rating<=1){status=following.length?'local-pattern':'compatible';detail=following.length?'A local pattern followed a description you did not endorse generally.':'The comparisons did not follow the description you declined to endorse. This does not establish its opposite.';}else{status='uncommitted';detail='You left the statement in between. The observed comparison is kept separate from that answer.';}}
    if(test==='quiet')detail+=' The response map measures tension, which is only one aspect of feeling calm.';
    const statementEvidence=ev(e.round,e.index,`"${statement.text}" You chose ${AGREEMENT[rating]}.`,ids(e.round));
    const pack=x=>[ev(p.round,p.index,`${short(x.pair.a)} was preferred to ${short(x.pair.b)}.`,[x.pair.a.id,x.pair.b.id]),ev(related.round,related.index,test==='curiosity'?`${short(x.pair.a)}: ${related.answer.positions[x.pair.a.id]}; ${short(x.pair.b)}: ${related.answer.positions[x.pair.b.id]} on curiosity.`:`${short(x.pair.a)}: ${describePoint(related.round.axis,related.answer.points[x.pair.a.id])}. ${short(x.pair.b)}: ${describePoint(related.round.axis,related.answer.points[x.pair.b.id])}.`,[x.pair.a.id,x.pair.b.id])];
    checks.push({id:e.round.id,statement:statement.text,answer:AGREEMENT[rating],status,detail,support:[statementEvidence,...(following[0]?pack(following[0]):[])],counter:reversing[0]?pack(reversing[0]):[]});
    if(enough&&rating>=3&&reversing[0]){const x=reversing[0];findings.push(finding('study-statement-'+test,test==='quiet'?'Your rule about calm had a local exception.':test==='curiosity'?'Your description missed a split between preference and curiosity.':'Understanding explained only part of this preference.',`${short(x.pair.a)} was preferred to ${short(x.pair.b)}, ${test==='quiet'?'while reporting more tension':test==='curiosity'?'while wanting to understand the second more':'while finding the first harder to understand'}. You endorsed "${statement.text}".${following.length?' Other comparisons followed your description.':''}`,[statementEvidence,...pack(x)],{counter:following[0]?pack(following[0]):[],priority:14,alternatives:[scope,'The self-description and the tasks concern different scopes. This is not a measure of honesty, intelligence or self-awareness.']}));}
  }
  const featureCandidates=[];
  for(const key of FEATURES){
    const informative=discovery.flatMap(e=>{const ps=pairs(e.round,e.answer).filter(p=>isReviewedVisualDescriptor(p.a,key)&&isReviewedVisualDescriptor(p.b,key)&&Math.abs(feature(p.a,key)-feature(p.b,key))>=.3);if(!ps.length)return [];return [{...e,pairs:ps,net:average(ps.map(p=>(feature(p.a,key)-feature(p.b,key))*p.gap/100))}];});
    for(const direction of [-1,1]){
      const support=[...new Map(informative.filter(e=>direction*e.net>=.07).map(e=>[workSetKey(e.round),e])).values()],counter=[...new Map(informative.filter(e=>direction*e.net<=-.07).map(e=>[workSetKey(e.round),e])).values()];
      const artists=unique(support.flatMap(e=>e.round.works.filter(w=>w.artistKnown!==false).map(w=>w.artist)));
      if(support.length<3||artists.length<4||counter.length>=support.length)continue;
      const pack=e=>{const p=[...e.pairs].sort((a,b)=>direction*((feature(b.a,key)-feature(b.b,key))-(feature(a.a,key)-feature(a.b,key))))[0];return ev(e.round,e.index,`${short(p.a)} was placed above ${short(p.b)}. The first has ${direction>0?'more':'less'} annotated ${key}.`,[p.a.id,p.b.id]);};
      const opposite=e=>{const p=[...e.pairs].sort((a,b)=>direction*((feature(a.a,key)-feature(a.b,key))-(feature(b.a,key)-feature(b.b,key))))[0];return ev(e.round,e.index,`${short(p.a)} was preferred in a comparison going against this proposed feature rule.`,[p.a.id,p.b.id]);};
      const inside=support.flatMap(e=>{const reverse=e.pairs.filter(p=>direction*(feature(p.a,key)-feature(p.b,key))<0).sort((a,b)=>b.gap-a.gap)[0];return reverse?[ev(e.round,e.index,`${short(reverse.a)} was preferred to ${short(reverse.b)}, going against this feature rule inside an otherwise supporting set.`,[reverse.a.id,reverse.b.id])]:[];});
      const label=featureNames[key][direction>0?1:0];
      featureCandidates.push(finding('study-feature-'+key,'A possible visual link: '+label+'.',`Preference accompanied ${label} in ${support.length} different comparison sets.${counter.length?' '+counter.length+' other sets went against that direction.':''}${inside.length?' Some individual comparisons inside supporting sets also went the other way.':''} This is a working explanation to test with other works.`,support.slice(0,4).map(pack),{counter:[...counter.slice(0,3).map(opposite),...inside.slice(0,3)],feature:key,direction,priority:6+Math.min(3,support.length)-counter.length,alternatives:[scope,'The seven attributes are coarse editorial annotations. Colour, subject, technique and period often vary together. These tasks do not isolate this feature.']}));
    }
  }
  findings.push(...featureCandidates.sort((a,b)=>b.priority-a.priority).slice(0,2));
  const repeats=[];let repeatComparisons=0;
  for(const e of entries.filter(e=>e.round.evidence?.repeatOf)){
    const before=entries.find(other=>other.round.id===e.round.evidence.repeatOf&&other.index<e.index);if(!before||e.round.kind!=='spectrum'||before.round.kind!=='spectrum'||e.round.criterion!==before.round.criterion||!sameSet(e.round,before.round)||e.round.title!==before.round.title||(e.round.hint||'')!==(before.round.hint||'')||JSON.stringify(e.round.scale||null)!==JSON.stringify(before.round.scale||null))continue;
    repeatComparisons++;
    const informative=pairs(before.round,before.answer),flips=informative.filter(p=>e.answer.positions[p.b.id]-e.answer.positions[p.a.id]>=15);const retained=informative.filter(p=>e.answer.positions[p.a.id]-e.answer.positions[p.b.id]>=15);
    if(flips.length)repeats.push({before,after:e,pair:flips[0],flips:flips.length,retained:retained.length});
  }
  if(repeats.length){const r=repeats[0],p=r.pair;findings.push(finding('study-repeat','An earlier order changed when the works returned.',`${short(p.a)} was above ${short(p.b)} in the earlier task; their clear order reversed in the repeated task.${r.retained?' '+r.retained+' other clear pair comparisons kept their earlier order.':''} A change within a set can coexist with other stable comparisons.`,[ev(r.before.round,r.before.index,`Earlier positions: ${r.before.answer.positions[p.a.id]} and ${r.before.answer.positions[p.b.id]}.`,[p.a.id,p.b.id]),ev(r.after.round,r.after.index,`Repeated positions: ${r.after.answer.positions[p.a.id]} and ${r.after.answer.positions[p.b.id]}.`,[p.a.id,p.b.id])],{priority:11,alternatives:[scope,'Repetition, changed attention, different wording and earlier labels or notes can affect a later choice. This is not a taste-consistency percentage.']}));}
  const predictionChecks=[];
  for(const e of pref.filter(e=>e.round.evidence?.heldOut&&e.round.evidence?.provisionalPrediction)){
    const meta=e.round.evidence,training=meta.trainingRoundIds||[],snapshot=meta.trainingAnswers||{};
    if(e.round.works.length!==2||training.length<3||!ids(e.round).includes(meta.provisionalPrediction))continue;
    const earlier=training.map(id=>{const index=rounds.findIndex(r=>r.id===id),r=rounds[index];return r&&index<e.index&&canonical(r,'preference')&&independentRole(r)&&validStudyAnswer(r,snapshot[id])?{round:r,index,answer:snapshot[id]}:null;});
    if(earlier.some(x=>!x))continue;
    if(['narrative','atmosphere'].includes(meta.contrastKey)&&(meta.featureSemanticVersion!==FEATURE_SEMANTIC_VERSION||![...e.round.works,...earlier.flatMap(source=>source.round.works)].every(work=>isReviewedVisualDescriptor(work,meta.contrastKey))))continue;
    const predicted=meta.provisionalPrediction,other=ids(e.round).find(id=>id!==predicted),gap=e.answer.positions[predicted]-e.answer.positions[other];
    predictionChecks.push({...e,predicted,other,gap,earlier});
  }
  if(predictionChecks.length){const check=predictionChecks.find(e=>e.gap<=-15)||predictionChecks[0],prediction=works.find(w=>w.id===check.predicted),other=works.find(w=>w.id===check.other),reversed=check.gap<=-15,matched=check.gap>=15;
    findings.push(finding('study-prediction',reversed?'A provisional visual explanation met an exception.':matched?'A provisional explanation matched a later pair.':'A later pair left a provisional explanation open.',`Before this response, the feature check predicted ${short(prediction)} from earlier discovery choices. ${reversed?'You clearly preferred '+short(other)+'.':matched?'Your later clear preference followed that prediction.':'You gave the two works close or equal placements.'} The prediction and the earlier answers used to make it were frozen when the check appeared.`,[ev(check.round,check.index,`Predicted ${short(prediction)}. Preference positions: ${check.answer.positions[check.predicted]} and ${check.answer.positions[check.other]}.`,[check.predicted,check.other]),...check.earlier.slice(0,3).map(e=>ev(e.round,e.index,'Earlier discovery preference response used by this prediction: '+ids(e.round).map(id=>short(works.find(w=>w.id===id))+' '+e.answer.positions[id]).join('; ')+'.',ids(e.round)))],{priority:reversed?12:5,alternatives:[scope,'The pair was chosen by an annotated-feature contrast rule. Only the predicted winner uses earlier answers. The artworks may already be familiar, and several visual features still differ. This is a prospective comparison probe, not a causal test or an accuracy percentage.']}));
  }
  const games=entries.filter(e=>e.round.kind==='match');
  if(games.length){const results=games.map(e=>({...e,items:matchResults(e.round,e.answer)})),all=results.flatMap(e=>e.items),correct=all.filter(i=>i.status==='correct').length,unsure=all.filter(i=>i.status==='unsure').length;findings.push(finding('study-labels','Artist and style matches',`You matched ${correct} of ${all.length} labels.${unsure?" You left "+unsure+" unsure.":""}`,results.slice(0,3).map(e=>ev(e.round,e.index,e.items.map(i=>short(works.find(w=>w.id===i.workId))+': '+i.status).join('; '),e.items.map(i=>i.workId))),{priority:2,alternatives:['Labels can cue recognition and correct guesses can happen by chance. Earlier images, readings or source links may already have exposed names. Matching stays separate from preference. These cued matches do not measure general art expertise.']}));}
  const notes=entries.filter(e=>e.round.kind==='context'&&!e.round.contextMode);
  if(notes.length){const counts=Object.fromEntries(['more','same','less','unsure'].map(value=>[value,notes.filter(e=>e.answer.change===value).length]));findings.push(finding('study-context','After the note',notes.length===1?`You reported ${counts.more?"more curiosity":counts.less?"less curiosity":counts.same?"no change in curiosity":"an uncertain change in curiosity"} about ${short(notes[0].round.works[0])} after reading the note.`:`You reported more curiosity after ${counts.more} notes and less after ${counts.less}. ${counts.same} brought no change; ${counts.unsure} responses were uncertain.`,notes.slice(0,4).map(e=>ev(e.round,e.index,`${short(e.round.works[0])}: ${e.answer.change} curiosity after the note.`,ids(e.round))),{priority:3,alternatives:['Reading a note, seeing a work again and receiving new information happen together. This cannot establish the note’s causal effect.']}));}
  findings.sort((a,b)=>b.priority-a.priority);
  return {findings,checks,answered:reportedEntries.length,skipped:rounds.filter(r=>answers[r.id]?.skipped).length,sets:unique(reportedEntries.map(e=>workSetKey(e.round))).length,artworks:unique(reportedEntries.flatMap(e=>ids(e.round))).length,repeatsCompared:repeatComparisons,repeatsWithClearReversal:repeats.length,predictionChecks:predictionChecks.length,name:findings[0]?.title||'Your study so far.',enough:reportedEntries.length>=2,evidence:unique(findings.flatMap(f=>f.evidence)),basis:'Only complete answers enter this reading. Ordinary preference, curiosity, response and connection tasks are compared under their recorded instructions. Contextual choices are kept separate from unconditional preference. Intentional repeats keep their earlier comparison. Thresholds are design heuristics, not validated confidence estimates. A longer path reuses this small catalogue and does not supply 200 independent observations.'};
}

const profileRefinementState=data=>data.profileRefinement?.protocol===PROFILE_REFINEMENT_PROTOCOL&&data.profileRefinement.baseTarget===50&&Array.isArray(data.profileRefinement.plan)&&data.profileRefinement.plan.length<=PROFILE_REFINEMENT_LIMIT?data.profileRefinement:null;
export function sessionRefinementRounds(data){
  const state=profileRefinementState(data);if(!state)return [];
  return state.plan.map((planned,index)=>restoreStudyRound(data.shown[planned.id]||planned,data.manifest.catalogue)||unavailableRound(planned,index,'This saved focused comparison is unavailable.'));
}
function journeyRoundIndices(data){const state=profileRefinementState(data),order=state?[...data.plan.slice(0,50),...state.plan,...data.plan.slice(50)]:data.plan;return new Map(order.map((round,index)=>[round.id,index]));}
export function journeyEvidenceRounds(data){const rounds=sessionJourneyRounds(data),extra=sessionRefinementRounds(data);return [...rounds.slice(0,50),...extra,...rounds.slice(50)];}
const fresh=()=>({version:1,target:50,index:0,screen:'home',answers:{},shown:{},startedAt:null,finishedAt:null,archives:[]});
export function prepareJourneySession(saved,works,now=Date.now()){
  const source=plainObject(saved)?structuredClone(saved):{};
  if(source.manifest?.protocol===JOURNEY_PROTOCOL&&Array.isArray(source.manifest.catalogue)&&Array.isArray(source.plan)&&source.plan.length>=JOURNEY_LENGTH&&source.plan.length%JOURNEY_LENGTH===0){
    const data={...source,version:1,target:source.plan.length,index:Math.max(0,Math.min(source.plan.length-1,Number.isInteger(source.index)?source.index:0)),screen:['home','question','reading'].includes(source.screen)?source.screen:'home',answers:plainObject(source.answers)?source.answers:{},shown:plainObject(source.shown)?source.shown:{},archives:Array.isArray(source.archives)?source.archives:[]};
    if(source.answers!==undefined&&!plainObject(source.answers))data.unmappedAnswers=source.answers;
    if(source.shown!==undefined&&!plainObject(source.shown))data.unmappedShown=source.shown;
    const known=new Set(data.manifest.catalogue.map(work=>work?.id)),added=[];
    for(const work of Array.isArray(works)?works:[])if(work&&typeof work.id==='string'&&work.id&&!known.has(work.id)){known.add(work.id);added.push(structuredClone(work));}
    if(added.length){data.manifest.catalogue.push(...added);data.manifest.catalogueIds=data.manifest.catalogue.map(work=>work.id);data.manifest.catalogueAdditions=[...(Array.isArray(data.manifest.catalogueAdditions)?data.manifest.catalogueAdditions:[]),{at:now,workIds:added.map(work=>work.id)}];}
    const designChanged=data.manifest.journeyRevision!==JOURNEY_REVISION,previousPlanning=plainObject(data.manifest.stimulusPlanning)?structuredClone(data.manifest.stimulusPlanning):null,planningHistory=Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,data.manifest.catalogue)).filter(Boolean),reservationPlan=previousPlanning?.reservations||(Array.isArray(data.batches)?data.batches:[]).find(batch=>batch?.selection?.reservations)?.selection.reservations,firstSeed=data.plan.slice(0,JOURNEY_LENGTH).find(round=>typeof round?.evidence?.selectionSeed==='string')?.evidence.selectionSeed||'journey-batch-0';
    const firstWorkIds=previousPlanning?.boundMainWorkIds||unique(data.plan.slice(0,JOURNEY_LENGTH).filter(round=>round.kind==='spectrum'&&round.evidence?.construct==='preference'&&round.evidence.panelNumber).flatMap(round=>round.workIds||[]));
    const firstSelection=previousPlanning?.firstPlan&&!designChanged&&!added.length?structuredClone(previousPlanning.firstPlan):createJourneyStimulusPlan({works:data.manifest.catalogue,rounds:planningHistory,answers:data.answers,batchIndex:0,seed:firstSeed,reservationPlan,firstWorkIds});
    if(designChanged||added.length){
      const changes=[],batchNotes=[],history=planningHistory,sameWorks=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
      // Even malformed or falsy recorded answers protect their original question.
      const pending=snapshot=>snapshot&&typeof snapshot.id==='string'&&!Object.hasOwn(data.shown,snapshot.id)&&!Object.hasOwn(data.answers,snapshot.id);
      for(let offset=0;offset<data.plan.length;offset+=JOURNEY_LENGTH){
        const previous=data.plan.slice(offset,offset+JOURNEY_LENGTH),batchIndex=offset/JOURNEY_LENGTH;
        if(!previous.some(pending))continue;
        // Moving a preference source before its follow-up would create a hybrid
        // instrument if any part of this older block had already been entered.
        // Retain the whole captured block, including skipped/malformed answers.
        if(previous.some(snapshot=>!pending(snapshot))){
          batchNotes.push({offset,status:'preserved',reason:'This block has already been started. Its pending questions retain the same measurement schedule as its captured questions.'});continue;
        }
        const seed=previous.find(round=>typeof round?.evidence?.selectionSeed==='string')?.evidence.selectionSeed;
        const options={offset,batchIndex,history,preferenceProtocol:data.manifest.preferenceProtocol||'overall-appeal-v1',reservationPlan:firstSelection.reservations||reservationPlan,...(seed!==undefined?{seed}:batchIndex?{seed:data.manifest.id+'-'+batchIndex}:{})},demotedPanels=[];
        if(batchIndex===0&&firstSelection.complete)options.panels=firstSelection;
        if(batchIndex){
          const savedBatch=(Array.isArray(data.batches)?data.batches:[]).find(batch=>batch?.offset===offset||batch?.index===batchIndex),selection=savedBatch?.selection,panels=Array.isArray(selection)?selection:selection?.panels;
          if(!Array.isArray(panels)||panels.length!==18){batchNotes.push({offset,status:'preserved',reason:'The saved adaptive selection is unavailable. Pending questions retain their recorded definitions and roles.'});continue;}
          options.panels=structuredClone(panels);
          // A shown legacy map can pin a different set than the saved selector.
          // Keep its real works without carrying a prediction or repeat onto them.
          const bindings=new Map();
          for(const round of history){const match=/^journey-(\d+)$/.exec(round.id),legacy=/^panel-(\d+)$/.exec(round.evidence?.setId||''),number=round.evidence?.panelNumber||(legacy?Number(legacy[1]):null),sourceBatch=round.evidence?.batchIndex??Math.floor((Number(match?.[1]||1)-1)/JOURNEY_LENGTH);if((['art-profile-50-v2','art-profile-50-v3','art-profile-50-v4','art-profile-50-v5','art-profile-50-v6','art-profile-50-v7','art-profile-50-v8','art-profile-50-v9','art-profile-50-v10','art-profile-50-v11','art-profile-50-v12','art-profile-50-v13','art-profile-50-v14','art-profile-50-v15','art-profile-50-v16',JOURNEY_REVISION].includes(round.evidence?.journeyRevision)||legacy)&&sourceBatch===batchIndex&&Number.isInteger(number)&&number>=1&&number<=18&&!bindings.has(number))bindings.set(number,ids(round));}
          for(const [number,binding] of bindings){const panel=options.panels[number-1];if(!Array.isArray(panel?.workIds)||!sameWorks(panel.workIds,binding)){options.panels[number-1]={workIds:[...binding],construct:'preference',role:'exploration',selectionReason:'Preserve the artwork set in the recorded question. Conflicting repeat or prediction metadata has been removed.',evidenceRoundIds:[]};demotedPanels.push(number);}}
        }
        try{
          const revised=buildJourneyRounds(data.manifest.catalogue,data.answers,options);
          for(let i=0;i<JOURNEY_LENGTH;i++)if(pending(previous[i])){changes.push(previous[i]);data.plan[offset+i]=snapshotStudyRound(revised[i]);}
          batchNotes.push({offset,status:'refreshed',selectionSource:batchIndex?'saved-adaptive-selection':firstSelection.complete?'curated-stimulus-plan':'journey-design-fallback',...(demotedPanels.length?{demotedPanels}:{} )});
        }catch(error){batchNotes.push({offset,status:'preserved',reason:'Pending definitions were retained because regeneration failed: '+String(error?.message||error)});}
      }
      if(changes.length||batchNotes.length)data.planRevisions=[...(Array.isArray(data.planRevisions)?data.planRevisions:[]),{at:now,from:data.manifest.journeyRevision||'initial',to:JOURNEY_REVISION,reason:designChanged?'design-revision':'catalogue-growth',addedWorkIds:added.map(work=>work.id),previousUnshown:changes,batchNotes,...(previousPlanning?{previousStimulusPlanning:previousPlanning}:{})}];
      data.manifest.journeyRevision=JOURNEY_REVISION;
    }
    if(!previousPlanning||designChanged||added.length){
      if(data.manifest.stimulusPlanning!==undefined&&!previousPlanning)data.manifest.unmappedStimulusPlanning=structuredClone(data.manifest.stimulusPlanning);
      const bound=data.plan.slice(0,JOURNEY_LENGTH).map(snapshot=>restoreStudyRound(data.shown[snapshot.id]||snapshot,data.manifest.catalogue)).filter(Boolean);data.manifest.stimulusPlanning=bindJourneyStimulusPlan(firstSelection,bound);
    }
    return data;
  }
  const catalogue=structuredClone(works),selection=createJourneyStimulusPlan({works:catalogue}),rounds=buildJourneyRounds(catalogue,{},selection.complete?{panels:selection}:{});
  return {...fresh(),manifest:{version:1,protocol:JOURNEY_PROTOCOL,journeyRevision:JOURNEY_REVISION,preferenceProtocol:CONTINUOUS_PROTOCOL,id:'profile-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,8),createdAt:now,catalogue,catalogueIds:catalogue.map(w=>w.id),axisDefinitions:structuredClone(AXES),metadataProvenance:'captured-at-session-start',stimulusPlanning:bindJourneyStimulusPlan(selection,rounds)},plan:rounds.map(snapshotStudyRound),...(Object.keys(source).length?{retainedSource:source}:{})};
}
export function extendJourneySession(source,currentWorks,now=Date.now()){
  if(Array.isArray(source?.plan)&&source.plan.length>=JOURNEY_MAX_LENGTH)throw Error('This quiz has reached 300 decisions. Your answers stay saved; explore your gallery or start a new quiz.');
  const data=prepareJourneySession(source,currentWorks,now),resolved=sessionJourneyRounds(data),history=journeyEvidenceRounds(data).filter(r=>data.shown[r.id]).map(r=>{
    if(r.evidence?.stimulusVisibility==='not-shown')return {...r,presentedIds:[],coPresentedGroups:[]};
    if(r.kind!=='exercise')return r;
    const record=data.answers[r.id]?.record;
    if(!record)return r;
    const presentedIds=Array.isArray(record.presentedIds)?record.presentedIds:[],placed=Object.keys(record.placements||{});
    return {...r,presentedIds,coPresentedGroups:r.exerciseKind==='curate'?[placed]:[presentedIds],exposureUnknownWorkIds:r.exerciseKind==='curate'?presentedIds.filter(id=>!placed.includes(id)):[]};
  });
  if(resolved.some(r=>!r.unavailable&&!data.answers[r.id]?.skipped&&!validStudyAnswer(r,data.answers[r.id])))throw Error('Finish this set before adding another.');
  if(profileRefinementState(data))data.profileRefinement.active=false;
  const known=new Set(data.manifest.catalogue.map(w=>w.id)),added=currentWorks.filter(w=>!known.has(w.id));data.manifest.catalogue.push(...structuredClone(added));data.manifest.catalogueIds=data.manifest.catalogue.map(w=>w.id);
  const offset=data.plan.length,batchIndex=offset/JOURNEY_LENGTH,seed=data.manifest.id+'-'+batchIndex,curated=createJourneyStimulusPlan({works:data.manifest.catalogue,rounds:history,answers:data.answers,batchIndex,seed,reservationPlan:data.manifest.stimulusPlanning?.reservations,firstWorkIds:data.manifest.stimulusPlanning?.boundMainWorkIds}),reservationPlan=curated.reservations||data.manifest.stimulusPlanning?.reservations;
  const futureReserved=new Set(reservationPoolKeys(reservationPlan).filter(name=>Number(name.slice(5))-1>batchIndex).flatMap(name=>reservationPlan[name])),alreadyRated=new Set(history.filter(round=>round.kind==='spectrum'&&round.evidence?.construct==='preference'&&validStudyAnswer(round,data.answers[round.id])).flatMap(ids)),fallbackWorks=data.manifest.catalogue.filter(work=>!futureReserved.has(work.id)||alreadyRated.has(work.id));
  const selection=curated.complete?curated:{...planAdaptivePanels({works:fallbackWorks,rounds:history,answers:data.answers,batchIndex,seed,quotas:journeyAdaptiveQuotas(batchIndex,reservationPlan)}),reservations:structuredClone(reservationPlan),curationFallback:{status:curated.status,reason:curated.audit?.shortageReason||curated.audit?.warnings||'The current catalogue could not supply a complete curated batch.'}};
  const rounds=buildJourneyRounds(data.manifest.catalogue,data.answers,{offset,batchIndex,panels:selection,seed:data.manifest.id+'-'+batchIndex,history,reservationPlan,preferenceProtocol:data.manifest.preferenceProtocol||'overall-appeal-v1'});
  data.plan.push(...rounds.map(snapshotStudyRound));data.target=data.plan.length;data.index=offset;data.screen='question';data.finishedAt=null;
  data.batches=[...(data.batches||[]),{index:batchIndex,offset,createdAt:now,selection}];return data;
}
export function sessionJourneyRounds(data,{regenerateBlock=buildJourneyRounds}={}){
  const works=data.manifest.catalogue,blocks=new Map();
  let shownHistory,indices;
  const refreshBlock=index=>{
    const offset=Math.floor(index/JOURNEY_LENGTH)*JOURNEY_LENGTH,batchIndex=offset/JOURNEY_LENGTH;
    if(blocks.has(offset))return blocks.get(offset);
    const saved=batchIndex?(data.batches||[]).find(batch=>batch?.offset===offset||batch?.index===batchIndex)?.selection:data.manifest.stimulusPlanning?.firstPlan;
    const panels=Array.isArray(saved)?saved:saved?.panels;
    const result={rounds:[],history:[],answers:{},reason:'The saved bound panel selection is unavailable for this block.'};blocks.set(offset,result);
    if(!Array.isArray(panels)||panels.length!==18)return result;
    indices??=journeyRoundIndices(data);
    shownHistory??=Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,works)).filter(Boolean);
    result.history=shownHistory.filter(round=>indices.has(round.id)&&indices.get(round.id)<indices.get(data.plan[index].id));
    result.answers=Object.fromEntries(result.history.filter(round=>validStudyAnswer(round,data.answers[round.id])).map(round=>[round.id,data.answers[round.id]]));
    const seed=data.plan.slice(offset,offset+JOURNEY_LENGTH).find(round=>typeof round.evidence?.selectionSeed==='string')?.evidence.selectionSeed;
    try{result.rounds=regenerateBlock(works,result.answers,{offset,batchIndex,panels,history:result.history,preferenceProtocol:data.manifest.preferenceProtocol||'overall-appeal-v1',...(seed!==undefined?{seed}:{})});result.reason='The current binder did not reproduce this pinned question and source.';}
    catch{result.reason='The pinned block could not be regenerated; its original definition remains authoritative.';}
    return result;
  };
  return data.plan.map((planned,index)=>{
    const shown=data.shown[planned.id],round=restoreStudyRound(shown||planned,works);
    if(!round)return unavailableRound(shown||planned,index,'This saved round is unavailable.');
    if(!shown&&data.answers[planned.id])return unavailableRound(planned,index,'The original presentation record is unavailable.');
    if(!shown&&isDiagnosticRound(round)){
      if(index>data.index)return round;
      indices??=journeyRoundIndices(data);
      shownHistory??=Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,works)).filter(Boolean);
      const earlier=shownHistory.filter(item=>indices.has(item.id)&&indices.get(item.id)<indices.get(planned.id));
      return bindDiagnosticRound({round,works,rounds:earlier,answers:data.answers});
    }
    if(!shown&&isFinalRefinementRound(round)){
      indices??=journeyRoundIndices(data);
      shownHistory??=Object.values(data.shown).map(snapshot=>restoreStudyRound(snapshot,works)).filter(Boolean);
      const earlier=shownHistory.filter(item=>indices.has(item.id)&&indices.get(item.id)<indices.get(planned.id));
      return bindFinalRefinementRound({round,works,rounds:earlier,answers:data.answers,seed:data.manifest.id});
    }
    if(!shown&&round.evidence.family==='feature-check'){
      const generated=refreshBlock(index),candidate=generated.rounds[index%JOURNEY_LENGTH],evidence={...round.evidence,provisionalPrediction:null,trainingRoundIds:[],heldOut:false,comparisonNovel:false,holdoutUnit:null};
      delete evidence.trainingAnswers;
      const sameSource=candidate?.evidence?.family==='feature-check'&&(round.bankRoundId||round.evidence.sourceBankRoundId)&&candidate.bankRoundId===round.bankRoundId&&candidate.evidence.sourceBankRoundId===round.evidence.sourceBankRoundId;
      const samePrompt=candidate&&candidate.title===round.title&&candidate.hint===round.hint&&JSON.stringify(candidate.scale||null)===JSON.stringify(round.scale||null);
      const training=candidate?.evidence?.trainingRoundIds||[],safeTraining=Array.isArray(training)&&training.every(id=>Object.hasOwn(generated.answers,id)&&generated.history.some(source=>source.id===id&&source.kind==='spectrum'&&source.criterion==='preference'&&canonical(source,'preference')&&independentRole(source)&&!source.anchorWorks?.length&&!source.brief&&!source.evidence?.brief&&!['contextual-choice','looking-appraisal'].includes(source.evidence?.family)))&&(!candidate?.evidence?.provisionalPrediction||training.length>=3&&ids(round).includes(candidate.evidence.provisionalPrediction));
      if(sameSource&&samePrompt&&safeTraining&&questionIdentity(candidate)===questionIdentity(round)){
        for(const key of ['provisionalPrediction','trainingRoundIds','heldOut','comparisonNovel','holdoutUnit','artworksMayBeFamiliar','selectionMethod'])if(candidate.evidence[key]!==undefined)evidence[key]=structuredClone(candidate.evidence[key]);
        delete evidence.prospectiveCheckUnavailable;
      }else evidence.prospectiveCheckUnavailable=generated.reason;
      return {...round,evidence};
    }
    return round;
  });
}
/** Start the revised instrument without converting or discarding an older run. */
export function retakeJourneySession(source,currentWorks,now=Date.now()){
  const previous=structuredClone(source),archives=Array.isArray(previous.archives)?previous.archives:[];
  delete previous.archives;
  delete previous.reviewingArchived;
  const fresh=prepareJourneySession(null,currentWorks,now);
  return {...fresh,archives:[...archives,previous],startedAt:now,screen:'question'};
}
/** A revised measurement starts a separate study. Original positions, source
 * records and question definitions are archived, never converted. */
export function comparisonMethodMigration(saved,works,now=Date.now()){
  if(!plainObject(saved)||saved.reviewingArchived===true||saved.manifest?.protocol!==JOURNEY_PROTOCOL||saved.manifest.preferenceProtocol===CONTINUOUS_PROTOCOL||!Array.isArray(saved.manifest.catalogue)||!Array.isArray(saved.plan)||!saved.manifest.id)return null;
  const previous=structuredClone(saved),archives=Array.isArray(previous.archives)?previous.archives:[];delete previous.archives;
  const next=prepareJourneySession(null,works,now);next.archives=[...archives,previous];next.methodMigration={protocol:'continuous-personal-appeal-v13',fromSessionId:saved.manifest.id,toPreferenceProtocol:CONTINUOUS_PROTOCOL,at:now};return next;
}
export function createDeepStudy({app,getWorks,image,esc,keepButtons,navigate,showArtwork,getExhibitionFindings=()=>[],getSavedExercises=()=>[],getSavedCollection=()=>({}),mode='legacy'}) {
  const journey=mode==='journey',storageKey=journey?'art-profile-journey-v1':KEY,prepare=journey?prepareJourneySession:prepareStudySession;
  let data=fresh(),round=null,draft=null,ready=false,storage=true,statementIndex=0,statementTimer=null,contrastController=null;
  const archiveStore=createStudyArchiveStore();let archiveReferences=new Map(),sessionChangePending=false,storageBlocked=false;
  let browserStorage;try{browserStorage=globalThis.localStorage;}catch{storage=false;}
  const persistence=createActiveStudyPersistence({storageKey,storage:browserStorage??null,store:archiveStore,onError:()=>{storage=false;if(app.ownerDocument?.createElement&&!app.querySelector('[data-save-failure]')){const message=app.ownerDocument.createElement('p');message.dataset.saveFailure='';message.setAttribute('role','alert');message.innerHTML='Your latest changes could not be saved. Keep this page open and <button type="button" class="text-button" data-action="deep-export">download your answers</button>.';app.prepend(message);}}});
  const sessionWorks=()=>data.manifest?.catalogue||getWorks();
  const lookup=id=>sessionWorks().find(w=>w.id===id)||getWorks().find(w=>w.id===id);
  const save=()=>storageBlocked?Promise.resolve(false):persistence.save(()=>encodeStudyWithArchives(data,archiveReferences),{sessionId:data.manifest?.id});
  const ensureSession=()=>{if(!data.manifest)data=prepare(null,getWorks());};
  const actualRounds=(target=data.target)=>{ensureSession();return journey?sessionJourneyRounds(data):sessionStudyRounds(data,target);};
  const profileRounds=(target=data.target)=>journey?journeyEvidenceRounds(data):actualRounds(target);
  const refining=()=>journey&&profileRefinementState(data)?.active===true;
  const refinementAttempts=()=>sessionRefinementRounds(data);
  let refinementOfferCache=null;
  function refinementOffer({rounds,completed}={}){
    if(!journey||data.plan.length<50||data.reviewingArchived||data.profileRefinement&&!profileRefinementState(data))return null;
    rounds??=profileRounds();completed??=data.plan.slice(0,50).every(snapshot=>{const item=rounds.find(round=>round.id===snapshot.id);return item&&resolved(item);});
    if(!completed)return null;
    const attempts=refinementAttempts(),pending=attempts.find(item=>!resolved(item));
    if(pending)return {round:pending,reason:pending.evidence.profileRefinement?.reason||'Return to your saved focused comparison.',resume:true};
    if(attempts.length>=PROFILE_REFINEMENT_LIMIT)return null;
    const cacheKey=JSON.stringify([data.manifest.id,data.answers,data.profileRefinement?.plan?.map(round=>round.id)]);
    if(refinementOfferCache?.key===cacheKey)return refinementOfferCache.offer;
    const offer=nextProfileRefinement({works:sessionWorks(),rounds:rounds.filter(item=>data.shown[item.id]),answers:data.answers,attempts,seed:data.manifest.id});
    refinementOfferCache={key:cacheKey,offer};return offer;
  }
  function startRefinement(){
    const offer=refinementOffer();if(!offer)return false;
    data.profileRefinement??={protocol:PROFILE_REFINEMENT_PROTOCOL,baseTarget:50,limit:PROFILE_REFINEMENT_LIMIT,plan:[],startedAt:Date.now()};
    if(!offer.resume)data.profileRefinement.plan.push(snapshotStudyRound(offer.round));
    data.profileRefinement.active=true;data.profileRefinement.finishedAt=null;data.screen='question';save();navigate('study');return true;
  }
  function stopRefinement(){if(profileRefinementState(data))data.profileRefinement.active=false;data.screen='reading';save();render();focus();}
  function continueRefinement(){
    const offer=refinementOffer();
    if(offer){if(!offer.resume)data.profileRefinement.plan.push(snapshotStudyRound(offer.round));data.profileRefinement.active=true;}
    else{data.profileRefinement.active=false;data.profileRefinement.finishedAt=Date.now();data.screen='reading';}
    save();render();focus();
  }
  const resolved=(r)=>r.unavailable||data.answers[r.id]?.skipped||validStudyAnswer(r,data.answers[r.id]);
  const answerCount=(rounds=actualRounds())=>rounds.filter(r=>validStudyAnswer(r,data.answers[r.id])).length;
  const inputs=createInteractions({app,getRound:()=>round,getDraft:()=>draft,ready:()=>ready,image,esc,workById:lookup,saveDraft:()=>{data.answers[round.id]=structuredClone(draft);if(!refining())data.finishedAt=null;save();},sync:()=>syncImages()});
  const exerciseRecords=(rounds=actualRounds())=>rounds.filter(r=>r.kind==='exercise'&&validStudyAnswer(r,data.answers[r.id])).map(r=>data.answers[r.id].record);
  const saveExercise=()=>{if(round?.kind!=='exercise'||!draft?.record)return;data.answers[round.id]=structuredClone(draft);data.finishedAt=null;save();};
  const embeddedOptions={app,getRecord:()=>draft?.record,setRecord:record=>{draft.record=record;},getWorks:sessionWorks,image,esc,save:saveExercise,rerender:()=>{render();},inspect:id=>showArtwork(id,true)};
  const embedded={sorting:createSortingTable(embeddedOptions),'difficult-edit':createDifficultEdit(embeddedOptions),curate:createGalleryStudio(embeddedOptions)};
  const chrome=()=>`<header class="journey-chrome"><button class="text-button" type="button" data-action="deep-back" ${!refining()&&data.index?'':'disabled'} aria-label="Previous round">←</button><span>${refining()?'Refining · '+refinementAttempts().length+' / '+PROFILE_REFINEMENT_LIMIT:data.index+1+' / '+data.target}</span><button class="text-button" type="button" data-action="deep-save" aria-label="Close">×</button></header>`;
  function earlierPreferenceOptions(){
    const rounds=actualRounds(),index=rounds.findIndex(item=>item.id===round.id);
    return {preferenceCatalogue:sessionWorks(),preferenceContext:{roundId:round.id,index},preferenceSources:rounds.slice(0,index).flatMap((item,sourceIndex)=>data.shown[item.id]&&!item.unavailable&&validStudyAnswer(item,data.answers[item.id])?[{round:item,answer:data.answers[item.id],index:sourceIndex}]:[])};
  }
  function exerciseQuestion(){
    if(round.exerciseKind==='difficult-edit'&&data.answers[round.id]?.record&&!data.answers[round.id].skipped){
      const answer=data.answers[round.id],upgrade=upgradeActiveDifficultEditRecord(answer.record,sessionWorks(),{active:true,...earlierPreferenceOptions()});
      if(upgrade.changed){data.instrumentRevisions=[...(data.instrumentRevisions||[]),{roundId:round.id,...upgrade.archive,question:snapshotStudyRound(round),answer:structuredClone(answer)}];data.answers[round.id]={...answer,record:upgrade.record};}
    }
    if(journey&&round.exerciseKind==='curate'&&!data.answers[round.id]?.record?.confirmed&&round.evidence?.museumOfferScope!==MUSEUM_OFFER_SCOPE){
      const shown=Object.fromEntries(actualRounds().filter(item=>data.shown[item.id]&&!item.unavailable).map(item=>[item.id,snapshotStudyRound(item)]));
      const answer=data.answers[round.id],offer=museumOffer({catalogue:sessionWorks(),plan:data.plan,shown,answers:data.answers,roundId:round.id,currentRecord:answer?.record}),eligible=round.works.filter(work=>offer.workIds.includes(work.id));
      if(eligible.length<6){app.innerHTML=`<section class="deep-question journey-question">${chrome()}<h1 id="question-title">A few more paintings are needed.</h1><p>This room uses paintings from earlier rounds.</p><button class="primary-button" type="button" data-action="deep-skip">Continue</button></section>`;return;}
      if(data.shown[round.id]||answer?.record)data.instrumentRevisions=[...(data.instrumentRevisions||[]),{roundId:round.id,reason:'museum-earlier-rounds',revisedAt:Date.now(),question:snapshotStudyRound(round),...(answer?{answer:structuredClone(answer)}:{})}];
      round={...round,works:eligible,evidence:{...round.evidence,museumOfferScope:offer.scope,museumOfferSourceRoundIds:offer.sourceRoundIds}};
      const snapshot=snapshotStudyRound(round);data.shown[round.id]=snapshot;const planned=data.plan.findIndex(item=>item.id===round.id);if(planned>=0)data.plan[planned]=structuredClone(snapshot);
      if(answer?.record)data.answers[round.id]={...answer,workIds:ids(round),record:restrictMuseumDraft(answer.record,ids(round))};
    }
    const answer=data.answers[round.id];
    if(answer?.record&&!validScenarioDraft(answer.record,sessionWorks())){
      app.innerHTML=`<section class="deep-question journey-question">${chrome()}<h1 id="question-title">This saved round is unavailable.</h1><button class="primary-button" type="button" data-action="deep-unavailable-next">Continue</button></section>`;return;
    }
    const creationWorks=['difficult-edit','curate'].includes(round.exerciseKind)?round.works:sessionWorks();
    draft=answer?.record?structuredClone(answer):{workIds:ids(round),record:createScenario(round.exerciseKind,creationWorks,{},exerciseRecords(),{id:data.manifest.id+'-'+round.id,...(round.exerciseKind==='sorting'?{offeredIds:ids(round)}:{}),...earlierPreferenceOptions(),...(round.exerciseKind==='curate'?{presentationOrder:'landmark-first-v1'}:{})})};
    if(!answer?.record&&round.exerciseKind==='curate'){
      if(round.evidence?.museumOfferScope===MUSEUM_OFFER_SCOPE)draft.record.offerScope=MUSEUM_OFFER_SCOPE;
      const previous=getSavedExercises().find(r=>isGallery(r)&&validScenarioDraft(r,sessionWorks())&&r.offeredIds.every(id=>ids(round).includes(id)));
      if(previous){const next=structuredClone(previous);next.resumesDraftId=next.id;next.offeredIds=[...next.offeredIds,...ids(round).filter(id=>!next.offeredIds.includes(id))];next.id=draft.record.id;next.createdAt=draft.record.createdAt;next.confirmed=false;if(round.evidence?.museumOfferScope===MUSEUM_OFFER_SCOPE)next.offerScope=MUSEUM_OFFER_SCOPE;delete next.finishedAt;draft.record=next;}
    }
    if(!data.shown[round.id])data.shown[round.id]=snapshotStudyRound(round);
    saveExercise();
    app.innerHTML=`<section class="deep-question journey-question embedded-exercise" data-exercise="${round.exerciseKind}" data-deep-round="${round.id}">${chrome()}${embedded[round.exerciseKind].markup()}<div class="journey-exercise-skip"><button class="text-button" type="button" data-action="deep-skip">Skip</button></div></section>`;
    const heading=app.querySelector('#question-title');if(heading&&(round.exerciseKind!=='difficult-edit'||draft.record.phase==='edit'))heading.textContent=round.title;
    const instruction=app.querySelector('.sorting-instruction');if(instruction)instruction.textContent='Drag related paintings together. You can stack them.';
    const empty=app.querySelector('.sorting-empty');if(empty)empty.textContent='Place the painting here';
    if(round.exerciseKind==='curate'&&draft.record.phase!=='walkthrough')app.querySelector('.gallery-task').innerHTML='<p>Group the paintings across the rooms.</p><p class="gallery-input-hint">Choose a painting, then a + on a wall.</p>';
    if(round.exerciseKind==='curate'&&draft.record.phase==='walkthrough'){heading?.removeAttribute('id');app.querySelector('.gallery-task h2')?.setAttribute('id','question-title');}
    applyTaskSignals(app,round);
    const next=app.querySelector('[data-action="lab-finish"]');if(next)next.textContent='Continue';
    syncImages();
  }
  function restore() {
    let raw=null;
    const failed=()=>{data=prepare(null,getWorks());if(raw!==null)data.unreadableSource=raw;storage=false;storageBlocked=true;};
    const assign=parsed=>{
      const migration=journey?comparisonMethodMigration(parsed,getWorks()):null;
      if(migration){data={...structuredClone(parsed),target:parsed.plan.length,answers:plainObject(parsed.answers)?parsed.answers:{},shown:plainObject(parsed.shown)?parsed.shown:{},archives:Array.isArray(parsed.archives)?parsed.archives:[]};return commitSessionChange(migration,{navigateTo:'intro'});}
      data=journey&&parsed?.reviewingArchived===true?structuredClone(parsed):prepare(parsed,getWorks());
    };
    const adopt=parsed=>{if(parsed?.archives?.some(item=>item?.archiveStorage))return loadStudyArchives(parsed.archives,archiveStore).then(loaded=>{archiveReferences=loaded.references;return assign({...parsed,archives:loaded.archives});});return assign(parsed);};
    try{raw=browserStorage?.getItem(storageKey)||null;const parsed=JSON.parse(raw);if(isActiveStudyReference(parsed))return loadActiveStudy(storageKey,{storage:browserStorage,store:archiveStore}).then(adopt).catch(failed);return adopt(parsed);}
    catch{failed();/* Never overwrite an unreadable source or unavailable committed reference. */}
  }
  function focus() {requestAnimationFrame(()=>{const h=app.querySelector('#question-title')||app.querySelector('h1');h?.setAttribute('tabindex','-1');h?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}
  function home() {
    const rounds=actualRounds(),completed=rounds.filter(resolved).length,answered=answerCount(rounds),skipped=rounds.filter(r=>data.answers[r.id]?.skipped).length,unavailable=rounds.filter(r=>r.unavailable).length;
    return renderStudyTitle({lengths:STUDY_LENGTHS,target:data.target,completed,answered,skipped,unavailable,worksCount:sessionWorks().length,sessionInfo:sessionInfoMarkup(),storage,profileAvailable:answered>0,archiveCount:data.archives.length,started:!!data.startedAt,finished:!!data.startedAt&&completed===data.target});
  }
  function sessionInfoMarkup() {
    const manifest=data.manifest,archives=data.archives.filter(s=>plainObject(s)&&s.manifest?.id);
    return `<div class="deep-session-info"><p class="deep-small">This study uses ${manifest.catalogue.length} works. Starting a separate study keeps your previous answers saved.</p><button class="text-button" type="button" data-action="deep-new-session">Start a separate study with the current collection →</button><details class="deep-method"><summary>About this saved study</summary><p>The shown questions, artworks and answers stay together when the collection grows. Downloads retain those records.${manifest.metadataProvenance==='adopted-current-metadata'?' This older study kept its original shown questions and responses. Its artwork annotations were copied from the catalogue available at the update; they are not recovered historical annotations.':''}${manifest.historicalPool==='unknown-at-adoption'?' The original collection was not fully recorded, so its historical scope remains uncertain.':''}${manifest.unavailableIds?.length?' Some original artwork references are unavailable. Their saved records are retained without substituting other paintings.':''}</p></details>${archives.length?`<details class="deep-method"><summary>Your saved studies</summary>${archives.map(s=>`<button class="text-button" type="button" data-action="deep-session" data-session="${esc(s.manifest.id)}">${esc(new Date(s.manifest.createdAt||s.startedAt||Date.now()).toLocaleDateString())} · ${Object.keys(s.answers||{}).length} saved responses →</button>`).join('')}</details>`:''}</div>`;
  }
  function statementMarkup() {
    const statements=round.statements;statementIndex=Math.min(statementIndex,statements.length-1);const s=statements[statementIndex];
    return `<div class="deep-statement">${statements.length>1?`<p class="eyebrow">${statementIndex+1} / ${statements.length}</p>`:""}<h2 tabindex="-1" ${journey?'id="question-title"':''}>${esc(s.text)}</h2><div class="deep-agreement" role="group" aria-label="Your agreement">${AGREEMENT.map((label,value)=>`<button type="button" class="deep-agreement-choice" data-action="deep-agreement" data-field="${esc(s.id)}" data-value="${value}" aria-pressed="${draft.claims[s.id]===value}"><span aria-hidden="true"></span>${esc(label)}</button>`).join('')}</div>${statements.length>1?`<nav class="deep-statement-nav" aria-label="Statements">${statements.map((s,i)=>`<button type="button" data-action="deep-statement" data-index="${i}" aria-label="Statement ${i+1}${draft.claims[s.id]===undefined?', unanswered':', answered'}" aria-current="${i===statementIndex?'step':'false'}">${i+1}</button>`).join('')}</nav>`:''}<p class="deep-statement-status sr-only" aria-live="polite">${draft.claims[s.id]===undefined?'Choose the position closest to your view.':'You chose '+esc(AGREEMENT[draft.claims[s.id]])+'.'}</p></div>${journey?'':`<div class="deep-reference">${round.works.map(w=>`<button type="button" data-action="deep-art" data-work="${esc(w.id)}" aria-label="Look closer at a reference painting">${image(w)}</button>`).join('')}</div>`}`;
  }
  function contextShiftMarkup(){
    const w=round.works[0],after=draft.storySeen===true,field=after?'after':'before',labels=round.contextScale?.labels||['Not at all','A little','Somewhat','Quite a lot','Very much'],note=round.contextNote?.text||w.note,source=round.contextNote?.sourceUrls?.[0]||w.sourceUrl;
    return `<div class="deep-context story-rating"><figure>${image(w)}<button class="text-button" type="button" data-action="deep-art" data-work="${esc(w.id)}">Look closer ↗</button></figure><div class="story-response">${after?`<p class="story-note">${esc(note)}</p><a class="story-source" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Source ↗</a><div class="story-before" aria-label="Initial appeal: ${draft.before/25+1} of 5"><span>Before</span><div>${labels.map((_,i)=>`<i class="${draft.before===i*25?'selected':''}"></i>`).join('')}</div></div>`:''}<div class="liking-circles" role="group" aria-label="${after?'Appeal after the note':'Appeal before the note'}">${labels.map((label,i)=>`<button type="button" class="context-circle" data-action="deep-liking" data-phase="${field}" data-value="${i*25}" aria-pressed="${draft[field]===i*25}"><span class="context-ring" aria-hidden="true"></span><span>${label}</span></button>`).join('')}</div></div></div>`;
  }
  function directContextMarkup(){
    const work=round.works[0],after=draft.storySeen===true,note=round.contextNote;
    return `<div class="deep-context story-rating"><figure>${image(work)}<button class="text-button" type="button" data-action="deep-art" data-work="${esc(work.id)}">Look closer ↗</button></figure><div class="story-response">${after?`<p class="story-note">${esc(note.text)}</p><p class="story-sources">${note.sources.map(source=>`<a class="story-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.publisher)} ↗</a>`).join(' · ')}</p><div class="liking-circles" role="group" aria-label="${esc(CONTEXT_CHANGE_PROMPT)}">${CONTEXT_CHANGE_OPTIONS.map(option=>`<button type="button" class="context-circle" data-action="deep-context-change" data-value="${option.value}" aria-pressed="${!draft.uncertain&&draft.reportedChange===option.value}"><span class="context-ring" aria-hidden="true"></span><span>${esc(option.label)}</span></button>`).join('')}</div><button class="text-button" type="button" data-action="deep-context-change" data-value="unsure" aria-pressed="${draft.uncertain===true}">Unsure</button>`:'<p>Take a look, then reveal the note.</p>'}</div></div>`;
  }
  function question() {
    const all=profileRounds(),r=refining()?refinementAttempts().find(item=>!resolved(item)):actualRounds()[data.index];round=r;
    if(!r){stopRefinement();return;}
    const earlierShown=all.slice(0,all.findIndex(item=>item.id===r.id)).filter(item=>data.shown[item.id]);
    if(round.kind==='exercise'){exerciseQuestion();return;}
    if(round.unavailable){ready=false;draft=null;app.innerHTML=`<section class="deep-question"><div class="deep-top"><button class="text-button" type="button" data-action="deep-save">← Study overview</button><span>${data.index+1} / ${data.target}</span></div><h1 id="question-title">This saved decision is unavailable.</h1><p class="deep-intro">${esc(round.unavailableReason)} Its question and response remain in the downloaded record. No replacement artwork or answer has been inserted.</p><div class="deep-home-actions"><button class="primary-button" type="button" data-action="deep-unavailable-next">Continue without changing it →</button><button class="text-button" type="button" data-action="deep-export">Download study record ↓</button></div></section>`;return;}
    if(!data.shown[r.id]&&round.evidence?.provisionalPrediction){round={...round,evidence:{...round.evidence,trainingAnswers:Object.fromEntries((round.evidence.trainingRoundIds||[]).filter(id=>data.answers[id]).map(id=>[id,structuredClone(data.answers[id])]))}};}
    if(!data.answers[round.id]?.confirmed&&!data.answers[round.id]?.skipped)expandKeepSelection();
    simplifyInteraction();
    if(round.kind==='contrast'){
      const original=data.answers[round.id],upgrade=upgradeActiveNeighbourRound(round,original,{active:true});
      if(upgrade.changed){data.instrumentRevisions=[...(data.instrumentRevisions||[]),{roundId:round.id,...upgrade.archive,question:snapshotStudyRound(upgrade.archive.question)}];round=upgrade.round;const snapshot=snapshotStudyRound(round);data.shown[round.id]=snapshot;const planned=data.plan.findIndex(item=>item.id===round.id);if(planned>=0)data.plan[planned]=structuredClone(snapshot);if(original!==undefined)data.answers[round.id]=upgrade.draft;}
    }
    if(round.kind==='match'&&!data.shown[r.id]){try{const galleryPreview=captureGalleryPreview(JSON.parse(localStorage.getItem(GALLERY_CONTEXT_KEY)||'null'),ids(round));if(galleryPreview)round={...round,evidence:{...round.evidence,galleryPreview}};}catch{}}
    if(isContextChangeRound(round)&&!data.shown[r.id])round=bindContextChangeRound({round,rounds:earlierShown,answers:data.answers});
    if(!data.shown[r.id])round={...round,evidence:{...round.evidence,exposureHistory:captureArtworkExposure(round,earlierShown,data.answers)}};
    if(!data.shown[r.id])data.shown[r.id]=snapshotStudyRound(round);
    const a=data.answers[round.id];draft=a&&!a.skipped?(validStudyAnswer(round,a)?structuredClone(a):sanitizeStudyDraft(round,a)):sanitizeStudyDraft(round,{});
    if(round.kind==='choice-grid'&&round.evidence?.instrumentRevision===PAGED_FAVOURITES)data.answers[round.id]=structuredClone(draft);
    if(round.kind==='contrast')contrastController=createContrastController({app,round,draft,image,esc,saveDraft:answer=>{draft=answer;data.answers[round.id]=structuredClone(answer);data.finishedAt=null;save();},sync:()=>syncImages()});
    statementIndex=round.kind==='statements'?Math.max(0,round.statements.findIndex(s=>draft.claims[s.id]===undefined)):0;
    const body=round.kind==='contrast'?contrastController.markup():round.kind==='choice-grid'?discoveryGridMarkup(round,draft,{image,esc}):['spectrum','grid','match'].includes(round.kind)?inputs.markup():round.kind==='statements'?statementMarkup():isContextChangeRound(round)?directContextMarkup():round.contextMode==='preference-before-after-v1'?contextShiftMarkup():`<div class="deep-context"><figure>${image(round.works[0])}<button class="text-button" type="button" data-action="deep-art" data-work="${esc(round.works[0].id)}">Look closer ↗</button></figure><div><p class="eyebrow">${esc(round.works[0].artist)}</p><h2>${esc(short(round.works[0]))}</h2><p class="deep-note">${esc(round.works[0].note)}</p><div class="deep-context-options">${[['more','More curious'],['same','About the same'],['less','Less curious'],['unsure','Not sure']].map(([value,label])=>`<button class="context-circle" type="button" data-action="deep-context" data-value="${value}" aria-pressed="${draft.change===value}"><span class="context-ring" aria-hidden="true"></span><span>${label}</span></button>`).join('')}</div><a href="${esc(round.works[0].sourceUrl)}" target="_blank" rel="noopener noreferrer">Museum source ↗</a></div></div>`;
    app.innerHTML=`<section class="deep-question ${journey?'journey-question':''}" data-deep-round="${esc(round.id)}" data-kind="${round.kind}">${journey?chrome():`<div class="deep-top"><button class="text-button" type="button" data-action="deep-save">← Back</button><span>${data.index+1} / ${data.target}</span></div>`}<div class="question-head"><h1 id="${journey&&round.kind==='statements'?'round-format-title':'question-title'}">${esc(isContextChangeRound(round)?(draft.storySeen?CONTEXT_CHANGE_PROMPT:round.contextPrompts.before):round.contextMode==='preference-before-after-v1'?(draft.storySeen?(round.contextPrompts?.after||'How much do you like it now?'):(round.contextPrompts?.before||'How much do you like this painting?')):round.title)}</h1>${round.hint?'<p'+(round.contextMode==='preference-before-after-v1'&&draft.storySeen?' aria-hidden="true"':'')+'>'+(round.contextMode==='preference-before-after-v1'&&draft.storySeen?'&nbsp;':esc(round.hint))+'</p>':''}</div><div id="deep-image-status" class="image-status" role="status" hidden></div><div class="deep-round-body">${round.kind!=='contrast'&&round.anchorWorks?.length?`<div class="deep-anchors">${round.anchorWorks.map(w=>`<figure>${image(w)}</figure>`).join('')}</div>`:''}${body}</div><div class="round-actions"><div class="action-side">${!journey?'<button class="text-button" type="button" data-action="deep-back">Back</button>':''}<button class="text-button" type="button" data-action="${refining()?'deep-refine-stop':'deep-skip'}">${refining()?'Finish for now':'Skip'}</button></div><button class="primary-button" type="button" data-action="deep-next" disabled>${isContextChangeRound(round)&&!draft.storySeen?'Reveal note':round.contextMode==='preference-before-after-v1'&&!draft.storySeen?(round.symbolismProtocol?'Read the note':'Read the story'):round.kind==='contrast'&&round.contrastKind==='chronology'&&!draft.confirmed?'Check dates':round.kind==='match'&&!draft.confirmed?'Check':refining()?(refinementAttempts().length===PROFILE_REFINEMENT_LIMIT?'View profile':'Continue'):data.index===data.target-1?'View profile':'Continue'}</button></div></section>`;
    if(['spectrum','grid','match'].includes(round.kind))inputs.attach();
    applyTaskSignals(app,round);
    syncImages();save();
  }
  function evidenceMarkup(items,label) {
    return items.length?`<div class="deep-evidence"><h3>${esc(label)}</h3>${items.map(e=>`<div><p><span>${esc(e.label)}</span> ${esc(e.prompt)}</p><p>${esc(e.detail)}</p><div>${e.workIds.map(id=>`<button type="button" data-action="deep-art" data-work="${esc(id)}" aria-label="View ${esc(short(lookup(id)))}">${image(lookup(id))}</button>`).join('')}</div></div>`).join('')}</div>`:'';
  }
  function checksMarkup(result) {
    return result.checks.length?`<section class="deep-checks"><h2>Your descriptions and these choices.</h2>${result.checks.map(c=>`<details><summary><span>${esc(c.statement)}</span><span>${esc(({open:'Still open',mixed:'Depends on the work',fits:'Fits here',exception:'A local exception','local-pattern':'A local pattern',compatible:'Compatible here',uncommitted:'Left in between'})[c.status])}</span></summary><p>You chose ${esc(c.answer)}. ${esc(c.detail)}</p>${evidenceMarkup(c.support,'Your description and following comparisons')}${evidenceMarkup(c.counter,'Reversing comparisons')}</details>`).join('')}</section>`:'';
  }
  function exhibitionsMarkup(markup) {
    const all=journey?analyzeScenarios(sessionWorks(),exerciseRecords()).findings:getExhibitionFindings();
    const findings=journey?all.filter(f=>all.length===1||!f.id.endsWith('-geometry')).sort((a,b)=>(b.priority||0)-(a.priority||0)):all;
    return findings.length?`<section class="deep-exhibitions"><h2>Your arrangements</h2>${findings.slice(0,5).map(markup).join('')}</section>`:'';
  }
  function reading() {
    const rounds=profileRounds(Math.max(200,data.plan.length)),activeRounds=journey?rounds:rounds.slice(0,data.target),records=journey?exerciseRecords(rounds):[],result=analyzeStudy(sessionWorks(),rounds,data.answers),leading=result.findings.slice(0,3),rest=result.findings.slice(3);
    const continueButton=activeRounds.some(r=>!resolved(r))?'<button class="primary-button" type="button" data-action="deep-start">Continue the study →</button>':'<button class="primary-button" type="button" data-action="deep-home">Study overview →</button>';
    const markup=f=>`<article class="deep-finding"><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p><details><summary>Works, evidence and limits${f.counter.length?' · including exceptions':''}</summary>${evidenceMarkup(f.support,'Supporting comparisons')}${evidenceMarkup(f.counter,'Comparisons going the other way')}${f.alternatives.map(text=>`<p>${esc(text)}</p>`).join('')}</details></article>`;
    if(journey){const universe=[...new Map([...getWorks(),...sessionWorks()].map(w=>[w.id,w])).values()],arrangements=analyzeScenarios(sessionWorks(),records),portrait=buildTastePortrait({works:universe,rounds,answers:data.answers,records,saved:getSavedCollection(),recommendationHistory:data.archives||[]});portrait.connections=buildTasteConnections({works:universe,rounds,answers:data.answers,records});const completed=data.plan.every(snapshot=>{const item=rounds.find(round=>round.id===snapshot.id);return item&&resolved(item);}),legacyOnly=completed&&![COMPARISON_PROTOCOL,CONTINUOUS_PROTOCOL].includes(data.manifest.preferenceProtocol)&&!rounds.some(item=>(isComparisonPreferenceRound(item)||isOverallAppealRound(item))&&validStudyAnswer(item,data.answers[item.id]));const atLimit=data.plan.length>=JOURNEY_MAX_LENGTH,continuation={action:legacyOnly?'deep-retake':completed?atLimit?'collection':'deep-extend':'deep-start',label:legacyOnly?'Start updated quiz':completed?atLimit?'Explore your gallery':'Continue with 50 more':'Continue your rounds'};const view=renderTastePortrait({portrait,study:result,arrangements,rounds,answers:data.answers,works:universe,image,esc,keepButtons,continuation,refinementOffer:refinementOffer({rounds,completed:data.plan.slice(0,50).every(snapshot=>{const item=rounds.find(round=>round.id===snapshot.id);return item&&resolved(item);})})});const footer=`<div class="deep-reading-actions tp-footer"><button class="primary-button" type="button" data-action="${esc(continuation.action)}">${esc(continuation.label)}</button><button class="text-button" type="button" data-action="collection">Your collection</button><a class="text-button" href="./maps.html">Your maps ↗</a><a class="text-button" href="./paintings.html">Paintings ↗</a><a class="text-button" href="./profiles.html">Explore profiles ↗</a><button class="text-button" type="button" data-action="deep-retake">Start a new quiz</button>${data.archives.length?'<button class="text-button" type="button" data-action="deep-archives">Previous quizzes</button>':''}<button class="text-button" type="button" data-action="deep-review">Review answers</button><button class="text-button" type="button" data-action="deep-export">Download</button></div>`;const end=view.lastIndexOf('</section>');return view.slice(0,end)+footer+view.slice(end);}
    return `<section class="deep-reading"><div class="deep-top"><button class="text-button" type="button" data-action="deep-home">← Study overview</button><span>Saved in this browser</span></div><p class="eyebrow">${result.answered} answered rounds · ${result.artworks} distinct works</p><h1>${esc(result.name)}</h1><p class="deep-intro">This reading connects the decisions you actually completed. Specific comparisons, exceptions and task wording stay attached to each observation.</p>${!result.findings.length?'<p class="deep-empty-reading">Complete preference choices and the related response tasks to connect them. An isolated placement stays a response, without an invented explanation.</p>':''}${leading.map(markup).join('')}${rest.length?`<details class="deep-more"><summary>${rest.length} more observations</summary>${rest.map(markup).join('')}</details>`:''}${checksMarkup(result)}${exhibitionsMarkup(markup)}<div class="deep-reading-actions">${continueButton}<button class="text-button" type="button" data-action="deep-export">Download study record ↓</button></div><details class="deep-method"><summary>What this reading can establish</summary><p>${esc(result.basis)}</p><p>${result.skipped} decisions were skipped. Missing answers and ties do not become preferences. Contextual selection tasks and agreement statements do not train the individual preference explanation.</p><p>This prototype has not been psychometrically validated. A long path through ${sessionWorks().length} artworks does not establish an unrestricted profile of taste.</p></details>${result.evidence.length?`<section class="deep-keeps"><h2>Keep works for another look.</h2>${result.evidence.slice(0,12).map(id=>`<div><span>${esc(short(lookup(id)))}</span>${keepButtons(lookup(id))}</div>`).join('')}</section>`:''}</section>`;
  }
  function syncImages() {
    if(!app.querySelector('.deep-question'))return;
    if(!round||round.unavailable)return;
    if(round.kind==='exercise'){embedded[round.exerciseKind].sync();ready=embedded[round.exerciseKind].mountedReady();return;}
    const phoneMap=app.querySelector('.mobile-map-mode'),mapImages=phoneMap?.querySelectorAll(phoneMap.dataset.mapStage==='painting'?'.focus-column img,.work-overview img':'.mobile-map-toolbar img,.map-surround img'),imgs=phoneMap?[...new Set([...mapImages,...app.querySelectorAll('.deep-anchors img')])]:[...app.querySelectorAll('.deep-round-body img,.deep-anchors img')].filter(img=>!img.closest('.mobile-spectrum-mode .work-overview .has-placement')),failed=imgs.filter(i=>i.complete&&!i.naturalWidth);ready=round.kind==='statements'||imgs.length>0&&imgs.every(i=>i.complete&&i.naturalWidth>0);
    const status=app.querySelector('#deep-image-status');status.hidden=ready;const key=ready?'ready':failed.length?'failed':'loading';if(status.dataset.state!==key){status.dataset.state=key;status.innerHTML=ready?'':failed.length?'An artwork could not load. <button class="text-button" type="button" data-action="deep-retry">Retry images</button>':'Loading artworks…';}
    if(['spectrum','grid','match'].includes(round.kind))inputs.refresh();
    if(round.kind==='choice-grid')updateArtworkCorners(app);
    if(round.kind==='contrast'){
      for(const button of app.querySelectorAll('.contrast-round button'))button.disabled=!ready;
      ready=contrastController?.sync()===true&&ready;
      updateArtworkCorners(app);
      if(!ready)for(const button of app.querySelectorAll('.contrast-round button'))button.disabled=true;
      const proceed=app.querySelector('[data-action=deep-next]');if(proceed)proceed.textContent=round.contrastKind==='chronology'&&!draft.confirmed?'Check dates':data.index===data.target-1?'View profile':'Continue';
    }
    for(const button of app.querySelectorAll('.drag-art,.match-label,[data-action=place-match],.spectrum-hit,.discovery-work,.discovery-none,.deep-agreement-choice,[data-action=deep-context],[data-action=deep-liking],[data-action=deep-context-change]'))button.disabled=!ready||round.kind==='match'&&draft.confirmed;
    for(const button of app.querySelectorAll('[data-action=nudge]'))if(!ready)button.disabled=true;
    const next=app.querySelector('[data-action=deep-next]');if(next)next.disabled=!ready||(isContextChangeRound(round)&&!draft.storySeen?false:round.contextMode==='preference-before-after-v1'&&!draft.storySeen?![0,25,50,75,100].includes(draft.before):!validStudyAnswer(round,['grid','spectrum','match','choice-grid','contrast','context'].includes(round.kind)?{...draft,confirmed:true}:draft));
    const flow=inputs.mobileMapAction?.();if(next&&flow){next.textContent=flow.label;next.disabled=!ready||flow.disabled;}else if(next&&round.kind==='grid')next.textContent=refining()?(refinementAttempts().length===PROFILE_REFINEMENT_LIMIT?'View profile':'Continue'):data.index===data.target-1?'View profile':'Continue';
    app.querySelector('#response-pad')?.setAttribute('aria-disabled',String(!ready));
  }
  function simplifyInteraction(force=false){
    const original=data.answers[round.id],update=simplifyActiveInteraction(round,original,{force});if(!update)return false;
    data.instrumentRevisions=[...(data.instrumentRevisions||[]),{roundId:round.id,reason:update.reason,revisedAt:Date.now(),question:snapshotStudyRound(round),...(original?{answer:structuredClone(original)}:{})}];
    round=update.round;const snapshot=snapshotStudyRound(round);if(data.shown[round.id])data.shown[round.id]=snapshot;
    const index=data.plan.findIndex(item=>item.id===round.id);if(index>=0)data.plan[index]=structuredClone(snapshot);
    if(update.draft){data.answers[round.id]=update.draft;draft=sanitizeStudyDraft(round,update.draft);}
    const hint=app.querySelector('.question-head>p');if(hint)hint.textContent=round.hint;
    return true;
  }
  function expandKeepSelection(){
    const updated=expandKeepSelectionRound(round);if(!updated)return false;
    const previous=snapshotStudyRound(round),answer=data.answers[round.id];
    data.instrumentRevisions=[...(data.instrumentRevisions||[]),{roundId:round.id,reason:'The three-work limit was removed from this active keep grid.',revisedAt:Date.now(),question:previous,...(answer?{answer:structuredClone(answer)}:{})}];
    round=updated;const snapshot=snapshotStudyRound(round);data.shown[round.id]=snapshot;
    const index=data.plan.findIndex(item=>item.id===round.id);if(index>=0)data.plan[index]=structuredClone(snapshot);
    const hint=app.querySelector('.question-head>p');if(hint)hint.textContent=round.hint;
    return true;
  }
  app.addEventListener('load',()=>syncImages(),true);app.addEventListener('error',()=>syncImages(),true);
  globalThis.addEventListener?.('resize',()=>{if(['choice-grid','contrast'].includes(round?.kind)&&app.querySelector('.deep-question'))syncImages();});
  function render(){clearTimeout(statementTimer);contrastController?.dispose();contrastController=null;if(data.screen==='question')question();else app.innerHTML=data.screen==='reading'?reading():home();}
  function changeScreen(screen){if(screen!=='question'&&profileRefinementState(data))data.profileRefinement.active=false;data.screen=screen;save();navigate(journey&&screen==='home'?'intro':'study');}
  function next(skip=false) {
    if(!skip&&isContextChangeRound(round)&&!draft.storySeen){if(!ready)return;draft=reduceContextChangeDraft(round,draft,{type:'reveal'});data.answers[round.id]=structuredClone(draft);save();render();focus();return;}
    if(!skip&&round?.contextMode==='preference-before-after-v1'&&!draft.storySeen){if(!ready||![0,25,50,75,100].includes(draft.before))return;if(round.symbolismProtocol)draft=reduceSymbolismDraft(round,draft,{type:'reveal'});else{draft.storySeen=true;draft.stage='after';}data.answers[round.id]=structuredClone(draft);save();render();focus();return;}
    if(round?.kind==='exercise'){
      if(skip)data.answers[round.id]={...structuredClone(draft),skipped:true};
      else{
        if(!embedded[round.exerciseKind].mountedReady()||!validScenario(draft.record,sessionWorks(),false))return;
        draft.record={...structuredClone(draft.record),confirmed:true,finishedAt:Date.now()};
        data.answers[round.id]={...structuredClone(draft),answeredAt:Date.now()};
      }
      if(data.index===data.target-1){data.finishedAt=Date.now();data.screen='reading';}else data.index++;
      save();render();focus();return;
    }
    if(!skip&&(!ready||!validStudyAnswer(round,['spectrum','grid','match','choice-grid','contrast','context'].includes(round.kind)?{...draft,confirmed:true}:draft)))return;
    if(!skip&&round.kind==='contrast'&&!draft.confirmed){const answer=contrastController?.confirm();if(!answer)return;draft=answer;if(round.contrastKind==='chronology'){syncImages();return;}}
    if(!skip&&round.kind==='match'&&!draft.confirmed){draft.confirmed=true;draft.feedbackSeen=true;data.answers[round.id]=structuredClone(draft);save();render();focus();return;}
    if(skip)data.answers[round.id]={skipped:true,workIds:ids(round)};else{if(['spectrum','grid','choice-grid','contrast','context'].includes(round.kind))draft.confirmed=true;data.answers[round.id]={...structuredClone(draft),answeredAt:Date.now()};}
    if(refining()){continueRefinement();return;}
    if(data.index===data.target-1){data.finishedAt=Date.now();data.screen='reading';}else data.index++;
    save();render();focus();
  }
  function exportData(){
    ensureSession();
    const rounds=profileRounds(Math.max(200,data.plan.length)),records=journey?exerciseRecords(rounds):[],unavailable=rounds.filter(r=>r.unavailable),universe=[...new Map([...getWorks(),...sessionWorks()].map(w=>[w.id,w])).values()],portrait=journey?buildTastePortrait({works:universe,rounds,answers:data.answers,records,saved:getSavedCollection(),recommendationHistory:data.archives||[]}):null;
    if(portrait)portrait.connections=buildTasteConnections({works:universe,rounds,answers:data.answers,records});
    return {version:1,target:data.target,index:data.index,startedAt:data.startedAt,finishedAt:data.finishedAt,manifest:structuredClone(data.manifest),answers:structuredClone(data.answers),rounds:structuredClone(Object.values(data.shown)),plannedRounds:structuredClone(data.plan),archives:structuredClone(data.archives),unavailableDecisions:unavailable.map(r=>({id:r.id,workIds:r.unavailableWorkIds,reason:r.unavailableReason})),reading:analyzeStudy(sessionWorks(),rounds,data.answers),...(journey?{...(data.profileRefinement?{profileRefinement:structuredClone(data.profileRefinement)}:{}),batches:structuredClone(data.batches||[]),planRevisions:structuredClone(data.planRevisions||[]),instrumentRevisions:structuredClone(data.instrumentRevisions||[]),portrait}:{}),exhibitionFindings:structuredClone(journey?analyzeScenarios(sessionWorks(),records).findings:getExhibitionFindings()),...(data.unreadableSource?{unreadableSource:data.unreadableSource}:{}),...(data.unmappedAnswers!==undefined?{unmappedAnswers:structuredClone(data.unmappedAnswers)}:{}),...(data.unmappedShown!==undefined?{unmappedShown:structuredClone(data.unmappedShown)}:{}),...(data.retainedSource?{retainedSource:structuredClone(data.retainedSource)}:{})};
  }
  async function commitSessionChange(candidate,{navigateTo='study'}={}) {
    if(sessionChangePending)return;sessionChangePending=true;
    const current=data,priorReferences=archiveReferences;
    try{
      try{archiveReferences=await storeStudyArchives(candidate.archives,archiveStore);}catch{archiveReferences=new Map();}
      data=candidate;
      if(!await save()){data=current;archiveReferences=priorReferences;const message=app.ownerDocument.createElement('p');message.setAttribute('role','alert');message.textContent='The new quiz could not be saved. Download this quiz before trying again.';app.prepend(message);return;}
      if(navigateTo)navigate(navigateTo);
    }finally{sessionChangePending=false;}
  }
  function startNewSession(){ensureSession();let candidate;if(journey)candidate=retakeJourneySession(data,getWorks());else{const previous=structuredClone(data);delete previous.archives;candidate=prepare(null,getWorks());candidate.archives=[...data.archives,previous];candidate.startedAt=Date.now();candidate.screen='question';}return commitSessionChange(candidate);}
  function switchSession(id) {const target=data.archives.find(s=>s?.manifest?.id===id&&!s.unavailable);if(!target)return;const current=structuredClone(data);delete current.archives;delete current.reviewingArchived;const candidate=journey&&target.manifest?.protocol===JOURNEY_PROTOCOL?structuredClone(target):prepare(target,getWorks());candidate.archives=[...data.archives.filter(s=>s?.manifest?.id!==id),current];candidate.screen='reading';if(journey)candidate.reviewingArchived=true;return commitSessionChange(candidate);}
  function showPreviousQuizzes(){
    const document=app.ownerDocument,dialog=document.createElement('dialog');dialog.className='profile-details-dialog';dialog.setAttribute('aria-label','Previous quizzes');
    dialog.innerHTML=`<header><h2>Previous quizzes</h2><button type="button" class="profile-details-close" data-action="deep-archives-close" aria-label="Close previous quizzes">×</button></header><div class="profile-details-content">${data.archives.map(saved=>`<button class="previous-quiz" type="button" data-action="deep-session" data-session="${esc(saved.manifest?.id)}" ${saved.unavailable?'disabled':''}><strong>${esc(new Date(saved.manifest?.createdAt||saved.startedAt||Date.now()).toLocaleDateString())}</strong><span>${saved.unavailable?'Unavailable in this browser':Object.keys(saved.answers||{}).length+' responses'}</span><span aria-hidden="true">↗</span></button>`).join('')}</div>`;
    app.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }
  function collectionChoices(){return quizCollectionChoices({works:sessionWorks(),rounds:profileRounds(),answers:data.answers});}
  function favouriteWorkIds(){return collectionChoices().favouriteIds;}
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=journey?'my-art-atlas.json':'my-art-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  globalThis.addEventListener?.('pagehide',()=>{void persistence.flush();});
  globalThis.addEventListener?.('beforeunload',()=>{void persistence.flush();});
  app.ownerDocument?.addEventListener?.('visibilitychange',()=>{if(app.ownerDocument.visibilityState==='hidden')void persistence.flush();});
  return {restore,render,exportData,startNewSession,favouriteWorkIds,collectionChoices,getArtwork:lookup,flush:()=>persistence.flush(),opening:home,started:()=>!!data.startedAt,clear(){clearTimeout(statementTimer);contrastController?.dispose();contrastController=null;data=fresh();round=null;draft=null;ready=false;storageBlocked=false;return persistence.clear();},handle(action,control,event){
    if(app.querySelector('.embedded-exercise')&&round?.kind==='exercise'){
      if(action==='lab-finish'){next();return true;}
      if(action==='lab-home'){changeScreen('home');return true;}
      if(action==='lab-reading'){changeScreen('reading');return true;}
      if(embedded[round.exerciseKind].handle(action,control,event))return true;
    }
    if(round?.kind==='choice-grid'&&['deep-grid-pick','deep-grid-none','deep-grid-unsure'].includes(action)){if(!ready)return true;expandKeepSelection();simplifyInteraction(true);draft=action==='deep-grid-pick'?toggleGridChoice(round,draft,control.dataset.work):{...draft,selectedIds:[],explicitNone:action==='deep-grid-none',unsure:action==='deep-grid-unsure',confirmed:false};data.answers[round.id]=structuredClone(draft);save();for(const button of app.querySelectorAll('.discovery-work'))button.setAttribute('aria-pressed',String(draft.selectedIds.includes(button.dataset.work)));app.querySelector('[data-action=deep-grid-none]')?.setAttribute('aria-pressed',String(draft.explicitNone));app.querySelector('[data-action=deep-grid-unsure]')?.setAttribute('aria-pressed',String(draft.unsure));const count=app.querySelector('.discovery-count');if(count)count.textContent=draft.selectedIds.length+(round.selectionMode==='shortlist'&&(round.maxChoices||3)<round.works.length?' / '+(round.maxChoices||3):'')+' selected';syncImages();return true;}
    if(round?.kind==='contrast'&&app.querySelector('.deep-question')&&action?.startsWith('contrast-')){if(ready)contrastController?.handle(action,control,event);return true;}
    if(app.querySelector('.deep-question')&&inputs.click(action,control,event))return true;
    if(app.querySelector('.deep-question')&&action==='zoom'){showArtwork(control.dataset.work,round.kind==='context'&&(!round.contextMode||draft.storySeen)||round.kind==='match'&&draft.confirmed?(round.kind==='match'&&round.field==='artist'?'artist':true):false);return true;}
    if(!action?.startsWith('deep-'))return false;
    if(action==='deep-refine'){startRefinement();return true;}
    if(action==='deep-refine-stop'){stopRefinement();return true;}
    if(action==='deep-extend'&&journey){data=extendJourneySession(data,getWorks());save();navigate('study');focus();return true;}
    if(action==='deep-retake'){startNewSession();return true;}
    if(action==='deep-grid-page'&&round?.kind==='choice-grid'&&round.evidence?.instrumentRevision===PAGED_FAVOURITES){
      if(!ready)return true;draft=setChoiceGridPage(round,draft,Number(control.dataset.page));data.answers[round.id]=structuredClone(draft);save();
      const grid=app.querySelector('.discovery-grid');if(grid)grid.outerHTML=discoveryGridMarkup(round,draft,{image,esc});syncImages();return true;
    }
    if(action==='deep-archives'){showPreviousQuizzes();return true;}
    if(action==='deep-archives-close'){control.closest('dialog')?.close();return true;}
    if(action==='deep-home')changeScreen('home');
    if(action==='deep-new-session')startNewSession();
    if(action==='deep-session')switchSession(control.dataset.session);
    if(action==='deep-unavailable-next'){if(data.index===data.target-1)data.screen='reading';else data.index++;save();render();focus();}
    if(action==='deep-exit'){data.screen='home';save();navigate('intro');}
    if(action==='deep-length'&&!journey){const target=Number(control.dataset.target);if(STUDY_LENGTHS.includes(target)){data.target=target;data.index=Math.min(data.index,target-1);save();render();}}
    if(action==='deep-start'){const rounds=actualRounds(),first=rounds.findIndex(r=>!resolved(r));if(first<0){changeScreen('reading');return true;}if(resolved(rounds[data.index]))data.index=first;data.startedAt||=Date.now();data.finishedAt=null;changeScreen('question');}
    if(action==='deep-review'){if(profileRefinementState(data))data.profileRefinement.active=false;data.index=0;changeScreen('question');}
    if(action==='deep-save'){if(refining())stopRefinement();else changeScreen('home');}
    if(action==='deep-reading'){if(refining())stopRefinement();else changeScreen('reading');}
    if(action==='deep-back'&&!refining()&&data.index>0){data.index--;save();render();focus();}
    if(action==='deep-next'&&!inputs.advanceMobileMap?.())next();if(action==='deep-skip')next(true);
    if(action==='deep-liking'&&ready&&round.contextMode==='preference-before-after-v1'){const phase=draft.storySeen?'after':'before',value=Number(control.dataset.value);if(control.dataset.phase===phase&&[0,25,50,75,100].includes(value)){if(round.symbolismProtocol)draft=reduceSymbolismDraft(round,draft,{type:phase==='before'?'rate-before':'rate-after',value});else draft[phase]=value;data.answers[round.id]=structuredClone(draft);data.finishedAt=null;save();for(const b of app.querySelectorAll('[data-action=deep-liking]'))b.setAttribute('aria-pressed',String(Number(b.dataset.value)===value));syncImages();}}
    if(action==='deep-context-change'&&ready&&isContextChangeRound(round)){draft=reduceContextChangeDraft(round,draft,control.dataset.value==='unsure'?{type:'unsure'}:{type:'change',value:Number(control.dataset.value)});data.answers[round.id]=structuredClone(draft);data.finishedAt=null;save();for(const button of app.querySelectorAll('[data-action=deep-context-change]'))button.setAttribute('aria-pressed',String(button.dataset.value==='unsure'?draft.uncertain===true:!draft.uncertain&&Number(button.dataset.value)===draft.reportedChange));syncImages();}
    if(action==='deep-context'&&ready){draft.change=control.dataset.value;data.answers[round.id]=structuredClone(draft);save();for(const b of app.querySelectorAll('[data-action=deep-context]'))b.setAttribute('aria-pressed',String(b.dataset.value===draft.change));syncImages();}
    if(action==='deep-statement'){statementIndex=Number(control.dataset.index);app.querySelector('.deep-round-body').innerHTML=statementMarkup();syncImages();}
    if(action==='deep-agreement'&&ready){const id=control.dataset.field;draft.claims[id]=Number(control.dataset.value);data.answers[round.id]=structuredClone(draft);save();for(const b of app.querySelectorAll('[data-action=deep-agreement]'))b.setAttribute('aria-pressed',String(b.dataset.value===control.dataset.value));app.querySelector('.deep-statement-status').textContent='You chose '+AGREEMENT[Number(control.dataset.value)]+'.';syncImages();if(statementIndex<round.statements.length-1){const currentId=round.id,currentIndex=statementIndex;clearTimeout(statementTimer);statementTimer=setTimeout(()=>{if(app.querySelector('.deep-question')&&round.id===currentId&&statementIndex===currentIndex){statementIndex++;app.querySelector('.deep-round-body').innerHTML=statementMarkup();syncImages();}},230);}}
    if(action==='deep-art')showArtwork(control.dataset.work,round?.kind==='context'&&(!round.contextMode||draft.storySeen)||!journey&&data.index>=190);
    if(action==='deep-retry'){for(const img of app.querySelectorAll('.deep-question img'))if(!img.complete||!img.naturalWidth)img.src='./'+lookup(img.dataset.artwork).image+'?retry='+Date.now();syncImages();}
    if(action==='deep-export')download();
    return true;
  }};
}
