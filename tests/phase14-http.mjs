import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import path from 'node:path';
import {verificationConfig} from '../scripts/verification-config.mjs';
const {baseUrl,reportRoot}=verificationConfig(),checks=[],owned=new Map(),only=(process.env.OCV_PHASE14_HTTP_ONLY||'communications,digital,simulate,scan').split(','),report={startedAt:new Date().toISOString(),selected:only,passed:false,checks};
if(only.some(kind=>!['communications','digital','simulate','scan'].includes(kind)))throw Error('Unknown selected integration case');
async function post(group,route,body){const response=await fetch(baseUrl+'/api/'+group+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const text=await response.text();assert.ok(Buffer.byteLength(text)<=8388608);const value=JSON.parse(text);assert.ok(response.ok,`${group}${route}: HTTP ${response.status} ${String(value.message||value.error||'').slice(0,180)}`);return value;}
async function execute(group,request,project){
 const saved=await post(group,'/projects',{project}),back=await post(group,`/projects/${saved.id}/read`,{ticket:saved.ticket});assert.deepEqual(back.project,project);
 const job=await post(group,'/jobs',{request,project:saved.id,projectTicket:saved.ticket});assert.equal(job.dispatcherConfigured,true);owned.set(job.id,{group,ticket:job.ticket});const started=Date.now(),states=[];let row;
 while(Date.now()-started<180000){row=await post(group,`/jobs/${job.id}/read`,{ticket:job.ticket});assert.equal(row.storage,'PostgreSQL');if(states.at(-1)?.state!==row.state||states.at(-1)?.phase!==row.phase)states.push({state:row.state,phase:row.phase});if(['done','failed','cancelled'].includes(row.state))break;await sleep(800);}
 assert.equal(row.state,'done',JSON.stringify(row.result?.reason||row.result?.steps).slice(0,400));owned.delete(job.id);assert.equal(row.result.steps.length,8);checks.push({name:request.op,group,job:job.id,snapshot:saved.snapshot??saved.id,projectDigest:saved.digest,storage:row.storage,steps:row.result.steps.length,states,elapsedMs:Date.now()-started});return row.result;
}
try{
 const communication={bits:'101011001010'.repeat(8),seed:29,ebN0Db:4,samplesPerSymbol:8,sampleRateHz:8000,modulation:'QPSK',lineCode:'Manchester',crc:'CRC-16',timingOffsetSymbols:.125,frequencyOffsetHz:20,sweep:{axis:'ebN0Db',values:[0,4,8],secondaryAxis:'timingOffsetSymbols',secondaryValues:[-.25,0,.25]}};
 const digital={inputs:{one:true,d:false},patterns:{d:'00110000'},gates:[{id:'q',type:'JKFF',inputs:['one','one']},{id:'sample',type:'DFF',inputs:['q']}],ticks:12,clockPeriodTicks:4,tickS:.01};
 const project={schema:'ocv.signals-project/1',name:'Phase XIV finite instruments',drawing:{components:[],wires:[]},communication,digital};
 if(only.includes('communications')){const radio=await execute('signals',{schema:'ocv.signals/1',op:'communications',...communication},project);assert.equal(radio.engine.ok,true);assert.equal(radio.engine.sweep.cases,9);assert.equal(radio.analysis.summary.failed,0);assert.equal(radio.analysis.nativeResultReplaced,false);assert.equal(radio.analysis.audit.readbackVerified,true);assert.equal(radio.analysis.checks.find(c=>c.code==='SWEEP_ACCOUNTING').status,'pass');checks.at(-1).nativeVersion=radio.engine.version;}
 if(only.includes('digital')){const logic=await execute('signals',{schema:'ocv.signals/1',op:'digital',...digital},project);assert.equal(logic.analysis.verification,'verified');assert.equal(logic.analysis.audit.readbackVerified,true);assert.equal(logic.engine.trace[2].values.sample,false);assert.equal(logic.engine.trace[6].values.sample,true);checks.at(-1).independentReference=logic.analysis.engine;}
 const mechanical=JSON.parse(await readFile(path.join(reportRoot,'phase14-workshop-fixtures','control-chain.json'),'utf8'));
 if(only.includes('simulate')){const result=await execute('workshop',{schema:'ocv.workshop-run/1',op:'simulate',world:mechanical.world,challenge:mechanical.challenge},mechanical);assert.equal(result.engine.summary.challengeComplete,true);assert.equal(result.analysis.ok,true);assert.equal(result.analysis.engine,'ME2/1.1.0');assert.equal(result.analysis.nativeSucceeded,true);checks.at(-1).composedControls=mechanical.world.controls.length;}
 const partial=JSON.parse(await readFile(path.join(reportRoot,'phase14-partial-scan.json'),'utf8')),partialProject={schema:'ocv.workshop-project/1',name:'Phase XIV partial outcome',world:partial.request.world};
 if(only.includes('scan')){const scan=await execute('workshop',partial.request,partialProject);assert.equal(scan.engine.ok,false);assert.equal(scan.analysis.ok,true);assert.equal(scan.analysis.partial,true);assert.equal(scan.analysis.nativeSucceeded,false);assert.equal(scan.analysis.summary.successfulTrials,1);assert.equal(scan.analysis.summary.failedTrials,1);checks.at(-1).partialNativeFailureRetained=true;}
 report.passed=true;console.log(JSON.stringify({passed:true,checks:checks.length,storage:'PostgreSQL',independentAnalysis:true,partialFailuresRetained:true}));
}catch(error){report.error=error.message;throw error;}finally{
 for(const[id,{group,ticket}]of owned)await post(group,`/jobs/${id}/cancel`,{ticket}).catch(()=>{});
 report.finishedAt=new Date().toISOString();await writeFile(path.join(reportRoot,`phase14-http-${only.join('-')}.json`),JSON.stringify(report,null,2));
}
