import fs from 'node:fs';
import path from 'node:path';
import { RNG } from '../../src/rng.mjs';
import { splitContribution, productLevelRelativeVariance } from '../src/splitting.mjs';
import { stageRoot, hash } from './preservation.mjs';
const output=path.join(stageRoot,'results/unknown-entry-splitting.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite splitting benchmark');
const designFile=path.join(stageRoot,'experiments/splitting-design.json'), design=JSON.parse(fs.readFileSync(designFile));
const raw=['model,method,batch,seed,draw,conditional_dwell'], summaries=[], results=[];
const geometric=(p,rng)=>Math.floor(Math.log(rng.uniform())/Math.log1p(-p))+1;
for(let modelIndex=0;modelIndex<design.models.length;modelIndex++){
  const model=design.models[modelIndex],w=model.epsilon**model.levels,p=w,mean=w/p;
  const methods=[];
  for(let methodIndex=0;methodIndex<2;methodIndex++){
    const batches=[];
    for(let batch=0;batch<design.batches;batch++){
      const seed=design.seedStart+modelIndex*100000+methodIndex*10000+batch,rng=new RNG(seed);
      let result;
      if(methodIndex===0){
        let total=0,entries=0,oracleCalls=0;
        for(let draw=0;draw<design.naiveTrialsPerBatch;draw++){
          let entered=true;
          for(let level=0;level<model.levels;level++){oracleCalls++;if(rng.uniform()>=model.epsilon){entered=false;break;}}
          if(entered){const dwell=geometric(p,rng);oracleCalls++;total+=dwell;entries++;raw.push(`${modelIndex},naive,${batch},${seed},${draw},${dwell}`);}
        }
        result={entryEstimate:entries/design.naiveTrialsPerBatch,contribution:total/design.naiveTrialsPerBatch,
          entries,oracleCalls,resamplingDraws:0,zeroEntry:entries===0};
      }else{
        result=splitContribution({particles:design.particles,levels:model.levels,initialState:()=>0,
          advanceLevel:(state,level,stream)=>stream.uniform()<model.epsilon?state+1:null,
          terminalMark:(_,stream)=>geometric(p,stream),rng,
          recordMark:(draw,dwell)=>raw.push(`${modelIndex},splitting,${batch},${seed},${draw},${dwell}`)});
      }
      batches.push({batch,seed,...result});summaries.push({model:modelIndex,method:methodIndex?'splitting':'naive',batch,seed,...result});
    }
    const theoreticalRelativeVariance=methodIndex===0?(2-p-w)/(design.naiveTrialsPerBatch*w):
      productLevelRelativeVariance({conditionalProbabilities:Array(model.levels).fill(model.epsilon),particles:design.particles,geometricHazard:p});
    methods.push({method:methodIndex?'splitting':'naive',batches,
      theoreticalRelativeRMSE:Math.sqrt(theoreticalRelativeVariance),
      observedRelativeRMSE:Math.sqrt(batches.reduce((a,x)=>a+(x.contribution/mean-1)**2,0)/batches.length),
      mean:batches.reduce((a,x)=>a+x.contribution,0)/batches.length,
      zeroEntryBatches:batches.filter(x=>x.entryEstimate===0).length,
      simulatorCalls:batches.reduce((a,x)=>a+x.oracleCalls,0),resamplingDraws:batches.reduce((a,x)=>a+x.resamplingDraws,0)});
  }
  results.push({model,entryProbabilityForValidation:w,dwellHazard:p,exactMeanContribution:mean,methods});
  console.log(JSON.stringify({epsilon:model.epsilon,methods:methods.map(x=>({method:x.method,mean:x.mean,zero:x.zeroEntryBatches,observedRMSE:x.observedRelativeRMSE,theoreticalRMSE:x.theoreticalRelativeRMSE}))}));
}
const rawFile='data/splitting-dwell.csv',batchFile='data/splitting-batches.json';
fs.writeFileSync(path.join(stageRoot,rawFile),raw.join('\n')+'\n');
fs.writeFileSync(path.join(stageRoot,batchFile),JSON.stringify(summaries,null,2)+'\n');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,completedAtUTC:new Date().toISOString(),designSha256:hash(fs.readFileSync(designFile)),results,
  batches:summaries.length,retainedConditionalDwells:raw.length-1,
  evidence:[rawFile,batchFile].map(file=>({file,sha256:hash(fs.readFileSync(path.join(stageRoot,file)))})),
  interpretation:'Unknown-entry splitting is unbiased under exact nested-level simulation and unbiased resampling. Uniform variance scaling here belongs to the product-level benchmark, not arbitrary RSA levels. Actual RSA level design remains open.'},null,2)+'\n');
