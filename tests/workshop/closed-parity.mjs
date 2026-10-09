import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {dockerCall} from '../../scripts/docker-child.mjs';
import {verificationConfig} from '../../scripts/verification-config.mjs';
import {wasmRunner} from './wasm.mjs';
const {reportRoot}=verificationConfig(),run=await wasmRunner('config/apps/portal/public/workshop/engines/mechanics.wasm'),name='ocv-phase14-mechanics-check',checks=[];
dockerCall(['run','-d','--pull=never','--name',name,'--memory=128m','--memory-swap=128m','--cpus=1','--pids-limit=64','omnicivitas/mechanics-native:stage11']);
try{
 for(const id of ['delivery','steady','routing','crossing','control-chain','split-logic','limited-crossing','count-interlock']){
  const file=['split-logic','limited-crossing','count-interlock'].includes(id)?path.join('config/parts/examples',id+'.json'):path.join(reportRoot,'phase14-workshop-fixtures',id+'.json');
  const project=JSON.parse(await readFile(file,'utf8')),request={schema:'ocv.workshop-run/1',op:'simulate',world:project.world,challenge:project.challenge};
  const native=JSON.parse(dockerCall(['exec','-i',name,'/opt/ocv/ocv-mechanics'],{input:JSON.stringify(request),timeout:30000,maxBuffer:4194304}).stdout),browser=run(request);assert.equal(native.ok,true);assert.equal(native.summary.challengeComplete,true);assert.deepEqual(browser,native);checks.push({id,frames:native.frames.length,challengeComplete:true,nativeWasmExactOnThisHost:true});
 }
 const seed=JSON.parse(await readFile(path.join(reportRoot,'phase14-workshop-fixtures','delivery.json'),'utf8')),body=structuredClone(seed.world.bodies.find(b=>b.mode==='dynamic'));body.x=0;body.y=20;body.vx=0;body.vy=0;
 const request={schema:'ocv.workshop-run/1',op:'scan',world:{...seed.world,bodies:[body],joints:[],motors:[],controls:[],gravityY:0,durationS:20,stepS:1/60,sampleEvery:8},scan:{parameter:'gravityY',targetId:'',values:[-100,0],trials:1}};
 const native=JSON.parse(dockerCall(['exec','-i',name,'/opt/ocv/ocv-mechanics'],{input:JSON.stringify(request),timeout:30000,maxBuffer:4194304}).stdout),browser=run(request);assert.equal(native.ok,false);assert.equal(native.scan.runs.length,2);assert.equal(native.summary.successfulRuns,1);assert.equal(native.summary.failedRuns,1);assert.ok(native.scan.runs[0].trace.length>0);assert.deepEqual(browser,native);await writeFile(path.join(reportRoot,'phase14-partial-scan.json'),JSON.stringify({request,result:native}));checks.push({id:'bounded-partial-scan',retainedRuns:2,successful:1,failed:1,nativeWasmExactOnThisHost:true});
 await writeFile(path.join(reportRoot,'phase14-mechanical-parity.json'),JSON.stringify({ok:true,checks,scope:'This Linux native and browser Wasm build on this host; no hardware-independent bitwise guarantee.'},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,partialFailuresRetained:true}));
}finally{dockerCall(['rm','-f',name]);}
