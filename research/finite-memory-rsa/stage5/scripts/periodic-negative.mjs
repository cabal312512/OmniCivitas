import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,hash } from './preservation.mjs';
import { rational,ZERO,ONE,compare,json } from '../../stage4/src/rational.mjs';
const output=path.join(stageRoot,'results/periodic-negative.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const source=path.join(stageRoot,'../stage4/results/capability-search.json'),study=JSON.parse(fs.readFileSync(source)),periodic=study.outcomes.find(x=>x.parameters.boundary==='periodic');
const properPath=path.join(stageRoot,'../stage4/results/proper-boundary-null.json'),proper=JSON.parse(fs.readFileSync(properPath));
const alternative=periodic.temporal.find(x=>x.policy==='switch-20-20'),switching=periodic.temporal.find(x=>x.policy==='switch-20-14'),Q=x=>rational(`${x.numerator}/${x.denominator}`);
const vector=x=>['coverage','absOrder','attemptsPerParticle'].map(k=>Q(x.metrics[k]));
const mixed=vector(switching).map((x,j)=>rational('9/10').mul(x).add(rational('1/10').mul(vector(proper)[j])));
const rows=[];
for(const feedback of periodic.feedback.filter(x=>x.structuralStates<=2)){
  const point=vector(feedback),components=feedback.policy==='feedback-4-00010'?[{policy:switching.policy,weight:'9/10',states:2,metrics:switching.metrics},{policy:proper.policy,weight:'1/10',states:2,metrics:proper.metrics}]:[{policy:alternative.policy,weight:'1/1',states:2,metrics:alternative.metrics}];
  const target=feedback.policy==='feedback-4-00010'?mixed:vector(alternative);
  assert(compare(target[0],point[0])>=0&&compare(target[1],point[1])<=0&&compare(target[2],point[2])<=0);
  rows.push({feedback:feedback.policy,feedbackMetrics:feedback.metrics,components,
    dominatingHullVector:Object.fromEntries(['coverage','absOrder','attemptsPerParticle'].map((k,j)=>[k,json(target[j])])),
    coordinateSlacks:{coverageGain:json(target[0].sub(point[0])),orderReduction:json(point[1].sub(target[1])),costReduction:json(point[2].sub(target[2]))}});
}
rows.push({feedback:['feedback-4-00004','feedback-4-00012'],components:[{policy:proper.policy,weight:'1/1',states:2,metrics:proper.metrics}],meaning:'Same complete physical process by forced-first-success and fixed trace encoding.'});
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,parameters:{L:3,k:2,boundary:'periodic'},rows,
  sources:[{file:'../stage4/results/capability-search.json',sha256:hash(fs.readFileSync(source))},{file:'../stage4/results/proper-boundary-null.json',sha256:hash(fs.readFileSync(properPath))}],
  theorem:'For every mu,nu>=0, the maximum J over all fixed-proper deterministic one-bit feedback physical classes is <= the supremum over complete fixed-proper <=2-state stochastic temporal controllers. All feedback points lie in the monotone dominated closure of the temporal convex hull.',
  proof:'Each feedback vector is weakly dominated by an explicit convex combination of proper <=2-state temporal vectors. For linear nonnegative scalarization, its reward is <= the combination average <= one constituent reward <= full temporal support. The mixture itself is not required to use only two states.',
  limits:'Not equality of nonconvex attainable sets, not exact raw point inclusion, not arbitrary stochastic feedback, not universal-liveness scope, not larger lattices. First-V label counterparts have identical three objectives by transposition.'},null,2)+'\n');
console.log(JSON.stringify({status:'periodic-all-directions-negative-theorem',physicalFeedbackClasses:5,
  hardCandidateSlacks:rows.find(x=>x.feedback==='feedback-4-00010').coordinateSlacks}));
