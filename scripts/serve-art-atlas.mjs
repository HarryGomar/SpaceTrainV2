import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../public/art-atlas/',import.meta.url));
const args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1]||process.env.ART_ATLAS_PORT||56122);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,'http://127.0.0.1');
    if(url.pathname==='/'||url.pathname==='/art-atlas'){response.writeHead(302,{Location:'/art-atlas/'});response.end();return;}
    if(!['GET','HEAD'].includes(request.method)||!url.pathname.startsWith('/art-atlas/'))throw Error('not-found');
    const relative=decodeURIComponent(url.pathname.slice('/art-atlas/'.length))||'index.html',file=path.resolve(root,relative),inside=path.relative(root,file);
    if(inside.startsWith('..')||path.isAbsolute(inside))throw Error('not-found');
    const data=await fs.readFile(file);
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':data.length});
    response.end(request.method==='HEAD'?undefined:data);
  }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Art Atlas: http://127.0.0.1:${port}/art-atlas/\n`));
