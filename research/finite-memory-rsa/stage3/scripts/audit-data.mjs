import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {stageRoot,hash,verifyPreservation} from './preservation.mjs';
const records=[];
for(const name of ['coarse','middle','confirmation']){
 const planPath=path.join(stageRoot,`experiments/${name==='confirmation'?'confirmation.lock':name+'.plan'}.json`);
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
 const expected=new Map(plan.arms.map(a=>[`${a.L}:${a.k}:${a.controller}`,a]));
 const seen=new Map(),missingOptionalFields=new Set();let count=0,headers;
 const rawPath=path.join(stageRoot,`data/raw/${name}.csv`);
 for await(const line of readline.createInterface({input:fs.createReadStream(rawPath),crlfDelay:Infinity})){
  if(!headers){headers=line.split(',');continue;}if(!line)continue;
  const cells=line.split(',');if(cells.length!==headers.length||line.includes('"'))throw new Error('Unexpected CSV shape');
  const r=Object.fromEntries(headers.map((key,i)=>[key,cells[i]]));
  const armKey=`${r.L}:${r.k}:${r.controller}`,arm=expected.get(armKey);
  if(!arm||r.experiment!==name||r.boundary!==(arm.boundary??'periodic'))throw new Error('Unexpected experimental arm');
  if(!seen.has(armKey))seen.set(armKey,new Set());const seeds=seen.get(armKey),seed=Number(r.seed);
  if(seeds.has(seed)||seed<arm.seedStart||seed>=arm.seedStart+arm.repetitions)throw new Error('Duplicate/unlocked seed');seeds.add(seed);
  const num=k=>{if(r[k]===''||!Number.isFinite(Number(r[k])))throw new Error(`Missing ${k}`);return Number(r[k]);};
  for(const f of ['particles','horizontal','vertical','attempts','failures','deadlock','legal_h','legal_v','attempted_h','attempted_v'])if(!Number.isSafeInteger(num(f))||num(f)<0)throw new Error(`Invalid count ${f}`);
  const N=num('particles'),A=num('attempts'),F=num('failures'),H=num('horizontal'),V=num('vertical');
  if(H+V!==N||A-F!==N||num('attempted_h')+num('attempted_v')!==A)throw new Error('Physical count conservation failed');
  if(num('deadlock')!==0||num('legal_h')+num('legal_v')!==0)throw new Error('Certified-live row not geometrically jammed');
  if(Math.abs(num('coverage')-N*num('k')/num('L')**2)>1e-12||Math.abs(num('order')-(H-V)/N)>1e-12||
   Math.abs(num('abs_order')-Math.abs(num('order')))>1e-12||Math.abs(num('attempts_per_particle')-A/N)>1e-12)throw new Error('Metric disagrees with physical counts');
  for(const f of ['failed_h','failed_v','final_state','orientation_exchange'])if(r[f]==='')missingOptionalFields.add(`${r.kind}:${f}`);
  if(r.failed_h!==''&&num('failed_h')!==num('attempted_h')-H)throw new Error('Horizontal failure count mismatch');
  if(r.failed_v!==''&&num('failed_v')!==num('attempted_v')-V)throw new Error('Vertical failure count mismatch');
  count++;
 }
 for(const [key,arm]of expected)if(seen.get(key)?.size!==arm.repetitions)throw new Error(`Incomplete ${key}`);
 const summary=JSON.parse(fs.readFileSync(path.join(stageRoot,`results/${name}-groups.json`),'utf8'));
 const actualHash=hash(fs.readFileSync(rawPath));if(summary.rawSha256!==actualHash||summary.runs!==count)throw new Error('Summary/data seal mismatch');
 records.push({name,runs:count,groups:seen.size,planSha256:hash(fs.readFileSync(planPath)),rawSha256:actualHash,
  missingOptionalFields:[...missingOptionalFields],status:'Every run checked against locked/planned seeds, conservation, geometry, objective definitions and raw seal'});
}
const audit={verifiedAtUTC:new Date().toISOString(),mainTerminalRuns:records.reduce((n,r)=>n+r.runs,0),records,preservation:verifyPreservation(),
 note:'Blank optional IID orientation-failure/state fields are unavailable in the read-only wrapper; no blank count is treated as a measured zero. All objectives use available accepted/attempt counts.'};
fs.writeFileSync(path.join(stageRoot,'results/raw-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit));
