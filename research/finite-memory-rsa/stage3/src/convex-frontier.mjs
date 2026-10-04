// Exploratory stronger null: an externally selected mixture of fixed controllers.
// This is not a claim that every mixture is realizable by one rooted deterministic FSM.
const combinations=(values,k)=>{const out=[];function go(a,start){if(a.length===k){out.push(a);return;}for(let i=start;i<=values.length-k+a.length;i++)go([...a,values[i]],i+1);}go([],0);return out;};
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);const n=b.length;
 for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;
 if(Math.abs(a[p][c])<1e-12)return null;[a[p],a[c]]=[a[c],a[p]];
 const scale=a[c][c];for(let j=c;j<=n;j++)a[c][j]/=scale;
 for(let r=0;r<n;r++)if(r!==c){const factor=a[r][c];for(let j=c;j<=n;j++)a[r][j]-=factor*a[c][j];}}
 return a.map(r=>r[n]);}
export function temporalMixtureDominates(target,points){
 const objective=p=>[-p.coverage,p.abs_order,p.cost],goal=objective(target);
 const converted=points.map(objective),ids=points.map((_,i)=>i);
 for(let m=1;m<=Math.min(4,points.length);m++)for(const subset of combinations(ids,m))for(const active of combinations([0,1,2],m-1)){
  const matrix=[Array(m).fill(1),...active.map(j=>subset.map(i=>converted[i][j]))],rhs=[1,...active.map(j=>goal[j])];
  const weights=solve(matrix,rhs);if(!weights||weights.some(w=>w< -1e-9))continue;
  const value=[0,1,2].map(j=>subset.reduce((s,i,k)=>s+weights[k]*converted[i][j],0));
  if(value.every((x,j)=>x<=goal[j]+1e-9*Math.max(1,Math.abs(goal[j]))))return {
    weights:subset.map((i,j)=>({controller:points[i].controller,weight:weights[j]})),
    coverage:-value[0],abs_order:value[1],cost:value[2],method:'3D vertex enumeration; at most four supporting points; numerical exploratory means'};
 }
 return null;
}
