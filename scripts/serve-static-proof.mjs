// Temporary local evidence server, independent of the normal application entry.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??''),port=Number(process.argv[3]);
assert.ok(process.argv[2]&&fs.statSync(root).isDirectory());
assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.avif':'image/avif','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer((request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost'),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative+(url.pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size});fs.createReadStream(file).pipe(response);
 }catch{response.writeHead(400).end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Temporary evidence server ready on '+port));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
