import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_LIMITS} from './artwork-attribute-definitions.mjs';
import {collectTastePatternSources,analyzeTasteDimension,TASTE_PATTERN_LIMITS} from './taste-axes.mjs';
import {buildPreferenceBasis,favouriteExposure,profileEvidence,POSITIVE_APPEAL,LOW_APPEAL} from './profile-evidence.mjs';
import {buildRecommendationMemory,wasPreviouslyPresented} from './recommendation-memory.mjs';
import {isStudyEligibleArtwork} from './study-eligibility.mjs';
import {COMPARISON_SCOPE} from './comparison-protocol.mjs';
import {mainCollectionWorks} from './collection-routing.mjs';
import {CONTINUOUS_SCOPE} from './continuous-preference.mjs';
import {rankExplanationPatterns,selectPrincipalExplanations} from './explanation-ranking.mjs';

export const TASTE_PATTERNS_VERSION='taste-patterns-v1';
const unique=values=>[...new Set(values)];
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const short=work=>work.shortTitle||work.title;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
const attributeKeys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);
const artist=work=>work.artistKnown!==false&&typeof work.artist==='string'&&!/unknown|unidentified|anonymous/i.test(work.artist)?work.artist.trim().toLowerCase():null;

// Fixed editorial combinations used for every answer record. They are routes
// through the catalogue, not fitted interactions, preregistered tests or causes.
export const TASTE_QUALITY_BUNDLES=Object.freeze([
  {key:'scenes-within-scenes',attributes:['narrative-detail','layered-space'],title:'Stories within scenes',description:'story clues distributed through layers of space'},
  {key:'precisely-imagined',attributes:['imagined-world','precise-rendering'],title:'Precisely imagined worlds',description:'fantastical imagery with precise edges and detail'},
  {key:'light-and-figures',attributes:['dramatic-light','intimate-figures'],title:'Light & human presence',description:'dramatic lighting around close human figures'},
  {key:'distortion-and-gesture',attributes:['expressive-distortion','visible-gesture'],title:'Expressive figures',description:'altered forms together with emphatic bodily gestures'},
  {key:'structure-and-rhythm',attributes:['geometric-structure','pattern-rhythm'],title:'Pattern & structure',description:'geometric structure organised through repetition'},
  {key:'staged-relationships',attributes:['human-relationships','theatrical-staging'],title:'Human relationships',description:'relationships between people arranged as a staged encounter'},
  {key:'stories-and-worlds',attributes:['narrative-detail','imagined-world'],title:'Stories in imagined worlds',description:'story clues within fantastical imagery'},
  {key:'precise-materials',attributes:['precise-rendering','material-detail'],title:'Precision & materials',description:'precise rendering of differentiated material surfaces'}
]);
const qualities=[...attributeKeys.map(key=>({key,attributes:[key],title:ARTWORK_ATTRIBUTE_DEFINITIONS[key].label,description:ARTWORK_ATTRIBUTE_DEFINITIONS[key].label.toLowerCase()})),...TASTE_QUALITY_BUNDLES];
export const TASTE_PATTERN_MODEL_LIMITS=Object.freeze([
  ...TASTE_PATTERN_LIMITS,...ARTWORK_ATTRIBUTE_LIMITS,
  'A quality is tested only where a question contains both a reviewed present example and an explicitly reviewed absence. The number of reviewed examples is shown alongside the number of answered works.',
  'Overall liking, legacy relative choices, admiration of making and explicit favourites are separate evidence channels. A within-set winner is not an absolute like.',
  'Three distinct, non-overlapping comparison examples from three preferred-work artists and three artwork sets are the minimum for a recurring directional reading. These are conservative editorial reporting rules, not significance tests or calibrated confidence.',
  'A connection among favourites is a description of one unranked selection, not three independent preference replications. Non-selection is never dislike.',
  'A reviewed combination means that its component qualities occur together. These comparisons do not establish a special interaction between them or separate their effects.'
]);

