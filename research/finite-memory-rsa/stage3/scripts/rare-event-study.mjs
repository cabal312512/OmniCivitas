/** Independent rare-entry diagnostics: original-law Monte Carlo versus
 * conditional Monte Carlo. No RSA experiment or old-stage replay is run.
 */
import { RNG } from '../../src/rng.mjs';
import { studentTQuantile } from '../../analysis/summarize.mjs';
import { phaseTypeAt, rareEntryKernel } from '../src/phase-type.mjs';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cases=[
  {s:1,r:1,epsilon:.01},{s:1,r:1,epsilon:.0001},{s:1,r:1,epsilon:.000001},
  {s:2,r:2,epsilon:.1},{s:2,r:2,epsilon:.01},{s:2,r:2,epsilon:.001},
  {s:3,r:3,epsilon:.1},{s:3,r:3,epsilon:.01},
  {s:3,r:2,epsilon:.01},{s:1,r:2,epsilon:.001},
].map((x,i)=>({...x,id:`s${x.s}-r${x.r}-e${x.epsilon}`,index:i,c:.5}));
const methods=['naive','conditional'],batches=100,drawsPerBatch=1000,seedStart=70000001;
const sourcePaths=[fileURLToPath(import.meta.url),resolve(ROOT,'src/phase-type.mjs'),resolve(ROOT,'../src/rng.mjs'),resolve(ROOT,'../src/exact.mjs'),resolve(ROOT,'../src/controllers.mjs'),resolve(ROOT,'../analysis/summarize.mjs')];
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
async function hashStream(p){const h=createHash('sha256');for await(const block of createReadStream(p))h.update(block);return h.digest('hex');}
const sources=sourcePaths.map(path=>({path:path.replaceAll('\\','/'),sha256:hash(path)}));
const output=resolve(ROOT,'data/rare-event');
if(existsSync(resolve(output,'design.json')))throw new Error('Existing rare-event study is preserved; do not silently rerun or replace it');
mkdirSync(output,{recursive:true});
const startedAtUTC=new Date().toISOString(),design={schemaVersion:1,startedAtUTC,cases,methods,batches,drawsPerBatch,seedStart,
  seedAllocation:'seed=70000001+caseIndex*100000+methodIndex*10000+batchIndex; one independent seeded stream per batch; draw index identifies each sample.',
  model:'T=1+B*G; B~Bernoulli(w=c*epsilon^s), G~Geometric(p=epsilon^r) on {1,2,...}, independent.',
  estimators:{naive:'Draw B and, only when B=1, G; observe original T.',conditional:'Draw G from the original conditional dwell law and use Y=1+w*G=E[T|G]. Known entry probability is integrated, not estimated.'},
  inference:'This is a fixed-model implementation/measurement diagnostic, not RSA packing confirmation. Each batch mean is an independent replicate. Pointwise t intervals may be invalid for unobserved rare tails; no new hypothesis tests are performed.',
  precisionTarget:{relativeError:.1,confidence:.95,chebyshev:'Known variance / (.05*.1^2*targetMean^2); a sufficient bound, not an exact sample-complexity optimum.'},
  numericalLimits:'32-bit midpoint uniform resolution; double-precision inverse geometric sampler; no arbitrary-precision or literal individual-transition timing claim.',sources};
