// Only the strict bodily-action / literally-depicted-setting review supports
// these two meanings. Old saved values remain raw, without acquiring v2.
export const FEATURE_SEMANTIC_VERSION='literal-action-setting-v2';
const FEATURES=new Set(['abstraction','energy','complexity','humanity','narrative','atmosphere','color']);
const REQUIRES_LITERAL_REVIEW=new Set(['narrative','atmosphere']);

export function isReviewedVisualDescriptor(work,key){
  const value=work?.features?.[key];
  if(!FEATURES.has(key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)return false;
  if(!REQUIRES_LITERAL_REVIEW.has(key))return true;
  if(work.featureSemanticVersion!==FEATURE_SEMANTIC_VERSION)return false;
  const review=work.featureLiteralReview;
  // A v2 marker can be used in synthetic fixtures without an editorial ledger.
  // When a field review is supplied, unknown/pending and stale numeric values
  // must fail even if a raw draft number was retained in the feature object.
  if(review!==undefined){
    const field=review?.fields?.[key],identity=review?.sourceIdentity;
    if(review?.version!==FEATURE_SEMANTIC_VERSION||review.reviewed!==true||field?.status!=='reviewed'||field.value!==value)return false;
    if(identity&&(identity.sourceUrl!==work.sourceUrl||identity.image!==work.image))return false;
  }
  return true;
}
