// Read-only deployment checks. No image pulls, builds or optional service launches.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
export async function inspectRuntime({browserEnd,urls}){
 const deps=process.env.OCV_DEPS_ROOT,local=process.platform==='win32'&&Boolean(deps);
 const runtime=deps?path.join(deps,'runtime/reports'):path.resolve('.test-results');
 const binary=process.env.OCV_DOCKER_BIN||(local?path.join(deps,'docker-app/resources/bin/docker.exe'):'docker');
 const env=local?{...process.env,USERPROFILE:path.join(deps,'docker-desktop'),APPDATA:path.join(deps,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(deps,'docker-desktop/appdata/Local'),COMPOSE_PARALLEL_LIMIT:'1'}:process.env;
 const docker=args=>{const r=spawnSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,env});assert.equal(r.status,0,r.error?.message||r.stderr);return r.stdout;};
 const compose=args=>docker(['compose','-p','omnicivitas','-f','compose.yaml','--profile','*',...args]);
 let storage={localWindowsPhysicalGuardApplicable:false};
 if(local){const started=Date.now(),guard=spawnSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1'],{encoding:'utf8',timeout:60000});assert.equal(guard.status,0,guard.stderr||guard.stdout);storage=read(path.join(runtime,'docker-storage.json'));assert.ok(Date.parse(storage.verifiedAt)>=started-1000);assert.equal(storage.pullPermitted,true);assert.ok(storage.disks.length>=2);assert.ok(storage.actualVmMemoryBytes<=9*1024**3+64*1024**2);}
 const ids=compose(['ps','-q']).trim().split(/\s+/).filter(Boolean);assert.equal(ids.length,6);
 const core=JSON.parse(docker(['inspect',...ids])).map(c=>({service:c.Config.Labels['com.docker.compose.service'],running:c.State.Running,health:c.State.Health?.Status,limitMiB:c.HostConfig.Memory/1048576,swapLimitMiB:c.HostConfig.MemorySwap/1048576,cpus:c.HostConfig.NanoCpus/1e9,pidsLimit:c.HostConfig.PidsLimit,logs:c.HostConfig.LogConfig,image:c.Image}));
 assert.deepEqual(core.map(c=>c.service).toSorted(),['edge','gateway','next','portal','postgres','redis']);
 assert.ok(core.every(c=>c.running&&c.health==='healthy'&&c.limitMiB>0&&c.swapLimitMiB===c.limitMiB&&c.cpus>0&&c.pidsLimit>0&&c.logs.Config['max-size']&&c.logs.Config['max-file']));
 const totalCapsMiB=core.reduce((n,c)=>n+c.limitMiB,0);assert.equal(totalCapsMiB,1728);
 const builder=JSON.parse(docker(['inspect','buildx_buildkit_ocv-budget-builder0']))[0];assert.equal(builder.State.Running,false);assert.equal(builder.HostConfig.Memory/1048576,3072);
 const base=new URL(process.env.OCV_BASE_URL||'http://127.0.0.1:8080'),HTTP=[];
 for(const url of new Set(urls)){assert.ok(url.startsWith('/')&&!url.startsWith('//'));const response=await fetch(new URL(url,base),{signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,url);if(/^\/functions\/[^/]+\/$/.test(url)&&!['/functions/clock/','/functions/games/'].includes(url))assert.ok(bytes.toString().includes('id="tool-form"'),'Placeholder '+url);HTTP.push({url,status:200,sha256:sha(bytes)});}
 const backendRoutes=[];
 for(const route of ['/api/auth/login','/api/auth/register','/api/login','/api/register'])for(const method of ['GET','POST']){const response=await fetch(new URL(route,base),{method,signal:AbortSignal.timeout(10000)});await response.arrayBuffer();assert.equal(response.status,404,method+' '+route);backendRoutes.push({route,method,status:404});}
 const query='SELECT (SELECT count(*) FROM ocv_unused.users),(SELECT count(*) FROM ocv_unused.user_passwords),(SELECT count(*) FROM ocv_unused.login_sessions);';
 const emptyAccountCounts=compose(['exec','-T','postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c \''+query+'\'']).trim();assert.equal(emptyAccountCounts,'0|0|0');
 const licenses=read('docs/phase-6-acceptance.json').licenseHTTP,licenseHTTP=[];assert.equal(licenses.length,11);
 for(const item of licenses){const bytes=fs.readFileSync(item.file);assert.equal(sha(bytes),item.sha256);const response=await fetch(new URL(item.url,base),{signal:AbortSignal.timeout(10000)}),actual=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,item.url);assert.deepEqual(actual,bytes);licenseHTTP.push({...item,status:200});}
 assert.deepEqual(fs.readFileSync('THIRD_PARTY_NOTICES.txt'),fs.readFileSync('config/apps/portal/public/third-party-notices.txt'));
 const prior=read('docs/phase-6-acceptance.json');for(const file of ['config/apps/portal/package.json','pnpm-lock.yaml'])assert.equal(sha(fs.readFileSync(file)),prior.sourceHashes[file],'Unexpected new dependency change '+file);
 const memory=read(path.join(runtime,'phase7-memory.json')).at(-1);assert.ok(memory.totalWorkingSetMiB>0);assert.ok(Date.parse(memory.sampledAt)>=browserEnd-1000);assert.ok(memory.processes.length>0);
 return {core,totalCapsMiB,builderStopped:true,builderCapMiB:3072,storage,HTTP,backendRoutes,emptyAccountCounts,licenseHTTP,memory,newDependencies:[]};
}
