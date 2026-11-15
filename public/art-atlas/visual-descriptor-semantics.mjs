// Meaning of these two annotations changed after reviewing the reproductions.
// This marker certifies the descriptor definition, not psychometric validity.
export const FEATURE_SEMANTIC_VERSION='literal-action-setting-v1';
const FEATURES=new Set(['abstraction','energy','complexity','humanity','narrative','atmosphere','color']);
const REQUIRES_LITERAL_REVIEW=new Set(['narrative','atmosphere']);

export function isReviewedVisualDescriptor(work,key){
  const value=work?.features?.[key];
  return FEATURES.has(key)&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1&&(!REQUIRES_LITERAL_REVIEW.has(key)||work.featureSemanticVersion===FEATURE_SEMANTIC_VERSION);
}
