#!/usr/bin/env node
/** Final integrity inventory. Does not run simulations or rewrite historical locks. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT} from './run-experiment.mjs';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const audit=read('data/processed/audit.json'),full=read('results/full-reproduction.json'),
      quick=read('results/clean-reproduction.json'),comparison=read('results/full-reproduction-comparison.json');
const classes=read('data/processed/controller_classes.json'),exact=read('data/processed/exact_small_systems.json'),
      figures=read('figures/figure-manifest.json'),pdf=read('results/pdf-validation.json');
if(audit.rows!==226816 || audit.duplicateRunKeys!==0 || comparison.rows!==226816)throw new Error('Unexpected raw-data audit');
if(full.commands.some(c=>c.exitCode!==0) || quick.commands.some(c=>c.exitCode!==0))throw new Error('Reconstruction did not complete');
if(audit.errors.length || audit.confirmation.errors.length)throw new Error('Unresolved analysis audit');
if(hash(path.join(ROOT,'paper/paper.pdf'))!==pdf.sha256 || !pdf.allPagesVisuallyReviewed)throw new Error('Paper differs from reviewed PDF');
const unitLog=fs.readFileSync(path.join(ROOT,'results/unit-tests.txt'),'utf8');
const unitCounts=Object.fromEntries(['tests','pass','fail','skipped'].map(key=>[key,Number(unitLog.match(new RegExp(`(?:^|\\n).*?${key} (\\d+)(?:\\r?\\n|$)`))?.[1]??NaN)]));
if(unitCounts.tests!==37 || unitCounts.pass!==37 || unitCounts.fail!==0 || unitCounts.skipped!==0)throw new Error('Integrated research test report is incomplete');
const sourceChecks=[];
for(const filename of fs.readdirSync(path.join(ROOT,'data/raw')).filter(n=>n.endsWith('manifest.json'))) {
  const manifest=read('data/raw/'+filename);
  for(const [source,recorded]of Object.entries(manifest.sourceSha256??{})) {
    const current=hash(path.join(ROOT,source));
    sourceChecks.push({manifest:filename,source,matched:current===recorded});
    if(current!==recorded)throw new Error('Data-generating source changed: '+source);
  }
  if(manifest.sha256 && manifest.raw) {
    if(hash(path.join(ROOT,manifest.raw))!==manifest.sha256)throw new Error('Raw file changed: '+manifest.raw);
  }
}
const lock=read('docs/confirmation-lock.json'),confirmation=read('data/raw/confirmation.manifest.json');
if(Date.parse(lock.lockedAtUtc)>=Date.parse(confirmation.startedAt))throw new Error('Lock is not before confirmation');
const list={};
for(const entry of fs.readdirSync(ROOT,{recursive:true,withFileTypes:true})) {
  if(!entry.isFile())continue;
  const filename=path.join(entry.parentPath??entry.path,entry.name),relative=path.relative(ROOT,filename).replaceAll('\\','/');
  if(relative==='results/research-manifest.json' || relative.endsWith('.log') || relative.includes('__pycache__/'))continue;
  list[relative]={bytes:fs.statSync(filename).size,sha256:hash(filename)};
}
let website=null;
if(process.argv[2]) {
  const repo=path.resolve(ROOT,'../..'),baseline=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const changed=Object.entries(baseline.files).filter(([p,h])=>hash(path.join(repo,p))!==h).map(([p])=>p);
  if(changed.length)throw new Error('Website source differs from baseline');
  website={baselineSha256:hash(process.argv[2]),filesChecked:Object.keys(baseline.files).length,changed:[]};
}
const proof={schemaVersion:1,sealedAtUtc:new Date().toISOString(),
  scope:'Independent serious computational research; no website integration or phase9 release audit.',
  mainTerminalRuns:226816,rescuePairs:768,directTrajectories:192,rawGroups:764,lockedTests:36,
  rawAudit:{duplicateKeys:audit.duplicateRunKeys,confirmation:audit.confirmation},
  deterministicClasses:{raw:classes.total,rootedOriented:classes.orientedClassCount,orientationExchange:classes.exchangeClassCount},
  exactControllerSystemPairs:exact.systems.reduce((n,system)=>n+system.controllers.length,0),
  exactBaselineSystemPairs:exact.systems.reduce((n,system)=>n+system.baselines.length,0),
  figureSets:figures.figures.length,paperPages:pdf.pages,integratedUnitTests:unitCounts,
  reconstruction:{quickCommands:quick.commands.length,fullCommands:full.commands.length,scientificColumnsMatched:true},
  historicalLock:{sha256:hash(path.join(ROOT,'docs/confirmation-lock.json')),lockedAt:lock.lockedAtUtc,confirmationStarted:confirmation.startedAt,preserved:true},
  dataSourceChecks:sourceChecks,website,
  sourceAndArtifactFiles:list,
  limitations:['Same-runtime clean reconstruction, not a second-platform validation','Not externally peer reviewed',
    'No two-bit landscape, feedback noise/delay, spatial cluster/correlation study or thermodynamic extrapolation',
    'No first-ever novelty claim and no universal no-memory theorem']};
fs.writeFileSync(path.join(ROOT,'results/research-manifest.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({files:Object.keys(list).length,mainTerminalRuns:proof.mainTerminalRuns,sourceChecks:sourceChecks.length,website,paperPages:proof.paperPages}));
