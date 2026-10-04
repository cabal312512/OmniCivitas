import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const stageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const researchRoot=path.resolve(stageRoot,'..');
export const projectRoot=path.resolve(researchRoot,'../..');
export const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function verifyPreservation(){
  const groups=[];
  for(const [name,prefix] of [['I',''],['II','stage2'],['III','stage3'],['IV','stage4']]){
    const root=path.join(researchRoot,prefix),file=path.join(root,'results/research-manifest.json');
    const manifest=JSON.parse(fs.readFileSync(file));
    const failures=Object.entries(manifest.sourceAndArtifactFiles).filter(([f,v])=>hash(fs.readFileSync(path.join(root,f)))!==v.sha256).map(([f])=>f);
    groups.push({name:`Stage ${name}`,files:Object.keys(manifest.sourceAndArtifactFiles).length,manifestSha256:hash(fs.readFileSync(file)),failures});
  }
  const baseline=process.env.OCV_WEBSITE_FREEZE??(process.env.OCV_DEPS_ROOT&&path.join(process.env.OCV_DEPS_ROOT,'runtime/reports/3d-capital-source-frozen9.json'));
  if(baseline&&fs.existsSync(baseline)){
    const old=JSON.parse(fs.readFileSync(baseline));
    groups.push({name:'Website frozen9',files:Object.keys(old.files).length,manifestSha256:hash(fs.readFileSync(baseline)),
      failures:Object.entries(old.files).filter(([f,v])=>hash(fs.readFileSync(path.join(projectRoot,f)))!==(typeof v==='string'?v:v.sha256)).map(([f])=>f)});
  }
  if(groups.some(x=>x.failures.length))throw new Error(JSON.stringify(groups));
  const ledgers=Object.fromEntries(['docs/requirements.json','docs/screenshot-requirements.json','docs/public-release-requirements.json'].map(f=>[f,hash(fs.readFileSync(path.join(projectRoot,f)))]));
  return {verifiedAtUTC:new Date().toISOString(),groups,ledgers};
}
