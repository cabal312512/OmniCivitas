import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Polynomial, RationalFunction, phaseTypeMoments } from '../../stage3/src/phase-type.mjs';
import { graphMomentValuations } from '../src/moment-graphs.mjs';
import { stageRoot } from './preservation.mjs';
const output = path.join(stageRoot,'results/higher-moments.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite completed moment study');
const p=x=>new Polynomial(x);
const cases=[
  {name:'rare-entry-3-dwell-2',kernel:[[p(0),p([0,0,0,1])],[p(0),p([1,0,-1])]]},
  {name:'critical-second-moment',kernel:[[p(0),p([0,0,0,0,1])],[p(0),p([1,0,-1])]]},
  {name:'two-metastable-stages',kernel:[[p([1,-1]),p([0,1]),p(0)],[p(0),p([1,0,-1]),p([0,0,1])],[p(0),p(0),p('1/2')]]},
  {name:'constant-absorption',kernel:[[p('1/3'),p('1/3')],[p(0),p('1/2')]]},
  {name:'unreachable-closed-state',kernel:[[p([1,0,-1]),p(0)],[p(0),p(1)]]}
];
const results=[];
for(const model of cases){
  const graph=graphMomentValuations({kernel:model.kernel,maxOrder:6});
  const algebra=phaseTypeMoments({kernel:model.kernel,maxOrder:6});
  for(let j=0;j<6;j++){
    const truth=algebra.moments[j].leading();
    assert.equal(graph.moments[j].power,truth.power,model.name);
    assert.equal(graph.moments[j].constant.numerator,truth.constant.numerator,model.name);
    assert.equal(graph.moments[j].constant.denominator,truth.constant.denominator,model.name);
  }
  results.push({name:model.name,kernel:model.kernel.map(row=>row.map(x=>x.toJSON())),graph,
    independentRationalResolvent:algebra.moments.map(x=>x.toJSON()),verifiedOrders:6});
}
const rationalHazard=new RationalFunction(p([0,0,1]),p([1,1]));
const rationalKernel=[[new RationalFunction(1).sub(rationalHazard)]];
const rationalResult=graphMomentValuations({kernel:rationalKernel,maxOrder:6});
let factorial=1n;
for(let j=1;j<=6;j++){factorial*=BigInt(j);assert.equal(rationalResult.moments[j-1].poleOrder,2*j);assert.equal(rationalResult.moments[j-1].constant.numerator,factorial.toString());}
results.push({name:'rational-geometric-hazard',kernel:rationalKernel.map(row=>row.map(x=>x.toJSON())),graph:rationalResult,
  independentFormula:'Geometric with p=epsilon^2/(1+epsilon): raw moment j leading j! epsilon^(-2j)',verifiedOrders:6});
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,completedAtUTC:new Date().toISOString(),models:results,
  checkedLeadingTerms:36,newGraphMethodDeterminantCalls:0,scope:'New higher-moment graph extension; no old experimental run or conclusion repeated.'},null,2)+'\n');
console.log(JSON.stringify({status:'complete',models:results.length,leadingTerms:36,
  rareEntryPoleOrders:results[0].graph.moments.map(x=>x.poleOrder)}));
