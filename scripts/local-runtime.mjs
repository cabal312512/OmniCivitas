import './guard-paths.mjs';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
const mode = process.argv[2] || 'serve';
if (!['serve','dev'].includes(mode)) throw new Error('Use dev or serve.');
const deps = process.env.OCV_DEPS_ROOT;
const nginxHome = path.join(deps,'tools/nginx-1.30.5');
const nginx = path.join(nginxHome,'nginx.exe');
await access(nginx); await access('services/gateway/dist/main.js');
if (mode === 'serve') await access('config/apps/portal/dist/index.html');
const ports = mode === 'dev' ? [8080,3000,4321] : [8080,3000];
for (const port of ports) await new Promise((resolve,reject) => {
  const server=net.createServer(); server.once('error',()=>reject(new Error(`Port ${port} is occupied. Stop its owning process; this launcher will not kill unrelated processes.`)));
  server.listen(port,'127.0.0.1',()=>server.close(resolve));
});
const runtime = path.join(deps,'runtime/local-nginx'); await mkdir(runtime,{recursive:true});
await mkdir(path.join(runtime,'logs'),{recursive:true});
const prefix = runtime.replaceAll('\\','/')+'/';
const webRoot = path.resolve('config/apps/portal/dist').replaceAll('\\','/');
const mime = path.join(nginxHome,'conf/mime.types').replaceAll('\\','/');
const portalLocation = mode === 'dev' ? `proxy_pass http://127.0.0.1:4321; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` : `root "${webRoot}"; index index.html; try_files $uri $uri/ =404;`;
const config = `daemon off;\nworker_processes 1;\nerror_log "${prefix}error.log" warn;\npid "${prefix}nginx.pid";\nevents { worker_connections 256; }\nhttp { include "${mime}"; access_log "${prefix}access.log"; server_tokens off; client_max_body_size 16k; proxy_connect_timeout 2s; proxy_read_timeout 8s; proxy_send_timeout 5s; client_body_temp_path "${prefix}client_temp"; proxy_temp_path "${prefix}proxy_temp"; fastcgi_temp_path "${prefix}fastcgi_temp"; uwsgi_temp_path "${prefix}uwsgi_temp"; scgi_temp_path "${prefix}scgi_temp"; server { listen 127.0.0.1:8080; location /api/ { proxy_pass http://127.0.0.1:3000; } location /health/ { proxy_pass http://127.0.0.1:3000; } location / { ${portalLocation} } } }\n`;
await writeFile(path.join(runtime,'nginx.conf'),config);
const nginxCheck = spawnSync(nginx,['-p',prefix,'-c','nginx.conf','-t'],{cwd:runtime,stdio:'inherit'});
if(nginxCheck.status !== 0) throw new Error('Nginx configuration validation failed.');
const children=[];
let stopping=false;
function shutdown(code=0) {
  if(stopping)return; stopping=true;
  spawnSync(nginx,['-p',prefix,'-c','nginx.conf','-s','quit'],{cwd:runtime,stdio:'ignore'});
  for(const child of children) child.kill();
  setTimeout(()=>process.exit(code),600).unref();
}
function start(name,file,args,env={}) {
  const log=createWriteStream(path.join(deps,'runtime/logs',`local-${name}.log`),{flags:'w'});
  const child=spawn(file,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.pipe(log);child.stderr.pipe(log);children.push(child);
  child.on('error',error=>{console.error(`${name}: ${error.message}`);shutdown(1);});
  child.on('exit',code=>{log.end();if(!stopping){console.error(`${name} stopped (${code}). See F:\\OCVdeps\\runtime\\logs.`);shutdown(1);}});
}
start('gateway',process.execPath,['services/gateway/dist/main.js'],{HOST:'127.0.0.1',PORT:'3000',DATABASE_URL:'',REDIS_URL:'',OCV_REQUIRE_INFRASTRUCTURE:'false',OCV_PROFILE:'local-core',NODE_OPTIONS:'--max-old-space-size=512'});
if(mode==='dev') start('astro',process.execPath,['F:/OCVdeps/tools/pnpm/bin/pnpm.cjs','--filter','@omnicivitas/portal','dev'],{NODE_OPTIONS:'--max-old-space-size=1536'});
start('nginx',nginx,['-p',prefix,'-c','nginx.conf']);
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
console.log(`OmniCivitas ${mode}: http://127.0.0.1:8080 . Nginx + Astro ${mode==='serve'?'built pages':'dev server'} + real NestJS; storage is explicitly a bounded-memory demo.`);

