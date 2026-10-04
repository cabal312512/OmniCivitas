import fs from 'node:fs';
import path from 'node:path';
import {stageRoot,hash} from './preservation.mjs';
import {pareto} from '../src/frontier.mjs';
import {temporalMixtureDominates} from '../src/convex-frontier.mjs';
const results=[];
for(const name of ['coarse','middle']){
 const p=path.join(stageRoot,`results/${name}-groups.json`);if(!fs.existsSync(p))continue;
 const source=JSON.parse(fs.readFileSync(p,'utf8'));
 for(const L of [...new Set(source.groups.map(p=>p.L))])for(const k of [4,8]){
  const points=source.groups.filter(p=>p.L===L&&p.k===k),fair=points.find(p=>p.controller==='iid-fair'),solutions=[];
  for(const states of [1,2,3,4])for(const absBudget of [.05,.1,.2,.35,.5,1])for(const multiplier of [.75,1,1.25,2,4]){
   const costBudget=multiplier*fair.cost;
   for(const kind of ['feedback','temporal']){
    const pool=points.filter(p=>p.kind===kind&&p.states<=states&&p.abs_order<=absBudget&&p.cost<=costBudget);
    const best=pool.sort((a,b)=>b.coverage-a.coverage||a.states-b.states||a.controller.localeCompare(b.controller))[0]??null;
    solutions.push({states,kind,absBudget,costBudget,costMultiplierVsFair:multiplier,feasibleControllers:pool.length,best});
   }
  }
  const frontiers=[1,2,3,4].map(states=>({states,feedback:pareto(points.filter(p=>p.kind==='feedback'&&p.states<=states)),
    temporal:pareto(points.filter(p=>p.kind==='temporal'&&p.states<=states))}));
  const temporal=points.filter(p=>p.kind==='temporal'||p.controller==='iid-fair');
  const limitedCandidates=pareto(points.filter(p=>p.kind==='feedback')).sort((a,b)=>b.coverage-a.coverage).slice(0,25);
  results.push({name,L,k,sourceSha256:hash(fs.readFileSync(p)),poolSize:points.length,
    poolScope:name==='coarse'?'All universally-live canonical classes, noisy 12-seed means':'Selected multifidelity subset; not global optimum',
    solutions,frontiers,mixtureAudit:limitedCandidates.map(p=>({controller:p.controller,matchedTwoBitMixture:temporalMixtureDominates(p,temporal)}))});
 }
}
fs.writeFileSync(path.join(stageRoot,'results/synthesis.json'),JSON.stringify({objective:'Maximize exploratory mean coverage under memory, run-wise imbalance, cost and universal liveness constraints',
  optimizer:'Exhaustive scan of canonical finite candidate pool; no RL',limits:'Empirical feasibility and optimality within recorded pool only; not a true expectation/global/large-L optimality theorem. Mixtures are a stronger optional external-lottery diagnostic.',results},null,2)+'\n');
console.log(JSON.stringify({blocks:results.length,solutions:results.reduce((n,r)=>n+r.solutions.length,0)}));
