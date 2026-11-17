import {CONTEXT_CHANGE_PROTOCOL} from './context-change.mjs';
import {CONTINUOUS_PROTOCOL} from './continuous-preference.mjs';
import {canDescribeOverallTaste} from './explanation-ranking.mjs';
const unique=values=>[...new Set(values)];
const names={
  'human-presence':['Subjects & settings','Human presence'],
  'representation-abstraction':['Recognizable forms','Abstract form'],
  colour:['Restrained colour','Strong colour'],
  'detail-composition':['Spare composition','Detail & density'],
  'action-stillness':['Stillness','Depicted action'],
  'setting-atmosphere':['Subjects up close','Setting & atmosphere']
};
const qualityPhrases={
  'narrative-detail':'story clues beyond the main subject','imagined-world':'fantastical imagery','dramatic-light':'selective light and deep shadow','layered-space':'layered spaces','geometric-structure':'clear geometric structure','visible-gesture':'expressive bodily action','intimate-figures':'closely framed figures',landscape:'natural settings','expressive-distortion':'recognisable forms altered through distortion','precise-rendering':'controlled edges and fine detail','visible-paint-marks':'visible strokes and painterly marks','pattern-rhythm':'repeated shapes and visual rhythm','human-relationships':'interactions between people','theatrical-staging':'theatrically arranged scenes','material-detail':'carefully described material surfaces','open-expanse':'large open fields of space',
  'scenes-within-scenes':'narrative clues spread through layered spaces','precisely-imagined':'impossible imagery rendered with precision','light-and-figures':'selective lighting around closely framed figures','distortion-and-gesture':'distorted forms and emphatic gestures','structure-and-rhythm':'geometric order and repeated shapes','staged-relationships':'relationships between people staged as encounters','stories-and-worlds':'narrative clues within fantastical worlds','precise-materials':'precise rendering of fabric, metal and other surfaces'
};
function qualitySummary(pattern,fallback){
  if(pattern.text)return pattern.text;
  const phrase=qualityPhrases[pattern.qualityKey];if(!phrase)return fallback;
  if(pattern.channel==='explicit-favourites')return `Several of your favourites share ${phrase}.`;
  if(pattern.channel==='admiration-of-making')return `Your admiration repeatedly favours ${phrase}.`;
  if(pattern.status==='descriptive-association')return `Your higher ${pattern.channel==='personal-appeal'?'personal-appeal':'overall'} ratings cluster around ${phrase}.`;
  return `Your comparisons repeatedly favour ${phrase}.`;
}