function declaredPreviewHashes(work){
  // In this catalogue all three aliases refer to work.image. Original and large
  // asset hashes have separate sourceImageSha256/largeSha256 fields.
  return [work?.sha256,work?.previewSha256,work?.provenance?.thumbnailSha256,work?.provenance?.sha256,work?.provenance?.download?.sha256].filter(value=>value!==undefined);
}
function recordFor(work,reviews){
  if(reviews?.version!==undefined&&reviews.version!==ARTWORK_ATTRIBUTE_VERSION)return null;
  const map=plain(reviews?.reviews)?reviews.reviews:plain(reviews)?reviews:{};
  return map[work?.id]||null;
}
function validReview(record,work){
  const identity=record?.sourceIdentity,asset=record?.reviewedAsset;
  return record?.version===ARTWORK_ATTRIBUTE_VERSION&&record.reviewed===true&&record.reviewerType==='assistant-visual-review'&&plain(record.attributes)&&identity?.sourceUrl===work?.sourceUrl&&typeof work?.sourceUrl==='string'&&/^https?:\/\//.test(work.sourceUrl)&&identity.image===work.image&&!!hash(identity.previewSha256)&&typeof asset?.image==='string'&&!!hash(asset.sha256)&&asset.width>0&&asset.height>0&&asset.compositionMatch==='same-composition'&&typeof asset.mediaBinding==='string'&&Array.isArray(record.sourceUrls)&&record.sourceUrls.includes(work.sourceUrl);
}

/** Add a current, labelled interpretation without changing a captured work.
 * The ID alone never supplies source or reproduction identity. A captured hash
 * takes precedence; an unrecorded hash needs a separately verified catalogue
 * reference with the same source and preview path. A mismatch fails closed.
 */
export function resolveArtworkAttributes(work,{annotationReviews={},currentWorks=[]}={}){
  const record=recordFor(work,annotationReviews);if(!validReview(record,work))return null;
  const expected=hash(record.sourceIdentity.previewSha256),declared=declaredPreviewHashes(work);
  let bindingStatus='captured-preview-hash';
  if(declared.length){if(declared.some(value=>hash(value)!==expected))return null;}
  else{
    const matches=currentWorks.filter(current=>current?.id===work.id&&current.sourceUrl===work.sourceUrl&&current.image===work.image);
    if(matches.length>1)return null;
    const current=matches.length?declaredPreviewHashes(matches[0]):[];
    if(current.length){if(current.some(value=>hash(value)!==expected))return null;bindingStatus='current-verified-catalogue-reference';}
    else{
      const reference=annotationReviews?.currentAssetReferences?.[JSON.stringify([work.sourceUrl,work.image])];
      if(reference?.sourceUrl!==work.sourceUrl||reference.image!==work.image||hash(reference.previewSha256)!==expected||reference.verification!=='sha256-of-current-local-preview')return null;
      bindingStatus='current-verified-asset-reference';
    }
  }
  const attributes=Object.fromEntries(attributeKeys.map(key=>{
    const value=record.attributes[key],valid=['present','absent','unknown'].includes(value?.status)&&value.evidenceKind==='visual-review'&&typeof value.reason==='string'&&value.reason.trim();
    return [key,valid?{status:value.status,reason:value.reason}: {status:'unknown',reason:'No usable source-bound review for this criterion.'}];
  }));
  return {version:ARTWORK_ATTRIBUTE_VERSION,attributes,sourceUrls:[...record.sourceUrls],sourcedContext:Array.isArray(record.sourcedContext)?structuredClone(record.sourcedContext):[],annotationBasis:{interpretation:'current-editorial-interpretation',reviewerType:record.reviewerType,bindingStatus,historicalPreviewHashRecorded:declared.length>0,sourceUrl:work.sourceUrl,image:work.image,previewSha256:expected,reviewedAsset:{...record.reviewedAsset},...(declared.length?{}:{limit:'The original response did not record preview bytes. This is a current editorial interpretation of the same declared artwork source and preview path, verified against the current asset; it does not establish a historical hash match.'})}};
}

