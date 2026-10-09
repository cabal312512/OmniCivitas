import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import './guard-paths.mjs';
import { selectServices, validateBudget } from './runtime-policy.mjs';
import {docker} from './docker-child.mjs';
const action = process.argv[2];
const deps = process.env.OCV_DEPS_ROOT;
const local=process.env.OCV_LOCAL_STORAGE_GUARD==='1'&&process.platform==='win32';
const run = (file,args,{ capture=false,allowFailure=false }={}) => {
  const dockerEnvironment=file===docker&&local?{USERPROFILE:path.join(deps,'docker-desktop'),APPDATA:path.join(deps,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(deps,'docker-desktop/appdata/Local')}:{};
  const result = spawnSync(file,args,{ stdio:capture?'pipe':'inherit',encoding:'utf8',env:{ ...process.env,...dockerEnvironment,COMPOSE_PARALLEL_LIMIT:'1' } });
  if (result.error || result.status !== 0 && !allowFailure) throw new Error(result.error?.message || `${path.basename(file)} exited ${result.status}: ${result.stderr || ''}`);
  return result;
};
const compose = (args,opts) => run(docker,['compose','-p',process.env.COMPOSE_PROJECT_NAME||'omnicivitas','-f','compose.yaml',...args],opts);
if (action === 'status') { compose(['ps']); process.exit(0); }
if (action === 'stop') { compose(['--profile','*','stop']); console.log('Stopped only OmniCivitas containers; volumes are preserved.'); process.exit(0); }
if (!['core','maximum','databases','messaging','monitoring','legacy','search','circuits','mechanics','site-services','batch'].includes(action)) throw new Error('Choose core, maximum, databases, messaging, monitoring, legacy, search, circuits, mechanics, batch, status or stop.');
// Must run afresh before every pull/build, not trust an old attestation file.
if(local)run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1']);
const document = JSON.parse(compose(['--profile','*','config','--format','json'],{capture:true}).stdout);
const plan = JSON.parse(await readFile('config/runtime-plan.json','utf8'));
const groups=action==='batch'?(process.argv[3]||'').split(','):[action];
if(groups.some(g=>!['core','maximum','databases','messaging','monitoring','legacy','search','circuits','mechanics','site-services'].includes(g)))throw new Error('batch expects comma-separated known groups, e.g. legacy,messaging,search');
process.env.OCV_ACTIVE_GROUP=groups.join(',');
const selected = [...new Set(groups.flatMap(g=>selectServices(document.services,g)))];
const total = validateBudget(document.services,selected,Number(process.env.OCV_CONTAINER_BUDGET_MIB||(action==='batch'?plan.budgetsMiB.maximum:plan.budgetsMiB[action] || plan.budgetsMiB.core)));
// Build with core only, and leave host headroom outside container caps.
// VM allocation and reclaimable cache are not new allocations per profile.
const headroomMiB = 2048;
console.log(`${action}: ${selected.join(', ')}; container memory caps total ${total} MiB. Only implemented services are included.`);
const ids = run(docker,['ps','-q','--filter',`label=com.docker.compose.project=${process.env.COMPOSE_PROJECT_NAME||'omnicivitas'}`],{capture:true}).stdout.trim().split(/\s+/).filter(Boolean);
if (ids.length) {
  const containers = JSON.parse(run(docker,['inspect',...ids],{capture:true}).stdout);
  const extras = containers.filter(container => {
    const name=container.Config.Labels['com.docker.compose.service'];
    return !selected.includes(name)||!process.argv.includes('--reuse-images')&&document.services[name]?.profiles?.length;
  }).map(container=>container.Id);
  if (extras.length) run(docker,['stop','--timeout','15',...extras]);
}
if (os.freemem() / 1048576 < headroomMiB) throw new Error(`Host needs at least ${headroomMiB} MiB of available memory. Optional project containers have been stopped where possible; no builds or new services were started.`);
const externalImages = selected.filter(name => !document.services[name].build);
const reuse = process.argv.includes('--reuse-images');
if (!reuse) for(const name of externalImages){
  const cached=run(docker,['image','inspect',document.services[name].image],{capture:true,allowFailure:true});
  if(cached.status===0){console.log(`${name}: existing local image; no redundant registry transfer.`);continue;}
  let success=false;
  for(let attempt=1;attempt<=3;attempt++){const r=compose(['--profile','*','pull','--quiet',name],{allowFailure:true});if(r.status===0){success=true;break;}console.log(`${name}: registry transfer failed (${attempt}/3).`);}
  if(!success)throw new Error(`${name} image could not be downloaded; existing services and persistent data are preserved.`);
}
// An explicitly bounded builder is stopped after compilation so it does not
// silently remain beside the running core. Docker manages its image storage.
const builder = 'ocv-budget-builder';
const existing = run(docker,['buildx','inspect',builder],{capture:true,allowFailure:true});
if (existing.status !== 0) run(docker,['buildx','create','--name',builder,'--driver','docker-container','--driver-opt','memory=3g','--driver-opt','cpu-quota=200000']);
else {
  const builderContainer=run(docker,['inspect',`buildx_buildkit_${builder}0`],{capture:true,allowFailure:true});
  if(builderContainer.status!==0)throw new Error('An existing builder has no inspectable enforced limit. Inspect/recreate this project builder explicitly; do not build with an unverified limit.');
  const hostConfig=JSON.parse(builderContainer.stdout)[0].HostConfig;
  if(hostConfig.Memory<=0||hostConfig.Memory>3072*1048576)throw new Error('Existing builder memory cap is absent or exceeds 3 GiB. No build was started.');
}
try { if(!reuse){const built=new Set();for(const name of selected.filter(name=>document.services[name].build)){const service=document.services[name];const key=service.image+'|'+JSON.stringify(service.build);if(built.has(key))continue;compose(['--profile','*','build','--builder',builder,name]);built.add(key);}} }
finally { run(docker,['buildx','stop',builder],{allowFailure:true}); }
compose(['--profile','*','up','-d','--no-build','--wait','--wait-timeout','240',...selected]);
console.log(`Core entrance: http://${process.env.OCV_BIND_ADDRESS||'127.0.0.1'}:${process.env.OCV_WEB_PORT||'8080'} . Run civilization:verify for actual route/read/write evidence.`);

