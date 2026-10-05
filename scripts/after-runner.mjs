import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access,unlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {docker} from './docker-child.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const catalog=JSON.parse(await readFile('services/gateway/src/a1/catalog.json','utf8'));
const local=process.platform==='win32'&&process.env.OCV_LOCAL_STORAGE_GUARD==='1';
const stateRoot=path.join(process.env.OCV_DEPS_ROOT||path.join(os.homedir(),'.local/state/omnicivitas'),'runtime/after-runner');
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
const files=['-f','compose.yaml'];try{await access('vps/compose.vps.yaml');files.push('-f','vps/compose.vps.yaml');}catch{}
const compose=['compose','-p',project,...files,'--profile','*'];
let config,stopping=false,current=null,children=new Set(),owned=new Set(),heartbeatBusy=false,leased=false;
const report={startedAt:new Date().toISOString(),worker,completed:[],failed:[],maximumCapsMiB:0,defaultCoreOnly:true};
const logFile=path.join(stateRoot,'worker.log');
async function log(message){
 let previous='';try{previous=await readFile(logFile,'utf8');}catch{}
 const bytes=Buffer.from(previous+new Date().toISOString()+' '+message+'\n');
 await writeFile(logFile,bytes.subarray(Math.max(0,bytes.length-1048576)),{mode:0o600});
 if(process.argv.some(x=>x==='--tour'||x.startsWith('--tour=')))console.log(message);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(file,args,{timeout=1200000,quiet=false}={}){
 const overrides=file===docker&&local?{USERPROFILE:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop'),APPDATA:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(process.env.OCV_DEPS_ROOT,'docker-desktop/appdata/Local')}:{};
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:root,env:{...process.env,...overrides,COMPOSE_PARALLEL_LIMIT:'1',COMPOSE_PROFILES:''},windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(child);
  let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),timeout);
  child.stdout.on('data',b=>{stdout=(stdout+b).slice(-2097152);});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2097152);});
  child.on('error',error=>{clearTimeout(timer);children.delete(child);reject(error);});
  child.on('close',code=>{clearTimeout(timer);children.delete(child);if(code===0)resolve(stdout);else reject(Error(`${path.basename(file)} failed (${code}); ${quiet?'inspect its bounded runtime log':stderr.slice(-1200)}`));});
 });
}
const dc=(args,options)=>run(docker,args,options);
const cc=(args,options)=>dc([...compose,...args],options);
async function control(action,extra={}){
 const r=await fetch(base+'/api/a2/worker.cgi',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body:JSON.stringify({worker,action,...extra}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error(`Worker control HTTP ${r.status}`);return r.json();
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
 if(!Number.isFinite(ceiling)||ceiling<=0||total>ceiling)throw Error(`Batch memory caps ${total} MiB exceed available budget ${ceiling} MiB`);
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
async function cleanup(){
 for(const id of [...owned]){
  let c;try{c=JSON.parse(await dc(['inspect',id],{quiet:true}))[0];}catch{continue;}
  if(c.Config.Labels['com.docker.compose.project']!==project||core.has(c.Config.Labels['com.docker.compose.service'])){owned.delete(id);continue;}
  if(c.State.Running)await dc(['stop','--time','5',id]);owned.delete(id);
 }
 await writeFile(path.join(stateRoot,'owned.json'),JSON.stringify({worker,containers:[...owned]}),{mode:0o600});
}
async function warm(names){
 if(!names.length)return;
 await images(names);await budget(names);
 const before=new Set((await snapshot()).filter(c=>c.State.Running).map(c=>c.Id));
 try{await cc(['up','-d','--no-build','--wait','--wait-timeout','180',...names]);}
 finally{
  for(const c of await snapshot())if(!before.has(c.Id)&&!core.has(c.Config.Labels['com.docker.compose.service']))owned.add(c.Id);
  await writeFile(path.join(stateRoot,'owned.json'),JSON.stringify({worker,containers:[...owned]}),{mode:0o600});
 }
}
const httpCode=`const u=process.argv[1],body=JSON.parse(process.argv[2]);fetch(u,{method:body===null?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(Number(process.argv[3]))}).then(async r=>{const text=await r.text();if(text.length>1048576)throw Error('response too large');console.log(JSON.stringify({status:r.status,text}));}).catch(e=>{console.error(new URL(u).host+new URL(u).pathname+': '+e.message);process.exitCode=1;});`;
async function inside(url,body=null,timeout=10000){const r=JSON.parse(await cc(['exec','-T','gateway','node','-e',httpCode,url,JSON.stringify(body),String(timeout)]));if(r.status<200||r.status>=300)throw Error(`Internal service HTTP ${r.status}`);try{return JSON.parse(r.text);}catch{return r.text;}}
async function work(job,phase){
 const label=`${job.feature}:${job.digest.slice(0,16)}`,dto={label,rootTraceId:job.run_id,isoTime:'2026-10-01T19:14:00.000Z',ornament:{digest:job.digest}};
 if(job.family==='relay'){
  const urls=['http://spring:8081/api/approved.php','http://fastapi:8000/api/rubber.cgi','http://laravel:8001/api/nodeService'];
  const r=await inside(urls[phase],dto);if(!r.hop||r.hop.rootTraceId!==job.run_id)throw Error('Relay stamp missing');
  if(phase===0&&!r.hop.jpaRow)throw Error('JPA row not stored');if(phase===2&&!r.canContinue)throw Error('Eloquent terminal stamp failed');
  return {service:r.hop.service,stamp:r.hop,nextAvailable:r.canContinue===true,continuedInNextBatch:phase<2};
 }
 if(job.family==='grpc'){const r=await inside('http://spring:8081/api/grpc.do',dto);if(!r.canContinue||r.protocol!=='gRPC')throw Error('gRPC stamp failed');return r;}
 if(job.family==='analysis'){const r=await inside('http://fastapi:8000/api/analysis.php');if(!r.canContinue||!r.sources?.includes('DuckDB'))throw Error('Analysis failed');return r;}
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
async function perform(job){
 current=job;const family=catalog.families.find(f=>f.id===job.family),results=[];
 try{
  for(let phase=0;phase<family.steps.length;phase++){
   try{await access(stopFile);stopping=true;}catch{}
   if(stopping)throw Error('Worker stopping');
   await control('progress',{job:job.id,state:'starting',phase,result:{steps:results}});
   await log(`Starting ${job.family} batch ${phase+1}/${family.steps.length}`);
   try{await warm(family.steps[phase]);await control('progress',{job:job.id,state:'running',phase,result:{steps:results}});results.push(await work(job,phase));}
   finally{await cleanup();}
  }
  await control('complete',{job:job.id,state:'done',phase:family.steps.length,result:{steps:results}});report.completed.push({family:job.family,id:job.id,steps:results});report.completed=report.completed.slice(-64);await log(`Completed ${job.family}`);
 }catch(error){report.failed.push({family:job.family,id:job.id,error:error.message});report.failed=report.failed.slice(-64);await control('complete',{job:job.id,state:'failed',phase:results.length,result:{reason:error.message.slice(0,300),steps:results}}).catch(()=>{});await log(`Failed ${job.family}: ${error.message.slice(0,240)}`);}
 finally{current=null;await cleanup();await writeFile(path.join(stateRoot,'latest-report.json'),JSON.stringify(report,null,2),{mode:0o600});}
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;for(const child of children)child.kill();});
let timer;
try{
 await storageGuard();config=JSON.parse(await cc(['config','--format','json'],{quiet:true}));
 const running=await snapshot();if([...core].some(n=>!running.some(c=>c.Config.Labels['com.docker.compose.service']===n&&c.State.Running)))throw Error('Start the six core services before the host dispatcher');
 // Only the gateway is recreated to receive the private worker key; no Docker socket is mounted.
 await cc(['up','-d','--no-build','--wait','--wait-timeout','180','gateway']);
 for(let attempt=0;!leased;attempt++){try{await control('heartbeat');leased=true;}catch(error){if(attempt>=20||error.message.includes('409'))throw error;await sleep(500);}}
 // A successfully acquired database lease permits recovery of only our recorded container IDs.
 try{const previous=JSON.parse(await readFile(path.join(stateRoot,'owned.json'),'utf8'));for(const id of previous.containers||[])if(/^[a-f0-9]{64}$/.test(id))owned.add(id);}catch{}
 await cleanup();
 timer=setInterval(async()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{await control('heartbeat',current?{job:current.id}:{});}catch{stopping=true;}finally{heartbeatBusy=false;}},15000);
 const selection=process.argv.find(x=>x.startsWith('--tour='));
 const tour=selection?selection.slice(7).split(','):process.argv.includes('--tour')?catalog.families.map(f=>f.id):null;
 if(tour?.some(id=>!catalog.families.some(f=>f.id===id)))throw Error('Unknown demonstration family');
 await log('Host dispatcher ready; optional services start only for queued jobs.');
 while(!stopping){
  try{await access(stopFile);stopping=true;}catch{}
  if(stopping)break;
  if(tour?.length)await control('seed',{family:tour[0]});
  const {job}=await control('claim');if(job){await perform(job);if(tour?.[0]===job.family)tour.shift();}else if(tour)break;else await sleep(1200);
  if(tour&&!tour.length)break;
 }
}finally{clearInterval(timer);if(leased){await cleanup();await control('release').catch(()=>{});await writeFile(path.join(stateRoot,'latest-report.json'),JSON.stringify(report,null,2),{mode:0o600});}}
if(report.failed.length)process.exitCode=1;