function qualityValue(review,quality){
  if(!review)return null;
  const statuses=quality.attributes.map(key=>review.attributes[key]?.status||'unknown');
  if(statuses.includes('absent'))return 0;
  return statuses.every(status=>status==='present')?1:null;
}
function scopeItems(scope){return [...new Map(scope.sets.flatMap(set=>set.items).map(item=>[item.work.id,item])).values()];}
const pairToken=pair=>JSON.stringify([pair.set.entry.round.id,pair.winner.work.id,pair.loser.work.id]);
function annotationEvidence(items,review){
  return unique(items.map(item=>item.work.id)).flatMap(id=>{const work=items.find(item=>item.work.id===id)?.work,value=work&&review(work);return value?[{workId:id,...value.annotationBasis}]:[];});
}
function scopedText(result,quality,scope){
  const toward=(result.direction||result.candidateDirection)>0,subject=toward?'paintings with '+quality.description:'paintings without '+(quality.attributes.length>1?'the full combination of ':'')+quality.description;
  if(result.status==='leaning'){
    if(scope.channel==='admiration-of-making')return `In your admiration ratings, ${subject} tended to come above other paintings shown alongside them. You found more to admire in how they were made; this does not necessarily mean you liked them more.`;
    if(scope.channel==='overall-appeal')return `${subject[0].toUpperCase()+subject.slice(1)} repeatedly received higher overall ratings across different sets and artists.`;
    if(scope.channel==='personal-appeal')return `You tended to like ${subject} more than the other paintings shown alongside them. This recurred across different artists and sets.`;
    return `${subject[0].toUpperCase()+subject.slice(1)} repeatedly won your comparisons across different sets and artists. ${scope.channel==='ordinal-choice'?'These questions establish only an order within each set. Line spacing is not a measure of liking.':'These earlier questions establish a relative order, rather than an absolute level of liking.'}`;
  }
  if(result.checkConflict)return `${quality.title} separated several earlier choices, but later comparisons went against that direction in more than one artwork set. The later responses remain dependent checks, rather than new independent evidence.`;
  const first=result.pairs.find(pair=>pair.vote===(result.candidateDirection||1)),opposite=result.pairs.find(pair=>pair.vote===-(result.candidateDirection||1));
  if(first&&opposite)return `${short(first.winner.work)} came ahead of ${short(first.loser.work)}, while ${short(opposite.winner.work)} came ahead of ${short(opposite.loser.work)}. ${quality.title} does not separate those choices on its own.`;
  return result.eligibleSetCount?`These answers do not yet establish a recurring direction around ${quality.description}.`:`The answered paintings did not provide enough reviewed present-and-absent contrasts for ${quality.description}.`;
}

function diverseIndividualExamples(items){
  const ordered=[...items].sort((a,b)=>b.value-a.value||a.entry.index-b.entry.index||a.work.id.localeCompare(b.work.id)),chosen=[],artists=new Set(),sets=new Set();
  for(const item of ordered){const name=artist(item.work);if(!name||artists.has(name)||sets.has(item.entry.round.id))continue;chosen.push(item);artists.add(name);sets.add(item.entry.round.id);if(chosen.length===3)break;}
  return chosen;
}
function individualEvidence(item,channel,detail){
  return profileEvidence(item.entry,[item.work.id],`${short(item.work)}: ${item.value} on the recorded ${channel==='admiration-of-making'?'admiration-of-making':'overall-liking'} scale. ${detail}`,channel==='admiration-of-making'?'Admiration of making':'Overall liking');
}
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;

/** Anchored ratings can be compared across homogeneous quartets as well as
 * within them. Equal set weighting limits a dense panel's leverage, but it does
 * not eliminate context or artist confounding. No legacy scale enters here.
 */
