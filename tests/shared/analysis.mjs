import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {docker,composeArguments,dockerEnvironment} from '../../scripts/docker-child.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const deps=testDeps;
const reportFile=join(deps,'runtime/reports/phase12-analysis.json');
const report={schema:'ocv.sh3/numerical-proof/1',startedAt:new Date().toISOString(),passed:false,
  checks:[],calls:[],maximumCalls:6,parallelCalls:1,ownedReceipts:[],privateCapabilitiesPrinted:false,
  sourceCellLimitBoundaryExercised:false,nativeKernelsExercised:false,maximumRetentionExercised:false};
const hash=value=>createHash('sha256').update(value).digest('hex');
const near=(actual,expected,name)=>{assert.ok(Number.isFinite(actual),`${name} must be finite`);assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${name}: expected ${expected}, received ${actual}`)};

// Credentials stay inside the already-running private worker. The fixed read-only SQL
// below inspects only this harness's receipt; no SQL is sent through the HTTP contract.
const transport=String.raw`
import hashlib,json,os,sqlite3,sys,zlib
from http.client import HTTPConnection

try:
    call=json.load(sys.stdin)
    key=os.environ.get('OCV_RUNNER_KEY','')
    if not key:
        raise RuntimeError('Private worker credential is not configured')
    supplied=key[:-1]+('1' if key[-1]=='0' else '0') if call.get('wrongCredential') else key
    payload=json.dumps(call['payload'],ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf8')
    if len(payload)>16384:
        raise RuntimeError('This small fixture exceeds its private transport limit')
    connection=HTTPConnection('127.0.0.1',8000,timeout=25)
    try:
        connection.request('POST','/shared/analysis.aspx',payload,{'Content-Type':'application/json','X-Ocv-Runner':supplied})
        response=connection.getresponse()
        raw=response.read(4194305)
        if len(raw)>4194304:
            raise RuntimeError('The private response exceeds its transport limit')
        result={'status':response.status,'body':json.loads(raw)}
    finally:
        connection.close()
    if result['status']==200 and call.get('inspectReceipt'):
        import duckdb
        body=result['body']
        with sqlite3.connect('file:/ocv-data/redis.sqlite?mode=ro',uri=True,timeout=2) as database:
            row=database.execute('SELECT id,root_id,source_digest,invoice_digest,decoration,price,product_name FROM sh3_current_orders WHERE id=? AND root_id=? AND source_digest=?',
                                 (body['id'],body['source']['runId'],body['sourceDigest'])).fetchone()
        if row is None or not isinstance(row[4],bytes) or len(row[4])>262144 or not 0<row[5]<=2097152:
            raise RuntimeError('A bounded joined SQLite receipt was not found')
        inflater=zlib.decompressobj()
        decoded=inflater.decompress(row[4],2097153)
        if not inflater.eof or inflater.unused_data or inflater.unconsumed_tail or len(decoded)!=row[5]:
            raise RuntimeError('The joined SQLite receipt has an invalid decoded size')
        declaration=json.loads(row[6])
        payload_sha=hashlib.sha256(decoded).hexdigest()
        stored=json.loads(decoded)
        if declaration.get('sha256')!=payload_sha or declaration.get('bytes')!=len(decoded) or stored.get('fingerprint')!=row[3] or stored.get('id')!=row[0]:
            raise RuntimeError('The joined SQLite receipt changed identity or bytes')
        result['receipt']={'storage':'SQLite redis.sqlite','view':'sh3_current_orders','tables':3,
                           'id':row[0],'runId':row[1],'sourceDigest':row[2],'fingerprint':row[3],
                           'compressedBytes':len(row[4]),'decodedBytes':len(decoded),'payloadSha256':payload_sha,
                           'declarationVerified':True,'duckdbVersion':duckdb.__version__,'sqliteVersion':sqlite3.sqlite_version}
    print(json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(',',':')))
except Exception:
    print(json.dumps({'transportError':'The bounded private HTTP/receipt transport failed; check the running worker and its configuration'}))
    sys.exit(1)
`;

function call(name,payload,{wrongCredential=false,inspectReceipt=false}={}){
  assert.ok(report.calls.length<report.maximumCalls,'At most six sequential private HTTP calls');
  const started=Date.now();
  const args=composeArguments(['exec','-T','fastapi','python','-c',transport]);
  const result=spawnSync(docker,args,{cwd:root,input:JSON.stringify({payload,wrongCredential,inspectReceipt}),encoding:'utf8',timeout:35000,maxBuffer:5*1024*1024,
    env:dockerEnvironment()});
  const entry={name,elapsedMs:Date.now()-started,status:null};report.calls.push(entry);
  if(result.error||result.status!==0)throw Error('The private SH3 transport did not complete; no worker credentials are printed');
  let value;try{value=JSON.parse(result.stdout)}catch{throw Error('The private SH3 transport did not return bounded JSON')}
  if(value.transportError)throw Error(value.transportError);
  entry.status=value.status;return value;
}

async function check(name,fn){
  const started=Date.now();try{const evidence=await fn();report.checks.push({name,passed:true,elapsedMs:Date.now()-started,...evidence})}
  catch(error){report.checks.push({name,passed:false,elapsedMs:Date.now()-started,error:String(error.message).slice(0,300)});throw error}
}

function csv(content){
  const rows=[];let row=[],cell='',quoted=false;
  for(let index=0;index<content.length;index++){
    const char=content[index];
    if(quoted){if(char==='"'&&content[index+1]==='"'){cell+='"';index++}else if(char==='"')quoted=false;else cell+=char}
    else if(char==='"'){assert.equal(cell,'','CSV quoted cells start at a boundary');quoted=true}
    else if(char===','){row.push(cell);cell=''}
    else if(char==='\n'){row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=char;
  }
  assert.equal(quoted,false,'CSV quote pairs must close');
  if(cell||row.length){row.push(cell);rows.push(row)}
  const fields=rows.shift()||[];for(const values of rows)assert.equal(values.length,fields.length,'CSV rows match the header');
  return {fields,rows:rows.map(values=>Object.fromEntries(fields.map((field,index)=>[field,values[index]])))};
}

function artifacts(body){
  const seen=new Map();assert.ok(body.artifacts.length>=5&&body.artifacts.length<=6,'Fixed bounded artifact registry');
  for(const artifact of body.artifacts){
    assert.ok(!seen.has(artifact.name),'Artifact names are unique');seen.set(artifact.name,artifact);
    assert.equal(artifact.encoding,'utf-8');assert.equal(Buffer.byteLength(artifact.content),artifact.bytes,'UTF-8 artifact byte count');
    assert.equal(hash(artifact.content),artifact.sha256,'Independent artifact SHA-256');assert.match(artifact.sha256,/^[0-9a-f]{64}$/);
    assert.ok(artifact.bytes<=1048576,'Per-artifact size bound');
    if(artifact.mime==='image/svg+xml'){assert.match(artifact.content,/^<svg\s/);assert.ok(!/<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(artifact.content),'SVG contains no executable or external-resource nodes');assert.ok(!/NaN|Infinity/.test(artifact.content),'Chart coordinates remain finite')}
  }
  assert.deepEqual([...seen.keys()].sort(),['analysis.json','analysis.svg','heatmap.svg','samples.csv','statistics.csv',...(body.comparison?['comparison.csv']:[])].sort());
  const embedded=JSON.parse(seen.get('analysis.json').content);assert.equal(embedded.sourceDigest,body.sourceDigest);
  assert.deepEqual(embedded.statistics,body.statistics);assert.ok(!('artifacts'in embedded)&&!('audit'in embedded),'JSON artifact avoids recursive embedding');
  return seen;
}

function receipt(value,body){
  const physical=value.receipt;assert.ok(physical,'The test reads the actual joined private SQLite receipt');
  assert.equal(physical.storage,'SQLite redis.sqlite');assert.equal(physical.view,'sh3_current_orders');assert.equal(physical.tables,3);
  assert.equal(physical.declarationVerified,true);assert.match(physical.duckdbVersion,/^\d+\.\d+/);assert.match(physical.sqliteVersion,/^\d+\.\d+/);
  for(const key of ['id','sourceDigest','fingerprint'])assert.equal(physical[key],body[key]);
  assert.equal(physical.runId,body.source.runId);assert.equal(physical.payloadSha256,body.audit.payloadSha256);
  assert.equal(physical.decodedBytes,body.audit.decodedBytes);assert.equal(physical.compressedBytes,body.audit.compressedBytes);
  assert.ok(physical.decodedBytes<=2097152&&physical.compressedBytes<=262144);
  return physical;
}

function contract(body,source){
  assert.equal(body.ok,true);assert.equal(body.schema,'ocv.shared-analysis-result/1');assert.equal(body.engine,'SH3/python-duckdb');
  assert.equal(body.source.runId,source.runId);assert.equal(body.sourceDigest,source.digest);assert.equal(body.nativeResultReplaced,false);
  assert.equal(body.audit.readbackVerified,true);assert.equal(body.audit.tables,3);assert.equal(body.audit.retention,64);
  assert.equal(body.query.threads,1);assert.equal(body.query.memoryLimit,'32MB');assert.equal(body.query.externalAccess,false);assert.equal(body.query.temporaryDiskBytes,0);
  assert.ok(body.query.statementCount>0);assert.equal(body.query.statementDigests.length,body.query.statementCount);
  for(const digest of body.query.statementDigests)assert.match(digest,/^[0-9a-f]{64}$/);
  assert.equal(body.dataset.originalSamples,4);assert.equal(body.dataset.selectedSamples,4);assert.equal(body.dataset.sampled,false);
  assert.deepEqual(body.dataset.selectedIndices,[0,1,2,3]);assert.equal(body.dataset.normalizedRows,10);assert.equal(body.dataset.missingNumericCells,2);
  assert.ok(body.options.groupBy.includes('quantity')&&body.options.groupBy.includes('unit')&&body.options.groupBy.includes('axisUnit'),'Dimensions and physical units are mandatory partitions');
}

const label='=1+1 <script>Δ</script>';
const dataset={kind:'table',submitted:true,columns:[{name:'label',numeric:false},{name:'t',unit:'s'},{name:'u',unit:'V'},{name:'i',unit:'A'}],
  rows:[{label,t:0,u:1,i:10},{label,t:1,u:2,i:null},{label,t:2,u:3,i:30},{label,t:3,u:null,i:40}]};
const options={entityField:'label',axisField:'t',filters:[{field:'quantity',op:'in',value:['u','i']}],groupBy:['entity'],rolling:2,difference:true,
  maxRows:16,maxSeries:8,histogramBins:4,timeBins:4,chartKind:'line'};
const make=(purpose,extra={})=>({schema:'ocv.shared-analysis/1',source:{runId:randomUUID(),digest:hash('test-owned-sh3-'+purpose)},dataset:structuredClone(dataset),options:structuredClone(options),...extra});
let first,firstEnvelope,firstPhysical;

try{
  await check('Known sparse table has exact finite statistics and a zero equal comparison',()=>{
    firstEnvelope=make('sparse-equal',{comparison:structuredClone(dataset)});
    const value=call('sparse-equal',firstEnvelope,{inspectReceipt:true});assert.equal(value.status,200);first=value.body;
    contract(first,firstEnvelope.source);assert.equal(first.cacheHit,false);firstPhysical=receipt(value,first);
    assert.equal(first.query.inputRows,10);assert.equal(first.query.acceptedRows,6);assert.equal(first.query.returnedRows,6);assert.equal(first.query.recordsClipped,false);
    assert.equal(first.statistics.length,2);assert.equal(first.statisticsMeta.totalGroups,2);assert.equal(first.statisticsMeta.clipped,false);
    const u=first.statistics.find(row=>row.quantity==='u'),i=first.statistics.find(row=>row.quantity==='i');
    assert.equal(u.unit,'V');assert.equal(i.unit,'A');assert.equal(u.axisUnit,'s');assert.equal(i.axisUnit,'s');
    for(const row of first.statistics){assert.equal(row.count,3);assert.equal(row.entity,label);for(const name of ['min','max','mean','stddev','median','p05','p95','rms'])assert.ok(Number.isFinite(row[name]),`Finite ${name}`)}
    near(u.mean,2,'voltage mean');near(u.median,2,'voltage median');near(u.stddev,1,'voltage sample deviation');near(u.rms,Math.sqrt(14/3),'voltage RMS');
    near(i.mean,80/3,'current mean');near(i.median,30,'current median');near(i.rms,Math.sqrt(2600/3),'current RMS');
    assert.equal(first.comparison.matchedRows,6);assert.equal(first.comparison.unmatchedLeft,0);assert.equal(first.comparison.unmatchedRight,0);assert.equal(first.comparison.interpolatedRows,0);
    for(const row of first.comparison.groups){near(row.bias,0,'equal bias');near(row.rmse,0,'equal RMS discrepancy');near(row.maxAbsoluteError,0,'equal maximum discrepancy');near(row.correlation,1,'equal correlation')}
    const projected=first.series.find(row=>row.quantity==='i');assert.deepEqual(projected.points,[[0,10,10,null],[2,30,20,20],[3,40,35,10]]);
    assert.equal(projected.selectedPoints,3);assert.equal(projected.count,3);assert.match(projected.differenceMeaning,/not a derivative/);
    assert.deepEqual(first.records.filter(row=>row.quantity==='i').map(row=>row.axis),[0,2,3]);assert.deepEqual(first.records.filter(row=>row.quantity==='u').map(row=>row.axis),[0,1,2]);
    for(const family of [first.histogram,first.heatmap]){assert.equal(family.length,2);for(const lane of family){assert.equal(lane.bins.reduce((sum,bin)=>sum+bin.count,0),3);assert.ok(lane.bins.every(bin=>bin.count>0),'No manufactured empty bins');assert.equal(lane.bins.length,3)}}
    const files=artifacts(first),samples=csv(files.get('samples.csv').content);assert.equal(samples.rows.length,6);assert.ok(samples.rows.every(row=>row.entity==="'"+label),'Spreadsheet-formula text is escaped');
    assert.ok(files.get('analysis.svg').content.includes('&lt;script&gt;Δ&lt;/script&gt;'),'SVG labels are escaped without corrupting Unicode');
    report.ownedReceipts.push({runId:first.source.runId,id:first.id,sourceDigest:first.sourceDigest});
    return {acceptedCells:6,missingCells:2,mean:{volts:u.mean,amps:i.mean},rms:{volts:u.rms,amps:i.rms},equalMatched:6,artifactHashes:files.size,
      duckdbVersion:firstPhysical.duckdbVersion,sqliteVersion:firstPhysical.sqliteVersion,joinedPayloadSha256:firstPhysical.payloadSha256};
  });
  await check('Read by run and source digest returns the same SHA-verified joined receipt',()=>{
    const value=call('receipt-read',{action:'read',runId:first.source.runId,digest:first.sourceDigest},{inspectReceipt:true});assert.equal(value.status,200);
    const body=value.body;contract(body,firstEnvelope.source);assert.equal(body.cacheHit,true);assert.equal(body.id,first.id);assert.equal(body.fingerprint,first.fingerprint);
    assert.deepEqual(body.statistics,first.statistics);assert.deepEqual(body.series,first.series);assert.deepEqual(body.artifacts,first.artifacts);
    const physical=receipt(value,body);assert.equal(physical.payloadSha256,firstPhysical.payloadSha256);assert.equal(physical.decodedBytes,firstPhysical.decodedBytes);artifacts(body);
    return {cacheHit:true,id:body.id,payloadSha256:physical.payloadSha256,physicalJoinReadback:true};
  });
  await check('Changed paired samples compare exactly, reject unit mixing and disclose records clipping',()=>{
    const comparison=structuredClone(dataset);comparison.rows[2].u=6;comparison.columns.find(column=>column.name==='i').unit='V';
    const envelope=make('changed-units',{comparison,options:{...structuredClone(options),maxRows:2,maxSeries:2}});
    const value=call('changed-units',envelope);assert.equal(value.status,200);const body=value.body;contract(body,envelope.source);
    assert.equal(body.query.acceptedRows,6);assert.equal(body.query.returnedRows,2);assert.equal(body.records.length,2);assert.equal(body.query.recordsClipped,true);
    assert.equal(body.statistics.length,2);assert.equal(body.statisticsMeta.totalGroups,2);assert.equal(body.statisticsMeta.clipped,false);assert.ok(body.statistics.every(row=>row.count===3),'Clipping the displayed records does not clip statistical inputs');
    assert.equal(body.comparison.matchedRows,3);assert.equal(body.comparison.unmatchedLeft,3);assert.equal(body.comparison.unmatchedRight,3);assert.equal(body.comparison.interpolatedRows,0);
    assert.equal(body.comparison.groups.length,1);const changed=body.comparison.groups[0];assert.equal(changed.quantity,'u');assert.equal(changed.unit,'V');assert.equal(changed.axisUnit,'s');
    near(changed.bias,1,'changed voltage bias');near(changed.rmse,Math.sqrt(3),'changed voltage RMS discrepancy');near(changed.maxAbsoluteError,3,'changed voltage maximum discrepancy');
    assert.deepEqual(body.statistics.map(row=>row.unit).sort(),['A','V']);assert.ok(body.series.every(row=>row.count===3&&row.selectedPoints===3));
    assert.equal(csv(artifacts(body).get('samples.csv').content).rows.length,2);
    report.ownedReceipts.push({runId:body.source.runId,id:body.id,sourceDigest:body.sourceDigest});
    return {acceptedCells:6,returnedCells:2,recordsClipped:true,matched:3,unmatchedLeft:3,unmatchedRight:3,bias:changed.bias,rmse:changed.rmse,interpolatedRows:0};
  });
  await check('An empty accepted subset exports honest empty charts and header-only samples',()=>{
    const envelope=make('empty-filter',{options:{...structuredClone(options),filters:[...options.filters,{field:'value',op:'gt',value:1000}]}});
    const value=call('empty-filter',envelope);assert.equal(value.status,200);const body=value.body;contract(body,envelope.source);
    assert.equal(body.query.acceptedRows,0);assert.equal(body.query.returnedRows,0);assert.equal(body.query.recordsClipped,false);
    for(const name of ['records','statistics','series','histogram','heatmap'])assert.deepEqual(body[name],[],`Empty ${name} remains empty`);
    assert.equal(body.statisticsMeta.totalGroups,0);assert.equal(body.comparison,null);
    const files=artifacts(body);assert.equal(csv(files.get('samples.csv').content).rows.length,0);assert.equal(csv(files.get('statistics.csv').content).rows.length,0);
    assert.ok(files.get('analysis.svg').content.includes('No rows match the selected filters.'));assert.ok(!files.get('heatmap.svg').content.includes('/ n='),'Empty heatmap has no fabricated occupied cells');
    report.ownedReceipts.push({runId:body.source.runId,id:body.id,sourceDigest:body.sourceDigest});
    return {sourceNumericCells:10,acceptedCells:0,exportedSamples:0,emptyCharts:true};
  });
  await check('A private worker call with a wrong credential is rejected',()=>{
    const value=call('wrong-worker-credential',firstEnvelope,{wrongCredential:true});assert.equal(value.status,403);assert.match(String(value.body.detail),/worker credential/);
    return {http:403,credentialValuePrinted:false};
  });
  await check('Account-shaped fields are rejected by the closed source contract',()=>{
    const envelope=make('forbidden-account-field');envelope.source.email='forbidden';
    const value=call('forbidden-account-field',envelope);assert.equal(value.status,409);assert.match(String(value.body.detail),/Unknown analysis source fields/);
    assert.ok(!String(value.body.detail).includes('forbidden'),'The rejected field value is not reflected');
    return {http:409,syntheticUnknownFieldRejected:true,retentionAbsenceIndependentlyChecked:false};
  });
  assert.equal(report.calls.length,6);report.passed=true;
}catch(error){report.error=String(error.message).slice(0,400);process.exitCode=1}
finally{
  report.finishedAt=new Date().toISOString();report.totalCalls=report.calls.length;
  await mkdir(dirname(reportFile),{recursive:true});
  const previous=join(dirname(reportFile),'phase12-analysis-before-'+report.startedAt.replace(/[:.]/g,'-')+'.json');
  try{await copyFile(reportFile,previous,constants.COPYFILE_EXCL)}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error}
  await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,calls:report.calls.length,file:reportFile}));
}
