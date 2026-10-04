import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stageRoot,researchRoot,hash } from './preservation.mjs';
const arg=process.argv.indexOf('--workdir');
const supplied=arg>=0?process.argv[arg+1]:null;
const workdir=supplied?path.resolve(supplied):process.env.OCV_DEPS_ROOT?
  path.join(process.env.OCV_DEPS_ROOT,'tmp',`rsa-stage4-quick-${Date.now()}`):null;
if(!workdir)throw new Error('Supply a new --workdir outside the research tree; no system temp fallback');
const relative=path.relative(researchRoot,workdir);
if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Workdir must be outside frozen research');
if(fs.existsSync(workdir))throw new Error('Refuse existing workdir');
const sources=['src/exact.mjs','src/controllers.mjs','stage3/src/controllers.mjs','stage3/src/phase-type.mjs',
  'stage3/data/classification/feedback-4.json',
  ...fs.readdirSync(path.join(stageRoot,'src')).filter(x=>x.endsWith('.mjs')).map(x=>`stage4/src/${x}`),
  'stage4/scripts/reconstruct-worker.mjs','stage4/experiments/quick-fixture.json'];
fs.mkdirSync(workdir,{recursive:true});
const before={};
for(const name of sources){const original=path.join(researchRoot,name),target=path.join(workdir,name);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(original,target);before[name]=hash(fs.readFileSync(target));}
const run=spawnSync(process.execPath,[path.join(workdir,'stage4/scripts/reconstruct-worker.mjs')],{cwd:workdir,encoding:'utf8',maxBuffer:4*1024*1024});
fs.writeFileSync(path.join(workdir,'stdout.log'),run.stdout??'');fs.writeFileSync(path.join(workdir,'stderr.log'),run.stderr??'');
if(run.status!==0)throw new Error(`Quick reconstruction failed; logs under ${workdir}: ${run.stderr}`);
const changed=sources.filter(name=>before[name]!==hash(fs.readFileSync(path.join(workdir,name))));
if(changed.length)throw new Error(`Copied inputs changed: ${changed}`);
const report={...JSON.parse(fs.readFileSync(path.join(workdir,'stage4/quick-result.json'))),
  completedAtUTC:new Date().toISOString(),localWorkdir:workdir,sourceAndInputFiles:sources.length,
  copiedInputHashes:before,changedInputs:changed,
  freshSourceTree:true,externalPackagesInstalled:0,
  qualification:'Retains the frozen 28534-class scientific catalogue as an input; does not reenumerate old encodings or repeat all new exact cases.'};
const output=path.join(stageRoot,'results/clean-reconstruction.json');
if(fs.existsSync(output)){console.log(JSON.stringify({...report,evidenceWritten:false}));}
else{fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  const evidence=path.join(stageRoot,'results/evidence');fs.mkdirSync(evidence,{recursive:true});
  for(const file of ['stdout.log','stderr.log'])fs.copyFileSync(path.join(workdir,file),path.join(evidence,`quick-${file}`));
  console.log(JSON.stringify(report));}
