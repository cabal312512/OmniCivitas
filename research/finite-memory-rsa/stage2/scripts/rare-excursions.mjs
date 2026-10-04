#!/usr/bin/env node
/** Frozen-geometry kinetic diagnostic: no lattice/controller optimization. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {RNG} from '../../src/rng.mjs';
import {descriptive,wilson} from '../../analysis/summarize.mjs';
import {nextAcceptedEvent} from '../src/stochastic.mjs';
import {nextSuccessKernel} from '../src/exact-stochastic.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const betas=[0,.000001,.0001,.001,.01,.1,1],repetitions=100000,baseSeed=50000001,seedStride=200000;
const raw=path.join(ROOT,'data/raw/rare-excursions.csv'),manifestPath=raw.replace(/\.csv$/,'.manifest.json');
if(fs.existsSync(raw)||fs.existsSync(manifestPath))throw new Error('Refusing to overwrite frozen rare-excursion evidence');
const sourcePaths=['scripts/rare-excursions.mjs','src/stochastic.mjs','src/exact-stochastic.mjs','../src/rng.mjs','../analysis/summarize.mjs'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceSha256=Object.fromEntries(sourcePaths.map(file=>[file,hash(path.resolve(ROOT,file))]));
fs.mkdirSync(path.dirname(raw),{recursive:true});
const file=fs.openSync(raw,'wx'),startedAt=new Date().toISOString(),groups=[];
fs.writeSync(file,'beta_index,beta,seed,initial_orientation,legal_h,legal_v,M,attempts,failed_h,failed_v,failure_flips,entered_blocked,success_orientation\n');
try {
  for(let index=0;index<betas.length;index++) {
    const beta=betas[index],seedStart=baseSeed+index*seedStride,values=[],hTrials=[];
    let excursions=0,maximum=0;
    for(let rep=0;rep<repetitions;rep++) {
      const seed=seedStart+rep,event=nextAcceptedEvent(1,[0,1],2,beta,new RNG(seed));
      if(event.terminal||event.o!==1)throw new Error('Frozen geometry must eventually accept V from legal V');
      const attempts=event.failures[0]+event.failures[1]+1,entered=Number(event.failures[0]>0);
      if(!Number.isSafeInteger(attempts)||attempts<1||event.failure_flips%2!==0)throw new Error('Fixed-kernel event invariant failed');
      values.push(attempts);hTrials.push(event.failures[0]);excursions+=entered;maximum=Math.max(maximum,attempts);
      fs.writeSync(file,[index,beta,seed,1,0,1,2,attempts,...event.failures,event.failure_flips,entered,event.o].join(',')+'\n');
    }
    const kernel=nextSuccessKernel({a:0,b:.5,beta}),mean=kernel.expectedNextSuccessAttempts[1],variance=kernel.nextSuccessAttemptVariance[1];
    const stats=descriptive(values),hStats=descriptive(hTrials),excursion=wilson(excursions,repetitions);
    const ordered=values.toSorted((a,b)=>a-b),quantile=p=>ordered[Math.max(0,Math.ceil(p*repetitions)-1)];
    const exactExcursionProbability=beta===0?0:beta/(1+beta),perGroupAlpha=.01/betas.length;
    const radius=Math.sqrt(variance.value/(repetitions*perGroupAlpha));
    const exactVarianceBasedInterval={low:Math.max(1,stats.mean-radius),high:stats.mean+radius,method:'Chebyshev with exact known variance; Bonferroni family confidence>=99% under independent-run model',perGroupAlpha};
    const naiveContains=mean.value>=stats.ciLow-1e-12&&mean.value<=stats.ciHigh+1e-12;
    const conservativeContains=mean.value>=exactVarianceBasedInterval.low-1e-12&&mean.value<=exactVarianceBasedInterval.high+1e-12;
    const group={beta,initial:'V',a:0,b:.5,n:repetitions,seedStart,seedEnd:seedStart+repetitions-1,exact:{mean,variance,firstBlockedExcursionProbability:exactExcursionProbability,expectedTotalBlockedHAttempts:beta===0?0:1},
      observed:{...stats,error:stats.mean-mean.value,naiveStudentT95ContainsExact:naiveContains,maximum,quantiles:Object.fromEntries([.5,.9,.99,.999,.9999].map(p=>[String(p),quantile(p)])),blockedHAttempts:hStats,
        excursions:{...excursion,count:excursions,expectedCount:repetitions*exactExcursionProbability}},
      exactVarianceBasedStandardError:Math.sqrt(variance.value/repetitions),exactVarianceBasedInterval,exactVarianceIntervalContainsMean:conservativeContains};
    groups.push(group);console.log(JSON.stringify({beta,mean:stats.mean,exactMean:mean.value,excursions,expectedExcursions:repetitions*exactExcursionProbability,naive95Contains:naiveContains,exactVariance99FamilyContains:conservativeContains,maximum}));
  }
}finally{fs.closeSync(file);}
for(const[file,sha]of Object.entries(sourceSha256))if(hash(path.resolve(ROOT,file))!==sha)throw new Error(`Source changed during diagnostic: ${file}`);
const manifest={schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),runs:repetitions*betas.length,configuration:{betas,repetitions,baseSeed,seedStride,frozenLegalCounts:[0,1],anchorDenominator:2,initial:'V',engine:'exact-event'},
  runtime:{node:process.version,platform:process.platform,arch:process.arch},raw:'data/raw/rare-excursions.csv',sha256:hash(raw),sourceSha256};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const result={schemaVersion:1,generatedAtUTC:new Date().toISOString(),manifest:'data/raw/rare-excursions.manifest.json',rawSha256:manifest.sha256,configuration:manifest.configuration,
  purpose:'Fixed-geometry waiting-time diagnostic, not a packing experiment or a selected-candidate confirmation.',
  interpretation:'For every positive beta the exact legal-start mean is3 but variance=2/beta+6; at beta0 mean/variance are2. At tiny beta the chance of an excursion is beta/(1+beta), and rare O(1/beta) durations sustain a missing mean contribution. Naive sample-variance t intervals may miss the exact mean when excursions are absent; this is not evidence of a sampler bug or thermodynamic phase.',
  audit:{runs:manifest.runs,groups:groups.length,terminalEventIdentitiesPassed:true,naivePointwise95Misses:groups.filter(g=>!g.observed.naiveStudentT95ContainsExact).length,
    exactVarianceChebyshevFamilyMisses:groups.filter(g=>!g.exactVarianceIntervalContainsMean).length,status:'completed-fixed-geometry-diagnostic'},groups};
fs.writeFileSync(path.join(ROOT,'data/processed/rare-excursions.json'),JSON.stringify(result,null,2)+'\n');
const table=groups.map(g=>`| ${g.beta} | ${g.observed.mean.toFixed(6)} | ${g.exact.mean.value} | ${g.observed.excursions.count} / ${g.observed.excursions.expectedCount.toFixed(4)} | ${g.observed.naiveStudentT95ContainsExact?'yes':'no'} | ${g.observed.maximum} |`).join('\n');
const doc=`# Rare blocked-direction excursions\n\nThis is a frozen-geometry kinetic diagnostic with H blocked, V success hazard1/2, and initial V. Seven beta values each have100,000 independently seeded event draws: **700,000 observations**, seeds50,000,001 + betaIndex*200,000 onward. No lattice or packing policy was optimized. The frozen event sampler retains actual discrete waiting counts, rather than substituting analytical means.\n\n| beta | observed mean | exact mean | excursions observed / expected | naive95% t interval contains exact mean | maximum attempts |\n|---:|---:|---:|---:|:---:|---:|\n${table}\n\nAt beta0, mean/variance are2. For every positive beta, exact mean=3 and variance=2/beta+6. A first blocked excursion has probability beta/(1+beta); once it occurs, its blocked-state residence has mean1/beta. Thus the distribution tends weakly to the beta-zero geometric law, but its means do not converge. This finite-state family is not uniformly integrable. It is not a thermodynamic phase transition.\n\nThere are ${result.audit.naivePointwise95Misses} misses among the seven naive sample-variance Student-t intervals. Tiny-beta samples can omit rare excursions and underestimate both mean and variance; those misses must not automatically be described as implementation failures. The report also provides conservative Chebyshev intervals using the **known exact variance**, with Bonferroni family confidence at least99% under independent-run sampling. ${result.audit.exactVarianceChebyshevFamilyMisses} such family intervals missed. These intentionally broad model-fidelity intervals are separate from primary packing inference.\n\nAll700,000 individual draws are saved as \`data/raw/rare-excursions.csv\`, with seeds and actual H/V failures, flips and accepted orientation. The completed manifest records runtime and source hashes. \`data/processed/rare-excursions.json\` contains sample SD/SE, both interval types, exact rational moments, quantiles and observed excursion counts. No confirmation seed block was reused:40-million ranges remain reserved for held-out packing.\n\nReproduction from the research root into a clean output checkout:\n\n\`\`\`sh\nnode stage2/scripts/rare-excursions.mjs\n\`\`\`\n\nExisting raw evidence is never overwritten. For the analytic proof, exact survival oracle and necessary conditioning of the divergence claim, see \`docs/THEORY.md\`, Section5.\n`;
fs.writeFileSync(path.join(ROOT,'docs/RARE_EXCURSIONS.md'),doc);
console.log(JSON.stringify({runs:manifest.runs,rawSha256:manifest.sha256,audit:result.audit}));
