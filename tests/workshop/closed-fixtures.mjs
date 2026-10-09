import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {wasmRunner} from './wasm.mjs';
const folder=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Provide C# generated template directory under configured runtime data');
const run=await wasmRunner(process.argv[3]||'config/apps/portal/public/workshop/engines/mechanics.wasm');
const proofs=[];
for(const id of ['delivery','steady','routing','crossing','control-chain']){
 const project=JSON.parse(await readFile(join(folder,id+'.json'),'utf8'));
 const request={schema:'ocv.workshop-run/1',op:'simulate',world:project.world,challenge:project.challenge};
 const result=run(request);
 assert.equal(result.ok,true,`${id}: ${JSON.stringify(result.diagnostics)}`);
 assert.equal(result.summary.challengeComplete,true,`${id}: challenge incomplete`);
 assert.ok(result.frames.length<=256);
 if(id==='routing'||id==='control-chain'){
  const moments=result.keyMoments;
  const signal=moments.find(m=>m.id==='received'),gate=moments.find(m=>m.id==='interlock');
  assert.ok(signal&&gate&&gate.t>=signal.t&&gate.t>=1);
 }
 proofs.push({id,steps:result.summary.steps,frames:result.frames.length,completionTimeS:result.summary.completionTime,model:result.model});
}
for(const id of ['split-logic','limited-crossing','count-interlock']){
 const project=JSON.parse(await readFile(join('config/parts/examples',id+'.json'),'utf8'));
 const result=run({schema:'ocv.workshop-run/1',op:'simulate',world:project.world,challenge:project.challenge});
 assert.equal(result.ok,true,`${id}: ${JSON.stringify(result.diagnostics)}`);
 assert.equal(result.summary.challengeComplete,true,`${id}: catalogue objective incomplete`);
 proofs.push({id,source:'published-catalogue',steps:result.summary.steps,completionTimeS:result.summary.completionTime});
}
console.log(JSON.stringify({ok:true,scope:'C# domain templates executed by the shared Rust Wasm core; native equality is checked separately',proofs}));
