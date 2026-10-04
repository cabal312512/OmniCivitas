import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stageRoot,researchRoot,hash } from './preservation.mjs';
const arg=process.argv.indexOf('--workdir'),supplied=arg>=0?process.argv[arg+1]:null;
const workdir=supplied?path.resolve(supplied):process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'tmp',`rsa-final-quick-${Date.now()}`):null;
if(!workdir)throw new Error('Provide --workdir outside the research tree; no system temp fallback');
const relative=path.relative(researchRoot,workdir);if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Cannot reproduce inside frozen research');
if(fs.existsSync(workdir))throw new Error('Refuse existing workdir');
const closure=new Set();
function include(file){if(closure.has(file))return;closure.add(file);const code=fs.readFileSync(file,'utf8');
  for(const match of code.matchAll(/\b(?:import|export)[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))include(path.resolve(path.dirname(file),match[1]));
}
include(path.join(stageRoot,'scripts/reconstruct-worker.mjs'));closure.add(path.join(stageRoot,'experiments/quick-fixture.json'));
fs.mkdirSync(workdir,{recursive:true});const hashes={};
for(const file of [...closure].sort()){
  const relative=path.relative(researchRoot,file);if(relative.startsWith('..'))throw new Error('Source dependency escapes research');
  const target=path.join(workdir,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);hashes[relative.replaceAll('\\','/')]=hash(fs.readFileSync(target));
}
const run=spawnSync(process.execPath,[path.join(workdir,'stage5/scripts/reconstruct-worker.mjs')],{cwd:workdir,encoding:'utf8',maxBuffer:2*1024*1024});
fs.writeFileSync(path.join(workdir,'stdout.log'),run.stdout??'');fs.writeFileSync(path.join(workdir,'stderr.log'),run.stderr??'');
if(run.status!==0)throw new Error(`Clean reconstruction failed: ${run.stderr}; logs under ${workdir}`);
const changed=Object.entries(hashes).filter(([name,expected])=>hash(fs.readFileSync(path.join(workdir,name)))!==expected).map(([name])=>name);if(changed.length)throw new Error(JSON.stringify(changed));
const result={...JSON.parse(fs.readFileSync(path.join(workdir,'stage5/quick-result.json'))),completedAtUTC:new Date().toISOString(),runtime:process.version,
  platform:process.platform,localWorkdir:workdir,sourceAndInputFiles:Object.keys(hashes).length,copiedInputHashes:hashes,changedInputs:changed,
  externalPackagesInstalled:0,oldExperimentsRerun:false,websiteCleanCloneAudit:false};
const output=path.join(stageRoot,'results/clean-reconstruction.json');
if(!fs.existsSync(output)){fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');fs.mkdirSync(path.join(stageRoot,'results/evidence'),{recursive:true});
  for(const name of ['stdout.log','stderr.log'])fs.copyFileSync(path.join(workdir,name),path.join(stageRoot,`results/evidence/quick-${name}`));}
console.log(JSON.stringify(result));
