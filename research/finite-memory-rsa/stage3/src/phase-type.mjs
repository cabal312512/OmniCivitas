/** Exact polynomial failure kernels and discrete phase-type moments.
 * No simulation, no package imports. Stage I Fraction is a read-only helper.
 * Coefficients are ordered from epsilon^0 upward. An entry [1,-1] is 1-epsilon.
 */
import { Fraction } from '../../src/exact.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ZERO=new Fraction(), ONE=new Fraction(1n);
export function rational(value) {
  if(value instanceof Fraction)return value;
  if(value&&typeof value==='object'&&'numerator' in value)return new Fraction(value.numerator,value.denominator);
  const s=String(value),f=s.match(/^([+-]?\d+)\/(\d+)$/);
  if(f)return new Fraction(f[1],f[2]);
  const m=s.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if(!m)throw new TypeError(`Invalid rational ${s}`);
  const tail=m[3]??'',power=Number(m[4]??0)-tail.length;
  if(!Number.isSafeInteger(power)||Math.abs(power)>1000)throw new RangeError('Rational exponent too large');
  const n=BigInt(m[2]+tail)*(m[1]==='-'?-1n:1n);
  return power>=0?new Fraction(n*10n**BigInt(power)):new Fraction(n,10n**BigInt(-power));
}
const sum=xs=>xs.reduce((s,x)=>s.add(x),ZERO);
const negate=x=>ZERO.sub(x);
export class Polynomial {
  constructor(coefficients=[ZERO]) {
    this.c=(Array.isArray(coefficients)?coefficients:[coefficients]).map(rational);
    while(this.c.length>1&&this.c.at(-1).zero)this.c.pop();
    if(!this.c.length)this.c=[ZERO];
  }
  static of(x){return x instanceof Polynomial?x:new Polynomial(Array.isArray(x)?x:[x]);}
  get zero(){return this.c.length===1&&this.c[0].zero;}
  get degree(){return this.zero?-1:this.c.length-1;}
  get valuation(){return this.zero?null:this.c.findIndex(x=>!x.zero);}
  add(x){x=Polynomial.of(x);return new Polynomial(Array.from({length:Math.max(this.c.length,x.c.length)},(_,i)=>(this.c[i]??ZERO).add(x.c[i]??ZERO)));}
  sub(x){return this.add(Polynomial.of(x).scale(-1));}
  scale(x){x=rational(x);return new Polynomial(this.c.map(v=>v.mul(x)));}
  mul(x){x=Polynomial.of(x);const c=Array.from({length:this.c.length+x.c.length-1},()=>ZERO);for(let i=0;i<this.c.length;i++)for(let j=0;j<x.c.length;j++)c[i+j]=c[i+j].add(this.c[i].mul(x.c[j]));return new Polynomial(c);}
  divmod(x){x=Polynomial.of(x);if(x.zero)throw new RangeError('Zero polynomial divisor');let r=this;const q=Array.from({length:Math.max(1,this.degree-x.degree+1)},()=>ZERO);while(!r.zero&&r.degree>=x.degree){const j=r.degree-x.degree,v=r.c.at(-1).div(x.c.at(-1));q[j]=q[j].add(v);const t=Array.from({length:j+x.c.length},()=>ZERO);for(let i=0;i<x.c.length;i++)t[j+i]=x.c[i].mul(v);r=r.sub(new Polynomial(t));}return {q:new Polynomial(q),r};}
  exactDiv(x){const {q,r}=this.divmod(x);if(!r.zero)throw new Error('Nonexact polynomial division');return q;}
  evaluate(x){x=rational(x);let v=ZERO;for(let i=this.c.length-1;i>=0;i--)v=v.mul(x).add(this.c[i]);return v;}
  eq(x){return this.sub(x).zero;}
  toJSON(){return {coefficients:this.c.map(x=>x.toJSON()),valuation:this.valuation,degree:this.degree};}
}
const P0=new Polynomial(),P1=new Polynomial([1]);
function polynomialGCD(a,b){while(!b.zero){[a,b]=[b,a.divmod(b).r];}return a.zero?P1:a.scale(ONE.div(a.c.at(-1)));}
export class RationalFunction {
  constructor(numerator=0,denominator=1){let n=Polynomial.of(numerator),d=Polynomial.of(denominator);if(d.zero)throw new RangeError('Zero rational-function denominator');if(n.zero){this.n=P0;this.d=P1;return;}const g=polynomialGCD(n,d);n=n.exactDiv(g);d=d.exactDiv(g);const scale=ONE.div(d.c.at(-1));this.n=n.scale(scale);this.d=d.scale(scale);}
  static of(x){return x instanceof RationalFunction?x:new RationalFunction(x);}
  get zero(){return this.n.zero;}
  add(x){x=RationalFunction.of(x);return new RationalFunction(this.n.mul(x.d).add(x.n.mul(this.d)),this.d.mul(x.d));}
  sub(x){x=RationalFunction.of(x);return new RationalFunction(this.n.mul(x.d).sub(x.n.mul(this.d)),this.d.mul(x.d));}
  mul(x){x=RationalFunction.of(x);return new RationalFunction(this.n.mul(x.n),this.d.mul(x.d));}
  div(x){x=RationalFunction.of(x);return new RationalFunction(this.n.mul(x.d),this.d.mul(x.n));}
  evaluate(e){return this.n.evaluate(e).div(this.d.evaluate(e));}
  eq(x){return this.sub(x).zero;}
  leading(){if(this.zero)return {zero:true,power:null,poleOrder:null,constant:ZERO.toJSON()};const power=this.n.valuation-this.d.valuation;return {zero:false,power,poleOrder:power===0?0:-power,constant:this.n.c[this.n.valuation].div(this.d.c[this.d.valuation]).toJSON()};}
  toJSON(){return {numerator:this.n.toJSON(),denominator:this.d.toJSON(),leading:this.leading()};}
}

