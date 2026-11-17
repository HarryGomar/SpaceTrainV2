import {collectTastePatternSources} from './taste-axes.mjs';
import {resolveArtworkAttributes} from './artwork-quality-review.mjs';
import {withContinuousPreference,isContinuousPreferenceRound,continuousAppealValue} from './continuous-preference.mjs';
import {selectAppealInvestigation,compareAppealControls} from './appeal-investigations.mjs';
import REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {sameOrdinalArtworkIdentity,artworkPreviewHashes} from './ordinal-preference-graph.mjs';
import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';
import {ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';

export const OPENING_INQUIRY_PROTOCOL='opening-inquiry-20261117-v1';
const unique=values=>[...new Set(values)],pairKey=ids=>JSON.stringify([...ids].sort());
// These are reviewed subjects, rather than every painting with some vegetation.
// The urban view belongs to the open-space comparisons, not the natural-setting tally.
const landscapes=new Set(['van-gogh-starry-night','study-hokusai-great-wave','friedrich-wanderer','monet-water-lilies','cezanne-mountain','velasco-valley-mexico','study-bruegel-hunters-snow','opening-cma-141639','opening-cma-106088','extended-cma-150693','friedrich-moonrise','study-monet-japanese-footbridge','extended-cma-83462','extended-nga-52624','extended-nga-204911','extended-cma-111470']);
const abstracts=new Set(['add-rothko-orange-yellow','mondrian-composition','study-kandinsky-composition-eight','add-gerzso-water-mansion','add-pollock-convergence','study-malevich-black-square','add-herrera-cobalt-white','add-albers-light-grey-wall','add-krasner-icarus','add-thomas-etude-blue','add-af-klint-dove-two','add-delaunay-air-iron-water','add-malevich-football-player']);
const themeDefinitions=[{key:'landscape',ids:landscapes,quality:'landscape'},{key:'abstract',ids:abstracts,quality:'geometric-structure',alternativeQuality:'visible-paint-marks'}];

// Each row names the visible dispute and every quality excluded from control
// matching. These comparisons narrow a question; they do not isolate a cause.
export const OPENING_COMPARISONS=[
  {theme:'landscape',workIds:['monet-water-lilies','study-monet-japanese-footbridge'],qualities:['open-expanse','layered-space','geometric-structure'],question:'Does the open pond or the enclosed garden appeal more?',reason:'Two Monets retain painted vegetation, water and visible marks. The bridge adds a frame and layers of space; the pond leaves broad water without a horizon.'},
  {theme:'landscape',workIds:['opening-cma-106088','monet-water-lilies'],qualities:['layered-space'],question:'Does open water appeal equally as a sea view and as a close pond surface?',reason:'Both have water, open areas and conspicuous paint marks. Homer separates shore, surf and horizon; Monet keeps attention near the surface.'},
  {theme:'landscape',workIds:['cezanne-mountain','extended-cma-150693'],qualities:['expressive-distortion'],question:'Does the response travel between two enclosed, visibly worked landscapes?',reason:'Both organise vegetation and terrain into layers with conspicuous marks. The mountain and the close tree differ in motif and in the alteration of natural forms.'},
  {theme:'landscape',workIds:['friedrich-wanderer','friedrich-moonrise'],qualities:['dramatic-light','material-detail','narrative-detail'],question:'Does changing light and the foreground company change the appeal of distant terrain?',reason:'These Friedrichs retain finely described foreground figures, distance and open sky. Light, the number of figures and the sea or mountain setting differ.'},
  {theme:'landscape',workIds:['velasco-valley-mexico','piazza-san-marco'],qualities:['landscape','geometric-structure','dramatic-light'],question:'Does a precise, spacious view appeal in the countryside and in a city?',reason:'The distant valley and the urban square share open space, recession and controlled detail. Architecture, terrain, light and the distribution of small figures differ.'},
  {theme:'abstract',workIds:['add-rothko-orange-yellow','mondrian-composition'],qualities:['precise-rendering','pattern-rhythm'],question:'Do broad colour fields or crisp repeated divisions appeal more?',reason:'Both organise colour into shapes with open areas. Rothko has soft field edges; Mondrian has sharply divided, repeated rectangles. Palette also differs.'},
  {theme:'abstract',workIds:['add-herrera-cobalt-white','add-pollock-convergence'],qualities:['geometric-structure','visible-paint-marks','open-expanse'],question:'Does crisp geometry or accumulated paint gesture appeal more?',reason:'Both are nonfigurative. Herrera uses bounded blue and white shapes; Pollock accumulates crossing drips. Density, palette and edge control also differ.'},
  {theme:'abstract',workIds:['add-rothko-orange-yellow','add-albers-light-grey-wall'],qualities:['precise-rendering','pattern-rhythm'],question:'Does colour-field appeal carry over to sharply bounded, restrained geometry?',reason:'Both use nested or stacked fields and open areas. Soft orange and yellow fields are compared with controlled grey and white divisions.'},
  {theme:'abstract',workIds:['add-pollock-convergence','add-thomas-etude-blue'],qualities:['open-expanse'],question:'Does appeal for visible marks carry between two different arrangements of paint?',reason:'These nonfigurative works retain visible marks and rhythm. Pollock has a dense crossing web; Thomas has broken blue, dark and white passages. Palette and the arrangement of marks still differ.'}
];

/** Early questions can follow a candidate before it has earned a broad claim.
 * Only disjoint captured discovery groups nominate a recurring candidate. */
export function selectOpeningInquiry(options={}){
  const {works=[],rounds=[],answers={},id,annotationReviews=REVIEWS,candidateIds,earlyIds=[],avoidIds=[],mode='local'}=options;
  const sources=collectTastePatternSources({works,rounds,answers}),scope=sources.preferenceScopes.find(scope=>scope.channel==='personal-appeal');
  if(!scope?.sets.length)return null;
  const byId=new Map(works.map(work=>[work.id,work])),reviews=new Map(works.map(work=>[work.id,resolveArtworkAttributes(work,{annotationReviews,currentWorks:works})]));
  const status=(workId,key)=>reviews.get(workId)?.attributes[key]?.status||'unknown';
  const candidates=themeDefinitions.flatMap(theme=>{
    const belongs=work=>theme.ids.has(work.id)&&(status(work.id,theme.quality)==='present'||theme.alternativeQuality&&status(work.id,theme.alternativeQuality)==='present');
    const groups=scope.sets.flatMap(set=>{
      const inside=set.items.filter(item=>belongs(item.work)),outside=set.items.filter(item=>!theme.ids.has(item.work.id)&&reviews.get(item.work.id)&&(theme.key==='landscape'?status(item.work.id,'landscape')==='absent':isReviewedVisualDescriptor(item.work,'abstraction')&&item.work.features.abstraction<=.65));
      if(!inside.length)return [];
      const mean=items=>items.reduce((sum,item)=>sum+item.value,0)/items.length,a=mean(inside),b=outside.length?mean(outside):null,gap=b===null?null:a-b;
      const direction=b===null?(inside.length>=2&&inside.every(item=>item.value>=70)?1:inside.length>=2&&inside.every(item=>item.value<=30)?-1:0):a>=70&&b<=45&&gap>=25?1:a<=30&&b>=55&&gap<=-25?-1:0;
      return [{roundId:set.entry.round.id,workIds:set.items.map(item=>item.work.id),themeWorkIds:inside.map(item=>item.work.id),artistNames:unique(inside.map(item=>item.work.artist)),themeMean:a,otherMean:b,signedGap:gap,direction,comparisonType:b===null?'levels-only':'within-set-contrast'}];
    });
    return [1,-1].flatMap(direction=>{
      const support=groups.filter(group=>group.direction===direction),opposition=groups.filter(group=>group.direction===-direction),artists=unique(support.flatMap(group=>group.artistNames));
      if(support.length<2||!support.some(group=>group.comparisonType==='within-set-contrast')||support.length<2*opposition.length||artists.length<2)return [];
      return [{theme:theme.key,direction,groups,sourceRoundIds:support.map(group=>group.roundId),anchorIds:unique(support.flatMap(group=>group.themeWorkIds)),score:support.reduce((sum,group)=>sum+(group.signedGap===null?Math.abs(group.themeMean-50):Math.min(60,Math.abs(group.signedGap))),0)}];
    });
  }).sort((a,b)=>b.score-a.score||a.theme.localeCompare(b.theme));
  const allowed=new Set(candidateIds||works.map(work=>work.id)),early=new Set(earlyIds),avoid=new Set(avoidIds);
  const rated=new Set([...scope.sets,...scope.checks].flatMap(set=>set.items.map(item=>item.work.id)));
  const compared=new Set(rounds.filter(round=>round.kind==='spectrum'&&round.criterion==='preference').flatMap(round=>round.works.flatMap((a,index)=>round.works.slice(index+1).map(b=>pairKey([a.id,b.id])))));
  const usedEarly=rounds.some(round=>round.evidence?.openingInquiry?.pulledForwardIds?.length||round.evidence?.appealInvestigation?.pulledForwardIds?.length);
  for(const candidate of candidates){
    const prior=rounds.filter(round=>round.evidence?.openingInquiry?.candidate.theme===candidate.theme);
    if(prior.length>=3)continue;
    const proposals=OPENING_COMPARISONS.filter(pair=>pair.theme===candidate.theme).flatMap(pair=>{
      if(compared.has(pairKey(pair.workIds))||pair.workIds.some(id=>avoid.has(id)||!byId.has(id)||!reviews.get(id)||!isStudyEligibleArtwork(byId.get(id))||!allowed.has(id)&&(!early.has(id)||usedEarly)))return [];
      const pulledForwardIds=pair.workIds.filter(id=>!allowed.has(id));if(pulledForwardIds.length>1)return [];
      const rows=pair.workIds.map(id=>({values:Object.fromEntries(Object.entries(reviews.get(id).attributes).map(([key,value])=>[key,value.status==='present'?1:value.status==='absent'?0:null]))}));
      if(pair.qualities.some(key=>rows.some(row=>row.values[key]===null))||!pair.qualities.some(key=>rows[0].values[key]!==rows[1].values[key]))return [];
      const controls=compareAppealControls(rows[0],rows[1],pair.qualities);if(!controls.usable)return [];
      const score=pair.workIds.filter(id=>!rated.has(id)).length*5+pair.workIds.filter(id=>candidate.anchorIds.includes(id)).length*3-pulledForwardIds.length*2;
      return [{pair,controls,pulledForwardIds,score}];
    }).sort((a,b)=>b.score-a.score);
    const selected=proposals[0];if(!selected)continue;
    const sourceSnapshots=candidate.sourceRoundIds.map(id=>{const set=scope.sets.find(set=>set.entry.round.id===id);return {round:structuredClone(set.entry.round),answer:structuredClone(set.entry.answer)};});
    const inquiry={protocol:OPENING_INQUIRY_PROTOCOL,candidate,comparison:structuredClone(selected.pair),controls:selected.controls,pulledForwardIds:selected.pulledForwardIds,sourceSnapshots,qualitySnapshots:Object.fromEntries(selected.pair.workIds.map(id=>[id,structuredClone(reviews.get(id))])),comparisonNovel:true,frozenBeforeAnswer:true,claimScope:'Named paintings only. This selected follow-up adds no independent discovery vote.'};
    return {round:withContinuousPreference({id,kind:'spectrum',criterion:'preference',works:selected.pair.workIds.map(id=>byId.get(id)),evidence:{construct:'preference',family:'individual-choice',role:'probe',unconditional:true,openingInquiry:inquiry}}),focus:'opening:'+candidate.theme,reason:selected.pair.reason,sourceRoundIds:candidate.sourceRoundIds};
  }
  // A single polarised response can earn a local question. A high cluster, a
  // low cluster or a tied group supplies no anchor for this opening policy.
  const anchorIds=unique(scope.sets.flatMap(set=>set.items.filter(item=>Math.abs(item.value-50)>=25&&set.items.some(other=>(other.value-50)*(item.value-50)<0&&Math.abs(other.value-item.value)>=35)).map(item=>item.work.id)));
  if(!anchorIds.length)return null;
  return selectAppealInvestigation({...options,mode:mode==='transfer'?'local':mode,focus:{anchorIds}});
}

/** Read the named comparison, preserving its original sources and exact ties.
 * The nomination is not a general finding about landscapes or abstraction. */
export function readOpeningInquiries({works=[],rounds=[],answers={}}={}){
  const sources=collectTastePatternSources({works,rounds,answers}),shown=new Map(rounds.map((round,index)=>[round.id,{round,index}]));
  return sources.entries.flatMap(entry=>{
    const {round,answer}=entry,inquiry=round.evidence?.openingInquiry,pair=inquiry?.comparison;
    if(!isContinuousPreferenceRound(round)||round.evidence.role!=='probe'||inquiry?.protocol!==OPENING_INQUIRY_PROTOCOL||inquiry.frozenBeforeAnswer!==true||!pair||round.works.length!==2||!Array.isArray(pair.workIds)||pair.workIds.length!==2||pairKey(round.works.map(work=>work.id))!==pairKey(pair.workIds)||!['landscape','abstract'].includes(pair.theme)||typeof pair.question!=='string'||typeof pair.reason!=='string'||!Array.isArray(pair.qualities)||!pair.qualities.length||pair.qualities.some(key=>!Object.hasOwn(ARTWORK_ATTRIBUTE_DEFINITIONS,key))||!Array.isArray(inquiry.sourceSnapshots)||inquiry.sourceSnapshots.length<2)return [];
    if(inquiry.sourceSnapshots.some(snapshot=>!shown.has(snapshot.round.id)||rounds.filter(round=>round.id===snapshot.round.id).length!==1||shown.get(snapshot.round.id).index>=entry.index||!isContinuousPreferenceRound(snapshot.round)||snapshot.round.works.some(work=>!sameOrdinalArtworkIdentity(work,works.find(row=>row.id===work.id),{requireSource:true}))))return [];
    const reviews=round.works.map(work=>inquiry.qualitySnapshots?.[work.id]);
    if(reviews.some((review,index)=>!review||review.annotationBasis?.sourceUrl!==round.works[index].sourceUrl||review.annotationBasis?.image!==round.works[index].image||!(/^[a-f0-9]{64}$/i.test(review.annotationBasis?.previewSha256))||artworkPreviewHashes(round.works[index]).some(hash=>hash!==review.annotationBasis.previewSha256)))return [];
    const rows=reviews.map(review=>({values:Object.fromEntries(Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS).map(key=>[key,review.attributes?.[key]?.status==='present'?1:review.attributes?.[key]?.status==='absent'?0:null]))}));
    if(pair.qualities.some(key=>rows.some(row=>row.values[key]===null))||!pair.qualities.some(key=>rows[0].values[key]!==rows[1].values[key])||!compareAppealControls(rows[0],rows[1],pair.qualities).usable)return [];
    const changed=inquiry.sourceSnapshots.some(snapshot=>JSON.stringify(snapshot.round.works.map(work=>work.id))!==JSON.stringify(shown.get(snapshot.round.id).round.works.map(work=>work.id))||snapshot.round.works.some(work=>continuousAppealValue(shown.get(snapshot.round.id).round,answers[snapshot.round.id],work.id)!==snapshot.answer.positions[work.id]));
    const values=round.works.map(work=>answer.positions[work.id]),signedGap=values[0]-values[1],outcome=changed?'historical':Math.abs(signedGap)<10?'close':Math.max(...values)<=50?'both-low':Math.min(...values)>50?'both-high':'separated';
    return [{roundId:round.id,workIds:round.works.map(work=>work.id),values,signedGap,outcome,comparison:pair,candidate:inquiry.candidate,sourceRoundIds:inquiry.sourceSnapshots.map(snapshot=>snapshot.round.id),sourceChanged:changed,discoveryVote:false}];
  });
}
