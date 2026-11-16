import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),site=path.join(root,'public/art-atlas');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const catalogue=read('public/art-atlas/artworks.json'),reviews=read('public/art-atlas/artwork-attribute-reviews.json'),contexts=read('public/art-atlas/artwork-context-reviews.json');
const byId=new Map(catalogue.map(work=>[work.id,work])),sources=new Map(catalogue.map(work=>[work.sourceUrl,work.id]));
const imports=[['catalogue-expansion-candidates.json','catalogue-expansion-attribute-reviews.json'],['required-expansion-candidates.json','required-expansion-attribute-reviews.json']];
let added=0;
for(const [candidateName,reviewName] of imports){
  const candidate=read('artifacts/art-atlas/'+candidateName),sidecar=read('artifacts/art-atlas/'+reviewName);
  for(const work of candidate.works){
    const existing=byId.get(work.id),review=sidecar.reviews[work.id];
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(work))throw Error('Existing identity changed: '+work.id);continue;}
    if(sources.has(work.sourceUrl))throw Error('Source already represented: '+work.id+' / '+sources.get(work.sourceUrl));
    if(!review||review.sourceIdentity.sourceUrl!==work.sourceUrl||review.sourceIdentity.image!==work.image)throw Error('Missing source-bound review: '+work.id);
    const preview=path.resolve(site,work.image),large=path.resolve(site,work.imageLarge);
    if(!preview.startsWith(site+path.sep)||!large.startsWith(site+path.sep))throw Error('Asset outside site');
    const previewHash=hash(preview),largeHash=hash(large);
    if(previewHash!==review.sourceIdentity.previewSha256||largeHash!==work.provenance.largeSha256)throw Error('Asset hash mismatch: '+work.id);
    if(Object.keys(review.attributes).length!==16||Object.values(review.attributes).some(value=>!['present','absent','unknown'].includes(value.status)||!value.reason))throw Error('Incomplete review: '+work.id);
    catalogue.push(work);byId.set(work.id,work);sources.set(work.sourceUrl,work.id);reviews.reviews[work.id]=review;
    const key=JSON.stringify([work.sourceUrl,work.image]);
    reviews.currentAssetReferences[key]={sourceUrl:work.sourceUrl,image:work.image,previewSha256:previewHash,verification:'sha256-of-current-local-preview'};
    if(!contexts.records[work.id]){
      const fact=value=>value?{status:'documented',value,sourceUrl:work.sourceUrl}:{status:'unknown',value:null};
      contexts.records[work.id]={version:'artwork-context-v1',sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,previewSha256:previewHash},facts:{medium:fact(work.medium||null),reportedDate:fact(work.date||null),sourceCulture:fact(work.provenance?.sourceCulture||work.culture||null),creationPlace:fact(null),depictedPlace:fact(null)},editorial:{movementLabels:[],reviewedLabels:[],mediumFamily:{status:'unknown'}},scope:'Institutional catalogue fields only. Culture does not establish creation place. No inferred movement is added.'};
    }
    added++;
  }
}
reviews.reviewedCount=Object.keys(reviews.reviews).length;
contexts.reviewedCount=Object.keys(contexts.records).length;
if(new Set(catalogue.map(work=>work.id)).size!==catalogue.length)throw Error('Duplicate catalogue ID');
write('public/art-atlas/artworks.json',catalogue);
write('public/art-atlas/artwork-attribute-reviews.json',reviews);
write('public/art-atlas/artwork-context-reviews.json',contexts);
console.log(JSON.stringify({added,catalogue:catalogue.length,reviewedWorks:reviews.reviewedCount,contextRecords:contexts.reviewedCount,excludedFromStudy:catalogue.filter(work=>work.eligibleForStudy===false||work.studyEligible===false||work.decorativeOnly===true).length}));
