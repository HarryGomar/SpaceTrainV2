import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
import {resolveArtworkAttributes} from './artwork-quality-review.mjs';
import {collectTastePatternSources} from './taste-axes.mjs';
import {withContinuousPreference,isContinuousPreferenceRound,CONTINUOUS_PROTOCOL} from './continuous-preference.mjs';
import {sameOrdinalArtworkIdentity,artworkPreviewHashes} from './ordinal-preference-graph.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {compareAppealControls} from './appeal-investigations.mjs';

export const TASTE_INQUIRY_PROTOCOL='conditional-taste-inquiry-v1';
const keys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);
const unique=a=>[...new Set(a)];
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const clamp=n=>Math.max(0,Math.min(100,n));
const title=k=>ARTWORK_ATTRIBUTE_DEFINITIONS[k].label.toLowerCase();
const short=w=>w.shortTitle||w.title;
const artist=w=>w.artistKnown!==false&&w.artist&&!/unknown|anonymous|unidentified/i.test(w.artist)?w.artist.trim().toLowerCase():null;
const pairKey=(a,b)=>JSON.stringify([a,b].sort());
const sign=(n,gap=10)=>Math.abs(n)<gap?0:Math.sign(n);
const identity=w=>({id:w.id,sourceUrl:w.sourceUrl,image:w.image,...(artworkPreviewHashes(w).length?{sha256:artworkPreviewHashes(w)[0]}:{})});
const baseSpecs=keys.map(driver=>({id:driver,driver,context:null}));
// These are fixed questions, not interactions fitted until a story looks good.
export const CONDITIONAL_TASTE_QUESTIONS=Object.freeze([
  ['depth-in-landscapes','layered-space','landscape',1],
  ['depth-beyond-landscapes','layered-space','landscape',0],
  ['marks-in-landscapes','visible-paint-marks','landscape',1],
  ['open-landscapes','open-expanse','landscape',1],
  ['detail-in-stories','material-detail','narrative-detail',1],
  ['rhythm-with-distortion','pattern-rhythm','expressive-distortion',1],
  ['geometry-without-landscape','geometric-structure','landscape',0],
  ['light-around-figures','dramatic-light','intimate-figures',1]
].map(([id,driver,context,contextValue])=>Object.freeze({id,driver,context,contextValue})));
const specs=[...baseSpecs,...CONDITIONAL_TASTE_QUESTIONS];
const inContext=(spec,v)=>!spec.context||v?.[spec.context]===spec.contextValue;
const name=spec=>title(spec.driver)+(spec.context?` ${spec.contextValue?'with':'without'} ${title(spec.context)}`:' across subjects');
const score=(spec,v)=>v?.[spec.driver]===null||v?.[spec.driver]===undefined||!inContext(spec,v)?null:spec.direction*(v[spec.driver]-.5)*2;
const prediction=(spec,a,b)=>{const x=score(spec,a),y=score(spec,b);return x===null||y===null?null:sign(x-y,.5);};

function reviewValues(works,reviews){
  return new Map(works.map(work=>{
    const review=resolveArtworkAttributes(work,{annotationReviews:reviews,currentWorks:works});
    return [work.id,{work,review,artist:artist(work),values:Object.fromEntries(keys.map(k=>[k,review?.attributes[k]?.status==='present'?1:review?.attributes[k]?.status==='absent'?0:null]))}];
  }));
}

function sourceState({works=[],rounds=[],answers={},annotationReviews=REVIEWS}={}){
  const byId=new Map(works.map(w=>[w.id,w]));
  const history=rounds.filter(r=>r.works?.every(w=>sameOrdinalArtworkIdentity(w,byId.get(w.id),{requireSource:true})));
  const sources=collectTastePatternSources({works,rounds:history,answers});
  const scope=sources.preferenceScopes.find(s=>s.channel==='personal-appeal');
  return {history,sources,sets:scope?.sets||[],checks:scope?.checks||[],rows:reviewValues(works,annotationReviews)};
}

