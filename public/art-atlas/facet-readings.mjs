import {validatedProfileEntries,buildPreferenceBasis,artworkSetKey} from './profile-evidence.mjs';
import {isReviewedVisualDescriptor} from './visual-descriptor-semantics.mjs';

export const CURATORIAL_FACETS_VERSION='curatorial-facets-v1';
const unique=values=>[...new Set(values)];
const short=work=>work.shortTitle||work.title;
const LABELS={
  'narrative-detail':'narrative detail','imagined-world':'imagined worlds','dramatic-light':'dramatic light','layered-space':'layered space',
  'geometric-structure':'geometric structure','visible-gesture':'visible bodily action','intimate-figures':'near-view figures',landscape:'landscape'
};
const COMBINATIONS=[
  {id:'stories-worlds',tags:['narrative-detail','imagined-world'],title:'Stories & imagined worlds',description:'secondary incidents or objects, together with visibly fantastical settings or figures'},
  {id:'light-figures',tags:['dramatic-light','intimate-figures'],title:'Light & human presence',description:'selective light staging near-view figures'},
  {id:'space-landscape',tags:['layered-space','landscape'],title:'Landscape & depth',description:'recognizable terrain or water organized through several spatial stages'},
  {id:'stories-space',tags:['narrative-detail','layered-space'],title:'Scenes within scenes',description:'narrative clues distributed through layered spaces'}
];
const limitations=['These are reviewed, nonexclusive descriptions of the artworks, not measurements of your feelings or the cause of preference.','A missing facet review is unknown. An unassigned tag means only that this editorial criterion was not assigned; it is not evidence that the painting lacks meaning.','A repeated work contributes once. A favourites selection is unranked; its unselected works are not treated as disliked.','The 65/35 overall-appeal bands and minimum-work rules are provisional descriptive thresholds, not population norms.'];
function reviewed(work){
  const value=work?.analysis?.curatorialFacets;
  const declaredHashes=[work?.sha256,work?.provenance?.thumbnailSha256].filter(hash=>hash!==undefined);
  return value?.version===CURATORIAL_FACETS_VERSION&&value.reviewed===true&&typeof work.image==='string'&&value.reviewedImage===work.image&&typeof value.reviewedImageSha256==='string'&&/^[a-f0-9]{64}$/i.test(value.reviewedImageSha256)&&declaredHashes.every(hash=>typeof hash==='string'&&hash.toLowerCase()===value.reviewedImageSha256.toLowerCase())&&Array.isArray(value.tags)&&new Set(value.tags).size===value.tags.length&&value.tags.every(tag=>Object.hasOwn(LABELS,tag))&&Array.isArray(value.sourceUrls)&&typeof work.sourceUrl==='string'&&/^https?:\/\//.test(work.sourceUrl)&&value.sourceUrls.includes(work.sourceUrl)?value:null;
}
function sourceSets(items){
  return unique(items.flatMap(item=>item.history?.length?item.history.map(response=>response.roundId):[item.entry?.round.id]).filter(Boolean));
}
function sufficient(items){
  if(items.length<3)return false;
  const sets=unique(items.map(item=>artworkSetKey(item.entry.round)));
  return sets.length>=2||items.every(item=>item.basis==='overall-favourites')&&unique(items.map(item=>item.entry.round.id)).length===1;
}
function finding(id,title,text,selected,counter,extra={}){
  const support=selected.flatMap(item=>item.support),opposing=counter.flatMap(item=>item.support);
  return {id:'facet-'+id,module:'curatorial-themes',kind:'taste',title,text,support,counter:opposing,evidence:unique([...selected,...counter].map(item=>item.work.id)),priority:13,
    supportingWorkCount:selected.length,counterWorkCount:counter.length,sourceRoundIds:unique([...support,...opposing].map(item=>item.roundId)),
    displayWorkIds:selected.slice(0,2).map(item=>item.work.id),
    sourceUrls:unique([...selected,...counter].flatMap(item=>reviewed(item.work)?.sourceUrls||[])),alternatives:[...limitations],...extra};
}

/** Positive themes use explicit favourites or the new, anchored overall scale.
 * Legacy relative placements are deliberately ineligible for this module.
 */
