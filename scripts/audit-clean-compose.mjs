import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dockerCall} from './docker-child.mjs';

// Isolated acceptance project; this is not an application startup dependency.
const name=process.env.OCV_AUDIT_PROJECT||'ocv-clean-phase9';
assert.match(name,/^ocv-clean-[a-z0-9-]+$/);
const builder=process.env.OCV_AUDIT_BUILDER||'ocv-budget-builder';
if(process.platform==='win32'&&process.env.OCV_LOCAL_STORAGE_GUARD==='1'){
 const guard=spawnSync('powershell.exe',['-NoProfile','-File','scripts/Confirm-DockerStorage.ps1'],{stdio:'inherit'});
 assert.equal(guard.status,0);
}
process.env.COMPOSE_PROJECT_NAME=name;
process.env.OCV_WEB_PORT=process.env.OCV_AUDIT_PORT||'8095';
process.env.OCV_PG_USER='clone_reader';process.env.OCV_PG_PASSWORD='fiction-clone-043';process.env.OCV_PG_DATABASE='clone_database';
process.env.OCV_MINIO_USER='clone-files';process.env.OCV_MINIO_PASSWORD='fiction-clone-file-043';
const compose=args=>dockerCall(['compose','-p',name,'-f','compose.yaml',...args]);
const existing=compose(['ps','-a','-q']).stdout.trim();assert.equal(existing,'','Use a fresh audit project, not existing containers');
const volumes=dockerCall(['volume','ls','--filter','label=com.docker.compose.project='+name,'-q']).stdout.trim();
assert.equal(volumes,'','Use a fresh audit project, not previously initialized data');
let started=false;
try{
 const present=dockerCall(['buildx','inspect',builder],{allowFailure:true});
 if(present.status!==0)dockerCall(['buildx','create','--name',builder,'--driver','docker-container','--driver-opt','memory=3g,memory-swap=3g,cpu-period=100000,cpu-quota=200000']);
 dockerCall(['buildx','inspect',builder,'--bootstrap']);
 const actual=JSON.parse(dockerCall(['inspect','buildx_buildkit_'+builder+'0']).stdout)[0];
 assert.ok(actual.HostConfig.Memory>0&&actual.HostConfig.Memory<=3072*1048576);
 for(const target of ['portal','next','gateway']){const result=compose(['build','--builder',builder,target]);console.log(result.stdout,result.stderr)}
 dockerCall(['buildx','stop',builder]);
 // No profile switch: verify the actual default six-service public entry.
 console.log(compose(['up','-d','--wait','--wait-timeout','240']).stderr);started=true;
 const ids=compose(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
 const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);assert.equal(containers.length,6);
 assert.ok(containers.every(c=>c.State.Health?.Status==='healthy'));
 for(const c of containers)for(const mount of c.Mounts)if(mount.Type==='volume')assert.ok(mount.Name.startsWith(name+'_'));
 const environment={...process.env,OCV_BASE_URL:'http://127.0.0.1:'+process.env.OCV_WEB_PORT,OCV_VERIFY_REPORT_PREFIX:'phase9-clean-compose-',OCV_EXPECT_DATABASE:'true'};
 for(const file of ['verify-runtime.mjs','verify-core-storage.mjs']){
  const result=spawnSync(process.execPath,['scripts/'+file],{env:environment,stdio:'inherit'});assert.equal(result.status,0,file);
 }
 console.log(compose(['up','-d','--wait','--wait-timeout','180','hono','minio']).stderr);
 const optional=dockerCall(['compose','-p',name,'-f','compose.yaml','exec','-T','gateway','node','--input-type=module','-e',
  `import assert from 'node:assert/strict';import http from 'node:http';const response=await fetch('http://hono:3100/api/file.asmx',{signal:AbortSignal.timeout(8000)});const value=await response.json();assert.equal(response.status,200);assert.equal(value.canContinue,true);assert.equal(value.source,'MinIO');assert.ok(value.contents.length>0);const status=await new Promise((resolve,reject)=>{const request=http.request({hostname:'hono',port:3100,path:'/graphql',method:'POST',headers:{'Content-Type':'application/json'},timeout:4000},response=>{response.resume();resolve(response.statusCode)});request.on('timeout',()=>request.destroy(Error('deadline')));request.on('error',reject);request.write('x'.repeat(17000));request.end()});assert.equal(status,413);console.log('PASS real MinIO with nondefault credentials; chunked Hono body rejected at 16 KiB')`]);
 console.log(optional.stdout);
 const root=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');await fs.mkdir(root,{recursive:true});
 await fs.writeFile(path.join(root,'phase9-clean-compose.json'),JSON.stringify({status:'passed',at:new Date().toISOString(),project:name,defaultServices:containers.map(c=>c.Config.Labels['com.docker.compose.service']),freshVolumes:true,nondefaultDatabaseUserAndDatabase:true,optionalMinioWithNondefaultCredentials:true,chunkedHonoRequestStatus:413,standardEntry:'docker compose up -d --wait',buildContext:process.cwd(),builderCapMiB:actual.HostConfig.Memory/1048576},null,2));
}finally{
 if(started||compose(['--profile','*','ps','-a','-q']).stdout.trim())console.log(compose(['--profile','*','down','--timeout','10']).stderr);
 dockerCall(['buildx','stop',builder],{allowFailure:true});
}
