import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {stageRoot,researchRoot,projectRoot,hash,verifyPreservation} from './preservation.mjs';

const read=relative=>JSON.parse(fs.readFileSync(path.join(stageRoot,relative)));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
  entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const baseline=read('results/preservation-before.json');
const preservation=verifyPreservation();
assert.deepEqual(preservation.groups,baseline.groups,'Earlier archives or website changed');
assert.deepEqual(preservation.ledgers,baseline.ledgers,'Original ledgers changed');
assert.equal(preservation.groups.length,5,'Website baseline must also be available');

const sealFile=path.join(stageRoot,'results/research-manifest.json');
const auditFile=path.join(stageRoot,'results/acceptance-audit.json');
if(fs.existsSync(sealFile)){
  const seal=read('results/research-manifest.json');
  for(const [file,record] of Object.entries(seal.sourceAndArtifactFiles)){
    const bytes=fs.readFileSync(path.join(stageRoot,file));
    assert.equal(bytes.length,record.bytes,file);assert.equal(hash(bytes),record.sha256,file);
  }
  assert.equal(walk(stageRoot).length,seal.totalFiles+1,'Unexpected unsealed file');
  assert.equal(read('results/acceptance-audit.json').status,'passed');
  console.log(JSON.stringify({status:'passed',readOnly:true,sealedFiles:seal.totalFiles,
    sealSha256:hash(fs.readFileSync(sealFile)),preservedScientificFiles:1190,websiteFiles:52}));
  process.exit(0);
}
if(fs.existsSync(auditFile))throw new Error('Refuse existing unsealed final audit; do not silently overwrite');