export function determinantPolynomial(matrix){
  const n=matrix.length;if(!n)return P1;
  if(matrix.some(row=>row.length!==n))throw new RangeError('Square matrix required');
  const a=matrix.map(row=>row.map(Polynomial.of));let previous=P1,sign=1;
  for(let k=0;k<n-1;k++){
    const pivot=a.findIndex((row,i)=>i>=k&&!row[k].zero);if(pivot<0)return P0;
    if(pivot!==k){[a[pivot],a[k]]=[a[k],a[pivot]];sign=-sign;}
    const p=a[k][k];
    for(let i=k+1;i<n;i++){for(let j=k+1;j<n;j++)a[i][j]=a[i][j].mul(p).sub(a[i][k].mul(a[k][j])).exactDiv(previous);a[i][k]=P0;}
    previous=p;
  }
  return a[n-1][n-1].scale(sign);
}
function solveExact(matrix,rhs){
  const n=matrix.length,a=matrix.map((row,i)=>[...row.map(RationalFunction.of),RationalFunction.of(rhs[i])]);
  for(let k=0;k<n;k++){
    const p=a.findIndex((row,i)=>i>=k&&!row[k].zero);if(p<0)throw new RangeError('Singular failure system; absorption not certified');
    if(p!==k)[a[p],a[k]]=[a[k],a[p]];
    const scale=a[k][k];for(let j=k;j<=n;j++)a[k][j]=a[k][j].div(scale);
    for(let i=0;i<n;i++)if(i!==k){const f=a[i][k];if(!f.zero)for(let j=k;j<=n;j++)a[i][j]=a[i][j].sub(f.mul(a[k][j]));}
  }
  return a.map(row=>row[n]);
}
const choose=(n,k)=>{let x=1n;for(let i=1;i<=k;i++)x=x*BigInt(n-i+1)/BigInt(i);return x;};
function bernsteinNonnegative(poly){
  if(poly.zero)return true;const d=poly.degree;
  return Array.from({length:d+1},(_,j)=>sum(poly.c.slice(0,j+1).map((v,k)=>v.mul(new Fraction(choose(j,k),choose(d,k)))))).every(x=>x.n>=0n);
}
function matrixAndInitial(kernel,initial){
  const n=kernel.length;if(!Number.isInteger(n)||n<1||n>8||kernel.some(row=>row.length!==n))throw new RangeError('A square kernel with 1..8 states is required');
  const F=kernel.map(row=>row.map(Polynomial.of));
  let rho;if(Number.isInteger(initial)){if(initial<0||initial>=n)throw new RangeError('Invalid initial state');rho=Array.from({length:n},(_,i)=>Polynomial.of(i===initial?1:0));}
  else {if(!Array.isArray(initial)||initial.length!==n)throw new RangeError('Initial vector length mismatch');rho=initial.map(Polynomial.of);}
  return {F,rho};
}
export function certifyKernel({kernel,initial=0}){
  const {F,rho}=matrixAndInitial(kernel,initial),leaks=F.map(row=>P1.sub(row.reduce((s,p)=>s.add(p),P0))),initialAbsorbed=P1.sub(rho.reduce((s,p)=>s.add(p),P0));
  const entries=F.every(row=>row.every(bernsteinNonnegative)),rowLeaks=leaks.every(bernsteinNonnegative),initialWeights=rho.every(bernsteinNonnegative)&&bernsteinNonnegative(initialAbsorbed);
  return {certifiedOnUnitInterval:entries&&rowLeaks&&initialWeights,entries,rowLeaks,initialWeights,method:'Exact nonnegative Bernstein coefficients are sufficient, not necessary, on [0,1].',leaks};
}
function reachableIndices(F,rho){const seen=new Set(rho.flatMap((x,i)=>x.zero?[]:[i])),todo=[...seen];for(let k=0;k<todo.length;k++)for(let j=0;j<F.length;j++)if(!F[todo[k]][j].zero&&!seen.has(j)){seen.add(j);todo.push(j);}return [...seen].sort((a,b)=>a-b);}
export function phaseTypeMoments({kernel,initial=0,maxOrder=4,requireCertificate=true}){
  if(!Number.isInteger(maxOrder)||maxOrder<1||maxOrder>6)throw new RangeError('Moment order must be 1..6');
  const {F:full,rho:fullRho}=matrixAndInitial(kernel,initial),certificate=certifyKernel({kernel,initial});
  if(requireCertificate&&!certificate.certifiedOnUnitInterval)throw new RangeError('No unit-interval substochastic certificate; provide an independently justified interval and requireCertificate:false');
  const states=reachableIndices(full,fullRho),F=states.map(i=>states.map(j=>full[i][j])),rho=states.map(i=>fullRho[i]);
  if(!states.length)return {states,certificate,determinant:P1,moments:Array.from({length:maxOrder},()=>new RationalFunction(0)),stateMoments:[],meanNumerators:[]};
  const A=F.map((row,i)=>row.map((p,j)=>Polynomial.of(i===j?1:0).sub(p))),D=determinantPolynomial(A);
  if(D.zero)throw new RangeError('Identically nonabsorbing reachable failure kernel');
  const stateMoments=[],moments=[];
  for(let j=1;j<=maxOrder;j++){
    const rhs=F.map(row=>row.reduce((v,f,k)=>{for(let l=1;l<j;l++)v=v.add(RationalFunction.of(f).mul(stateMoments[l-1][k]).mul(new Fraction(choose(j,l))));return v;},new RationalFunction(1)));
    const mj=solveExact(A,rhs);stateMoments.push(mj);moments.push(mj.reduce((v,x,i)=>v.add(x.mul(rho[i])),new RationalFunction(0)));
  }
  const meanNumerators=states.map((_,j)=>determinantPolynomial(A.map(row=>row.map((p,k)=>k===j?P1:p))));
  return {states,certificate,determinant:D,meanNumerators,stateMoments,moments,convention:'T=number of transitions including absorption; initial mass missing from rho is already absorbed at T=0. Moment Laurent exponents are exact algebra, not evidence of packing superiority.'};
}

