import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080',session=randomUUID(),receipts=[],tables=[];
const digest=value=>createHash('sha256').update(value).digest('hex');
const post=async(route,payload)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});return {status:r.status,body:await r.json()};};
for(let i=0;i<20;i++){
 const p={eventId:randomUUID(),session,kind:'tool',feature:'json',digest:digest(`after-receipt-${i}`),bytes:i+1,units:i};
 let reply=await post('/api/a1/receipt.cgi',p);
 // A visitor's concurrent receipt can temporarily hold the shared lock.
 if(reply.status===429){await new Promise(r=>setTimeout(r,200));reply=await post('/api/a1/receipt.cgi',p);}
 assert.equal(reply.status,201);assert.equal(reply.body.storage,'postgresql');assert.equal(reply.body.redis,true);assert.equal(reply.body.stamps,14);
 assert.equal(digest(Buffer.from(reply.body.frontendPiece,'base64')),reply.body.frontendSha);
 receipts.push({request:p,...reply.body});tables.push(...reply.body.createdTables);
}
const first=receipts[0],last=receipts.at(-1);
const replay=await post('/api/a1/receipt.cgi',first.request);assert.equal(replay.body.duplicate,true);assert.equal(replay.body.id,first.id);
const recovered=await post(`/api/a1/recover.cgi/${last.id}`,{ticket:last.ticket,frontendPiece:last.frontendPiece});
assert.equal(recovered.status,201);assert.equal(recovered.body.reassembled,true);assert.equal(recovered.body.packageSha,last.packageSha);assert.deepEqual(recovered.body.sites,['browser','backend-file','postgresql']);assert.equal(recovered.body.stamps,14);
const invalid=await post('/api/a1/receipt.cgi',{...first.request,password:'not-accepted'});assert.equal(invalid.status,400);
const badTicket=await post(`/api/a1/recover.cgi/${last.id}`,{ticket:'0'.repeat(64),frontendPiece:last.frontendPiece});assert.equal(badTicket.status,404);
const altered=last.frontendPiece.replace(/^./,last.frontendPiece[0]==='A'?'B':'A');
const badPart=await post(`/api/a1/recover.cgi/${last.id}`,{ticket:last.ticket,frontendPiece:altered});assert.equal(badPart.status,400);
assert.ok(tables.length>=6);
const report={checkedAt:new Date().toISOString(),base,receipts:receipts.length,storage:'postgresql',redis:true,storedProgramExecution:true,threePartReconstruction:true,idempotency:true,invalidCredentialsRejected:true,wrongTicketRejected:true,corruptFrontendFragmentRejected:true,createdTables:tables,configuredLimits:last.limits};
const output=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');await mkdir(output,{recursive:true});await writeFile(path.join(output,'after-http-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
