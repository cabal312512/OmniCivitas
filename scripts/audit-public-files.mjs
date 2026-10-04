import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import YAML from 'yaml';
import {selectServices,validateBudget} from './runtime-policy.mjs';

const root=process.cwd(),reports=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');
await fs.mkdir(reports,{recursive:true});
const auditGit=process.env.OCV_AUDIT_GIT_DIR;
const args=[...(auditGit?['--git-dir='+auditGit,'--work-tree='+root]:[]),'ls-files','--cached','-z'];
const listed=spawnSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024});
if(listed.status!==0)throw Error('Audit a staged/tracked source snapshot, not ignore patterns alone: '+listed.stderr);
const files=listed.stdout.split('\0').filter(Boolean);
if(!files.length)throw Error('No tracked source files to audit.');
const sourceOnly=file=>/^(docs\/|assets\/|historical\/|research\/|PROJECT_SPEC\.txt$|AI写的提示词\.txt$|Prompt\.txt$|AGENTS\.md$)/.test(file);
const localOnly=file=>/^(ocv\.ps1$|scripts\/.*\.ps1$|config\/runtime\.local\.example\.json$|scripts\/(bootstrap-tools|local-runtime|doctor|guard-local-paths|link-dependencies|record-|render-phase|snapshot-|update-|rebuild-phase3|rename-workspace|verify-phase[1-8]|inspect-|preserve-|patch-|profile-3d|move-))/i.test(file);
const paths=[],secrets=[],forbidden=[],large=[],hashes=[];
const secretPattern=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{70,}\b|\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}\b/g;
for(const file of files){
  const bytes=await fs.readFile(path.join(root,file));
  if(bytes.length>100*1024*1024)large.push({file,bytes:bytes.length});
  if(/(^|\/)(node_modules|dist|\.next|\.astro|\.cache|\.nx)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:vhdx|sqlite3?|db|pem|key|pfx|p12|crt|cer)$/i.test(file)&&!file.endsWith('.env.example'))forbidden.push(file);
  hashes.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(!/\.(?:astro|[cm]?js|tsx?|json|ya?ml|txt|md|conf|ps1|sql|py|rb|go|php|xml|css|scss|less|log|csv)$/.test(file)&&!file.endsWith('Dockerfile')&&!file.startsWith('.'))continue;
  const text=bytes.toString('utf8');
  for(const match of text.matchAll(secretPattern))secrets.push({file,offset:match.index,kind:match[0].slice(0,12)});
  const matches=[...text.matchAll(/\b[CDEF]:[\\/][^\r\n"'`]{0,150}|\bLenovo\b/g)];
  for(const match of matches)paths.push({file,offset:match.index,context:match[0],classification:sourceOnly(file)?'preserved-source-or-documentation':localOnly(file)?'optional-local-development-helper':/^(tests\/|scripts\/verify-visual-revision\.mjs$)/.test(file)?'test-against-machine-hardcoding':'review-required'});
}
const compose=YAML.parse(await fs.readFile('compose.yaml','utf8'));
const mounts=[];
for(const [service,value] of Object.entries(compose.services))for(const mount of value.volumes||[]){
  const source=typeof mount==='string'?mount.split(':')[0]:mount.source;
  const relative=source.startsWith('./');
  if(!relative&&!Object.hasOwn(compose.volumes||{},source))throw Error('Unclassified volume: '+service+' '+source);
  if(relative&&!(typeof mount==='string'?mount.endsWith(':ro'):mount.read_only))throw Error('Writable source bind mount: '+service);
  mounts.push({service,source,kind:relative?'repository-relative-read-only-config':'named-volume'});
}
const budgets={};
for(const profile of ['core','legacy','databases','messaging','monitoring','search','maximum']){
  const services=selectServices(compose.services,profile);budgets[profile]={services,memoryCapsMiB:validateBudget(compose.services,services,8192)};
}
const result={status:secrets.length||forbidden.length||large.length||paths.some(row=>row.classification==='review-required')?'review-required':'passed-source-checks',scope:'Tracked source snapshot; does not replace clean install/runtime/platform checks',updatedAt:new Date().toISOString(),files:files.length,secrets,forbidden,large,paths,mounts,budgets,hashes};
await fs.writeFile(path.join(reports,process.env.OCV_PUBLIC_AUDIT_REPORT||'phase9-public-source-audit.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,files:files.length,secrets:secrets.length,forbidden:forbidden.length,large:large.length,pathReview:paths.filter(row=>row.classification==='review-required'),budgets:Object.fromEntries(Object.entries(budgets).map(([key,value])=>[key,value.memoryCapsMiB]))},null,2));
