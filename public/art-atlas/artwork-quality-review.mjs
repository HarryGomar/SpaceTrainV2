import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS} from './artwork-attribute-definitions.mjs';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
const attributeKeys=Object.keys(ARTWORK_ATTRIBUTE_DEFINITIONS);

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

