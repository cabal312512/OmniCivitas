import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {composeCall,dockerCall} from './docker-child.mjs';
import {verificationConfig} from './verification-config.mjs';
const {baseUrl:base,reportRoot}=verificationConfig();const checks=[];
const request=(route,options={})=>fetch(base+route,{...options,headers:{Connection:'close',...options.headers},signal:AbortSignal.timeout(8000)});
const query=sql=>composeCall(['exec','-T','postgres','sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"','ocv-query',sql]).stdout.trim();
const cache=id=>JSON.parse(composeCall(['exec','-T','redis','redis-cli','--raw','GET','school:sku:'+id]).stdout.trim());
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS '+name);};
const ready=await request('/health/ready');const state=await ready.json();check('Real required infrastructure is connected',ready.ok&&state.postgres==='connected'&&state.redis==='connected');
const label="phase9 Robert'); DROP TABLE ocv_core.mall_goods; -- <script>inert</script>";
const response=await request('/api/civilization.do',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label})});const saved=await response.json();
check('Actual SQL save preserves input as data',response.status===201&&saved.storage==='postgresql'&&saved.record.product_name===label);
const id=saved.record.id;assert.match(id,/^[0-9a-f-]{36}$/);
const row=()=>JSON.parse(query("SELECT json_build_object('id',id,'product_name',product_name,'delivery_count',delivery_count) FROM ocv_core.mall_goods WHERE id='"+id+"'::uuid"));
assert.deepEqual(row(),saved.record);assert.deepEqual(cache(id),saved.record);check('Exact SQL row and real Redis value agree',true);
const ttl=Number(composeCall(['exec','-T','redis','redis-cli','TTL','school:sku:'+id]).stdout);check('Cache has a finite expiration',ttl>0&&ttl<=600);
const before={postgres:composeCall(['ps','-q','postgres']).stdout.trim(),redis:composeCall(['ps','-q','redis']).stdout.trim()};
try{composeCall(['stop','--timeout','10','postgres','redis']);check('Independent homepage and ping survive storage stop',(await request('/')).ok&&(await request('/api/ping.php')).ok);}finally{composeCall(['up','-d','--no-build','--wait','--wait-timeout','180','postgres','redis']);}
for(let attempt=0;attempt<15;attempt++){if((await request('/health/ready')).ok)break;await new Promise(resolve=>setTimeout(resolve,1000));}
assert.deepEqual(row(),saved.record);assert.deepEqual(cache(id),saved.record);check('Named-volume PostgreSQL and Redis AOF survive restart',(await request('/health/ready')).ok);
check('Retention is bounded',Number(query('SELECT count(*) FROM ocv_core.mall_goods'))<=256);
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);
for(const item of containers){const config=item.HostConfig;check('Enforced resources/health/log bound: '+item.Config.Labels['com.docker.compose.service'],config.Memory>0&&config.MemorySwap===config.Memory&&config.NanoCpus>0&&config.PidsLimit>0&&config.LogConfig.Config['max-size']==='5m'&&item.State.Health?.Status==='healthy');}
await fs.mkdir(reportRoot,{recursive:true});await fs.writeFile(path.join(reportRoot,(process.env.OCV_VERIFY_REPORT_PREFIX||'')+'core-storage-verification.json'),JSON.stringify({status:'passed',updatedAt:new Date().toISOString(),base,checks,id,storage:saved.storage,before,containers:containers.map(item=>({service:item.Config.Labels['com.docker.compose.service'],health:item.State.Health.Status,memory:item.HostConfig.Memory,mounts:item.Mounts.map(mount=>({type:mount.Type,name:mount.Name,destination:mount.Destination}))}))},null,2));
