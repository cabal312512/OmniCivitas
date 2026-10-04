import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function sources(){
 const files=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink()||['node_modules','dist','.astro','.next','target'].includes(e.name))continue;const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else files.push(f);}}
 for(const dir of ['config/apps/portal/src','services/gateway/src','tests/browser'])walk(dir);
 files.push('tests/expand1.test.mjs','playwright.expand.config.mjs','config/apps/portal/package.json','pnpm-lock.yaml','THIRD_PARTY_NOTICES.txt');
 return [...new Set(files)].sort().map(file=>({file:file.split(path.sep).join('/'),sha256:sha(fs.readFileSync(file))}));
}