export function phaseTypeAt({kernel,epsilon,initial=0,maxOrder=4}){
  const e=rational(epsilon);if(e.n<0n||e.n>e.d)throw new RangeError('epsilon outside [0,1]');
  const {F,rho}=matrixAndInitial(kernel,initial),numeric=F.map(row=>row.map(p=>p.evaluate(e))),initialNumeric=rho.map(p=>p.evaluate(e));
  if(numeric.some(row=>row.some(x=>x.n<0n)||sum(row).n>sum(row).d)||initialNumeric.some(x=>x.n<0n)||sum(initialNumeric).n>sum(initialNumeric).d)throw new RangeError('Invalid numeric substochastic kernel');
  const states=reachableIndices(numeric,initialNumeric),seen=new Set(states),good=new Set();
  // A state is good if its support graph can reach a row with success leak.
  for(const i of states)if(!ONE.sub(sum(numeric[i])).zero)good.add(i);
  let changed=true;while(changed){changed=false;for(const i of states)if(!good.has(i)&&numeric[i].some((p,j)=>!p.zero&&good.has(j))){good.add(i);changed=true;}}
  // No success path is stronger than the full BSCC test; to detect leaking
  // paths that ALSO reach a closed class, solve absorption probability exactly.
  const transient=states.filter(i=>good.has(i)),A=transient.map(i=>transient.map(j=>new Polynomial([i===j?ONE.sub(numeric[i][j]):negate(numeric[i][j])]))),rhs=transient.map(i=>new Polynomial([ONE.sub(sum(numeric[i]))]));
  const prob=transient.length?solveExact(A,rhs).map(x=>x.evaluate(0)):[];
  let absorption=ONE.sub(sum(initialNumeric));for(let k=0;k<transient.length;k++)absorption=absorption.add(initialNumeric[transient[k]].mul(prob[k]));
  const almostSure=absorption.eq(ONE);
  if(!almostSure)return {epsilon:e.toJSON(),states,almostSure:false,absorptionProbability:absorption.toJSON(),moments:Array.from({length:maxOrder},()=>null),unreachableClosedStates:F.map((_,i)=>i).filter(i=>!seen.has(i)),convention:'Infinite unconditional moments when nonabsorption has positive probability.'};
  const result=phaseTypeMoments({kernel:numeric,initial:initialNumeric,maxOrder,requireCertificate:true});
  return {epsilon:e.toJSON(),states,almostSure:true,absorptionProbability:absorption.toJSON(),moments:result.moments.map(x=>x.evaluate(0).toJSON())};
}
export function phaseTypeSurvival({kernel,epsilon,initial=0,attempts}){
  if(!Number.isSafeInteger(attempts)||attempts<0)throw new RangeError('Nonnegative integer attempt count required');
  const {F,rho}=matrixAndInitial(kernel,initial),e=rational(epsilon),n=F.length;
  let matrix=F.map(row=>row.map(p=>p.evaluate(e))),result=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?ONE:ZERO)),power=attempts;
  const multiply=(a,b)=>a.map(row=>row.map((_,j)=>sum(row.map((x,k)=>x.mul(b[k][j])))));
  while(power){if(power%2)result=multiply(result,matrix);power=Math.floor(power/2);if(power)matrix=multiply(matrix,matrix);}
  return sum(rho.map((p,i)=>p.evaluate(e).mul(sum(result[i])))).toJSON();
}

