// Local, bounded rebuild helper; standard Compose does not depend on it.
import assert from 'node:assert/strict';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {dockerCall,composeCall} from './docker-child.mjs';
const targets=process.argv.slice(2);
assert.ok(targets.length&&targets.every(x=>['portal','next','spring','gateway','hono'].includes(x)));
const guard=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1'],{stdio:'inherit'});
assert.equal(guard.status,0,'Storage must be verified before building.');
assert.ok(os.freemem()>2048*1048576,'Keep 2 GiB host headroom.');
const active=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const containers=active.length?JSON.parse(dockerCall(['inspect',...active]).stdout):[];
assert.ok(containers.every(c=>['edge','portal','next','gateway','postgres','redis'].includes(c.Config.Labels['com.docker.compose.service'])),'Stop optional services before building.');
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];
assert.ok(builder.HostConfig.Memory>0&&builder.HostConfig.Memory<=3072*1048576);
try{for(const target of targets){console.log('Building '+target+' sequentially.');const result=composeCall(['build','--builder','ocv-budget-builder',target]);console.log(result.stdout);console.log(result.stderr);}}
finally{dockerCall(['buildx','stop','ocv-budget-builder'],{allowFailure:true});}
if(targets.some(x=>['portal','next','gateway'].includes(x)))console.log(composeCall(['up','-d','--no-build','--wait','--wait-timeout','240','gateway','portal','next','edge']).stderr);
if(targets.includes('gateway'))console.log(composeCall(['up','-d','--no-build','--no-deps','--force-recreate','--wait','edge']).stderr);
console.log('Bounded rebuild complete; builder stopped.');
