import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
import { parameterBoundEngine,rootBox,splitBox,DENOMINATOR } from '../src/parameter-bound.mjs';
import { MaxHeap } from '../src/heap.mjs';
import { SCALE,decimal } from '../src/fixed-point.mjs';
import { rational } from '../../stage4/src/rational.mjs';
const output=path.join(stageRoot,'results/parameter-supports.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),lowerStudy=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/lower-supports.json'))),results=[];
for(const direction of lowerStudy.directions){
  if(direction.imbalance==='0'&&direction.cost==='0'){results.push({index:direction.index,upper:'8/9',method:'Parity + small-switch macro-limit theorem'});continue;}
  const engine=parameterBoundEngine(direction.parameters,{imbalance:direction.imbalance,cost:direction.cost},protocol.parameterUpper.horizon),heap=new MaxHeap(),records=[];
  const l=rational(direction.lower),lowerFloor=l.n*SCALE/l.d;let evaluated=0,pruned=0,blockedUpper=null;
  const add=(box,parent)=>{const upper=engine.bound(box),id=records.length;evaluated++;const status=upper<=lowerFloor?'pruned':'frontier';records.push({id,parent,box,upper:upper.toString(),status});if(status==='pruned')pruned++;else heap.push({id,box,upper});};
  add(rootBox(),-1);
  while(heap.size&&evaluated+2<=protocol.parameterUpper.maxBoxesPerDirection){
    const node=heap.pop(),children=splitBox(node.box);
    if(!children.length){records[node.id].status='resolution-leaf';blockedUpper=blockedUpper===null||node.upper>blockedUpper?node.upper:blockedUpper;continue;}
    records[node.id].status='expanded';for(const child of children)add(child,node.id);
  }
  let upper=lowerFloor;if(heap.size&&heap.peek().upper>upper)upper=heap.peek().upper;if(blockedUpper!==null&&blockedUpper>upper)upper=blockedUpper;
  const file=`data/parameter-certificate-${direction.index}.json`;
  fs.writeFileSync(path.join(stageRoot,file),JSON.stringify({schemaVersion:1,index:direction.index,parameters:direction.parameters,
    specification:{imbalance:direction.imbalance,cost:direction.cost},horizon:protocol.parameterUpper.horizon,
    fixedPointBits:48,probabilityEndpointDenominator:DENOMINATOR,lower:direction.lower,upperFixed:upper.toString(),evaluated,pruned,records,
    family:'Complete two-row four-entry joint action/next-state simplexes. Initial distribution reduced by support linearity; upper retains both initial states.',
    relaxation:'Each (time,occupancy,hidden state) independently chooses a row in the same box-simplex; stationary temporal choices are included. Full-information tail undercharges future attempts. No parameter boundaries excluded.'},null,2)+'\n');
  results.push({index:direction.index,upper:`${upper}/${SCALE}`,upperDecimal:decimal(upper),lowerDecimal:direction.lowerDecimal,intervalWidth:decimal(upper)-direction.lowerDecimal,
    evaluated,pruned,file,sha256:hash(fs.readFileSync(path.join(stageRoot,file)))});console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,results,protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),globalOptimumClaimed:false},null,2)+'\n');
