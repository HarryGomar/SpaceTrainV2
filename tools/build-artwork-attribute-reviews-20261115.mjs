import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveArtworkMedia} from '../public/art-atlas/artwork-media.mjs';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_LIMITS} from '../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';

const site=new URL('../public/art-atlas/',import.meta.url);
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const observations=JSON.parse(fs.readFileSync(new URL('artwork-attribute-observations-20261115.json',import.meta.url),'utf8'));
const contextPath=new URL('artwork-attribute-context-20261115.json',import.meta.url);
const contexts=fs.existsSync(contextPath)?JSON.parse(fs.readFileSync(contextPath,'utf8')):{};
const byId=new Map(works.map(work=>[work.id,work]));
const keys={N:'narrative-detail',I:'imagined-world',D:'dramatic-light',S:'layered-space',G:'geometric-structure',V:'visible-gesture',F:'intimate-figures',L:'landscape',X:'expressive-distortion',P:'precise-rendering',B:'visible-paint-marks',R:'pattern-rhythm',H:'human-relationships',T:'theatrical-staging',M:'material-detail',O:'open-expanse'};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const reviews={},currentAssetReferences={},verifiedAt=new Date().toISOString();
for(const [id,observation] of Object.entries(observations)){
  const work=byId.get(id);if(!work)throw Error('Reviewed identity unavailable: '+id);
  const present=observation.present||{},unknown=observation.unknown||{};
  if(Object.keys(present).some(key=>!keys[key]||Object.hasOwn(unknown,key))||Object.keys(unknown).some(key=>!keys[key]))throw Error('Ambiguous or unknown reviewed criterion: '+id);
  const previewBytes=fs.readFileSync(new URL(work.image,site)),previewSha256=digest(previewBytes),media=resolveArtworkMedia(work,{preferLarge:true}),reviewBytes=fs.readFileSync(new URL(media.src,site)),measured=imageDimensions(reviewBytes);
  currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])]={sourceUrl:work.sourceUrl,image:work.image,previewSha256,verification:'sha256-of-current-local-preview',verifiedAt};
  if(measured.width!==media.width||measured.height!==media.height)throw Error('Review image dimensions differ from source binding: '+id);
  const attributes=Object.fromEntries(Object.entries(keys).map(([short,key])=>[
    key,{status:Object.hasOwn(present,short)?'present':Object.hasOwn(unknown,short)?'unknown':'absent',reason:present[short]||unknown[short]||ARTWORK_ATTRIBUTE_DEFINITIONS[key].absentReason,evidenceKind:'visual-review'}
  ]));
  const sourcedContext=contexts[id]||[];
  for(const item of sourcedContext)if(!item.claim||!/^https:\/\//.test(item.sourceUrl)||item.evidenceKind!=='primary-source-context')throw Error('Unbound documentary context: '+id);
  reviews[id]={version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',
    sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256},
    reviewedAsset:{image:media.src,sha256:digest(reviewBytes),width:measured.width,height:measured.height,mediaBinding:media.mediaBinding,compositionMatch:'same-composition',sourceLimited:media.sourceLimited},
    sourceUrls:[...new Set([work.sourceUrl,...sourcedContext.map(item=>item.sourceUrl)])],
    reviewMethod:'Assistant visual review of the resolved local reproduction against all sixteen criteria. Every unlisted criterion in the signed observation checklist was assessed as absent; unresolved criteria were explicitly recorded as unknown. No artist or movement defaults were used.',
    attributes,sourcedContext,
    contextStatus:sourcedContext.length?'documented-context-available':'not-documented-in-this-review'};
}
const output={version:ARTWORK_ATTRIBUTE_VERSION,reviewerType:'assistant-visual-review',reviewedAt:verifiedAt,
  description:'Source-bound editorial descriptions of visible content and treatment. Documentary meanings are separate from visual assignments.',
  attributeKeys:Object.values(keys),reviewedCount:Object.keys(reviews).length,
  limits:[...ARTWORK_ATTRIBUTE_LIMITS,'A whole work can contain different treatments in different areas. A present feature does not establish that a viewer noticed or responded to it.','The reviewedAsset can offer more detail than the preview. These are descriptions of the artwork reproduction, not a reconstruction of the viewer\'s gaze or viewing conditions.','Current editorial interpretation may accompany an older response only when its original artwork source and preview identity are verified; it must be labelled as current interpretation, not a historical participant answer.'],
  unknownSemantics:{missingReview:'unknown',versionMismatch:'unknown',sourceMismatch:'unknown',unknownStatus:'unknown',explicitAbsent:'Observed negative only for this defined criterion at the reviewed reproduction scale.',missingSymbolism:'Unknown documentation, never evidence that the work has no symbolism.'},
  currentAssetReferenceScope:'These independently computed current catalogue asset references verify current local bytes. They do not assert that an older capture recorded a hash or prove its historical byte contents.',
  currentAssetReferences,reviews};
const target=new URL('artwork-attribute-reviews.json',site);fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({file:fileURLToPath(target),reviewedCount:output.reviewedCount,attributes:output.attributeKeys.length,bytes:fs.statSync(target).size}));
