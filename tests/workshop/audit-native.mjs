import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {dockerCall} from '../../scripts/docker-child.mjs';
import {verificationConfig} from '../../scripts/verification-config.mjs';
import {wasmRunner} from './wasm.mjs';
const cfg=verificationConfig(),reportRoot=cfg.reportRoot,run=await wasmRunner('config/apps/portal/public/workshop/engines/mechanics.wasm'),checks=[],name='ocv-audit-five-mechanics',scratch=path.join(cfg.depsRoot,'tmp','audit-five-replay-check');
const request={schema:'ocv.workshop-run/1',op:'simulate',world:{gravityX:0,gravityY:0,durationS:.1,stepS:1/60,sampleEvery:1,seed:1,bodies:[{id:'ball',kind:'ball',y:2,vx:10,linearDamping:50,angularDamping:0}]}};
const generatedReplay=path.join(reportRoot,'audit-five-generated-mechanical-replay.json');
dockerCall(['run','-d','--pull=never','--name',name,'--memory=128m','--memory-swap=128m','--cpus=1','--pids-limit=64','omnicivitas/mechanics-native:stage11']);
try{
 const native=JSON.parse(dockerCall(['exec','-i',name,'/opt/ocv/ocv-mechanics'],{input:JSON.stringify(request),timeout:30000,maxBuffer:4194304}).stdout),wasm=run(request);
 assert.equal(native.ok,true);assert.deepEqual(wasm,native);assert.match(native.version,/1\.1\.1\+/);const measured=Math.max(...native.frames.flatMap(f=>f.bodies.map(b=>Math.hypot(b.vx,b.vy))));assert.equal(measured,10);assert.equal(native.summary.maxSpeed,measured);
 await writeFile(generatedReplay,JSON.stringify({schema:'ocv.workshop-replay/1',units:'SI',project:{schema:'ocv.workshop-project/1',name:'Initial-speed regression',world:request.world},request,result:native}));
 await writeFile(path.join(reportRoot,'audit-five-initial-speed-after.json'),JSON.stringify({request,result:native,recordedMax:measured,nativeWasmExactOnThisHost:true},null,2));checks.push({name:'Initial speed is included in maximum statistic; native and Wasm agree on this host',passed:true});
}finally{dockerCall(['rm','-f',name]);}
await mkdir(path.join(scratch,'config','parts'),{recursive:true});await mkdir(path.join(scratch,'config','apps','aa1'),{recursive:true});await mkdir(path.join(scratch,'tests','workshop','audit'),{recursive:true});
for(const file of ['config/parts/1.cs','config/apps/aa1/ReplayCheck.cs','tests/workshop/audit/ReplayCheck.csproj','tests/workshop/audit/Program.cs'])await copyFile(file,path.join(scratch,file));
const actualReplay=process.argv[2]||generatedReplay;await copyFile(actualReplay,path.join(scratch,'replay.json'));
const r=dockerCall(['run','--rm','--pull=never','--name','ocv-audit-five-replay','--memory=512m','--memory-swap=512m','--cpus=1','--pids-limit=128','-e','DOTNET_CLI_TELEMETRY_OPTOUT=1','-e','DOTNET_CLI_HOME=/check/home','-e','NUGET_PACKAGES=/check/packages','-v',`${scratch.replaceAll('\\','/')}:/check`,'-w','/check','omnicivitas/test-dotnet:phase9','sh','-c','dotnet run --project tests/workshop/audit/ReplayCheck.csproj -p:UseSharedCompilation=false --disable-build-servers -- /check/replay.json'],{timeout:90000,maxBuffer:2097152});
await writeFile(path.join(reportRoot,'audit-five-mechanical-replay.log'),r.stdout+'\n'+r.stderr);const result=JSON.parse(r.stdout.trim().split(/\r?\n/).findLast(line=>line.startsWith('{')));assert.equal(result.ok,true);assert.equal(result.checks,15);checks.push({name:'Actual retained replay and 12 malformed records plus historical/current version labels',passed:true,checks:result.checks});
await writeFile(path.join(reportRoot,'audit-five-native.json'),JSON.stringify({at:new Date().toISOString(),passed:true,checks,scope:'Two bounded serial checks. Native/Wasm parity is for this host. Replay metadata is not a numerical certificate or forgery-proof seal.'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,replayAssertions:result.checks}));