/** Independent positive tree/forest enumeration, intentionally capped at n<=6. */
export function forestMeanCertificate({kernel}){
  const {F}=matrixAndInitial(kernel,0),n=F.length;if(n>6)throw new RangeError('Forest enumeration capped at six states');
  const leak=F.map(row=>P1.sub(row.reduce((s,p)=>s.add(p),P0))),edges=F.map((row,i)=>[...row.flatMap((p,j)=>i===j||p.zero?[]:[{to:j,weight:p}]),...(leak[i].zero?[]:[{to:n,weight:leak[i]}])]);
  const enumerate=(root,callback)=>{
    const nonroots=Array.from({length:n},(_,i)=>i).filter(i=>i!==root),next=Array(n).fill(null);
    const visit=(k,weight)=>{if(k<nonroots.length){const i=nonroots[k];for(const edge of edges[i]){next[i]=edge.to;visit(k+1,weight.mul(edge.weight));}return;}
      const roots=[];for(let i=0;i<n;i++){let j=i,seen=new Set();while(j!==n&&j!==root){if(seen.has(j))return;seen.add(j);j=next[j];}roots[i]=j;}callback(roots,weight);
    };visit(0,P1);
  };
  let tree=P0,treeCount=0;enumerate(null,(_,w)=>{tree=tree.add(w);treeCount++;});
  const numerators=Array.from({length:n},()=>Array.from({length:n},()=>P0)),forestCounts=Array.from({length:n},()=>Array(n).fill(0));
  for(let j=0;j<n;j++)enumerate(j,(roots,w)=>{for(let i=0;i<n;i++)if(roots[i]===j){numerators[i][j]=numerators[i][j].add(w);forestCounts[i][j]++;}});
  const meanNumerators=numerators.map(row=>row.reduce((s,p)=>s.add(p),P0));
  const A=F.map((row,i)=>row.map((p,j)=>Polynomial.of(i===j?1:0).sub(p))),det=determinantPolynomial(A);
  if(!tree.eq(det))throw new Error('Tree/determinant identity failed');
  const cramer=Array.from({length:n},(_,j)=>determinantPolynomial(A.map(row=>row.map((p,k)=>j===k?P1:p))));
  if(meanNumerators.some((p,i)=>!p.eq(cramer[i])))throw new Error('Forest/Cramer identity failed');
  const costs=Array(n+1).fill(Infinity);costs[n]=0;
  for(let round=0;round<n;round++)for(let i=0;i<n;i++)for(const edge of edges[i])costs[i]=Math.min(costs[i],edge.weight.valuation+costs[edge.to]);
  return {tree,treeCount,forestNumerators:numerators,forestCounts,meanNumerators,meanLeading:meanNumerators.map(p=>tree.zero?null:new RationalFunction(p,tree).leading()),shortestEscapeWeight:costs.slice(0,n).map(x=>Number.isFinite(x)?x:null),identityVerified:true,interpretation:'Mean exponent is tree valuation minus eligible two-root-forest valuation; it is generally NOT shortest escape-path weight.'};
}

