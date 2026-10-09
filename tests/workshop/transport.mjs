import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const base=new URL(process.env.OCV_WORKSHOP_BASE_URL||`http://localhost:${process.env.OCV_WEB_PORT||8080}`);
if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Use an HTTP entrance without credentials');
const reportFile=join(testDeps,'runtime/reports/workshop-transport.json');
const report={schema:'ocv.workshop/transport-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[]};
// Invalid objects exercise the actual entrance/parser boundary without creating jobs or sending capabilities.
function body(bytes){return '{"padding":"'+'x'.repeat(bytes-14)+'"}';}
const cases=[
 ['Workshop result above the old 16 KiB entrance cap reaches private authorization','/api/workshop/internal',2*1024*1024,404],
 ['Workshop public request above 16 KiB reaches domain validation','/api/workshop/projects',64*1024,400],
 ['Workshop public request remains bounded at 160 KiB','/api/workshop/projects',161*1024,413],
 ['Workshop private result remains bounded at 6 MiB','/api/workshop/internal',6*1024*1024+1024,413],
 ['Signals private result still reaches authorization','/api/signals/internal',2*1024*1024,404],
 ['Signals public request remains bounded at 96 KiB','/api/signals/jobs',97*1024,413],
 ['Unrelated public APIs keep the small global limit','/api/a1/receipt.cgi',32*1024,413],
];
try{
 for(const[name,path,bytes,expected]of cases){
  const raw=body(bytes);assert.equal(Buffer.byteLength(raw),bytes);
  const response=await fetch(new URL(path,base),{method:'POST',headers:{'content-type':'application/json'},body:raw,signal:AbortSignal.timeout(12000)});
  const text=await response.text();assert.ok(text.length<16384,'Unexpectedly large error response');
  const evidence={name,path,requestBytes:bytes,status:response.status,expected,passed:response.status===expected};
  report.checks.push(evidence);assert.equal(response.status,expected,`${name}: HTTP ${response.status}`);
 }
 report.passed=true;
}finally{
 report.finishedAt=new Date().toISOString();await mkdir(join(reportFile,'..'),{recursive:true});await writeFile(reportFile,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,file:reportFile}));
}
