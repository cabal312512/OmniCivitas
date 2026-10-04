#!/usr/bin/env node
/** A source-only reconstruction into a fresh directory. No package installation,
 * original raw-data overwrite, website service or machine-specific path.
 * Quick is an implementation check; full repeats the prespecified main study.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ROOT, COLUMNS} from './run-experiment.mjs';

const args = process.argv.slice(2), options = {profile:'quick'};
for(let i=0;i<args.length;i++) {
  if(!['--profile','--output'].includes(args[i]) || !args[i+1]) throw new Error('Usage: node scripts/reproduce.mjs --profile quick|full [--output NEW-DIRECTORY]');
  options[args[i].slice(2)] = args[++i];
}
if(!['quick','full'].includes(options.profile)) throw new Error('Unknown reproduction profile');
const stamp=new Date().toISOString().replaceAll(/[:.]/g,'-');
const out=path.resolve(ROOT,options.output ?? `results/reproduction-${options.profile}-${stamp}`);
if(fs.existsSync(out)) throw new Error('Refusing to overwrite existing reproduction directory: '+out);
if(out===ROOT || ROOT.startsWith(out+path.sep)) throw new Error('Output cannot contain the original study');
fs.mkdirSync(out,{recursive:true});
const copied=[];
for(const dir of ['src','tests','scripts','analysis','experiments','docs','paper','literature']) {
  for(const item of fs.readdirSync(path.join(ROOT,dir),{recursive:true,withFileTypes:true})) {
    if(!item.isFile()) continue;
    const base=item.parentPath ?? item.path;
    const relative=path.relative(ROOT,path.join(base,item.name));
    if(!/\.(mjs|py|json|md|bib|csv|txt)$/.test(relative)) continue;
    const destination=path.join(out,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(ROOT,relative),destination);copied.push(relative.replaceAll('\\','/'));
  }
}
for(const name of ['README.md','requirements.txt','requirements-paper.txt','THIRD_PARTY_NOTICES.md']) if(fs.existsSync(path.join(ROOT,name))) fs.copyFileSync(path.join(ROOT,name),path.join(out,name));
const commands=[];
function run(commandArgs,label) {
  const startedAt=new Date().toISOString();
  const child=spawnSync(process.execPath,commandArgs,{cwd:out,encoding:'utf8',maxBuffer:16*1024*1024});
  fs.mkdirSync(path.join(out,'results'),{recursive:true});
  fs.writeFileSync(path.join(out,'results',label+'.log'),(child.stdout??'')+(child.stderr??''));
  commands.push({args:commandArgs,label,startedAt,finishedAt:new Date().toISOString(),exitCode:child.status});
  if(child.error || child.status!==0) throw new Error(label+' failed; see '+path.join(out,'results',label+'.log'));
  console.log(JSON.stringify({completed:label,exitCode:child.status}));
}
const tests=fs.readdirSync(path.join(out,'tests')).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n);
run(['--test','--test-concurrency=1',...tests],'unit-tests');
run(['src/exact.mjs'],'exact-systems');
if(options.profile==='quick') {
  const quick={name:'atlas_quick',sizes:[16],lengths:[2],controllers:[...Array(64).keys(),'random-0.5'],repetitions:8,seedStart:100001,engine:'event'};
  fs.writeFileSync(path.join(out,'experiments/quick.json'),JSON.stringify(quick,null,2));
  run(['scripts/run-experiment.mjs','experiments/quick.json'],'quick-simulation');
  run(['analysis/summarize.mjs','--input','data/raw/atlas_quick.csv','--output','data/processed'],'quick-analysis');
  const parse=p=>fs.readFileSync(p,'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split(','));
  const original=parse(path.join(out,'tests/fixtures/atlas-regression.csv'));
  const replay=parse(path.join(out,'data/raw/atlas_quick.csv'));
  const fields=COLUMNS.filter(c=>!['experiment','elapsed_ms'].includes(c));
  const project=row=>fields.map(c=>row[COLUMNS.indexOf(c)]).join(',');
  if(original.length!==replay.length || original.some((row,i)=>project(row)!==project(replay[i]))) throw new Error('Scientific replay differs from archived atlas fixture');
  console.log(JSON.stringify({scientificReplayRows:replay.length,excludedFields:['experiment','elapsed_ms']}));
} else {
  run(['scripts/run-experiment.mjs','experiments/atlas.json'],'atlas');
  const specification=JSON.parse(fs.readFileSync(path.join(out,'docs/family-spec.json'),'utf8'));
  specification.pilotAtlasSha256=JSON.parse(fs.readFileSync(path.join(out,'data/raw/atlas.manifest.json'),'utf8')).sha256;
  fs.writeFileSync(path.join(out,'docs/reproduction-family-spec.json'),JSON.stringify(specification,null,2));
  run(['analysis/summarize.mjs','--input','data/raw/atlas.csv','--output','data/processed/pilot',
       '--lock-spec','docs/reproduction-family-spec.json','--write-lock','docs/reproduction-lock.json'],'lock-before-confirmation');
  for(const name of ['confirmation','finite_size','small_validation','open_boundary']) run(['scripts/run-experiment.mjs',`experiments/${name}.json`],name);
  run(['scripts/descriptive-extensions.mjs'],'descriptive-extensions');
  run(['analysis/summarize.mjs','--input','data/raw/*.csv','--output','data/processed','--lock','docs/reproduction-lock.json'],'main-analysis');
  run(['analysis/extensions.mjs','--rescue','data/raw/interventions/rescue.csv','--dynamics','data/raw/dynamics/summary.json','--output','data/processed'],'extension-analysis');
  run(['scripts/prepare-paper.mjs'],'paper-tables');
}
const proof={schemaVersion:1,profile:options.profile,finishedAt:new Date().toISOString(),
  runtime:{executable:process.execPath,node:process.version,platform:process.platform,arch:process.arch},
  sourceOnly:true,packagesInstalled:false,websiteStarted:false,sourceFiles:copied.length,
  sourceSha256:Object.fromEntries(copied.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,p))).digest('hex')])),
  commands,scientificReplay:options.profile==='quick'?{rows:520,matched:true,ignored:['experiment','elapsed_ms']}:null,
  scope:options.profile==='quick'?'Quick correctness and archived-seed check, not a rerun of the full study.':'All226816 main terminal runs,768 rescue pairs,192 direct trajectories and frozen deterministic exact study. Plot/PDF rendering requires optional Python dependencies separately.'};
fs.writeFileSync(path.join(out,'results/reproduction-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({profile:options.profile,output:out,proof:'results/reproduction-proof.json'}));
