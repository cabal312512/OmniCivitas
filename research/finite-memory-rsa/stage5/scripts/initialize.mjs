import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,verifyPreservation,hash } from './preservation.mjs';
for(const dir of ['docs','src','tests','experiments','data','results','paper','figures'])fs.mkdirSync(path.join(stageRoot,dir),{recursive:true});
const output=path.join(stageRoot,'results/preservation-before.json');if(fs.existsSync(output))throw new Error('Refuse initialization overwrite');
const preservation=verifyPreservation();if(preservation.groups.length!==5)throw new Error('Need all four frozen stages and website baseline');
fs.writeFileSync(output,JSON.stringify(preservation,null,2)+'\n');console.log(JSON.stringify({frozenFiles:preservation.groups.map(x=>x.files),status:'preserved'}));
const input=process.argv[2];if(input){const target=path.join(stageRoot,'docs/USER_BRIEF.zh.txt');fs.copyFileSync(input,target);console.log(JSON.stringify({briefSha256:hash(fs.readFileSync(target))}));}