const verified=read('results/certificate-verification.json');
assert.equal(verified.status,'passed');
assert.equal(verified.prefixBoundsChecked,240006);
assert.equal(verified.parameterLeafBoundsReplayed,9000);
assert.equal(verified.lowerBellmanScalarEquations,6800);
assert.equal(verified.supports.length,8);
assert.equal(verified.strictSupportSeparationFound,false);
for(const row of [...verified.checked,...verified.lowerChecks]){
  assert.equal(row.status,'passed');
  assert.equal(hash(fs.readFileSync(path.join(stageRoot,row.file))),row.sha256,row.file);
}
const protocolHash=hash(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json')));
for(const file of ['word-supports.json','parameter-supports.json','lower-supports.json']){
  const study=read(`results/${file}`);assert.equal(study.protocolSha256,protocolHash,file);
  for(const row of study.results??study.directions){
    if(row.file&&row.sha256)assert.equal(hash(fs.readFileSync(path.join(stageRoot,row.file))),row.sha256);
  }
}
const quick=read('results/clean-reconstruction.json');
assert.equal(quick.status,'passed');assert.equal(quick.exactNewLowerCases,6);
assert.equal(quick.sourceAndInputFiles,14);assert.deepEqual(quick.changedInputs,[]);
assert.equal(quick.externalPackagesInstalled,0);assert.equal(quick.oldExperimentsRerun,false);
for(const [file,expected] of Object.entries(quick.copiedInputHashes))
  assert.equal(hash(fs.readFileSync(path.join(researchRoot,file))),expected,file);
const testText=fs.readFileSync(path.join(stageRoot,'results/all-research-tests.txt'),'utf8');
for(const line of ['tests 142','pass 142','fail 0','cancelled 0','skipped 0'])
  assert.ok(testText.includes(line),`Missing test result ${line}`);
assert.equal(read('results/feedback-scope.json').structuralClasses,13);
const negative=read('results/periodic-negative.json');assert.equal(negative.rows.length,5);
for(const row of negative.sources)
  assert.equal(hash(fs.readFileSync(path.resolve(stageRoot,row.file))),row.sha256,row.file);
assert.equal(read('results/density-limit.json').geometries.length,2);
assert.equal(hash(fs.readFileSync(path.join(stageRoot,'docs/USER_BRIEF.zh.txt'))),
  '6ebe9558b827c4c8cfd432bd95855212af21281a00050067262c0249e2f9d378');

const required=['README.md','PROJECT_STATUS.md','FINAL_REVIEW.md',
  'paper/FINAL_MANUSCRIPT.md','paper/RARE_EVENT_SUPPLEMENT.md',
  'results/FINAL_SUMMARY.zh.md','docs/FINAL_LITERATURE.md',
  'docs/REPRODUCTION.md','docs/REQUIREMENTS_COVERAGE.md',
  'docs/FINAL_CAPABILITY_THEOREMS.md','docs/GLOBAL_CERTIFICATION.md'];
for(const file of required)assert.ok(fs.statSync(path.join(stageRoot,file)).size>200,file);
assert.ok(fs.readFileSync(path.join(stageRoot,'PROJECT_STATUS.md'),'utf8').includes(
  'PROJECT STATUS: PAUSED AFTER STAGE V'));
assert.ok(fs.readFileSync(path.join(projectRoot,'docs/HANDOFF.md'),'utf8').includes(
  'finite-memory-rsa-stage5-current-start'));
const future=fs.readFileSync(path.join(stageRoot,'PROJECT_STATUS.md'),'utf8').match(/^\d\. /gm)??[];
assert.equal(future.length,3);
const pending=new Set(['results/FINAL_EVIDENCE_MANIFEST.json','results/acceptance-audit.json','results/research-manifest.json']);
const linkFailures=[];let checkedLinks=0;
for(const file of walk(stageRoot).filter(file=>file.endsWith('.md'))){
  const body=fs.readFileSync(file,'utf8');
  for(const match of body.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){
    const target=match[1];if(/^(?:https?:|#)/.test(target))continue;
    const resolved=path.resolve(path.dirname(file),decodeURIComponent(target.split('#')[0]));
    const relative=path.relative(stageRoot,resolved).replaceAll('\\','/');checkedLinks++;
    if(!fs.existsSync(resolved)&&!pending.has(relative))linkFailures.push({file,target});
  }
}
assert.deepEqual(linkFailures,[],'Broken manuscript/document links');
assert.equal(walk(stageRoot).filter(file=>file.toLowerCase().endsWith('.pdf')).length,0);
for(const figure of ['01-periodic-support-negative','02-certified-remaining-intervals','03-density-supremum'])
  for(const extension of ['png','svg'])assert.ok(fs.statSync(path.join(stageRoot,`figures/${figure}.${extension}`)).size>1000);

const artifacts=[];const archivedSeals=[];
const classify=file=>file.startsWith('data/')?'retained-data':file.startsWith('results/')?'processed-output':
  /\.(?:mjs|py)$/.test(file)?'source':file.startsWith('figures/')?'figure':'documentation-or-protocol';
for(const [stage,prefix] of [['I',''],['II','stage2'],['III','stage3'],['IV','stage4']]){
  const root=path.join(researchRoot,prefix),manifestFile=path.join(root,'results/research-manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile));
  archivedSeals.push({stage,file:path.relative(researchRoot,manifestFile).replaceAll('\\','/'),
    sha256:hash(fs.readFileSync(manifestFile)),rerun:false});
  for(const [file,record] of Object.entries(manifest.sourceAndArtifactFiles)){
    artifacts.push({stage,file:[prefix,file].filter(Boolean).join('/'),role:classify(file),
      bytes:record.bytes,sha256:record.sha256,evidence:'archived; integrity checked, original study not rerun'});
  }
}
assert.equal(artifacts.length,1190);
const freshEvidence=walk(path.join(stageRoot,'results')).filter(file=>!file.endsWith('preservation-before.json'))
  .map(file=>({file:path.relative(stageRoot,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,
    sha256:hash(fs.readFileSync(file)),evidence:'current closing study; individual execution scope recorded in output'}));
const index={schemaVersion:1,createdAtUTC:new Date().toISOString(),pathRoot:'research/finite-memory-rsa',
  archivedScientificFileCount:1190,archivedSeals,archivedArtifacts:artifacts,
  websiteBaseline:preservation.groups.find(group=>group.name==='Website frozen9'),
  originalLedgerHashes:preservation.ledgers,freshStage5Results:freshEvidence,
  currentFullArtifacts:'stage5/results/research-manifest.json',
  limitations:'Hashes preserve provenance; they do not prove archived results scientifically correct or newly replicated. Current seal covers new raw certificates, processed results, sources, figures and papers.',
  oldMainExperimentsRerun:false,websiteChanged:false,pdfGenerated:false};
fs.writeFileSync(path.join(stageRoot,'results/FINAL_EVIDENCE_MANIFEST.json'),JSON.stringify(index,null,2)+'\n');
const acceptance={schemaVersion:1,status:'passed',completedAtUTC:new Date().toISOString(),
  preservation,protocolSha256:protocolHash,tests:{passed:142,failed:0,skipped:0,runCount:1},
  certification:{prefixBounds:240006,parameterLeafReplay:9000,lowerBellmanEquations:6800,supportDirections:8},
  cleanSource:{inputs:14,newExactCases:6,packagesInstalled:0,changedInputs:0},
  documentation:{required:required.length,checkedLocalLinks:checkedLinks,futureQuestions:3},
  figures:{pairs:3,visualInspection:'Performed before final audit; file sizes alone are not visual validation'},
  scientificStatus:'Periodic deterministic-one-bit fixed-proper support-negative theorem; both tiny density suprema; open joint intervals unresolved and too wide to decide',
  projectStatus:'PROJECT STATUS: PAUSED AFTER STAGE V',
  noPDF:true,noOldMainExperimentRerun:true,noWebsiteIntegration:true,noStageVI:true,
  auditLimits:'Artifact/hash and saved evidence checks, not an additional full scientific experiment or independent peer review'};
fs.writeFileSync(auditFile,JSON.stringify(acceptance,null,2)+'\n');
console.log(JSON.stringify({status:'passed',archivedFiles:1190,websiteFiles:52,tests:142,
  supports:8,checkedLocalLinks:checkedLinks,projectStatus:acceptance.projectStatus}));
