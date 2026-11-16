import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {journeyCurationNotes} from '../public/art-atlas/journey-bank.mjs';

const root=new URL('../',import.meta.url),site=new URL('public/art-atlas/',root);
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const works=read(new URL('artworks.json',site)),byId=new Map(works.map(work=>[work.id,work]));
const data=read(new URL('artwork-context-reviews.json',site)),attributes=read(new URL('artwork-attribute-reviews.json',site));
const observations=read(new URL('tools/early-context-observations-20261116.json',root));
const prior=structuredClone(data.records);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const prose=value=>String(value||'').replace(/(\p{L})(\d{3,})/gu,'$1 $2');
const unknown=reason=>({status:'unknown',reason});
const documented=(value,sourceUrl,sourceLocator,evidenceKind='primary-institutional-record',extra={})=>({status:'documented',value,sourceUrl,sourceLocator,evidenceKind,...extra});
const reported=(value,sourceUrl,sourceField)=>({status:'reported',value,sourceUrl,sourceField,evidenceKind:'existing-source-import'});
assert.equal(Object.keys(observations).length,21);
for(const [id,note] of Object.entries(observations)){
  const work=byId.get(id),review=attributes.reviews[id];assert.ok(work&&review,id);
  const sourceIdentity={sourceUrl:work.sourceUrl,image:work.image,previewSha256:sha(fs.readFileSync(new URL(work.image,site)))};
  assert.deepEqual(review.sourceIdentity,sourceIdentity,id+' actual source binding');
  const api=note.primaryMetadata,apiUrl=note.primaryApiUrl;
  if(api){assert.equal(work.sourceUrl,'https://clevelandart.org/art/'+api.accession_number);assert.ok(apiUrl.endsWith('/'+api.id));}
  const fact=(key,fallback)=>{
    const item=note[key];return item?documented(prose(item.value),item.sourceUrl||work.sourceUrl,item.sourceLocator):fallback;
  };
  const facts={
    reportedDate:api?documented(api.creation_date,apiUrl,'creation_date','primary-api-metadata'):fact('reportedDate',reported(work.date,work.sourceUrl,'Previously source-linked catalogue date; not independently reverified in this pass.')),
    sourceIndexRange:api?documented([api.creation_date_earliest,api.creation_date_latest],apiUrl,'creation_date_earliest / creation_date_latest','primary-api-metadata',{scope:'Institutional indexing interval, not a statistical confidence interval. A circa date remains approximate.'}):unknown('No independent numeric institutional indexing interval was asserted in this review.'),
    medium:api?documented(api.technique,apiUrl,'technique','primary-api-metadata'):fact('medium',unknown('The inspected institutional record does not separately specify the medium and support. No support was inferred from the artist or movement.')),
    sourceCulture:api?documented(api.culture,apiUrl,'culture','primary-api-metadata',{scope:'Verbatim object culture/context field, not a nationality or a proven creation location.'}):unknown('No separate exact-object culture field was verified here.'),
    sourceWorkType:api?documented(api.type,apiUrl,'type','primary-api-metadata'):fact('sourceWorkType',unknown('No separate exact-object type field was verified here.')),
    creationPlace:fact('creationPlace',unknown('No exact-object creation place was verified. A museum location, depicted place or artist nationality does not substitute.')),
    depictedPlace:fact('depictedPlace',unknown('No separate geographical identification was asserted from a title alone or an assumed artist practice.')),
    artistNationality:unknown('No nationality was inferred from the catalogue country grouping, source culture, name or birthplace.'),
    artistBirthCountry:unknown('No birth country was inferred from a creator name or place of practice.')
  };
  if(api?.creatorAttribution?.length)facts.sourceCreatorAttribution=documented(api.creatorAttribution,apiUrl,'creators.description / qualifier / role','primary-api-metadata');
  const sourceUrls=[...new Set([work.sourceUrl,apiUrl,...(note.additionalSourceUrls||[]),...Object.values(facts).map(fact=>fact.sourceUrl)].filter(Boolean))];
  const mediumText=facts.medium.status!=='unknown'?facts.medium.value:facts.sourceWorkType.value||'';
  const family=/etching|engraving|print/i.test(mediumText)?'Print':/pastel/i.test(mediumText)?'Pastel':/watercolou?r/i.test(mediumText)?'Watercolour':/fresco/i.test(mediumText)?'Wall painting':/oil|óleo/i.test(mediumText)?'Oil painting':null;
  const interval=api?[api.creation_date_earliest,api.creation_date_latest]:work.analysis?.yearRange;
  const finiteInterval=Array.isArray(interval)&&interval.length===2&&interval.every(Number.isFinite)&&interval[0]<=interval[1];
  const record={version:'artwork-context-v1',reviewerType:'assistant-source-and-context-review',sourceIdentity,
    facts,
    editorial:{
      catalogueMovement:{value:work.movement,movementKey:work.analysis?.movementKey||null,scope:'Prior catalogue historical grouping, retained as editorial classification rather than a source-authored visual measurement.'},
      movementLabels:[{label:work.movement,kind:'historical-context',evidenceKind:'catalogue-editorial-classification',sourceUrls:[work.sourceUrl],reason:'Existing source-linked catalogue grouping. The more specific individual contextual label is separate; no artist-wide descriptor or user trait follows from this grouping.'}],
      reviewedLabels:[{label:note.label,kind:'context-and-treatment',evidenceKind:'assistant-contextual-classification',sourceUrls,reason:prose(note.reason)}],
      catalogueCountryContext:work.country?{status:'editorial',value:work.country,reason:'Prior cultural/practice grouping for curation. This is not independently verified nationality, birthplace or creation location.'}:unknown('The catalogue does not supply a country grouping and one is not inferred.'),
      chronologicalInterval:finiteInterval?{status:'derived',yearRange:interval,sourceUrl:apiUrl||work.sourceUrl,evidenceKind:api?'primary-api-metadata':'existing-catalogue-date-normalization',approximate:/c\.|ca\.|circa|summer|fall|–|-/i.test(facts.reportedDate.value||'')||interval[0]!==interval[1],scope:api?'Exact institutional indexing interval, not a statistical confidence interval.':'Existing finite catalogue interval, not independently inferred historical precision.'}:unknown('No finite verified interval is supplied.'),
      mediumFamily:family?{status:'derived',value:family,evidenceKind:'normalization-of-reported-medium',sourceText:mediumText,sourceUrl:facts.medium.sourceUrl||facts.sourceWorkType.sourceUrl}:unknown('Insufficient explicit medium information for a family.')
    },
    documentedContext:(note.documentedContext||[]).map(context=>({...context,claim:prose(context.claim),sourceUrl:context.sourceUrl||work.sourceUrl,evidenceKind:'primary-source-context'})),
    sourceUrls,reviewMethod:'Assistant checked the identified primary object metadata and distinguished those facts from inherited catalogue wording and an individual contextual classification. This pass does not create new visual scores, visitor emotions or a negative symbolism score.',
    reviewScope:'The exact displayed object and existing inspected reproduction. Reported source limitations and attributed authorship remain qualified.',
    sourceLimit:note.sourceLimit?prose(note.sourceLimit):null
  };
  for(const context of record.documentedContext)if(!record.sourceUrls.includes(context.sourceUrl))record.sourceUrls.push(context.sourceUrl);
  if(work.provenance?.sourceIdentityCorrection)record.sourceIdentityCorrection=work.provenance.sourceIdentityCorrection;
  if(data.records[id])assert.deepEqual(data.records[id],record,id+' existing review differs; explicit review needed');
  else data.records[id]=record;
}
for(const [id,record] of Object.entries(prior))assert.deepEqual(data.records[id],record,'Previously reviewed context changed: '+id);
data.reviewedCount=Object.keys(data.records).length;
const notes=journeyCurationNotes(works),first=[...new Set(notes.proposedFirst18Panels.flatMap(panel=>panel.workIds))],second=notes.reservePools.batch2;
const first100=[...new Set([...first,...second])];
assert.ok(first100.every(id=>data.records[id]),'An eligible first100 target still lacks context');
fs.writeFileSync(new URL('artwork-context-reviews.json',site),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({newReviewedIds:Object.keys(observations),previousRecordsUnchanged:Object.keys(prior).length,contextRecords:data.reviewedCount,first50:{works:first.length,missing:first.filter(id=>!data.records[id])},first100Allocation:{works:first100.length,missing:first100.filter(id=>!data.records[id])}},null,2));
