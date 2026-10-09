import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function wasmRunner(path) {
  const { instance } = await WebAssembly.instantiate(await readFile(path), {});
  const x = instance.exports;
  for (const key of ['memory','ws_alloc','ws_run','ws_result_len','ws_free_result','ws_dealloc']) assert.ok(x[key], key);
  return request => {
    const bytes = new TextEncoder().encode(JSON.stringify(request));
    const input = x.ws_alloc(bytes.length); assert.ok(input);
    new Uint8Array(x.memory.buffer, input, bytes.length).set(bytes);
    let ptr;
    try {
      ptr = x.ws_run(input, bytes.length);
      const length = x.ws_result_len(); assert.ok(length > 0 && length <= 4194304);
      return JSON.parse(new TextDecoder().decode(new Uint8Array(x.memory.buffer, ptr, length)));
    } finally { x.ws_free_result(); x.ws_dealloc(input, bytes.length); }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = await wasmRunner(process.argv[2] || 'config/apps/portal/public/workshop/engines/mechanics.wasm');
  const request = { schema:'ocv.workshop-run/1',op:'simulate',world:{gravityY:-9.81,durationS:1,
    bodies:[{id:'ball',kind:'ball',y:5,linearDamping:0,angularDamping:0}]}};
  const result = run(request);
  assert.equal(result.ok,true); assert.equal(result.schema,'ocv.workshop-result/1');
  const body = result.frames.at(-1).bodies[0]; assert.ok(Math.abs(body.y-(5-9.81/2))<0.09);
  assert.deepEqual(run(request),result);
  const bad = run({...request,world:{...request.world,bodies:[{id:'b',kind:'ball',mass:-1}]}});
  assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0].code,'BODY_PARAMETER');
  const scan=run({...request,op:'scan',scan:{parameter:'gravityY',values:[-5,-9.81,-15],trials:2}});
  assert.equal(scan.ok,true);assert.equal(scan.summary.runCount,6);
  assert.ok(scan.scan.runs.every(r=>r.trace.length<=32));
  console.log(JSON.stringify({passed:true,checks:4,engine:result.version,freeFallY:body.y,scanRuns:scan.summary.runCount}));
}
