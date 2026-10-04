// Educational browser model. It does not modify or rerun archived research.
export function seededRandom(seed=20261004){let value=seed>>>0;return()=>{value=(value+0x6D2B79F5)>>>0;let t=Math.imul(value^(value>>>15),1|value);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
export class AdsorptionDemo{
 constructor({L=24,k=2,boundary='periodic',policy='feedback',alpha=.02,beta=1,seed=20261004}={}){
  if(!Number.isInteger(L)||L<3||L>64||!Number.isInteger(k)||k<2||k>L)throw new RangeError('Invalid demonstration geometry');
  if(!['periodic','open'].includes(boundary)||!['feedback','temporal','iid'].includes(policy)||![alpha,beta].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw new RangeError('Invalid demonstration rule');
  Object.assign(this,{L,k,boundary,policy,alpha,beta,seed});this.rng=seededRandom(seed);this.cells=new Uint8Array(L*L);this.direction=0;this.attempts=0;this.nH=0;this.nV=0;this.last=[];this.jammed=false;this.budgetStopped=false;
 }
 positions(a,x,y){return Array.from({length:this.k},(_,i)=>((y+(a?i:0))%this.L)*this.L+(x+(a?0:i))%this.L);}
 hasLegal(a){const xs=a?this.L:this.boundary==='open'?this.L-this.k+1:this.L,ys=a&&this.boundary==='open'?this.L-this.k+1:this.L;
  for(let y=0;y<ys;y++)for(let x=0;x<xs;x++)if(this.positions(a,x,y).every(i=>!this.cells[i]))return true;return false;}
 step(count=1){
  if(!Number.isInteger(count)||count<0||count>1000)throw new RangeError('Bounded demonstration batch required');
  if(this.jammed||this.budgetStopped)return this.snapshot();
  for(let j=0;j<count;j++){
   const a=this.direction,x=Math.floor(this.rng()*(this.boundary==='open'&&!a?this.L-this.k+1:this.L)),y=Math.floor(this.rng()*(this.boundary==='open'&&a?this.L-this.k+1:this.L));
   const positions=this.positions(a,x,y),success=positions.every(i=>!this.cells[i]);this.attempts++;
   if(success){for(const i of positions)this.cells[i]=a+1;if(a)this.nV++;else this.nH++;}
   this.last.push({a,success,x,y});if(this.last.length>42)this.last.shift();
   if(this.policy==='feedback'){if(this.rng()<(success?this.alpha:this.beta))this.direction=1-a;}
   else if(this.policy==='temporal'){if(this.rng()<(a?this.beta:this.alpha))this.direction=1-a;}
   else this.direction=Number(this.rng()>=.5);
   if(this.attempts>=100000){this.budgetStopped=true;break;}
  }
  this.jammed=!this.hasLegal(0)&&!this.hasLegal(1);if(this.jammed)this.budgetStopped=false;return this.snapshot();
 }
 snapshot(){const N=this.nH+this.nV;return {L:this.L,k:this.k,boundary:this.boundary,policy:this.policy,attempts:this.attempts,N,nH:this.nH,nV:this.nV,coverage:N*this.k/(this.L*this.L),order:N?Math.abs(this.nH-this.nV)/N:0,cost:N?this.attempts/N:0,direction:this.direction,jammed:this.jammed,budgetStopped:this.budgetStopped};}
}
export function normalizedKernel(weights){
 if(weights.length!==8||weights.some(x=>!Number.isFinite(x)||x<0))throw new RangeError('Eight nonnegative weights required');
 const rows=[weights.slice(0,4),weights.slice(4)],sums=rows.map(row=>row.reduce((a,b)=>a+b,0));
 if(sums.some(sum=>sum===0))throw new RangeError('Each probability row needs positive mass');
 const p=rows.map((row,i)=>row.map(x=>x/sums[i]));return {H:[[p[0][0],p[0][1]],[p[1][0],p[1][1]]],V:[[p[0][2],p[0][3]],[p[1][2],p[1][3]]]};
}
export function wordProbability(kernel,word,initial=[1,0]){
 if(!/^[HV]*$/.test(word))throw new RangeError('Words contain only H and V');
 let row=[...initial];for(const action of word){const K=kernel[action];row=[row[0]*K[0][0]+row[1]*K[1][0],row[0]*K[0][1]+row[1]*K[1][1]];}return row[0]+row[1];
}
export function reward(metrics,mu,nu){return metrics.coverage.value-mu*metrics.absOrder.value-nu*metrics.attemptsPerParticle.value;}
export function terminalAtoms(law){return law.map(atom=>{const [mask,h]=atom.key.split(':').map(Number);let bits=mask,n=0;while(bits){bits&=bits-1;n++;}return {...atom,mask,h,N:n/2,p:atom.probability.value};});}
export function probabilityTiles(atoms,width,height){
 const output=[];
 function split(rows,x,y,w,h){if(!rows.length)return;if(rows.length===1){output.push({...rows[0],x,y,w,h});return;}
  const total=rows.reduce((s,row)=>s+row.p,0);let count=1,sum=rows[0].p;while(count<rows.length-1&&sum<total/2){sum+=rows[count++].p;}
  const fraction=sum/total;if(w>=h){split(rows.slice(0,count),x,y,w*fraction,h);split(rows.slice(count),x+w*fraction,y,w*(1-fraction),h);}else{split(rows.slice(0,count),x,y,w,h*fraction);split(rows.slice(count),x,y+h*fraction,w,h*(1-fraction));}
 }
 split([...atoms].sort((a,b)=>b.p-a.p),0,0,width,height);return output;
}
