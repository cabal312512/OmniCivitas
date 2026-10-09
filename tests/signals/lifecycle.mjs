import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';

const base=process.env.OCV_SIGNALS_BASE_URL||`http://localhost:${process.env.OCV_WEB_PORT||8080}`;
const report={schema:'ocv.signals/lifecycle-proof/1',startedAt:new Date().toISOString(),checks:[],passed:false};
const request={schema:'ocv.signals/1',op:'circuit',ground:'0',analysis:{kind:'dc'},components:[{id:'V1',type:'V',a:'in',b:'0',value:5},{id:'R1',type:'R',a:'in',b:'out',value:1000},{id:'R2',type:'R',a:'out',b:'0',value:1000}]};
const owned=new Map(),cancelOnly=process.argv.includes('--cancel-only');
async function post(route,body){const r=await fetch(`${base}/api/signals${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});assert.ok(r.ok,`HTTP ${r.status}`);return r.json();}
async function read(job){return post(`/jobs/${job.id}/read`,{ticket:job.ticket});}
async function waitFor(job,predicate,seconds=120){const start=Date.now();while(Date.now()-start<seconds*1000){const state=await read(job);if(predicate(state))return state;await sleep(400);}throw Error('Bounded task wait expired');}
try{
 const job=await post('/jobs',{request});owned.set(job.id,job);
 const claimed=await waitFor(job,state=>['starting','running'].includes(state.state),15);
 const cancelled=await post(`/jobs/${job.id}/cancel`,{ticket:job.ticket});assert.equal(cancelled.cancelled,true);
 await sleep(23000);
 const terminal=await read(job);assert.equal(terminal.state,'cancelled');assert.equal(terminal.cancelled,true);assert.equal(terminal.result.analysis,null);
 if(process.env.OCV_SIGNALS_CHECK_WORKER_REPORT==='1'){const file=path.join(testDeps,'runtime/after-runner/latest-report.json');let recorded=false;for(let i=0;i<12;i++){const worker=JSON.parse(await readFile(file,'utf8'));if(worker.cancelled?.some(row=>row.id===job.id)){assert.ok(!worker.failed.some(row=>row.id===job.id));recorded=true;break;}await sleep(500);}assert.ok(recorded,'Worker must record cancellation separately from failure');}
 report.checks.push({name:'claimed task cancellation remains terminal',passed:true,stateBeforeCancellation:claimed.state,observedAfterMs:23000,terminalState:terminal.state,analysisWasNotInvented:true});
 owned.delete(job.id);
 if(!cancelOnly){
 const floating={...request,components:[{id:'V1',type:'V',a:'a',b:'b',value:5},{id:'R1',type:'R',a:'a',b:'b',value:1000}]};
 const failed=await post('/jobs',{request:floating});owned.set(failed.id,failed);
 const result=await waitFor(failed,state=>['done','failed','cancelled'].includes(state.state));
 assert.equal(result.state,'failed');assert.equal(result.storage,'PostgreSQL');assert.equal(result.result.engine.ok,false);assert.ok(result.result.engine.diagnostics.length);assert.equal(result.result.analysis,null);
 report.checks.push({name:'real native floating circuit fails without fabricated analysis',passed:true,terminalState:result.state,nativeEngine:result.result.engine.engine,diagnostics:result.result.engine.diagnostics.map(d=>d.code),storage:result.storage});
 owned.delete(failed.id);
 }
 report.passed=true;console.log(cancelOnly?'Lifecycle: claimed cancellation and worker classification passed':'Lifecycle: claimed cancellation and real native failure passed');
}catch(error){report.error=String(error.message).slice(0,300);process.exitCode=1;console.error(report.error);}
finally{
 for(const job of owned.values())try{await post(`/jobs/${job.id}/cancel`,{ticket:job.ticket});}catch{}
 report.finishedAt=new Date().toISOString();const folder=path.join(testDeps,'runtime/reports');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,cancelOnly?'phase10-cancel.json':'phase10-lifecycle.json'),JSON.stringify(report,null,2)+'\n');
}
