import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_LIMITS} from '../public/art-atlas/artwork-attribute-definitions.mjs';
import {resolveArtworkMedia} from '../public/art-atlas/artwork-media.mjs';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';

const site=new URL('../public/art-atlas/',import.meta.url),target=new URL('../artifacts/art-atlas/core-remainder-attribute-reviews.json',import.meta.url);
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const originalIds=new Set(works.slice(0,164).map(w=>w.id));
const observations=JSON.parse(fs.readFileSync(new URL('core-remainder-observations-20261115.json',import.meta.url),'utf8'));
const originalReviews=new Set(Object.keys(JSON.parse(fs.readFileSync(new URL('artwork-attribute-observations-20261115.json',import.meta.url),'utf8'))));
const byId=new Map(works.map(w=>[w.id,w]));
const keys={N:'narrative-detail',I:'imagined-world',D:'dramatic-light',S:'layered-space',G:'geometric-structure',V:'visible-gesture',F:'intimate-figures',L:'landscape',X:'expressive-distortion',P:'precise-rendering',B:'visible-paint-marks',R:'pattern-rhythm',H:'human-relationships',T:'theatrical-staging',M:'material-detail',O:'open-expanse'};
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
if(Object.keys(observations).length!==68||originalReviews.size!==96)throw Error('Original164 review partition changed');
const reviews={},currentAssetReferences={},verifiedAt=new Date().toISOString();let contactNumber=0;
for(const [id,observation] of Object.entries(observations)){
  if(!originalIds.has(id)||originalReviews.has(id)||id.startsWith('req-')||id.startsWith('extended-'))throw Error('Not an unreviewed original164 work: '+id);
  const work=byId.get(id),preview=fs.readFileSync(new URL(work.image,site)),previewSha256=sha(preview),media=resolveArtworkMedia(work,{preferLarge:true}),reviewBytes=fs.readFileSync(new URL(media.src,site)),size=imageDimensions(reviewBytes);
  if(size.width!==media.width||size.height!==media.height)throw Error('Incorrect resolved source dimensions: '+id);
  for(const declared of [work.sha256,work.provenance?.sha256,work.provenance?.thumbnailSha256,work.provenance?.download?.sha256].filter(Boolean))if(declared!==previewSha256)throw Error('Declared preview hash mismatch: '+id);
  const present=observation.present||{},unknown=observation.unknown||{};
  if(Object.keys(present).some(k=>!keys[k]||Object.hasOwn(unknown,k))||Object.keys(unknown).some(k=>!keys[k]))throw Error('Contradictory or undefined criterion: '+id);
  const sourceIdentity={sourceUrl:work.sourceUrl,image:work.image,previewSha256};
  currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])]={...sourceIdentity,verification:'sha256-of-current-local-preview',verifiedAt};
  const attributes=Object.fromEntries(Object.entries(keys).map(([short,key])=>[key,{status:present[short]?'present':unknown[short]?'unknown':'absent',reason:present[short]||unknown[short]||ARTWORK_ATTRIBUTE_DEFINITIONS[key].absentReason,evidenceKind:'visual-review'}]));
  reviews[id]={version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity,
    reviewedAsset:{image:media.src,sha256:sha(reviewBytes),width:size.width,height:size.height,mediaBinding:media.mediaBinding,compositionMatch:'same-composition',sourceLimited:media.sourceLimited,displayScale:'Whole-reproduction contact-sheet review, maximum384 by440display pixels; fine or ambiguous evidence explicitly unknown.'},
    sourceUrls:[...new Set([work.sourceUrl,work.rightsUrl].filter(url=>/^https:\/\//.test(url)))],contactNumber:++contactNumber,
    reviewMethod:'Assistant inspected the resolved actual local reproduction through a numbered whole-work contact sheet and checked all sixteen criteria. Unlisted checklist criteria were explicitly assessed absent; unresolved details were recorded unknown. No artist or movement defaults were used. This is editorial image review, not independent human validation.',
    reviewScope:observation.scope||'Displayed composition only; no viewer emotion, psychological cause or unseen detail inferred.',attributes,sourcedContext:[],contextStatus:'not-documented-in-this-review'};
}
const output={version:ARTWORK_ATTRIBUTE_VERSION,reviewerType:'assistant-visual-review',reviewedAt:verifiedAt,reviewedCount:Object.keys(reviews).length,
  description:'The remaining68 works in the original164-work catalogue. These source-bound editorial descriptions supplement the original96 without changing artwork metadata or participant history.',attributeKeys:Object.values(keys),
  limits:[...ARTWORK_ATTRIBUTE_LIMITS,'Contact-sheet inspection establishes conspicuous visible treatment at the reviewed scale. It is not microscopic surface examination.','No new symbolism, artist nationality, place of execution or movement assignment was inferred in this pass.','The Teotihuacan record describes the surviving fragment, not a reconstruction of its lost original programme.'],
  unknownSemantics:{missingReview:'unknown',sourceMismatch:'unknown',unknownStatus:'unknown',explicitAbsent:'Observed negative for this defined criterion at the reviewed reproduction scale.',missingSymbolism:'Unknown documentation, never evidence that the work lacks symbolism.'},currentAssetReferenceScope:'These independently computed current local hashes verify current preview bytes. They do not assert that an older capture recorded a hash or prove its historical bytes.',currentAssetReferences,reviews};
fs.mkdirSync(new URL('../artifacts/art-atlas/',import.meta.url),{recursive:true});fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
const statuses=Object.values(reviews).flatMap(r=>Object.values(r.attributes));
console.log(JSON.stringify({reviewed:output.reviewedCount,combinedOriginal:originalReviews.size+output.reviewedCount,present:statuses.filter(a=>a.status==='present').length,absent:statuses.filter(a=>a.status==='absent').length,unknown:statuses.filter(a=>a.status==='unknown').length,bytes:fs.statSync(target).size}));
