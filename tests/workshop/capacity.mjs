import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rename,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as sleep} from 'node:timers/promises';
import {constants} from 'node:fs';

const require=createRequire(import.meta.url);
const {queueLimit,executionLimit,queueTtlSeconds,terminalLimit,taskCapacity}=require('../../services/gateway/dist/a1/capacity.js');
const names=['OCV_TASK_TIER_ROOT','OCV_AFTER_QUEUE_LIMIT','OCV_RUNNER_CONCURRENCY','OCV_AFTER_QUEUE_TTL_SECONDS','OCV_AFTER_TERMINAL_LIMIT'];
const before=new Map(names.map(name=>[name,process.env[name]]));
const deps=resolve(testDeps);
const file=join(deps,'runtime/reports/shared-capacity.json');
const report={schema:'ocv.shared/capacity-proof/2',startedAt:new Date().toISOString(),passed:false,checks:[]};
await mkdir(join(deps,'runtime/tmp'),{recursive:true});
const fixture=await mkdtemp(join(deps,'runtime/tmp/task-capacity-'));
async function configure(name,files=[],environment={}){
 const directory=join(fixture,name);await mkdir(directory);
 for(const[name,value]of files)await writeFile(join(directory,name),value);
 for(const name of names)delete process.env[name];
 Object.assign(process.env,environment,{OCV_TASK_TIER_ROOT:directory});return directory;
}
function check(name,concurrency,queued,details={}){
 assert.equal(executionLimit(),concurrency);assert.equal(queueLimit(),queued);
 report.checks.push({name,passed:true,concurrency,queuedCountLimit:queued,...details});
}
try{
 await configure('default');check('Missing marker uses the highest default, with no queued-count cap',128,0);assert.equal(queueTtlSeconds(),86400);
 await configure('lower',[['4','']],{OCV_RUNNER_CONCURRENCY:'128',OCV_AFTER_QUEUE_LIMIT:'1'});check('Empty numeric filename overrides both legacy capacity variables',4,256);assert.equal(taskCapacity().source,'numeric-file');
 await configure('highest',[['128','']],{OCV_RUNNER_CONCURRENCY:'1',OCV_AFTER_QUEUE_LIMIT:'4'});check('Highest marker permits unlimited queued count while execution remains bounded',128,0);
 await configure('dormant-vue',[['128.vue','Component source is ignored']],{OCV_RUNNER_CONCURRENCY:'1',OCV_AFTER_QUEUE_LIMIT:'4'});check('Numeric Vue filename controls capacity without reading or importing its component',128,0);assert.equal(terminalLimit(),512);
 await configure('lower-vue',[['32.vue','Unparsed dormant source']]);check('Renaming the numeric Vue prefix lowers the tier',32,2048);assert.equal(terminalLimit(),128);
 await configure('lowest',[['1','']]);check('Lowest tier keeps execution and queue limits distinct',1,64);
 await configure('out-of-range',[['129','']]);check('Malformed numeric marker selects the safe lowest tier',1,64);assert.equal(taskCapacity().malformed,true);
 await configure('nonempty',[['64','not empty']]);check('A numeric file with content is rejected as a control marker',1,64);
 process.env.OCV_TASK_TIER_ROOT=join(fixture,'missing-root');check('An unreadable root selects bounded conservative capacity',1,64);assert.equal(taskCapacity().accessible,false);
 await configure('ambiguous',[['64',''],['4','']]);check('Multiple markers select the lower tier deterministically',4,256);assert.equal(taskCapacity().ambiguous,true);
 await configure('fallback',[],{OCV_RUNNER_CONCURRENCY:'8',OCV_AFTER_QUEUE_LIMIT:'20',OCV_AFTER_QUEUE_TTL_SECONDS:'120'});check('A deployment without a marker can use explicit fallback settings',8,20);assert.equal(queueTtlSeconds(),120);
 await configure('invalid-fallback',[],{OCV_RUNNER_CONCURRENCY:'Infinity',OCV_AFTER_QUEUE_LIMIT:'-1',OCV_AFTER_QUEUE_TTL_SECONDS:'1e99'});check('Malformed fallback values use the declared defaults',128,0);assert.equal(queueTtlSeconds(),86400);
 const directory=await configure('rename',[['128','']]);assert.equal(executionLimit(),128);await rename(join(directory,'128'),join(directory,'2'));await sleep(2100);
 check('Renaming a fixture marker changes live capacity after the short cache expires',2,128);
 process.env.OCV_AFTER_QUEUE_TTL_SECONDS='0';assert.equal(queueTtlSeconds(),60);
 report.checks.push({name:'Unlimited queued-count mode does not remove the queued lifetime bound',passed:true});
 process.env.OCV_AFTER_TERMINAL_LIMIT='10001';assert.equal(terminalLimit(),10000);process.env.OCV_AFTER_TERMINAL_LIMIT='';assert.equal(terminalLimit(),128);
 report.checks.push({name:'Adaptive completed-record retention supports high concurrency and keeps an explicit upper bound',passed:true});
 report.passed=true;
}finally{
 for(const[name,value]of before)if(value===undefined)delete process.env[name];else process.env[name]=value;
 await mkdir(join(file,'..'),{recursive:true});await copyFile(file,join(deps,'runtime/reports/shared-capacity-before-numeric-tier.json'),constants.COPYFILE_EXCL).catch(error=>{if(!['ENOENT','EEXIST'].includes(error.code))throw error});
 report.finishedAt=new Date().toISOString();await writeFile(file,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,file}));
}
