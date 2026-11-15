import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const site=path.join(repo,'public/art-atlas');
const evidenceDir=path.join(repo,'qa-output/study-media');
const ua='ArtAtlas/1.0 (public-domain artwork study; museum open-access media verification)';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function imageDimensions(bytes){
  if(bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),mime:'image/png',extension:'png'};
  if(bytes[0]===255&&bytes[1]===216){
    for(let i=2;i<bytes.length-9;){
      if(bytes[i]!==255){i++;continue;}while(bytes[i]===255)i++;const marker=bytes[i++];
      if(marker===216||marker===217||marker===1||marker>=208&&marker<=215)continue;
      const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3),mime:'image/jpeg',extension:'jpg'};
      i+=length;
    }
  }
  throw Error('Downloaded bytes are not a supported complete JPEG/PNG image.');
}
async function request(url,{binary=false}={}){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(url,{headers:{'User-Agent':ua,Accept:binary?'image/jpeg,image/png;q=.9,*/*;q=.2':'application/json'},signal:AbortSignal.timeout(60000)});
      if(!r.ok)throw Error('HTTP'+r.status+' '+url);
      const contentType=r.headers.get('content-type')||'';
      if(binary){const bytes=Buffer.from(await r.arrayBuffer());const dimensions=imageDimensions(bytes);if(bytes.length<5000)throw Error('Unexpectedly tiny image.');return{bytes,contentType,...dimensions};}
      return await r.json();
    }catch(error){if(attempt===2)throw error;await wait(600*(attempt+1));}
  }
}
async function pool(items,limit,fn){const out=new Array(items.length);let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=cursor++;if(i>=items.length)return;try{out[i]=await fn(items[i],i);}catch(error){out[i]={error:String(error.message||error),workId:items[i]?.id};}}}));return out;}
function commonsTitle(work){
  if(work.provenance?.sourceFileTitle)return work.provenance.sourceFileTitle;
  const record=work.provenance?.recordUrl;
  if(record?.startsWith('https://commons.wikimedia.org/wiki/File:'))return decodeURIComponent(record.split('/wiki/')[1]).replaceAll('_',' ');
  const match=work.imageSourceUrl?.match(/\/(?:thumb\/)?[a-f0-9]\/[a-f0-9]{2}\/([^/?]+)/i);
  return match?'File:'+decodeURIComponent(match[1]).replaceAll('_',' '):null;
}
const identity=work=>({sourceUrl:work.sourceUrl,image:work.image,imageSourceUrl:work.imageSourceUrl||null});
export async function main(){
  await fs.mkdir(evidenceDir,{recursive:true});await fs.mkdir(path.join(site,'assets/study-large'),{recursive:true});
  const snapshot=path.join(evidenceDir,'original-99.json');
  let works;try{works=JSON.parse(await fs.readFile(snapshot,'utf8'));}catch{
    works=JSON.parse(await fs.readFile(path.join(site,'artworks.json'),'utf8'));
    if(works.length!==99){const previous=JSON.parse(await fs.readFile(path.join(site,'study-image-sources.json'),'utf8')),assigned=new Set([...Object.keys(previous.entries||{}),...(previous.failures||[]).map(row=>row.workId)]);works=works.filter(work=>assigned.has(work.id));}
    if(works.length!==99)throw Error('The explicitly assigned99 source-linked works are unavailable.');await fs.writeFile(snapshot,JSON.stringify(works,null,2));
  }
  const originalSizes=await pool(works,6,async work=>{const bytes=await fs.readFile(path.join(site,work.image));return{workId:work.id,...imageDimensions(bytes),bytes:bytes.length,sha256:sha(bytes)};});
  await fs.writeFile(path.join(evidenceDir,'small-image-audit.json'),JSON.stringify(originalSizes,null,2));
  const smallById=new Map(originalSizes.map(row=>[row.workId,row]));
  const candidates=[];const failures=[];
  const cma=works.filter(work=>new URL(work.sourceUrl).hostname.endsWith('clevelandart.org'));
  const cmaResults=await pool(cma,3,async work=>{
    const id=work.sourceId||work.provenance?.recordId,url='https://openaccess-api.clevelandart.org/api/artworks/'+id;
    const record=await request(url),data=record.data;
    await fs.writeFile(path.join(evidenceDir,'cma-'+id+'.json'),JSON.stringify({id:data?.id,title:data?.title,accession_number:data?.accession_number,share_license_status:data?.share_license_status,images:data?.images,url:data?.url},null,2));
    const accession=new URL(work.sourceUrl).pathname.split('/').filter(Boolean).at(-1);
    if(String(data?.id)!==String(id)||data?.accession_number!==accession||data?.share_license_status!=='CC0'||!data?.images?.print?.url)throw Error('CMA identity, CC0 or print reproduction missing.');
    return{work,url:data.images.print.url,provider:'Cleveland Museum of Art Open Access API',metadataUrl:url,rights:'CC0',rightsUrl:'https://creativecommons.org/publicdomain/zero/1.0/',sourceWidth:Number(data.images.print.width),sourceHeight:Number(data.images.print.height),institutionIdentity:{id:data.id,accessionNumber:data.accession_number,title:data.title},licenseMetadata:{share_license_status:data.share_license_status},transformation:'Museum print JPEG bytes retained without resampling or upscaling.'};
  });
  for(const result of cmaResults)result.error?failures.push(result):candidates.push(result);
  console.log('Verified CMA print sources:',candidates.length,'/',cma.length);
  const commons=works.filter(work=>!cma.includes(work)&&commonsTitle(work));
  for(let start=0;start<commons.length;start+=6){
    const batch=commons.slice(start,start+6),url=new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({action:'query',format:'json',prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'2400',iiurlheight:'2400',redirects:'1',titles:batch.map(commonsTitle).join('|')}).forEach(([key,value])=>url.searchParams.set(key,value));
    try{
      const record=await request(url);await fs.writeFile(path.join(evidenceDir,'commons-batch-'+start+'.json'),JSON.stringify(record,null,2));
      const pages=Object.values(record.query?.pages||{});
      for(const work of batch){
        const title=commonsTitle(work),normalized=record.query?.normalized?.find(row=>row.from===title)?.to||title,redirected=record.query?.redirects?.find(row=>row.from===normalized)?.to||normalized,page=pages.find(page=>page.title===redirected),info=page?.imageinfo?.[0],ext=info?.extmetadata||{};
        const cc0=ext.License?.value==='cc0'||ext.LicenseShortName?.value==='CC0',publicDomain=ext.Copyrighted?.value==='False'&&(/public domain/i.test(ext.LicenseShortName?.value||'')||ext.License?.value==='pd');
        if(!info?.url||!cc0&&!publicDomain){failures.push({workId:work.id,error:'Commons image identity or individual public-domain/CC0 status could not be verified.',title,foundTitle:page?.title});continue;}
        const selectedUrl=info.thumburl||info.url;
        candidates.push({work,url:selectedUrl,provider:'Wikimedia Commons',metadataUrl:info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title),rights:cc0?'CC0':'Public domain',rightsUrl:cc0?'https://creativecommons.org/publicdomain/zero/1.0/':(info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title))+'#Licensing',sourceWidth:info.width,sourceHeight:info.height,originalImageUrl:info.url,institutionIdentity:{title:page.title,pageId:page.pageid,institutionRecordUrl:work.sourceUrl},licenseMetadata:Object.fromEntries(['LicenseShortName','UsageTerms','Copyrighted','AttributionRequired','License','LicenseUrl','Credit','Artist','ObjectName'].filter(key=>ext[key]).map(key=>[key,ext[key].value])),transformation:selectedUrl===info.url?'Original public-domain reproduction retained without resampling or upscaling.':'Wikimedia thumbnail requested within2400px; Commons can serve a larger preset bucket. Actual image dimensions checked, no upscaling.'});
      }
    }catch(error){for(const work of batch)failures.push({workId:work.id,error:String(error.message||error)});}
    await wait(300);
  }
  const met=works.find(work=>work.id==='study-hokusai-great-wave');
  if(met){try{const metadataUrl='https://collectionapi.metmuseum.org/public/collection/v1/objects/45434',data=await request(metadataUrl);await fs.writeFile(path.join(evidenceDir,'met-45434.json'),JSON.stringify({objectID:data.objectID,title:data.title,artistDisplayName:data.artistDisplayName,isPublicDomain:data.isPublicDomain,primaryImage:data.primaryImage,objectURL:data.objectURL},null,2));if(data.objectID!==45434||!data.isPublicDomain||!data.primaryImage)throw Error('Met public-domain identity unavailable.');candidates.push({work:met,url:data.primaryImage,provider:'The Metropolitan Museum of Art Collection API',metadataUrl,rights:'CC0',rightsUrl:'https://www.metmuseum.org/policies/image-resources',sourceWidth:null,sourceHeight:null,institutionIdentity:{objectID:data.objectID,title:data.title,artist:data.artistDisplayName},licenseMetadata:{isPublicDomain:true},transformation:'Museum primary image retained without resampling or upscaling.'});}catch(error){failures.push({workId:met.id,error:String(error.message||error)});}}
  await fs.writeFile(path.join(evidenceDir,'candidate-sources.json'),JSON.stringify(candidates.map(({work,...rest})=>({...rest,workId:work.id})),null,2));
  console.log('Source-checked image candidates:',candidates.length,'failures:',failures.length);
  const downloaded=await pool(candidates,4,async candidate=>{
    const {work}=candidate,small=smallById.get(work.id),result=await request(candidate.url,{binary:true});
    if(Math.max(result.width,result.height)<=Math.max(small.width,small.height)||result.width*result.height<=small.width*small.height)throw Error('Source provides no larger real pixels ('+result.width+'x'+result.height+').');
    const relative='assets/study-large/'+work.id+'.'+result.extension;await fs.writeFile(path.join(site,relative),result.bytes);
    return{workId:work.id,sourceIdentity:identity(work),imageLarge:relative,largeWidth:result.width,largeHeight:result.height,smallWidth:small.width,smallHeight:small.height,smallImageSha256:small.sha256,smallImageBytes:small.bytes,rights:candidate.rights,rightsUrl:candidate.rightsUrl,qualityStatus:Math.max(result.width,result.height)>=2000?'detail-ready':'source-limited',provenance:{provider:candidate.provider,metadataUrl:candidate.metadataUrl,institutionRecordUrl:work.sourceUrl,institutionIdentity:candidate.institutionIdentity,downloadUrl:candidate.url,originalImageUrl:candidate.originalImageUrl||candidate.url,sourceWidth:candidate.sourceWidth,sourceHeight:candidate.sourceHeight,contentType:result.contentType,verifiedMime:result.mime,sha256:sha(result.bytes),bytes:result.bytes.length,retrievedAt:new Date().toISOString(),licenseMetadata:candidate.licenseMetadata,transformation:candidate.transformation}};
  });
  const entries={};for(let i=0;i<downloaded.length;i++){const result=downloaded[i];if(result.error)failures.push({...result,workId:candidates[i].work.id,attemptedUrl:candidates[i].url});else entries[result.workId]=result;}
  const manifest={version:1,revision:'study-media-v1',scope:'The original99 source-linked study works. Small images and artwork identities are preserved. These are larger real reproductions, with no AI upscaling.',originalCatalogueSize:works.length,generatedAt:new Date().toISOString(),targetLongEdge:2000,entries,failures,summary:{originalWorks:works.length,largeImages:Object.keys(entries).length,detailReady:Object.values(entries).filter(entry=>entry.qualityStatus==='detail-ready').length,sourceLimited:Object.values(entries).filter(entry=>entry.qualityStatus==='source-limited').length,totalBytes:Object.values(entries).reduce((sum,entry)=>sum+entry.provenance.bytes,0)}};
  await fs.writeFile(path.join(site,'study-image-sources.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest.summary));for(const failure of failures)console.log('UNRESOLVED',failure.workId,failure.error);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