function groupsFor(spec,sets,rows,{omitWorkId,equalVotes=false}={}){
  return sets.flatMap(set=>{
    const items=set.items.filter(i=>i.work.id!==omitWorkId&&inContext(spec,rows.get(i.work.id)?.values));
    const yes=items.filter(i=>rows.get(i.work.id)?.values[spec.driver]===1),no=items.filter(i=>rows.get(i.work.id)?.values[spec.driver]===0);
    if(!yes.length||!no.length)return [];
    const gap=mean(yes.map(i=>i.value))-mean(no.map(i=>i.value));
    const ordered=[...yes.flatMap(a=>no.map(b=>({a,b,gap:a.value-b.value})))].sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
    return [{roundId:set.entry.round.id,gap,vote:sign(gap),weight:equalVotes?sign(gap):Math.max(-1,Math.min(1,gap/40)),workIds:items.map(i=>i.work.id),example:{workIds:[ordered[0].a.work.id,ordered[0].b.work.id],values:[ordered[0].a.value,ordered[0].b.value]},artists:unique(items.map(i=>artist(i.work)).filter(Boolean))}];
  });
}

function summarize(spec,groups){
  const direction=sign(mean(groups.map(g=>g.weight)),.08),support=groups.filter(g=>g.vote===direction&&direction),counter=groups.filter(g=>g.vote===-direction&&direction),close=groups.filter(g=>!g.vote);
  const preferredArtists=unique(support.flatMap(g=>{const high=g.example.values[0]>g.example.values[1]?0:1;return [g.example.workIds[high]];}));
  return {...spec,direction,title:(direction<0?'Less ':'')+name(spec),groups,support,counter,close,independentSets:groups.length,supportingSets:support.length,opposingSets:counter.length,artistIds:preferredArtists,weight:Math.abs(mean(groups.map(g=>g.weight))),recurring:support.length>=3&&support.length>=2*(counter.length+close.length)};
}

/** One fresh artwork contributes once. Selected checks never become discovery. */
export function buildTasteInquiry(options={}){
  const state=options.state||sourceState(options),{sets,rows}=state;
  const candidates=specs.map(spec=>summarize(spec,groupsFor(spec,sets,rows))).filter(c=>c.direction&&c.supportingSets);
  const checks=readTasteInquiryChecks({...options,state});
  for(const c of candidates){
    c.artistCount=unique(c.artistIds.map(id=>rows.get(id)?.artist).filter(Boolean)).length;
    c.recurring=c.recurring&&c.artistCount>=3;
    c.prospectiveChecks=checks.filter(check=>!check.sourceChanged&&check.predictions.some(p=>p.id===c.id&&p.direction===c.direction));
    c.confirmations=c.prospectiveChecks.filter(check=>check.outcome==='separated'&&check.predictions.find(p=>p.id===c.id).prediction===check.actual);
    c.reversals=c.prospectiveChecks.filter(check=>check.outcome==='separated'&&check.predictions.find(p=>p.id===c.id).prediction!==check.actual);
    c.summaryEligible=c.recurring&&c.confirmations.some(check=>check.newArtistTransfer)&&!c.reversals.length;
    c.status=c.reversals.length?'mixed':c.summaryEligible?'supported':'provisional';
    c.rivals=candidates.filter(other=>other.id!==c.id&&(other.driver===c.driver||other.support.some(g=>c.support.some(h=>g.roundId===h.roundId)))).sort((a,b)=>b.supportingSets-a.supportingSets).slice(0,4).map(other=>({id:other.id,title:other.title,direction:other.direction}));
    c.unresolved=['Artist, handling, subject and prior familiarity can vary together.','The annotations describe the image; they do not identify what caught your eye.'];
    c.boundary=c.context?`This account concerns works ${c.contextValue?'with':'without'} ${title(c.context)}. Other subjects need their own comparison.`:'A contrast in this sample does not apply to every painting with the same quality.';
    const outside=c.context?groupsFor({...c,contextValue:1-c.contextValue},sets,rows):[];
    c.outsideContext={sets:outside.length,agreeing:outside.filter(g=>g.vote===c.direction).length,opposing:outside.filter(g=>g.vote===-c.direction).length,open:outside.filter(g=>!g.vote).length};
  }
  candidates.sort((a,b)=>Number(b.summaryEligible)-Number(a.summaryEligible)||Number(a.status==='mixed')-Number(b.status==='mixed')||b.supportingSets-a.supportingSets||b.weight-a.weight||a.id.localeCompare(b.id));
  return {protocol:TASTE_INQUIRY_PROTOCOL,candidates,checks,discoverySets:sets.length,discoveryWorkIds:unique(sets.flatMap(s=>s.items.map(i=>i.work.id))),limits:['These reporting gates and comparison costs are editorial starting rules, not probabilities.','Discovery associations and selected prospective checks have separate denominators.']};
}