writeFileSync(resolve(output,'design.json'),JSON.stringify(design,null,2)+'\n');
const designSha256=hash(resolve(output,'design.json'));
const gzip=createGzip({level:6}),drawsPath=resolve(output,'draws.csv.gz'),streamCompletion=pipeline(gzip,createWriteStream(drawsPath));
async function rawWrite(value){if(!gzip.write(value))await once(gzip,'drain');}
await rawWrite('case,method,batch,seed,draw,entry_sampled,dwell_sample,waiting_observation,estimate_value\n');
const batchRows=['case,method,batch,seed,n,mean,sd,se,ci_low,ci_high,contains_exact_mean,entry_count,min,max,relative_error'];
const results=[],critical=studentTQuantile(.975,drawsPerBatch-1);
let drawCount=0;
function geometric(p,rng){if(!(p>0&&p<=1))throw new RangeError('Invalid geometric success probability');const n=p===1?1:Math.floor(Math.log(rng.uniform())/Math.log1p(-p))+1;if(!Number.isSafeInteger(n))throw new RangeError('Unsafe integer geometric waiting observation');return n;}
function descriptive(values){const mean=values.reduce((a,b)=>a+b,0)/values.length;const variance=values.length>1?values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1):null;return {n:values.length,mean,sd:variance===null?null:Math.sqrt(variance),min:Math.min(...values),max:Math.max(...values)};}
function quantile(sorted,p){const t=p*(sorted.length-1),i=Math.floor(t);return sorted[i]+(t-i)*(sorted[Math.min(i+1,sorted.length-1)]-sorted[i]);}
try {
  for(const model of cases){
    const w=model.c*model.epsilon**model.s,p=model.epsilon**model.r,mu=1+w/p;
    const exact=phaseTypeAt({kernel:rareEntryKernel({entryPower:model.s,escapePower:model.r,entryConstant:'1/2'}),epsilon:String(model.epsilon),maxOrder:2});
    const naiveVar=w*(2-p-w)/(p*p),conditionalVar=w*w*(1-p)/(p*p),excess=w/p;
    if(Math.abs(exact.moments[0].value-mu)>1e-10*Math.max(1,mu))throw new Error('Independent exact mean disagrees');
    if(Math.abs((exact.moments[1].value-exact.moments[0].value**2)-naiveVar)>1e-10*Math.max(1,naiveVar))throw new Error('Independent exact variance disagrees');
    const methodsResult=[];
    for(let methodIndex=0;methodIndex<methods.length;methodIndex++){
      const method=methods[methodIndex],rows=[],methodStart=performance.now();
      for(let batch=0;batch<batches;batch++){
        const seed=seedStart+model.index*100000+methodIndex*10000+batch,rng=new RNG(seed);
        let mean=0,m2=0,min=Infinity,max=-Infinity,entryCount=0,text='';
        for(let draw=0;draw<drawsPerBatch;draw++){
          let dwell=null,waiting=null,entry=null,value;
          if(method==='naive'){entry=rng.uniform()<w;if(entry){dwell=geometric(p,rng);entryCount++;}waiting=1+(dwell??0);value=waiting;}
          else {dwell=geometric(p,rng);value=1+w*dwell;}
          const delta=value-mean;mean+=delta/(draw+1);m2+=delta*(value-mean);min=Math.min(min,value);max=Math.max(max,value);
          text+=`${model.id},${method},${batch},${seed},${draw},${entry===null?'forced':Number(entry)},${dwell??''},${waiting??''},${value}\n`;
        }
        await rawWrite(text);drawCount+=drawsPerBatch;
        const sd=Math.sqrt(m2/(drawsPerBatch-1)),se=sd/Math.sqrt(drawsPerBatch),ci=[mean-critical*se,mean+critical*se],contains=mu>=ci[0]&&mu<=ci[1],relativeError=(mean-mu)/mu;
        const row={batch,seed,n:drawsPerBatch,mean,sd,se,pointwise95CI:ci,containsExactMean:contains,entryCount:method==='naive'?entryCount:null,min,max,relativeError};rows.push(row);
        batchRows.push([model.id,method,batch,seed,drawsPerBatch,mean,sd,se,...ci,Number(contains),method==='naive'?entryCount:'',min,max,relativeError].join(','));
      }
      const variance=method==='naive'?naiveVar:conditionalVar,errors=rows.map(x=>x.relativeError),absErrors=errors.map(Math.abs).sort((a,b)=>a-b);
      const group={method,batches,draws:batches*drawsPerBatch,seedFirst:rows[0].seed,seedLast:rows.at(-1).seed,exactVariance:variance,
        theoreticalRelativeRMSE:Math.sqrt(variance/drawsPerBatch)/mu,observedRelativeRMSE:Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/batches),
        meanOfBatchMeans:descriptive(rows.map(x=>x.mean)),medianAbsoluteRelativeError:quantile(absErrors,.5),p95AbsoluteRelativeError:quantile(absErrors,.95),
        within10Percent:errors.filter(x=>Math.abs(x)<=.1).length,pointwise95Contains:rows.filter(x=>x.containsExactMean).length,
        zeroEntryBatches:method==='naive'?rows.filter(x=>x.entryCount===0).length:null,totalOriginalRareEntries:method==='naive'?rows.reduce((s,x)=>s+x.entryCount,0):null,
        knownVarianceChebyshevNForTotal10Percent95:Math.ceil(variance/(.05*.01*mu*mu)),
        knownVarianceChebyshevNForExcess10Percent95:Math.ceil(variance/(.05*.01*excess*excess)),elapsed_ms:performance.now()-methodStart,rows};
      methodsResult.push(group);
    }
    results.push({...model,w,p,exact,mean:mu,excessMean:excess,naiveVariance:naiveVar,conditionalVariance:conditionalVar,
      idealVarianceReduction:naiveVar/conditionalVar,probabilityNoEntryPerNaiveBatch:Math.exp(drawsPerBatch*Math.log1p(-w)),
      nToSeeEntryWith95Percent:Math.ceil(Math.log(.05)/Math.log1p(-w)),methods:methodsResult});
    console.log(JSON.stringify({case:model.id,mean:mu,naiveZeroBatches:methodsResult[0].zeroEntryBatches,naiveRelativeRMSE:methodsResult[0].observedRelativeRMSE,conditionalRelativeRMSE:methodsResult[1].observedRelativeRMSE}));
  }
  gzip.end();await streamCompletion;
  writeFileSync(resolve(output,'batches.csv'),batchRows.join('\n')+'\n');
  const finalSources=sourcePaths.map(path=>({path:path.replaceAll('\\','/'),sha256:hash(path)}));
  if(sources.some((x,i)=>x.sha256!==finalSources[i].sha256))throw new Error('Sources changed during diagnostics');
  const summary={schemaVersion:1,status:'complete',scope:design.inference,designSha256,draws:drawCount,batchReplicates:cases.length*methods.length*batches,results,
    limitations:'Conditional estimator is unbiased under the ideal independent B,G model; finite-precision PRNG implementation is an approximation. Its ideal variance advantage is algebraic, not a general guarantee for unknown RSA rare-entry probabilities. Empirical batch t coverage is a diagnostic, not a new corrected hypothesis family.'};
  writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  const files=await Promise.all(['design.json','draws.csv.gz','batches.csv','summary.json'].map(async name=>({name,sha256:await hashStream(resolve(output,name))})));
  writeFileSync(resolve(output,'manifest.json'),JSON.stringify({schemaVersion:1,status:'complete',startedAtUTC,completedAtUTC:new Date().toISOString(),runtime:process.version,platform:process.platform,architecture:process.arch,draws:drawCount,batchReplicates:cases.length*methods.length*batches,files,sources,sourceHashesUnchanged:true,seedRange:[seedStart,seedStart+(cases.length-1)*100000+10000+batches-1]},null,2)+'\n');
  console.log(JSON.stringify({status:'complete',output,draws:drawCount,batchReplicates:cases.length*methods.length*batches}));
} catch(error){gzip.destroy();await streamCompletion.catch(()=>{});writeFileSync(resolve(output,'manifest.json'),JSON.stringify({status:'failed',startedAtUTC,completedAtUTC:new Date().toISOString(),draws:drawCount,error:String(error),sources},null,2)+'\n');throw error;}
