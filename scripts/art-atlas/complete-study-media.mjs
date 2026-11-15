import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {imageDimensions} from './import-study-media.mjs';
const site='public/art-atlas',evidence='qa-output/study-media';
const works=JSON.parse(await fs.readFile(evidence+'/original-99.json','utf8'));
const manifest=JSON.parse(await fs.readFile(site+'/study-image-sources.json','utf8'));
const smallById=new Map(JSON.parse(await fs.readFile(evidence+'/small-image-audit.json','utf8')).map(row=>[row.workId,row]));
const candidates=JSON.parse(await fs.readFile(evidence+'/candidate-sources.json','utf8'));
const sourcePages=[];
for(const file of await fs.readdir(evidence))if(file.startsWith('commons-batch-'))sourcePages.push(...Object.values(JSON.parse(await fs.readFile(evidence+'/'+file,'utf8')).query?.pages||{}));
const alternatePages=Object.values(JSON.parse(await fs.readFile(evidence+'/alternate-file-review.json','utf8')).query?.pages||{});
const alternates=new Map([
  ['study-kandinsky-composition-eight','File:Wassily Kandinsky Composition VIII.jpg'],
  ['study-gericault-raft','File:Théodore Géricault - The Raft of the Medusa - WGA08630.jpg'],
  ['study-matisse-dance','File:Henri Matisse - Dance 1910.jpg']
]);
const cleanUrl=value=>{const url=new URL(value);url.search='';return url.href;};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const unresolved=[];
for(const work of works.filter(work=>!manifest.entries[work.id])){
  let candidate=candidates.find(candidate=>candidate.workId===work.id);
  const page=alternates.has(work.id)?alternatePages.find(page=>page.title===alternates.get(work.id)):sourcePages.find(page=>page.title===work.provenance?.sourceFileTitle);
  if(page?.imageinfo?.[0]){
    const info=page.imageinfo[0],ext=info.extmetadata||{},cc0=ext.License?.value==='cc0'||ext.LicenseShortName?.value==='CC0',pd=ext.Copyrighted?.value==='False'&&(ext.License?.value==='pd'||/public domain/i.test(ext.LicenseShortName?.value||''));
    if(!cc0&&!pd){unresolved.push({workId:work.id,error:'Individual file rights were not verified.'});continue;}
    candidate={workId:work.id,url:info.thumburl||info.url,provider:'Wikimedia Commons',metadataUrl:info.descriptionurl,rights:cc0?'CC0':'Public domain',rightsUrl:cc0?'https://creativecommons.org/publicdomain/zero/1.0/':info.descriptionurl+'#Licensing',sourceWidth:info.width,sourceHeight:info.height,originalImageUrl:info.url,institutionIdentity:{title:page.title,pageId:page.pageid,institutionRecordUrl:work.sourceUrl},licenseMetadata:Object.fromEntries(['LicenseShortName','UsageTerms','Copyrighted','AttributionRequired','License','LicenseUrl','Credit','Artist','ObjectName'].filter(key=>ext[key]).map(key=>[key,ext[key].value])),alternativeReproduction:alternates.has(work.id)};
  }
  if(!candidate){unresolved.push({workId:work.id,error:'No larger verified candidate.'});continue;}
  if(Math.max(candidate.sourceWidth||0,candidate.sourceHeight||0)<=Math.max(work.width,work.height)){unresolved.push({workId:work.id,error:'The verified source has no larger real pixels; native-size cap retained.',nativeWidth:work.width,nativeHeight:work.height});continue;}
  let result,error;
  for(let attempt=0;attempt<3;attempt++){
    try{
      let selected=cleanUrl(candidate.url);
      if(process.argv.includes('--public-thumbnails')){
        const original=new URL(candidate.originalImageUrl||candidate.url),parts=original.pathname.split('/'),filename=parts.at(-1),width=candidate.sourceWidth>3840?3840:candidate.sourceWidth>1920?1920:candidate.sourceWidth>1280?1280:960;
        selected='https://thumb.wikimedia.org/wikipedia/commons/thumb/'+parts.slice(-3,-1).join('/')+'/'+filename+'/'+width+'px-'+filename;
      }
      const response=await fetch(selected,{headers:{'User-Agent':'ArtAtlas/1.0 (public-domain artwork media verification)'},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('HTTP'+response.status);const bytes=Buffer.from(await response.arrayBuffer()),dimensions=imageDimensions(bytes);if(bytes.length<5000||dimensions.width*dimensions.height<=work.width*work.height)throw Error('No larger verified image bytes.');result={bytes,selectedUrl:selected,contentType:response.headers.get('content-type'),...dimensions};break;
    }catch(failure){error=failure;await new Promise(resolve=>setTimeout(resolve,2500*(attempt+1)));}
  }
  if(!result){unresolved.push({workId:work.id,error:String(error?.message||error),attemptedUrl:cleanUrl(candidate.url)});continue;}
  const imageLarge='assets/study-large/'+work.id+'.'+result.extension;
  await fs.writeFile(path.join(site,imageLarge),result.bytes);
  const small=smallById.get(work.id);
  manifest.entries[work.id]={workId:work.id,sourceIdentity:{sourceUrl:work.sourceUrl,image:work.image,imageSourceUrl:work.imageSourceUrl||null},imageLarge,largeWidth:result.width,largeHeight:result.height,smallWidth:small.width,smallHeight:small.height,smallImageSha256:small.sha256,smallImageBytes:small.bytes,rights:candidate.rights,rightsUrl:candidate.rightsUrl,qualityStatus:Math.max(result.width,result.height)>=2000?'detail-ready':'source-limited',provenance:{provider:candidate.provider,metadataUrl:candidate.metadataUrl,institutionRecordUrl:work.sourceUrl,institutionIdentity:candidate.institutionIdentity,downloadUrl:result.selectedUrl,originalImageUrl:candidate.originalImageUrl,sourceWidth:candidate.sourceWidth,sourceHeight:candidate.sourceHeight,contentType:result.contentType,verifiedMime:result.mime,sha256:hash(result.bytes),bytes:result.bytes.length,retrievedAt:new Date().toISOString(),licenseMetadata:candidate.licenseMetadata,alternativeReproduction:candidate.alternativeReproduction||false,transformation:'Downloaded reproduction before hosted derivative optimization; no upscaling.'}};
  console.log('ADDED',work.id,result.width+'x'+result.height,result.bytes.length);await new Promise(resolve=>setTimeout(resolve,1400));
}
manifest.failures=unresolved;manifest.summary={originalWorks:works.length,largeImages:Object.keys(manifest.entries).length,detailReady:Object.values(manifest.entries).filter(entry=>entry.qualityStatus==='detail-ready').length,sourceLimited:Object.values(manifest.entries).filter(entry=>entry.qualityStatus==='source-limited').length,totalBytes:Object.values(manifest.entries).reduce((sum,entry)=>sum+entry.provenance.bytes,0)};
await fs.writeFile(site+'/study-image-sources.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.summary));for(const failure of unresolved)console.log('UNRESOLVED',failure.workId,failure.error);
