import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
import { wordBoundEngine } from '../src/word-bound.mjs';
import { MaxHeap } from '../src/heap.mjs';
import { SCALE,ceilDiv,decimal } from '../src/fixed-point.mjs';
import { rational } from '../../stage4/src/rational.mjs';
const output=path.join(stageRoot,'results/word-supports.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),lowers=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/lower-supports.json'))),results=[];
for(const direction of lowers.directions){
  if(direction.imbalance==='0'&&direction.cost==='0'){results.push({index:direction.index,boundary:direction.boundary,upper:'8/9',meaning:'Parity bound; supremum equality is established separately by the small-switch macro-limit certificate.'});continue;}
  const engine=wordBoundEngine(direction.parameters,{imbalance:direction.imbalance,cost:direction.cost}),heap=new MaxHeap(),records=[];
  const l=rational(direction.lower),lowerFloor=l.n*SCALE/l.d,tolerance=ceilDiv(SCALE,1000000n);
  let nodes=0,expanded=0,pruned=0,maxDepth=0,blockedUpper=null;
  const add=(value,parent,action)=>{
    value.upper=engine.upper(value);value.id=nodes++;maxDepth=Math.max(maxDepth,value.word.length);
    records.push({id:value.id,parent,action,depth:value.word.length,upper:value.upper.toString(),status:value.upper<=lowerFloor?'pruned':'frontier'});
    if(value.upper<=lowerFloor){pruned++;return;}heap.push(value);
  };
  // First-V supports equal first-H by actual lattice transposition.
  add(engine.advance(engine.initial,0),-1,0);
  while(heap.size&&expanded<protocol.wordUpper.maxExpandedPrefixesPerDirection){
    const top=heap.peek();if(top.upper-lowerFloor<=tolerance)break;
    const node=heap.pop();
    if(node.word.length>=protocol.wordUpper.maxDepth||!node.counts.size){records[node.id].status='depth-terminal-leaf';blockedUpper=blockedUpper===null||node.upper>blockedUpper?node.upper:blockedUpper;continue;}
    records[node.id].status='expanded';expanded++;add(engine.advance(node,0),node.id,0);add(engine.advance(node,1),node.id,1);
  }
  let upper=lowerFloor;if(heap.size&&heap.peek().upper>upper)upper=heap.peek().upper;if(blockedUpper!==null&&blockedUpper>upper)upper=blockedUpper;
  const file=`data/word-certificate-${direction.index}.json`;
  const certificate={schemaVersion:1,index:direction.index,parameters:direction.parameters,specification:{imbalance:direction.imbalance,cost:direction.cost},fixedPointBits:48,
    lower:direction.lower,upperFixed:upper.toString(),expanded,pruned,maxDepth,records,
    tailCertificates:[...engine.tails].map(([t,values])=>({t,values:values.map(v=>`${v.n}/${v.d}`)})),
    coverage:'Every first-H infinite word has a retained frontier/depth leaf prefix or a pruned ancestor. First-V is covered by transposition. All arithmetic upper-rounds rational rewards/expectations.',
    attainmentClaimed:false};
  fs.writeFileSync(path.join(stageRoot,file),JSON.stringify(certificate,null,2)+'\n');
  results.push({index:direction.index,boundary:direction.boundary,upper:`${upper}/${SCALE}`,upperDecimal:decimal(upper),lowerDecimal:direction.lowerDecimal,
    intervalWidth:decimal(upper)-direction.lowerDecimal,expanded,pruned,maxDepth,file,sha256:hash(fs.readFileSync(path.join(stageRoot,file))),comparator:'Unlimited-memory temporal word laws; lower point has at most two states'});
  console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),results,
  mixtureTheorem:'For proper outcome-independent random word laws and integrable reward, Tonelli/disintegration shows J equals the average of proper deterministic-word J values. Thus its supremum equals the proper deterministic-word supremum. Cost infinity has score -Infinity when nu>0.'},null,2)+'\n');
