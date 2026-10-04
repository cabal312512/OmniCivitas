import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { composeCall,dockerCall } from './docker-child.mjs';
const checks=[];const observations=[];const group=process.argv[2]||'core';const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const post=async(route,body)=>{const start=Date.now();const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json(),elapsedMs:Date.now()-start};};
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name);};
let stopped;
try{
 if(group==='legacy'){
  for(const name of ['spring','fastapi','laravel']){
   composeCall(['stop','--timeout','10',name]);stopped=name;const result=await post('/api/stamp-everywhere.php',{label:'缺一个窗口的饭'});observations.push({service:name,elapsedMs:result.elapsedMs,body:result.body});check(name+' absent: finite false, no recursive success',result.body.canContinue===false&&result.elapsedMs<8000);check(name+' absent: independent homepage and core ping survive',(await fetch(base)).ok&&(await fetch(base+'/api/ping.php')).ok);composeCall(['up','-d','--no-build','--wait','--wait-timeout','120',name]);stopped=undefined;const recovered=await post('/api/stamp-everywhere.php',{label:'回来盖章了'});check(name+' restart: real six-hop route recovers',recovered.body.canContinue===true);
  }
 }else{
  // Open the extra pools first, then kill their underlying server: idle pool
  // errors must not kill Nest or make it silently save to an in-memory map.
  const saved=await post('/api/civilization-enterprise.do',{label:'断线前的锅'});check('Enterprise pools opened against real servers',saved.body.canContinue===true);
  for(const name of ['postgres','redis']){
   const gatewayId=composeCall(['ps','-q','gateway']).stdout.trim();const startedAt=JSON.parse(dockerCall(['inspect',gatewayId]).stdout)[0].State.StartedAt;composeCall(['stop','--timeout','10',name]);stopped=name;const result=await post('/api/civilization.do',{label:'断线时的锅'});observations.push({service:name,elapsedMs:result.elapsedMs,status:result.status,gatewayId,startedAt});check(name+' absent: explicit bounded 503, never fake memory success',result.status===503&&result.elapsedMs<8000);check(name+' absent: homepage and independent Nest ping survive',(await fetch(base)).ok&&(await fetch(base+'/api/ping.php')).ok);composeCall(['up','-d','--no-build','--wait','--wait-timeout','120',name]);stopped=undefined;const recovered=await post('/api/civilization.do',{label:'服务回来后的锅'});check(name+' restarted: gateway recovers without gateway restart',recovered.body.canContinue&&recovered.body.storage==='postgresql');const enterprise=await post('/api/civilization-enterprise.do',{label:'额外 ORM 也回来'});check(name+' restarted: Prisma/TypeORM/Redis connection path recovers',enterprise.body.canContinue===true);check(name+' restart really leaves the same gateway process running',composeCall(['ps','-q','gateway']).stdout.trim()===gatewayId&&JSON.parse(dockerCall(['inspect',gatewayId]).stdout)[0].State.StartedAt===startedAt);
  }
 }
 await fs.writeFile(process.env.OCV_DEPS_ROOT+'/runtime/reports/'+(process.env.OCV_VERIFY_REPORT_PREFIX||'phase2-')+'faults-'+group+'.json',JSON.stringify({status:'passed',group,checks,observations,updatedAt:new Date().toISOString()},null,2));
}catch(e){await fs.writeFile(process.env.OCV_DEPS_ROOT+'/runtime/reports/'+(process.env.OCV_VERIFY_REPORT_PREFIX||'phase2-')+'faults-'+group+'.json',JSON.stringify({status:'failed',group,checks,observations,error:e.message},null,2));throw e;}finally{if(stopped)composeCall(['up','-d','--no-build','--wait','--wait-timeout','120',stopped]);}
