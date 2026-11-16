import fs from 'node:fs';
const site=new URL('../public/art-atlas/',import.meta.url),qa=new URL('../qa-output/attribute-review-20261115/',import.meta.url);
const works=JSON.parse(fs.readFileSync(new URL('artworks.json',site),'utf8'));
const attributes=JSON.parse(fs.readFileSync(new URL('artwork-attribute-reviews.json',site),'utf8'));
const refinements=JSON.parse(fs.readFileSync(new URL('artwork-context-refinements-20261115.json',import.meta.url),'utf8'));
const missing=reason=>({status:'unknown',reason});
const imported=(value,work,sourceField)=>({status:'reported',value,sourceUrl:work.provenance?.metadataUrl||work.provenance?.institutionRecordUrl||work.sourceUrl,sourceField,evidenceKind:'existing-source-import'});
const primary=(value,url,sourceField)=>({status:'documented',value,sourceUrl:url,sourceField,evidenceKind:'primary-api-metadata'});
const unusable=value=>typeof value!=='string'||!value.trim()||/not specified|not dated|unknown|unspecified/i.test(value);
function mediumFamily(value){
  if(typeof value!=='string')return null;
  const s=value.toLowerCase();
  if(/drypoint|aquatint|etching/.test(s))return 'Intaglio print';
  if(/woodblock/.test(s))return 'Woodblock print';
  if(/print|engraving|lithograph/.test(s))return 'Print';
  if(/encaustic/.test(s))return 'Encaustic painting';
  if(/fresco/.test(s))return 'Fresco';
  if(/collage/.test(s))return 'Mixed-media or collage work';
  if(/oil|óleo|olio|ö[l]?/.test(s))return 'Oil painting';
  if(/tempera/.test(s))return 'Tempera-based work';
  if(/acrylic/.test(s))return 'Acrylic painting';
  if(/resin/.test(s))return 'Resin-based painting';
  if(/ink/.test(s))return 'Ink-based work';
  return null;
}
const records={};
for(const work of works.filter(work=>attributes.reviews[work.id])){
  const review=attributes.reviews[work.id],override=refinements[work.id]||{},cache=new URL('cma-'+work.id+'.json',qa),raw=fs.existsSync(cache)?JSON.parse(fs.readFileSync(cache,'utf8')).data:null;
  const apiUrl=raw?'https://openaccess-api.clevelandart.org/api/artworks/'+raw.id:null;
  if(raw&&raw.accession_number!==work.sourceUrl.replace(/\/$/,'').split('/').at(-1))throw Error('Institutional object identity mismatch: '+work.id);
  const medium=raw?.technique?primary(raw.technique,apiUrl,'technique'):!unusable(work.medium)?imported(work.medium,work,'medium'):missing('No explicit medium in the available source record or import metadata. It is not inferred from appearance.');
  const facts={
    reportedDate:raw?primary(raw.creation_date,apiUrl,'creation_date'):imported(work.date,work,'date'),
    sourceIndexRange:raw&&Number.isFinite(raw.creation_date_earliest)&&Number.isFinite(raw.creation_date_latest)?{...primary([raw.creation_date_earliest,raw.creation_date_latest],apiUrl,'creation_date_earliest / creation_date_latest'),scope:'Institutional indexing bounds, not a statistical confidence interval or a replacement for open-ended date wording.'}:missing('No separately retrieved institutional indexing bounds.'),
    medium,
    sourceCulture:raw?primary(raw.culture,apiUrl,'culture'):missing('No separately retrieved institutional culture field. An artist-practice country label is not substituted.'),
    sourceWorkType:raw?primary(raw.type,apiUrl,'type'):missing('No separately retrieved institutional object-type field.'),
    creationPlace:missing('No explicit object-specific place of creation verified in this review. Artist nationality, birth, practice and museum location are not substitutes.'),
    depictedPlace:missing('No explicit depicted geographical place documented in the sources reviewed here.'),
    artistNationality:missing('No separately normalised nationality claim is made. Source creator descriptions and birthplace are separate data.'),
    artistBirthCountry:!unusable(work.artistBirthCountry)?imported(work.artistBirthCountry,work,'artistBirthCountry'):missing('No explicit artist birth-country field in the source import.')
  };
  if(raw)facts.sourceCreatorDescriptions=primary((raw.creators||[]).filter(c=>c.use_in_caption!==false).map(c=>({description:c.description,qualifier:c.qualifier||null})),apiUrl,'creators.description / qualifier');
  for(const field of ['medium','creationPlace','depictedPlace'])if(override[field])facts[field]={status:'documented',value:override[field].value,sourceUrl:override[field].sourceUrl||work.sourceUrl,sourceLocator:override[field].sourceLocator,evidenceKind:'primary-institutional-record'};
  const range=work.analysis?.yearRange,finiteRange=Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[0]<=range[1];
  const chronology=finiteRange?{status:'derived',yearRange:[...range],sourceUrl:work.analysis.yearRangeSource||work.sourceUrl,sourceField:'analysis.yearRange',evidenceKind:'existing-catalogue-date-normalization',approximate:work.analysis.dateApproximate===true||/c\.|circa|about|early|late|after|before/i.test(work.date),scope:'Existing editorial interval, retained separately from institutional display wording and indexing bounds.'}:missing('The current catalogue does not supply a finite closed interval. No artist-lifespan bound was invented.');
  const labels=String(work.movement||'').split(/\s+\/\s+/).filter(Boolean).map(label=>({label,kind:'inherited-catalogue-grouping',evidenceKind:'catalogue-editorial-classification',sourceUrls:[work.sourceUrl],reason:work.movementSource||'Existing editorial art-historical or tradition label, not a measured visual property or necessarily a term assigned by the institution.'}));
  const reviewedLabels=(override.labels||[]).map(item=>({...item,evidenceKind:'assistant-contextual-classification',sourceUrls:[...new Set([work.sourceUrl,...(apiUrl?[apiUrl]:[])])]}));
  const family=mediumFamily(facts.medium.value);
  records[work.id]={version:'artwork-context-v1',reviewerType:'assistant-source-and-context-review',sourceIdentity:{...review.sourceIdentity},facts,
    editorial:{catalogueMovement:{value:work.movement||null,movementKey:work.analysis?.movementKey||null,scope:'Mixed historical movement, school, tradition, period and subject labels; these are not equivalent levels.'},movementLabels:labels,reviewedLabels,
      catalogueCountryContext:work.country?{status:'editorial',value:work.country,reason:work.countrySource||'Existing mixed artist-practice or cultural-context grouping. Not verified nationality or place of execution.'}:missing('No current country-context label.'),
      chronologicalInterval:chronology,
      mediumFamily:family?{status:'derived',value:family,evidenceKind:'normalization-of-reported-medium',sourceText:facts.medium.value,sourceUrl:facts.medium.sourceUrl,scope:'A broad filter derived from documented medium words. The full medium remains authoritative.'}:missing('Reported medium does not support one of the modest normalised families.')},
    sourceUrls:[...new Set([work.sourceUrl,...Object.values(facts).map(value=>value.sourceUrl).filter(Boolean),...reviewedLabels.flatMap(label=>label.sourceUrls)])]};
}
const output={version:'artwork-context-v1',reviewedAt:new Date().toISOString(),reviewedCount:Object.keys(records).length,
  purpose:'Source-bound object facts and explicitly editorial contextual labels, kept separate from response data and visual attribute judgements.',
  evidenceKinds:{'primary-api-metadata':'Exact fields from the institution\'s object API.','primary-institutional-record':'Specific fields or claims verified in an official object page, catalogue or collection description.','existing-source-import':'An explicit value already retained in the source-linked catalogue import; not independently reverified in this pass.','catalogue-editorial-classification':'The previous catalogue\'s mixed historical grouping.','assistant-contextual-classification':'An individually reviewed contextual refinement with a rationale, not an institution-endorsed or scientific label.','existing-catalogue-date-normalization':'The previous finite editorial interval, not a new historical fact.','normalization-of-reported-medium':'A modest derived filter based on explicit medium words.'},
  limits:['Unknown remains unknown. A missing fact never becomes a default based on artist or movement.','Culture, artist origin, birthplace, creation location, depicted location and holding institution are different concepts.','Movements, schools, regional traditions, object formats and visible treatments can overlap; their label kinds remain explicit.','Date intervals are catalogue conventions, not measured probabilities. Open-ended source wording remains visible.','The layer interprets current source records and does not mutate historical questions, answers, catalogue snapshots or numeric descriptors.'],records};
fs.writeFileSync(new URL('artwork-context-reviews.json',site),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({records:output.reviewedCount,mediumKnown:Object.values(records).filter(r=>r.facts.medium.status!=='unknown').length,primaryAPI:Object.values(records).filter(r=>r.facts.reportedDate.evidenceKind==='primary-api-metadata').length,refined:Object.values(records).filter(r=>r.editorial.reviewedLabels.length).length}));
