import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import YAML from 'yaml';
import {selectServices,validateBudget} from './runtime-policy.mjs';
import {publicationFiles} from './publication-files.mjs';
import {isAuthorOnlyDocument} from './publication-policy.mjs';

const root=process.cwd(),reports=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');
await fs.mkdir(reports,{recursive:true});
const auditGit=process.env.OCV_AUDIT_GIT_DIR;
const args=[...(auditGit?['--git-dir='+auditGit,'--work-tree='+root]:[]),'ls-files','--cached','-z'];
const preview=process.argv.includes('--worktree'),listed=preview?null:spawnSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
if(!preview&&listed.status!==0)throw Error('Audit a staged/tracked source snapshot, or use --worktree for a no-Git local preview: '+listed.stderr);
const files=preview?await publicationFiles(root):listed.stdout.split('\0').filter(Boolean);
const publication=JSON.parse(await fs.readFile('config/source-publication.json','utf8'));
if(!files.length)throw Error('No tracked source files to audit.');
const sourceOnly=file=>/^(docs\/|assets\/|historical\/|research\/|PROJECT_SPEC\.txt$|AI写的提示词\.txt$|Prompt\.txt$|AGENTS\.md$)/.test(file);
const paths=[],secrets=[],forbidden=[],large=[],hashes=[];
const secretPattern=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{70,}\b|\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}\b/g;
for(const file of files){
  const bytes=await fs.readFile(path.join(root,file));
  if(isAuthorOnlyDocument(file,publication))forbidden.push(file);
  if(bytes.length>100*1024*1024)large.push({file,bytes:bytes.length});
  if(/(^|\/)(node_modules|dist|\.next|\.astro|\.cache|\.nx)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:vhdx|sqlite3?|db|pem|key|pfx|p12|crt|cer)$/i.test(file)&&!file.endsWith('.env.example'))forbidden.push(file);
  hashes.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(!/\.(?:astro|[cm]?js|tsx?|json|ya?ml|txt|md|conf|ps1|sql|py|rb|go|php|xml|css|scss|less|log|csv|rs|cs|fsx?|swift|kt|scala|[ch]|cpp|hpp|hs|ml|clj[sc]?|exs?|erl|hrl|nim|lua|pl|r|jl|dart|vue|svelte|sh|bash|cmd|bat|toml|ini|cmake|gradle)$/i.test(file)&&!/(?:Dockerfile|Makefile|CMakeLists\.txt)$/.test(file)&&!file.startsWith('.'))continue;
  const text=bytes.toString('utf8');
  for(const match of text.matchAll(secretPattern))secrets.push({file,offset:match.index,kind:match[0].slice(0,12)});
  const matches=[...text.matchAll(/\b[CDEF]:[\\/][^\r\n"'`]{0,150}|\bLenovo\b/g)];
  for(const match of matches)paths.push({file,offset:match.index,context:match[0],classification:sourceOnly(file)?'preserved-source-or-documentation':/^(tests\/|scripts\/verify-visual-revision\.mjs$)/.test(file)?'test-against-machine-hardcoding':'review-required'});
}
const compose=YAML.parse(await fs.readFile('compose.yaml','utf8'));
const mounts=[];
for(const [service,value] of Object.entries(compose.services))for(const mount of value.volumes||[]){
  const source=typeof mount==='string'?mount.split(':')[0]:mount.source;
  const relative=source==='.'||source.startsWith('./');
  if(!relative&&!Object.hasOwn(compose.volumes||{},source))throw Error('Unclassified volume: '+service+' '+source);
  if(relative&&!(typeof mount==='string'?mount.endsWith(':ro'):mount.read_only))throw Error('Writable source bind mount: '+service);
  mounts.push({service,source,kind:relative?'repository-relative-read-only-config':'named-volume'});
}
const budgets={};
const plan=JSON.parse(await fs.readFile('config/runtime-plan.json','utf8'));
for(const profile of ['core','legacy','databases','messaging','monitoring','search','maximum']){
  const services=selectServices(compose.services,profile),memoryCapsMiB=validateBudget(compose.services,services,Infinity),configuredBudgetMiB=Number(process.env.OCV_CONTAINER_BUDGET_MIB||plan.budgetsMiB[profile]||plan.budgetsMiB.core);
  budgets[profile]={services,memoryCapsMiB,configuredBudgetMiB,fitsConfiguredBudget:memoryCapsMiB<=configuredBudgetMiB};
}
const result={status:secrets.length||forbidden.length||large.length||paths.some(row=>row.classification==='review-required')?'review-required':'passed-source-checks',scope:preview?'Working-tree preview without Git; does not verify a tracked index, clean install or runtime.':'Tracked source snapshot; does not replace clean install/runtime/platform checks',updatedAt:new Date().toISOString(),files:files.length,secrets,forbidden,large,paths,mounts,budgets,hashes};
await fs.writeFile(path.join(reports,process.env.OCV_PUBLIC_AUDIT_REPORT||'phase9-public-source-audit.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,files:files.length,secrets:secrets.length,forbidden:forbidden.length,large:large.length,pathReview:paths.filter(row=>row.classification==='review-required'),budgets:Object.fromEntries(Object.entries(budgets).map(([key,value])=>[key,value.memoryCapsMiB]))},null,2));
if(result.status!=='passed-source-checks')process.exitCode=1;