export function qualifyAppealPatterns(patterns,inquiry){
  return patterns.map(pattern=>{
    if(pattern.channel!=='personal-appeal')return pattern;
    const candidate=inquiry.candidates.find(c=>c.id===pattern.qualityKey&&c.direction===pattern.direction);
    const passed=candidate?.summaryEligible||pattern.investigation?.status==='transferred-once';
    if(passed&&!candidate?.reversals.length)return pattern;
    return {...pattern,status:candidate?.status==='mixed'?'mixed':'provisional',summaryEligible:false,overallEligible:false,prospectiveStatus:candidate?.status==='mixed'?'challenged':'not-yet-established'};
  });
}

// A small ridge regression supplies a global predictive benchmark. It cannot
// turn its correlated coefficients into reasons for a participant's choice.
export function fitGlobalAppealBaseline({sets=[],rows}={}){
  const items=sets.flatMap(set=>set.items.map(item=>({...item,weight:1/set.items.length})));
  const means=keys.map(k=>{const known=items.filter(i=>rows.get(i.work.id)?.values[k]!==null),weight=known.reduce((s,i)=>s+i.weight,0);return weight?known.reduce((s,i)=>s+i.weight*rows.get(i.work.id).values[k],0)/weight:0;});
  const vector=id=>keys.map((k,j)=>(rows.get(id)?.values[k]??means[j])-means[j]);
  const total=items.reduce((s,i)=>s+i.weight,0),intercept=total?items.reduce((s,i)=>s+i.value*i.weight,0)/total:50;
  const beta=keys.map(()=>0),vectors=items.map(i=>vector(i.work.id));
  for(let pass=0;pass<40;pass++)for(let j=0;j<keys.length;j++){
    let numerator=0,denominator=4;
    items.forEach((i,n)=>{const x=vectors[n],other=x.reduce((s,v,k)=>s+(k===j?0:v*beta[k]),0);numerator+=i.weight*x[j]*(i.value-intercept-other);denominator+=i.weight*x[j]*x[j];});
    beta[j]=numerator/denominator;
  }
  return {kind:'set-weighted-ridge',intercept,keys:[...keys],means,beta,trainingSets:sets.length,predict:id=>clamp(intercept+vector(id).reduce((s,v,j)=>s+v*beta[j],0))};
}

function localAppealPrediction(id,state){
  const target=state.rows.get(id),neighbours=state.sets.flatMap(s=>s.items).flatMap(item=>{
    const row=state.rows.get(item.work.id),known=keys.filter(k=>target?.values[k]!==null&&row?.values[k]!==null);
    return known.length>=8?[{value:item.value,artist:row.artist,distance:mean(known.map(k=>Math.abs(target.values[k]-row.values[k])))}]:[];
  }).sort((a,b)=>a.distance-b.distance),used=new Set(),chosen=[];
  for(const n of neighbours){if(!n.artist||used.has(n.artist))continue;used.add(n.artist);chosen.push(n);if(chosen.length===3)break;}
  return chosen.length>=2?mean(chosen.map(n=>n.value)):null;
}

