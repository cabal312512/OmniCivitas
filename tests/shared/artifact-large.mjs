import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { composeCall } from '../../scripts/docker-child.mjs';

const deps = path.resolve(testDeps);
const folder = path.join(deps, 'runtime', 'reports');
const file = path.join(folder, 'phase12-artifact-large.json');
const id = process.env.OCV_SH4_LARGE_JOB;
assert.ok(id, 'Set OCV_SH4_LARGE_JOB to a retained failed mechanical job with completed native and analysis receipts in this deployment; enable the already built artifact adapters before this regression proof.');
assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
await mkdir(folder, { recursive: true });
const report = { schema: 'ocv.sh4-large-proof/1', passed: false, job: id,
  startedAt: new Date().toISOString(), checks: [], errors: [],
  scope: 'Retained successful native result and existing SH3 analysis; actual Ruby/C# private adapters; no new job, SH3 query, object publication or canonical rewrite.' };
const code = String.raw`const assert=require('node:assert/strict'),{Client}=require('pg'),{createHash}=require('node:crypto'),{inflateRawSync}=require('node:zlib');
const sha=value=>createHash('sha256').update(value).digest('hex');
function zip(bytes){
 const entries=new Map();let end=-1;
 for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(bytes.readUInt32LE(at)===0x06054b50){end=at;break;}
 assert.ok(end>=0,'ZIP end record missing');assert.equal(bytes.readUInt16LE(end+4),0);assert.equal(bytes.readUInt16LE(end+6),0);
 const count=bytes.readUInt16LE(end+10);assert.equal(bytes.readUInt16LE(end+8),count);assert.ok(count>0&&count<=24);
 let cursor=bytes.readUInt32LE(end+16),total=0;const centralEnd=cursor+bytes.readUInt32LE(end+12);assert.equal(centralEnd,end);
 for(let n=0;n<count;n++){
  assert.ok(cursor+46<=centralEnd);assert.equal(bytes.readUInt32LE(cursor),0x02014b50);
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),names=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
  assert.equal(flags&1,0);assert.ok(method===0||method===8);assert.ok(size<=8388608&&compressed<=3145728);
  assert.ok(cursor+46+names+extra+comment<=centralEnd);
  const name=bytes.subarray(cursor+46,cursor+46+names).toString('utf8');assert.ok(name&&!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..')&&!/[\x00-\x1f]/.test(name));assert.ok(!entries.has(name));
  assert.ok(local+30<=bytes.length);assert.equal(bytes.readUInt32LE(local),0x04034b50);assert.equal(bytes.readUInt16LE(local+8),method);
  const localNames=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28);assert.equal(bytes.subarray(local+30,local+30+localNames).toString('utf8'),name);
  const start=local+30+localNames+localExtra;assert.ok(start+compressed<=bytes.readUInt32LE(end+16));
  const packed=bytes.subarray(start,start+compressed),raw=method===0?packed:inflateRawSync(packed,{maxOutputLength:8388608});
  assert.equal(raw.length,size);total+=raw.length;assert.ok(total<=8388608);entries.set(name,raw);cursor+=46+names+extra+comment;
 }
 assert.equal(cursor,centralEnd);return{entries,unpackedBytes:total};
}
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:2000,statement_timeout:3000});
 try{
  await c.connect();const id=process.argv[1];
  const snapshot=async()=>{const value=(await c.query('SELECT j.state,j.phase,j.family,j.digest,to_jsonb(j)::text AS job_text,to_jsonb(r)::text AS receipt_text,r.source,r.dataset,r.version,r.analysis FROM ocv_after.jobs j JOIN ocv_shared4.receipts r ON r.job_id=j.id WHERE j.id=$1',[id])).rows[0];assert.ok(value,'Retained actual receipt missing');return value;};
  const before=await snapshot();assert.equal(before.state,'failed');assert.equal(before.family,'mechanical');assert.equal(before.dataset.kind,'mechanical');assert.equal(before.dataset.result.ok,true);
  assert.ok(before.version&&before.analysis?.ok,'Existing retained version and SH3 analysis are required; do not rerun SH3');
  assert.equal(before.analysis.sourceDigest,before.source.digest);assert.equal(before.source.digest,before.digest);assert.equal(before.analysis.source.runId,before.source.runId);
  const key=process.env.OCV_RUNNER_KEY;if(!/^[a-f0-9]{64}$/.test(key||''))throw Error('A valid private worker credential is required');
  async function post(url,value){const body=JSON.stringify(value);assert.ok(Buffer.byteLength(body)<=8388608);const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Ocv-Runner':key},body,signal:AbortSignal.timeout(24000)});const raw=await response.text();assert.ok(Buffer.byteLength(raw)<=6291456,'Private response budget');const result=JSON.parse(raw);assert.equal(response.status,200,result.successReason||'Private adapter failed');assert.equal(result.ok,true);return{raw,result};}
  const started=Date.now();const ruby=await post('http://sinatra:8004/shared/template.cgi',{contract:'ocv.shared-artifact/1',job:id,sourceDigest:before.source.digest,kind:before.dataset.kind,statistics:before.analysis.statistics||[]});
  const compatibility=ruby.result,rawBytes=Buffer.byteLength(ruby.raw);
  assert.equal(compatibility.contract,'ocv.shared-artifact/1');assert.equal(compatibility.sourceDigest,before.source.digest);assert.equal(compatibility.job,id);assert.ok(rawBytes>65536&&rawBytes<=131072,'This regression requires a real large but valid 128 KiB Ruby receipt');
  assert.equal(Buffer.byteLength(compatibility.html),compatibility.bytes);assert.equal(sha(compatibility.html),compatibility.sha256);assert.equal(Buffer.byteLength(compatibility.legacy.csv),compatibility.legacy.bytes);assert.equal(sha(compatibility.legacy.csv),compatibility.legacy.sha256);assert.equal(compatibility.legacy.roundtripVerified,true);
  const generated=await post('http://dotnet:8003/shared/bundle.asmx',{contract:'ocv.shared-artifact/1',job:id,source:before.source,dataset:before.dataset,analysis:before.analysis,version:before.version,compatibility});
  const bundle=generated.result;assert.equal(bundle.contract,'ocv.shared-artifact/1');assert.equal(bundle.job,id);assert.equal(bundle.sourceDigest,before.source.digest);assert.equal(bundle.statistics.readbackVerified,true);
  const archive=Buffer.from(bundle.archive.base64,'base64');assert.ok(archive.length>0&&archive.length<=3145728);assert.equal(archive.length,bundle.archive.bytes);assert.equal(sha(archive),bundle.archive.sha256);
  const{entries,unpackedBytes}=zip(archive),manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
  assert.deepEqual(manifest,bundle.manifest);assert.equal(manifest.schema,'ocv.shared-manifest/1');assert.equal(manifest.job,id);assert.equal(manifest.kind,'mechanical');assert.equal(manifest.source.digest,before.source.digest);assert.equal(manifest.sourceDigest,before.source.digest);assert.equal(entries.size,manifest.files.length+1);assert.equal(bundle.statistics.fileCount,entries.size);assert.equal(bundle.statistics.unpackedBytes,unpackedBytes);
  const names=new Set();for(const entry of manifest.files){assert.ok(!names.has(entry.name));names.add(entry.name);const bytes=entries.get(entry.name);assert.ok(bytes,'Manifest entry missing');assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);}
  assert.deepEqual(JSON.parse(entries.get('results.json').toString('utf8')),before.dataset.result,'The actual native result must be preserved');
  assert.deepEqual(JSON.parse(entries.get('source.json').toString('utf8')).request,before.dataset.request);assert.deepEqual(JSON.parse(entries.get('version.json').toString('utf8')),before.version);
  const escaped=entries.get('compatibility.json');assert.deepEqual(JSON.parse(escaped.toString('utf8')),compatibility);assert.ok(escaped.length>131072,'The canonical escaped representation must reproduce the former false rejection');
  for(const artifact of before.analysis.artifacts){const bytes=entries.get('analysis/'+artifact.name);assert.ok(bytes);assert.equal(bytes.length,artifact.bytes);assert.equal(sha(bytes),artifact.sha256);assert.equal(bytes.toString('utf8'),artifact.content);}
  const attested=(await post('http://sinatra:8004/shared/template.cgi',{contract:'ocv.shared-artifact/1',job:id,sourceDigest:before.source.digest,kind:'mechanical',statistics:before.analysis.statistics||[],manifest})).result;
  assert.equal(attested.manifestAttestation.ok,true);assert.equal(attested.manifestAttestation.files,manifest.files.length);
  const after=await snapshot();assert.equal(after.job_text,before.job_text);assert.equal(after.receipt_text,before.receipt_text);assert.equal(after.state,'failed');
  console.log(JSON.stringify({passed:true,elapsedMs:Date.now()-started,job:id,canonicalState:after.state,canonicalPhase:after.phase,canonicalFailedJobUnchanged:true,canonicalReceiptUnchanged:true,canonicalJobSha256:sha(before.job_text),canonicalReceiptSha256:sha(before.receipt_text),sourceDigest:before.source.digest,sourceFrames:before.dataset.result.frames.length,sourceBodies:before.dataset.result.frames[0].bodies.length,statistics:before.analysis.statistics.length,compatibilityRawBytes:rawBytes,compatibilityCanonicalBytes:escaped.length,compatibilityRawSha256:sha(ruby.raw),archiveBytes:archive.length,archiveSha256:sha(archive),unpackedBytes,files:manifest.files.map(entry=>({name:entry.name,bytes:entry.bytes,sha256:entry.sha256})),manifestAttestation:true,actualNativeResultPreserved:true,artifactReadback:true,sh3Rerun:false,checks:[{name:'Actual large Ruby UTF-8 receipt remains below its unchanged 128 KiB input budget',passed:true},{name:'C# accepts that receipt even when canonical JSON escaping exceeds 128 KiB',passed:true},{name:'Actual ZIP central/local paths and bounded decompression independently verified',passed:true},{name:'All manifest entry sizes and SHA256 checksums verified against actual bytes',passed:true},{name:'Retained native source/result/version and SH3 artifacts preserved',passed:true},{name:'Ruby attests the actual generated manifest',passed:true},{name:'Canonical failed job and retained receipt remain byte-identical',passed:true}]}));
 }finally{await c.end();}
})().catch(error=>{console.error(String(error.message).slice(0,500));process.exitCode=1;});`;