function anchoredAssociations(scope,review,scopeIndex=0){
  if(!['personal-appeal','overall-appeal','admiration-of-making'].includes(scope.channel))return [];
  const items=scopeItems(scope);
  return qualities.map(quality=>{
    const known=items.filter(item=>qualityValue(review(item.work),quality)!==null),present=known.filter(item=>qualityValue(review(item.work),quality)===1),absent=known.filter(item=>qualityValue(review(item.work),quality)===0),presentGroups=scope.sets.flatMap(set=>{const matches=set.items.filter(item=>qualityValue(review(item.work),quality)===1);return matches.length?[{roundId:set.entry.round.id,mean:mean(matches.map(item=>item.value)),workIds:matches.map(item=>item.work.id)}]:[];}),absentGroups=scope.sets.flatMap(set=>{const matches=set.items.filter(item=>qualityValue(review(item.work),quality)===0);return matches.length?[{roundId:set.entry.round.id,mean:mean(matches.map(item=>item.value)),workIds:matches.map(item=>item.work.id)}]:[];});
    const presentMean=mean(presentGroups.map(group=>group.mean)),absentMean=mean(absentGroups.map(group=>group.mean)),difference=presentMean===null||absentMean===null?null:presentMean-absentMean,direction=difference===null?0:Math.sign(difference),favoured=direction<0?absent:present,other=direction<0?present:absent,high=favoured.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)),examples=diverseIndividualExamples(high),contra=[...favoured.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).sort((a,b)=>a.value-b.value),...other.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).sort((a,b)=>b.value-a.value)].slice(0,4);
    const sufficient=present.length>=6&&absent.length>=6&&presentGroups.length>=3&&absentGroups.length>=3,qualified=sufficient&&Math.abs(difference)>=15&&examples.length===3;
    const support=(examples.length?examples:favoured.slice(0,3)).map(item=>individualEvidence(item,scope.channel,'This work carries the reviewed side of the across-set association.')),counter=contra.map(item=>individualEvidence(item,scope.channel,'This rating limits the visual-quality association.'));
    const subject=direction<0?'Paintings without '+(quality.attributes.length>1?'the full combination of ':'')+quality.description:'Paintings with '+quality.description,scaleName=scope.channel==='admiration-of-making'?'admiration of the making':'overall liking';
    return {id:'quality-association-'+scope.channel+'-'+scopeIndex+'-'+quality.key,module:'taste-patterns',kind:'taste',channel:scope.channel,title:quality.title,text:qualified?`${subject} tended to sit higher on your ${scaleName} scale across different artwork sets.${contra.length?' There are exceptions on both sides; this describes a connection in these ratings, rather than a rule for every painting.':''}`:`The recorded ${scaleName} ratings do not yet establish a broad association with ${quality.description}.`,status:'descriptive-association',summaryEligible:qualified,direction:qualified?direction:0,candidateDirection:direction,attributes:[...quality.attributes],qualityKey:quality.key,bundle:quality.attributes.length>1,support,counter,displayWorkIds:unique([examples[0]?.work.id,examples[1]?.work.id,contra[0]?.work.id].filter(Boolean)).slice(0,2),evidence:unique([...support,...counter].flatMap(item=>item.workIds)),sourceRoundIds:unique([...presentGroups,...absentGroups].map(group=>group.roundId)),measurementScope:scope.key,comparisonBasis:scope.channel==='personal-appeal'?'across-set-personal-appeal-levels':scope.channel==='overall-appeal'?'across-set-anchored-overall-ratings':'across-set-anchored-admiration-ratings',supportingSetCount:null,opposingSetCount:null,mixedSetCount:null,eligibleSetCount:null,knownWorkCount:known.length,positiveWorkCount:known.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).length,negativeWorkCount:known.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).length,exposureBaseline:{totalAnswered:items.length,withQuality:present.length,withoutQuality:absent.length,unknown:items.length-known.length,positiveWithQuality:present.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).length,lowerRatedWithQuality:present.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).length},ratingAssociation:{weighting:'one-mean-per-distinct-artwork-set-on-each-reviewed-side',presentSetCount:presentGroups.length,absentSetCount:absentGroups.length,presentMean,absentMean,difference,presentGroups,absentGroups,highFavouredWorkIds:high.map(item=>item.work.id),higherRatedOtherWorkIds:other.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).map(item=>item.work.id),lowerRatedFavouredWorkIds:favoured.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).map(item=>item.work.id)},coexplaining:[],annotationBasis:annotationEvidence(items,review),sourceUrls:unique(known.flatMap(item=>review(item.work)?.sourceUrls||[])),alternatives:[...TASTE_PATTERN_MODEL_LIMITS,'Across-set rating associations use only a common explicitly anchored scale and the first discovery response to each work. Homogeneous quartets still contribute; each set supplies at most one mean per reviewed side.','A difference of 15 points, six reviewed works on each side and three sets on each side are provisional descriptive reporting rules. At least three high-rated examples must also span three artists and three sets.','These are observed rating associations. The composition of the questions, artist, subject, other visual qualities and earlier exposure may explain the same rating difference. No causal effect or prospective accuracy is established.'],priority:qualified?13:1};
  });
}

