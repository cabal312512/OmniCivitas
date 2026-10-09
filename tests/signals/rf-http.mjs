import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';

const base=new URL(process.env.OCV_SIGNALS_BASE_URL||`http://localhost:${process.env.OCV_WEB_PORT||8080}`);
const file=join(testDeps,'runtime/reports/phase10-rf-http.json');
const report={schema:'ocv.signals/rf-http-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[]};
const rf={frequencyMHz:1000,distanceKm:1,txPowerDbm:30,txGainDbi:8,rxGainDbi:8,lossDb:2,bandwidthHz:1e6,bitRateBps:5e5,noiseFigureDb:5,requiredEbN0Db:10};
const communication={bits:'0100111001100101',seed:1234,ebN0Db:8,samplesPerSymbol:4,sampleRateHz:8000,rf};
const project={schema:'ocv.signals-project/1',name:'RF reference',drawing:{components:[],wires:[]},analysis:{kind:'dc',fStart:10,fStop:100000,points:64,durationS:.01,stepS:.000025},communication,instruments:{probe:'out',cursor:0}};
const request={schema:'ocv.signals/1',op:'communications',...communication,crc:'CRC-8',modulation:'BPSK',noiseless:true};
let own;
async function post(path,body,status=[200,201]){
 const response=await fetch(new URL('/api/signals'+path,base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const value=await response.json();assert.ok(status.includes(response.status),`${path}: HTTP ${response.status}, ${value.message||value.error||''}`);return value;
}
try{
 const saved=await post('/projects',{project});
 assert.equal(saved.storage,'PostgreSQL');
 const read=await post(`/projects/${saved.id}/read`,{ticket:saved.ticket});
 assert.deepEqual(read.project.communication.rf,rf);
 report.checks.push({name:'RF parameters preserved in actual PostgreSQL snapshot',passed:true,digest:saved.digest});
 await post('/jobs',{request:{...request,rf:{...rf,noiseFigureDb:-1}}},[400]);
 await post('/jobs',{request:{...request,rf:{...rf,arbitrary:0}}},[400]);
 await post('/projects',{project:{...project,communication:{...communication,rf:{...rf,distanceKm:0}}}},[400]);
 report.checks.push({name:'Invalid RF range/unknown fields rejected in job and save paths',passed:true});
 own=await post('/jobs',{request,project:saved.id,projectTicket:saved.ticket});
 assert.equal(own.dispatcherConfigured,true);
 const transitions=[],deadline=Date.now()+180000;
 let state;
 while(Date.now()<deadline){
  state=await post(`/jobs/${own.id}/read`,{ticket:own.ticket});
  if(transitions.at(-1)?.state!==state.state||transitions.at(-1)?.phase!==state.phase)transitions.push({state:state.state,phase:state.phase});
  if(['done','failed','cancelled'].includes(state.state))break;
  await sleep(800);
 }
 assert.equal(state?.state,'done',JSON.stringify(state?.error));
 const {engine,analysis,steps}=state.result,budget=engine.linkBudget;
 assert.equal(engine.ok,true);assert.ok(budget);
 assert.ok(Math.abs(budget.freeSpaceLossDb-92.44778322188338)<1e-9);
 assert.ok(Math.abs(budget.receivedDbm-(44-budget.freeSpaceLossDb))<1e-9);
 assert.ok(Math.abs(budget.ebN0Db-budget.snrDb-10*Math.log10(2))<1e-9);
 assert.equal(budget.channelCoupled,false);assert.equal(budget.geometryDerived,false);
 assert.equal(engine.summary.ebN0Db,8);assert.equal(engine.bitErrors,0);
 assert.equal(analysis.nativeResultReplaced,false);assert.equal(analysis.verification,'verified');
 assert.equal(analysis.audit.readbackVerified,true);assert.equal(steps[1].nativeExecution,true);
 const rfChecks=analysis.checks.filter(check=>String(check.code).startsWith('RF_'));
 assert.ok(rfChecks.length>0,'Independent RF checks must actually execute');
 assert.ok(rfChecks.every(check=>check.status==='pass'));
 report.checks.push({name:'Original Rust native RF result independently checked by Python and read from PG',passed:true,id:own.id,transitions,budget,rfChecks,javaContract:steps[0].java.contract,goContract:steps[0].go.contract});
 own=undefined;
 const controlled={schema:'ocv.signals/1',op:'circuit',ground:'0',analysis:{kind:'dc'},probeNodes:['ev','gv'],components:[
  {id:'V1',type:'V',a:'in',b:'0',value:3},
  {id:'E1',type:'E',a:'ev',b:'0',controlA:'in',controlB:'0',value:2},
  {id:'G1',type:'G',a:'gv',b:'0',controlA:'in',controlB:'0',value:.001},
  {id:'RE',type:'R',a:'ev',b:'0',value:1000},{id:'RG',type:'R',a:'gv',b:'0',value:1000}]};
 await post('/jobs',{request:{...controlled,components:[{id:'E1',type:'E',a:'ev',b:'0',value:2}]}},[400]);
 own=await post('/jobs',{request:controlled,project:saved.id,projectTicket:saved.ticket});
 const controlDeadline=Date.now()+180000;
 while(Date.now()<controlDeadline){state=await post(`/jobs/${own.id}/read`,{ticket:own.ticket});if(['done','failed','cancelled'].includes(state.state))break;await sleep(800);}
 assert.equal(state?.state,'done',JSON.stringify(state?.error));
 assert.ok(Math.abs(state.result.engine.rows[0].values.ev-6)<1e-10);
 assert.ok(Math.abs(state.result.engine.rows[0].values.gv+3)<1e-10);
 assert.ok(Math.abs(state.result.engine.rows[0].branches.G1-.003)<1e-10);
 assert.equal(state.result.analysis.verification,'verified');
 assert.equal(state.result.analysis.nativeResultReplaced,false);
 assert.equal(state.result.analysis.audit.readbackVerified,true);
 report.checks.push({name:'Actual C++ E/G MNA and Python relations/KCL checked through same server chain',passed:true,id:own.id,values:state.result.engine.rows[0].values,checks:state.result.analysis.checks.map(check=>({code:check.code,status:check.status}))});
 own=undefined;report.passed=true;
 console.log('PASS: RF snapshot/validation and two native / PG / Python service jobs (RF and E/G)');
}catch(error){report.error=String(error.message);throw error;}
finally{
 if(own)await post(`/jobs/${own.id}/cancel`,{ticket:own.ticket}).catch(()=>{});
 report.finishedAt=new Date().toISOString();await mkdir(join(file,'..'),{recursive:true});await writeFile(file,JSON.stringify(report,null,2)+'\n');
}
