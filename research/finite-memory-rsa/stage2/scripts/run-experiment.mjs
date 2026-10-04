#!/usr/bin/env node
/** Stage II streaming runner; never overwrites existing raw results. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {simulateStochastic} from '../src/stochastic.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const COLUMNS=['experiment','controller','L','k','boundary','seed','alpha','beta','initial_mode','initial_orientation','engine','kinetic_kind',
 'final_orientation','particles','horizontal','vertical','coverage','order','abs_order','deadlock','geometric_jam','legal_h','legal_v',
 'attempts','failures','attempted_h','attempted_v','failed_h','failed_v','trial_switches','controller_flips',
 'actual_attempts','actual_failures','actual_switches','success_flips','failure_flips','accepted_pairs','accepted_switches','accepted_lag1',
 'attempts_per_accepted','failures_per_accepted','accepted_run_count','accepted_mean_run_length','accepted_max_run_length',
 'trial_run_count','trial_mean_run_length','trial_max_run_length','trial_lag1_correlation','conditional_mean_attempts_sum','kinetic_sampling','elapsed_ms'];
export const controllerName=(alpha,beta)=>`a${Number(alpha)}-b${Number(beta)}`;
export function runExperiment(config,{output=null}={}) {
 const target=path.resolve(ROOT,output??`data/raw/${config.name}.csv`);
 if(fs.existsSync(target))throw new Error('Refusing to overwrite raw experiment: '+target);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 const histogramTarget=target.replace(/\.csv$/,'.runs.jsonl');
 if(fs.existsSync(histogramTarget))throw new Error('Refusing to overwrite run-length evidence');
 const file=fs.openSync(target,'wx'),histogramFile=fs.openSync(histogramTarget,'wx'),startedAt=new Date().toISOString();let runs=0;
 fs.writeSync(file,COLUMNS.join(',')+'\n');
 try {
  const strata=config.strata??config.sizes.flatMap(L=>config.lengths.map(k=>({L,k,repetitions:config.repetitions,seedStart:config.seedStart})));
  for(const stratum of strata) {
   const {L,k}=stratum,boundary=stratum.boundary??config.boundary??'periodic',repetitions=stratum.repetitions??config.repetitions,
         seedStart=stratum.seedStart??config.seedStart;
   for(const point of stratum.points??config.points)for(let rep=0;rep<repetitions;rep++) {
    const alpha=point.alpha,beta=point.beta,seed=seedStart+rep;
    const result=simulateStochastic({L,k,alpha,beta,seed,boundary,engine:config.engine??'event'});
    result.experiment=config.name;result.controller=point.name??controllerName(alpha,beta);
    if(result.kinetic_kind!=='sampled-actual')throw new Error('Runner requires explicitly sampled kinetics');
    fs.writeSync(file,COLUMNS.map(key=>result[key]??'').join(',')+'\n');runs++;
    fs.writeSync(histogramFile,JSON.stringify({experiment:config.name,controller:result.controller,L,k,boundary,seed,
      accepted:result.accepted_run_histogram,trial:result.trial_run_histogram})+'\n');
   }
   console.log(JSON.stringify({experiment:config.name,L,k,boundary,runsSoFar:runs}));
  }
 }finally{fs.closeSync(file);fs.closeSync(histogramFile);}
 const sourcePaths=['src/stochastic.mjs','scripts/run-experiment.mjs','../src/lattice.mjs','../src/rng.mjs'];
 const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const manifest={configuration:config,startedAt,finishedAt:new Date().toISOString(),runs,raw:path.relative(ROOT,target).replaceAll('\\','/'),
   sha256:sha(target),histograms:{raw:path.relative(ROOT,histogramTarget).replaceAll('\\','/'),sha256:sha(histogramTarget)},
   runtime:{node:process.version,platform:process.platform,arch:process.arch},
   sourceSha256:Object.fromEntries(sourcePaths.map(p=>[p,sha(path.join(ROOT,p))]))};
 fs.writeFileSync(target.replace(/\.csv$/,'.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({experiment:config.name,runs,sha256:manifest.sha256}));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const configPath=path.resolve(ROOT,process.argv[2]??'');
 if(!process.argv[2])throw new Error('Usage: node scripts/run-experiment.mjs experiments/CONFIG.json');
 runExperiment(JSON.parse(fs.readFileSync(configPath,'utf8')));
}