export function consecutiveExplorationKernel(steps,{legalHazard='1/2'}={}){
  if(!Number.isInteger(steps)||steps<1||steps>6)throw new RangeError('steps 1..6 required');
  const n=steps+1,F=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<steps;i++){F[i][0]=[1,-1];F[i][i+1]=[0,1];}F[steps][steps]=ONE.sub(rational(legalHazard));
  return F;
}
export function persistentExplorationKernel(steps,{legalHazard='1/2'}={}){
  if(!Number.isInteger(steps)||steps<1||steps>6)throw new RangeError('steps 1..6 required');
  const n=steps+1,F=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<steps;i++){F[i][i]=[1,-1];F[i][i+1]=[0,1];}F[steps][steps]=ONE.sub(rational(legalHazard));return F;
}
export function rareEntryKernel({entryPower,escapePower,entryConstant='1/2'}){
  if(!Number.isInteger(entryPower)||!Number.isInteger(escapePower)||entryPower<1||escapePower<1||entryPower>12||escapePower>12)throw new RangeError('Positive powers 1..12 required');
  const c=rational(entryConstant);if(c.n<=0n||c.n>c.d)throw new RangeError('entryConstant must lie in (0,1]');
  const w=Array(entryPower+1).fill(0);w[entryPower]=c;const stay=Array(escapePower+1).fill(0);stay[0]=1;stay[escapePower]=-1;
  return [[0,w],[0,stay]];
}
export function theoryStudy(){
  const models=[{name:'persistent-two-step',kernel:persistentExplorationKernel(2)},
    ...[1,2,3].map(r=>({name:`reset-${r}-step`,kernel:consecutiveExplorationKernel(r)})),
    ...[{s:1,r:1},{s:2,r:2},{s:3,r:2},{s:1,r:2},{s:3,r:3}].map(({s,r})=>({name:`rare-entry-s${s}-r${r}`,kernel:rareEntryKernel({entryPower:s,escapePower:r})}))];
  return {schemaVersion:1,scope:'Fixed-geometry failure-kernel theory; not RSA candidate screening or a new packing test.',models:models.map(model=>({name:model.name,kernel:model.kernel.map(row=>row.map(x=>Polynomial.of(x))),exact:phaseTypeMoments({kernel:model.kernel}),forest:forestMeanCertificate({kernel:model.kernel}),zeroEndpoint:phaseTypeAt({kernel:model.kernel,epsilon:0}),values:['1/2','1/10','1/100','1/10000'].map(e=>phaseTypeAt({kernel:model.kernel,epsilon:e}))}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=resolve(dirname(fileURLToPath(import.meta.url)),'../data/theory/phase-type.json');mkdirSync(dirname(output),{recursive:true});
  if(readFileSyncSafe(output))throw new Error('Existing theory output is preserved; use an explicit fresh study version');
  const study=theoryStudy();study.generatedAtUTC=new Date().toISOString();study.runtime=process.version;study.sourceSha256=createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
  writeFileSync(output,JSON.stringify(study,null,2)+'\n');console.log(JSON.stringify({output,models:study.models.length,sourceSha256:study.sourceSha256}));
}
function readFileSyncSafe(path){try{readFileSync(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
