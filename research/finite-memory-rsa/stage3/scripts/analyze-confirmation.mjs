import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageRoot,researchRoot,hash } from './preservation.mjs';
import { parseCSV,descriptive,studentTTwoSidedP,studentTQuantile,holm } from '../../analysis/summarize.mjs';
import { pareto } from '../src/frontier.mjs';
import { temporalMixtureDominates } from '../src/convex-frontier.mjs';

export function directionalTest(values,alpha=.05,familySize=1) {
  const d=descriptive(values),n=d.n;
  const p=n<2?1:d.se===0?(d.mean>0?0:1):(d.mean>=0?studentTTwoSidedP(d.mean/d.se,n-1)/2:1-studentTTwoSidedP(d.mean/d.se,n-1)/2);
  const half=n>1?studentTQuantile(1-alpha/(2*familySize),n-1)*d.se:null;
  return {...d,pRaw:p,simultaneousCiLow:half===null?null:d.mean-half,simultaneousCiHigh:half===null?null:d.mean+half};
}
export function analyze(lock,rows) {
  const group=new Map();for(const row of rows){const key=`${row.k}:${row.controller}`;if(!group.has(key))group.set(key,[]);group.get(key).push(row);}
  const tests=[],comparisons=[];
  for(const family of lock.families)for(const candidate of family.candidates)for(const control of family.nulls){
    const a=group.get(`${family.k}:${candidate.controller}`),b=group.get(`${family.k}:${control.controller}`);
    if(!a||!b)throw new Error('Missing locked observations');
    const bb=new Map(b.map(r=>[r.seed,r]));
    if(a.length!==768||b.length!==768||new Set(a.map(r=>r.seed)).size!==768)throw new Error('Incomplete or duplicate locked seed block');
    const diffs=[[],[],[]];
    for(const r of a){const s=bb.get(r.seed);if(!s)throw new Error('Unpaired seed');
      diffs[0].push(r.coverage-s.coverage);diffs[1].push(lock.absMargin+s.abs_order-r.abs_order);
      diffs[2].push(lock.costMultiplier*s.attempts_per_particle-r.attempts_per_particle);}
    const comparison={k:family.k,L:family.L,candidate:candidate.controller,candidateStates:candidate.states,
      null:control.controller,nullStates:control.states,nullKind:control.kind,
      withinOneBitNull:control.states<=2,withinTwoBitNull:true,testIndices:[]};
    for(let m=0;m<3;m++){comparison.testIndices.push(tests.length);tests.push({k:family.k,candidate:candidate.controller,
      null:control.controller,metric:lock.metrics[m],...directionalTest(diffs[m],lock.alpha,lock.testFamilySize)});}
    comparisons.push(comparison);
  }
  if(tests.length!==lock.testFamilySize)throw new Error('Test family differs from lock');
  const adjusted=holm(tests.map(t=>t.pRaw));tests.forEach((t,i)=>{t.pHolm=adjusted[i];t.reject=t.pHolm<lock.alpha;});
  comparisons.forEach(c=>{c.jointBenefit=c.testIndices.every(i=>tests[i].reject);});
  const candidates=lock.families.flatMap(f=>f.candidates.map(c=>{
    const pairs=comparisons.filter(p=>p.k===f.k&&p.candidate===c.controller);
    return {k:f.k,controller:c.controller,states:c.states,twoBitFrontierGate:pairs.every(p=>p.jointBenefit),
      oneBitFrontierGate:c.states<=2&&pairs.filter(p=>p.withinOneBitNull).every(p=>p.jointBenefit),
      jointPairs:pairs.filter(p=>p.jointBenefit).length,totalPairs:pairs.length,
      densitySuperiorityAgainstAll:pairs.every(p=>tests[p.testIndices[0]].reject)};
  }));
  const summaries=[...group.values()].map(g=>({controller:g[0].controller,k:g[0].k,L:g[0].L,n:g.length,
    states:g[0].memory_states,coverage:descriptive(g.map(r=>r.coverage)),abs_order:descriptive(g.map(r=>r.abs_order)),
    cost:descriptive(g.map(r=>r.attempts_per_particle)),deadlocks:g.reduce((n,r)=>n+r.deadlock,0)}));
  const empiricalFrontiers=lock.families.map(f=>{
    const means=summaries.filter(g=>g.k===f.k).map(g=>({controller:g.controller,states:g.states,
      coverage:g.coverage.mean,abs_order:g.abs_order.mean,cost:g.cost.mean,
      kind:f.nulls.some(n=>n.controller===g.controller)?'null':'feedback'}));
    const temporal=means.filter(p=>p.kind==='null');
    return {k:f.k,scope:'Exploratory holdout point means, not simultaneous confidence frontiers',
      null:pareto(temporal),combined:pareto(means),candidates:means.filter(p=>p.kind==='feedback').map(p=>({
        ...p,dominatedByTemporalMixture:temporalMixtureDominates(p,temporal)}))};
  });
  return {tests,comparisons,candidates,summaries,empiricalFrontiers,rejections:tests.filter(t=>t.reject).length,
    jointPairs:comparisons.filter(c=>c.jointBenefit),twoBitBenefitEstablished:candidates.some(c=>c.twoBitFrontierGate),
    oneBitBenefitEstablished:candidates.some(c=>c.oneBitFrontierGate),
    inference:'Independent locked holdout; paired Student t tests with Holm across the complete locked family. Bonferroni simultaneous t intervals are reported separately; finite-variance CLT approximation is not a finite-sample tail guarantee.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const lockPath=path.join(stageRoot,'experiments/confirmation.lock.json'),lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
 for(const [p,expected]of Object.entries(lock.sourceSeal))if(hash(fs.readFileSync(path.join(researchRoot,p)))!==expected)throw new Error(`Changed locked source ${p}`);
 for(const [p,expected]of Object.entries(lock.analysisSeal))if(hash(fs.readFileSync(path.join(stageRoot,p)))!==expected)throw new Error(`Changed locked analysis ${p}`);
 const rawPath=path.join(stageRoot,'data/raw/confirmation.csv');
 const rows=parseCSV(fs.readFileSync(rawPath,'utf8')).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,['experiment','controller','kind','boundary'].includes(k)?v:Number(v)])));
 const result={lockedFileSha256:hash(fs.readFileSync(lockPath)),rawSha256:hash(fs.readFileSync(rawPath)),...analyze(lock,rows)};
 fs.writeFileSync(path.join(stageRoot,'results/confirmation-analysis.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({tests:result.tests.length,rejections:result.rejections,jointPairs:result.jointPairs.length,
   twoBitBenefitEstablished:result.twoBitBenefitEstablished,oneBitBenefitEstablished:result.oneBitBenefitEstablished,candidates:result.candidates}));
}
