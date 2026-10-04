import { geometryModel } from '../../stage4/src/geometry-model.mjs';
import { fullInformationTail,supportSpecification } from '../../stage4/src/envelope.mjs';
import { SCALE,ceilDiv,upperQ } from './fixed-point.mjs';
export const DENOMINATOR=1<<20;
export const rootBox=()=>({lo:Array(8).fill(0),hi:Array(8).fill(DENOMINATOR)});
export function tighten(box){
  const lo=[...box.lo],hi=[...box.hi];let changed=true;
  while(changed){changed=false;
    for(const start of [0,4])for(let j=0;j<4;j++){
      const i=start+j,l=Math.max(lo[i],DENOMINATOR-hi.slice(start,start+4).reduce((s,x,k)=>s+(k===j?0:x),0));
      const h=Math.min(hi[i],DENOMINATOR-lo.slice(start,start+4).reduce((s,x,k)=>s+(k===j?0:x),0));
      if(l>h)return null;if(l!==lo[i]||h!==hi[i])changed=true;lo[i]=l;hi[i]=h;
    }
  }
  if([0,4].some(s=>lo.slice(s,s+4).reduce((a,b)=>a+b,0)>DENOMINATOR||hi.slice(s,s+4).reduce((a,b)=>a+b,0)<DENOMINATOR))return null;
  return {lo,hi};
}
export function splitBox(box){
  let i=0;for(let j=1;j<8;j++)if(box.hi[j]-box.lo[j]>box.hi[i]-box.lo[i])i=j;
  if(box.hi[i]-box.lo[i]<=1)return [];
  const mid=Math.floor((box.lo[i]+box.hi[i])/2),a={lo:[...box.lo],hi:[...box.hi]},b={lo:[...box.lo],hi:[...box.hi]};
  a.hi[i]=mid;b.lo[i]=mid;return [tighten(a),tighten(b)].filter(Boolean);
}
/** Exact bounded-simplex support, upper-rounded fixed-point coefficients. */
export function rowUpper(coefficients,box,start){
  let value=0n,remaining=DENOMINATOR;
  for(let j=0;j<4;j++){value+=BigInt(box.lo[start+j])*coefficients[j];remaining-=box.lo[start+j];}
  const order=[0,1,2,3].sort((a,b)=>coefficients[a]>coefficients[b]?-1:coefficients[a]<coefficients[b]?1:0);
  for(const j of order){const add=Math.min(remaining,box.hi[start+j]-box.lo[start+j]);value+=BigInt(add)*coefficients[j];remaining-=add;}
  if(remaining)throw new Error('Infeasible simplex');return ceilDiv(value,BigInt(DENOMINATOR));
}
export function parameterBoundEngine(parameters,specification,horizon){
  const model=geometryModel(parameters),spec=supportSpecification(model,specification);
  const tail=fullInformationTail(model,specification,horizon).map(upperQ),M=BigInt(model.M);
  const terminals=Array.from({length:horizon+1},(_,t)=>model.nodes.map(node=>node.jam?upperQ(spec.reward(node,t)):null));
  const active=model.nodes.flatMap((node,i)=>node.jam?[]:[i]);
  return {model,horizon,bound(box){
    let values=tail.flatMap(x=>[x,x]);
    for(let t=horizon-1;t>=0;t--){
      const next=terminals[t].flatMap(x=>x===null?[0n,0n]:[x,x]);
      for(const i of active){
        const node=model.nodes[i],coefficients=[];
        for(let a=0;a<2;a++)for(let r=0;r<2;r++){
          let total=BigInt(model.M-node.legal[a])*values[2*i+r];
          for(const edge of node.successors[a])total+=BigInt(edge.multiplicity)*values[2*edge.target+r];
          coefficients.push(ceilDiv(total,M));
        }
        next[2*i]=rowUpper(coefficients,box,0);next[2*i+1]=rowUpper(coefficients,box,4);
      }
      values=next;
    }
    // Support is affine in pi. Label swapping lets either initial state be 0;
    // here max over both is retained explicitly, including proper boundary pi.
    return values[0]>values[1]?values[0]:values[1];
  }};
}
