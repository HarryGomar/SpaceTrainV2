import STUDY_IMAGE_SOURCES from './study-image-sources.json' with {type:'json'};

export const ARTWORK_MEDIA_REVISION='study-media-v1';
const localImage=value=>typeof value==='string'&&/^assets\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(value)&&!value.includes('..');
const positive=value=>Number.isInteger(value)&&value>0;

/** Exact source bindings prevent a current image upgrade changing a frozen work. */
export function resolveArtworkMedia(work,{preferLarge=false,responsive=false}={}){
  const small=typeof work?.image==='string'?work.image:'',entry=STUDY_IMAGE_SOURCES.entries?.[work?.id],identity=entry?.sourceIdentity;
  const matches=!!identity&&work.sourceUrl===identity.sourceUrl&&small===identity.image&&(work.imageSourceUrl||null)===identity.imageSourceUrl&&localImage(entry.imageLarge)&&positive(entry.largeWidth)&&positive(entry.largeHeight);
  // New verified collection records carry their own source-bound local asset.
  // A frozen record keeps those explicit fields; it does not borrow another ID.
  const explicit=!matches&&localImage(work?.imageLarge)&&positive(work?.largeWidth)&&positive(work?.largeHeight);
  const large=matches?entry:explicit?work:null;
  const width=matches?entry.smallWidth:work?.width,height=matches?entry.smallHeight:work?.height;
  const result={src:small,width:positive(width)?width:undefined,height:positive(height)?height:undefined,matchedLargeSource:!!large,mediaBinding:matches?'source-matched-study-map':explicit?'explicit-record':'small-only',imageLarge:large?.imageLarge||null,largeWidth:large?.largeWidth||null,largeHeight:large?.largeHeight||null,nativeWidth:large?.largeWidth||(positive(width)?width:null),nativeHeight:large?.largeHeight||(positive(height)?height:null),sourceLimited:!large||large.qualityStatus==='source-limited'||Math.max(large.largeWidth,large.largeHeight)<2000};
  if(large&&preferLarge)Object.assign(result,{src:large.imageLarge,width:large.largeWidth,height:large.largeHeight});
  if(large&&responsive&&positive(width)&&large.largeWidth>width)result.srcSet=small+' '+width+'w, '+large.imageLarge+' '+large.largeWidth+'w';
  return result;
}
