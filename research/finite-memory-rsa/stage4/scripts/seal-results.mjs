import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,hash,verifyPreservation } from './preservation.mjs';
const output=path.join(stageRoot,'results/research-manifest.json');
if(fs.existsSync(output))throw new Error('Refuse existing Stage IV seal');
const acceptance=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/acceptance-audit.json')));
assert.equal(acceptance.status,'passed');
const preservation=verifyPreservation();assert.deepEqual(preservation.groups,acceptance.preservation.groups);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const sourceAndArtifactFiles={};
for(const file of walk(stageRoot).sort()){
  const bytes=fs.readFileSync(file);sourceAndArtifactFiles[path.relative(stageRoot,file).replaceAll('\\','/')]={bytes:bytes.length,sha256:hash(bytes)};
}
const manifest={schemaVersion:1,sealedAtUTC:new Date().toISOString(),stage:'IV',
  sourceAndArtifactFiles,totalFiles:Object.keys(sourceAndArtifactFiles).length,
  totalBytes:Object.values(sourceAndArtifactFiles).reduce((n,x)=>n+x.bytes,0),
  frozenDependencies:preservation.groups,acceptanceAudit:'results/acceptance-audit.json',
  sealScope:'Final sources and retained scientific artifacts. Earlier experiment files remain unchanged; this is not a pre-experiment source hash or a claim of complete workflow rerun.',
  pdfGenerated:false,websiteIntegrated:false,nextStageAuthorized:false};
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'sealed',files:manifest.totalFiles,bytes:manifest.totalBytes,manifestSha256:hash(fs.readFileSync(output))}));
