import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {docker,composeArguments,dockerEnvironment} from '../../scripts/docker-child.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
try{process.loadEnvFile(join(root,'.env'))}catch(error){if(error.code!=='ENOENT')throw error}
const base=new URL(process.env.OCV_SHARED_BASE_URL||`http://127.0.0.1:${process.env.OCV_WEB_PORT||8080}`);
if(base.protocol!=='http:'||base.username||base.password||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('The SH1 interruption proof uses a private loopback entrance');
const deps=testDeps;
const directory=join(deps,'runtime/reports'),stateRoot=join(deps,'runtime/after-runner'),reportFile=join(directory,'phase12-sh1-recovery.json');
const report={schema:'ocv.sh1/recovery-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[],ownedWorkers:[],maximumLocalWorkerProcesses:1,maximumPollMs:600000,sqlMutations:false,privateCapabilitiesPrinted:false};
const deadline=Date.now()+600000,owned=new Set();let cap,worker0,worker1,interrupted;
const compose=composeArguments([]);
const dockerEnv=dockerEnvironment();

async function command(args,input){
 return new Promise((done,fail)=>{const child=spawn(docker,[...compose,...args],{cwd:root,env:{...process.env,...dockerEnv,COMPOSE_PARALLEL_LIMIT:'1',COMPOSE_PROFILES:''},windowsHide:true,stdio:['pipe','pipe','pipe']});let text='',bytes=0,problem='',settled=false;const timer=setTimeout(()=>{problem='The read-only evidence helper timed out';child.kill()},15000);
  child.stdin.on('error',()=>{});child.stdin.end(input);
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){problem='Evidence output exceeded 64 KiB';child.kill()}else text+=chunk.toString('utf8')});
  child.stderr.on('data',()=>{});
  child.once('error',()=>{clearTimeout(timer);settled=true;fail(Error('The evidence helper could not start'))});
  child.once('close',code=>{clearTimeout(timer);if(settled)return;settled=true;if(code!==0||problem)fail(Error(problem||'The read-only evidence helper failed'));else{try{done(JSON.parse(text))}catch{fail(Error('The evidence helper returned invalid bounded JSON'))}}});
 });
}
const captureCode=`const {Client}=require('pg');let raw='';process.stdin.on('data',b=>raw+=b);process.stdin.on('end',async()=>{const input=JSON.parse(raw),db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:1200,statement_timeout:2000});try{await db.connect();if(input.id){if(!/^[a-f0-9-]{36}$/.test(input.id))throw Error('id');const job=(await db.query('SELECT j.id,j.state,j.phase,j.result,b.plan_sha,b.attempts FROM ocv_after.jobs j JOIN ocv_shared1.task_books b ON b.job_id=j.id WHERE j.id=$1',[input.id])).rows[0];const rows=(await db.query('SELECT step_key AS key,ordinal AS phase,status,attempts,result_sha AS sha,result FROM ocv_shared1.cash_book WHERE job_id=$1 ORDER BY ordinal',[input.id])).rows;const lease=(await db.query('SELECT owner,lease_until>now() AS leased FROM ocv_after.worker WHERE id=1')).rows[0];console.log(JSON.stringify({job,rows,lease}));}else{const state=(await db.query("SELECT count(*) FILTER(WHERE state='queued')::int AS queued,count(*) FILTER(WHERE state IN('starting','running'))::int AS active FROM ocv_after.jobs")).rows[0];const lease=(await db.query('SELECT lease_until>now() AS leased FROM ocv_after.worker WHERE id=1')).rows[0];console.log(JSON.stringify({...state,...lease}));}}catch{process.exitCode=1}finally{await db.end().catch(()=>{})}});`;
const capture=id=>command(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',captureCode],JSON.stringify(id?{id}:{}));
async function post(path,body){const response=await fetch(new URL(path,base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});assert.ok(response.ok,`Test-owned HTTP request failed (${response.status})`);const text=await response.text();assert.ok(Buffer.byteLength(text)<=1048576,'Test-owned status must remain bounded');return JSON.parse(text)}
const readJob=()=>post(`/api/shared/jobs/${cap.id}/read`,{ticket:cap.ticket});
async function check(name,fn){const started=Date.now();try{const evidence=await fn();report.checks.push({name,passed:true,elapsedMs:Date.now()-started,...evidence})}catch(error){report.checks.push({name,passed:false,elapsedMs:Date.now()-started,error:String(error.message).slice(0,220)});throw error}}
async function until(fn,message,maximumMs=240000){const end=Math.min(deadline,Date.now()+maximumMs);while(Date.now()<end){const value=await fn();if(value)return value;await sleep(150)}throw Error(message)}
function startWorker(index){
 assert.equal(owned.size,0,'The recovery proof never starts two host workers at once');
 const child=spawn(process.execPath,['--max-old-space-size=192',join(root,'scripts/after-runner.mjs'),'--drain'],{cwd:root,env:{...process.env,OCV_SHARED_AMQP:'0',OCV_RUNNER_MAX_CONCURRENCY:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 const state={child,pid:child.pid,index,exit:null,log:''};owned.add(state);state.closed=new Promise(done=>{child.once('error',()=>{state.exit={code:null,error:'The owned host worker could not start'};owned.delete(state);done(state.exit)});child.once('close',(code,signal)=>{state.exit={code,signal};owned.delete(state);done(state.exit)})});
 const append=chunk=>{state.log=(state.log+chunk.toString('utf8')).slice(-16384)};child.stdout.on('data',append);child.stderr.on('data',append);
 report.ownedWorkers.push({index,pid:child.pid,startedAt:new Date().toISOString()});return state;
}
async function saveWorker(state){const logFile=join(deps,`runtime/logs/phase12-sh1-owned-worker-${state.index}.log`);await mkdir(dirname(logFile),{recursive:true});await writeFile(logFile,state.log,{mode:0o600});const row=report.ownedWorkers.find(item=>item.index===state.index);Object.assign(row,{exit:state.exit,log:logFile});}
async function stopOwned(state){if(state.exit)return;await mkdir(stateRoot,{recursive:true});await writeFile(join(stateRoot,'stop'),'stop\n',{mode:0o600});await until(()=>state.exit,'The owned host worker did not finish its ordinary stop path',45000);await state.closed;await saveWorker(state)}
async function workerReport(){const text=await readFile(join(stateRoot,'latest-report.json'),'utf8');assert.ok(Buffer.byteLength(text)<=1048576);return JSON.parse(text)}

try{
 await mkdir(directory,{recursive:true});await mkdir(stateRoot,{recursive:true});
 await check('The proof starts with an idle queue and an expired worker lease',async()=>{const before=await capture();assert.equal(before.queued,0);assert.equal(before.active,0);assert.equal(before.leased,false);return{queued:0,active:0,leased:false}});
 await check('One actual frozen recording enters the canonical music-report queue',async()=>{const events=Array.from({length:24},(_,i)=>({n:60+(i%8),t:i*90,d:180+(i%3)*40,v:.6}));const submitted=await post('/api/q8/music',{session:randomUUID(),tempo:108,events});assert.ok(submitted.job?.id&&submitted.ticket);assert.equal(submitted.job.family,'music-report');assert.equal(submitted.storage,'postgresql');cap={id:submitted.job.id,ticket:submitted.ticket};report.job=cap.id;worker0=startWorker(0);await writeFile(join(deps,'runtime/after-runner/phase12-recovery-owned-pid.json'),JSON.stringify({pid:worker0.pid,job:cap.id,index:0}),{mode:0o600});return{id:cap.id,notes:events.length,sourceDigest:submitted.sha}});
 await check('Ordinary stop interrupts only the owned runner after three durable checkpoints',async()=>{
  const live=await until(async()=>{if(worker0.exit)throw Error('The first owned worker exited before the interruption window');const record=await readJob();if(['failed','cancelled','done'].includes(record.state))throw Error('The test job became terminal before its interruption window');return Array.isArray(record.result?.steps)&&record.result.steps.length>=3?record:false},'Three actual music checkpoints did not become visible');
  await writeFile(join(stateRoot,'stop'),'stop\n',{mode:0o600});await stopOwned(worker0);assert.equal(worker0.exit.code,0);const host=await workerReport();assert.equal(host.effectiveConcurrency,1);assert.ok(host.interrupted?.some(row=>row.id===cap.id&&row.checkpointPreserved));interrupted=await capture(cap.id);assert.ok(['starting','running'].includes(interrupted.job.state));const completed=interrupted.rows.filter(row=>row.status==='done');assert.ok(completed.length>=3&&completed.length<8,'At least three, but not all, steps must have durable checkpoints');assert.ok(completed.every(row=>/^[a-f0-9]{64}$/.test(row.sha)));assert.equal(interrupted.lease.leased,false);report.firstWorker=host.worker;report.interrupted={state:interrupted.job.state,phase:interrupted.job.phase,planSha:interrupted.job.plan_sha,steps:completed.map(row=>({key:row.key,sha:row.sha,attempts:row.attempts}))};return{observedPhase:live.phase,retainedSteps:completed.length,canonicalState:interrupted.job.state,leaseReleased:true};
 });
 await check('A new worker resumes the same canonical job and preserves successful checkpoint bytes',async()=>{
  worker1=startWorker(1);await writeFile(join(deps,'runtime/after-runner/phase12-recovery-owned-pid.json'),JSON.stringify({pid:worker1.pid,job:cap.id,index:1}),{mode:0o600});const done=await until(async()=>{const row=await readJob();if(row.state==='failed'||row.state==='cancelled')throw Error('The resumed canonical job failed');if(worker1.exit&&row.state!=='done')throw Error('The resumed owned runner exited without completion');return row.state==='done'?row:false},'The same interrupted job did not complete');await until(()=>worker1.exit,'The bounded resumed drain did not exit',45000);await worker1.closed;await saveWorker(worker1);assert.equal(worker1.exit.code,0);const host=await workerReport(),after=await capture(cap.id);assert.notEqual(host.worker,report.firstWorker);assert.equal(host.effectiveConcurrency,1);assert.equal(after.job.id,interrupted.job.id);assert.equal(after.job.plan_sha,interrupted.job.plan_sha);assert.equal(after.job.attempts,interrupted.job.attempts+1);assert.equal(after.job.state,'done');assert.equal(after.rows.length,8);assert.ok(after.rows.every(row=>row.status==='done'));for(const original of interrupted.rows.filter(row=>row.status==='done')){const resumed=after.rows.find(row=>row.key===original.key);assert.equal(resumed.sha,original.sha);assert.deepEqual(resumed.result,original.result);assert.equal(resumed.attempts,original.attempts)}assert.ok(host.events?.filter(row=>row.id===cap.id&&row.kind==='checkpoint-resumed').length>=3);assert.ok(host.completed?.some(row=>row.id===cap.id&&row.shared?.recovered===true));assert.equal(done.result?.steps?.length,8);assert.equal(done.result?.shared?.outbox?.pending,0);assert.equal(after.lease.leased,false);report.secondWorker=host.worker;report.completed={state:after.job.state,attempts:after.job.attempts,planSha:after.job.plan_sha,steps:after.rows.map(row=>({key:row.key,sha:row.sha,attempts:row.attempts}))};return{sameJob:true,newWorkerUuid:true,retainedHashesUnchanged:true,successfulSteps:8,outboxPending:0};
 });
 report.passed=true;
}catch(error){report.error=String(error.message).slice(0,300);process.exitCode=1}
finally{
 for(const state of [...owned]){try{await stopOwned(state)}catch{if(owned.has(state)){state.child.kill();await Promise.race([state.closed,sleep(5000)]);report.cleanupIncomplete=true;await saveWorker(state).catch(()=>{})}}}
 if(cap&&!report.passed){try{const row=await readJob();if(['queued','starting','running'].includes(row.state))await post(`/api/shared/jobs/${cap.id}/cancel`,{ticket:cap.ticket})}catch{report.cleanupIncomplete=true}}
 report.finishedAt=new Date().toISOString();report.liveOwnedWorkerProcesses=owned.size;await writeFile(reportFile,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,file:reportFile}));
}
