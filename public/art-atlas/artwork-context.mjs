import CONTEXT_REVIEWS from './artwork-context-reviews.json' with {type:'json'};
import ATTRIBUTE_REVIEWS from './artwork-attribute-reviews.json' with {type:'json'};
import {resolveArtworkAttributes} from './taste-patterns.mjs';

const unique=values=>[...new Set(values)];
const safeUrl=value=>typeof value==='string'&&/^https?:\/\//.test(value);

/** Current context never replaces the original catalogue or a captured answer. */
export function resolveArtworkContext(work,{contextReviews=CONTEXT_REVIEWS,annotationReviews=ATTRIBUTE_REVIEWS,currentWorks=[]}={}){
  const record=contextReviews?.records?.[work?.id],visual=resolveArtworkAttributes(work,{annotationReviews,currentWorks});
  if(contextReviews?.version!=='artwork-context-v1'||record?.version!=='artwork-context-v1'||!visual||record.sourceIdentity?.sourceUrl!==work.sourceUrl||record.sourceIdentity.image!==work.image||record.sourceIdentity.previewSha256?.toLowerCase()!==visual.annotationBasis.previewSha256)return null;
  const documented=key=>{const fact=record.facts?.[key];return fact?.status==='documented'&&safeUrl(fact.sourceUrl)?structuredClone(fact):null;};
  const labels=[...(record.editorial?.movementLabels||[]),...(record.editorial?.reviewedLabels||[])].filter(label=>typeof label.label==='string'&&label.label.trim()&&typeof label.reason==='string'&&Array.isArray(label.sourceUrls)&&label.sourceUrls.some(safeUrl));
  return {version:record.version,medium:documented('medium'),reportedDate:documented('reportedDate'),culture:documented('sourceCulture'),creationPlace:documented('creationPlace'),depictedPlace:documented('depictedPlace'),labels:[...new Map(labels.map(item=>[item.label.toLowerCase(),structuredClone(item)])).values()],mediumFamily:record.editorial?.mediumFamily?.status==='derived'?structuredClone(record.editorial.mediumFamily):null,annotationBasis:visual.annotationBasis,limits:[...(contextReviews.limits||[])]};
}

export function artworkContextSearchText(work,options){
  const context=resolveArtworkContext(work,options);if(!context)return '';
  const value=field=>Array.isArray(field?.value)?field.value.join(' '):typeof field?.value==='string'?field.value:'';
  return [...context.labels.map(label=>label.label),value(context.medium),value(context.reportedDate),value(context.culture),value(context.creationPlace),value(context.depictedPlace)].join(' ');
}

export function renderArtworkContext(work,{esc,...options}={}){
  const context=resolveArtworkContext(work,options);if(!context)return '';
  const fields=[['Medium',context.medium],['Made in',context.creationPlace],['Depicted place',context.depictedPlace]].filter(([,fact])=>typeof fact?.value==='string'||Array.isArray(fact?.value));
  const factRows=fields.map(([label,fact])=>`<div><dt>${label}</dt><dd>${esc(Array.isArray(fact.value)?fact.value.join(' · '):fact.value)}</dd></div>`).join('');
  const labels=context.labels.map(item=>item.label),sources=unique([...fields.map(([,fact])=>fact.sourceUrl),...context.labels.flatMap(item=>item.sourceUrls)].filter(safeUrl));
  if(!factRows&&!labels.length)return '';
  return `<div class="artwork-context">${factRows?`<dl>${factRows}</dl>`:''}${labels.length?`<div class="artwork-context-labels"><span>Curatorial labels</span><p>${labels.map(esc).join(' · ')}</p></div>`:''}<details><summary>Sources</summary>${context.labels.map(item=>`<p>${esc(item.label)}: ${esc(item.reason)}</p>`).join('')}${sources.map((url,index)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${index+1} ↗</a>`).join(' ')}</details></div>`;
}
