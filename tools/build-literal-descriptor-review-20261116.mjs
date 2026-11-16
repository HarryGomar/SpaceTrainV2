import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {resolveArtworkMedia} from '../public/art-atlas/artwork-media.mjs';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';
import {journeyCurationNotes} from '../public/art-atlas/journey-bank.mjs';

export const STRICT_LITERAL_VERSION='literal-action-setting-v2';
export const PENDING_LITERAL_VERSION='pending-literal-action-setting-review';
export const FEATURE_KEYS=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
export const LITERAL_KEYS=['narrative','atmosphere'];
const root=new URL('../',import.meta.url),site=new URL('public/art-atlas/',root);
const readJson=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const validValue=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const sameArray=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const localImage=image=>typeof image==='string'&&/^assets\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png)$/i.test(image)&&!image.includes('..');

export function literalObservations(){
  const files=['literal-core-audit-20261116.json','literal-required-audit-20261116.json','literal-bulk-audit-20261116.json'];
  const sets=files.map(name=>readJson(new URL(name,import.meta.url)));
  if(sets.map(x=>Object.keys(x).length).join(',')!=='164,16,78')throw Error('Strict review allocation changed');
  const merged=Object.assign({},...sets);
  if(Object.keys(merged).length!==258)throw Error('Duplicate work in literal review sets');
  return {observations:merged,sets:Object.fromEntries(['original','required','bulk'].map((key,i)=>[key,Object.keys(sets[i])]))};
}

