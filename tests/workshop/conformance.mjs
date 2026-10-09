import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { wasmRunner } from './wasm.mjs';
import {dockerCall,composeCall} from '../../scripts/docker-child.mjs';

const run = await wasmRunner(process.argv[2] || 'config/apps/portal/public/workshop/engines/mechanics.wasm');
const fixtures = [
  {name:'free-fall',request:{schema:'ocv.workshop-run/1',op:'simulate',world:{durationS:1,gravityY:-9.81,
    bodies:[{id:'ball',kind:'ball',y:5,linearDamping:0,angularDamping:0}]}}},
  {name:'delivery-template',request:{schema:'ocv.workshop-run/1',op:'simulate',world:{durationS:8,bodies:[
    {id:'floor',kind:'track',mode:'fixed',width:15,height:.35,friction:.45,restitution:.08},
    {id:'marble',kind:'ball',x:-3,y:4,radius:.3,mass:.3,restitution:.05,friction:.65,linearDamping:.05,angularDamping:.1}],joints:[],motors:[],controls:[]},
    challenge:{id:'delivery-01',kind:'delivery',body:'marble',targetX:-3,targetY:.475,tolerance:.5,minTime:1.5}}},
  {name:'steady-template',request:{schema:'ocv.workshop-run/1',op:'simulate',world:{durationS:8,bodies:[
    {id:'floor',kind:'track',mode:'fixed',width:15,height:.35},
    {id:'wheel',kind:'wheel',x:2.5,y:2.5,radius:1.15,mass:4,angularDamping:.04}],
    joints:[{id:'pivot',kind:'hinge',a:'floor',b:'wheel',anchorX:2.5,anchorY:2.5}],
    motors:[{id:'drive',body:'wheel',targetSpeed:3,maxTorque:80}],controls:[]},
    challenge:{id:'steady-01',kind:'steady',body:'wheel',targetX:3,targetY:0,tolerance:.6,minTime:2}}},
];
const report={passed:true,tolerance:2e-4,fixtures:[]};
const image=process.env.OCV_MECHANICS_CONTAINER?null:process.env.OCV_MECHANICS_IMAGE||JSON.parse(composeCall(['config','--format','json']).stdout).services['mechanics-native'].image;
assert.ok(process.env.OCV_MECHANICS_CONTAINER||image,'The actual Compose mechanics image or an explicit native container is required.');
for(const fixture of fixtures) {
  const args=process.env.OCV_MECHANICS_CONTAINER
    ? ['exec','-i',process.env.OCV_MECHANICS_CONTAINER,'/opt/ocv/ocv-mechanics']
    : ['run','--rm','-i','--pull=never','--memory=256m','--memory-swap=256m','--cpus=1','--pids-limit=32','--read-only','--network=none',
       image,'/opt/ocv/ocv-mechanics'];
  const native=dockerCall(args,{input:JSON.stringify(fixture.request),timeout:15000,maxBuffer:4194304});
  if(native.error)throw native.error;assert.equal(native.status,0,native.stderr);
  const a=JSON.parse(native.stdout),b=run(fixture.request);
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(a.version,b.version);
  assert.equal(a.frames.length,b.frames.length);assert.equal(a.summary.steps,b.summary.steps);
  if(fixture.name.endsWith('template')) {assert.equal(a.summary.challengeComplete,true);assert.equal(b.summary.challengeComplete,true);}
  let maxError=0;
  for(let index=0;index<a.frames.length;index++) {
    assert.ok(Math.abs(a.frames[index].t-b.frames[index].t)<2e-4);
    for(let body=0;body<a.frames[index].bodies.length;body++) {
      const left=a.frames[index].bodies[body],right=b.frames[index].bodies[body];assert.equal(left.id,right.id);
      for(const key of ['x','y','angle','vx','vy','omega']) {const error=Math.abs(left[key]-right[key]);maxError=Math.max(maxError,error);assert.ok(error<2e-4,`${fixture.name}:${index}:${left.id}:${key}:${error}`);}
    }
  }
  report.fixtures.push({name:fixture.name,frames:a.frames.length,steps:a.summary.steps,challengeComplete:a.summary.challengeComplete,maxError});
}
if(process.env.OCV_WORKSHOP_CONFORMANCE_REPORT)await writeFile(process.env.OCV_WORKSHOP_CONFORMANCE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
