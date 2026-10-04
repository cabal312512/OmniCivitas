import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot } from './preservation.mjs';
import { geometryModel } from '../../stage4/src/geometry-model.mjs';
const output=path.join(stageRoot,'results/density-limit.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const geometries=[];
for(const boundary of ['periodic','open']){
  const parameters={L:3,k:2,boundary},model=geometryModel(parameters),queue=model.nodes[0].successors[0].map(x=>x.target),seen=new Set(queue),rows=[];
  for(let cursor=0;cursor<queue.length;cursor++){
    const i=queue[cursor],node=model.nodes[i],action=node.jam?null:node.legal[1]>0?1:0;
    rows.push({mask:node.mask,h:node.h,n:node.n,jam:node.jam,action,
      successors:action===null?[]:node.successors[action].map(x=>({mask:model.nodes[x.target].mask,h:model.nodes[x.target].h,multiplicity:x.multiplicity}))});
    if(node.jam){assert.equal(node.n,4,'Macro priority schedule has a lower-density terminal');continue;}
    for(const edge of node.successors[action])if(!seen.has(edge.target)){seen.add(edge.target);queue.push(edge.target);}
  }
  geometries.push({parameters,M:model.M,reachableMacroStates:rows.length,terminalAtoms:rows.filter(x=>x.jam).length,rows,
    coverageLowerForBeta:`(8/9)*(1-${4*model.M}*beta)`,coverageSupremum:'8/9',
    family:{initial:[1,0],H:[[0,1],[0,0]],V:[[0,0],['beta','1-beta']]},
    properForEveryPositiveBeta:true,abstractUniversalLiveForEveryPositiveBeta:true,
    argument:'As beta tends to zero, the two-state switching controller accepts H once, fills legal V rods before any premature H probe, then attempts isolated H probes at V jam and repeats. Restricted successful macro paths all jam at N=4. Expected number of V trials while V legal is at most Nmax*M=4*M; the probability of a premature beta switch is at most 4*M*beta. On its complement the macro path and actual path coincide. Properness follows from a success probability >=beta/M in every two-attempt block.'});
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,geometries,
  theorem:'The full <=2-state stochastic temporal density supremum equals8/9 on both geometries, even with abstract universal liveness. Periodic fixed-proper attainment is archived; open attainment is not asserted. Finite proper approximants do not imply a finite optimal schedule.',
  distinction:'This closes only the density support (mu=nu=0), not the cost/order frontier.'},null,2)+'\n');
console.log(JSON.stringify(geometries.map(x=>({boundary:x.parameters.boundary,macroStates:x.reachableMacroStates,terminalAtoms:x.terminalAtoms,densitySupremum:x.coverageSupremum}))));
