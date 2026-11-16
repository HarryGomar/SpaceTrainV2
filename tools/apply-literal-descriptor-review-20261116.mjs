import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=new URL('../public/art-atlas/',import.meta.url);
const catalogue=JSON.parse(await readFile(new URL('artworks.json',root),'utf8'));
const ledger=JSON.parse(await readFile(new URL('literal-descriptor-reviews.json',root),'utf8'));
const byId=new Map(catalogue.map(work=>[work.id,work]));
const literal=['narrative','atmosphere'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const seen=new Set();

async function bind(id,record){
  assert(!seen.has(id),'Duplicate review identity: '+id);seen.add(id);
  const work=byId.get(id),identity=record.sourceIdentity;assert(work,'Missing work: '+id);
  assert.equal(identity.sourceUrl,work.sourceUrl,id+' source mismatch');
  assert.equal(identity.image,work.image,id+' preview mismatch');
  assert.equal(hash(await readFile(new URL(work.image,root))),identity.previewSha256,id+' preview bytes mismatch');
  if(record.reviewedAsset)assert.equal(hash(await readFile(new URL(record.reviewedAsset.image,root))),record.reviewedAsset.sha256,id+' reviewed bytes mismatch');
  return work;
}
for(const [id,record] of Object.entries(ledger.reviews)){
  const work=await bind(id,record);
  for(const [key,value] of Object.entries(record.before))if(!literal.includes(key))assert.equal(work.features[key],value,id+' unrelated descriptor changed');
  for(const key of literal){
    assert([record.before[key],record.after[key]].includes(work.features[key]),id+' literal value differs from review');
    assert.equal(record.fields[key].value,record.after[key]);
    assert(record.fields[key].status==='unknown'?record.after[key]===null:Number.isFinite(record.after[key]),id+' unknown status mismatch');
    work.features[key]=record.after[key];
  }
  work.featureSemanticVersion=ledger.version;
  work.featureLiteralReview={version:ledger.version,reviewed:true,reviewerType:ledger.reviewerType,sourceIdentity:record.sourceIdentity,reviewedAsset:record.reviewedAsset,fields:record.fields,previousValues:Object.fromEntries(literal.map(key=>[key,record.before[key]]))};
}
for(const [id,record] of Object.entries(ledger.withheld)){
  const work=await bind(id,record);
  assert.deepEqual(work.features,record.retainedDraftFeatures,id+' pending draft changed');
  work.featureSemanticVersion=record.proposedFeatureSemanticVersion;
  work.featureLiteralReview={version:ledger.version,...record.featureReview,sourceIdentity:record.sourceIdentity};
}
for(const [id,record] of Object.entries(ledger.excluded)){
  const work=await bind(id,record);assert.equal(work.studyEligible,false,id+' partial view must stay excluded');
}
assert.equal(seen.size,catalogue.length,'Every work needs a reviewed, pending or excluded disposition');
await writeFile(new URL('artworks.json',root),JSON.stringify(catalogue,null,2)+'\n');
console.log(JSON.stringify({reviewed:Object.keys(ledger.reviews).length,pending:Object.keys(ledger.withheld).length,excluded:Object.keys(ledger.excluded).length}));
