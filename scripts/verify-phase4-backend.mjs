import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {composeCall,dockerCall} from './docker-child.mjs';
import {verificationConfig} from './verification-config.mjs';
const {reportRoot:reports,baseUrl:base}=verificationConfig();const checks=[];
fs.mkdirSync(reports,{recursive:true});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
const accounts=['/api/login','/api/register','/api/login.do','/api/register.php','/api/old-book-accounts/login','/api/old-book-accounts/register'];
for(const url of accounts)for(const method of ['GET','POST']){const response=await fetch(base+url,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?'{}':undefined,signal:AbortSignal.timeout(5000)});await response.arrayBuffer();check(`${method} ${url} is not mounted`,response.status===404);}
const count=()=>composeCall(['exec','-T','postgres','sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"','ocv-query','SELECT (SELECT count(*) FROM ocv_unused.users),(SELECT count(*) FROM ocv_unused.user_passwords),(SELECT count(*) FROM ocv_unused.login_sessions);']).stdout.trim();
const before=count();check('Three real PostgreSQL account tables stay empty',before==='0|0|0');
const compiledCode=`const a=require('./dist/上个项目的账号_没接线/password.service.js');const cfg=require('./dist/上个项目的账号_没接线/auth.config.js');const x=a.hashOldPassword('FictionOnly-Probe!19'),y=a.hashOldPassword('FictionOnly-Probe!19');console.log(JSON.stringify({differentSalts:x!==y,correct:a.checkOldPassword('FictionOnly-Probe!19',x),wrongRejected:!a.checkOldPassword('WrongFiction!9',x),typoDisabled:cfg.oldBookClubSettings.AUTH_ENBALED===false,story:cfg.oldBookClubSettings.disabledReason}));`;
const dormant=JSON.parse(composeCall(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',compiledCode]).stdout.trim());
check('Compiled dormant scrypt hash really uses a random salt, verifies and rejects wrong input',dormant.differentSalts&&dormant.correct&&dormant.wrongRejected);
check('Compiled misspelled setting and historical bug story are present',dormant.typoDisabled&&dormant.story.includes('Bug'));
const main=fs.readFileSync('services/gateway/src/main.ts','utf8');check('Live Nest module does not import or register the old account controller',!main.includes('OldAccount')&&!main.includes('上个项目的账号')&&!main.includes('AUTH_ENBALED'));
// One bounded temporary copy of the core gateway proves that even a true flag cannot mount routes.
const name='ocv-phase4-auth-flag';assert.equal(dockerCall(['inspect',name],{allowFailure:true}).status,1,'Unexpected existing probe container; do not overwrite it.');
let flagProof;
try{
 composeCall(['run','-d','--no-deps','--name',name,'-e','AUTH_ENBALED=true','gateway']);
 const probe=JSON.parse(dockerCall(['inspect',name]).stdout)[0];check('Flag probe inherits the configured memory cap and uses the true environment value',probe.HostConfig.Memory===Number(JSON.parse(composeCall(['config','--format','json']).stdout).services.gateway.mem_limit)&&probe.Config.Env.includes('AUTH_ENBALED=true'));
 const probeCode=`(async()=>{for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:3000/health/live',{signal:AbortSignal.timeout(1200)});await r.arrayBuffer();if(r.ok)break;}catch{}if(i===39)throw Error('Probe did not become ready');await new Promise(r=>setTimeout(r,500));}const endpoints=${JSON.stringify(accounts)};const result=[];for(const url of endpoints){const r=await fetch('http://127.0.0.1:3000'+url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});await r.arrayBuffer();result.push({url,status:r.status});}console.log(JSON.stringify({flag:process.env.AUTH_ENBALED,result}));})().catch(e=>{console.error(e.message);process.exitCode=1});`;
 flagProof=JSON.parse(dockerCall(['exec',name,'node','-e',probeCode]).stdout.trim());check('Real gateway with AUTH_ENBALED=true still has no account endpoints',flagProof.flag==='true'&&flagProof.result.every(r=>r.status===404));
}finally{dockerCall(['rm','-f',name],{allowFailure:true});}
check('Temporary flag probe removed',dockerCall(['inspect',name],{allowFailure:true}).status===1);check('Account tables still empty after all probes',count()==='0|0|0');
const status=await(await fetch(base+'/api/system-status.do')).json();check('Actual stage 4 gateway reports accountSystem not-mounted',status.stage===4&&status.accountSystem==='not-mounted');
fs.writeFileSync(path.join(reports,'phase4-backend.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,emptyCounts:before,dormantHash:dormant,flagProof,flagProbeRemoved:true,status},null,2));
console.log(`PASS ${checks.length} phase 4 backend checks; no real account traffic or stored credentials.`);
