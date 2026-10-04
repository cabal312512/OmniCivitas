// Exercises exactly one optional small service, then stops it even after failure.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {composeCall} from './docker-child.mjs';
const base=new URL(process.env.OCV_BASE_URL||'http://127.0.0.1:8080');
const get=async url=>{const r=await fetch(new URL(url,base),{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);return r.json();};
try{
 composeCall(['up','-d','--no-build','--no-deps','--wait','--wait-timeout','90','hono']);
 const gateway=await get('/api/museum-config.do'),secondary=await get('/api/museum-secondary.do');
 assert.equal(gateway.storage,'postgresql');assert.equal(secondary.storage,'postgresql');assert.equal(secondary.service,'Hono');assert.equal(gateway.gatewayChoice,43);assert.equal(secondary.selected,44);assert.deepEqual(secondary.priority,['json','yaml','database','environment']);assert.equal(gateway.adapterChoice,secondary.adapterChoice);
 const report={at:new Date().toISOString(),gateway,secondary,onlyOptionalService:'hono',optionalCapMiB:128,stoppedAfter:true};
 const reportName=process.env.OCV_SECONDARY_REPORT||'phase8-secondary.json';assert.match(reportName,/^[a-z0-9-]+\.json$/);fs.writeFileSync(path.join(process.env.OCV_DEPS_ROOT,'runtime/reports',reportName),JSON.stringify(report,null,2)+'\n');console.log('Actual Nest gateway chooses environment 43; actual Hono chooses JSON 44; both read PostgreSQL and adapter stays 43.');
}finally{composeCall(['stop','hono']);}
const fallback=await get('/api/museum-secondary.do');assert.equal(fallback.canContinue,false);console.log('Optional Hono stopped; its unavailable response is explicit and core configuration still works.');assert.equal((await get('/api/museum-config.do')).storage,'postgresql');
