import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {simulate} from '../src/simulate.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const COLUMNS=['experiment','controller','L','k','boundary','seed','engine','particles','horizontal','vertical','coverage','order','abs_order','deadlock','legal_h','legal_v','attempts','failures','elapsed_ms','attempted_h','attempted_v'];
export function runExperiment(config, {output=null}={}) {
 const out=path.resolve(ROOT,output ?? `data/raw/${config.name}.csv`);
 if(fs.existsSync(out))throw new Error(`Refusing to overwrite raw experiment: ${out}`);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 const fd=fs.openSync(out,'wx'); fs.writeSync(fd,COLUMNS.join(',')+'\n');
 const began=new Date().toISOString();let runs=0;
 try{
  for(const boundary of config.boundaries ?? ['periodic'])for(const L of config.sizes)for(const k of config.lengths)for(const controller of config.controllers)for(let rep=0;rep<config.repetitions;rep++){
   const seed=config.seedStart+rep;
   const r=simulate({L,k,controller,boundary,seed,engine:config.engine??'event'});r.experiment=config.name;
   fs.writeSync(fd,COLUMNS.map(key=>r[key]??'').join(',')+'\n');runs++;
  }
 }finally{fs.closeSync(fd);}
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
 const sourceFiles=fs.readdirSync(path.join(ROOT,'src')).filter(x=>x.endsWith('.mjs')).map(x=>['src/'+x,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'src',x))).digest('hex')]);
 const manifest={configuration:config,startedAt:began,finishedAt:new Date().toISOString(),runs,raw:path.relative(ROOT,out).replaceAll('\\','/'),sha256,runtime:{node:process.version,platform:process.platform,arch:process.arch},sourceSha256:Object.fromEntries(sourceFiles)};
 fs.writeFileSync(out.replace(/\.csv$/,'.manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({experiment:config.name,runs,sha256,output:manifest.raw}));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw new Error('Usage: node scripts/run-experiment.mjs experiments/atlas.json');
 const p=path.resolve(ROOT,process.argv[2]);runExperiment(JSON.parse(fs.readFileSync(p,'utf8')));
}
