import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';

const folder=resolve(process.env.OCV_SIGNALS_WASM_DIR || 'config/apps/portal/public/signals/engines');
let cppPromise,rustPromise;
async function cpp(request){
  cppPromise??=import(pathToFileURL(join(folder,'solver.mjs')).href).then(m=>m.default({locateFile:file=>join(folder,file)}));
  const module=await cppPromise;return JSON.parse(module.ccall('ocv_run','string',['string'],[JSON.stringify({schema:'ocv.signals/1',...request})]));
}
async function rust(request){
  rustPromise??=readFile(join(folder,'communications.wasm')).then(bytes=>WebAssembly.instantiate(bytes,{})).then(m=>m.instance.exports);
  const module=await rustPromise,input=new TextEncoder().encode(JSON.stringify({schema:'ocv.signals/1',...request})),length=input.length+1,pointer=module.ocv_alloc(length);
  assert.ok(pointer);new Uint8Array(module.memory.buffer,pointer,length).set(input);const result=module.ocv_run(pointer),memory=new Uint8Array(module.memory.buffer);let end=result;
  while(end<memory.length&&memory[end])end++;
  assert.ok(end<memory.length,'Result must be null-terminated inside Wasm memory.');const decoded=JSON.parse(new TextDecoder().decode(memory.subarray(result,end)));module.ocv_dealloc(pointer,length);return decoded;
}
test('C++ Wasm solves the real divider through exported ABI',async()=>{
  const result=await cpp({op:'circuit',components:[{id:'v',type:'V',a:'in',b:'0',value:5},{id:'r',type:'R',a:'in',b:'out',value:1000},{id:'q',type:'R',a:'out',b:'0',value:1000}]});assert.equal(result.ok,true);assert.ok(Math.abs(result.rows[0].values.out-2.5)<1e-12);
});
test('C++ Wasm retains transient memory and reports unsupported models',async()=>{
  const result=await cpp({op:'circuit',analysis:{kind:'transient',durationS:.001,stepS:.0001},components:[{id:'v',type:'V',a:'in',b:'0',value:5},{id:'r',type:'R',a:'in',b:'out',value:1000},{id:'c',type:'C',a:'out',b:'0',value:1e-6}]});assert.equal(result.ok,true);assert.ok(Math.abs(result.rows[10].values.out-5*(1-Math.pow(1/1.1,10)))<1e-10);
  const failure=await cpp({components:[{id:'d',type:'D',a:'in',b:'0',value:1}]});assert.equal(failure.ok,false);assert.equal(failure.diagnostics[0].code,'UNSUPPORTED');
});
test('Rust Wasm noiseless BPSK/CRC returns actual samples',async()=>{
  const result=await rust({op:'communications',bits:'101101100110',noiseless:true,samplesPerSymbol:4});assert.equal(result.ok,true);assert.equal(result.bitErrors,0);assert.equal(result.crcValid,true);assert.equal(result.waveform.length,80);assert.equal(result.decodedBits,'101101100110');
});
test('Rust Wasm packet network resolves serialization queue and current horizon',async()=>{
  const result=await rust({op:'network',nodes:[{id:'a',type:'ue'},{id:'b',type:'base'}],links:[{id:'l',a:'a',b:'b',rateMbps:1,delayMs:10,loss:0}],flows:[{id:'f',source:'a',target:'b',packets:2,bytes:1000,intervalMs:0}],durationMs:100});assert.equal(result.ok,true);assert.deepEqual(result.events.filter(e=>e.kind==='arrive').map(e=>e.tMs),[18,26]);
});
test('Rust Wasm optional RF budget retains the independently selected AWGN realization',async()=>{
  const request={op:'communications',bits:'10100110',seed:42,ebN0Db:2,samplesPerSymbol:2};
  const rf={frequencyMHz:1000,distanceKm:1,txPowerDbm:30,txGainDbi:12,rxGainDbi:12,lossDb:3,bandwidthHz:1e6,bitRateBps:250000,noiseFigureDb:5,requiredEbN0Db:10};
  const plain=await rust(request),enriched=await rust({...request,rf});
  assert.equal(enriched.ok,true);assert.ok(Math.abs(enriched.linkBudget.freeSpaceLossDb-92.44778322188337)<1e-10);
  assert.equal(enriched.linkBudget.channelCoupled,false);assert.equal(enriched.linkBudget.geometryDerived,false);
  delete enriched.linkBudget;assert.deepEqual(enriched,plain);
  const invalid=await rust({...request,rf:{...rf,distanceKm:0}});assert.equal(invalid.ok,false);assert.equal(invalid.diagnostics[0].code,'RF_LIMIT');
});
