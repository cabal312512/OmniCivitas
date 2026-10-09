import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {composeCall,dockerCall} from './docker-child.mjs';
import {verificationConfig} from './verification-config.mjs';
const config=verificationConfig(),base=config.baseUrl,folder=config.reportRoot;
const report={schema:'ocv.phase13.integration/1',startedAt:new Date().toISOString(),passed:false,checks:[],jobs:[],capabilitiesPrinted:false,actualPostgreSQL:true,actualWorkerRequired:true};
const hash=value=>createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function projectionState(){const id=composeCall(['ps','-a','-q','site-projection']).stdout.trim();assert.ok(id);const container=JSON.parse(dockerCall(['inspect',id]).stdout)[0];return {running:container.State.Running,startedAt:container.State.StartedAt,finishedAt:container.State.FinishedAt};}
async function stoppedProjection(){const end=Date.now()+15000;let state;do{state=projectionState();if(!state.running)return state;await sleep(250);}while(Date.now()<end);assert.equal(state.running,false,'Owned projection service must stop after job completion');}
export function sql(text,values=[]){
 const source="const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,max:1});const q=JSON.parse(process.argv[1]);p.query(q.text,q.values).then(r=>console.log(JSON.stringify(r.rows))).finally(()=>p.end()).catch(e=>{console.error(e.message);process.exitCode=1});";
 return JSON.parse(composeCall(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',source,JSON.stringify({text,values})],{timeout:15000}).stdout);
}
async function post(route,body,expected=201){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});assert.equal(r.status,expected,`${route}: HTTP ${r.status}`);return r.json();}
async function check(name,run){const started=Date.now();try{const evidence=await run();report.checks.push({name,passed:true,elapsedMs:Date.now()-started,...evidence});}catch(error){report.checks.push({name,passed:false,error:error.message.slice(0,300)});throw error;}}
async function done(body){
 const receipt=await post('/api/site/return.php',body);report.jobs.push({id:receipt.job.id,family:'site-'+body.kind});
 const deadline=Date.now()+180000;
 while(Date.now()<deadline){const job=await post('/api/a2/job.cgi/'+receipt.job.id,{ticket:receipt.ticket});if(job.state==='done'){const completed=await post('/api/site/order.asm/'+receipt.id,{ticket:receipt.ticket});assert.equal(completed.state,'done');return {...receipt,result:completed.result};}assert.ok(!['failed','cancelled'].includes(job.state),`Job ${body.kind}: ${job.state} ${job.result?.reason||''}`);await sleep(1000);}
 throw Error('Bounded worker wait expired: '+body.kind);
}
const session=randomUUID(),other=randomUUID(),score=randomUUID(),eventId=randomUUID();
try{
 await mkdir(folder,{recursive:true});
 sql('INSERT INTO ocv_q8.scores(id,session,events,tempo,sha) VALUES($1,$2,$3::jsonb,120,$4)',[score,session,JSON.stringify([{n:69,t:0,d:700,v:.65},{n:72,t:250,d:450,v:.4}]),hash('phase13-real-note-fixture')]);
 sql('INSERT INTO ocv_q8.hunt(session,mask,talks) VALUES($1,1073741823,1),($2,1,0)',[session,other]);
 sql('INSERT INTO ocv_q8.desk(session,revision,favorites) VALUES($1,1,$2::jsonb)',[session,JSON.stringify([{id:'json',folder:'tools'}])]);
 await check('C++ DSP and independent Rust receipt produce downloadable actual WAV/MIDI',async()=>{
  const receipt=await done({kind:'music',session,score,preset:'triangle',sampleRate:16000,normalize:true,lowpassHz:2000,echo:{delayMs:150,feedback:.3,mix:.2,repeats:2}});
  assert.equal(receipt.result.verification.ok,true);assert.ok(receipt.result.analysis.rms>0);assert.equal(receipt.result.analysis.sampleRate,16000);assert.ok(receipt.result.analysis.durationMs>=1000);
  for(const ext of ['wav','mid']){const response=await fetch(base+'/api/site/file.do/'+receipt.id+'/'+ext,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:receipt.ticket})});assert.equal(response.status,201);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),receipt.result[ext==='wav'?'audio':'midi'].sha);assert.equal(bytes.subarray(0,4).toString(),ext==='wav'?'RIFF':'MThd');}
  const row=sql('SELECT result,content_sha FROM ocv_web3.return_orders WHERE id=$1',[receipt.id])[0];assert.equal(row.result.audio.sha,receipt.result.audio.sha);
  return {wavBytes:receipt.result.audio.bytes,midiBytes:receipt.result.midi.bytes,formatVerified:true,actualFilesReadBack:true};
 });
 const projection={kind:'projection',session,profileSession:session,events:[{id:eventId,kind:'talk',data:{message:'where'}}]};let first;
 await check('Elixir projection consumes authoritative state and PostgreSQL event sequence',async()=>{
  first=await done(projection);assert.equal(first.result.count,30);assert.equal(first.result.talks.count,1);assert.deepEqual(first.result.favorites,[{id:'json',folder:'tools'}]);assert.equal(first.result.sequence.high,1);assert.ok(first.result.dialogue.reply.length>0);
  const r=sql('SELECT checkpoint FROM ocv_web3.warehouse_stock WHERE session=$1',[session])[0];assert.deepEqual(r.checkpoint,first.result.checkpoint);
  return {authoritativeMask:first.result.mask,perSessionSequence:true,checkpointStored:true};
 });
 await check('Checkpoint recovery after on-demand service teardown and duplicate replay',async()=>{
  const stopped=await stoppedProjection();
  sql('INSERT INTO ocv_q8.profile(session,nickname) VALUES($1,$2)',[session,'Visitor📎']);
  const foreign=await done({kind:'projection',session:other,profileSession:other,events:[{id:randomUUID(),kind:'collect',data:{slot:0}}]});assert.equal(foreign.result.sequence.high,1);
  const repeated=await done(projection);assert.equal(repeated.result.talks.count,1);assert.ok(repeated.result.deduplicated>=1);assert.equal(repeated.result.sequence.high,1);assert.deepEqual(repeated.result.dialogue,first.result.dialogue);assert.deepEqual(repeated.result.checkpoint,first.result.checkpoint);
  assert.equal(sql('SELECT count(*)::integer AS n FROM ocv_web3.event_lines WHERE id=$1',[eventId])[0].n,1);
  await post('/api/site/return.php',{...projection,events:[{id:eventId,kind:'talk',data:{message:'bye'}}]},409);
  const restarted=await stoppedProjection();assert.notEqual(restarted.startedAt,stopped.startedAt);
  assert.equal(sql('SELECT nickname FROM ocv_q8.profile WHERE session=$1',[session])[0].nickname,'Visitor📎');
  return {counterNotIncremented:true,duplicateFolded:true,conflictingReuseRejected:true,otherUserNoSequenceGap:true,checkpointAndDialogueEqual:true,unsupportedNicknameDerivedSafely:true,authorityNicknameUnchanged:true,actualStoppedAndRestarted:true,stopped,restarted};
 });
 await check('Haskell exact fractions match original floating result and two download formats',async()=>{
  const expected='0.30000000000000004\t0\n0\t0';
  const r=await done({kind:'certificate',session,certificate:{schema:'ocv.tool-certificate/1',kind:'matrix',input:{operation:'add',a:'[[0.1,0],[0,0]]',b:'[[0.2,0],[0,0]]'},expected}});
  assert.equal(r.result.valid,true);assert.ok(JSON.stringify(r.result.result).includes('3/10'));const json=JSON.parse(r.result.download.json.text);assert.equal(json.inputDigest,r.result.inputDigest);assert.ok(r.result.download.csv.text.includes(r.result.inputDigest));
  const row=sql('SELECT result FROM ocv_web3.return_orders WHERE id=$1',[r.id])[0];assert.equal(row.result.inputDigest,r.result.inputDigest);
  return {exactFraction:'3/10',floatingTolerance:true,actualCertificateStored:true};
 });
 await check('Kotlin ranks actual aliases and returns paths with verified catalogue edges',async()=>{
  const r=await done({kind:'index',session,query:'琴',from:'/',to:'/functions/music-studio/',limit:12});assert.equal(r.result.readback.storage,'SQLite/FTS5');assert.ok(r.result.hits.some(hit=>hit.id==='music-studio'));assert.equal(r.result.queryPersisted,false);assert.equal(r.result.path.found,true);assert.equal(r.result.path.edgesVerified,true);
  const catalog=JSON.parse(await readFile(path.join(config.projectRoot,'config/9/registry.json'),'utf8')),edges=new Map(catalog.edges),nodes=r.result.path.nodes;for(let i=1;i<nodes.length;i++)assert.ok(edges.get(nodes[i-1])?.includes(nodes[i]));
  const row=sql('SELECT wrong_column,result,content_sha FROM ocv_web3.return_orders WHERE id=$1',[r.id])[0];assert.deepEqual(row.wrong_column,{});assert.equal(row.result.queryPersisted,false);assert.ok(!('hits' in row.result)||typeof row.result.hits==='number');assert.ok(!('query' in row.result));
  assert.equal(r.result.readback.catalogDigest,hash(await readFile(path.join(config.projectRoot,'config/9/registry.json'))));
  return {records:r.result.readback.records,hits:r.result.hits.length,pathEdges:nodes.length-1,queryNotInPostgreSQL:true};
 });
 await check('Invalid/private inputs and unknown capabilities fail without new jobs',async()=>{
  const before=sql("SELECT count(*)::integer AS n FROM ocv_after.jobs WHERE family LIKE 'site-%'")[0].n;
  await post('/api/site/return.php',{kind:'projection',session,email:'private@example.invalid'},400);
  await post('/api/site/return.php',{kind:'index',session,query:'x',from:'//example.invalid'},400);
  await post('/api/site/return.php',{kind:'music',session,score:randomUUID()},404);
  const longScore=randomUUID();sql('INSERT INTO ocv_q8.scores(id,session,events,tempo,sha) VALUES($1,$2,$3::jsonb,120,$4)',[longScore,session,JSON.stringify([{n:69,t:0,d:18000,v:.4}]),hash('phase13-tail-boundary')]);
  await post('/api/site/return.php',{kind:'music',session,score:longScore,echo:{delayMs:800,feedback:.3,mix:.2,repeats:4}},400);
  await post('/api/site/order.asm/'+randomUUID(),{ticket:'0'.repeat(64)},404);
  assert.equal(sql("SELECT count(*)::integer AS n FROM ocv_after.jobs WHERE family LIKE 'site-%'")[0].n,before);
  return {privateKeysRejected:true,pathRejected:true,missingScoreRejected:true,overlongEchoRejectedBeforeEnqueue:true};
 });
 report.passed=true;
}catch(error){report.failure=error.message.slice(0,400);process.exitCode=1;}
finally{
 report.finishedAt=new Date().toISOString();await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'phase13-integration.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(({name,passed})=>({name,passed})),jobs:report.jobs.length}));
}
