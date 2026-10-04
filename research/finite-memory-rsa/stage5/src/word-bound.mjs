import { geometryModel } from '../../stage4/src/geometry-model.mjs';
import { fullInformationTail,supportSpecification } from '../../stage4/src/envelope.mjs';
import { upperQ,ceilDiv } from './fixed-point.mjs';
export function wordBoundEngine(parameters,specification){
  const model=geometryModel(parameters),spec=supportSpecification(model,specification),M=BigInt(model.M),tails=new Map();
  const terminal=(i,t)=>upperQ(spec.reward(model.nodes[i],t));
  const tail=t=>{if(!tails.has(t))tails.set(t,fullInformationTail(model,specification,t));return tails.get(t);};
  const initial={word:'',counts:new Map([[0,1n]]),absorbed:0n,denominator:1n};
  function advance(node,action){
    const t=node.word.length+1,counts=new Map();let absorbed=node.absorbed*M;
    const add=(i,c)=>{if(c)counts.set(i,(counts.get(i)??0n)+c);};
    for(const [i,count] of node.counts){const physical=model.nodes[i];add(i,count*BigInt(model.M-physical.legal[action]));
      for(const edge of physical.successors[action]){const c=count*BigInt(edge.multiplicity);
        if(model.nodes[edge.target].jam)absorbed+=c*terminal(edge.target,t);else add(edge.target,c);}
    }
    return {word:node.word+action,counts,absorbed,denominator:node.denominator*M};
  }
  function upper(node){let total=node.absorbed;const values=tail(node.word.length);for(const [i,c] of node.counts)total+=c*upperQ(values[i]);return ceilDiv(total,node.denominator);}
  return {model,initial,advance,upper,tails};
}
