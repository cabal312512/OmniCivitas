import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
import { loadControllers,sourceSeal } from './run-experiment.mjs';
import { pareto } from '../src/frontier.mjs';
const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/search-protocol.json'),'utf8'));
const middlePath=path.join(stageRoot,'results/middle-groups.json');
const groups=JSON.parse(fs.readFileSync(middlePath,'utf8')).groups;
const controllers=loadControllers(),arms=[],families=[];
for(const k of protocol.coarse.k) {
  const data=groups.filter(p=>p.k===k&&p.L===protocol.confirmation.primaryL);
  const feedback=data.filter(p=>p.kind==='feedback'&&!controllers.get(p.controller).temporalEquivalent);
  const front=pareto(feedback),fair=data.find(p=>p.controller==='iid-fair');
  const picked=new Map();
  const choose=(pool,score,reason)=>{const best=[...pool].sort((a,b)=>score(b)-score(a)||a.controller.localeCompare(b.controller))[0];
    if(best){if(!picked.has(best.controller))picked.set(best.controller,{...best,reasons:[]});picked.get(best.controller).reasons.push(reason);}};
  let balanced=front.filter(p=>p.abs_order<=fair.abs_order+.01&&p.cost<=1.1*fair.cost);
  if(!balanced.length)balanced=front.filter(p=>p.cost<=2*fair.cost);
  choose(balanced.length?balanced:front,p=>p.coverage,'balanced-coverage');
  const temporal=data.filter(p=>p.kind==='temporal'),threshold=Math.max(...temporal.map(p=>p.coverage))-.01;
  const viable=front.filter(p=>p.coverage>=threshold&&p.cost<=2*fair.cost);
  choose(viable.length?viable:front,p=>-p.abs_order,'low-imbalance');
  const fast=front.filter(p=>p.coverage>=threshold&&p.abs_order<=.2);
  choose(fast.length?fast:front,p=>-p.cost,'low-cost');
  const newCandidates=[...picked.values()];
  for(const p of feedback.filter(p=>p.states<=2)) {
    if(!picked.has(p.controller))picked.set(p.controller,{...p,reasons:['protected-one-bit']});
  }
  const candidates=[...picked.values()],nulls=data.filter(p=>p.kind==='temporal'||p.controller==='iid-fair');
  if(nulls.filter(p=>p.kind==='temporal').length!==16)throw new Error('Incomplete four-state temporal null family');
  families.push({k,L:64,newCandidateCount:newCandidates.length,candidates,nulls});
  const seedStart=protocol.confirmation.newSeedStart+(k===8?100000:0);
  for(const p of [...candidates,...nulls])arms.push({controller:p.controller,L:64,k,repetitions:protocol.confirmation.repetitions,seedStart});
}
const analysisFiles=['scripts/analyze-confirmation.mjs','src/frontier.mjs','src/convex-frontier.mjs','../analysis/summarize.mjs'];
const lock={schemaVersion:1,name:'confirmation',kind:'confirmatory',lockedAtUTC:new Date().toISOString(),
  selectionSourceSha256:hash(fs.readFileSync(middlePath)),protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/search-protocol.json'))),
  sourceSeal:sourceSeal(),analysisSeal:Object.fromEntries(analysisFiles.map(p=>[p,hash(fs.readFileSync(path.join(stageRoot,p)))])),
  metrics:['coverage-superiority','absolute-imbalance-noninferiority','kinetic-cost-noninferiority'],
  absMargin:protocol.confirmation.isotropyNonInferiorityMargin,costMultiplier:protocol.confirmation.costNonInferiorityMultiplier,
  alpha:protocol.confirmation.familywiseAlpha,testFamilySize:families.reduce((n,f)=>n+f.candidates.length*f.nulls.length*3,0),
  comparisonScope:'All 16 live deterministic temporal behaviors <=4 states, and IID fair reference; one-bit subset separately <=2 states plus IID',families,arms};
const output=path.join(stageRoot,'experiments/confirmation.lock.json');if(fs.existsSync(output))throw new Error('Existing lock retained');
fs.writeFileSync(output,JSON.stringify(lock,null,2)+'\n');console.log(JSON.stringify({testFamilySize:lock.testFamilySize,
  runs:arms.reduce((n,a)=>n+a.repetitions,0),families:families.map(f=>({k:f.k,candidates:f.candidates.map(c=>({id:c.controller,states:c.states,reasons:c.reasons})),nulls:f.nulls.length}))}));
