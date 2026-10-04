import { ZERO, ONE, sum, inverse } from './rational.mjs';
import { temporalController } from './temporal.mjs';
const multiply=(A,B)=>A.map(row=>B[0].map((_,j)=>sum(row.map((x,k)=>x.mul(B[k][j])))));
function basis(vectors) {
  const rows=[];
  for(const vector of vectors){
    let row=[...vector];
    for(const previous of rows){const c=row[previous.pivot];if(!c.zero)row=row.map((x,i)=>x.sub(c.mul(previous.values[i])));}
    const pivot=row.findIndex(x=>!x.zero);if(pivot<0)continue;
    const scale=row[pivot];row=row.map(x=>x.div(scale));rows.push({pivot,values:row});rows.sort((a,b)=>a.pivot-b.pivot);
  }
  return rows;
}
export function hankelRank(policy) {
  const n=policy.n,K=policy.success,reachable=[policy.initial],observable=[Array(n).fill(ONE)];
  let rows=basis(reachable),columns=basis(observable);
  while(true){const candidates=[...rows.map(x=>x.values)];for(const row of rows)for(const matrix of K)candidates.push(multiply([row.values],matrix)[0]);const next=basis(candidates);if(next.length===rows.length)break;rows=next;}
  while(true){const candidates=[...columns.map(x=>x.values)];for(const column of columns)for(const matrix of K)candidates.push(matrix.map(row=>sum(row.map((x,j)=>x.mul(column.values[j])))));const next=basis(candidates);if(next.length===columns.length)break;columns=next;}
  const H=rows.map(row=>columns.map(column=>sum(row.values.map((x,j)=>x.mul(column.values[j])))));
  const rank=basis(H).length;
  return {hankelRank:rank,declaredStates:n,reachableLinearDimension:rows.length,observableLinearDimension:columns.length,
    minimumPositiveStatesAtLeast:rank,minimumPositiveStatesExactly:rank===n?n:null,
    caveat:'Hankel rank is a linear-realization lower bound; if rank<n it need not be an achievable positive-HMM state count.'};
}
export function similarTemporal(policy,S) {
  if(S.length!==policy.n||S.some(row=>row.length!==policy.n||!sum(row).eq(ONE)))throw new RangeError('Similarity requires a square S with S1=1');
  const transformed=policy.success.map(K=>multiply(multiply(inverse(S),K),S));
  return temporalController({name:`${policy.name}-similar`,initial:multiply([policy.initial],S)[0],H:transformed[0],V:transformed[1]});
}
