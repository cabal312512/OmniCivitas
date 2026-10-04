import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {publicationEntries} from './research-publication.mjs';

const tracked=spawnSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:16*1024*1024});
if(tracked.status!==0)throw Error('Git index is required for release validation');
const files=tracked.stdout.split('\0').filter(Boolean);
const forbidden=files.filter(file=>/(?:^|\/)(?:node_modules|dist|\.next|\.astro|\.cache|\.nx)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)paper\/[^/]+\.pdf$|\.(?:vhdx|sqlite3?|db|pem|key|pfx|p12|crt|cer)$/i.test(file)&&!file.endsWith('.env.example'));
if(forbidden.length)throw Error('Private/generated files in release: '+forbidden.join(', '));
const root=path.resolve('research/finite-memory-rsa'),entries=[];
for(const prefix of ['','stage2','stage3','stage4','stage5']){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,prefix,'results/research-manifest.json'),'utf8'));
  for(const [file,info] of Object.entries(manifest.sourceAndArtifactFiles))entries.push({file:[prefix,file].filter(Boolean).join('/'),...info});
}
const policy=JSON.parse(fs.readFileSync('config/research-publication.json','utf8'));
const included=publicationEntries(root,entries,policy);
for(const {file} of included)if(!files.includes('research/finite-memory-rsa/'+file))throw Error('Frozen artifact missing from release index: '+file);
for(const {file} of policy.omissions)if(files.includes('research/finite-memory-rsa/'+file))throw Error('Excluded paper is tracked: '+file);
const result={status:'passed',trackedFiles:files.length,scientificArtifacts:included.length,omissions:policy.omissions};
if(process.env.OCV_RELEASE_CHECK_REPORT)fs.writeFileSync(process.env.OCV_RELEASE_CHECK_REPORT,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
