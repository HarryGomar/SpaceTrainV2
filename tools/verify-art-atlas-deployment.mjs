import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repository=fileURLToPath(new URL('../',import.meta.url));
const app=path.join(repository,'public/art-atlas');
const base=new URL(process.argv[2]||'https://harrygomar.com/art-atlas/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Use HTTPS or a loopback development server.');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=[];
async function walk(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const name=path.join(directory,entry.name);
    if(entry.isDirectory())await walk(name);else files.push(name);
  }
}
await walk(app);
const failures=[],verified=[],lineEndingOnly=[];
let cursor=0,totalBytes=0;
async function worker(){
  while(cursor<files.length){
    const file=files[cursor++],relative=path.relative(app,file).replaceAll('\\','/');
    try{
      const response=await fetch(new URL(relative,base),{cache:'no-store',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const actual=Buffer.from(await response.arrayBuffer()),expected=await fs.readFile(file);
      if(hash(actual)!==hash(expected)){
        const text=/\.(?:html|css|js|mjs|json|svg|txt|xml|webmanifest)$/i.test(relative);
        if(!text||actual.toString('utf8').replaceAll('\r\n','\n')!==expected.toString('utf8').replaceAll('\r\n','\n'))throw Error('Deployed bytes differ from the reviewed local file');
        lineEndingOnly.push(relative);
      }
      totalBytes+=actual.length;verified.push(relative);
    }catch(error){failures.push({path:relative,error:String(error.message||error)});}
  }
}
await Promise.all(Array.from({length:6},worker));
for(const missing of ['missing-art-atlas-module.mjs','assets/missing-art-atlas-image.jpg']){
  try{
    const response=await fetch(new URL(missing,base),{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(response.status!==404)failures.push({path:missing,error:'Expected 404, got '+response.status});
  }catch(error){failures.push({path:missing,error:String(error.message||error)});}
}
const report={base:base.href,checkedAt:new Date().toISOString(),expectedFiles:files.length,verifiedFiles:verified.length,totalBytes,lineEndingOnly,failures};
const output=path.join(repository,'artifacts/art-atlas');
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'deployment-assets.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