function trainingSnapshot(state,answers){
  return state.sets.map(set=>({roundId:set.entry.round.id,workIds:set.entry.round.works.map(w=>w.id),works:set.entry.round.works.map(identity),positions:structuredClone(answers[set.entry.round.id].positions)}));
}
function trainingChanged(test,state,answers){
  const sources=new Map(state.sources.entries.map(entry=>[entry.round.id,entry]));
  if(!Array.isArray(test.training)||test.training.length<3)return true;
  return test.training.some(t=>{const entry=sources.get(t.roundId);return !entry||!state.sets.some(s=>s.entry.round.id===t.roundId)||!isContinuousPreferenceRound(entry.round)||Object.keys(t.positions||{}).length!==entry.round.works.length||entry.round.works.some(w=>t.positions[w.id]!==answers[t.roundId]?.positions[w.id])||!Array.isArray(t.works)||JSON.stringify(t.workIds)!==JSON.stringify(entry.round.works.map(w=>w.id))||t.works.some(w=>!entry.round.works.some(current=>sameOrdinalArtworkIdentity(w,current,{requireSource:true})));});
}

/** Freeze only at presentation time. These are ordinary curated discoveries,
 * held out from training, not a random sample of the collection. */
export function freezeAppealForecast({round,works,rounds=[],answers={},annotationReviews=REVIEWS}={}){
  if(!isContinuousPreferenceRound(round)||round.evidence?.appealForecast||round.evidence?.role!=='discovery'||answers[round.id])return round;
  const state=sourceState({works,rounds,answers,annotationReviews});
  if(state.sets.length<3)return round;
  const batch=round.evidence?.batchIndex??Math.floor(((Number(round.id?.slice(8))||1)-1)/50);
  if(rounds.filter(r=>r.evidence?.appealForecast&&r.evidence.appealForecast.batchIndex===batch).length>=2)return round;
  const seen=new Set(state.sources.entries.filter(e=>isContinuousPreferenceRound(e.round)).flatMap(e=>e.round.works.map(w=>w.id)));
  if(round.works.some(w=>seen.has(w.id)))return round;
  const baseline=fitGlobalAppealBaseline(state);
  const conditionalForecasts=buildTasteInquiry({works,rounds,answers,annotationReviews,state}).candidates.filter(c=>c.recurring).slice(0,3).map(c=>({id:c.id,direction:c.direction,scores:Object.fromEntries(round.works.map(w=>[w.id,score(c,state.rows.get(w.id)?.values)]))}));
  return {...round,evidence:{...round.evidence,appealForecast:{protocol:TASTE_INQUIRY_PROTOCOL,design:'ordinary-curated-discovery',batchIndex:batch,frozenBeforeAnswer:true,training:trainingSnapshot(state,answers),predictions:Object.fromEntries(round.works.map(w=>[w.id,baseline.predict(w.id)])),localPredictions:Object.fromEntries(round.works.map(w=>[w.id,localAppealPrediction(w.id,state)])),conditionalForecasts,meanPrediction:baseline.intercept,model:{kind:baseline.kind,keys:baseline.keys,means:baseline.means,beta:baseline.beta},targetWorks:round.works.map(identity)}}};
}

