import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
import { Fraction,rational,ZERO,ONE,sum,inverse,matvec,compare } from '../../stage4/src/rational.mjs';
const output=path.join(stageRoot,'results/convex-membership.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const input=path.join(stageRoot,'../stage4/results/capability-search.json'),study=JSON.parse(fs.readFileSync(input));
const Q=x=>rational(`${x.numerator}/${x.denominator}`),vector=x=>['coverage','absOrder','attemptsPerParticle'].map(n=>Q(x.metrics[n]));
function* combinations(n,r,start=0,prefix=[]){if(!r){yield prefix;return;}for(let i=start;i<=n-r;i++)yield*combinations(n,r-1,i+1,[...prefix,i]);}
const outcomes=[];
for(const outcome of study.outcomes){
  const pool=outcome.temporal.filter(x=>x.states<=2);
  if(outcome.parameters.boundary==='periodic')pool.push(JSON.parse(fs.readFileSync(path.join(stageRoot,'../stage4/results/proper-boundary-null.json'))));
  const targets=outcome.feedback.filter(x=>x.structuralStates<=2),rows=[];
  for(const target of targets){
    const v=vector(target);let certificate=null;
    for(const indices of combinations(pool.length,4)){
      const points=indices.map(i=>vector(pool[i])),A=[indices.map(()=>ONE),...[0,1,2].map(j=>points.map(p=>p[j]))];
      let weights;try{weights=matvec(inverse(A),[ONE,...v]);}catch{continue;}
      if(weights.some(x=>x.n<0n))continue;
      certificate={type:'exact-hull-membership',points:indices.map((i,j)=>({policy:pool[i].policy,states:pool[i].states,
        metrics:pool[i].metrics,evidenceFile:pool[i].evidenceFile??'../stage4/results/proper-boundary-null.json',
        weight:`${weights[j].n}/${weights[j].d}`}))};break;
    }
    if(!certificate){
      const index=pool.findIndex(x=>{const w=vector(x);return compare(w[0],v[0])>=0&&compare(w[1],v[1])<=0&&compare(w[2],v[2])<=0;});
      if(index>=0)certificate={type:'single-feasible-dominator',points:[{policy:pool[index].policy,states:pool[index].states,metrics:pool[index].metrics,weight:'1/1'}]};
    }
    rows.push({feedback:target.policy,metrics:target.metrics,randomizedOperationalMinimum:2,certificate,
      meaning:certificate?.type==='exact-hull-membership'?'Exact objective point is in convex hull of proper <=2-state temporal objective points. Persistent selector implementation is not free two-state memory.':certificate?'Nonnegative scalarizations cannot beat this feasible same-memory point.':'No archived-pool inclusion certificate; this is not exclusion.'});
  }
  outcomes.push({parameters:outcome.parameters,rows});
  console.log(JSON.stringify({boundary:outcome.parameters.boundary,certificates:rows.map(x=>({feedback:x.feedback,type:x.certificate?.type??'unresolved'}))}));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,sourceSha256:hash(fs.readFileSync(input)),outcomes,
  fullStochasticRegionInclusionClaimed:false,scope:'Exact archived-pool hull membership/single domination for proper deterministic one-bit laws; no claim that convex mixing costs no extra memory.'},null,2)+'\n');
