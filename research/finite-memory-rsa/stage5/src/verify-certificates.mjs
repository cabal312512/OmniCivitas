import assert from 'node:assert/strict';
import { geometryModel } from '../../stage4/src/geometry-model.mjs';
import { supportSpecification } from '../../stage4/src/envelope.mjs';
import { rational,ONE,ZERO,Fraction,compare,sum } from '../../stage4/src/rational.mjs';
import { upperQ,ceilDiv,SCALE } from './fixed-point.mjs';
import { parameterBoundEngine,rootBox,splitBox } from './parameter-bound.mjs';
/** Independent placement enumeration: no imports from the old exact enumerator. */
export function rawPlacements({L,k,boundary}){
  return [0,1].map(a=>{const result=[];for(let y=0;y<L;y++)for(let x=0;x<L;x++){
    if(boundary==='open'&&(a?y:x)+k>L)continue;let mask=0;
    for(let j=0;j<k;j++){const xx=a?x:(x+j)%L,yy=a?(y+j)%L:y;mask|=1<<(yy*L+xx);}result.push(mask);
  }return result;});
}
function checkedGeometry(parameters){
  const model=geometryModel(parameters),placements=rawPlacements(parameters),lookup=new Map(model.nodes.map((x,i)=>[`${x.mask}:${x.h}`,i]));
  assert.equal(placements[0].length,model.M);
  const rows=model.nodes.map(node=>placements.map((anchors,a)=>anchors.map(p=>{
    const success=!(p&node.mask),mask=success?node.mask|p:node.mask,h=node.h+(success&&a===0?1:0),target=lookup.get(`${mask}:${h}`);
    assert.notEqual(target,undefined);return {success,target};
  })));
  model.nodes.forEach((node,i)=>{
    assert.deepEqual(rows[i].map(anchors=>anchors.filter(x=>x.success).length),node.legal);
    assert.equal(rows[i].every(anchors=>anchors.every(x=>!x.success)),node.jam);
  });return {model,rows};
}
export function verifyWordCertificate(certificate){
  const {model,rows}=checkedGeometry(certificate.parameters),M=BigInt(model.M),spec=supportSpecification(model,certificate.specification),tails=new Map();let tailInequalities=0;
  for(const entry of certificate.tailCertificates){
    const values=entry.values.map(rational);assert.equal(values.length,model.nodes.length);
    for(let i=0;i<model.nodes.length;i++){
      const node=model.nodes[i];if(node.jam){assert(values[i].eq(spec.reward(node,entry.t)));continue;}
      for(let a=0;a<2;a++)if(node.legal[a]){
        const lower=sum(rows[i][a].filter(x=>x.success).map(x=>values[x.target])).div(new Fraction(BigInt(node.legal[a])))
          .sub(spec.nu.mul(new Fraction(M,BigInt(model.Nmax*node.legal[a]))));
        assert(compare(values[i],lower)>=0);tailInequalities++;
      }
    }
    tails.set(entry.t,values.map(upperQ));
  }
  const l=rational(certificate.lower),cutoff=l.n*SCALE/l.d,parentStates=new Map(),children=new Map();let max=cutoff,checked=0;
  const advance=(state,a,t)=>{
    const counts=new Map();let absorbed=state.absorbed*M;const add=(i,n)=>counts.set(i,(counts.get(i)??0n)+n);
    for(const [i,c] of state.counts)for(const anchor of rows[i][a]){
      const target=model.nodes[anchor.target];if(anchor.success&&target.jam)absorbed+=c*upperQ(spec.reward(target,t));else add(anchor.target,c);
    }
    return {counts,absorbed,denominator:state.denominator*M};
  };
  certificate.records.forEach((record,id)=>{
    assert.equal(record.id,id);let previous;
    if(record.parent===-1){assert.equal(id,0);assert.equal(record.action,0);assert.equal(record.depth,1);previous={counts:new Map([[0,1n]]),absorbed:0n,denominator:1n};}
    else{
      assert(record.parent<id);assert.equal(certificate.records[record.parent].status,'expanded');previous=parentStates.get(record.parent);assert(previous);
      assert.equal(record.depth,certificate.records[record.parent].depth+1);
      const siblings=children.get(record.parent)??[];assert(!siblings.includes(record.action));siblings.push(record.action);children.set(record.parent,siblings);
    }
    const state=advance(previous,record.action,record.depth),values=tails.get(record.depth);assert(values);
    let reward=state.absorbed;for(const [i,c] of state.counts)reward+=c*values[i];const upper=ceilDiv(reward,state.denominator);
    assert.equal(upper.toString(),record.upper);checked++;
    if(record.status==='expanded')parentStates.set(id,state);
    else if(record.status==='pruned')assert(upper<=cutoff);else if(upper>max)max=upper;
    if(record.parent>=0&&children.get(record.parent).length===2)parentStates.delete(record.parent);
  });
  for(const record of certificate.records)if(record.status==='expanded')assert.deepEqual([...children.get(record.id)].sort(),[0,1]);
  assert.equal(max.toString(),certificate.upperFixed);
  return {status:'passed',prefixBounds:checked,tailInequalities,method:'Independent raw-anchor propagation, exact rational suffix supersolution inequalities, complete prefix partition; no word-bound engine call.'};
}
/** LP dual upper, separately used against the greedy bounded-simplex routine. */
export function rowDual(coefficients,box,start){
  const candidates=coefficients.map(lambda=>{
    let value=lambda*BigInt(1<<20);
    for(let j=0;j<4;j++){const d=coefficients[j]-lambda;value+=d*BigInt(d>=0n?box.hi[start+j]:box.lo[start+j]);}
    return ceilDiv(value,BigInt(1<<20));
  });return candidates.reduce((a,b)=>a<b?a:b);
}
export function verifyParameterCertificate(certificate,{replayLeafBounds=true}={}){
  checkedGeometry(certificate.parameters);
  const engine=parameterBoundEngine(certificate.parameters,certificate.specification,certificate.horizon),children=new Map();
  const l=rational(certificate.lower),cutoff=l.n*SCALE/l.d;let max=cutoff,leaves=0,replayed=0;
  assert.deepEqual(certificate.records[0].box,rootBox());assert.equal(certificate.records[0].parent,-1);
  certificate.records.forEach((record,id)=>{
    assert.equal(id,record.id);
    if(record.parent>=0){assert(record.parent<id);const list=children.get(record.parent)??[];list.push(record.box);children.set(record.parent,list);}
    if(record.status==='expanded')return;
    leaves++;const upper=BigInt(record.upper);
    if(replayLeafBounds){assert.equal(engine.bound(record.box).toString(),record.upper);replayed++;}
    if(record.status==='pruned')assert(upper<=cutoff);else if(upper>max)max=upper;
  });
  for(const record of certificate.records)if(record.status==='expanded')assert.deepEqual(children.get(record.id),splitBox(record.box));
  assert.equal(max.toString(),certificate.upperFixed);
  return {status:'passed',partitionBoxes:certificate.records.length,leaves,replayedLeafBounds:replayed,
    method:'Full dyadic simplex partition and every retained/pruned leaf bound replay. Bellman engine shared; independent raw geometry and LP-dual tests supplement it.'};
}