export function evaluateAppealForecasts(options={}){
  const state=sourceState(options),records=[];
  for(const {round,answer}of state.sources.entries){
    const f=round.evidence?.appealForecast;
    if(f?.protocol!==TASTE_INQUIRY_PROTOCOL||!f.frozenBeforeAnswer||!isContinuousPreferenceRound(round)||trainingChanged(f,state,options.answers||{}))continue;
    if(JSON.stringify(f.targetWorks?.map(w=>w.id))!==JSON.stringify(round.works.map(w=>w.id))||!f.targetWorks?.every(w=>round.works.some(current=>sameOrdinalArtworkIdentity(w,current,{requireSource:true}))))continue;
    if(f.training.some(t=>state.sources.entries.find(e=>e.round.id===t.roundId)?.index>=state.sources.entries.find(e=>e.round.id===round.id)?.index)||f.training.some(t=>t.workIds.some(id=>round.works.some(w=>w.id===id))))continue;
    const values=round.works.map(w=>({workId:w.id,actual:answer.positions[w.id],predicted:f.predictions[w.id]}));
    if(values.some(v=>!Number.isFinite(v.predicted)))continue;
    const pairs=values.flatMap((a,i)=>values.slice(i+1).map(b=>({actual:sign(a.actual-b.actual),predicted:sign(a.predicted-b.predicted)})));
    const localValues=values.filter(v=>Number.isFinite(f.localPredictions?.[v.workId]));
    const conditional=(f.conditionalForecasts||[]).map(c=>{
      const pairs=values.flatMap((a,i)=>values.slice(i+1).flatMap(b=>Number.isFinite(c.scores[a.workId])&&Number.isFinite(c.scores[b.workId])?[{workIds:[a.workId,b.workId],actual:sign(a.actual-b.actual),predicted:sign(c.scores[a.workId]-c.scores[b.workId],.5)}]:[]));
      return {id:c.id,direction:c.direction,knownPairs:pairs.length,pairs,setAgreement:pairs.length?mean(pairs.map(p=>Number(p.actual===p.predicted))):null};
    });
    records.push({roundId:round.id,design:f.design,values,mae:mean(values.map(v=>Math.abs(v.actual-v.predicted))),localMae:localValues.length===values.length?mean(localValues.map(v=>Math.abs(v.actual-f.localPredictions[v.workId]))):null,meanOnlyMae:mean(values.map(v=>Math.abs(v.actual-f.meanPrediction))),pairs,conditional,independentSetCount:1});
  }
  const local=records.filter(r=>r.localMae!==null);
  const conditionalIds=unique(records.flatMap(r=>r.conditional.map(c=>c.id))),conditional=conditionalIds.map(id=>{const sets=records.flatMap(r=>r.conditional.filter(c=>c.id===id&&c.setAgreement!==null));return {id,sets:sets.length,meanSetAgreement:mean(sets.map(s=>s.setAgreement))};});
  return {records,sets:records.length,mae:records.length?mean(records.map(r=>r.mae)):null,localSets:local.length,localMae:local.length?mean(local.map(r=>r.localMae)):null,meanOnlyMae:records.length?mean(records.map(r=>r.meanOnlyMae)):null,conditional,scope:'Prospective error on ordinary curated discovery sets. Not collection-wide accuracy; no calibration claim.'};
}

/** Seek a disagreement that is worth the cost of two paintings. If none is
 * eligible, the caller spends the flexible slot on independent discovery. */
