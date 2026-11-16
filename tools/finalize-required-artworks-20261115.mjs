import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_LIMITS} from '../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';

const site=new URL('../public/art-atlas/',import.meta.url),qa=new URL('../qa-output/required-20261115/',import.meta.url),artifacts=new URL('../artifacts/art-atlas/',import.meta.url);
const staged=JSON.parse(fs.readFileSync(new URL('staged-works.json',qa),'utf8'));
const plan=JSON.parse(fs.readFileSync(new URL('required-artworks-plan-20261115.json',import.meta.url),'utf8'));
const observations=JSON.parse(fs.readFileSync(new URL('required-artwork-observations-20261115.json',import.meta.url),'utf8'));
const keys={N:'narrative-detail',I:'imagined-world',D:'dramatic-light',S:'layered-space',G:'geometric-structure',V:'visible-gesture',F:'intimate-figures',L:'landscape',X:'expressive-distortion',P:'precise-rendering',B:'visible-paint-marks',R:'pattern-rhythm',H:'human-relationships',T:'theatrical-staging',M:'material-detail',O:'open-expanse'};
const numeric=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'];
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const current=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const existingIds=new Set(current.map(w=>w.id)),existingHashes=new Set(current.map(w=>sha(fs.readFileSync(new URL(w.image,site)))));
const reviews={},currentAssetReferences={},verifiedAt=new Date().toISOString();
for(const work of staged){
  const observation=observations[work.id],spec=plan.find(w=>w.id===work.id);
  if(!observation||!spec||existingIds.has(work.id))throw Error('Missing reviewed candidate or existing identity: '+work.id);
  const bytes=fs.readFileSync(new URL(work.image,site)),largeBytes=fs.readFileSync(new URL(work.imageLarge,site)),size=imageDimensions(bytes),largeSize=imageDimensions(largeBytes);
  if(sha(bytes)!==work.sha256||sha(largeBytes)!==work.provenance.largeSha256||existingHashes.has(sha(bytes)))throw Error('Mismatched or duplicate reproduction: '+work.id);
  if(size.width!==work.width||size.height!==work.height||largeSize.width!==work.largeWidth||largeSize.height!==work.largeHeight)throw Error('Wrong dimensions: '+work.id);
  work.alt=observation.alt;work.note=observation.note;work.curationRole='required-anchor';work.curationRoleSource='Editorial collection priority only. Not a visitor response, owner preference flag or population familiarity measurement.';
  work.studyEligible=spec.studyEligible!==false&&!observation.scopeUnknown;work.eligibleForStudy=work.studyEligible;
  work.featureReviewReason=observation.reason;
  if(observation.scopeUnknown){
    work.features={};work.featureQuality='unavailable-partial-reproduction';
    work.featureSource='Whole-work descriptors are unknown. This photographed section/detail is gallery research only, not an ordinary study stimulus.';
  }else{
    if(observation.features?.length!==7||observation.features.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Missing individual visual descriptor review: '+work.id);
    work.features=Object.fromEntries(numeric.map((key,i)=>[key,observation.features[i]]));
    work.featureSource='Manual provisional editorial annotations after inspection of this actual reproduction. Narrative means depicted bodily action; atmosphere means emphasis on depicted setting. Physical museum surroundings and visitors are not attributes of the painted composition. These are not validated measurements, reported emotions or psychological causes.';
  }
  work.provenance.visualReview='Actual local reproduction and source identity inspected by an assistant; no artist/movement defaults or fabricated human review.';
  work.provenance.reviewedImageSha256=sha(bytes);work.provenance.compositionScope=work.compositionScope;
  if(work.id==='req-caravaggio-david-borghese')work.analysis.dateAlternatives=[[1606,1607],[1609,1610]];
  if(work.id==='req-dore-quixote-library'){work.analysis.originalDesignYear=1863;work.analysis.scannedEditionYear=1906;work.datePrecision='design-and-edition';}
  const sourceUrls=[...new Set([work.sourceUrl,...(work.sourceUrls||[]),work.rightsUrl])];
  const identity={sourceUrl:work.sourceUrl,image:work.image,previewSha256:sha(bytes)};
  currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])]={...identity,verification:'sha256-of-current-local-preview',verifiedAt};
  const attributes=Object.fromEntries(Object.entries(keys).map(([short,key])=>{
    const present=observation.present?.[short],unknown=observation.unknown?.[short];
    if(present&&unknown)throw Error('Contradictory visual status '+work.id+' '+key);
    return [key,{status:observation.scopeUnknown?'unknown':present?'present':unknown?'unknown':'absent',reason:observation.scopeUnknown?observation.reason:present||unknown||ARTWORK_ATTRIBUTE_DEFINITIONS[key].absentReason,evidenceKind:'visual-review'}];
  }));
  const sourcedContext=[];
  if(work.id==='req-birkhauser-worlds-wound')sourcedContext.push({kind:'documented-title-alias',claim:'The Jung Center archive caption explicitly connects the pictured composition with the earlier title The Split One and the later English title The World\'s Wound. Its archive slide was visually compared with the foundation Der-Gespaltene reproduction.',sourceUrl:'https://jungpage.org/learn/resources/images-of-the-unconscious/888-peter-birkhuser-gallery',sourcePublisher:'The Jung Center of Houston, Dean Frantz slide archive',sourceLocator:'Caption accompanying /images/birkweb/19.jpg',evidenceKind:'primary-source-context'});
  if(work.id==='req-caravaggio-david-borghese')sourcedContext.push({kind:'documented-subject-context',claim:'The Borghese catalogue identifies the face of Goliath as the artist\'s self-portrait. Its interpretation of the sword inscription is presented as a debated scholarly reading, not a visible personality fact.',sourceUrl:work.sourceUrl,sourcePublisher:'Galleria Borghese',sourceLocator:'Object details and catalogue entry',evidenceKind:'primary-source-context'});
  reviews[work.id]={version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity:identity,
    reviewedAsset:{image:work.imageLarge,sha256:sha(largeBytes),width:largeSize.width,height:largeSize.height,mediaBinding:'source-verified-required-reproduction',compositionMatch:'same-composition',sourceLimited:work.provenance.sourceLimited},
    sourceUrls,reviewMethod:observation.scopeUnknown?'Assistant inspected the partial reproduction and deliberately withheld whole-work visual assignments.':'Assistant visually checked all sixteen operational criteria against the actual reproduction. Unlisted checklist criteria were assessed as absent; unresolved evidence was recorded as unknown. No artist/movement defaults were used.',
    reviewScope:observation.scopeUnknown?'partial-view-no-whole-work-inference':'displayed-work-or-explicit-complete-panel',compositionScope:work.compositionScope,attributes,sourcedContext,contextStatus:sourcedContext.length?'documented-context-available':'not-documented-in-this-review'};
}
if(new Set(staged.map(w=>w.id)).size!==staged.length||new Set(staged.map(w=>w.sha256)).size!==staged.length)throw Error('Candidate duplicate ID/image');
fs.mkdirSync(artifacts,{recursive:true});
fs.writeFileSync(new URL('required-expansion-candidates.json',artifacts),JSON.stringify({version:'required-artworks-20261115-v1',preparedAt:verifiedAt,description:'Source-verified collection candidates. Study eligibility and composition scope are explicit. No visitor responses, private source URLs or inferred viewer preferences are included.',works:staged},null,2)+'\n');
fs.writeFileSync(new URL('required-expansion-attribute-reviews.json',artifacts),JSON.stringify({version:ARTWORK_ATTRIBUTE_VERSION,reviewerType:'assistant-visual-review',reviewedAt:verifiedAt,attributeKeys:Object.values(keys),reviewedCount:staged.length,limits:ARTWORK_ATTRIBUTE_LIMITS,unknownSemantics:{missingReview:'unknown',sourceMismatch:'unknown',unknownStatus:'unknown',explicitAbsent:'Observed negative for this criterion at the reviewed reproduction scale.',partialView:'Whole-work assignments are unknown; not ordinary study eligible.'},currentAssetReferenceScope:'Current verified preview bytes; no claim about an older capture.',currentAssetReferences,reviews},null,2)+'\n');
const report={count:staged.length,studyEligible:staged.filter(w=>w.studyEligible).length,galleryResearchOnly:staged.filter(w=>!w.studyEligible).map(w=>w.id),publicDomain:staged.filter(w=>w.rights==='Public domain').length,largeBytes:staged.reduce((n,w)=>n+w.provenance.largeBytes,0),previewBytes:staged.reduce((n,w)=>n+w.bytes,0),sourceLimited:staged.filter(w=>w.provenance.sourceLimited).map(w=>({id:w.id,width:w.largeWidth,height:w.largeHeight,originalFileWidth:w.provenance.originalFileWidth||null,originalFileHeight:w.provenance.originalFileHeight||null})),allImageHashesDistinct:true,existingCatalogueChanged:false};
fs.writeFileSync(new URL('final-validation-summary.json',qa),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