/** A one-off reversal is evidence to explore, never an overall taste profile. */
export function composeTasteSummary({works=[],tastePatterns={},tasteBoundaries={},reportedContextChanges={},axesProfile={},themes=[],observations=[],legacyBasis='observed-comparisons'}={}){
  const contextSummary=reportedContextChanges.summary?.measurementScope===CONTEXT_CHANGE_PROTOCOL&&reportedContextChanges.summary.distinctWorkCount>=2&&new Set(reportedContextChanges.summary.workIds||[]).size>=2&&reportedContextChanges.summary.sourceRoundIds?.length>=2?reportedContextChanges.summary:null;
  const boundaryCandidates=[...(tasteBoundaries.findings||[]),...(tasteBoundaries.explicitChoices?.findings||[])],boundary=boundaryCandidates.filter(item=>item?.status==='explicit-choice-contrast'&&item.summaryEligible===true&&item.measurementScope==='explicit-favourite-dislike-choices'&&[1,-1].includes(item.direction)&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.text==='string'&&Array.isArray(item.highWorkIds)&&new Set(item.highWorkIds).size>=3&&Array.isArray(item.lowWorkIds)&&new Set(item.lowWorkIds).size>=3&&item.highWorkIds.every(id=>!item.lowWorkIds.includes(id))&&Array.isArray(item.supportPairs)&&item.supportPairs.length>=3&&item.coverage?.favouriteArtists>=3&&item.coverage?.dislikeArtists>=3&&item.coverage?.distinctDiscoverySets>=3).sort((a,b)=>(b.priority||0)-(a.priority||0))[0];
  const continuousBoundary=(tasteBoundaries.continuousFindings||[]).find(item=>item.status==='exploratory-contrast'&&item.summaryEligible===true&&item.measurementScope===CONTINUOUS_PROTOCOL&&item.highWorkIds?.length>=3&&item.lowWorkIds?.length>=3&&item.coverage?.highArtists>=3&&item.coverage?.lowArtists>=3&&item.coverage?.distinctDiscoverySets>=3&&item.supportPairs?.length>=2);
  const qualified=(tastePatterns.patterns||[]).filter(canDescribeOverallTaste);
  const proposed=tastePatterns.readingSummary;
  if(proposed?.patternIds?.length&&proposed.patternIds.every(id=>qualified.some(item=>item.id===id))){
    const leading=qualified.find(item=>item.id===proposed.patternIds[0]);
    const threads=(proposed.principalPatternIds||proposed.patternIds).map(id=>qualified.find(item=>item.id===id)).filter(item=>item&&typeof item.title==='string').slice(0,2),byId=new Map(works.map(work=>[work.id,work])),short=id=>byId.get(id)?.shortTitle||byId.get(id)?.title;
    const title=threads.length>1?threads.map(item=>item.title).join(' & '):proposed.title;
    let text=qualitySummary(leading,proposed.text);
    if(threads.length>1){
      const [first,second]=threads,common=(first.recordFit?.favouritesWithQuality||[]).filter(id=>second.recordFit?.favouritesWithQuality.includes(id)),outside=(threads.find(item=>item.recordFit?.favouriteSpecific)||first).recordFit?.favouritesWithoutQuality||[];
      const broad=threads.find(item=>item.recordFit?.broadAssociationEligible),favouriteSpecific=threads.find(item=>item.recordFit?.favouriteSpecific),tail=favouriteSpecific||first;
      text=broad&&favouriteSpecific?'Your appeal ratings and favourites both point to '+(qualityPhrases[broad.qualityKey]||broad.title.toLowerCase())+'. '+favouriteSpecific.title+' is especially visible among your favourites'+(favouriteSpecific.recordFit.broadAssociationOpposed?', although paintings without it tended to appeal more across your broader ratings.':', with weaker support as a general preference.'):'Your favourites connect through '+first.title.toLowerCase()+' and '+second.title.toLowerCase()+'.';
      if(common.length&&common.map(short).every(Boolean))text+=' '+common.slice(0,2).map(short).join(' and ')+' bring the two together.';
      if(outside.length&&short(outside[0]))text+=' '+short(outside[0])+' is a favourite without '+tail.title.toLowerCase()+', so this is one route into your choices rather than a requirement.';
    }
    return {title,text,threads:threads.map(item=>({id:item.id,title:item.title,qualityKey:item.qualityKey,text:item.text,workIds:item.recordFit?.favouritesWithQuality||item.favouriteWorkIds||item.displayWorkIds||[],recordFit:item.recordFit,channel:item.channel})),findingIds:unique([...(threads.length?threads.map(item=>item.id):proposed.patternIds),...(leading.arrangementConnections||[]).map(item=>item.sourceFindingId),...(boundary?[boundary.id]:[])]),workIds:unique(threads.length?threads.flatMap(item=>item.recordFit?.favouritesWithQuality||item.displayWorkIds||[]):proposed.workIds||[]),basis:'reviewed-quality-patterns',...(boundary?{boundaryFindingIds:[boundary.id]}:{})};
  }
  if(boundary)return {title:boundary.title,text:boundary.text,findingIds:[boundary.id],workIds:unique(boundary.highWorkIds),comparisonWorkIds:[...(boundary.displayWorkIds||[])],basis:'explicit-choice-contrast'};
  if(continuousBoundary)return {title:continuousBoundary.title,text:continuousBoundary.text,findingIds:[continuousBoundary.id],workIds:unique(continuousBoundary.highWorkIds),comparisonWorkIds:[...continuousBoundary.displayWorkIds],basis:'continuous-choice-contrast'};
  const axes=(axesProfile.axes||[]).filter(axis=>axis.status==='leaning'&&axis.summaryEligible!==false&&[1,-1].includes(axis.direction)&&axis.eligibleSetCount>=3&&names[axis.key]).sort((a,b)=>(b.supportingSetCount-b.opposingSetCount)-(a.supportingSetCount-a.opposingSetCount)||b.eligibleSetCount-a.eligibleSetCount).slice(0,2);
  if(axes.length){
    return {title:axes.map(axis=>names[axis.key][axis.direction>0?1:0]).join(' · '),text:axes.map(axis=>axis.summary).filter(Boolean).join(' '),findingIds:axes.map(axis=>'axis-'+axis.key),workIds:unique(axes.flatMap(axis=>axis.displayWorkIds||[])),basis:'recurring-visual-comparisons'};
  }
  const eligibleThemes=themes.filter(theme=>Array.isArray(theme.findingIds)&&theme.findingIds.length&&theme.findingIds.every(id=>observations.some(item=>item.id===id&&['curatorial-themes','scene-and-meaning','tension-and-return'].includes(item.module)))).slice(0,2);
  if(eligibleThemes.length){
    const first=observations.find(item=>item.id===eligibleThemes[0].findingIds[0]);
    return {title:eligibleThemes.map(theme=>theme.title).join(' · '),text:first.text?.split(/(?<=[.!?])\s+/)[0]||'',findingIds:unique(eligibleThemes.flatMap(theme=>theme.findingIds)),workIds:unique(eligibleThemes.flatMap(theme=>theme.workIds||[])),basis:legacyBasis};
  }
  if(contextSummary)return {title:'Context & appreciation',text:contextSummary.text,findingIds:[contextSummary.id],workIds:[...contextSummary.displayWorkIds],basis:'direct-context-reports'};
  return {title:'Art profile',text:'More comparisons are needed to separate a recurring pattern.',findingIds:[],workIds:[],basis:'insufficient-recurring-patterns'};
}
