import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
import { geometryModel } from '../../stage4/src/geometry-model.mjs';
import { temporalController,numericController,exactController,universalTemporalLiveness } from '../../stage4/src/temporal.mjs';
import { rational,Fraction,ONE,ZERO,compare } from '../../stage4/src/rational.mjs';
import { checkBellmanCertificate } from '../../stage4/src/bellman-check.mjs';
const output=path.join(stageRoot,'results/lower-supports.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),archive=JSON.parse(fs.readFileSync(path.join(stageRoot,'../stage4/results/capability-search.json')));
const Q=x=>rational(`${x.numerator}/${x.denominator}`),score=(m,mu,nu)=>Q(m.coverage).sub(mu.mul(Q(m.absOrder))).sub(nu.mul(Q(m.attemptsPerParticle)));
const D=protocol.lowerSearch.denominator;
function definition(x){const rows=[0,3].map(i=>{const [a,b,c]=x.slice(i,i+3).map(n=>new Fraction(BigInt(n),BigInt(D)));return [a,ONE.sub(a).mul(b),ONE.sub(a).mul(ONE.sub(b)).mul(c),ONE.sub(a).mul(ONE.sub(b)).mul(ONE.sub(c))];});return {initial:[1,0],H:rows.map(r=>r.slice(0,2)),V:rows.map(r=>r.slice(2))};}
const serialize=p=>({initial:p.initial.map(x=>`${x.n}/${x.d}`),H:p.success[0].map(row=>row.map(x=>`${x.n}/${x.d}`)),V:p.success[1].map(row=>row.map(x=>`${x.n}/${x.d}`))});
let rngState=protocol.lowerSearch.seed;const random=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/2**32;};
const directions=[];
for(let index=0;index<protocol.directions.length;index++){
  const direction=protocol.directions[index],parameters={L:3,k:2,boundary:direction.boundary},model=geometryModel(parameters),mu=rational(direction.imbalance),nu=rational(direction.cost);
  const old=archive.outcomes.find(x=>x.parameters.boundary===direction.boundary).temporal.filter(x=>x.states<=2).map(x=>({...x,archive:true}));
  if(direction.boundary==='periodic')old.push({...JSON.parse(fs.readFileSync(path.join(stageRoot,'../stage4/results/proper-boundary-null.json'))),evidenceFile:'../stage4/results/proper-boundary-null.json',archive:true});
  const incumbent=old.reduce((a,b)=>compare(score(a.metrics,mu,nu),score(b.metrics,mu,nu))>=0?a:b);
  let numericBest=null;const trials=[];
  if(direction.imbalance!=='0'||direction.cost!=='0')for(let start=0;start<protocol.lowerSearch.starts;start++){
    let x=Array.from({length:6},()=>1+Math.floor(random()*(D-1))),evaluations=0,rejected=0;
    const evaluate=coordinates=>{evaluations++;try{const p=temporalController(definition(coordinates)),m=numericController(p,model);const J=m.coverage-Number(mu.n)/Number(mu.d)*m.absOrder-Number(nu.n)/Number(nu.d)*m.attemptsPerParticle;if(!Number.isFinite(J))throw new Error('Nonfinite');return {coordinates,score:J,metrics:m};}catch{rejected++;return {coordinates,score:-Infinity};}};
    let current=evaluate(x);
    for(const step of protocol.lowerSearch.steps){let changed=true;
      while(changed&&evaluations<protocol.lowerSearch.evaluationCapPerStart){changed=false;
        for(let i=0;i<6&&evaluations<protocol.lowerSearch.evaluationCapPerStart;i++)for(const sign of [-1,1]){
          if(evaluations>=protocol.lowerSearch.evaluationCapPerStart)break;const y=[...current.coordinates];y[i]+=sign*step;if(y[i]<0||y[i]>D)continue;
          const candidate=evaluate(y);if(candidate.score>current.score+1e-12){current=candidate;changed=true;}
        }
      }
    }
    trials.push({start,evaluations,rejected,...current});if(!numericBest||current.score>numericBest.score)numericBest=current;
  }
  let retained={policy:incumbent.policy,metrics:incumbent.metrics,realization:incumbent.realization,evidenceFile:incumbent.evidenceFile,archived:true};
  let exactCandidate=null;
  if(numericBest&&Number.isFinite(numericBest.score)){
    const p=temporalController({...definition(numericBest.coordinates),name:`support-${index}`});
    const exact=exactController(p,parameters,{retainBellmanCertificate:true}),checked=checkBellmanCertificate(p,exact),file=`data/lower-${index}.json`;
    exactCandidate={...exact,realization:serialize(p),coordinates:numericBest.coordinates,liveness:universalTemporalLiveness(p),independentBellmanCheck:checked};
    fs.writeFileSync(path.join(stageRoot,file),JSON.stringify(exactCandidate,null,2)+'\n');
    if(compare(score(exact.metrics,mu,nu),score(incumbent.metrics,mu,nu))>0)retained={policy:p.name,metrics:exact.metrics,realization:serialize(p),evidenceFile:file,evidenceSha256:hash(fs.readFileSync(path.join(stageRoot,file))),archived:false};
  }
  const lower=score(retained.metrics,mu,nu);
  directions.push({index,...direction,parameters,lower:`${lower.n}/${lower.d}`,lowerDecimal:Number(lower.n)/Number(lower.d),retained,trials,
    newExactCandidateFile:exactCandidate?`data/lower-${index}.json`:null});
  console.log(JSON.stringify({index,boundary:direction.boundary,mu:direction.imbalance,nu:direction.cost,lower:directions.at(-1).lowerDecimal,policy:retained.policy,evaluations:trials.reduce((n,x)=>n+x.evaluations,0)}));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),directions,fullFamilyOptimumClaimed:false,scope:'Exact feasible lower supports, numeric exploration never certifies optimality'},null,2)+'\n');
