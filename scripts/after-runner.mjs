import {spawn} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {getHeapStatistics} from 'node:v8';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access,unlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {docker} from './docker-child.mjs';
import capacity from '../services/gateway/src/a1/tier.cjs';
import {resolveRuntimePaths,resolveRunnerConcurrency} from './runtime-paths.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const catalog=JSON.parse(await readFile('services/gateway/src/a1/catalog.json','utf8'));
const local=process.platform==='win32'&&process.env.OCV_LOCAL_STORAGE_GUARD==='1';
const runtime=resolveRuntimePaths();
const stateRoot=runtime.runnerRoot;
await mkdir(stateRoot,{recursive:true,mode:0o700});
const stopFile=path.join(stateRoot,'stop');
if(process.argv.includes('--stop')){await writeFile(stopFile,'stop\n',{mode:0o600});console.log('Stop requested; the current bounded batch will finish and its owned containers will stop.');process.exit(0);}
await unlink(stopFile).catch(error=>{if(error.code!=='ENOENT')throw error;});
let key=process.env.OCV_RUNNER_KEY;
const keyFile=path.join(stateRoot,'worker.key');
if(!key){try{key=(await readFile(keyFile,'utf8')).trim();}catch{key=randomBytes(32).toString('hex');await writeFile(keyFile,key+'\n',{mode:0o600,flag:'wx'});}}
if(!/^[a-f0-9]{64}$/.test(key))throw Error('Worker key must be a private 64-character hex value');
process.env.OCV_RUNNER_KEY=key;
// Persist only the private setting, so an ordinary core restart keeps the lease endpoint enabled.
let dotenv='';try{dotenv=await readFile(path.join(root,'.env'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const setting=/^[ \t]*OCV_RUNNER_KEY[ \t]*=.*$/gm;
const normalized=setting.test(dotenv)?dotenv.replace(setting,'OCV_RUNNER_KEY='+key):dotenv.trimEnd()+'\nOCV_RUNNER_KEY='+key+'\n';
if(normalized!==dotenv)await writeFile(path.join(root,'.env'),normalized,{mode:0o600});
const base=process.env.OCV_BASE_URL||`http://127.0.0.1:${process.env.OCV_WEB_PORT||8080}`;
if(!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(base))throw Error('The privileged host runner uses a loopback HTTP entrance only');
const worker=randomUUID(),project=process.env.COMPOSE_PROJECT_NAME||'omnicivitas';
const files=['-f','compose.yaml'];
const compose=['compose','-p',project,...files,'--profile','*'];
let config,stopping=false,children=new Set(),owned=new Set(),heartbeatBusy=false,leased=false,leaseHealthy=false,concurrency=4;
const context=new AsyncLocalStorage(),active=new Map(),serviceUsers=new Map(),readyServices=new Map(),gates=new Map();
let serviceQueue=Promise.resolve(),logQueue=Promise.resolve(),reportQueue=Promise.resolve(),executing=0;
const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.floor(n))):fallback};
const resourceWaitMs=bounded(process.env.OCV_RUNNER_RESOURCE_WAIT_MS,180000,1000,900000);
const sharedFamilies=new Set(['circuits','mechanical','music-report','shared']);
const sharedAmqp=['1','true'].includes(String(process.env.OCV_SHARED_AMQP||'').toLowerCase());
const serviceLimits=new Map([['engineering-data',4],['dotnet',2],['fastapi',1],['spring',2],['signals-native',2],['mechanics-native',2],['site-projection',1],['site-index',2],['site-certificate',2],['site-audio',2]]);
async function serviceLock(task){const before=serviceQueue;let release;serviceQueue=new Promise(resolve=>{release=resolve});await before;try{return await task()}finally{release()}}
function stopChildren(state){if(!state||state.aborted)return;state.aborted=true;for(const child of state.children)child.kill();terminateNative(state).catch(()=>{})}
function requestStop(){stopping=true;for(const state of active.values())stopChildren(state.context)}
async function gate(name,task){const owner=context.getStore();if(owner?.held.has(name))return task();let state=gates.get(name);if(!state){state={active:0,waiters:[]};gates.set(name,state)}while(state.active>=(serviceLimits.get(name)||4)){if(stopping||owner?.aborted)throw Error('Worker task cancelled while waiting for execution');await new Promise(resolve=>{const waiter=()=>{clearTimeout(timer);resolve()};const timer=setTimeout(()=>{const i=state.waiters.indexOf(waiter);if(i>=0)state.waiters.splice(i,1);resolve()},500);state.waiters.push(waiter)})}if(stopping||owner?.aborted)throw Error('Worker task cancelled before execution');state.active++;owner?.held.add(name);try{return await task()}finally{owner?.held.delete(name);state.active--;for(const wake of state.waiters.splice(0))wake()}}
function syncCapacity(){
 const selected=capacity.readTaskCapacity(root),dispatch=resolveRunnerConcurrency(selected.concurrency,{config:runtime.config});concurrency=dispatch.concurrency;report.configuredConcurrency=selected.concurrency;report.effectiveConcurrency=concurrency;report.concurrency=concurrency;report.dispatchLimit=dispatch.limit;report.queueLimit=selected.queueLimit;report.tierSource=selected.source;
 for(const name of ['signals-native','mechanics-native']){const service=config?.services[name],memory=Number(service?.mem_limit)/1048576,cpu=Number(service?.cpus)||1,pids=Number(service?.pids_limit)||256;
  const slots=Math.max(1,Math.min(concurrency,128,Math.max(1,Math.floor(memory/128)-2),Math.max(1,Math.floor(cpu*2)),Math.max(1,Math.floor((pids-8)/4)),Math.max(1,Math.floor((getHeapStatistics().heap_size_limit/1048576-192)/8))));serviceLimits.set(name,slots);
 }report.serviceExecutionSlots=Object.fromEntries(serviceLimits);return selected;
}
const report={startedAt:new Date().toISOString(),worker,completed:[],failed:[],cancelled:[],maximumCapsMiB:0,maximumConcurrentJobs:0,maximumConcurrentExecutions:0,concurrency:4,events:[],defaultCoreOnly:true};
const logFile=path.join(stateRoot,'worker.log');
async function log(message){
 const task=logQueue.then(async()=>{let previous='';try{previous=await readFile(logFile,'utf8')}catch{}const bytes=Buffer.from(previous+new Date().toISOString()+' '+message+'\n');await writeFile(logFile,bytes.subarray(Math.max(0,bytes.length-1048576)),{mode:0o600});if(process.argv.some(x=>x==='--tour'||x.startsWith('--tour=')))console.log(message)});logQueue=task.catch(()=>{});return task;
}
function event(kind,job,phase){report.events.push({at:new Date().toISOString(),kind,id:job.id,family:job.family,phase});report.events=report.events.slice(-256)}
async function writeReport(){const bytes=JSON.stringify(report,null,2);const task=reportQueue.then(()=>writeFile(path.join(stateRoot,'latest-report.json'),bytes,{mode:0o600}));reportQueue=task.catch(()=>{});return task}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(file,args,{timeout=1200000,quiet=false,input,onInterrupt,measure=true}={}){
 const overrides=file===docker&&local?{USERPROFILE:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop'),APPDATA:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop/appdata/Local')}:{};
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:root,env:{...process.env,...overrides,COMPOSE_PARALLEL_LIMIT:'1',COMPOSE_PROFILES:''},windowsHide:true,stdio:[input===undefined?'ignore':'pipe','pipe','pipe']});children.add(child);const owner=context.getStore();owner?.children.add(child);const measured=measure&&!!owner&&file===docker&&args.includes('exec');if(measured){executing++;report.maximumConcurrentExecutions=Math.max(report.maximumConcurrentExecutions,executing);event('execution-start',owner.job,owner.phase)}let counted=false;const finished=()=>{if(measured&&!counted){counted=true;executing--;event('execution-end',owner.job,owner.phase)}};
  if(input!==undefined){child.stdin.on('error',()=>{});child.stdin.end(input);}
  let stdout='',stderr='',reason='';const interrupt=why=>{if(reason)return;reason=why;try{Promise.resolve(onInterrupt?.()).catch(()=>{})}catch{}child.kill()};const timer=setTimeout(()=>interrupt('command timed out'),timeout);
  child.stdout.on('data',b=>{if(Buffer.byteLength(stdout)+b.length>8388608)interrupt('command output exceeds its limit');else stdout+=b;});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2097152);});
  child.on('error',error=>{clearTimeout(timer);children.delete(child);owner?.children.delete(child);finished();reject(error);});
  child.on('close',code=>{clearTimeout(timer);children.delete(child);owner?.children.delete(child);finished();if(code===0&&!reason)resolve(stdout);else reject(Error(`${path.basename(file)} failed (${code}); ${reason||(quiet?'inspect its bounded runtime log':stderr.slice(-1200))}`));});
 });
}
const dc=(args,options)=>run(docker,args,options);
const cc=(args,options)=>dc([...compose,...args],options);
const nativeCode=`set -eu
pidfile=$1
engine=$2
deadline=$3
mkdir -p -m 700 /tmp/ocv-runner
now=$(date +%s)
for stale in /tmp/ocv-runner/*.stop; do
 [ -f "$stale" ] || continue
 read expires < "$stale" || continue
 case "$expires" in ''|*[!0-9]*) continue;; esac
 [ "$expires" -ge "$now" ] || rm -f "$stale"
done
trap 'rm -f "$pidfile" "$pidfile.tmp" "$pidfile.stop"' EXIT
[ "$now" -lt "$deadline" ] && [ ! -e "$pidfile.stop" ] || exit 130
token_for() {
 line=$(cat "/proc/$1/stat" 2>/dev/null) || return 1
 rest="\${line##*) }"
 set -- $rest
 [ "$#" -ge 20 ] || return 1
 shift 19
 printf '%s' "$1"
}
exec 3<&0
"$engine" <&3 &
pid=$!
trap 'kill -TERM "$pid" 2>/dev/null || true' TERM INT
if token=$(token_for "$pid"); then
 printf '%s %s\\n' "$pid" "$token" > "$pidfile.tmp"
 mv "$pidfile.tmp" "$pidfile"
 [ ! -e "$pidfile.stop" ] || kill -TERM "$pid" 2>/dev/null || true
fi
set +e
wait "$pid"
result=$?
exit "$result"
`;
const nativeStopCode=`set -eu
pidfile=$1
engine=$2
expires=$3
mkdir -p -m 700 /tmp/ocv-runner
printf '%s\\n' "$expires" > "$pidfile.stop"
attempt=0
while [ ! -f "$pidfile" ] && [ "$attempt" -lt 10 ]; do
 sleep 0.1
 attempt=$((attempt + 1))
done
[ -f "$pidfile" ] || exit 0
if ! read pid token < "$pidfile"; then
 [ -f "$pidfile" ] && exit 1 || exit 0
fi
case "$pid:$token" in *[!0-9:]*|:*|*:) exit 1;; esac
[ "$pid" -gt 1 ] || exit 1
identity() {
 line=$(cat "/proc/$pid/stat" 2>/dev/null) || return 1
 rest="\${line##*) }"
 set -- $rest
 [ "$#" -ge 20 ] || return 1
 shift 19
 [ "$1" = "$token" ]
}
matches() { identity && [ "/proc/$pid/exe" -ef "$engine" ]; }
attempt=0
while identity && ! matches && [ "$attempt" -lt 10 ]; do
 sleep 0.05
 attempt=$((attempt + 1))
done
if identity && ! matches; then exit 1; fi
if ! matches; then rm -f "$pidfile"; exit 0; fi
kill -TERM "$pid" 2>/dev/null || true
sleep 0.15
if matches; then kill -KILL "$pid" 2>/dev/null || true; fi
attempt=0
while matches && [ "$attempt" -lt 10 ]; do
 sleep 0.1
 attempt=$((attempt + 1))
done
if matches; then exit 1; fi
rm -f "$pidfile"
`;
function terminateNative(state){
 const execution=state?.native;if(!execution||execution.finished)return Promise.resolve();if(execution.termination)return execution.termination;execution.interrupted=true;
 execution.termination=cc(['exec','-T',execution.service,'sh','-c',nativeStopCode,'ocv-native-stop',execution.pidfile,execution.command,String(execution.expires)],{quiet:true,timeout:5000,measure:false}).catch(error=>{requestStop();throw Error('Could not confirm scoped native cancellation: '+error.message.slice(0,200))});
 execution.termination.catch(()=>{});return execution.termination;
}
async function nativeRun(job,service,command,request,timeout){
 const state=context.getStore();if(!state||state.aborted||stopping)throw Error('Native task cancelled before execution');if(!/^[a-f0-9-]{36}$/.test(job.id)||!['/opt/ocv/ocv-circuit','/opt/ocv/ocv-communications','/opt/ocv/ocv-mechanics','/opt/site/audio','/opt/site/receipt'].includes(command))throw Error('Invalid native execution identity');
 const deadline=Math.ceil((Date.now()+timeout)/1000),execution={service,command,pidfile:'/tmp/ocv-runner/'+worker+'-'+job.id+'.pid',expires:deadline+60,finished:false,interrupted:false,termination:null};state.native=execution;
 try{const raw=await cc(['exec','-T',service,'sh','-c',nativeCode,'ocv-native',execution.pidfile,command,String(deadline)],{input:JSON.stringify(request),timeout,onInterrupt:()=>terminateNative(state)});if(execution.interrupted||state.aborted||stopping)throw Error('Native task cancelled');return raw}
 catch(error){await terminateNative(state);throw error}
 finally{try{if(execution.termination)await execution.termination}finally{execution.finished=true;if(state.native===execution)state.native=null}}
}
async function control(action,extra={}){
 const r=await workerFetch(base+'/api/a2/worker.cgi',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body:JSON.stringify({worker,action,...extra}),signal:AbortSignal.timeout(8000)},'Worker control');
 if(!r.ok)throw serviceError(r.status,'','Worker control');return r.json();
}
async function snapshot(){const ids=(await dc(['ps','-q','--filter',`label=com.docker.compose.project=${project}`])).trim().split(/\s+/).filter(Boolean);return ids.length?JSON.parse(await dc(['inspect',...ids])):[];}
const core=new Set(['edge','gateway','portal','next','postgres','redis']);
function closure(names){const selected=new Set(names);for(const n of selected){if(!config.services[n])throw Error('Unconfigured service');for(const d of Object.keys(config.services[n].depends_on||{}))selected.add(d);}return [...selected];}
async function budget(names,building=false){
 const running=await snapshot(),selected=new Set(running.filter(c=>c.State.Running).map(c=>c.Config.Labels['com.docker.compose.service']));
 if(!building)for(const n of closure(names))selected.add(n);
 let total=building?3072:0;
 for(const n of selected){const cap=Number(config.services[n]?.mem_limit);if(!(cap>0))throw Error('An active project service has no bounded memory configuration');total+=cap/1048576;}
 const info=JSON.parse(await dc(['info','--format','{{json .}}'])),ceiling=Math.min(Number(process.env.OCV_RUNNER_BUDGET_MIB||6144),Math.floor(info.MemTotal/1048576)-1536);
 const foreignIds=(await dc(['ps','-q'])).trim().split(/\s+/).filter(Boolean);
 if(foreignIds.length){for(const c of JSON.parse(await dc(['inspect',...foreignIds]))){if(c.Config.Labels?.['com.docker.compose.project']===project||c.Name==='/buildx_buildkit_ocv-after-builder0')continue;const cap=c.HostConfig.Memory;if(!cap)throw Error('Another running container is uncapped; close it or give it a memory limit before starting a batch');total+=cap/1048576;}}
 if(!Number.isFinite(ceiling)||ceiling<=0||total>ceiling){const error=Error(`Batch memory caps ${total} MiB exceed available budget ${ceiling} MiB`);error.resourcePressure=true;error.code='resource_wait';throw error;}
 report.maximumCapsMiB=Math.max(report.maximumCapsMiB,total);return total;
}
async function storageGuard(){if(local)await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1']);}
async function images(names){
 const built=new Set();for(const n of closure(names)){
  const service=config.services[n];try{await dc(['image','inspect',service.image],{quiet:true});continue;}catch{}
  await storageGuard();
  if(service.build){
   await budget([],true);const builder='ocv-after-builder';
   try{await dc(['buildx','inspect',builder],{quiet:true});}catch{await dc(['buildx','create','--name',builder,'--driver','docker-container','--driver-opt','memory=3g','--driver-opt','memory-swap=3g','--driver-opt','cpu-quota=200000','--driver-opt','default-load=true']);}
   try{
    await dc(['buildx','inspect',builder,'--bootstrap']);
    const actual=JSON.parse(await dc(['inspect',`buildx_buildkit_${builder}0`]))[0].HostConfig.Memory;
    if(!(actual>0&&actual<=3072*1048576))throw Error('Cold builder must have a real <=3 GiB memory cap');
    if(!built.has(service.image)){await cc(['build','--builder',builder,n]);built.add(service.image);}
   }finally{await dc(['buildx','stop',builder]).catch(()=>{});}
  }else await dc(['pull',service.image]);
 }
}
async function saveOwned(){await writeFile(path.join(stateRoot,'owned.json'),JSON.stringify({worker,containers:[...owned]}),{mode:0o600})}
async function cleanupIdle(){
 if(!leaseHealthy){await saveOwned();return}
 for(const id of [...owned]){let c;try{c=JSON.parse(await dc(['inspect',id],{quiet:true}))[0]}catch{owned.delete(id);continue}const name=c.Config.Labels['com.docker.compose.service'];if(c.Config.Labels['com.docker.compose.project']!==project||core.has(name)){owned.delete(id);continue}if((serviceUsers.get(name)||0)>0)continue;readyServices.delete(name);if(c.State.Running)await dc(['stop','--time','5',id]);owned.delete(id)}await saveOwned();
}
async function cleanup(){return serviceLock(cleanupIdle)}
async function releasePhase(all=false){const state=context.getStore();return serviceLock(async()=>{if(state){for(const name of [...state.services]){if(!all&&state.pinned?.has(name))continue;const count=(serviceUsers.get(name)||0)-1;if(count>0)serviceUsers.set(name,count);else serviceUsers.delete(name);state.services.delete(name)}if(all)state.pinned?.clear()}await cleanupIdle()})}
async function warm(names){
 if(!names.length)return;const state=context.getStore(),needed=closure(names).filter(name=>!core.has(name)&&!state?.services.has(name)),deadline=Date.now()+resourceWaitMs;if(!needed.length)return;
 while(true){if(stopping||state?.aborted)throw Error('Worker stopping');if(state?.job&&await cancellationState(state.job))throw Error('Worker task cancelled before resource admission');let waiting=false;
  await serviceLock(async()=>{if(stopping||state?.aborted)throw Error('Worker stopping');if(needed.every(name=>(serviceUsers.get(name)||0)>0&&Date.now()-(readyServices.get(name)?.checkedAt||0)<3000)){for(const name of needed){serviceUsers.set(name,(serviceUsers.get(name)||0)+1);state?.services.add(name)}return}await cleanupIdle();try{await budget(names);await images(names);await budget(names)}catch(error){if(error.resourcePressure&&serviceUsers.size>0){waiting=true;return}throw error}
   const before=await snapshot(),running=new Set(before.filter(c=>c.State.Running&&(!c.State.Health||c.State.Health.Status==='healthy')).map(c=>c.Config.Labels['com.docker.compose.service'])),beforeIds=new Set(before.filter(c=>c.State.Running).map(c=>c.Id));
   try{if(needed.some(name=>!running.has(name)))await cc(['up','-d','--no-build',...(needed.some(name=>(serviceUsers.get(name)||0)>0)?['--no-recreate']:[]),'--wait','--wait-timeout','180',...names]);for(const name of needed){serviceUsers.set(name,(serviceUsers.get(name)||0)+1);state?.services.add(name)}}
   finally{for(const c of await snapshot()){const name=c.Config.Labels['com.docker.compose.service'];if(needed.includes(name)&&c.State.Running&&(!c.State.Health||c.State.Health.Status==='healthy'))readyServices.set(name,{id:c.Id,checkedAt:Date.now()});if(c.State.Running&&!beforeIds.has(c.Id)&&needed.includes(name)&&!core.has(name))owned.add(c.Id)}await saveOwned();if(!state?.services.size)await cleanupIdle()}
  });
  if(!waiting)return;if(Date.now()>deadline){const error=Error('Resource admission wait exceeded its bounded deadline');error.code='resource_wait';throw error;}await log('Resource admission waiting for '+state.job.family);await sleep(1000);
 }
}
const httpCode=`const u=process.argv[1],body=JSON.parse(process.argv[2]);fetch(u,{method:body===null?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(Number(process.argv[3]))}).then(async r=>{const text=await r.text();if(text.length>1048576)throw Error('response too large');console.log(JSON.stringify({status:r.status,text}));}).catch(e=>{console.error(new URL(u).host+new URL(u).pathname+': '+e.message);process.exitCode=1;});`;
async function inside(url,body=null,timeout=10000){return gate(new URL(url).hostname,async()=>{const r=JSON.parse(await cc(['exec','-T','gateway','node','-e',httpCode,url,JSON.stringify(body),String(timeout)]));if(r.status<200||r.status>=300)throw Error(`Internal service HTTP ${r.status}`);try{return JSON.parse(r.text)}catch{return r.text}})}
function serviceError(status,code,service){const e=Error(`${service} HTTP ${status}`);e.status=Number(status);e.code=code||({408:'transport_timeout',429:'resource_wait',502:'service_unavailable',503:'service_unavailable',504:'transport_timeout'}[status]||'invalid_request');return e}
async function workerFetch(url,options,label){try{return await fetch(url,options)}catch(error){throw serviceError(0,error.name==='TimeoutError'||error.name==='AbortError'?'transport_timeout':'connection_lost',label)}}
function failureCode(error){if(['service_unavailable','transport_timeout','transient_storage','resource_wait','version_conflict','history_gap'].includes(error.code))return error.code;if(['connection_lost','rate_limited','storage_unavailable'].includes(error.code))return 'service_unavailable';if(error.name==='TimeoutError'||error.name==='AbortError')return 'transport_timeout';return error.code==='checksum_mismatch'?'checksum_mismatch':'model_rejected'}
const httpStdinCode=`let body='';try{const incoming=new TextDecoder();let incomingBytes=0;for await(const b of process.stdin){incomingBytes+=b.length;if(incomingBytes>8388608)throw Error('body too large');body+=incoming.decode(b,{stream:true});}body+=incoming.decode();const headers={'Content-Type':'application/json'};if(process.env.OCV_RUNNER_KEY)headers['X-Ocv-Runner']=process.env.OCV_RUNNER_KEY;const r=await fetch(process.argv[1],{method:'POST',headers,body,signal:AbortSignal.timeout(20000)});let text='',size=0;const decoder=new TextDecoder();for await(const chunk of r.body){size+=chunk.length;if(size>8380416)throw Error('response too large');text+=decoder.decode(chunk,{stream:true});}text+=decoder.decode();let value;try{value=JSON.parse(text);}catch{value=null;}process.stdout.write(JSON.stringify({status:r.status,body:value,code:typeof value?.code==='string'?value.code:''}));}catch(e){process.stdout.write(JSON.stringify({status:0,body:null,code:e.name==='TimeoutError'||e.name==='AbortError'?'transport_timeout':e.message==='response too large'||e.message==='body too large'?'invalid_request':'connection_lost'}));}`;
async function insideLaboratory(url,body){
 const endpoint=new URL(url).pathname;
 let raw;try{raw=await cc(['exec','-T','gateway','node','--input-type=module','-e',httpStdinCode,url],{input:JSON.stringify(body),timeout:30000});}catch(error){throw Error(`Internal service ${endpoint}: ${error.message}`);}
 if(!raw.trim())throw Error(`Internal service ${endpoint} returned no JSON output`);
 let response;try{response=JSON.parse(raw);}catch{throw Error(`Internal service ${endpoint} returned invalid JSON`);}
 if(response.status<200||response.status>=300){const code=response.status===0?response.code:response.status===409?({'revision-conflict':'version_conflict','history-gap':'history_gap'}[response.code]||''):'';const error=serviceError(response.status,code,`Internal service ${endpoint}`);if(code==='version_conflict'||code==='history_gap')error.upstreamCode=response.code;throw error;}
 if(!response.body||typeof response.body!=='object')throw Error(`Internal service ${endpoint} returned no JSON object`);return response.body;
}
async function laboratoryControl(id,action,extra={}){
 const r=await workerFetch(base+'/api/signals/internal',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body:JSON.stringify({id,worker,action,...extra}),signal:AbortSignal.timeout(12000)},'Laboratory task');
 if(!r.ok)throw serviceError(r.status,'','Laboratory task');return r.json();
}
async function cancellationState(job){if(!sharedFamilies.has(job.family))return false;try{const state=await(job.family==='circuits'?laboratoryControl(job.id,'status'):job.family==='mechanical'?stockControl(job.id,'status'):sharedControl(job.id,'status'));return state.state==='cancelled'||state.cancelled===true}catch{return false}}
async function laboratory(job,phase){
 const input=await laboratoryControl(job.id,'input');
 if(phase===0){
  
  const receipt=await insideLaboratory('http://spring:8081/signals/dispatch.xml',{job:job.id,event:'prepare-1',phase:'prepared'});
  const manifest=input.snapshot_id?await insideLaboratory('http://fiber:8002/signals/manifest.php',{job:job.id}):await insideLaboratory('http://fiber:8002/signals/diff.cgi',{before:{},after:{operation:input.request.op}});
  return {java:receipt.receipt,go:manifest.manifest||manifest,storage:'PostgreSQL'};
 }
 if(phase===1){
  const command=input.request.op==='circuit'?'/opt/ocv/ocv-circuit':'/opt/ocv/ocv-communications';
  let checkBusy=false,cancelled=false;
  const interval=setInterval(async()=>{if(checkBusy)return;checkBusy=true;try{if(await cancellationState(job)){cancelled=true;stopChildren(context.getStore())}}finally{checkBusy=false;}},1000);
  try{
   const timeout=Math.min(180000,Math.max(1000,Number(process.env.OCV_SIGNALS_TIMEOUT_MS||30000)));
   const raw=await nativeRun(job,'signals-native',command,input.request,timeout);
   if(cancelled)throw Error('Laboratory task cancelled');if(Buffer.byteLength(raw)>4194304)throw Error('Native result exceeds 4 MiB');
   return await gate('engineering-data',async()=>{const engine=JSON.parse(raw);await laboratoryControl(job.id,'engine',{engine});
    if(!engine.ok)throw Error(engine.diagnostics?.map(x=>x.code+': '+x.message).join('; ').slice(0,300)||'Native solver rejected the model');
    return {engine:engine.engine,version:engine.version,rows:engine.rows?.length??engine.events?.length??engine.waveform?.length??0,operation:input.request.op,nativeExecution:true};});
  }finally{clearInterval(interval);}
 }
 if(phase===2){
  if(!input.engine_result)throw Error('Native result is missing in PostgreSQL');
  const kind=input.request.op==='communications'?'communication':input.request.op==='network'?'network':input.request.op==='digital'?'digital':'circuit';
  const analysis=await insideLaboratory('http://fastapi:8000/signals/analyze',{kind,request:input.request,result:input.engine_result});
  await laboratoryControl(job.id,'analysis',{analysis});
  return {service:analysis.engine,verification:analysis.verification,summary:analysis.summary,audit:analysis.audit??null,nativeResultReplaced:false};
 }
 throw Error('Unknown laboratory phase');
}
async function stockControl(id,action,extra={}){
 const r=await workerFetch(base+'/api/workshop/internal',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body:JSON.stringify({id,worker,action,...extra}),signal:AbortSignal.timeout(12000)},'Workshop task');
 if(!r.ok)throw serviceError(r.status,'','Workshop task');return r.json();
}
async function readPrivate(response,label){
 if(!response.ok)throw serviceError(response.status,'',label);let bytes=0,text='';const decoder=new TextDecoder();for await(const chunk of response.body){bytes+=chunk.length;if(bytes>8388608)throw Error(label+' response exceeds 8 MiB');text+=decoder.decode(chunk,{stream:true})}text+=decoder.decode();let parsed;try{parsed=JSON.parse(text)}catch{throw Error(label+' returned invalid JSON')}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error(label+' returned no JSON object');return parsed;
}
async function sharedControl(id,action,extra={}){
 const body=JSON.stringify({id,worker,action,...extra});if(Buffer.byteLength(body)>8388608)throw Error('Shared private input exceeds 8 MiB');
 const response=await workerFetch(base+'/api/shared/internal',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body,signal:AbortSignal.timeout(30000)},'Shared task');return readPrivate(response,'Shared task');
}
async function taskSlip(job,action,extra={}){return gate('spring',()=>insideLaboratory('http://spring:8081/shared/invoice.php',{job:job.id,worker,action,...extra}))}
function planFor(family){
 if(family.id==='shared')return [{key:'s0',phase:0,depends:[]},{key:'s1',phase:1,depends:['s0']}];
 if(sharedFamilies.has(family.id))return [[],['s0'],['s1'],['s0'],['s2'],['s2','s3','s4'],['s5'],['s6']].map((depends,phase)=>({key:'s'+phase,phase,depends}));
 return family.steps.map((_,phase)=>({key:'s'+phase,phase,depends:phase?['s'+(phase-1)]:[]}));
}
const shaText=value=>createHash('sha256').update(value).digest('hex');
function checkSharedReply(value,contract){if(value?.ok!==true||(contract&&value.contract!==contract&&value.schema!==contract))throw Error('Shared service rejected its versioned contract');return value}
function smallStep(value){
 const text=JSON.stringify(value);if(Buffer.byteLength(text)<=640)return value;
 const keys=['service','engine','version','operation','storage','verification','nativeExecution','nativeResultReplaced','frames','rows','scanCases','validated','sourceDigest','requestChecksum','snapshot','archiveSha','bytes','files','kind','notesDigest','events'];
 const result={};for(const key2 of keys){const item=value?.[key2];if(item!==undefined&&(typeof item==='string'&&item.length<=128||typeof item==='number'&&Number.isFinite(item)||typeof item==='boolean'||item===null))result[key2]=item;}
 result.detailsRetained=true;result.summaryClipped=true;while(Buffer.byteLength(JSON.stringify(result))>640){const removable=Object.keys(result).findLast(name=>!['service','engine','storage','detailsRetained','summaryClipped'].includes(name));if(!removable)break;delete result[removable]}return result;
}
function musicNotes(input){
 if(input.dataset?.kind!=='music'||input.dataset.submitted!==true||!Array.isArray(input.dataset.notes)||input.dataset.notes.length<1||input.dataset.notes.length>256)throw Error('The frozen submitted music dataset is unavailable');
 const notes=input.dataset.notes.map(note=>{if(!note||typeof note!=='object'||Array.isArray(note)||Object.keys(note).sort().join(',')!=='d,n,t,v'||!Number.isInteger(note.n)||note.n<48||note.n>96||!Number.isInteger(note.t)||note.t<0||note.t>600000||!Number.isInteger(note.d)||note.d<40||note.d>4000||!Number.isFinite(note.v)||note.v<.05||note.v>1)throw Error('A frozen note exceeds the original score contract');return {n:note.n,t:note.t,d:note.d,v:note.v}});
 const digest=shaText(JSON.stringify(notes));if(input.source?.digest!==digest){const error=Error('The frozen submitted note bytes disagree with their original score digest');error.code='checksum_mismatch';throw error}return {notes,digest};
}
async function musicStage(job,phase){
 const input=await sharedControl(job.id,'input',{view:'dataset'}),{notes,digest}=musicNotes(input),state=context.getStore();
 const previous=state.sharedResults.get(0);if(previous&&previous.notesDigest!==digest){const error=Error('The frozen music input changed between steps');error.code='checksum_mismatch';throw error}
 if(phase===0)return {service:'PostgreSQL frozen score',storage:'PostgreSQL',sourceDigest:input.source.digest,notesDigest:digest,events:notes.length,explicitSubmission:true};
 if(phase===1){let duration=0,weighted=0,velocity=0;const classes=Array(12).fill(0);for(const note of notes){duration+=note.d;weighted+=note.n*note.d;velocity+=note.v*note.v;classes[note.n%12]+=note.d}return {engine:'SH1/note-structure',notesDigest:digest,events:notes.length,weightedPitch:weighted/duration,velocityRms:Math.sqrt(velocity/notes.length),pitchClassDurationMs:classes,scope:'finite MIDI-note parameters; no audio synthesis or DSP'}}
 if(phase===2){const changes=notes.flatMap(note=>[{t:note.t,delta:1},{t:note.t+note.d,delta:-1}]).sort((a,b)=>a.t-b.t||a.delta-b.delta);let voices=0,maximum=0;for(const change of changes){voices+=change.delta;maximum=Math.max(maximum,voices)}return {engine:'SH1/note-timeline',notesDigest:digest,events:notes.length,maxPolyphony:maximum,durationMs:Math.max(...notes.map(note=>note.t+note.d)),timelineBounded:true,scope:'submitted event timing only'}}
 throw Error('Unknown frozen music stage');
}
async function sharedExchange(job,phase){
 if(phase===0){const input=await sharedControl(job.id,'input',{view:'operation'});if(!input.operation||input.operation.contract!=='ocv.sh2/1')throw Error('The frozen project exchange operation is unavailable');return {service:'SH1/project-operation',storage:'PostgreSQL',operation:input.operation.action,frozen:true}}
 if(phase===1)return gate('fiber',async()=>{const input=await sharedControl(job.id,'input',{view:'operation'});if(!input.result){const reply=checkSharedReply(await insideLaboratory('http://fiber:8002/stock/receipt.asmx',input.operation),'ocv.sh2/1');await sharedControl(job.id,'operation',{result:reply.result})}return {service:'SH2/Go Fiber',storage:'PostgreSQL',operation:input.operation.action,acknowledged:true,detailsRetained:true}});
 throw Error('Unknown project exchange stage');
}
async function sharedStage(job,phase){
 if(phase===3)return gate('fiber',async()=>{const input=await sharedControl(job.id,'input',{view:'dataset'});let version=input.version;if(!version){const reply=checkSharedReply(await insideLaboratory('http://fiber:8002/stock/receipt.asmx',{contract:'ocv.sh2/1',action:'job-manifest',job:job.id,worker}),'ocv.sh2/1');version=reply.result;if(!version||typeof version!=='object')throw Error('Go did not return a verified job manifest');await sharedControl(job.id,'version',{version})}return {service:'SH2/Go Fiber',storage:'PostgreSQL',sourceDigest:version.digest??version.sourceDigest,snapshot:version.snapshot??null,revision:version.revision??null,frozen:true}});
 if(phase===4)return gate('fastapi',()=>gate('engineering-data',async()=>{const retained=await sharedControl(job.id,'input',{view:'analysis'});let analysis=retained.analysis;if(!analysis){const input=await sharedControl(job.id,'input',{view:'dataset'});if(!input.dataset?.kind||!input.source?.digest)throw Error('The frozen dataset is missing');const options={chartKind:input.dataset.kind==='music'?'histogram':input.dataset.kind==='communication'?'scatter':input.dataset.kind==='network'?'heatmap':'line'};analysis=checkSharedReply(await insideLaboratory('http://fastapi:8000/shared/analysis.aspx',{schema:'ocv.shared-analysis/1',source:input.source,dataset:input.dataset,options}),'ocv.shared-analysis-result/1');await sharedControl(job.id,'analysis',{analysis})}checkSharedReply(analysis,'ocv.shared-analysis-result/1');return {service:'SH3/Python DuckDB',engine:analysis.engine,kind:analysis.dataset?.kind,sourceDigest:analysis.sourceDigest,rows:analysis.dataset?.normalizedRows??0,statistics:analysis.statistics?.length??0,artifacts:analysis.artifacts?.length??0,cacheHit:analysis.cacheHit===true,nativeResultReplaced:false}}));
 if(phase===5)return gate('dotnet',()=>gate('engineering-data',async()=>{const retained=await sharedControl(job.id,'input',{view:'publication'});let artifact=retained.artifact;if(!artifact){const input=await sharedControl(job.id,'input',{view:'bundle'});if(!input.analysis?.ok||!input.version)throw Error('The actual analysis or version manifest is missing');const compatibility=checkSharedReply(await gate('sinatra',()=>insideLaboratory('http://sinatra:8004/shared/template.cgi',{contract:'ocv.shared-artifact/1',job:job.id,sourceDigest:input.source.digest,kind:input.dataset.kind,statistics:input.analysis.statistics??[]})),'ocv.shared-artifact/1');artifact=checkSharedReply(await insideLaboratory('http://dotnet:8003/shared/bundle.asmx',{contract:'ocv.shared-artifact/1',job:job.id,source:input.source,dataset:input.dataset,analysis:input.analysis,version:input.version,compatibility}),'ocv.shared-artifact/1');artifact={...artifact,compatibility};if(!artifact.archive?.base64||!artifact.archive.sha256||artifact.statistics?.readbackVerified!==true)throw Error('The generated archive was not verified');await sharedControl(job.id,'artifact',{artifact})}if(!artifact.archive?.sha256||artifact.statistics?.readbackVerified!==true)throw Error('The retained verified archive is incomplete');return {service:'SH4/C# + Ruby',archiveSha:artifact.archive.sha256,bytes:artifact.archive.bytes,files:artifact.manifest?.files?.length??0,verified:true,template:artifact.compatibility?.template,compatibilitySha:artifact.compatibility?.sha256}}));
 if(phase===6)return gate('minio',async()=>{const retained=await sharedControl(job.id,'input',{view:'publication'});const object=retained.object??(await sharedControl(job.id,'object')).object;if(!object?.key||!object.sha256||object.verified!==true||object.readback!==true||object.sha256!==retained.artifact?.archive?.sha256)throw Error('Object storage did not verify the original archive bytes');return {service:'SH4/MinIO',archiveSha:object.sha256,bytes:object.bytes,objectKey:object.key,readbackVerified:true,storage:'MinIO + PostgreSQL'}});
 if(phase===7)return gate('laravel',async()=>{
  const input=await sharedControl(job.id,'input',{view:'publication'});if(!input.artifact?.manifest||!input.object?.key)throw Error('The verified archive publication inputs are missing');let publication=input.publication;
  if(!publication){
   let compatibility=input.artifact.compatibility;
   if(compatibility?.manifestAttestation?.ok!==true){compatibility=checkSharedReply(await gate('sinatra',()=>insideLaboratory('http://sinatra:8004/shared/template.cgi',{contract:'ocv.shared-artifact/1',job:job.id,sourceDigest:input.source.digest,kind:input.dataset?.kind??input.artifact.manifest.kind,statistics:input.analysis?.statistics??[],manifest:input.artifact.manifest})),'ocv.shared-artifact/1');if(compatibility.manifestAttestation?.ok!==true||compatibility.manifestAttestation.files!==input.artifact.manifest.files.length)throw Error('Ruby did not attest the actual archive manifest');await sharedControl(job.id,'attestation',{attestation:compatibility})}
   const published=checkSharedReply(await insideLaboratory('http://laravel:8001/api/shared/publish.php',{contract:'ocv.shared-artifact/1',job:job.id,sourceDigest:input.source.digest,archiveSha:input.artifact.archive.sha256,bytes:input.artifact.archive.bytes,objectKey:input.object.key,manifest:input.artifact.manifest,compatibility}),'ocv.shared-artifact/1');
   publication=checkSharedReply(await insideLaboratory('http://laravel:8001/api/shared/read.cgi',{contract:'ocv.shared-artifact/1',job:job.id}),'ocv.shared-artifact/1');
   if(publication.storage!=='mysql'||publication.readbackVerified!==true||!Number.isInteger(publication.publication?.id)||publication.publication.id!==published.publication?.id||publication.publication.sha256!==input.artifact.archive.sha256||publication.publication.objectKey!==input.object.key)throw Error('MySQL publication readback did not match the verified archive');
   await sharedControl(job.id,'publication',{publication});
  }
  checkSharedReply(publication,'ocv.shared-artifact/1');return {service:'SH4/Laravel Eloquent',storage:'MySQL + PostgreSQL',archiveSha:input.artifact.archive.sha256,publicationId:publication.publication?.id??null,published:true,readbackVerified:publication.readbackVerified===true};
 });
 throw Error('Unknown shared engineering stage');
}
async function relayShared(job){
 if(sharedAmqp)await warm(['rabbitmq']);let total=0,duplicates=0,pending=0,confirmed=false;
 for(let count=0;count<8;count++){if(stopping||context.getStore()?.aborted)throw Error('Worker stopping before notification handoff');if(await cancellationState(job))throw Error('Worker task cancelled before notification handoff');const result=checkSharedReply(await gate('spring',()=>insideLaboratory('http://spring:8081/shared/outbox.asm',{job:job.id,worker,action:'relay',transport:sharedAmqp?'rabbitmq':'database-outbox',limit:8})),'ocv.task-outbox/1');total+=result.delivered?.length??0;duplicates+=result.duplicates??0;pending=result.pending??0;confirmed ||= result.brokerConfirmed===true;if(!pending)return {transport:sharedAmqp?'rabbitmq-confirmed':'database-outbox',delivered:total,duplicates,pending,brokerConfirmed:confirmed};await sleep(250)}
 const error=Error('The bounded task outbox still has undelivered receipts');error.code='service_unavailable';throw error;
}
async function misplacedStock(job,phase){
 // Every batch reads the authoritative request/results again; no second task queue or version store.
 const input=await stockControl(job.id,'input');
 const envelope={request:input.request,digest:input.request_digest,snapshot:input.snapshot_id,revision:input.revision};
 if(phase===0){
  const manifest=await insideLaboratory('http://dotnet:8003/workshop/prepare.php',{...envelope,project:input.invoice_text?JSON.parse(input.invoice_text):null});
  await stockControl(job.id,'manifest',{manifest});
  if(manifest.ok!==true)throw Error(manifest.diagnostics?.map(x=>x.code+': '+x.message).join('; ').slice(0,300)||'C# domain validation rejected the assembly');
  return {service:manifest.engine||'C# mechanical domain',validated:true,requestChecksum:input.request_digest,snapshot:input.snapshot_id,source:'PostgreSQL',parts:input.request.world.bodies.length};
 }
 if(phase===1){
  let checkBusy=false,cancelled=false;
  const interval=setInterval(async()=>{if(checkBusy)return;checkBusy=true;try{if(await cancellationState(job)){cancelled=true;stopChildren(context.getStore())}}finally{checkBusy=false;}},1000);
  try{
   const timeout=Math.min(180000,Math.max(1000,Number(process.env.OCV_MECHANICS_TIMEOUT_MS||30000)));
   const raw=await nativeRun(job,'mechanics-native','/opt/ocv/ocv-mechanics',input.request,timeout);
   if(cancelled)throw Error('Workshop task cancelled');if(Buffer.byteLength(raw)>4194304)throw Error('Mechanical native result exceeds 4 MiB');
   return await gate('engineering-data',async()=>{const engine=JSON.parse(raw);await stockControl(job.id,'engine',{engine});
    const partial=input.request.op==='scan'&&engine.ok===false&&Array.isArray(engine.scan?.runs)&&engine.scan.runs.length===input.request.scan.values.length*input.request.scan.trials;
    if(!engine.ok&&!partial)throw Error(engine.diagnostics?.map(x=>x.code+': '+x.message).join('; ').slice(0,300)||'Native mechanical kernel rejected the assembly');
    return {engine:engine.engine,version:engine.version,operation:input.request.op,nativeExecution:true,partial,nativeSucceeded:engine.ok===true,frames:engine.frames?.length??0,scanCases:engine.scan?.runs?.length??0};});
  }finally{clearInterval(interval);}
 }
 if(phase===2){
  if(!input.engine_result)throw Error('Mechanical native result is missing in PostgreSQL');
  const analysis=await insideLaboratory('http://dotnet:8003/workshop/review.php',{...envelope,result:input.engine_result});
  await stockControl(job.id,'analysis',{analysis});
  if(analysis.ok!==true)throw Error(analysis.diagnostics?.map(x=>x.code+': '+x.message).join('; ').slice(0,300)||'C# mechanical domain review rejected the native result');
  return {service:analysis.engine||'C# mechanical domain',verification:analysis.verification||'domain-reviewed',nativeResultReplaced:false,resultReadFrom:'PostgreSQL',summary:analysis.summary??null};
 }
 throw Error('Unknown mechanical batch');
}
async function siteControl(job,action,result){
 const reply=await workerFetch(base+'/api/site/internal/stock.cgi',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body:JSON.stringify({job:job.id,action,...(result===undefined?{}:{result})}),signal:AbortSignal.timeout(12000)},'Site receipt');
 if(!reply.ok)throw serviceError(reply.status,reply.status===503?'service_unavailable':'site_request_failed','Site receipt');return reply.json();
}
async function siteStage(job){
 const service={'site-music':'site-audio','site-projection':'site-projection','site-certificate':'site-certificate','site-index':'site-index'}[job.family];if(!service)throw Error('Unknown site family');
 return gate(service,async()=>{
  const sheet=await siteControl(job,'input');let result;
  if(job.family==='site-music'){
   result=JSON.parse(await nativeRun(job,service,'/opt/site/audio',sheet.input,30000));if(result.ok!==true)throw Error('Audio rendering rejected');
   result.verification=JSON.parse(await nativeRun(job,service,'/opt/site/receipt',{audio:result.audio,midi:result.midi},10000));if(result.verification.ok!==true)throw Error('Independent audio format verification failed');
  }else{
   const url={'site-projection':'http://site-projection:4013/stock.php','site-certificate':'http://site-certificate:7083/ReturnOrder.asmx','site-index':'http://site-index:8093/api/foo.aspx'}[job.family];
   result=await inside(url,sheet.input,10000);
  }
  return siteControl(job,'save',result);
 });
}
async function work(job,phase){
 if(job.family.startsWith('site-'))return siteStage(job);
 if(job.family==='shared')return sharedExchange(job,phase);
 if(sharedFamilies.has(job.family)&&phase>=3)return sharedStage(job,phase);
 if(job.family==='music-report')return musicStage(job,phase);
 if(job.family==='circuits'){const service=phase===0?'spring':phase===1?'signals-native':'fastapi';return gate(service,()=>phase===2?gate('engineering-data',()=>laboratory(job,phase)):laboratory(job,phase))}
 if(job.family==='mechanical'){const service=phase===1?'mechanics-native':'dotnet';return gate(service,()=>phase===2?gate('engineering-data',()=>misplacedStock(job,phase)):misplacedStock(job,phase))}
 const label=`${job.feature}:${job.digest.slice(0,16)}`,dto={label,rootTraceId:job.run_id,isoTime:'2026-10-01T19:14:00.000Z',ornament:{digest:job.digest}};
 if(job.family==='signal'){
  const sent=await inside('http://spring:8081/api/approved.php',dto);
  if(!sent.hop?.jpaRow)throw Error('Signal JPA stamp missing');
  for(let i=0;i<20;i++){
   const reply=await inside('http://message-consumer:3100/api/replica/'+job.run_id);
   if(reply.logs?.some(entry=>entry.data?.label===label&&entry.data?.service==='Spring'))return {published:true,redisPubSub:true,mongoLog:true,root:job.run_id,jpaRow:sent.hop.jpaRow};
   await sleep(400);
  }
  throw Error('Redis publication was not stored by the real subscriber');
 }
 if(job.family==='relay'){
  const urls=['http://spring:8081/api/approved.php','http://fastapi:8000/api/rubber.cgi','http://laravel:8001/api/nodeService'];
  const r=await inside(urls[phase],dto);if(!r.hop||r.hop.rootTraceId!==job.run_id)throw Error('Relay stamp missing');
  if(phase===0&&!r.hop.jpaRow)throw Error('JPA row not stored');if(phase===2&&!r.canContinue)throw Error('Eloquent terminal stamp failed');
  return {service:r.hop.service,stamp:r.hop,nextAvailable:r.canContinue===true,continuedInNextBatch:phase<2};
 }
 if(job.family==='grpc'){const r=await inside('http://spring:8081/api/grpc.do',dto);if(!r.canContinue||r.protocol!=='gRPC')throw Error('gRPC stamp failed');return r;}
 if(job.family==='analysis'){
  if(job.feature==='music-studio'){
   const code="const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:1500,statement_timeout:2000});p.query('SELECT events FROM ocv_q8.scores WHERE id=$1',[process.argv[1]]).then(r=>{if(!r.rows.length)throw Error('Score expired');console.log(JSON.stringify(r.rows[0].events))}).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.end());";
   const notes=JSON.parse(await cc(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',code,job.run_id]));
   const r=await inside('http://fastapi:8000/api/music.php',{root:job.run_id,notes});if(!r.canContinue||r.notes!==notes.length||!r.sources?.includes('DuckDB'))throw Error('Music analysis failed');return r;
  }
  const r=await inside('http://fastapi:8000/api/analysis.php');if(!r.canContinue||!r.sources?.includes('DuckDB'))throw Error('Analysis failed');return r;
 }
 if(job.family==='go'){const r=await inside('http://fiber:8002/api/button.cgi');if(!r.canContinue||r.service!=='Go Fiber')throw Error('Fiber failed');return r;}
 if(job.family==='soap'){const xml=await inside('http://dotnet:8003/api/AirTaxService.asmx');if(typeof xml!=='string'||!xml.includes('GetPotatoTaxResponse'))throw Error('SOAP envelope missing');return {protocol:'SOAP',tax:Number(xml.match(/<tax>(\d+)<\/tax>/)?.[1]),bytes:Buffer.byteLength(xml)};}
 if(job.family==='ruby'){const r=await inside('http://sinatra:8004/api/old.cgi');const nested=JSON.parse(r.jsonInsideJson);if(nested.service!=='Ruby Sinatra')throw Error('Nested Ruby JSON missing');return {outer:r.ok,inner:nested};}
 if(job.family==='object'){const graph=await inside('http://hono:3100/graphql',{query:'{ pebble { department weight } }'}),object=await inside('http://hono:3100/api/file.asmx');if(!graph.canContinue||!object.canContinue)throw Error('GraphQL/S3 roundtrip failed');return {graph,object};}
 if(job.family==='mongo'){
  const p={id:job.id,feature:job.feature,digest:job.digest,created:Date.now()};
  const script=`const p=${JSON.stringify(p)};db.a1_receipts.updateOne({id:p.id},{$set:p},{upsert:true});const stale=db.a1_receipts.find().sort({created:-1,_id:-1}).skip(64).toArray().map(x=>x._id);if(stale.length)db.a1_receipts.deleteMany({_id:{$in:stale}});print(JSON.stringify({stored:db.a1_receipts.findOne({id:p.id}).digest,count:db.a1_receipts.countDocuments()}));`;
  const r=JSON.parse((await cc(['exec','-T','mongo','mongosh','civilization','--quiet','--eval',script])).trim());if(r.stored!==job.digest||r.count>64)throw Error('Mongo roundtrip failed');return r;
 }
 if(job.family==='search'){
  const script=`const p=JSON.parse(process.argv[1]);const base='http://elasticsearch:9200/a1-receipts';async function j(u,o){const r=await fetch(u,o);if(!r.ok)throw Error('ES HTTP '+r.status);return r.json();}async function main(){await j(base+'/_doc/'+p.id+'?refresh=true',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});const r=await j(base+'/_search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({size:128,sort:[{created:'desc'}],query:{match_all:{}}})});for(const h of r.hits.hits.slice(64))await j(base+'/_doc/'+h._id,{method:'DELETE'});const one=await j(base+'/_doc/'+p.id);console.log(JSON.stringify({digest:one._source.digest,found:r.hits.hits.some(h=>h._id===p.id)}));}main().catch(e=>{console.error(e.message);process.exitCode=1;});`;
  const r=JSON.parse(await cc(['exec','-T','gateway','node','-e',script,JSON.stringify({id:job.id,feature:job.feature,digest:job.digest,created:Date.now()})]));if(r.digest!==job.digest||!r.found)throw Error('Elasticsearch roundtrip failed');return r;
 }
 if(job.family==='messages'){
  const r=await inside('http://gateway:3000/api/civilization-enterprise.do',{label,ornament:{digest:job.digest}});if(!r.rabbitQueued)throw Error('AMQP confirm failed');
  for(let i=0;i<15;i++){const m=await inside('http://message-consumer:3100/api/replica/'+r.rootTraceId);if(m.record?.source==='Kafka payload'){if(m.record.extra?.ornament?.digest!==job.digest)throw Error('Kafka payload mismatch');return {root:r.rootTraceId,source:m.record.source,mongoose:true,redis:!!m.redis};}await sleep(500);}
  throw Error('Kafka/Mongoose handoff timed out');
 }
 if(job.family==='monitor'){
  const trace=await inside('http://gateway:3000/api/stamp-everywhere.php',{label},20000);
  let metric;for(let i=0;i<20;i++){metric=await inside('http://prometheus:9090/api/v1/query?query=ocv_unnecessary_steps_total',null,20000);if(Number(metric.data?.result?.[0]?.value?.[1])>=14)break;await sleep(1000);}
  const board=await inside('http://grafana:3000/api/dashboards/uid/ocv-cold-rice',null,20000);
  await sleep(1800);const logs=await cc(['logs','--tail','500','otel']);if(!logs.includes(trace.otelTraceId)||board.dashboard?.panels?.length!==48||!metric.data?.result?.length||Number(metric.data.result[0].value[1])<14)throw Error('Monitoring evidence incomplete');
  return {traceExport:true,traceId:trace.otelTraceId,metric:metric.data.result[0].value,panels:board.dashboard.panels.length};
 }
 if(job.family==='next'){const r=await inside('http://next:3200/next-api/receipt',{label,ornament:{digest:job.digest}});if(!r.nextApiRoute||!r.postgres||!r.ids?.autoInteger)throw Error('Next/Prisma/TypeORM handoff failed');return {nextApiRoute:true,prismaRow:r.ids.autoInteger,root:r.rootTraceId};}
 throw Error('Unknown worker family');
}
async function perform(job,state){
 return context.run(state,async()=>{const family=catalog.families.find(f=>f.id===job.family),results=[],shared=sharedFamilies.has(job.family);let recovered=false;
 try{
  if(!family)throw Error('Unknown worker family');
  if(shared){state.pinned.add('spring');await warm(['spring']);await taskSlip(job,'prepare',{steps:planFor(family)});const slip=checkSharedReply(await taskSlip(job,'recover'),'ocv.shared-task/1');recovered=slip.recovered===true;for(const completed of slip.completed||[]){if(!Number.isInteger(completed.phase)||completed.phase<0||completed.phase>=family.steps.length||completed.key!=='s'+completed.phase||!completed.result||typeof completed.result!=='object')throw Error('The resumed task checkpoint has an invalid phase identity');results[completed.phase]=completed.result;state.sharedResults.set(completed.phase,completed.result);event('checkpoint-resumed',job,completed.phase)}state.prepared=true;}
  for(let phase=0;phase<family.steps.length;phase++){
   state.phase=phase;try{await access(stopFile);stopping=true}catch{}
   if(stopping||state.aborted)throw Error('Worker stopping');if(await cancellationState(job))throw Error('Worker task cancelled');
   if(shared&&state.sharedResults.has(phase))continue;
   await control('progress',{job:job.id,state:'starting',phase,result:{steps:results.filter(Boolean)}});
   await log(`Starting ${job.family} ${job.id} batch ${phase+1}/${family.steps.length}`);
   try{
    if(shared){const start=checkSharedReply(await taskSlip(job,'stepbegin',{step:'s'+phase}),'ocv.shared-task/1');if(start.alreadyCompleted){results[phase]=start.result;state.sharedResults.set(phase,start.result);continue}state.stepRunning=true;}
    await warm(family.steps[phase]);await control('progress',{job:job.id,state:'running',phase,result:{steps:results.filter(Boolean)}});
    const computed=await work(job,phase),result=shared?{phase,...smallStep(computed)}:computed;
    if(await cancellationState(job))throw Error('Worker task cancelled after computation');
    if(shared){await taskSlip(job,'checkpoint',{step:'s'+phase,result});state.stepRunning=false;state.sharedResults.set(phase,result);}
    results[phase]=result;
   }finally{await releasePhase()}
  }
  const outbox=shared?await relayShared(job):undefined,output={steps:results,...(shared?{shared:{checkpointed:true,recovered,outbox}}:{})};
  if(Buffer.byteLength(JSON.stringify(output))>6000)throw Error('Bounded worker result summary exceeds its canonical job limit');
  state.finalOutput=output;await control('complete',{job:job.id,state:'done',phase:family.steps.length,result:output});
  report.completed.push({family:job.family,id:job.id,feature:job.feature,runId:job.run_id,...output});report.completed=report.completed.slice(-64);await log(`Completed ${job.family} ${job.id}`);
 }catch(error){
  let durableDone=false;if(shared&&state.finalOutput){try{durableDone=(await sharedControl(job.id,'status')).state==='done'}catch{}}
  const cancelled=await cancellationState(job);
  if(durableDone){report.completed.push({family:job.family,id:job.id,feature:job.feature,runId:job.run_id,...state.finalOutput,completionReadback:true});report.completed=report.completed.slice(-64);await log(`Completed ${job.family} ${job.id}; canonical completion read back after transport interruption`)}
  else if(cancelled){report.cancelled.push({family:job.family,id:job.id,phase:state.phase});report.cancelled=report.cancelled.slice(-64);await log(`Cancelled ${job.family} ${job.id}`)}
  else if(shared&&(stopping||state.aborted||!leaseHealthy)){report.interrupted??=[];report.interrupted.push({family:job.family,id:job.id,phase:state.phase,checkpointPreserved:true});report.interrupted=report.interrupted.slice(-64);await log(`Interrupted ${job.family} ${job.id}; canonical lease recovery retains its checkpoints`)}
  else{
   const code=failureCode(error);let advice;
   if(shared&&state.prepared&&state.stepRunning){try{advice=(await taskSlip(job,'failure',{step:'s'+state.phase,code})).retry}catch(failure){await log('Shared failure checkpoint deferred: '+failure.message.slice(0,120))}}
   let retried=false;
   if(shared&&['service_unavailable','transport_timeout','transient_storage','resource_wait'].includes(code)){
    const delaySeconds=Math.min(30,Math.max(1,advice?.delaySeconds||2));
    try{const retry=await control('retry',{job:job.id,phase:state.phase,result:{reason:error.message.slice(0,240),code,steps:results.filter(Boolean)},code,delaySeconds});retried=retry.retried===true;if(retried){report.retried??=[];report.retried.push({family:job.family,id:job.id,phase:state.phase,code,attempt:retry.attempts,delaySeconds});report.retried=report.retried.slice(-64);event('retry-queued',job,state.phase);await log(`Retry queued for ${job.family} ${job.id}; ${code}`)}}catch(retryFailure){await log('Canonical retry unavailable: '+retryFailure.message.slice(0,120))}
   }
   if(!retried){report.failed.push({family:job.family,id:job.id,phase:state.phase,code,error:error.message});report.failed=report.failed.slice(-64);await control('complete',{job:job.id,state:'failed',phase:state.phase,result:{reason:error.message.slice(0,300),code,...(error.upstreamCode?{upstreamCode:error.upstreamCode}:{}),steps:results.filter(Boolean)}}).catch(()=>{});await log(`Failed ${job.family} ${job.id}: ${error.message.slice(0,240)}`)}
  }
 }finally{await releasePhase(true).catch(error=>log('Cleanup delayed: '+error.message.slice(0,200)));event('job-end',job,state.phase);await writeReport()}});
}
function launch(job){const state={job,phase:0,children:new Set(),services:new Set(),pinned:new Set(),sharedResults:new Map(),held:new Set(),prepared:false,stepRunning:false,aborted:false};const entry={context:state,promise:null};active.set(job.id,entry);report.maximumConcurrentJobs=Math.max(report.maximumConcurrentJobs,active.size);event('job-start',job,0);entry.promise=perform(job,state).catch(error=>log('Task cleanup error: '+error.message.slice(0,200))).finally(()=>active.delete(job.id));return entry.promise}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,requestStop);
let timer,heartbeatTask=Promise.resolve(),heartbeatFailures=0,claimFailures=0,drainIdleSince=0;
try{
 await storageGuard();config=JSON.parse(await cc(['config','--format','json'],{quiet:true}));syncCapacity();
 const running=await snapshot();if([...core].some(n=>!running.some(c=>c.Config.Labels['com.docker.compose.service']===n&&c.State.Running)))throw Error('Start the six core services before the host dispatcher');
 await cc(['up','-d','--no-build','--wait','--wait-timeout','180','gateway']);
 for(let attempt=0;!leased;attempt++){try{await control('heartbeat');leased=true;leaseHealthy=true}catch(error){if(attempt>=20||error.message.includes('409'))throw error;await sleep(500)}}
 try{const previous=JSON.parse(await readFile(path.join(stateRoot,'owned.json'),'utf8'));for(const id of previous.containers||[])if(/^[a-f0-9]{64}$/.test(id))owned.add(id)}catch{}await cleanup();
 timer=setInterval(()=>{if(heartbeatBusy)return;heartbeatBusy=true;heartbeatTask=(async()=>{try{await control('heartbeat',{jobs:[...active.keys()]});syncCapacity();heartbeatFailures=0;leaseHealthy=true}catch(error){heartbeatFailures++;if(heartbeatFailures>=3||error.message.includes('409')){leaseHealthy=false;requestStop()}}finally{heartbeatBusy=false}})()},15000);
 const selection=process.argv.find(x=>x.startsWith('--tour=')),tour=selection?selection.slice(7).split(','):process.argv.includes('--tour')?catalog.families.filter(f=>!sharedFamilies.has(f.id)&&!f.id.startsWith('site-')).map(f=>f.id):null;if(tour?.some(id=>!catalog.families.some(f=>f.id===id)||sharedFamilies.has(id)||id.startsWith('site-')))throw Error('Unknown or explicit-submission-only demonstration family');
 await log('Host dispatcher ready; configured '+report.configuredConcurrency+', effective '+concurrency+' active contexts.');await writeReport();
 while(!stopping){try{await access(stopFile);stopping=true}catch{}if(stopping)break;syncCapacity();if(tour?.length&&active.size===0)await control('seed',{family:tour[0]});const target=tour?1:concurrency;if(active.size>=target){await Promise.race([...active.values()].map(entry=>entry.promise).concat(sleep(500)));continue}let job,queuedPending=0,nextAvailableAt=null;
  try{({job,queuedPending=0,nextAvailableAt=null}=await control('claim'));claimFailures=0}catch(error){if(error.message.includes('409')){leaseHealthy=false;requestStop();throw error}if(tour||++claimFailures>=5)throw error;await log('Loopback temporarily unavailable; bounded retry '+claimFailures);await sleep(4000);continue}
  if(job){drainIdleSince=0;const task=launch(job);if(tour){await task;if(tour[0]===job.family)tour.shift();if(!tour.length)break}continue}
  if((tour||process.argv.includes('--drain'))&&active.size===0){if(!tour&&queuedPending>0){drainIdleSince ||= Date.now();if(Date.now()-drainIdleSince<30000){const available=Date.parse(nextAvailableAt||'');await sleep(Number.isFinite(available)?Math.max(100,Math.min(1200,available-Date.now())):1200);continue}report.drainDeferred={queuedPending,nextAvailableAt,idleWaitMs:Date.now()-drainIdleSince};await log('Bounded drain stopped with delayed queued work retained')}break}
  await Promise.race([...active.values()].map(entry=>entry.promise).concat(sleep(active.size?500:1200)));
 }
}finally{stopping=true;await Promise.allSettled([...active.values()].map(entry=>entry.promise));clearInterval(timer);await heartbeatTask;if(leased){try{await control('heartbeat');leaseHealthy=true}catch{leaseHealthy=false}await cleanup();if(leaseHealthy)await control('release').catch(()=>{});await writeReport()}}
if(report.failed.length)process.exitCode=1;