function combineAnchoredPatterns(local,associations){
  return qualities.flatMap(quality=>{
    const within=local.find(pattern=>pattern.qualityKey===quality.key),across=associations.find(pattern=>pattern.qualityKey===quality.key);
    if(!within)return [];
    if(across)within.globalAssociation={...across.ratingAssociation,summaryEligible:across.summaryEligible,direction:across.direction,comparisonBasis:across.comparisonBasis};
    if(within.status==='qualified'){
      if(across?.summaryEligible&&across.direction!==within.direction){within.summaryEligible=false;within.status='mixed';within.text+=' The broader anchored ratings lean the other way, so the within-set and across-set readings remain separate.';}
      return [within];
    }
    if(across?.summaryEligible&&!within.checkConflict){
      across.withinSet={status:within.status,direction:within.direction,supportingSetCount:within.supportingSetCount,opposingSetCount:within.opposingSetCount,mixedSetCount:within.mixedSetCount,eligibleSetCount:within.eligibleSetCount};
      across.coexplaining=[...within.coexplaining];
      if(within.status==='mixed'&&within.eligibleSetCount>=3)across.text+=' Within individual sets the comparisons were mixed, so the connection is clearer across the broader group than as a local tie-breaker.';
      return [across];
    }
    return within.status==='mixed'&&within.eligibleSetCount>=3&&(within.support.length||within.counter.length)?[within]:[];
  });
}
function scopedPatterns(scope,review,scopeIndex=0){
  const items=scopeItems(scope),analyses=qualities.map(quality=>({quality,result:analyzeTasteDimension(scope,work=>qualityValue(review(work),quality),{descriptorGap:1})}));
  return analyses.map(({quality,result})=>{
    const knownItems=items.filter(item=>qualityValue(review(item.work),quality)!==null),withQuality=knownItems.filter(item=>qualityValue(review(item.work),quality)===1),withoutQuality=knownItems.filter(item=>qualityValue(review(item.work),quality)===0),direction=result.direction||result.candidateDirection||1;
    const relevant=result.pairs.filter(pair=>pair.vote===direction),tokens=new Set(relevant.map(pairToken)),coexplaining=analyses.filter(other=>other.quality!==quality).flatMap(other=>{
      const shared=other.result.pairs.filter(pair=>pair.vote===(other.result.direction||other.result.candidateDirection||1)&&tokens.has(pairToken(pair))),sets=unique(shared.map(pair=>pair.set.entry.round.id));
      return sets.length>=3&&shared.length*2>=relevant.length?[{attributes:[...other.quality.attributes],title:other.quality.title,sharedSetCount:sets.length,sharedComparisonCount:shared.length,detail:'The same supporting comparisons also align with this quality; these questions have not separated the explanations.'}]:[];
    });
    const {items:internalItems,pairs:internalPairs,...serial}=result;
    const absolute=['personal-appeal','overall-appeal','admiration-of-making'].includes(scope.channel),supportingWorks=unique(relevant.map(pair=>pair.winner.work.id));
    const pattern={...serial,id:'quality-'+scope.channel+'-'+scopeIndex+'-'+quality.key,module:'taste-patterns',kind:'taste',channel:scope.channel,title:quality.title,text:scopedText(result,quality,scope),status:result.status==='leaning'?'qualified':result.status,attributes:[...quality.attributes],qualityKey:quality.key,bundle:quality.attributes.length>1,measurementScope:scope.key,comparisonBasis:scope.channel==='personal-appeal'?CONTINUOUS_SCOPE:scope.channel==='overall-appeal'?'within-set-overall-appeal':scope.channel==='admiration-of-making'?'within-set-admiration-of-making':scope.channel==='ordinal-choice'?COMPARISON_SCOPE:'legacy-within-set-comparisons',evidence:unique([...result.support,...result.counter].flatMap(item=>item.workIds)),positiveWorkCount:absolute?knownItems.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).length:null,negativeWorkCount:absolute?knownItems.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).length:null,preferredComparisonWorkCount:supportingWorks.length,exposureBaseline:{totalAnswered:items.length,withQuality:withQuality.length,withoutQuality:withoutQuality.length,unknown:items.length-knownItems.length,positiveWithQuality:absolute?withQuality.filter(item=>(scope.channel==='personal-appeal'?item.value>50:item.value>=POSITIVE_APPEAL)).length:null,lowerRatedWithQuality:absolute?withQuality.filter(item=>(scope.channel==='personal-appeal'?item.value<50:item.value<=LOW_APPEAL)).length:null},coexplaining,annotationBasis:annotationEvidence(items,review),sourceUrls:unique(knownItems.flatMap(item=>review(item.work)?.sourceUrls||[])),alternatives:[...TASTE_PATTERN_MODEL_LIMITS,...(coexplaining.length?['The same supporting comparisons also align with '+coexplaining.slice(0,3).map(item=>item.title.toLowerCase()).join(', ')+'. Those alternatives remain unresolved.']:[])],priority:result.summaryEligible?14:result.status==='mixed'?5:1};
    pattern.summaryEligible=result.summaryEligible;
    if(scope.channel==='personal-appeal'){
      const positiveWinners=[...new Map(relevant.filter(pair=>pair.winner.value>50).map(pair=>[pair.winner.work.id,pair.winner])).values()],lowWithQuality=withQuality.filter(item=>item.value<50);
      pattern.positiveSupportWorkIds=positiveWinners.map(item=>item.work.id);pattern.lowerRatedWithQuality=lowWithQuality.map(item=>item.work.id);
      pattern.absoluteResponseBalance={aboveNeutral:knownItems.filter(item=>item.value>50).length,belowNeutral:knownItems.filter(item=>item.value<50).length,neutral:knownItems.filter(item=>item.value===50).length};
      pattern.summaryEligible=result.summaryEligible&&positiveWinners.length>=3&&unique(positiveWinners.map(item=>artist(item.work)).filter(Boolean)).length>=3&&unique(positiveWinners.map(item=>item.entry.round.id)).length>=3;
      if(result.summaryEligible&&!pattern.summaryEligible){pattern.priority=7;pattern.text+=' This comparison tendency does not yet have three positively rated examples across different artists and groups, so it does not name the overall profile.';}
      const represented=new Set(pattern.counter.flatMap(item=>item.workIds));
      pattern.counter.push(...lowWithQuality.filter(item=>!represented.has(item.work.id)).slice(0,3).map(item=>individualEvidence(item,'personal-appeal','Below neutral despite carrying this reviewed quality.')));
      pattern.evidence=unique([...pattern.support,...pattern.counter].flatMap(item=>item.workIds));
    }
    return pattern;
  });
}

