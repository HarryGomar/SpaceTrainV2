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
  const phrase=qualityPhrases[pattern.qualityKey];if(!phrase)return fallback;
  if(pattern.channel==='explicit-favourites')return `Several of your favourites share ${phrase}.`;
  if(pattern.channel==='admiration-of-making')return `Your admiration repeatedly favours ${phrase}.`;
  if(pattern.status==='descriptive-association')return `Your higher overall ratings cluster around ${phrase}.`;
  return `Your comparisons repeatedly favour ${phrase}.`;
}

/** A one-off reversal is evidence to explore, never an overall taste profile. */
export function composeTasteSummary({tastePatterns={},tasteBoundaries={},axesProfile={},themes=[],observations=[],legacyBasis='observed-comparisons'}={}){
  const boundaryCandidates=[...(tasteBoundaries.findings||[]),...(tasteBoundaries.explicitChoices?.findings||[])],boundary=boundaryCandidates.filter(item=>item?.status==='explicit-choice-contrast'&&item.summaryEligible===true&&item.measurementScope==='explicit-favourite-dislike-choices'&&[1,-1].includes(item.direction)&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.text==='string'&&Array.isArray(item.highWorkIds)&&new Set(item.highWorkIds).size>=3&&Array.isArray(item.lowWorkIds)&&new Set(item.lowWorkIds).size>=3&&item.highWorkIds.every(id=>!item.lowWorkIds.includes(id))&&Array.isArray(item.supportPairs)&&item.supportPairs.length>=3&&item.coverage?.favouriteArtists>=3&&item.coverage?.dislikeArtists>=3&&item.coverage?.distinctDiscoverySets>=3).sort((a,b)=>(b.priority||0)-(a.priority||0))[0];
  const qualified=(tastePatterns.patterns||[]).filter(item=>['qualified','descriptive','descriptive-association'].includes(item.status)&&item.summaryEligible===true&&item.direction!==-1);
  const proposed=tastePatterns.readingSummary;
  if(proposed?.patternIds?.length&&proposed.patternIds.every(id=>qualified.some(item=>item.id===id))){
    const leading=qualified.find(item=>item.id===proposed.patternIds[0]);
    return {title:proposed.title,text:qualitySummary(leading,proposed.text),findingIds:unique([...proposed.patternIds,...(boundary?[boundary.id]:[])]),workIds:unique(proposed.workIds||[]),basis:'reviewed-quality-patterns',...(boundary?{boundaryFindingIds:[boundary.id]}:{})};
  }
  if(boundary)return {title:boundary.title,text:boundary.text,findingIds:[boundary.id],workIds:unique(boundary.highWorkIds),comparisonWorkIds:[...(boundary.displayWorkIds||[])],basis:'explicit-choice-contrast'};
  const axes=(axesProfile.axes||[]).filter(axis=>axis.status==='leaning'&&[1,-1].includes(axis.direction)&&axis.eligibleSetCount>=3&&names[axis.key]).sort((a,b)=>(b.supportingSetCount-b.opposingSetCount)-(a.supportingSetCount-a.opposingSetCount)||b.eligibleSetCount-a.eligibleSetCount).slice(0,2);
  if(axes.length){
    return {title:axes.map(axis=>names[axis.key][axis.direction>0?1:0]).join(' · '),text:axes.map(axis=>axis.summary).filter(Boolean).join(' '),findingIds:axes.map(axis=>'axis-'+axis.key),workIds:unique(axes.flatMap(axis=>axis.displayWorkIds||[])),basis:'recurring-visual-comparisons'};
  }
  const eligibleThemes=themes.filter(theme=>Array.isArray(theme.findingIds)&&theme.findingIds.length&&theme.findingIds.every(id=>observations.some(item=>item.id===id&&['curatorial-themes','making-and-taste','scene-and-meaning','tension-and-return'].includes(item.module)))).slice(0,2);
  if(eligibleThemes.length){
    const first=observations.find(item=>item.id===eligibleThemes[0].findingIds[0]);
    return {title:eligibleThemes.map(theme=>theme.title).join(' · '),text:first.text?.split(/(?<=[.!?])\s+/)[0]||'',findingIds:unique(eligibleThemes.flatMap(theme=>theme.findingIds)),workIds:unique(eligibleThemes.flatMap(theme=>theme.workIds||[])),basis:legacyBasis};
  }
  return {title:'Art profile',text:'More comparisons are needed to separate a recurring pattern.',findingIds:[],workIds:[],basis:'insufficient-recurring-patterns'};
}
