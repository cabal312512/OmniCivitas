import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../config/apps/portal/dist/',import.meta.url));
const port=Number(process.env.OCV_RESEARCH_PREVIEW_PORT??4473);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.mp3':'audio/mpeg','.ogg':'audio/ogg','.gz':'application/gzip','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{let name;try{name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}
 let file=path.resolve(root,'.'+name);if(path.relative(root,file).startsWith('..')){response.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){response.writeHead(404).end('Not found');return;}
 const size=fs.statSync(file).size,headers={'Content-Type':mime[path.extname(file)]??'application/octet-stream','Accept-Ranges':'bytes'};
 const range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=0,end=size-1,status=200;
 if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),size-1):size-1;if(start>end||start>=size){response.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
 headers['Content-Length']=end-start+1;response.writeHead(status,headers);if(request.method==='HEAD'){response.end();return;}fs.createReadStream(file,{start,end}).on('error',()=>response.destroy()).pipe(response);
});
server.listen(port,'127.0.0.1',()=>console.log(`Static research preview ready on port ${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