function favouriteConnections(entries,review){
  const basis=buildPreferenceBasis(entries),selected=basis.favourites,ratings=basis.ratings,patterns=[];
  if(selected.length<3)return {patterns,basis};
  for(const quality of qualities){
    const known=selected.filter(item=>qualityValue(review(item.work),quality)!==null),supporting=known.filter(item=>qualityValue(review(item.work),quality)===1),outside=known.filter(item=>qualityValue(review(item.work),quality)===0),artists=unique(supporting.map(item=>artist(item.work)).filter(Boolean));
    if(supporting.length<3||artists.length<3)continue;
    const baseline=ratings.length?ratings:basis.favouriteCandidates,baselineBasis=ratings.length?'anchored-overall-rated-works':'actually-presented-favourites-pool',knownBaseline=baseline.filter(item=>qualityValue(review(item.work),quality)!==null),baselineWith=knownBaseline.filter(item=>qualityValue(review(item.work),quality)===1),lower=ratings.filter(item=>item.negative&&qualityValue(review(item.work),quality)===1),disliked=basis.dislikes.filter(item=>qualityValue(review(item.work),quality)===1),negative=[...new Map([...lower,...disliked].map(item=>[item.work.id,item])).values()],enriched=knownBaseline.length>=6&&known.length>=3&&baselineWith.length<knownBaseline.length&&supporting.length*knownBaseline.length>baselineWith.length*known.length;
    const support=selected.filter(item=>supporting.includes(item)).flatMap(item=>item.support),counter=[...negative.flatMap(item=>item.support),...outside.flatMap(item=>item.support)];
    const display=supporting.slice(0,2).map(item=>item.work.id),workIds=supporting.map(item=>item.work.id);
    patterns.push({id:'favourite-quality-'+quality.key,module:'taste-patterns',kind:'taste',channel:'explicit-favourites',qualityKey:quality.key,title:quality.title,text:`${quality.title} recurs among your favourites: ${supporting.slice(0,3).map(item=>short(item.work)).join(', ')}.${lower.length?` The same quality also appears in ${lower.length===1?'a lower-rated painting':'lower-rated paintings'}, so it is not enough by itself to account for your choices.`:''}${disliked.length?' The same quality also appears in paintings you explicitly disliked.':''}${outside.length?' Your favourites also include work without this reviewed quality.':''}`,status:'descriptive',direction:1,summaryEligible:enriched,attributes:[...quality.attributes],bundle:quality.attributes.length>1,support,counter,displayWorkIds:display,evidence:unique([...support,...counter].flatMap(item=>item.workIds)),sourceRoundIds:unique([...support,...counter].map(item=>item.roundId)),supportingWorkCount:supporting.length,knownWorkCount:known.length,positiveWorkCount:supporting.length,negativeWorkCount:negative.length,supportingSetCount:null,opposingSetCount:null,mixedSetCount:null,eligibleSetCount:null,independentReplicationClaim:false,favouriteWorkIds:workIds,favouritesOutsideQuality:outside.map(item=>item.work.id),lowerRatedWithQuality:lower.map(item=>item.work.id),explicitDislikesWithQuality:disliked.map(item=>item.work.id),exposureBaseline:{selectedTotal:selected.length,selectedKnown:known.length,selectedWithQuality:supporting.length,selectedWithoutQuality:outside.length,selectedUnknown:selected.length-known.length,totalRated:ratings.length,ratedKnown:ratings.length?knownBaseline.length:0,ratedWithQuality:ratings.length?baselineWith.length:0,ratedWithoutQuality:ratings.length?knownBaseline.length-baselineWith.length:0,ratedUnknown:ratings.length?ratings.length-knownBaseline.length:0,baselineBasis,presentedPoolTotal:baseline.length,presentedPoolKnown:knownBaseline.length,presentedPoolWithQuality:baselineWith.length},measurementScope:'explicit-unranked-favourites',comparisonBasis:'qualities-recurring-among-explicit-favourites',annotationBasis:annotationEvidence([...supporting,...outside,...negative].map(item=>({work:item.work})),review),sourceUrls:unique([...supporting,...outside,...negative].flatMap(item=>review(item.work)?.sourceUrls||[])),coexplaining:[],alternatives:[...TASTE_PATTERN_MODEL_LIMITS,'This is one explicit favourites selection. Counts across selected works describe the collection and are not independent demonstrations of a preference direction.','Header eligibility requires a more concentrated occurrence among reviewed favourites than in the actually presented pool or the older anchored overall-rated pool. Unvisited pages are not a baseline and non-selection is not dislike.'],priority:enriched?15:8});
  }
  return {patterns,basis};
}