export function selectTasteInquiry({id,works=[],rounds=[],answers={},candidateIds,avoidIds=[],mode='transfer',annotationReviews=REVIEWS}={}){
  const options={works,rounds,answers,annotationReviews},state=sourceState(options),model=buildTasteInquiry({...options,state});
  if(state.sets.length<3)return null;
  const allowed=new Set(candidateIds||works.map(w=>w.id)),avoid=new Set(avoidIds),rated=new Set(state.sources.entries.filter(e=>isContinuousPreferenceRound(e.round)).flatMap(e=>e.round.works.map(w=>w.id)));
  const seenPairs=new Set(rounds.filter(r=>isContinuousPreferenceRound(r)).flatMap(r=>r.works.flatMap((w,i)=>r.works.slice(i+1).map(v=>pairKey(w.id,v.id)))));
  const used=new Set(rounds.flatMap(r=>r.evidence?.tasteInquiry?[r.evidence.tasteInquiry.focus]:[]));
  const hypotheses=model.candidates.filter(c=>c.supportingSets>=2&&c.supportingSets>c.opposingSets).slice(0,10);
  const pool=[...state.rows.values()].filter(r=>r.review&&r.artist&&allowed.has(r.work.id)&&!avoid.has(r.work.id)&&isStudyEligibleArtwork(r.work));
  const shortlist=pool.sort((a,b)=>Number(rated.has(a.work.id))-Number(rated.has(b.work.id))||a.work.id.localeCompare(b.work.id)).slice(0,160);
  const trainingArtists=new Set(state.sets.flatMap(s=>s.items.map(i=>artist(i.work)).filter(Boolean)));
  let best=null;
  for(let h=0;h<hypotheses.length;h++)for(let j=h+1;j<hypotheses.length;j++){
    const rivals=[hypotheses[h],hypotheses[j]];
    if(!rivals.some(r=>r.recurring))continue;
    const focus=mode+':'+rivals.map(r=>r.id+':'+r.direction).sort().join('|');
    if(used.has(focus))continue;
    for(let a=0;a<shortlist.length;a++)for(let b=a+1;b<shortlist.length;b++){
      const left=shortlist[a],right=shortlist[b],workIds=[left.work.id,right.work.id];
      if(seenPairs.has(pairKey(...workIds))||workIds.every(id=>rated.has(id)))continue;
      if(mode==='within-artist'?left.artist!==right.artist:left.artist===right.artist)continue;
      if(mode!=='within-artist'&&workIds.some(id=>rated.has(id)))continue;
      const predictions=rivals.map(r=>prediction(r,left.values,right.values));
      // Context differences have no measured subject intercept. They cannot
      // settle a driver effect by treating an out-of-context work as neutral.
      if(rivals.some(r=>r.context&&(!inContext(r,left.values)||!inContext(r,right.values))))continue;
      if(predictions.includes(null)||predictions[0]===predictions[1])continue;
      const drivers=unique(rivals.flatMap(r=>[r.driver,r.context].filter(Boolean))),controls=compareAppealControls(left,right,drivers);
      if(!controls.usable)continue;
      const knownSubjects=left.values.landscape!==null&&right.values.landscape!==null;
      const sameSubject=knownSubjects&&left.values.landscape===right.values.landscape;
      const newArtists=!trainingArtists.has(left.artist)&&!trainingArtists.has(right.artist);
      const cost=2+Number(!sameSubject)+controls.differences.length*.2;
      const utility=(rivals[0].supportingSets+rivals[1].supportingSets+Number(newArtists)*3+Number(sameSubject)*2+Number(predictions[0]*predictions[1]===-1)*2)/cost;
      if(!best||utility>best.utility)best={rivals,focus,left,right,predictions,controls,newArtists,utility,cost,sameSubject};
    }
  }
  if(!best)return null;
  const targetWorks=[best.left.work,best.right.work],baseline=fitGlobalAppealBaseline(state);
  const test={protocol:TASTE_INQUIRY_PROTOCOL,focus:best.focus,mode,frozenBeforeAnswer:true,training:trainingSnapshot(state,answers),predictions:best.rivals.map((r,i)=>({id:r.id,driver:r.driver,context:r.context,contextValue:r.contextValue,direction:r.direction,title:r.title,prediction:best.predictions[i],supportingRoundIds:r.support.map(g=>g.roundId)})),targetWorks:structuredClone(targetWorks),targetValues:Object.fromEntries([best.left,best.right].map(r=>[r.work.id,r.values])),controls:best.controls,newArtistTransfer:best.newArtists&&mode!=='within-artist',sameSubject:best.sameSubject,cost:best.cost,selectionScore:best.utility,baselinePredictions:Object.fromEntries(targetWorks.map(w=>[w.id,baseline.predict(w.id)])),previouslyRatedIds:targetWorks.filter(w=>rated.has(w.id)).map(w=>w.id)};
  const reason=`Compare ${targetWorks.map(short).join(' and ')} to separate ${best.rivals.map(r=>r.title).join(' from ')}.`;
  return {round:withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:targetWorks,evidence:{construct:'preference',family:'individual-choice',role:'probe',unconditional:true,tasteInquiry:test}}),focus:best.focus,reason,sourceRoundIds:unique(best.rivals.flatMap(r=>r.support.map(g=>g.roundId)))};
}

