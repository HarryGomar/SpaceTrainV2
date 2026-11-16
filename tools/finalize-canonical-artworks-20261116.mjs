import fs from 'node:fs';
import crypto from 'node:crypto';
import {ARTWORK_ATTRIBUTE_VERSION,ARTWORK_ATTRIBUTE_DEFINITIONS,ARTWORK_ATTRIBUTE_LIMITS} from '../public/art-atlas/artwork-attribute-definitions.mjs';
import {imageDimensions} from '../scripts/art-atlas/import-study-media.mjs';

const root=new URL('../',import.meta.url),site=new URL('public/art-atlas/',root),qa=new URL('qa-output/canonical-20261116/',root),out=new URL('artifacts/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8')),write=(name,data)=>fs.writeFileSync(new URL(name,out),JSON.stringify(data,null,2)+'\n');
const plan=read(new URL('tools/canonical-artworks-plan-20261116.json',root)),observations=read(new URL('tools/canonical-artwork-observations-20261116.json',root)),works=read(new URL('staged-works.json',qa)),current=read(new URL('artworks.json',site));
const keys={N:'narrative-detail',I:'imagined-world',D:'dramatic-light',S:'layered-space',G:'geometric-structure',V:'visible-gesture',F:'intimate-figures',L:'landscape',X:'expressive-distortion',P:'precise-rendering',B:'visible-paint-marks',R:'pattern-rhythm',H:'human-relationships',T:'theatrical-staging',M:'material-detail',O:'open-expanse'};
const numeric=['abstraction','energy','complexity','humanity','narrative','atmosphere','color'],literal=['narrative','atmosphere'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const prose=text=>String(text||'').replace(/(\p{L})(\d{3,})/gu,'$1 $2').replace(/\bof1\b/g,'of 1');
const safe=url=>typeof url==='string'&&/^https:\/\//.test(url);
const unknown=reason=>({status:'unknown',reason});
const primary=(value,url,sourceLocator)=>({status:'documented',value,sourceUrl:url,sourceLocator,evidenceKind:'primary-institutional-record'});
const reported=(value,url)=>({status:'reported',value,sourceUrl:url,sourceField:'Linked collection or faithful reproduction record; displayed date wording retained.',evidenceKind:'existing-source-import'});
const reviewers={reviews:{},currentAssetReferences:{},records:{},literal:{}};
const now=new Date().toISOString();
if(works.length!==24||Object.keys(observations).length!==24)throw Error('Expected24 individually inspected candidates');
const other=current.filter(work=>!works.some(candidate=>candidate.id===work.id)),existingHashes=new Set(other.map(work=>sha(fs.readFileSync(new URL(work.image,site)))));
const identityKeys=new Set(other.map(work=>JSON.stringify([work.title.toLowerCase(),work.artist.toLowerCase()]))),sourceUrls=new Set(other.map(work=>work.sourceUrl));
const contextNotes={
 'canon-caravaggio-bacchus':['Naturalistic figure and still-life display','The offered wine, fruit and close figure combine quiet figuration with differentiated material description.'],
 'canon-caravaggio-medusa':['Emblematic shield image','A single severed head with snake hair is isolated within the shield field, without an enacted cutting scene.'],
 'canon-leonardo-last-supper':['Single-room multi-figure narrative','Several local human responses are organised within one continuous deep room.'],
 'canon-michelangelo-creation-adam':['Renaissance figural encounter','A clear relational reaching gesture and nearby supporting bodies are isolated by broad open space.'],
 'canon-bosch-temptations-lisbon':['Fantastical multi-episode narrative','Many hybrid beings and independent small incidents occupy successive built and natural places.'],
 'canon-bruegel-tower-babel':['Architectural world landscape','A dominant building contains many small technical activities within an extensive harbour and terrain.'],
 'canon-bruegel-netherlandish-proverbs':['Proverb painting','The museum documents separate sayings enacted by numerous figures in an otherwise recognisable village.'],
 'canon-goya-third-may':['Romantic-era historical figuration','A repeated armed group confronts differently gesturing figures under strongly selective light.'],
 'canon-velazquez-breda':['Baroque historical tableau','The key exchange is a quiet central relationship inside an arranged collective historical scene.'],
 'canon-rembrandt-prodigal-son':['Chiaroscuro relational figuration','Restrained bodily contact, damaged clothing and surrounding witnesses are selected through strong light and shadow.'],
 'canon-holbein-dead-christ':['Close anatomical sacred image','One motionless body is sharply described within a narrow framing cavity.'],
 'canon-durer-melencolia':['Renaissance allegorical engraving','The linked Met record documents geometry tools and allegorical objects; controlled line makes their details conspicuous.'],
 'canon-delacroix-sardanapalus':['Romantic theatrical narrative','Bodies, red drapery and a raised bed organise numerous forceful encounters in several spatial stages.'],
 'canon-ingres-odalisque':['Elongated idealised figuration','The static reclining body has a conspicuously extended back and carefully separated material surfaces.'],
 'canon-bocklin-isle-dead':['Symbolist architectural landscape','A sparse boat encounter and built openings are placed within a detailed island environment.'],
 'canon-siqueiros-echo-scream':['Expressive symbolic figuration','The enlarged repeated head and altered face organise an uncanny scene around broken mechanical objects.'],
 'canon-siqueiros-collective-suicide':['Experimental lacquer painting in muralist context','MoMA documents the lacquer and applied sections on wood. This easel-scale support is not mislabelled a physical wall mural.'],
 'canon-varo-creation-birds':['Precise fantastical workshop','An owl-like creator and interconnected devices enact an impossible transformation inside a coherent room.'],
 'canon-kahlo-two-fridas':['Symbolic self-portraiture','Two static linked figures carry exposed anatomy and separate held objects; a Surrealist label is not inferred as the artist\'s self-identification.'],
 'canon-tamayo-dualidad':['Mythic mural painting','The complete painted wall shows opposed stylised creatures and broad colour divisions; photographed museum architecture is excluded.'],
 'canon-varo-call':['Precise fantastical architectural figuration','The walking central figure and physically transformed surrounding bodies occupy successive architectural spaces.'],
 'canon-varo-escape':['Fantastical travel scene','A vessel with two figures appears among clouds and mountains; sharing the vessel alone is not treated as a proven interpersonal exchange.']
};
const sourced={
 'canon-leonardo-last-supper':{kind:'documented-technique-context',claim:'The museum explains that Leonardo worked on dry plaster rather than using the traditional wet-fresco technique.',sourcePublisher:'Museo del Cenacolo Vinciano'},
 'canon-caravaggio-entombment':{kind:'documented-subject-context',claim:'The Vatican identifies the represented moment as placing the body on the anointing stone, rather than lowering it into an open tomb.',sourcePublisher:'Vatican Museums'},
 'canon-bruegel-netherlandish-proverbs':{kind:'documented-symbolism',claim:'The Berlin collection record identifies more than100 sayings enacted by individual figures and explains the old upside-down-world title.',sourcePublisher:'Staatliche Museen zu Berlin'},
 'canon-durer-melencolia':{kind:'documented-symbolism',claim:'The Met identifies the principal winged figure as a personification of Melancholy and relates many surrounding objects to geometry. These are historical iconographic readings, not viewer traits.',sourcePublisher:'The Metropolitan Museum of Art'},
 'canon-kahlo-two-fridas':{kind:'documented-subject-context',claim:'The MAM record identifies the held miniature as a portrait of Diego Rivera and discusses the connected exposed hearts and contrasting dresses.',sourcePublisher:'Museo de Arte Moderno, institutional Google Arts & Culture record'},
 'canon-tamayo-dualidad':{kind:'documented-symbolism',claim:'INAH explains the opposed serpent and jaguar as Tamayo\'s interpretation of complementary opposites, and cautions against presenting a Western good-versus-evil binary as an unqualified Mesoamerican belief.',sourcePublisher:'Museo Nacional de Antropología / INAH',sourceUrl:'https://mna.inah.gob.mx/historia_detalle.php?id=3'}
};
for(const work of works){
  const spec=plan.find(item=>item.id===work.id),o=observations[work.id];
  if(!o||!spec||spec.pending)throw Error('Missing reviewed source binding: '+work.id);
  for(const key of ['title','date','medium','museum','sourceUrl','sourceUrls','comparisonPurpose','compositionScope','viewScope','underlyingWork'])if(Object.hasOwn(spec,key))work[key]=structuredClone(spec[key]);
  if(sourceUrls.has(work.sourceUrl)||identityKeys.has(JSON.stringify([work.title.toLowerCase(),work.artist.toLowerCase()])))throw Error('Duplicate current source/work: '+work.id);
  const preview=fs.readFileSync(new URL(work.image,site)),large=fs.readFileSync(new URL(work.imageLarge,site)),smallSize=imageDimensions(preview),largeSize=imageDimensions(large);
  if(sha(preview)!==work.sha256||sha(large)!==work.provenance.largeSha256||existingHashes.has(sha(preview)))throw Error('Wrong or duplicate actual reproduction: '+work.id);
  if(smallSize.width!==work.width||smallSize.height!==work.height||largeSize.width!==work.largeWidth||largeSize.height!==work.largeHeight)throw Error('Wrong actual image dimensions: '+work.id);
  if(o.features?.length!==7||o.features.some(value=>!Number.isFinite(value)||value<0||value>1))throw Error('Missing individual seven-field judgement: '+work.id);
  work.features=Object.fromEntries(numeric.map((key,i)=>[key,o.features[i]]));
  work.featureSource='Individual assistant editorial judgement of this exact reproduction. Narrative means visible bodily action and atmosphere means prominence of depicted setting. Other scores remain provisional. No viewer emotion, artist-wide visual default, human validation or psychological cause is asserted.';
  work.featureQuality='provisional_manual';work.featureAnnotationVersion='canonical-individual-review-20261116-v1';work.featureSemanticVersion='literal-action-setting-v2';
  work.alt=prose(o.alt);work.note=prose(o.note);work.featureReviewReason=prose(o.reason);work.studyEligible=true;work.eligibleForStudy=true;
  work.compositionScope=spec.compositionScope||'whole-work';work.recognitionTierSource='Editorial canonical/curatorial importance for stimulus selection, not a population familiarity measure.';
  work.analysis={...work.analysis,yearRange:spec.yearRange,yearRangeSource:work.sourceUrl,yearRangeBasis:prose(spec.dateBasis||'Closed date/interval reported in the linked institutional object or collection record.'),dateApproximate:spec.dateApproximate===true,movementKey:work.movement.toLowerCase()};
  if(work.id==='canon-varo-escape')work.analysis.dateAlternatives=[[1961,1961],[1961,1962]];
  work.provenance.institutionRecordUrl=work.sourceUrl;work.provenance.visualReview='All seven provisional numeric descriptions and sixteen tri-state qualities were individually considered from this actual reproduction by an assistant. No artist/movement defaults.';
  work.provenance.reviewedImageSha256=sha(preview);work.provenance.compositionScope=work.compositionScope;
  if(work.viewScope)work.provenance.viewScope=work.viewScope;
  work.provenance.rightsScope=['Public domain','CC0'].includes(work.rights)?'Rights evidence applies to this faithful reproduction or explicitly licensed photograph of a public-domain work.':'Any stated photograph licence is separate from copyright in the depicted artwork. No open reuse licence to the underlying modern work is established.';
  work.provenance.transformation='EXIF orientation respected. The complete downloaded composition and its aspect ratio were preserved. Preview maximum 800 px, JPEG quality 88; large maximum 3200 px, JPEG quality 90. No upscaling or invented pixels. The source view scope is recorded separately.';
  if(spec.rightsMode==='institutional-cc0'){
    const met=read(new URL('met-melencolia.source',qa));if(met.objectID!==336228||!met.isPublicDomain||met.accessionNumber!=='43.106.1')throw Error('Met impression or rights changed');
    work.sourceId=336228;work.provenance.recordUrl='https://collectionapi.metmuseum.org/public/collection/v1/objects/336228';
    work.provenance.licenseMetadata={isPublicDomain:true,objectID:336228,accessionNumber:'43.106.1'};
  }
  if(work.copyrightNotice)work.provenance.underlyingWorkCopyrightNotice=work.copyrightNotice;
  work.provenance.qualityStatus=work.provenance.sourceLimited?'source-limited':'detail-ready';work.qualityStatus=work.provenance.qualityStatus;
  delete work.pending;
  const sourceIdentity={sourceUrl:work.sourceUrl,image:work.image,previewSha256:sha(preview)};
  const reviewedAsset={image:work.imageLarge,sha256:sha(large),width:largeSize.width,height:largeSize.height,mediaBinding:'exact-canonical-local-reproduction',compositionMatch:'same-composition',sourceLimited:work.provenance.sourceLimited,displayScale:'The actual local large reproduction was inspected in a contact sheet at a maximum of 384 by 440 display pixels. Finer unresolved evidence is explicitly unknown.'};
  const sources=[...new Set([work.sourceUrl,...(work.sourceUrls||[]),work.provenance.recordUrl,work.rightsUrl,sourced[work.id]?.sourceUrl].filter(safe))];
  const attributes=Object.fromEntries(Object.entries(keys).map(([short,key])=>{
    const present=o.present?.[short],uncertain=o.unknown?.[short],absent=o.absent?.[short];
    if([present,uncertain,absent].filter(Boolean).length>1)throw Error('Conflicting individual status: '+work.id+' '+key);
    return [key,{status:present?'present':uncertain?'unknown':'absent',reason:prose(present||uncertain||absent||ARTWORK_ATTRIBUTE_DEFINITIONS[key].absentReason),evidenceKind:'visual-review'}];
  }));
  const context=sourced[work.id]?[{...sourced[work.id],claim:prose(sourced[work.id].claim),sourceUrl:sourced[work.id].sourceUrl||work.sourceUrl,sourceLocator:'Interpretive or technical discussion accompanying the linked exact institutional object or named mural record.',evidenceKind:'primary-source-context'}]:[];
  reviewers.reviews[work.id]={version:ARTWORK_ATTRIBUTE_VERSION,reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity,reviewedAsset,sourceUrls:sources,reviewMethod:'Assistant inspected this actual local reproduction and explicitly considered all sixteen operational criteria. Positive and uncertain criteria have individual visible reasons; all remaining criteria were assessed absent. No artist/movement defaults or independent human validation are claimed.',reviewScope:work.id==='canon-michelangelo-creation-adam'?'Named central scene in this border-trimmed reproduction only; not the whole Sistine ceiling.':work.id==='canon-tamayo-dualidad'?'Complete painted mural only; photographed walls, ceiling, lights and barriers excluded.':'Displayed complete work or individually named composition only.',attributes,sourcedContext:context,contextStatus:context.length?'documented-context-available':'not-documented-in-this-review'};
  reviewers.currentAssetReferences[JSON.stringify([work.sourceUrl,work.image])]={...sourceIdentity,verification:'sha256-of-current-local-preview',verifiedAt:now};
  const fields=Object.fromEntries(literal.map(key=>[key,{status:'reviewed',value:work.features[key],reason:prose(o.reason),evidenceKind:'assistant-visual-review'}]));
  reviewers.literal[work.id]={version:'literal-action-setting-v2',reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity,reviewedAsset,sourceUrls:sources,before:{...work.features},after:{...work.features},fields,changedFeatures:[],reviewedFeatures:literal,retainedDraftFeatures:numeric.filter(key=>!literal.includes(key)),reviewMethod:'Individual literal action/setting review for this newly added exact reproduction. No existing catalogue values or captured responses are overwritten.',proposedFeatureSemanticVersion:'literal-action-setting-v2'};
  work.featureLiteralReview={version:'literal-action-setting-v2',reviewed:true,reviewerType:'assistant-visual-review',sourceIdentity,reviewedAsset,fields,previousValues:Object.fromEntries(literal.map(key=>[key,work.features[key]]))};
  const mediumSource=work.id==='canon-durer-melencolia'?work.provenance.recordUrl:work.id==='canon-holbein-dead-christ'?'https://kunstmuseumbasel.ch/de/sammlung/schwerpunkte':work.sourceUrl;
  const mediumFamily=/engraving/i.test(work.medium)?'Print':/enamel|lacquer|vinyl/i.test(work.medium)?'Industrial-paint medium':/fresco|wall-paint/i.test(work.medium)?'Wall painting':/mixed/i.test(work.medium)?'Mixed-technique painting':'Oil painting';
  const label=contextNotes[work.id]||['Chiaroscuro figure narrative','Visible actions and differentiated bodies are isolated through selective illumination, rather than an artist-wide default.'];
  reviewers.records[work.id]={version:'artwork-context-v1',reviewerType:'assistant-source-and-context-review',sourceIdentity,
    facts:{reportedDate:reported(work.date,work.sourceUrl),sourceIndexRange:unknown('No separate institutional numeric indexing interval is asserted.'),medium:primary(work.medium,mediumSource,'Linked exact object/collection record or institutional exhibition checklist; normalized medium wording.'),sourceCulture:unknown('No object-specific institutional culture field is separately asserted.'),sourceWorkType:reported(work.id==='canon-durer-melencolia'?'Print':'Painting',work.sourceUrl),creationPlace:unknown('No object-specific creation place is verified here. Artist practice, nationality and holding institution do not substitute.'),depictedPlace:unknown('No separate object-specific geographical identification is asserted from the scene or title.'),artistNationality:unknown('Not inferred from the cultural/practice grouping.'),artistBirthCountry:unknown('Not inferred from a place of practice or museum location.')},
    editorial:{catalogueMovement:{value:work.movement,movementKey:work.analysis.movementKey,scope:'Editorial historical grouping, not a scientific visual description.'},movementLabels:[{label:work.movement,kind:'historical-context',evidenceKind:'catalogue-editorial-classification',sourceUrls:sources,reason:'Individual editorial historical grouping informed by the linked object identity, date, institutional context and observed work. Not a measured quality or an assertion that all works by the artist share it.'}],reviewedLabels:[{label:label[0],kind:'context-and-treatment',evidenceKind:'assistant-contextual-classification',sourceUrls:sources,reason:label[1]}],catalogueCountryContext:{status:'editorial',value:work.country,reason:'Cultural/practice context for curation only. This is not a documented nationality, birth country or creation place.'},chronologicalInterval:{status:'derived',yearRange:work.analysis.yearRange,sourceUrl:work.sourceUrl,evidenceKind:'existing-catalogue-date-normalization',approximate:spec.dateApproximate===true,scope:prose(spec.dateBasis||'Source-reported closed interval retained for indexing, not a statistical confidence interval or independently inferred date.')},mediumFamily:{status:'derived',value:mediumFamily,evidenceKind:'normalization-of-reported-medium',sourceText:work.medium,sourceUrl:mediumSource}},sourceUrls:sources};
}
if(new Set(works.map(work=>work.id)).size!==24||new Set(works.map(work=>work.sha256)).size!==24)throw Error('Duplicate canonical identity or preview');
fs.mkdirSync(out,{recursive:true});
write('canonical-expansion-candidates-20261116.json',{version:'canonical-expansion-20261116-v1',preparedAt:now,scope:'Twenty-four individually reviewed canonical gaps. No visitor answers, private source URLs or favourite flags.',works});
write('canonical-expansion-reviews-20261116.json',{version:ARTWORK_ATTRIBUTE_VERSION,reviewerType:'assistant-visual-review',reviewedAt:now,reviewedCount:24,attributeKeys:Object.values(keys),limits:ARTWORK_ATTRIBUTE_LIMITS,currentAssetReferences:reviewers.currentAssetReferences,reviews:reviewers.reviews});
write('canonical-expansion-contexts-20261116.json',{version:'artwork-context-v1',reviewedAt:now,reviewedCount:24,records:reviewers.records});
write('canonical-expansion-literal-20261116.json',{version:'literal-action-setting-v2',reviewedAt:now,reviewerType:'assistant-visual-review',reviews:reviewers.literal});
const report={works:24,westernClassics:17,mexicanContext:7,publicDomain:works.filter(work=>work.rights==='Public domain').length,cc0:works.filter(work=>work.rights==='CC0').length,restrictedUnderlyingWork:works.filter(work=>!['Public domain','CC0'].includes(work.rights)).length,largeBytes:works.reduce((sum,work)=>sum+work.provenance.largeBytes,0),sourceLimited:works.filter(work=>work.provenance.sourceLimited).map(work=>({id:work.id,width:work.largeWidth,height:work.largeHeight})),unimported:plan.filter(spec=>spec.pending).map(spec=>spec.id),publicCatalogueChanged:false};
fs.writeFileSync(new URL('final-review-summary.json',qa),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
