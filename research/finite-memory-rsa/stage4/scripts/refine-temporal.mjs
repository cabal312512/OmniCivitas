import fs from 'node:fs';
import path from 'node:path';
import { stageRoot } from './preservation.mjs';
import { temporalController, numericController, exactController } from '../src/temporal.mjs';
import { geometryModel } from '../src/geometry-model.mjs';
import { Fraction, rational, compare } from '../src/rational.mjs';
const output=path.join(stageRoot,'results/temporal-refinement.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite refinement');
const design=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/temporal-refinement.json')));
const main=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/capability-search.json')));
const point=parameters=>{
  const fraction=i=>new Fraction(BigInt(parameters[i]),BigInt(design.gridResolution));
  const row=start=>{const a=fraction(start),b=fraction(start+1),c=fraction(start+2),one=new Fraction(1n);
    return [a,one.sub(a).mul(b),one.sub(a).mul(one.sub(b)).mul(c),one.sub(a).mul(one.sub(b)).mul(one.sub(c))];};
  const rows=[row(0),row(3)],pi=fraction(6),one=new Fraction(1n), text=x=>`${x.n}/${x.d}`;
  return temporalController({name:'two-state-refinement',initial:[text(pi),text(one.sub(pi))],
    H:rows.map(r=>r.slice(0,2).map(text)),V:rows.map(r=>r.slice(2).map(text))});
};
let randomState=design.startGeneratorSeed;
const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};
const results=[];
for(const outcome of main.outcomes){
  const parameters=outcome.parameters,model=geometryModel(parameters);
  const target=outcome.feedback.find(row=>row.policy==='feedback-4-00010');
  const score=metrics=>metrics.attemptsPerParticle+1000*Math.max(0,target.metrics.coverage.value-metrics.coverage)+1000*Math.max(0,metrics.absOrder-target.metrics.absOrder.value);
  const trials=[];let evaluations=0,bestFeasible=null;
  for(let start=0;start<design.startsPerBoundary;start++){
    let coordinates=start===0?[0,1000,500,0,0,950,1000]:start===1?[0,1000,500,0,0,1000,1000]:Array.from({length:7},()=>Math.floor(random()*1001));
    let used=0;
    const evaluate=x=>{used++;evaluations++;try{const metrics=numericController(point(x),model);return {coordinates:x,metrics,score:score(metrics)};}catch{return {coordinates:x,score:Infinity,metrics:null};}};
    let current=evaluate(coordinates);
    for(const step of design.steps){
      let changed=true;
      while(changed && used<design.perStartEvaluationCap){
        changed=false;
        for(let variable=0;variable<7&&used<design.perStartEvaluationCap;variable++)for(const sign of [-1,1]){
          const candidate=[...current.coordinates];candidate[variable]=Math.max(0,Math.min(1000,candidate[variable]+sign*step));
          if(candidate[variable]===current.coordinates[variable])continue;
          const value=evaluate(candidate);
          if(value.score<current.score-1e-12){current=value;changed=true;}
        }
      }
    }
    const feasible=current.metrics&&current.metrics.coverage>=target.metrics.coverage.value-1e-13&&current.metrics.absOrder<=target.metrics.absOrder.value+1e-13;
    if(feasible&&(!bestFeasible||current.metrics.attemptsPerParticle<bestFeasible.metrics.attemptsPerParticle))bestFeasible=current;
    trials.push({start,evaluations:used,...current,feasible});
  }
  let exact=null,dominates=false;
  if(bestFeasible){
    exact=exactController(point(bestFeasible.coordinates),parameters,{retainBellmanCertificate:true});
    const Q=x=>rational(`${x.numerator}/${x.denominator}`);
    dominates=compare(Q(exact.metrics.coverage),Q(target.metrics.coverage))>=0&&compare(Q(exact.metrics.absOrder),Q(target.metrics.absOrder))<=0&&compare(Q(exact.metrics.attemptsPerParticle),Q(target.metrics.attemptsPerParticle))<=0;
    const filename=`data/refined-temporal-${parameters.boundary}.json`;
    fs.writeFileSync(path.join(stageRoot,filename),JSON.stringify({...exact,coordinates:bestFeasible.coordinates},null,2)+'\n');
    exact={file:filename,metrics:exact.metrics};
  }
  results.push({parameters,target:target.policy,evaluations,trials,bestFeasible,exact,exactDominatesTarget:dominates});
  console.log(JSON.stringify({boundary:parameters.boundary,evaluations,bestFeasible:bestFeasible?.metrics??null,dominates}));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,completedAtUTC:new Date().toISOString(),design,results,
  fullStochasticFamilyOptimumClaimed:false,interpretation:'Bounded local search is only a feasible-point search. Failure does not exclude a two-state or four-state stochastic improvement.'},null,2)+'\n');