try {
  try { await writeFile(file.replace('.json', '-before-' + Date.now() + '.json'), await readFile(file), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const latestWorker = path.join(deps, 'runtime', 'after-runner', 'latest-report.json');
  const preservedWorker = path.join(folder, 'phase12-artifact-large-worker-failure-' + id + '.json');
  try {
    const bytes = await readFile(latestWorker), previous = JSON.parse(bytes);
    if (previous.failed?.some(row => row.id === id)) {
      try { await writeFile(preservedWorker, bytes, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      report.preservedWorkerFailure = path.basename(preservedWorker);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  report.packaging = { buildRun: false, imageMutation: false, startsServices: false, preexistingAdaptersRequired: true };
  const output = composeCall(['exec', '-T', '-w', '/workspace/services/gateway', 'gateway', 'node', '--max-old-space-size=96', '-e', code, id]);
  Object.assign(report, JSON.parse(output.stdout));
} catch (error) {
  report.passed = false;
  report.errors.push(String(error.message).slice(-600));
} finally {
  report.servicesStarted = false;
  report.servicesStopped = false;
  report.finishedAt = new Date().toISOString();
  await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, compatibilityRawBytes: report.compatibilityRawBytes, compatibilityCanonicalBytes: report.compatibilityCanonicalBytes, archiveBytes: report.archiveBytes, canonicalFailedJobUnchanged: report.canonicalFailedJobUnchanged, errors: report.errors }));
  if (!report.passed) process.exitCode = 1;
}