export function readTasteInquiryChecks(options={}){
  const state=options.state||sourceState(options),answers=options.answers||{},out=[];
  for(const {round,answer}of state.sources.entries){
    const t=round.evidence?.tasteInquiry;
    if(t?.protocol!==TASTE_INQUIRY_PROTOCOL||!t.frozenBeforeAnswer||!isContinuousPreferenceRound(round)||t.predictions?.length!==2||round.works.length!==2||!Array.isArray(t.training)||!t.targetValues)continue;
    if(round.evidence.role!=='probe'||JSON.stringify(t.targetWorks?.map(w=>w.id))!==JSON.stringify(round.works.map(w=>w.id))||!t.targetWorks?.every(w=>round.works.some(current=>sameOrdinalArtworkIdentity(w,current,{requireSource:true}))))continue;
    if(t.controls?.usable!==true||t.training.some(source=>state.sources.entries.find(e=>e.round.id===source.roundId)?.index>=state.sources.entries.find(e=>e.round.id===round.id)?.index))continue;
    if(t.predictions.some(p=>!specs.some(spec=>spec.id===p.id&&spec.driver===p.driver&&spec.context===p.context&&spec.contextValue===p.contextValue)||![1,-1].includes(p.direction)||prediction(p,t.targetValues[round.works[0].id],t.targetValues[round.works[1].id])!==p.prediction)||t.predictions[0].prediction===t.predictions[1].prediction)continue;
    const workIds=round.works.map(w=>w.id),values=workIds.map(id=>answer.positions[id]),signedGap=values[0]-values[1],actual=sign(signedGap);
    const index=state.sources.entries.find(e=>e.round.id===round.id).index,priorRated=new Set(state.sources.entries.filter(e=>e.index<index&&isContinuousPreferenceRound(e.round)).flatMap(e=>e.round.works.map(w=>w.id)));
    const targetArtists=round.works.map(artist),trainingArtists=t.training.flatMap(source=>state.sources.entries.find(e=>e.round.id===source.roundId)?.round.works.map(artist).filter(Boolean)||[]);
    const newArtistTransfer=t.mode==='transfer'&&targetArtists.every(a=>a&&!trainingArtists.includes(a))&&targetArtists[0]!==targetArtists[1]&&workIds.every(id=>!priorRated.has(id));
    const contextEligible=t.predictions.every(p=>!p.context||workIds.every(id=>inContext(p,t.targetValues[id])));
    out.push({...t,newArtistTransfer:newArtistTransfer&&contextEligible,roundId:round.id,workIds,values,signedGap,actual,outcome:actual?'separated':'close',sourceChanged:trainingChanged(t,state,answers),independentDiscoveryVote:false});
  }
  return out;
}

