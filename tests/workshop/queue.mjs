import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const base=new URL(process.env.OCV_WORKSHOP_BASE_URL||`http://localhost:${process.env.OCV_WEB_PORT||8080}`);
if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Use an HTTP entrance without credentials');
const limit=Number(process.env.OCV_QUEUE_TEST_LIMIT??0);
if(!Number.isSafeInteger(limit)||limit<0||limit>100000)throw Error('Use the actual configured queue limit');
const total=limit>0&&limit<=16?limit:6;
const file=join(testDeps,'runtime/reports/shared-queue.json');
const report={schema:'ocv.engineering/queue-proof/2',startedAt:new Date().toISOString(),passed:false,configuredQueueLimit:limit,queuedCount:total,checks:[]};
const own=[];
const workshop={schema:'ocv.workshop-run/1',op:'simulate',world:{gravityX:0,gravityY:-9.81,stepS:1/120,durationS:.2,sampleEvery:1,seed:1,bodies:[{id:'B1',kind:'ball',x:0,y:2,radius:.3,mass:1}],joints:[],motors:[],controls:[]}};
const signals={schema:'ocv.signals/1',op:'communications',bits:'0101010101010101',ebN0Db:8,seed:1,samplesPerSymbol:8,sampleRateHz:48000,crc:'CRC-8',modulation:'BPSK'};
async function post(domain,path,body,expected=[200,201]){
 const response=await fetch(new URL(`/api/${domain}${path}`,base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const value=await response.json();assert.ok(expected.includes(response.status),`${domain}${path}: HTTP ${response.status}`);return value;
}
// Run with an idle queue and the host dispatcher paused. This tests PostgreSQL admission without launching optional services.
try{
 for(const domain of Array.from({length:total},(_,index)=>index%2===0?'workshop':'signals')){
  const job=await post(domain,'/jobs',{request:domain==='workshop'?workshop:signals});assert.equal(job.state,'queued');
  own.push({domain,id:job.id,ticket:job.ticket});
 }
 report.checks.push({name:'Independent queued engineering jobs coexist',passed:true,ids:own.map(({domain,id})=>({domain,id}))});
 if(limit>0&&limit<=16){
  await post('workshop','/jobs',{request:workshop},[429]);
  await post('signals','/jobs',{request:signals},[429]);
  report.checks.push({name:'Both families honor the configured queued-job count limit',passed:true});
 }else report.checks.push({name:'More than the previous four-job limit is accepted; this finite check does not prove infinite capacity',passed:true});
 for(const job of own){
  const row=await post(job.domain,`/jobs/${job.id}/read`,{ticket:job.ticket});assert.equal(row.state,'queued','Pause the dispatcher before testing deterministic queue admission');
  assert.equal(row.storage,'PostgreSQL');
  await post(job.domain,`/jobs/${job.id}/read`,{ticket:'0'.repeat(64)},[404]);
 }
 report.checks.push({name:'Owner capabilities isolate actual PostgreSQL queued jobs',passed:true});
 for(const job of own){
  const cancelled=await post(job.domain,`/jobs/${job.id}/cancel`,{ticket:job.ticket});assert.equal(cancelled.cancelled,true);
  const row=await post(job.domain,`/jobs/${job.id}/read`,{ticket:job.ticket});assert.equal(row.state,'cancelled');
 }
 report.checks.push({name:'Every test-owned queued job is cancelled without engine execution',passed:true});
 report.passed=true;
}finally{
 for(const job of own)await post(job.domain,`/jobs/${job.id}/cancel`,{ticket:job.ticket}).catch(()=>{});
 report.finishedAt=new Date().toISOString();await mkdir(join(file,'..'),{recursive:true});await writeFile(file,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,file}));
}
