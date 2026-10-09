import {testDeps,testBase} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
const base=testBase,folder=path.join(testDeps,'runtime/reports');
await mkdir(folder,{recursive:true});
const selected=new Set((process.env.OCV_SHARED_CONSUMERS||'signals,workshop,music').split(','));
const report={schema:'ocv.phase12.pipeline-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[],jobs:[],errors:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function post(url,value){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(15000)});const data=await r.json();assert.ok(r.ok,`${url} HTTP ${r.status}: ${data.message||data.error||''}`);return data;}
async function wait(job){for(let n=0;n<600;n++){const r=await post('/api/shared/jobs/'+job.id+'/read',{ticket:job.ticket});if(['done','failed','cancelled'].includes(r.state)){assert.equal(r.state,'done',JSON.stringify(r.result));return r;}await pause(1200);}throw Error('Bounded shared-pipeline wait expired');}
function zip(b){
 const entries=new Map();let end=-1;for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50){end=p;break;}assert.ok(end>=0,'ZIP end record');const count=b.readUInt16LE(end+10);assert.ok(count<=24);let cursor=b.readUInt32LE(end+16),total=0;
 for(let n=0;n<count;n++){assert.equal(b.readUInt32LE(cursor),0x02014b50);const method=b.readUInt16LE(cursor+10),compressed=b.readUInt32LE(cursor+20),size=b.readUInt32LE(cursor+24),names=b.readUInt16LE(cursor+28),extra=b.readUInt16LE(cursor+30),comment=b.readUInt16LE(cursor+32),local=b.readUInt32LE(cursor+42),name=b.subarray(cursor+46,cursor+46+names).toString('utf8');assert.ok(!name.startsWith('/')&&!name.split('/').includes('..'));assert.ok(size<=8388608);assert.equal(b.readUInt32LE(local),0x04034b50);const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),data=b.subarray(start,start+compressed),raw=method===0?data:inflateRawSync(data,{maxOutputLength:8388608});assert.equal(raw.length,size);total+=size;assert.ok(total<=8388608);assert.ok(!entries.has(name));entries.set(name,raw);cursor+=46+names+extra+comment;}
 return entries;
}
async function verify(job,consumer){
 const r=await wait(job),s=r.shared;assert.equal(s.analysis.engine,'SH3/python-duckdb');assert.ok(s.analysis.statistics.length>0);assert.ok(s.analysis.artifacts.length>=4);assert.equal(s.object.storage,'MinIO');assert.equal(s.object.readback,true);assert.equal(s.publication.storage,'mysql');assert.equal(s.publication.readbackVerified,true);assert.equal(s.attestation.manifestAttestation.ok,true);assert.equal(r.result.steps.length,8);assert.equal(r.result.shared.checkpointed,true);
 if(consumer==='signals'){const voltage=s.analysis.statistics.find(row=>row.entity==='node:out'&&row.quantity==='voltage');assert.equal(voltage.unit,'V');assert.ok(Math.abs(voltage.mean-6)<1e-8,'The real 12 V divider must produce 6 V');}
 const response=await fetch(base+'/api/shared/jobs/'+job.id+'/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:job.ticket})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/zip');const archive=Buffer.from(await response.arrayBuffer());assert.equal(hash(archive),response.headers.get('x-content-sha256'));assert.equal(hash(archive),s.artifact.archive.sha256);assert.equal(archive.length,s.object.bytes);const files=zip(archive),manifest=JSON.parse(files.get('manifest.json').toString('utf8'));assert.equal(manifest.source.digest,r.digest);for(const entry of manifest.files){const b=files.get(entry.name);assert.ok(b,entry.name);assert.equal(b.length,entry.bytes);assert.equal(hash(b),entry.sha256);}assert.ok(files.has('source.json')&&files.has('results.json'));await writeFile(path.join(folder,'phase12-'+consumer+'.zip'),archive);
 const denied=await fetch(base+'/api/shared/jobs/'+job.id+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:'0'.repeat(64)})});assert.equal(denied.status,404);
 report.jobs.push({id:job.id,consumer,state:r.state,archiveSha:hash(archive),bytes:archive.length,files:files.size,analysisRows:s.analysis.audit?.selectedRows,statistics:s.analysis.statistics.length,version:s.version,readback:{mysql:true,minio:true,zip:true},checkpointed:true});report.checks.push(consumer+' actual eight-stage chain and independent download verification');return r;
}
try{
 const request={schema:'ocv.signals/1',op:'circuit',ground:'0',analysis:{kind:'dc'},components:[{id:'V1',type:'V',a:'in',b:'0',value:12},{id:'R1',type:'R',a:'in',b:'out',value:1000},{id:'R2',type:'R',a:'out',b:'0',value:1000}],probeNodes:['out']};
 if(selected.has('signals')){const project={schema:'ocv.signals-project/1',name:'Shared divider',drawing:{components:[{id:'V1',kind:'V',x:200,y:180,rotation:0,value:12},{id:'R1',kind:'R',x:360,y:180,rotation:0,value:1000},{id:'R2',kind:'R',x:440,y:280,rotation:90,value:1000},{id:'G1',kind:'GND',x:200,y:380,rotation:0,value:0}],wires:[]}};const saved=await post('/api/signals/projects',{project});const signals=await post('/api/signals/jobs',{request,project:saved.id,projectTicket:saved.ticket});await verify(signals,'signals');}
 if(selected.has('workshop')){const candidate=await (await fetch(base+'/workshop/examples/gearbox.json')).json();assert.ok(candidate.world,'Mechanical template fixture');candidate.world.durationS=1;candidate.world.sampleEvery=4;const saved=await post('/api/workshop/projects',{project:candidate});const workshop=await post('/api/workshop/jobs',{request:{schema:'ocv.workshop-run/1',op:'simulate',world:candidate.world,...(candidate.challenge?{challenge:candidate.challenge}:{})},project:saved.id,projectTicket:saved.ticket});await verify(workshop,'workshop');}
 if(selected.has('music')){const music=await post('/api/q8/music',{session:randomUUID(),tempo:108,events:[{n:60,t:0,d:500,v:.7},{n:64,t:500,d:400,v:.6},{n:67,t:900,d:600,v:.8},{n:72,t:1500,d:350,v:.5}]});assert.ok(music.job&&music.ticket);await verify({id:music.job.id,ticket:music.ticket},'music');}
 report.passed=true;
}catch(error){report.errors.push(error.message);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await writeFile(path.join(folder,'phase12-pipeline.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors}));}