export function inquiryObservations(inquiry,works){
  const byId=new Map(works.map(w=>[w.id,w]));
  const selected=inquiry.candidates.slice(0,2),weakened=inquiry.candidates.find(c=>c.status==='mixed'&&!selected.includes(c));
  if(weakened)selected.push(weakened);else if(inquiry.candidates[2])selected.push(inquiry.candidates[2]);
  return selected.map(c=>{
    const example=c.support[0]?.example;if(!example)return null;
    const preferred=example.values[0]>example.values[1]?0:1,foil=1-preferred;
    const evidence=g=>({roundId:g.roundId,label:'Captured personal appeal',workIds:g.example.workIds,detail:g.example.workIds.map((id,i)=>`${short(byId.get(id))}: ${g.example.values[i]}`).join('; '),responseGap:Math.abs(g.gap)});
    const latest=c.reversals.at(-1)||c.confirmations.at(-1),names=example.workIds.map(id=>short(byId.get(id)));
    const text=`${names[preferred]} appealed more than ${names[foil]} (${example.values[preferred]} and ${example.values[foil]}). ${c.title} is ${c.summaryEligible?'a recurring distinction that also survived a new-artist comparison':c.reversals.length?'an earlier explanation weakened by a later comparison':'a possibility to investigate'}. `+(latest?`${latest.workIds.map(id=>short(byId.get(id))).join(' and ')} ${c.reversals.length?'favoured a different prediction':'provided a prospective check'} (${latest.values.join(' and ')}). `:'')+c.boundary+(c.context&&c.outsideContext.opposing?` Outside this context, ${c.outsideContext.opposing} discovery ${c.outsideContext.opposing===1?'set went':'sets went'} the other way.`:'');
    const counterId=c.counter[0]?.example.workIds[c.direction>0?0:1]||c.reversals.at(-1)?.workIds[0],displayWorkIds=unique([example.workIds[preferred],example.workIds[foil],counterId].filter(Boolean));
    return {id:'inquiry-'+c.id,module:'conditional-appeal',title:c.title,text,status:c.status,summaryEligible:c.summaryEligible,priority:c.summaryEligible?18:c.status==='mixed'?12:11,channel:'personal-appeal',displayWorkIds,displayRoles:Object.fromEntries(displayWorkIds.map(id=>[id,id===counterId?'counterexample':id===example.workIds[foil]?'comparison':'support'])),support:c.support.slice(0,2).map(evidence),counter:[...c.counter.slice(0,1).map(evidence),...(c.reversals.slice(-1).map(t=>({roundId:t.roundId,label:'Prospective counterexample',workIds:t.workIds,detail:t.values.join(' and ')})))],sourceRoundIds:unique([...c.support,...c.counter].map(g=>g.roundId).concat(c.prospectiveChecks.map(t=>t.roundId))),competingExplanations:c.rivals.map(r=>r.title),alternatives:c.unresolved,boundary:c.boundary,nextQuestion:c.context?`Does ${title(c.driver)} still matter outside this subject?`:`Does ${title(c.driver)} matter within the same artist as well?`};
  }).filter(Boolean);
}

/** Perturb whole sources, artists and an annotation, never pair pseudo-votes. */
export function inquirySensitivity(options={}){
  const state=sourceState(options),model=buildTasteInquiry(options),lead=model.candidates[0];
  if(!lead)return {leadingId:null,variants:[]};
  const influential=[...lead.groups].sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap))[0],artistCounts=new Map();
  for(const g of lead.support)for(const a of g.artists)artistCounts.set(a,(artistCounts.get(a)||0)+1);
  const influentialArtist=[...artistCounts].sort((a,b)=>b[1]-a[1])[0]?.[0],workId=influential.example.workIds[0];
  const variants=[
    ['one-set-withheld',state.sets.filter(s=>s.entry.round.id!==influential.roundId),state.rows,{}],
    ['one-artist-withheld',state.sets.map(s=>({...s,items:s.items.filter(i=>artist(i.work)!==influentialArtist)})),state.rows,{}],
    ['equal-direction-votes',state.sets,state.rows,{equalVotes:true}],
    ['one-review-withheld',state.sets,state.rows,{omitWorkId:workId}]
  ].map(([kind,sets,rows,args])=>{
    const revised=specs.map(spec=>{
      const c=summarize(spec,groupsFor(spec,sets,rows,args));
      c.artistCount=unique(c.artistIds.map(id=>rows.get(id)?.artist).filter(Boolean)).length;
      c.recurring=c.recurring&&c.artistCount>=3;return c;
    }).filter(c=>c.direction&&c.supportingSets).sort((a,b)=>b.supportingSets-a.supportingSets||b.weight-a.weight||a.id.localeCompare(b.id));
    const c=revised.find(c=>c.id===lead.id)||{direction:0,supportingSets:0,recurring:false};
    return {kind,direction:c.direction,supportingSets:c.supportingSets,recurring:c.recurring,leadingCandidateId:revised[0]?.id||null,rank:revised.findIndex(c=>c.id===lead.id)+1,directionChanged:c.direction!==lead.direction,qualificationChanged:c.recurring!==lead.recurring,rankingBasis:'Discovery associations only, holding the question sample fixed.'};
  });
  return {leadingId:lead.id,direction:lead.direction,influentialRoundId:influential.roundId,influentialArtist,withheldReviewWorkId:workId,variants};
}