function recordedExposure(rounds,answers){
  const seen=new Set(),unknown=new Set();
  for(const round of rounds){
    const answer=answers[round?.id],offered=round?.works?.map(work=>work.id)||[];
    if(!answer||round.unavailable||round.evidence?.stimulusVisibility==='not-shown'||!Array.isArray(answer.workIds)||answer.workIds.join('|')!==offered.join('|'))continue;
    if(round.kind==='exercise'){
      const record=answer.record,presented=record?.presentedIds;
      if(Array.isArray(presented)&&new Set(presented).size===presented.length&&presented.every(id=>offered.includes(id)))presented.forEach(id=>seen.add(id));
      else offered.forEach(id=>unknown.add(id));
      continue;
    }
    if(round.kind==='choice-grid'&&round.evidence?.instrumentRevision==='paged-favourites-v1'){
      const exposure=favouriteExposure(round,answer);if(exposure)exposure.presentedIds.forEach(id=>seen.add(id));else offered.forEach(id=>unknown.add(id));
      continue;
    }
    [...offered,...(round.anchorWorks||[]).map(work=>work.id),...(round.anchorIds||[])].forEach(id=>seen.add(id));
  }
  return {seen,unknown};
}
function recommendationsFor(patterns,works,rounds,answers,review,recommendationHistory=[]){
  const {seen,unknown}=recordedExposure(rounds,answers),memory=buildRecommendationMemory(recommendationHistory),usable=patterns.filter(pattern=>pattern.summaryEligible&&pattern.direction>0),recommendations=[];
  for(const work of mainCollectionWorks(works)){
    if(!isStudyEligibleArtwork(work)||seen.has(work.id)||unknown.has(work.id)||wasPreviouslyPresented(work,memory))continue;
    const matched=usable.filter(pattern=>qualityValue(review(work),pattern)===1);
    if(!matched.length)continue;
    const leading=[...matched].sort((a,b)=>Number(b.bundle)-Number(a.bundle)||b.priority-a.priority||b.attributes.length-a.attributes.length)[0],sourceById=new Map([...works,...rounds.flatMap(round=>round.works||[])].map(item=>[item.id,item])),sourceWorkIds=unique(leading.support.flatMap(item=>item.workIds)).filter(id=>id!==work.id&&qualityValue(review(sourceById.get(id)),leading)===1).slice(0,4);
    if(!sourceWorkIds.length)continue;
    recommendations.push({id:'quality-recommendation-'+work.id,workId:work.id,channel:leading.channel,patternIds:matched.map(pattern=>pattern.id),matchedAttributes:unique(matched.flatMap(pattern=>pattern.attributes)),sourceWorkIds,reason:`${short(work)} shares ${leading.attributes.map(key=>ARTWORK_ATTRIBUTE_DEFINITIONS[key].label.toLowerCase()).join(' and ')} with the paintings behind “${leading.title}”.`,matchBasis:'source-bound-reviewed-visual-qualities',availability:'not-recorded-as-presented-or-rated',sourceUrls:[...(review(work)?.sourceUrls||[])],annotationBasis:review(work)?.annotationBasis,priority:leading.priority+Number(leading.bundle)});
  }
  return recommendations.sort((a,b)=>b.priority-a.priority||b.matchedAttributes.length-a.matchedAttributes.length||a.workId.localeCompare(b.workId)).slice(0,12);
}

