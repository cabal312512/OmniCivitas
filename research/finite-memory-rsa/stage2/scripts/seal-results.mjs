#!/usr/bin/env node
/** Audit completed artifacts without rerunning research or changing Stage I. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PARENT=path.dirname(ROOT);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const target=path.join(ROOT,'results/research-manifest.json');
if(fs.existsSync(target))throw new Error('Refusing to replace a sealed Stage II manifest');
const stage1Manifest=path.join(PARENT,'results/research-manifest.json');
const stage1=JSON.parse(fs.readFileSync(stage1Manifest,'utf8'));
const changed=Object.entries(stage1.sourceAndArtifactFiles).filter(([p,m])=>!fs.existsSync(path.join(PARENT,p))||sha(path.join(PARENT,p))!==m.sha256).map(([p])=>p);
if(changed.length)throw new Error('Stage I changed: '+changed.join(', '));
const preservation={checkedAtUtc:new Date().toISOString(),files:Object.keys(stage1.sourceAndArtifactFiles).length,
 stage1ManifestSha256:sha(stage1Manifest),changed};
fs.writeFileSync(path.join(ROOT,'docs/stage1-preservation-after.json'),JSON.stringify(preservation,null,2)+'\n');
const experiments=['landscape','refinement','refinement_success_flip','large_size','exact_validation_event','exact_validation_direct','confirmation','confirmation_stability'];
const checks=experiments.map(name=>{
 const m=read(`data/raw/${name}.manifest.json`);
 if(sha(path.join(ROOT,m.raw))!==m.sha256||sha(path.join(ROOT,m.histograms.raw))!==m.histograms.sha256)throw Error('Raw/histogram hash mismatch '+name);
 for(const[p,h]of Object.entries(m.sourceSha256))if(sha(path.join(ROOT,p))!==h)throw Error('Recorded simulation source changed '+p);
 return {name,runs:m.runs,sha256:m.sha256,startedAt:m.startedAt,finishedAt:m.finishedAt};
});
const rawRows=checks.reduce((n,e)=>n+e.runs,0);
if(rawRows!==356224)throw Error('Unexpected terminal observation count');
const rare=read('data/raw/rare-excursions.manifest.json');
if(rare.runs!==700000||sha(path.join(ROOT,rare.raw))!==rare.sha256)throw Error('Rare-event evidence mismatch');
for(const[p,h]of Object.entries(rare.sourceSha256))if(sha(path.join(ROOT,p))!==h)throw Error('Rare-event source changed '+p);
const lock=read('experiments/confirmation.lock.json'),before=read('docs/confirmation-before-run.json'),audit=read('data/processed/final/audit.json');
if(sha(path.join(ROOT,'experiments/confirmation.lock.json'))!==before.lockSha256||audit.lockSha256!==before.lockSha256)throw Error('Historical lock changed');
if(audit.analysisSourceSha256!==lock.analysisSourceSha256||sha(path.join(ROOT,'analysis/summarize.mjs'))!==lock.analysisSourceSha256)throw Error('Primary analysis source differs from sealed source');
for(const e of checks.filter(e=>e.name.startsWith('confirmation')))if(!(e.startedAt>lock.lockedAtUtc))throw Error('Holdout did not begin after lock');
if(audit.rows!==143232||audit.groups!==1160||audit.errors.length||audit.confirmation.status!=='complete'||audit.confirmation.familySize!==400||audit.confirmation.reusedPilotSeeds.length)throw Error('Incomplete main audit');
const comparisons=read('data/processed/final/comparisons.json');
if(comparisons.tests.length!==400||comparisons.tests.some(t=>!t.complete))throw Error('Missing locked test');
const exact=read('data/processed/exact-small-systems.json');
if(exact.cases.length!==52)throw Error('Missing rational reference');
const quick=read('results/clean-reproduction.json');
if(quick.status!=='passed'||quick.archivedRawCopied||quick.archivedLocksCopied||quick.packagesInstalled||quick.stage1SimulationRun||quick.analysis.rows!==128||quick.exact.cases!==52||quick.commands.some(c=>c.exitCode!==0))throw Error('Invalid clean-source quick evidence');
const unit=fs.readFileSync(path.join(ROOT,'results/unit-tests.txt'),'utf8');
if(!/tests 38/.test(unit)||!/pass 38/.test(unit)||!/fail 0/.test(unit))throw Error('Integrated tests not complete');
if(fs.existsSync(path.join(ROOT,'paper/paper.pdf')))throw Error('User postponed Stage II paper PDF');
for(const p of ['paper/paper.md','results/RESEARCH_REPORT.zh.md','docs/REPRODUCTION.md','docs/website-preservation.json','figures/final/manifest.json'])if(!fs.existsSync(path.join(ROOT,p)))throw Error('Required artifact absent '+p);
const figures=read('figures/final/manifest.json');
const files={};
function walk(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(directory,item.name);if(item.isDirectory())walk(p);else if(p!==target){const rel=path.relative(ROOT,p).replaceAll('\\','/');files[rel]={bytes:fs.statSync(p).size,sha256:sha(p)};}}}
walk(ROOT);
const report={schemaVersion:1,sealedAtUtc:new Date().toISOString(),scope:'Serious Stage II only; Stage I preserved; no website integration or next-stage authorization.',
 mainTerminalRuns:143232,exactValidationTerminalRuns:212992,totalTerminalRuns:rawRows,rawGroups:audit.groups,
 frozenGeometryDraws:700000,exactControllerSystemCases:52,lockedTests:400,
 correctedRejections:comparisons.tests.filter(t=>t.rejectAtAlpha).length,
 confirmedFixedPairJointBenefits:comparisons.jointBenefits.filter(t=>t.confirmedJointBenefit).length,
 fullTestedTemporalFrontierBenefitEstablished:false,thermodynamicLimitEstablished:false,
 integratedUnitTests:{tests:38,passed:38,failed:0},
 preservation,website:read('docs/website-preservation.json'),experiments:checks,
 rawAudit:audit,cleanReconstruction:{profile:'quick',status:quick.status,rows:quick.analysis.rows,exactCases:quick.exact.cases,fullWrapperRun:false,sourceSha256:quick.sourceSha256},
 figureSets:figures.figures.length,paper:{format:'Markdown',pdfGenerated:false,reason:'User instructed not to generate PDF during this stage.'},
 sourceAndArtifactFiles:files,
 limitations:['Finite grid and scalar persistence controls do not prove continuum dominance or a universal negative.',
 'Positive fixed-pair L64 density effect did not confirm at L256/512.',
 'Large-size pointwise confidence intervals crossing zero are not equivalence proofs.',
 'Ideal exact probability construction uses finite floating arithmetic and32-bit RNG in implementation.',
 'Full clean-source replay and non-Windows execution were not run.']};
fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:Object.keys(files).length,mainRuns:report.mainTerminalRuns,validationRuns:report.exactValidationTerminalRuns,
 lockedTests:report.lockedTests,figureSets:report.figureSets,Stage1FilesUnchanged:preservation.files,pdfGenerated:false},null,2));
