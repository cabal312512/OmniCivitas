import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import './guard-paths.mjs';
const base=process.env.OCV_BASE_URL || 'http://127.0.0.1:8080';
const observations=[];
async function request(route,options={}) {return fetch(base+route,{...options,signal:AbortSignal.timeout(8000)});}
const home=await request('/');assert.equal(home.status,200);const homeText=await home.text();assert.match(homeText,/OmniCivitas/);observations.push('Nginx entrance serves built Astro shell.');
const ping=await request('/api/ping.php');assert.equal(ping.status,200);const pingData=await ping.json();assert.equal(pingData.service,'NestJS');assert.equal(pingData.canContinue,true);observations.push('Misleading .php route executes real NestJS.');
const ready=await request('/health/ready');assert.equal(ready.status,200);const state=await ready.json();
const label='<script>fictional-example</script> phase9';
const record=await request('/api/civilization.do',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label})});assert.equal(record.status,201);const result=await record.json();assert.equal(result.record.product_name,label);assert.equal(result.canContinue,true);observations.push(`Record saved accurately using ${result.storage}.`);
for (const payload of [{label:''},{label:'x'.repeat(201)},{label:'演示',password:'fictional-test-must-be-rejected'}]) {const response=await request('/api/civilization.do',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(response.status,400);}
const oversized=await request('/api/civilization.do',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:'x'.repeat(20000)})});assert.equal(oversized.status,413);
for(const route of ['/api/login','/api/register']) {const response=await request(route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,404);}
observations.push('Empty/oversized/credential-shaped input rejected; account endpoints are absent.');
const statusPage=await request('/status');assert.equal(statusPage.status,200);const missing=await request('/not-a-real-page');assert.equal(missing.status,404);observations.push('Status and missing-page paths behave deterministically.');
if(process.env.OCV_EXPECT_DATABASE==='true') {assert.equal(state.postgres,'connected');assert.equal(state.redis,'connected');assert.equal(result.storage,'postgresql');observations.push('Real PostgreSQL/Redis health and PostgreSQL write verified.');}
const report={verifiedAt:new Date().toISOString(),base,state,observations,recordId:result.record.id,databaseVerified:process.env.OCV_EXPECT_DATABASE==='true'};
const reportRoot=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');await mkdir(reportRoot,{recursive:true});
await writeFile(path.join(reportRoot,(process.env.OCV_VERIFY_REPORT_PREFIX||'')+'runtime-verification.json'),JSON.stringify(report,null,2));
for(const item of observations) console.log(`PASS: ${item}`);
if(!report.databaseVerified)console.log('NOT VERIFIED: Docker/WSL/PostgreSQL/Redis. Memory fallback is not counted as infrastructure evidence.');

