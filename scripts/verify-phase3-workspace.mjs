import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import './guard-paths.mjs';
const root=process.env.OCV_DEPS_ROOT;
const node=process.execPath,pnpm=path.join(root,'tools/pnpm/bin/pnpm.cjs');
const runs=[];
for(const args of [['install','--frozen-lockfile','--offline'],['build'],['test']]){
 const result=spawnSync(node,[pnpm,...args],{encoding:'utf8',maxBuffer:12*1024*1024,env:{...process.env,NG_BUILD_MAX_WORKERS:'1'}});
 const output=(result.stdout+'\n'+result.stderr).replace(/\x1b\[[0-9;]*m/g,'');runs.push({args,exitCode:result.status,output});console.log(output.trim());
 assert.equal(result.status,0,args.join(' ')+' failed.');
}
assert.match(runs[1].output,/5 projects/);
assert.match(runs[2].output,/Tests\s+5 passed/);
fs.writeFileSync(path.join(root,'runtime/reports/phase3-build-unit.json'),JSON.stringify({status:'passed',updatedAt:new Date().toISOString(),node,pnpm,buildProjects:5,unitTests:5,runs},null,2));
