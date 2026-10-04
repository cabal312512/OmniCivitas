import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import './guard-paths.mjs';
const root=process.env.OCV_DEPS_ROOT;
const node=path.join(root,'tools/node/node.exe');const pnpm=path.join(root,'tools/pnpm/bin/pnpm.cjs');
const runs=[];
for(const command of ['build','test']){const r=spawnSync(node,[pnpm,command],{encoding:'utf8',maxBuffer:8*1024*1024,env:process.env});const output=(r.stdout+'\n'+r.stderr).replace(/\x1b\[[0-9;]*m/g,'');runs.push({command:'F: portable pnpm '+command,exitCode:r.status,output});assert.equal(r.status,0,command+' failed\n'+output);console.log(output.trim());}
const tests=Number(runs[1].output.match(/Tests\s+(\d+) passed/)?.[1]);assert.equal(tests,5);
fs.writeFileSync(path.join(root,'runtime/reports/phase2-build-unit.json'),JSON.stringify({status:'passed',updatedAt:new Date().toISOString(),node,pnpm,unitTests:tests,runs},null,2));
