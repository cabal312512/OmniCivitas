import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {ROOT,COLUMNS} from './run-experiment.mjs';
import {simulate} from '../src/simulate.mjs';import {simulateRRSA} from '../src/rrsa.mjs';import {rescueSnapshot} from '../src/rescue.mjs';
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p))throw new Error('Refusing to overwrite '+p);fs.writeFileSync(p,v);};
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const began=new Date().toISOString(),rows=[],rescueRows=[],trajectories=[],snapshots=[];
// Added after locked confirmation; descriptive extension only, not in36tests.
for(const k of [2,3,4,8])for(let rep=0;rep<512;rep++){
 const r=simulateRRSA({L:64,k,seed:700001+rep});r.experiment='rrsa';rows.push(COLUMNS.map(c=>r[c]??'').join(','));
}
const rrsa=COLUMNS.join(',')+'\n'+rows.join('\n')+'\n';write(path.join(ROOT,'data/raw/rrsa.csv'),rrsa);
for(const k of [2,4,8])for(let rep=0;rep<256;rep++){
 const seed=800001+rep,before=simulate({L:64,k,controller:38,seed,snapshot:true}),after=rescueSnapshot(before.lattice,1800001+rep);
 rescueRows.push({L:64,k,boundary:'periodic',seed,deadlock:before.deadlock,before_coverage:before.coverage,after_coverage:after.coverage,coverage_gain:after.coverageGain,added_particles:after.addedParticles,before_abs_order:before.abs_order,after_abs_order:after.abs_order});
}
const fields=Object.keys(rescueRows[0]);write(path.join(ROOT,'data/raw/interventions/rescue.csv'),fields.join(',')+'\n'+rescueRows.map(r=>fields.map(f=>r[f]).join(',')).join('\n')+'\n');
for(const k of [2,4,8])for(const controller of [35,38,41,'random-0.5'])for(let rep=0;rep<16;rep++){
 const seed=500001+rep,r=simulate({L:32,k,controller,seed,engine:'direct',trace:true,snapshot:rep===0});
 const transitions=Array.from({length:2},()=>Array.from({length:2},()=>[0,0]));
 for(const t of r.trajectory)if(t.previousOutcome!==null)transitions[t.previousOrientation][t.previousOutcome][Number(t.orientation!==t.previousOrientation)]++;
 const info=(table)=>{const sum=table.flat().reduce((a,b)=>a+b,0);if(!sum)return 0;const rs=table.map(row=>row[0]+row[1]),cs=[table[0][0]+table[1][0],table[0][1]+table[1][1]];let v=0;for(let y=0;y<2;y++)for(let s=0;s<2;s++){const n=table[y][s];if(n)v+=n/sum*Math.log2(n*sum/(rs[y]*cs[s]));}return v;};
 const byY=[0,1].map(y=>{const counts=transitions.reduce((a,t)=>[a[0]+t[y][0],a[1]+t[y][1]],[0,0]);return counts[1]/(counts[0]+counts[1]);});
 const total=transitions.flat(2).reduce((a,b)=>a+b,0),conditionalMI=transitions.reduce((s,t)=>s+t.flat().reduce((a,b)=>a+b,0)/total*info(t),0);
 trajectories.push({controller:String(controller),L:32,k,seed,coverage:r.coverage,deadlock:r.deadlock,attempts:r.attempts,switchAfterFailure:byY[0],switchAfterSuccess:byY[1],conditionalMI,transitionCounts:transitions});
 if(rep===0){snapshots.push({...r,trajectory:undefined,informationCounts:undefined});write(path.join(ROOT,`data/raw/dynamics/trace-k${k}-${controller}.json`),JSON.stringify(r.trajectory));}
}
write(path.join(ROOT,'data/raw/dynamics/summary.json'),JSON.stringify({interpretation:'Descriptive16seeds/stratum;CMI estimates are plug-in nonstationary diagnostics,not causal information–performance effects.',records:trajectories},null,2));
write(path.join(ROOT,'data/raw/dynamics/snapshots.json'),JSON.stringify({seedRule:'Fixed first seed500001,not selected for appearance.',records:snapshots},null,2));
write(path.join(ROOT,'data/raw/descriptive-extensions.manifest.json'),JSON.stringify({startedAt:began,finishedAt:new Date().toISOString(),rrsaRuns:2048,rescuePairs:768,directTrajectories:192,rrsaRawSha256:hash(rrsa),primaryFamilyChanged:false,limitations:'RRSA,rescue and temporal diagnostics chosen after initial confirmation results;exploratory only. Rescue uses forbidden external geometric information,not a new controller.',sourceSha256:Object.fromEntries(['src/rrsa.mjs','src/rescue.mjs','src/simulate.mjs','src/lattice.mjs','src/rng.mjs','scripts/descriptive-extensions.mjs'].map(p=>[p,hash(fs.readFileSync(path.join(ROOT,p)))]))},null,2));
console.log(JSON.stringify({rrsaRuns:2048,rescuePairs:768,directTrajectories:192}));