export function buildFacetReadings({works=[],rounds=[],answers={}}={}){
  const entries=validatedProfileEntries({works,rounds,answers}),basis=buildPreferenceBasis(entries),positive=basis.seeds.filter(item=>reviewed(item.work)),low=basis.ratings.filter(item=>item.score<=35&&reviewed(item.work)),observations=[],themes=[];
  const hasConcentration=(selected,counter)=>low.length>=2&&selected.length*low.length>counter.length*positive.length;
  const byTag=tag=>positive.filter(item=>reviewed(item.work).tags.includes(tag));
  const combinationCandidates=COMBINATIONS.flatMap(combination=>{
    const selected=positive.filter(item=>combination.tags.every(tag=>reviewed(item.work).tags.includes(tag)));
    if(!sufficient(selected))return [];
    const counter=low.filter(item=>combination.tags.every(tag=>reviewed(item.work).tags.includes(tag))),outside=positive.filter(item=>!combination.tags.some(tag=>reviewed(item.work).tags.includes(tag)));
    return [{combination,selected,counter,outside}];
  }).sort((a,b)=>b.selected.length-a.selected.length||a.counter.length-b.counter.length);
  for(const {combination,selected,counter,outside}of combinationCandidates){
    const observation=finding(combination.id,combination.title,`${short(selected[0].work)} and ${short(selected[1].work)} share ${combination.description}. ${selected.length} positively chosen works carry this combination.${counter.length?` ${counter.length} lower-rated work${counter.length===1?' carries':'s carry'} it too.`:''}`,selected,counter,{tags:combination.tags,positiveExceptions:outside.map(item=>({workId:item.work.id,support:item.support})),comparisonBasis:basis.basis,sourceSetCount:unique(selected.map(item=>artworkSetKey(item.entry.round))).length,patternStatus:counter.length>=selected.length?'shared-with-lower-ratings':'positive-combination',priority:counter.length>=selected.length?8:13});
    observation.favouriteWorkCount=selected.filter(item=>item.basis==='overall-favourites').length;
    observation.reviewedComparison={positiveWithConnection:selected.length,reviewedPositiveWorks:positive.length,lowerRatedWithConnection:counter.length,reviewedLowerRatedWorks:low.length};
    observation.summaryEligible=observation.favouriteWorkCount>=2||hasConcentration(selected,counter);
    observations.push(observation);if(observation.summaryEligible)themes.push({id:observation.id,title:combination.title,findingIds:[observation.id],workIds:selected.map(item=>item.work.id),support:observation.support,counter:observation.counter,priority:observation.priority,favouriteWorkCount:observation.favouriteWorkCount,basis:'reviewed-facets-of-positive-choices'});
  }
  if(!observations.length){
    const tagCandidates=Object.keys(LABELS).map(tag=>({tag,selected:byTag(tag)})).filter(item=>sufficient(item.selected)).sort((a,b)=>b.selected.length-a.selected.length);
    for(const {tag,selected}of tagCandidates.slice(0,2)){
      const counter=low.filter(item=>reviewed(item.work).tags.includes(tag)),title=LABELS[tag].replace(/^./,letter=>letter.toUpperCase())+' connections';
      const observation=finding('tag-'+tag,title,`${selected.length} positively chosen works, including ${short(selected[0].work)} and ${short(selected[1].work)}, share the reviewed description “${LABELS[tag]}”.${counter.length?` ${counter.length} lower-rated work${counter.length===1?' shares':'s share'} this description, so it does not separate every choice.`:''}`,selected,counter,{tags:[tag],comparisonBasis:basis.basis});
      observation.favouriteWorkCount=selected.filter(item=>item.basis==='overall-favourites').length;
      observation.reviewedComparison={positiveWithConnection:selected.length,reviewedPositiveWorks:positive.length,lowerRatedWithConnection:counter.length,reviewedLowerRatedWorks:low.length};
      observation.summaryEligible=tag!=='landscape'&&(observation.favouriteWorkCount>=3||hasConcentration(selected,counter));
      observations.push(observation);if(observation.summaryEligible)themes.push({id:observation.id,title,findingIds:[observation.id],workIds:selected.map(item=>item.work.id),support:observation.support,counter:observation.counter,priority:observation.priority,favouriteWorkCount:observation.favouriteWorkCount,basis:'reviewed-facets-of-positive-choices'});
    }
  }
  // A broad, positively endorsed range must remain visible even if a regression
  // over all comparison pairs happens to lean toward one end of density.
  const allPositive=basis.seeds,sparse=allPositive.filter(item=>isReviewedVisualDescriptor(item.work,'complexity')&&item.work.features.complexity<=.3),dense=allPositive.filter(item=>isReviewedVisualDescriptor(item.work,'complexity')&&item.work.features.complexity>=.7);
  if(sparse.length>=2&&dense.length>=2&&(unique([...sparse,...dense].map(item=>artworkSetKey(item.entry.round))).length>=2||[...sparse,...dense].every(item=>item.basis==='overall-favourites'))){
    const selected=[...sparse,...dense],display=[sparse[0],dense[0]],observation=finding('density-range','Both restraint and detail.',`Your positive choices include both spare compositions, such as ${short(sparse[0].work)}, and denser ones, such as ${short(dense[0].work)}. Detail alone does not separate the paintings you like.`,selected,[],{module:'choice-range',feature:'complexity',sparseWorkIds:sparse.map(item=>item.work.id),denseWorkIds:dense.map(item=>item.work.id),priority:9,displayWorkIds:display.map(item=>item.work.id),displayNotes:Object.fromEntries(display.map((item,index)=>[item.work.id,{description:index?'Dense composition':'Sparse composition',basis:item.basis==='overall-favourites'?'Explicit favourite':'Positive overall appeal'}])),sourceUrls:unique(selected.flatMap(item=>[item.work.sourceUrl].filter(Boolean))),alternatives:[...limitations,'Density is a provisional visual annotation. Enjoying both ends does not mean that detail never matters; it prevents describing your whole preference as simply sparse or dense.']});
    observations.push(observation);
  }
  return {observations,themes,coverage:{positiveWorks:basis.seeds.length,reviewedPositiveWorks:positive.length,reviewedLowWorks:low.length,tagWorkCounts:Object.fromEntries(Object.keys(LABELS).map(tag=>[tag,byTag(tag).length]))},limits:[...limitations],sourceRoundIds:sourceSets(positive)};
}
