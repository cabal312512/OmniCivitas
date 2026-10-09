import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {composeCall} from '../../scripts/docker-child.mjs';
import {testReports} from '../runtime-location.mjs';

const file=testReports+'/phase12-analysis-large.json';
const id=process.env.OCV_SH3_LARGE_JOB;
assert.ok(id,'Set OCV_SH3_LARGE_JOB to a retained mechanical job in this deployment; start the built core and analysis services before this regression proof.');
assert.match(id,/^[a-f0-9-]{36}$/);
await mkdir(testReports,{recursive:true});
const code=String.raw`const {Client}=require('pg');
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,statement_timeout:2000});
try{await c.connect();const id=process.argv[1],row=(await c.query('SELECT source,dataset FROM ocv_shared4.receipts WHERE job_id=$1',[id])).rows[0];
if(!row||row.dataset.kind!=='mechanical')throw Error('The real retained mechanical snapshot is unavailable');
const start=Date.now(),response=await fetch('http://fastapi:8000/shared/analysis.aspx',{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':process.env.OCV_RUNNER_KEY},body:JSON.stringify({schema:'ocv.shared-analysis/1',...row}),signal:AbortSignal.timeout(18000)}),out=await response.json();
if(!response.ok)throw Error(out.detail);
if(out.cacheHit)throw Error('This proof requires actual first computation, not a derived cache hit');
if(out.query.threads!==1||out.query.memoryLimit!=='32MB'||out.query.deadlineSeconds!==15||out.query.ingestMode!=='bounded-json-batches')throw Error('The numerical resource contract changed');
const frames=row.dataset.result.frames,expected=frames.reduce((n,frame)=>n+frame.bodies.length*7,0);
if(expected!==out.query.inputRows||expected!==out.query.acceptedRows)throw Error('Source cells were lost');
const hashes=out.artifacts.every(a=>require('crypto').createHash('sha256').update(a.content).digest('hex')===a.sha256);
if(!hashes)throw Error('Derived artifact checksum mismatch');
console.log(JSON.stringify({schema:'ocv.sh3-large-proof/1',passed:true,job:id,checks:[{name:'Actual retained mechanical result processed within unchanged query bounds; all source cells and artifact hashes preserved',passed:true}],elapsedMs:Date.now()-start,sourceDigest:row.source.digest,sourceFrames:frames.length,sourceParts:frames[0].bodies.length,normalizedRows:out.query.inputRows,statistics:out.statistics.length,query:out.query,cacheHit:false,artifactReadback:true,canonicalFailedJobRewritten:false,finishedAt:new Date().toISOString()}));
}finally{await c.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});`;
try{
 const previous=await readFile(file);
 await writeFile(file.replace('.json','-before-'+Date.now()+'.json'),previous,{flag:'wx'});
}catch(error){if(error.code!=='ENOENT')throw error}
try{
 const output=composeCall(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',code,id]);
 const report=JSON.parse(output.stdout);
 await writeFile(file,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,rows:report.normalizedRows,elapsedMs:report.elapsedMs}));
}catch(error){
 await writeFile(file,JSON.stringify({schema:'ocv.sh3-large-proof/1',passed:false,job:id,error:String(error.message).slice(-600),finishedAt:new Date().toISOString()},null,2));
 throw error;
}
