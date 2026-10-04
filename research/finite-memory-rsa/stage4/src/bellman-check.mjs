import assert from 'node:assert/strict';
import { enumeratePlacements } from '../../src/exact.mjs';
import { Fraction, rational, ZERO, ONE, sum } from './rational.mjs';
const countBits=mask=>{let n=0;while(mask){mask&=mask-1;n++;}return n;};

/** Direct one-trial rational residual certificate; no matrix inverse or block recursion. */
export function checkBellmanCertificate(policy, result) {
  const {L,k,boundary}=result.parameters,placements=enumeratePlacements(L,k,boundary),M=placements[0].length;
  const table=new Map(result.bellmanCertificate.map(row=>[`${row.mask}:${row.h}`,row]));
  const visited=new Map(),queue=[];
  const add=(mask,h,q)=>{
    const key=`${mask}:${h}:${q}`;
    if(!visited.has(key)){const row={key,mask,h,q};visited.set(key,row);queue.push(row);}return key;
  };
  policy.initial.forEach((p,q)=>{if(!p.zero)add(0,0,q);});
  const reverse=new Map(),terminals=[];
  let checkedEquations=0;
  for(let cursor=0;cursor<queue.length;cursor++){
    const node=queue[cursor],record=table.get(`${node.mask}:${node.h}`),values=record?.values[node.q]?.map(rational);
    assert(values,'Missing reachable Bellman values');
    const legal=placements.map(row=>row.filter(p=>!(p&node.mask)));
    if(legal.every(row=>row.length===0)){
      const n=countBits(node.mask)/k;
      const truth=[new Fraction(BigInt(k*n),BigInt(L*L)),new Fraction(BigInt(Math.abs(2*node.h-n)),BigInt(n)),new Fraction(1n,BigInt(n)),ZERO];
      truth.forEach((x,j)=>assert(x.eq(values[j]),node.key));terminals.push(node.key);checkedEquations+=4;continue;
    }
    const nextValues=Array(4).fill(ZERO),rowMass=[];
    for(let action=0;action<2;action++)for(const p of placements[action]){
      const success=!(p&node.mask),matrix=success?policy.success[action]:policy.failure[action];
      for(let q=0;q<policy.n;q++){
        const mass=matrix[node.q][q].div(new Fraction(BigInt(M)));if(mass.zero)continue;
        const mask=success?node.mask|p:node.mask,h=node.h+Number(success&&action===0),key=add(mask,h,q);
        if(!reverse.has(key))reverse.set(key,new Set());reverse.get(key).add(node.key);
        const child=table.get(`${mask}:${h}`)?.values[q]?.map(rational);assert(child,'Missing successor value');
        child.forEach((x,j)=>nextValues[j]=nextValues[j].add(mass.mul(x)));rowMass.push(mass);
      }
    }
    assert(sum(rowMass).eq(ONE),'Transition row is not stochastic');
    nextValues[3]=nextValues[3].add(values[2]);
    nextValues.forEach((x,j)=>assert(x.eq(values[j]),`${node.key}: metric${j}`));checkedEquations+=4;
  }
  const good=new Set(terminals),todo=[...good];
  for(let i=0;i<todo.length;i++)for(const parent of reverse.get(todo[i])??[])if(!good.has(parent)){good.add(parent);todo.push(parent);}
  assert.equal(good.size,visited.size,'Reachable closed nonterminal class invalidates absorption certificate');
  const initial=table.get('0:0').values.map(row=>row?.map(rational));
  for(const [j,name] of ['coverage','absOrder','inverseN','attemptsPerParticle'].entries()){
    const value=sum(policy.initial.flatMap((p,q)=>p.zero?[]:[p.mul(initial[q][j])]));
    const expected=result.metrics[name];assert(value.eq(rational(`${expected.numerator}/${expected.denominator}`)),name);
  }
  return {status:'passed',reachableProductStates:visited.size,exactScalarEquations:checkedEquations,almostSureGeometricAbsorption:true,
    method:'Raw anchor enumeration, rational one-step residuals, reverse reachability to jam; no matrix inverse and no floating comparison.'};
}
