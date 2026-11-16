import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import {validAnswer} from './engine.mjs';
import {planAdaptivePanels} from './adaptive-selection.mjs';
import {recognitionTier} from './curation-priority.mjs';
import {choiceGridExposure} from './discovery-grid.mjs';

export const STIMULUS_PLANNER_REVISION='curated-stimuli-v4';
export const FIRST_PANEL_SIZES=Object.freeze([4,3,4,3,4,4,3,4,4,3,4,4,3,4,4,3,3,3]);
export const STIMULUS_TARGETS=Object.freeze({eraCount:6,regionCount:5,countryCount:12,traditionCount:18,secondBatchFirstRatings:18,thirdBatchFirstRatings:17});
const FEATURES=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
const OPENING=['van-gogh-starry-night','study-leonardo-mona-lisa','study-hokusai-great-wave','klimt-kiss'];
const TARGETS=[null,'abstraction','humanity','energy','complexity','atmosphere','color','narrative','abstraction','humanity','complexity','color','atmosphere','energy','narrative','abstraction','humanity','complexity'];
const IMPORTANCE_WEIGHTS=Object.freeze({'canonical-anchor':1,canonical:1,'tradition-anchor':1.2,diagnostic:.8,supporting:.2});
const FAMILIES=new Set(['individual-choice','feature-check','unconditional-preference','adaptive-preference']);
const LIMITS=[
  'This is seeded editorial stimulus selection using explicit heuristics. It is not optimal information gain, a validated experimental design, or a population sample.',
  'Importance, regions, traditions and visual descriptors are editorial metadata. They are not the viewer\'s traits, measured public familiarity, or causes of preference.',
  'Reservations concern first unconditional preference ratings. Other tasks may already have shown a reserved image, and the viewer may have known it before the session.',
  'An annotation-matched contrast can still differ in unrecorded subject, material, reproduction, context, symbolism or prior knowledge. No comparison isolates a causal feature.',
  'Repeated sets and shared works remain dependent observations. Existing adaptive training snapshots, predictions and exact-repeat instructions are preserved.'
];
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const label=v=>typeof v==='string'&&v.trim()&&!/^(unknown|unidentified|unspecified|n\/a)$/i.test(v.trim())?v.trim():null;
const key=v=>label(v)?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()||null;
const unique=items=>[...new Set(items)];
const ids=round=>Array.isArray(round?.works)?round.works.map(w=>w?.id):Array.isArray(round?.workIds)?[...round.workIds]:[];
const signature=items=>JSON.stringify([...items].sort());
const pairKey=(a,b)=>signature([a,b]);
const pairs=items=>items.flatMap((a,i)=>items.slice(i+1).map(b=>[a,b]));
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const increment=(map,id,amount=1)=>{if(id!==null&&id!==undefined)map.set(id,(map.get(id)||0)+amount);};
const known=(work,feature)=>isReviewedVisualDescriptor(work,feature);
const range=value=>Array.isArray(value)&&value.length===2&&Array.from(value).every(Number.isFinite)&&value[0]<=value[1]?[...value]:null;
const avoidPair=(a,b)=>(Array.isArray(a.note.avoidPairIds)&&a.note.avoidPairIds.includes(b.id))||(Array.isArray(b.note.avoidPairIds)&&b.note.avoidPairIds.includes(a.id));
function hash(value){let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function regionFor(country){
  const c=key(country);
  if(['china','japan','korea'].includes(c))return 'east-asia';
  if(['india','nepal','tibet'].includes(c))return 'south-asia-and-himalayas';
  if(['mexico','brazil','uruguay'].includes(c))return 'latin-america';
  if(['egypt','ethiopia'].includes(c))return 'africa';
  if(c==='united states')return 'north-america';
  if(c==='french polynesia')return 'oceania';
  if(['austria','belgium','flanders','france','germany','italy','netherlands','norway','poland','spain','united kingdom'].includes(c))return 'europe';
  if(['russia','russia / germany'].includes(c))return 'europe-and-eurasia';
  return null;
}
function eraFor(years){
  if(!years)return null;
  const band=y=>y<1300?'before1300':y<1600?'1300-1599':y<1800?'1600-1799':y<1850?'1800-1849':y<1900?'1850-1899':y<=1955?'1900-1955':'after1955';
  return band(years[0])===band(years[1])?band(years[0]):null;
}
function rowsFor(works,notes){
  const counts=new Map();for(const w of works)if(label(w?.id))increment(counts,w.id);
  const annotations=new Map((Array.isArray(notes?.annotations)?notes.annotations:[]).filter(n=>label(n?.workId)).map(n=>[n.workId,n]));
  return works.filter(w=>plain(w)&&label(w.id)&&counts.get(w.id)===1&&label(w.title)&&label(w.image)&&label(w.sourceUrl)&&w.studyEligible!==false&&w.decorativeOnly!==true).map(work=>{
    const note=annotations.get(work.id)||{},years=range(work.analysis?.yearRange),country=key(work.country||work.origin);
    return {id:work.id,work,note,country,region:key(note.regionKey)||regionFor(country),era:key(note.eraKey)||eraFor(years),tradition:key(note.traditionKey)||key(work.analysis?.movementKey)||key(work.movement),years,
      subject:key(note.subjectFamily),medium:key(work.medium),landmark:recognitionTier(work)==='landmark',importance:key(note.importanceTier),sourceUrls:unique([...(Array.isArray(note.sourceUrls)?note.sourceUrls.filter(label):[]),work.sourceUrl]),
      regionSource:label(note.regionSource)||(country?'Editorial broad grouping of the supplied country/tradition label; not a place-of-execution claim.':null)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
function historyFor(rows,rounds,answers){
  const byId=new Map(rows.map(r=>[r.id,r.work])),presentations=new Map(),preferenceSeen=new Set(),seenPairs=new Set(),unknownExposure=new Set(),unknownRoundIds=[],eligibleRoundIds=[],eligibleSets=new Set(),safeRounds=[];
  const roundCounts=new Map();for(const r of rounds)if(label(r?.id))increment(roundCounts,r.id);
  for(const raw of rounds){
    if(!plain(raw)||!label(raw.id)||roundCounts.get(raw.id)!==1||raw.unavailable)continue;
    const workIds=ids(raw);if(!workIds.length||new Set(workIds).size!==workIds.length||workIds.some(id=>!byId.has(id)))continue;
    let presented,groups,unknown=[];const paged=choiceGridExposure(raw,answers[raw.id]);
    if(raw.evidence?.stimulusVisibility==='not-shown'){presented=[];groups=[];}
    else if(Array.isArray(raw.presentedIds)){presented=unique(raw.presentedIds.filter(id=>byId.has(id)));groups=Array.isArray(raw.coPresentedGroups)?raw.coPresentedGroups:[presented];unknown=Array.isArray(raw.exposureUnknownWorkIds)?raw.exposureUnknownWorkIds:[];}
    else if(paged){presented=paged.presentedIds.filter(id=>byId.has(id));groups=paged.coPresentedGroups;}
    else if(raw.evidence?.explicitFavourites){presented=[];groups=[];unknown=[...workIds];}
    else if(raw.kind==='exercise'){
      const record=answers[raw.id]?.record;
      if(record&&Array.isArray(record.presentedIds)){presented=unique(record.presentedIds.filter(id=>byId.has(id)));const placed=Object.keys(record.placements||{}).filter(id=>byId.has(id));groups=raw.exerciseKind==='curate'?[placed]:[presented];unknown=raw.exerciseKind==='curate'?presented.filter(id=>!placed.includes(id)):[];}
      else{presented=[];groups=[];unknown=[...workIds];}
    }else{presented=unique([...workIds,...(Array.isArray(raw.anchorIds)?raw.anchorIds:[]),...(Array.isArray(raw.anchorWorks)?raw.anchorWorks:[]).map(w=>w?.id)].filter(id=>byId.has(id)));groups=[presented];}
    presented.forEach(id=>increment(presentations,id));unknown.filter(id=>byId.has(id)).forEach(id=>unknownExposure.add(id));
    if(unknown.length)unknownRoundIds.push(raw.id);
    for(const group of groups.filter(Array.isArray))for(const [a,b] of pairs(unique(group.filter(id=>byId.has(id)))))seenPairs.add(pairKey(a,b));
    const round={...raw,works:workIds.map(id=>byId.get(id)),presentedIds:presented,coPresentedGroups:groups,exposureUnknownWorkIds:unknown};safeRounds.push(round);
    const a=answers[raw.id];
    if(round.kind!=='spectrum'||round.criterion!=='preference'||round.evidence?.construct!=='preference'||!FAMILIES.has(round.evidence?.family)||round.evidence?.unconditional===false||round.evidence?.brief||round.brief||round.anchorIds?.length||round.anchorWorks?.length||!plain(a?.positions)||!Array.isArray(a?.workIds)||a.workIds.length!==workIds.length||!a.workIds.every((id,i)=>id===workIds[i]))continue;
    let valid=false;try{valid=validAnswer(round,a);}catch{}
    if(valid){eligibleRoundIds.push(round.id);eligibleSets.add(signature(workIds));workIds.forEach(id=>preferenceSeen.add(id));}
  }
  return {presentations,preferenceSeen,seenPairs,unknownExposure,unknownRoundIds,eligibleRoundIds,eligibleSets,safeRounds};
}
function lastSpecificQuestion(rounds){
  for(const round of [...rounds].reverse()){
    if(round.kind==='statements'||round.evidence?.stimulusVisibility==='not-shown')continue;
    const anchors=[...(round.anchorIds||[]),...(round.anchorWorks||[]).map(work=>work?.id)];
    // A skipped specific question still showed its offered images. A museum's
    // whole offered library is different: use only recorded presentations.
    const workIds=round.kind!=='exercise'||['sorting','difficult-edit','edit'].includes(round.exerciseKind)?unique([...ids(round),...anchors]):unique(round.presentedIds||[]);
    if(workIds.length)return{roundId:round.id,workIds};
  }
  return null;
}
function groupCounts(rows){return Object.fromEntries(['era','region','country','tradition'].map(field=>{const counts=new Map();for(const row of rows)increment(counts,row[field]);return [field,Object.fromEntries([...counts].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))];}));}
function pairDiagnostic(a,b,targetFeature){
  const otherFeatureGaps=Object.fromEntries(FEATURES.filter(f=>f!==targetFeature&&known(a.work,f)&&known(b.work,f)).map(f=>[f,Math.abs(a.work.features[f]-b.work.features[f])]));
  const targetGap=targetFeature&&known(a.work,targetFeature)&&known(b.work,targetFeature)?Math.abs(a.work.features[targetFeature]-b.work.features[targetFeature]):null,otherMean=mean(Object.values(otherFeatureGaps)),maximumOtherGap=Object.keys(otherFeatureGaps).length?Math.max(...Object.values(otherFeatureGaps)):null,dateGap=a.years&&b.years?Math.max(0,a.years[0]-b.years[1],b.years[0]-a.years[1]):null;
  const residualConfounds=[];
  if(a.country&&b.country&&a.country!==b.country)residualConfounds.push('Different recorded country/tradition labels.');
  if(a.era&&b.era&&a.era!==b.era)residualConfounds.push('Different recorded eras.');
  if(dateGap===null)residualConfounds.push('One or both closed creation-date ranges are unavailable.');else if(dateGap>100)residualConfounds.push('The recorded date intervals are more than a century apart.');
  if(a.tradition&&b.tradition&&a.tradition!==b.tradition)residualConfounds.push('Different editorial traditions or movements.');
  if(!a.subject||!b.subject)residualConfounds.push('Subject matching is not established.');else if(a.subject!==b.subject)residualConfounds.push('Different annotated subject families.');
  if(!a.medium||!b.medium||a.medium!==b.medium)residualConfounds.push('Making/material is different or not fully recorded.');
  if(Object.values(otherFeatureGaps).some(gap=>gap>.35))residualConfounds.push('At least one other known visual annotation differs by more than 0.35.');
  if(Object.keys(otherFeatureGaps).length<4)residualConfounds.push('Fewer than four other visual annotations can be compared.');
  residualConfounds.push('Unrecorded meaning, reproduction and prior knowledge can still differ.');
  return {workIds:[a.id,b.id],targetFeature:targetFeature||null,targetGap,otherFeatureGaps,meanOtherFeatureGap:otherMean,maximumOtherFeatureGap:maximumOtherGap,dateGapLowerBound:dateGap,unknownFeatureKeys:FEATURES.filter(f=>!known(a.work,f)||!known(b.work,f)),annotationMatched:targetGap!==null&&targetGap>=.35&&Object.keys(otherFeatureGaps).length>=4&&otherMean<=.22&&maximumOtherGap<=.4,residualConfounds};
}
function panelDiagnostic(chosen,targetFeature,contrastPairs=[],pairBasis='descriptive'){
  const byId=new Map(chosen.map(r=>[r.id,r])),validPairs=contrastPairs.filter(p=>p.every(id=>byId.has(id))),comparisons=validPairs.map(([a,b])=>pairDiagnostic(byId.get(a),byId.get(b),targetFeature));
  const targetValues=targetFeature?chosen.filter(row=>known(row.work,targetFeature)).map(row=>row.work.features[targetFeature]):[],targetRange=targetValues.length?[Math.min(...targetValues),Math.max(...targetValues)]:null;
  const regionPairs=validPairs.map(pair=>pair.map(id=>byId.get(id).region)),regionTransfer=regionPairs.length===2&&regionPairs.every(group=>group.every(Boolean)&&group[0]===group[1])&&regionPairs[0][0]!==regionPairs[1][0];
  return {targetFeature:targetFeature||null,targetGap:comparisons[0]?.targetGap??null,targetRange,targetSpread:targetValues.length>=2?targetRange[1]-targetRange[0]:null,knownTargetWorkCount:targetValues.length,otherFeatureGaps:comparisons[0]?.otherFeatureGaps||{},regionTransfer,pairBasis,design:!targetFeature||!comparisons.length?'breadth benchmark':regionTransfer?'two regional contrasts':'local contrast and references',pairs:comparisons,residualConfounds:comparisons.length?unique(comparisons.flatMap(c=>c.residualConfounds)):['No matched contrast was specified; these works vary on several dimensions.'],limits:['This is a planned comparison, not an observed preference pattern or a causal control.']};
}
function splitReserves(rows,seed){
  const remaining=[...rows],first=[],counts={era:new Map(),region:new Map(),tradition:new Map()};
  const expanded=rows.length>=70,target=Math.min(expanded?44:STIMULUS_TARGETS.secondBatchFirstRatings,Math.ceil(rows.length/2));
  while(first.length<target&&remaining.length){remaining.sort((a,b)=>{const score=r=>['era','region','tradition'].reduce((n,f)=>n+(r[f]?1/(1+(counts[f].get(r[f])||0)):0),0);return score(b)-score(a)||hash(seed+'|reserve|'+a.id)-hash(seed+'|reserve|'+b.id)||a.id.localeCompare(b.id);});const row=remaining.shift();first.push(row);for(const f of Object.keys(counts))increment(counts[f],row[f]);}
  const third=expanded?remaining.slice(0,44):remaining,after=expanded?remaining.slice(44):[];return {batch2:first.map(r=>r.id),batch3:third.map(r=>r.id),...(after.length?{batch4:after.map(r=>r.id)}:{})};
}
function reservationsFor(rows,notes,reservationPlan,history,batchIndex,seed){
  const available=new Set(rows.map(r=>r.id)),explicit=plain(reservationPlan)?reservationPlan:plain(notes?.reservePools)?notes.reservePools:null;
  let pools=explicit?{batch2:unique((Array.isArray(explicit.batch2)?explicit.batch2:[]).filter(id=>available.has(id))),batch3:unique((Array.isArray(explicit.batch3)?explicit.batch3:[]).filter(id=>available.has(id)))}:batchIndex===1?splitReserves(rows.filter(r=>!history.preferenceSeen.has(r.id)),seed):{batch2:[],batch3:[]};
  pools.batch3=pools.batch3.filter(id=>!pools.batch2.includes(id));const laterPool=unique((Array.isArray(explicit?.batch4)?explicit.batch4:pools.batch4||[]).filter(id=>available.has(id)&&!pools.batch2.includes(id)&&!pools.batch3.includes(id)));if(laterPool.length)pools.batch4=laterPool;
  const releases=new Map();for(const id of pools.batch2)releases.set(id,1);for(const id of pools.batch3)releases.set(id,2);for(const id of pools.batch4||[])releases.set(id,3);
  if(!explicit)for(const row of rows)if(Number.isInteger(row.note.reserveUntilBatch)&&row.note.reserveUntilBatch>0){releases.set(row.id,row.note.reserveUntilBatch);const field='batch'+(row.note.reserveUntilBatch+1);if(!pools[field])pools[field]=[];if(!pools[field].includes(row.id))pools[field].push(row.id);}
  return {pools,releases,explicit:!!explicit,scope:'first-preference-ratings',source:reservationPlan?'saved-reservation-plan':explicit?'editorial-reserve-pools':batchIndex===1?'remaining-first-ratings':'derived-after-first-batch'};
}

/** New unshown preference-panel proposals only. The caller owns saved session preservation. */
export function planStimulusPanels({works=[],rounds=[],answers={},batchIndex=0,seed='curated-study',adaptivePlan,curationNotes={},reservationPlan,panelCount=18,panelSizes=null,quotas={}}={}){
  const inputWorks=Array.isArray(works)?works:[],notes=plain(curationNotes)?curationNotes:{},rows=rowsFor(inputWorks,notes),byId=new Map(rows.map(r=>[r.id,r])),history=historyFor(rows,Array.isArray(rounds)?rounds:[],plain(answers)?answers:{});
  const count=Number.isInteger(panelCount)?Math.max(0,Math.min(18,panelCount)):18,batch=Number.isInteger(batchIndex)&&batchIndex>=0?batchIndex:0,configuredSizes=panelSizes||notes.panelSizes||(rows.length>=144?Array(18).fill(4):FIRST_PANEL_SIZES),sizes=Array.from({length:count},(_,i)=>Number.isInteger(configuredSizes?.[i])&&configuredSizes[i]>=2&&configuredSizes[i]<=4?configuredSizes[i]:FIRST_PANEL_SIZES[i]),reservations=reservationsFor(rows,notes,reservationPlan,history,batch,String(seed)),blocked=new Set(rows.filter(row=>(reservations.releases.get(row.id)||0)>batch&&!history.preferenceSeen.has(row.id)).map(row=>row.id));
  const warnings=[],rejectedBriefs=[],panels=Array(count).fill(null),uses=new Map(),selectedCounts={era:new Map(),region:new Map(),country:new Map(),tradition:new Map()},priorCounts=groupCounts(rows.filter(row=>history.preferenceSeen.has(row.id))),protectedWorks=new Set(),preserved=new Set();
  const recordRows=chosen=>{for(const row of chosen){increment(uses,row.id);for(const f of Object.keys(selectedCounts))increment(selectedCounts[f],row[f]);}};
  let originalAdaptive=null;
  if(batch){
    originalAdaptive=adaptivePlan||planAdaptivePanels({works:rows.filter(r=>!blocked.has(r.id)).map(r=>r.work),rounds:history.safeRounds,answers,batchIndex:batch,seed,panelCount:count,quotas:plain(quotas)?quotas:{}});
    const original=originalAdaptive?.panels;
    if(!Array.isArray(original)||original.length!==count)return {revision:STIMULUS_PLANNER_REVISION,status:'blocked',complete:false,panels:[],reservations:{...reservations.pools,scope:reservations.scope},coverage:{catalogueSize:rows.length,requestedPanelCount:count},audit:{warnings:['A complete original adaptive plan is required for this later batch.']},method:'No replacement adaptive evidence was invented.',limits:[...LIMITS]};
    for(let i=0;i<count;i++)if(original[i]?.role!=='exploration'){
      const p=original[i];if(!['repeat','recontextualization','challenge','probe','discovery'].includes(p?.role)||p.construct!=='preference'||!Array.isArray(p?.workIds)||p.workIds.length<2||p.workIds.length>4||new Set(p.workIds).size!==p.workIds.length||p.workIds.some(id=>!byId.has(id)))return {revision:STIMULUS_PLANNER_REVISION,status:'blocked',complete:false,panels:[],reservations:{...reservations.pools,scope:reservations.scope},coverage:{catalogueSize:rows.length,requestedPanelCount:count},audit:{warnings:['A protected adaptive comparison contains unavailable or ambiguous artwork identities or roles.']},method:'Protected evidence was not replaced.',limits:[...LIMITS]};
      panels[i]=structuredClone(p);preserved.add(i);p.workIds.forEach(id=>protectedWorks.add(id));recordRows(p.workIds.map(id=>byId.get(id)));
    }
  }
  const futureTargets={batch2:reservations.pools.batch2.length||STIMULUS_TARGETS.secondBatchFirstRatings,batch3:reservations.pools.batch3.length||STIMULUS_TARGETS.thirdBatchFirstRatings},totalSlots=sizes.reduce((a,b)=>a+b,0),firstRatingTarget=batch===0?totalSlots:batch===1?futureTargets.batch2:batch===2?futureTargets.batch3:Math.min(44,rows.filter(row=>!history.preferenceSeen.has(row.id)&&!blocked.has(row.id)).length),firstRatingChosen=new Set([...uses.keys()].filter(id=>!history.preferenceSeen.has(id))),jitter=(id,salt)=>hash(String(seed)+'|'+batch+'|'+salt+'|'+id)/4294967296;
  const benefit=row=>{
    let score=0;for(const f of Object.keys(selectedCounts))if(row[f])score+=(f==='region'?4:f==='era'?3:1.5)/(1+(selectedCounts[f].get(row[f])||0)+(priorCounts[f][row[f]]||0)*.25);
    score+=(row.landmark?.7:0)+(IMPORTANCE_WEIGHTS[row.importance]||0);
    const unrated=!history.preferenceSeen.has(row.id);if(unrated&&!firstRatingChosen.has(row.id))score+=firstRatingChosen.size<firstRatingTarget?8:1;else if(!unrated&&firstRatingChosen.size>=firstRatingTarget)score+=2;
    return score-(uses.get(row.id)||0)*5-(history.presentations.get(row.id)||0)*2;
  };
  function choosePanel(index,size){
    let candidates=rows.filter(row=>!blocked.has(row.id)&&!protectedWorks.has(row.id)&&(uses.get(row.id)||0)<(batch?2:1));
    const futureSlots=sizes.slice(index+1).reduce((total,value,j)=>total+(preserved.has(index+1+j)?0:value),0),requiredFresh=Math.max(0,Math.min(size,firstRatingTarget-firstRatingChosen.size-futureSlots));
    const fresh=row=>!history.preferenceSeen.has(row.id)&&!firstRatingChosen.has(row.id),freshCount=items=>items.filter(fresh).length;
    const canReachFresh=items=>!requiredFresh||freshCount(items)+Math.min(size-items.length,candidates.filter(row=>fresh(row)&&!items.some(other=>other.id===row.id)).length)>=requiredFresh;
    if(requiredFresh===size&&candidates.filter(fresh).length>=size)candidates=candidates.filter(fresh);
    const maximumLandmarks=index===0&&batch===0?4:(Number.isInteger(notes.maximumLandmarksPerPanel)?Math.max(1,Math.min(4,notes.maximumLandmarksPerPanel)):2),chosen=[],contrastPairs=[];
    if(index===0&&batch===0&&OPENING.every(id=>candidates.some(row=>row.id===id))&&size===4)return {chosen:OPENING.map(id=>byId.get(id)),target:null,contrastPairs,pairBasis:'benchmark',reason:'A fixed four-work benchmark with recognisable works from different periods and traditions.'};
    const target=TARGETS[index]||FEATURES[index%FEATURES.length],proposals=[];
    for(const [a,b] of pairs(candidates)){if(a.landmark+b.landmark>maximumLandmarks||avoidPair(a,b)||!canReachFresh([a,b]))continue;const d=pairDiagnostic(a,b,target);if(d.targetGap===null||d.targetGap<.3)continue;const shared=(a.region&&a.region===b.region ? .5:0)+(a.era&&a.era===b.era ? .5:0)+(a.subject&&a.subject===b.subject?1:0);proposals.push({pair:[a,b],d,score:d.targetGap*6-(d.meanOtherFeatureGap??1)*6+benefit(a)+benefit(b)+shared+jitter(pairKey(a.id,b.id),'pair-'+index)*.1});}
    proposals.sort((a,b)=>b.score-a.score||signature(a.pair.map(r=>r.id)).localeCompare(signature(b.pair.map(r=>r.id))));
    const first=proposals[0];if(first){chosen.push(...first.pair);contrastPairs.push(first.pair.map(r=>r.id));}
    if(size===4&&chosen.length===2){const control=proposals.filter(p=>canReachFresh([...chosen,...p.pair])&&p.pair.every(row=>!chosen.some(r=>r.id===row.id)&&chosen.every(r=>!avoidPair(row,r)))&&chosen.filter(r=>r.landmark).length+p.pair.filter(r=>r.landmark).length<=maximumLandmarks).map(p=>({...p,score:p.score+(p.pair[0].region&&p.pair[0].region===p.pair[1].region&&first.pair[0].region&&first.pair[0].region===first.pair[1].region&&p.pair[0].region!==first.pair[0].region?4:0)-Math.abs(p.d.targetGap-first.d.targetGap)*2})).sort((a,b)=>b.score-a.score)[0];if(control){chosen.push(...control.pair);contrastPairs.push(control.pair.map(r=>r.id));}}
    while(chosen.length<size){const needsFresh=requiredFresh-freshCount(chosen)>=size-chosen.length,rest=candidates.filter(row=>(!needsFresh||fresh(row))&&!chosen.some(r=>r.id===row.id)&&chosen.every(r=>!avoidPair(row,r))&&(!row.landmark||chosen.filter(r=>r.landmark).length<maximumLandmarks));rest.sort((a,b)=>benefit(b)-benefit(a)+jitter(b.id,'fill-'+index)*.01-jitter(a.id,'fill-'+index)*.01||a.id.localeCompare(b.id));if(!rest.length)break;chosen.push(rest[0]);}
    return {chosen,target:contrastPairs.length?target:null,contrastPairs,pairBasis:'algorithm-selected',reason:contrastPairs.length?'Compare a known annotated feature while recording the other differences; extend era, country and tradition coverage.':'Broaden represented eras and traditions; insufficient known annotations for a diagnostic feature contrast.'};
  }
  for(let i=0;i<count;i++){
    if(preserved.has(i))continue;
    const brief=batch===0?(Array.isArray(notes.proposedFirst18Panels)?notes.proposedFirst18Panels:[]).find(p=>p&&(p.panel??p.panelNumber)===i+1):null;
    let selected;
    if(brief){const workIds=brief.workIds,valid=Array.isArray(workIds)&&workIds.length===sizes[i]&&new Set(workIds).size===workIds.length&&workIds.every(id=>byId.has(id)&&!blocked.has(id)&&!uses.has(id))&&(i!==0||sizes[i]!==4||!OPENING.every(id=>byId.has(id))||signature(workIds)===signature(OPENING))&&(i===0||workIds.filter(id=>byId.get(id).landmark).length<=(notes.maximumLandmarksPerPanel||2))&&pairs(workIds).every(([a,b])=>!avoidPair(byId.get(a),byId.get(b)));if(valid){const chosen=workIds.map(id=>byId.get(id)),target=FEATURES.includes(brief.targetFeature)?brief.targetFeature:FEATURES.includes(brief.targetContrast)?brief.targetContrast:FEATURES.includes(brief.targetContrast?.feature)?brief.targetContrast.feature:null,declared=Array.isArray(brief.contrastPairs)?brief.contrastPairs.filter(pair=>Array.isArray(pair)&&pair.length===2&&new Set(pair).size===2&&pair.every(id=>workIds.includes(id))):[],contrastPairs=declared.length?[...new Map(declared.map(pair=>[signature(pair),[...pair]])).values()].slice(0,2):chosen.length>=2?[chosen.slice(0,2).map(r=>r.id),...(chosen.length===4?[chosen.slice(2,4).map(r=>r.id)]:[])]:[];selected={chosen,target,contrastPairs,pairBasis:declared.length?'editorial-declared':'descriptive-adjacent',reason:label(brief.primaryQuestion)||'Reviewed editorial comparison brief.',brief};}else rejectedBriefs.push({panel:i+1,reason:'The editorial brief conflicts with panel size, reservations, available identities, reuse, or the landmark cap.'});}
    selected||=choosePanel(i,sizes[i]);
    if(selected.chosen.length!==sizes[i]){
      const fallback=originalAdaptive?.panels?.[i];if(batch&&Array.isArray(fallback?.workIds)&&fallback.workIds.every(id=>byId.has(id))){panels[i]=structuredClone(fallback);preserved.add(i);recordRows(fallback.workIds.map(id=>byId.get(id)));warnings.push({panel:i+1,reason:'The original exploration comparison was retained because a safe curated replacement could not fill this slot.'});continue;}
      warnings.push({panel:i+1,reason:'The catalogue cannot fill this panel without violating reserved first ratings, landmark limits, or reuse limits.'});continue;
    }
    const diagnostic=panelDiagnostic(selected.chosen,selected.target,selected.contrastPairs,selected.pairBasis),ordered=i===0&&batch===0?selected.chosen:[...selected.chosen].sort((a,b)=>jitter(a.id,'order-'+i)-jitter(b.id,'order-'+i)||a.id.localeCompare(b.id));
    panels[i]={panelIndex:i,workIds:ordered.map(r=>r.id),construct:'preference',role:batch?'exploration':'discovery',selectionReason:selected.reason,evidenceRoundIds:[],plannerRevision:STIMULUS_PLANNER_REVISION,plannerDiagnostic:diagnostic,...(selected.brief?{editorialBrief:{...structuredClone(selected.brief),primaryQuestion:selected.brief.primaryQuestion||null,targetContrast:structuredClone(selected.brief.targetContrast??null),sharedGround:structuredClone(selected.brief.sharedGround??null),confounds:structuredClone(selected.brief.confounds??null)}}:{})};
    recordRows(selected.chosen);selected.chosen.filter(row=>!history.preferenceSeen.has(row.id)).forEach(row=>firstRatingChosen.add(row.id));
  }
  // Repair only the opening exploration panel after all other assignments are
  // fixed. This stops a skipped-but-shown final picture returning immediately
  // across a batch boundary without rescheduling protected evidence or panels.
  const boundarySource=batch?lastSpecificQuestion(history.safeRounds):null,boundaryAvoid=new Set(boundarySource?.workIds||[]),opening=panels[0];
  const boundarySpacing={policy:'last-specific-question-boundary-v1',scope:'Last specific definition in the supplied shown history, including skips and separate anchors; museum offered trays are excluded. This is a conservative spacing guard, not measured looking time.',sourceRoundId:boundarySource?.roundId||null,avoidWorkIds:[...boundaryAvoid],panelIndex:0,originalWorkIds:opening?[...opening.workIds]:[],status:!batch?'first-batch':!boundarySource?'no-specific-history':'clear',replacements:[],remainingOverlapIds:[],fallback:false,fallbackReason:null};
  if(batch&&boundarySource&&opening){
    const overlap=opening.workIds.filter(id=>boundaryAvoid.has(id));
    if(overlap.length&&(preserved.has(0)||opening.role!=='exploration')){
      boundarySpacing.status='protected-exception';boundarySpacing.remainingOverlapIds=overlap;boundarySpacing.fallback=true;boundarySpacing.fallbackReason='The first comparison is protected adaptive evidence; its exact identities were retained.';
    }else if(overlap.length){
      const repaired=[...opening.workIds];
      for(const oldId of overlap){
        const old=byId.get(oldId),remainingCounts=new Map(uses);remainingCounts.set(oldId,(remainingCounts.get(oldId)||0)-1);
        const losesFirstRating=!history.preferenceSeen.has(oldId)&&!remainingCounts.get(oldId),retained=repaired.filter(id=>id!==oldId).map(id=>byId.get(id));
        const alternatives=rows.filter(row=>!blocked.has(row.id)&&!protectedWorks.has(row.id)&&!boundaryAvoid.has(row.id)&&!repaired.includes(row.id)&&(uses.get(row.id)||0)<2&&retained.every(other=>!avoidPair(row,other))&&(!row.landmark||retained.filter(other=>other.landmark).length<(notes.maximumLandmarksPerPanel||2))&&(!history.preferenceSeen.has(row.id)&&!remainingCounts.get(row.id))===losesFirstRating);
        const score=row=>benefit(row)+(row.landmark===old.landmark?4:0)+(row.region&&row.region===old.region?1:0)-(pairDiagnostic(old,row,null).meanOtherFeatureGap??.5)+jitter(row.id,'boundary-replacement')*.01;
        alternatives.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
        if(!alternatives.length)continue;
        const replacement=alternatives[0];repaired[repaired.indexOf(oldId)]=replacement.id;uses.set(oldId,uses.get(oldId)-1);increment(uses,replacement.id);boundarySpacing.replacements.push({from:oldId,to:replacement.id});
      }
      if(boundarySpacing.replacements.length){
        const substituted=new Map(boundarySpacing.replacements.map(row=>[row.from,row.to])),diagnostic=opening.plannerDiagnostic,contrastPairs=(diagnostic?.pairs||[]).map(pair=>pair.workIds.map(id=>substituted.get(id)||id));
        panels[0]={...opening,workIds:repaired,selectionReason:opening.selectionReason+' The opening exploration avoids the last specific question when eligible alternatives preserve rating counts and other assignments.',plannerDiagnostic:panelDiagnostic(repaired.map(id=>byId.get(id)),diagnostic?.targetFeature||null,contrastPairs,diagnostic?.pairBasis||'algorithm-selected')};
      }
      boundarySpacing.remainingOverlapIds=repaired.filter(id=>boundaryAvoid.has(id));boundarySpacing.fallback=boundarySpacing.remainingOverlapIds.length>0;boundarySpacing.status=boundarySpacing.fallback?'fallback':'applied';boundarySpacing.fallbackReason=boundarySpacing.fallback?'The eligible catalogue cannot avoid every boundary image while retaining protected works, released rating pools, first-rating counts, landmark and use caps, and the other fixed panels.':null;
      if(boundarySpacing.fallback)warnings.push({panel:1,reason:boundarySpacing.fallbackReason});
    }
  }
  const actualPanels=panels.filter(Boolean),selectedIds=unique(actualPanels.flatMap(p=>p.workIds)),selectedRows=selectedIds.map(id=>byId.get(id));
  if(batch===0&&!reservations.explicit&&!reservations.releases.size)reservations.pools=splitReserves(rows.filter(row=>!selectedIds.includes(row.id)&&!history.preferenceSeen.has(row.id)),String(seed));
  Object.assign(futureTargets,{batch2:reservations.pools.batch2.length,batch3:reservations.pools.batch3.length,...(reservations.pools.batch4?{batch4:reservations.pools.batch4.length}:{})});
  const auditPairs=new Set(history.seenPairs),panelAudit=panels.flatMap((panel,index)=>{if(!panel)return [];const chosen=panel.workIds.map(id=>byId.get(id)),pairKeys=pairs(panel.workIds).map(([a,b])=>pairKey(a,b)),newPairCount=pairKeys.filter(k=>!auditPairs.has(k)).length;pairKeys.forEach(k=>auditPairs.add(k));return [{panel:index+1,role:panel.role,preservedAdaptive:preserved.has(index),workIds:[...panel.workIds],landmarkCount:chosen.filter(r=>r.landmark).length,firstRatingWorkIds:chosen.filter(r=>!history.preferenceSeen.has(r.id)).map(r=>r.id),previouslyPresentedWorkIds:chosen.filter(r=>history.presentations.has(r.id)).map(r=>r.id),unknownExposureIds:chosen.filter(r=>history.unknownExposure.has(r.id)).map(r=>r.id),groups:groupCounts(chosen),newPairCount,existingPairCount:pairKeys.length-newPairCount,diagnostic:panel.plannerDiagnostic||panelDiagnostic(chosen,panel.provisionalHypothesis?.feature||null,panel.workIds.length===2?[[...panel.workIds]]:[]),sourceUrls:unique(chosen.flatMap(r=>r.sourceUrls))}];});
  const availableGroups=groupCounts(rows),achievedGroups=groupCounts(selectedRows),minimumTargets=Object.fromEntries([['era',STIMULUS_TARGETS.eraCount],['region',STIMULUS_TARGETS.regionCount],['country',STIMULUS_TARGETS.countryCount],['tradition',STIMULUS_TARGETS.traditionCount]].map(([field,target])=>[field,{requested:target,available:Object.keys(availableGroups[field]).length,achieved:Object.keys(achievedGroups[field]).length,met:Object.keys(achievedGroups[field]).length>=target}]));
  const reservedOverrideIds=selectedIds.filter(id=>blocked.has(id)),remainingUnrated=rows.filter(row=>!history.preferenceSeen.has(row.id)&&!selectedIds.includes(row.id)).map(row=>row.id),firstRatingAvailable=rows.filter(row=>!history.preferenceSeen.has(row.id)&&(!blocked.has(row.id)||reservedOverrideIds.includes(row.id))).length,selectedSlots=actualPanels.reduce((n,p)=>n+p.workIds.length,0);
  const protectedFirstRatingWorkIds=unique([...preserved].flatMap(index=>panels[index]?.workIds||[])).filter(id=>!history.preferenceSeen.has(id)),firstRatingSlotCapacity=protectedFirstRatingWorkIds.length+panels.reduce((total,panel,index)=>total+(!panel||preserved.has(index)?0:panel.workIds.length),0);
  if(batch&&selectedIds.filter(id=>!history.preferenceSeen.has(id)).length<firstRatingTarget)warnings.push({reason:'The completed panel plan did not meet its distinct first-rating target under the retained comparison constraints.',target:firstRatingTarget,actual:selectedIds.filter(id=>!history.preferenceSeen.has(id)).length});
  return {revision:STIMULUS_PLANNER_REVISION,status:actualPanels.length===count?'complete':'partial',complete:actualPanels.length===count,panels:actualPanels,reservations:{...reservations.pools,scope:reservations.scope,source:reservations.source,alreadyRatedIds:unique(Object.values(reservations.pools).flat().filter(id=>history.preferenceSeen.has(id))),protectedAdaptiveOverrides:reservedOverrideIds},
    coverage:{...(originalAdaptive?.coverage||{}),catalogueSize:rows.length,excludedCatalogueEntries:inputWorks.length-rows.length,requestedPanelCount:count,selectedPanelCount:actualPanels.length,requestedSlots:totalSlots,selectedSlots,selectedWorkIds:selectedIds,uniqueWorkCount:selectedIds.length,firstRatingWorkIds:selectedIds.filter(id=>!history.preferenceSeen.has(id)),firstRatingTarget,firstRatingAvailable,firstRatingSlotCapacity,protectedFirstRatingWorkIds,firstRatingTargetFeasible:firstRatingAvailable>=firstRatingTarget&&firstRatingSlotCapacity>=firstRatingTarget,remainingUnratedIds:remainingUnrated,firstRatingTargetMet:selectedIds.filter(id=>!history.preferenceSeen.has(id)).length>=firstRatingTarget,actualSessionUnpresentedIds:selectedIds.filter(id=>!history.presentations.has(id)&&!history.unknownExposure.has(id)),exposureUnknownIds:selectedIds.filter(id=>history.unknownExposure.has(id)),exposureBefore:Object.fromEntries(rows.map(row=>[row.id,history.presentations.get(row.id)||0])),exposureUnknownWorkIds:[...history.unknownExposure],exposureUnknownRoundIds:history.unknownRoundIds,eligiblePreferenceRoundIds:history.eligibleRoundIds,distinctPreferenceSetCount:history.eligibleSets.size,preservedAdaptivePanels:preserved.size,plannedUses:Object.fromEntries(uses),availableGroups,achievedGroups,minimumTargets,unknownMetadataCounts:Object.fromEntries(['era','region','country','tradition'].map(f=>[f,selectedRows.filter(row=>!row[f]).length])),roleCounts:Object.fromEntries(unique(actualPanels.map(p=>p.role)).map(role=>[role,actualPanels.filter(p=>p.role===role).length])),actualRoles:Object.fromEntries(['exploration','repeat','recontextualization','challenge'].map(role=>[role,actualPanels.filter(p=>p.role===role).length])),explorationShare:actualPanels.length?actualPanels.filter(p=>p.role==='exploration').length/actualPanels.length:0,futureFirstRatingTargets:futureTargets},
    audit:{panels:panelAudit,rejectedBriefs,warnings,boundarySpacing,annotationMatchedContrasts:panelAudit.flatMap(p=>p.diagnostic.pairs).filter(p=>p.annotationMatched).length,annotationDiagnosticGaps:panelAudit.filter(p=>p.diagnostic.targetFeature&&(p.diagnostic.targetSpread===null||p.diagnostic.targetSpread<.3)).map(p=>({panel:p.panel,targetFeature:p.diagnostic.targetFeature,largestRecordedGap:p.diagnostic.targetSpread,reason:'The declared concept may be useful, but these recorded annotations do not supply a clear numeric feature contrast across this set.'})),regionalTransferPanels:panelAudit.filter(p=>p.diagnostic.regionTransfer).map(p=>p.panel),missingCoverage:Object.entries(minimumTargets).filter(([,v])=>!v.met).map(([dimension,v])=>({dimension,requested:v.requested,achieved:v.achieved,available:v.available})),shortageReason:actualPanels.length<count?'The available catalogue and protected comparisons could not meet every requested panel constraint.':null},
    method:'Seeded editorial briefs, recorded annotation contrasts, explicit coverage balancing, and protected adaptive comparisons. No global preference scores or optimal-information claim.',limits:[...LIMITS]};
}