function sourceIdentity(work){
  if(!localImage(work.image)||!/^https:\/\//.test(work.sourceUrl))throw Error('Unsafe or missing source identity: '+work.id);
  const bytes=fs.readFileSync(new URL(work.image,site)),previewSha256=digest(bytes);
  imageDimensions(bytes);
  for(const declared of [work.sha256,work.provenance?.sha256,work.provenance?.thumbnailSha256,work.provenance?.download?.sha256].filter(Boolean))if(declared!==previewSha256)throw Error('Declared preview hash mismatch: '+work.id);
  return {sourceUrl:work.sourceUrl,image:work.image,previewSha256};
}

/** Produce a review snapshot. No catalogue, asset or participant file is changed. */
export function buildLiteralDescriptorPackage({works=readJson(new URL('artworks.json',site)),reviewedAt=new Date().toISOString()}={}){
  const {observations,sets}=literalObservations(),manifest=readJson(new URL('tools/art-atlas-expansion-manifest-20261115.json',root));
  const bindings=readJson(new URL('literal-review-source-bindings-20261116.json',import.meta.url)).entries;
  if(!sameArray(Object.keys(bindings),Object.keys(observations)))throw Error('Source-bound review inventory changed');
  const byId=new Map(works.map(work=>[work.id,work])),bulkIds=new Set(manifest.collection.workIds),requiredIds=new Set(manifest.required.workIds);
  if(!sameArray(sets.original,works.slice(0,164).map(work=>work.id)))throw Error('The original164 identities changed');
  if(sets.required.some(id=>!requiredIds.has(id))||sets.bulk.some(id=>!bulkIds.has(id)))throw Error('Review outside the approved source inventory');
  const reviews={},withheld={},excluded={},currentAssetReferences={};
  for(const [id,observation] of Object.entries(observations)){
    const work=byId.get(id);
    if(!work||observation.length!==3||!validValue(observation[0])||!validValue(observation[1])||typeof observation[2]!=='string'||observation[2].length<30)throw Error('Incomplete manual observation: '+id);
    const identity=sourceIdentity(work),media=resolveArtworkMedia(work,{preferLarge:true});
    const binding=bindings[id];
    if(JSON.stringify(identity)!==JSON.stringify(binding.sourceIdentity))throw Error('Reviewed source identity changed: '+id);
    if(!localImage(media.src))throw Error('Unsafe resolved review asset: '+id);
    const bytes=fs.readFileSync(new URL(media.src,site)),dimensions=imageDimensions(bytes);
    if(dimensions.width!==media.width||dimensions.height!==media.height)throw Error('Review asset dimension mismatch: '+id);
    if(media.src!==binding.reviewedAsset.image||digest(bytes)!==binding.reviewedAsset.sha256||dimensions.width!==binding.reviewedAsset.width||dimensions.height!==binding.reviewedAsset.height)throw Error('Reviewed reproduction changed: '+id);
    const before={...binding.before};
    if(FEATURE_KEYS.some(key=>!Number.isFinite(before[key])))throw Error('Expected seven draft values: '+id);
    if(FEATURE_KEYS.filter(key=>!LITERAL_KEYS.includes(key)).some(key=>work.features?.[key]!==before[key]))throw Error('A descriptor outside the literal audit changed: '+id);
    const after={...before,narrative:observation[0],atmosphere:observation[1]};
    const fields=Object.fromEntries(LITERAL_KEYS.map(key=>[key,{status:after[key]===null?'unknown':'reviewed',value:after[key],evidenceKind:'assistant-visual-review',reason:observation[2]}]));
    reviews[id]={version:STRICT_LITERAL_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:identity,
      reviewedAsset:{image:media.src,sha256:digest(bytes),width:dimensions.width,height:dimensions.height,mediaBinding:media.mediaBinding,compositionMatch:'same-composition',sourceLimited:media.sourceLimited,displayScale:'Actual whole-reproduction contact sheets, maximum384 by440 display pixels; selected ambiguous bulk works additionally inspected at native larger scale. Small unresolved bodies are unknown.'},
      sourceUrls:[...new Set([work.sourceUrl,work.provenance?.metadataEvidenceUrl,work.provenance?.recordUrl].filter(url=>typeof url==='string'&&/^https:\/\//.test(url)))],
      beforeFeatureSemanticVersion:binding.beforeFeatureSemanticVersion||null,before,after,fields,
      changedFeatures:LITERAL_KEYS.filter(key=>before[key]!==after[key]),
      reviewedFeatures:[...LITERAL_KEYS],retainedDraftFeatures:FEATURE_KEYS.filter(key=>!LITERAL_KEYS.includes(key)),
      reviewMethod:'Assistant directly inspected the actual local reproduction under the two literal definitions. The remaining five scores were copied unchanged and were not certified by this audit. No artist, movement, title, emotional mood, brushwork energy or quality-tag defaults supply a literal score. This is editorial review, not independent human validation.',
      proposedFeatureSemanticVersion:STRICT_LITERAL_VERSION};
    currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])]={...identity,verification:'sha256-of-current-local-preview',verifiedAt:reviewedAt};
  }
  for(const id of bulkIds){
    if(reviews[id])continue;
    const work=byId.get(id);if(!work)throw Error('Missing current bulk record: '+id);
    const identity=sourceIdentity(work);
    withheld[id]={sourceIdentity:identity,beforeFeatureSemanticVersion:work.featureSemanticVersion||null,retainedDraftFeatures:{...work.features},proposedFeatureSemanticVersion:PENDING_LITERAL_VERSION,
      featureReview:{reviewed:false,fields:{narrative:{status:'pending'},atmosphere:{status:'pending'}},reason:'The previous bulk pass used a broader narrative/mood interpretation. This exact reproduction has not had the independent strict literal action/setting pass. Retain raw draft values as provenance only and exclude these two fields from literal inference, maps and targeting. The other five provisional descriptors are outside this audit.'}};
  }
  for(const id of requiredIds){
    if(reviews[id])continue;
    const work=byId.get(id);if(!work||work.studyEligible!==false||Object.keys(work.features||{}).length)throw Error('Unreviewed required work must remain gallery-only with no scores: '+id);
    excluded[id]={sourceIdentity:sourceIdentity(work),studyEligible:false,featureReview:{reviewed:false,fields:{narrative:{status:'unknown'},atmosphere:{status:'unknown'}},reason:'Gallery-only detail or section. No whole-work literal score is assigned from this partial view.'}};
  }
  if(Object.keys(withheld).length!==202||Object.keys(excluded).length!==3)throw Error('Unexpected pending or gallery-only allocation');
  const firstIds=[...new Set(journeyCurationNotes(works).proposedFirst18Panels.flatMap(panel=>panel.workIds))];
  const all=Object.values(reviews),unknown=Object.entries(reviews).flatMap(([id,r])=>LITERAL_KEYS.filter(key=>r.fields[key].status==='unknown').map(key=>({workId:id,key})));
  const countField=key=>all.filter(review=>review.changedFeatures.includes(key)).length;
  return {version:STRICT_LITERAL_VERSION,reviewedAt,reviewerType:'assistant-visual-review',
    definitions:{narrative:{label:'Depicted action',meaning:'Visible bodily activity of represented people, animals or legible creatures. Posed bodies, dead bodies, implied events, emotional intensity, natural phenomena and energetic paint do not create physical action.',anchors:{0:'Still pose, still objects, or no represented active body.',0.25:'Quiet hand or limb gesture, handling, playing, bracing or minor incidental activity.',0.5:'Clear walking, reaching, coordinated handling or several moderate bodily acts.',0.75:'Strong dancing, running, striking, forceful reaching or substantial exertion.',1:'Intense physical fighting, struggling, cutting, biting or many conspicuous strenuous acts.'}},
      atmosphere:{label:'Emphasis on setting',meaning:'Prominence of a literally depicted surrounding room, built place, terrain, water or vegetation. Mood, lighting, plain colour fields, abstract geometry and ornamental backgrounds do not establish an environment. The photographed wall, frame or dome supporting a mural is not a place depicted inside the work.',anchors:{0:'No depicted surrounding place.',0.25:'Minimal ground, ledge, furniture, curtain or local place cue.',0.5:'Recognisable surrounding place, secondary to dominant figures or objects.',0.75:'Substantial surrounding place across the composition.',1:'The environment is extensive or a primary organising subject.'}}},
    limits:['Coarse ordinal editorial judgements, not calibrated measurements. Numerical differences are not equal psychological intervals.','Only the two literal fields were independently reconsidered. Five other supplied draft descriptors remain provisional and unchanged.','Unknown means unresolved at the inspected reproduction scale. It is never a zero.','Source URLs establish object identity; museums did not author or validate these numeric scores.','The v2 marker must not be granted to unreviewed v1 values. Older captured records remain unchanged but cannot certify current literal semantics.','Current preview hashes verify current bytes. They do not prove what an unhashed historical export contained.'],
    application:{requireExactMatch:['workId','sourceIdentity.sourceUrl','sourceIdentity.image','sourceIdentity.previewSha256'],reviewed:'Apply only to the exact current reproduction. Use the two after-values, including explicit null unknowns, and the v2 marker; retain the prior raw values in provenance. If draft values are retained for unknown fields, the descriptor guard must reject their per-field unknown status.',withheld:'Retain the seven raw values, replace the literal semantic marker with pending-literal-action-setting-review, and record the reason. Do not interpret pending narrative/atmosphere in profiles, maps or selection.',frozen:'Never rewrite saved work or answer snapshots. Frozen v1 literal semantics are unsupported by v2 inference.'},
    summary:{reviewed:all.length,originalCore:sets.original.length,requiredEligible:sets.required.length,bulkReviewed:sets.bulk.length,bulkPending:Object.keys(withheld).length,galleryOnly:Object.keys(excluded).length,changedRecords:all.filter(r=>r.changedFeatures.length).length,unchangedRecords:all.filter(r=>!r.changedFeatures.length).length,changedFields:{narrative:countField('narrative'),atmosphere:countField('atmosphere')},unknownFields:unknown,first72:{count:firstIds.length,reviewed:firstIds.filter(id=>reviews[id]).length,missing:firstIds.filter(id=>!reviews[id])}},
    reviewSets:sets,currentAssetReferences,reviews,withheld,excluded};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=buildLiteralDescriptorPackage(),target=new URL('artifacts/art-atlas/literal-descriptor-review-20261116.json',root);
  fs.mkdirSync(new URL('./',target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary,null,2));
}