/** Pure evidence-linked quality models. Never replace captured artwork fields. */
export function buildTastePatterns({works=[],rounds=[],answers={},annotationReviews={},currentWorks=[],recommendationHistory=[]}={}){
  const sources=collectTastePatternSources({works,rounds,answers}),cache=new WeakMap(),review=work=>{
    if(!work||typeof work!=='object')return null;
    if(!cache.has(work))cache.set(work,resolveArtworkAttributes(work,{annotationReviews,currentWorks}));return cache.get(work);
  },scopes=sources.preferenceScopes.map((scope,index)=>({scope,candidates:scopedPatterns(scope,review,index),associations:anchoredAssociations(scope,review,index)})),admirationCandidates=scopedPatterns(sources.admiration,review),admirationAssociations=anchoredAssociations(sources.admiration,review),usable=candidates=>candidates.filter(pattern=>pattern.status==='qualified'||pattern.status==='mixed'&&pattern.eligibleSetCount>=3&&(pattern.support.length||pattern.counter.length)),continuousScopes=scopes.filter(item=>item.scope.channel==='personal-appeal'),appealScopes=scopes.filter(item=>item.scope.channel==='overall-appeal'),relativeScopes=scopes.filter(item=>item.scope.channel==='relative-choice'),ordinalScopes=scopes.filter(item=>item.scope.channel==='ordinal-choice'),favourites=favouriteConnections(sources.entries,review);
  const appeal={channel:'overall-appeal',patterns:appealScopes.flatMap(item=>combineAnchoredPatterns(item.candidates,item.associations)),candidates:appealScopes.flatMap(item=>item.candidates),associations:appealScopes.flatMap(item=>item.associations)},admiration={channel:'admiration-of-making',patterns:combineAnchoredPatterns(admirationCandidates,admirationAssociations),candidates:admirationCandidates,associations:admirationAssociations},relative={channel:'relative-choice',patterns:relativeScopes.flatMap(item=>usable(item.candidates)),scopes:relativeScopes.map(({scope,candidates})=>({key:scope.key,distinctSets:scope.sets.length,distinctWorks:scope.workCount,patterns:usable(candidates)}))};
  const ordinal={channel:'ordinal-choice',patterns:ordinalScopes.flatMap(item=>usable(item.candidates)),scopes:ordinalScopes.map(({scope,candidates})=>({key:scope.key,distinctSets:scope.sets.length,distinctWorks:scope.workCount,patterns:usable(candidates)}))};
  const continuous={channel:'personal-appeal',patterns:continuousScopes.flatMap(item=>combineAnchoredPatterns(item.candidates,item.associations)),candidates:continuousScopes.flatMap(item=>item.candidates),associations:continuousScopes.flatMap(item=>item.associations)};
  const patterns=rankExplanationPatterns([...favourites.patterns,...continuous.patterns,...appeal.patterns,...ordinal.patterns,...relative.patterns,...admiration.patterns],{favouriteIds:favourites.basis.favourites.map(item=>item.work.id),ratings:favourites.basis.ratings}),principal=selectPrincipalExplanations(patterns),leading=principal[0],readingSummary=leading?{title:leading.title,text:leading.text,patternIds:[leading.id],principalPatternIds:principal.map(item=>item.id),workIds:[...leading.displayWorkIds],evidenceKind:leading.explanationEvidence.kind}:null;
  const answeredItems=[...new Map(sources.entries.flatMap(entry=>entry.round.works).map(work=>[work.id,work])).values()];
  return {version:TASTE_PATTERNS_VERSION,continuous,appeal,admiration,ordinal,relative,favouriteConnections:{channel:'explicit-favourites',patterns:favourites.patterns},patterns,recommendations:recommendationsFor(patterns,works,rounds,answers,review,recommendationHistory),coverage:{answeredWorks:answeredItems.length,reviewedAnsweredWorks:answeredItems.filter(work=>review(work)).length,unknownAnsweredWorks:answeredItems.filter(work=>!review(work)).length,continuousSets:continuousScopes.reduce((sum,item)=>sum+item.scope.sets.length,0),overallSets:appealScopes.reduce((sum,item)=>sum+item.scope.sets.length,0),ordinalSets:ordinalScopes.reduce((sum,item)=>sum+item.scope.sets.length,0),relativeSets:relativeScopes.reduce((sum,item)=>sum+item.scope.sets.length,0),admirationSets:sources.admiration.sets.length,admirationWorks:sources.admiration.workCount,explicitFavourites:favourites.basis.favourites.length,explicitDislikes:favourites.basis.dislikes.length,knownFavouriteWorks:favourites.basis.favourites.filter(item=>review(item.work)).length,annotationVersion:ARTWORK_ATTRIBUTE_VERSION,annotationInterpretation:'current-editorial-interpretation'},readingSummary,limits:[...TASTE_PATTERN_MODEL_LIMITS]};
}
