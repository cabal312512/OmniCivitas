#!/usr/bin/env node
/** Read frozen Stage II reference/raw results; do not rerun or alter them. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Fraction} from '../../src/exact.mjs';
import {parseCSV,descriptive,wilson,regularizedBeta} from '../../analysis/summarize.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const key=p=>JSON.stringify([Number(p.L),Number(p.k),p.boundary,Number(p.alpha),Number(p.beta)]);
const fraction=p=>new Fraction(p.numerator,p.denominator);
const betaQuantile=(p,a,b)=>{let lo=0,hi=1;for(let iteration=0;iteration<70;iteration++){const mid=(lo+hi)/2;if(regularizedBeta(mid,a,b)<p)lo=mid;else hi=mid;}return(lo+hi)/2;};
const clopperPearson=(count,n,alpha)=>({low:count===0?0:betaQuantile(alpha/2,count,n-count+1),high:count===n?1:betaQuantile(1-alpha/2,count+1,n-count)});
const contains=(value,low,high)=>value>=low-1e-12&&value<=high+1e-12;
const exactPath=path.join(ROOT,'data/processed/exact-small-systems.json');
const exact=JSON.parse(fs.readFileSync(exactPath,'utf8'));
const exactByKey=new Map(exact.cases.map(answer=>[key(answer.parameters),answer]));
const outcomes=new Map(exact.cases.map(answer=>{
  const law=new Map();
  for(const terminal of answer.distribution){const k=JSON.stringify([terminal.horizontal,terminal.vertical,Number(terminal.reason==='deadlock')]);law.set(k,(law.get(k)??new Fraction()).add(fraction(terminal.probability)));}
  return[key(answer.parameters),law];
}));
const manifests=[],groups=[];
let invariantChecks=0;
for(const engine of ['event','direct']) {
  const name=`exact_validation_${engine}`,raw=path.join(ROOT,`data/raw/${name}.csv`),manifest=JSON.parse(fs.readFileSync(raw.replace(/\.csv$/,'.manifest.json'),'utf8'));
  if(hash(raw)!==manifest.sha256)throw new Error(`Raw hash mismatch: ${name}`);
  if(hash(path.join(ROOT,manifest.histograms.raw))!==manifest.histograms.sha256)throw new Error(`Histogram hash mismatch: ${name}`);
  for(const[file,sha]of Object.entries(manifest.sourceSha256))if(hash(path.resolve(ROOT,file))!==sha)throw new Error(`Source changed since experiment: ${file}`);
  manifests.push({file:`data/raw/${name}.manifest.json`,...manifest});
  const grouped=new Map(),rows=parseCSV(fs.readFileSync(raw,'utf8'));
  if(rows.length!==manifest.runs)throw new Error(`Run count mismatch: ${name}`);
  for(const input of rows) {
    const row={...input};for(const field of ['L','k','alpha','beta','horizontal','vertical','coverage','order','abs_order','deadlock','geometric_jam','legal_h','legal_v','attempts','failures','particles','attempted_h','attempted_v']){if(row[field]===''||!Number.isFinite(Number(row[field])))throw new Error(`Invalid ${field}`);row[field]=Number(row[field]);}
    const groupKey=key(row);if(!exactByKey.has(groupKey))throw new Error(`No exact reference: ${groupKey}`);
    if(row.engine!==engine||row.initial_mode!=='fair'||row.kinetic_kind!=='sampled-actual')throw new Error('Wrong engine/initialization/kinetic evidence');
    if(row.particles!==row.horizontal+row.vertical||row.attempts!==row.particles+row.failures||row.attempts!==row.attempted_h+row.attempted_v||row.deadlock!==Number(row.legal_h+row.legal_v>0)||row.geometric_jam!==1-row.deadlock)throw new Error('Terminal invariant violation');
    invariantChecks++;
    if(!grouped.has(groupKey))grouped.set(groupKey,{key:groupKey,engine,parameters:{L:row.L,k:row.k,boundary:row.boundary,alpha:row.alpha,beta:row.beta},seeds:new Set(),values:{coverage:[],absOrder:[],order:[],orderSquared:[],orderFourth:[],expectedTerminalAttempts:[],expectedFailures:[]},deadlocks:0,jointCounts:new Map()});
    const group=grouped.get(groupKey);if(group.seeds.has(row.seed))throw new Error('Duplicate seed within stratum');group.seeds.add(row.seed);
    for(const[field,value]of Object.entries({coverage:row.coverage,absOrder:row.abs_order,order:row.order,orderSquared:row.order**2,orderFourth:row.order**4,expectedTerminalAttempts:row.attempts,expectedFailures:row.failures}))group.values[field].push(value);
    group.deadlocks+=row.deadlock;
    const joint=JSON.stringify([row.horizontal,row.vertical,row.deadlock]);
    if(!outcomes.get(groupKey).has(joint))throw new Error(`Observed outcome outside exact support: ${joint}`);
    group.jointCounts.set(joint,(group.jointCounts.get(joint)??0)+1);
  }
  if(grouped.size!==52)throw new Error('Expected all 52 exact-validation strata');
  for(const group of grouped.values()){if(group.seeds.size!==2048)throw new Error('Unexpected repetition count');groups.push(group);}
}
const familyComparisons=groups.reduce((sum,group)=>sum+outcomes.get(group.key).size,0),familyAlpha=.01,perComparisonAlpha=familyAlpha/familyComparisons;
let pointwiseMeanChecks=0,pointwiseMeanMisses=0,pointwiseDeadlockMisses=0,jointFamilyMisses=0,endpointRoundoffCases=0;
const summaries=groups.map(group=>{
  const reference=exactByKey.get(group.key),metrics={};
  for(const[field,values]of Object.entries(group.values)) {
    const observed=descriptive(values),expected=reference.metrics[field].value;
    const rawContains=expected>=observed.ciLow&&expected<=observed.ciHigh;
    const calibrated=contains(expected,observed.ciLow,observed.ciHigh);
    if(!calibrated)pointwiseMeanMisses++;
    if(!rawContains&&calibrated)endpointRoundoffCases++;
    pointwiseMeanChecks++;
    metrics[field]={...observed,exact:reference.metrics[field],error:observed.mean-expected,pointwise95ContainsExact:calibrated,rawFloatingContainsExact:rawContains};
  }
  const deadlock=wilson(group.deadlocks,group.seeds.size),expected=reference.metrics.deadlockProbability.value;
  deadlock.exact=reference.metrics.deadlockProbability;deadlock.pointwise95ContainsExact=contains(expected,deadlock.ciLow,deadlock.ciHigh);
  deadlock.rawFloatingContainsExact=expected>=deadlock.ciLow&&expected<=deadlock.ciHigh;
  if(!deadlock.pointwise95ContainsExact)pointwiseDeadlockMisses++;
  if(!deadlock.rawFloatingContainsExact&&deadlock.pointwise95ContainsExact)endpointRoundoffCases++;
  const jointChecks=[...outcomes.get(group.key)].map(([outcome,p])=>{
    const count=group.jointCounts.get(outcome)??0,interval=clopperPearson(count,group.seeds.size,perComparisonAlpha),passed=contains(p.number(),interval.low,interval.high);
    if(!passed)jointFamilyMisses++;
    return{outcome:JSON.parse(outcome),count,n:group.seeds.size,exactProbability:p.toJSON(),...interval,containsExact:passed};
  });
  return{engine:group.engine,parameters:group.parameters,n:group.seeds.size,seedMin:Math.min(...group.seeds),seedMax:Math.max(...group.seeds),metrics,deadlock,jointChecks};
});
const result={schemaVersion:1,generatedAtUTC:new Date().toISOString(),runtime:{node:process.version,platform:process.platform,arch:process.arch},
  purpose:'Independent scientific-model implementation validation; no selection or primary outcome inference.',
  sourceSha256:{'scripts/validate-exact.mjs':hash(fileURLToPath(import.meta.url))},reference:{file:'data/processed/exact-small-systems.json',sha256:hash(exactPath)},
  experiments:manifests.map(m=>({file:m.file,runs:m.runs,sha256:m.sha256,histograms:m.histograms,sourceSha256:m.sourceSha256,runtime:m.runtime})),
  audit:{runs:invariantChecks,groups:summaries.length,repetitionsPerGroup:2048,allOutcomeSupportAndTerminalIdentitiesPassed:true,pointwiseMeanChecks,pointwiseMeanMisses,pointwiseDeadlockChecks:summaries.length,pointwiseDeadlockMisses,endpointRoundoffCases,
    jointFamily:{method:'Two-sided Clopper-Pearson intervals; Bonferroni, family alpha=.01 under independent-run sampling model',familyComparisons,perComparisonAlpha,misses:jointFamilyMisses},
    interpretation:'Pointwise 95% misses are expected when many intervals are inspected and are reported honestly. The simultaneous 99% joint-law audit checks (NH,NV,terminal reason), not the full spatial-mask law or every kinetic distribution. Student-t mean intervals are CLT-based; endpoint allowance1e-12 addresses floating arithmetic only.',
    status:jointFamilyMisses===0?'passed-joint-law-family':'joint-law-family-mismatch'},
  groups:summaries};
const output=path.join(ROOT,'data/processed/exact-validation.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const maxima=Object.fromEntries(['coverage','absOrder','order','expectedTerminalAttempts'].map(metric=>[metric,Math.max(...summaries.map(group=>Math.abs(group.metrics[metric].error)))]));
const doc=`# Exact/Monte Carlo validation\n\nThe frozen stochastic exact reference was compared with **${invariantChecks.toLocaleString('en-US')} actual simulations**: ${manifests[0].runs.toLocaleString('en-US')} event and ${manifests[1].runs.toLocaleString('en-US')} direct, 52 parameter/geometry strata per engine, 2,048 fair-initialized seeds each. The nine core rational points and four quarter-probability checks cover L=2,3 dimers with both boundaries. Neither reference nor simulator source was modified for this comparison.\n\nEvery observed joint (N_H,N_V,deadlock) outcome belonged to the exact support. All terminal count/attempt/legal-placement identities, raw hashes, histogram hashes and completed-source manifest checks passed.\n\nThere were **${pointwiseMeanMisses} misses among ${pointwiseMeanChecks} pointwise 95% Student-t mean intervals**, and **${pointwiseDeadlockMisses} misses among ${summaries.length} pointwise 95% Wilson deadlock intervals**. These misses are reported; all individual 95% intervals are not required to contain their targets. ${endpointRoundoffCases} extra raw containment differences fell within 1e-12 floating endpoint allowance. No empirical sampling tolerance was substituted.\n\nThe joint terminal-law fidelity audit used ${familyComparisons} two-sided Clopper–Pearson intervals with Bonferroni alpha 0.01/${familyComparisons}. **${jointFamilyMisses} simultaneous intervals missed** their exact probability. Under independent-run sampling, this family has at least 99% simultaneous confidence. Shared engine seed labels do not invalidate the Bonferroni bound. This validates the joint count/terminal-reason law; it is not a full spatial-distribution or large-system correctness proof.\n\nMaximum observed mean discrepancies (descriptive, not pass cutoffs): coverage ${maxima.coverage}; absolute order ${maxima.absOrder}; signed order ${maxima.order}; terminal attempts ${maxima.expectedTerminalAttempts}. Mean kinetic intervals are CLT-based, and the separate rare-excursion study explains why a tiny-beta mean can require special care.\n\nMachine-readable details, including every pointwise interval, exact rational target and simultaneous bin check: \`data/processed/exact-validation.json\`. Frozen raw CSVs and histograms: \`data/raw/exact_validation_event.*\`, \`data/raw/exact_validation_direct.*\`.\n\nReproduction from the research root, after the two raw experiments exist:\n\n\`\`\`sh\nnode stage2/scripts/validate-exact.mjs\n\`\`\`\n\nThe input runner commands are \`node stage2/scripts/run-experiment.mjs experiments/exact_validation_event.json\` and the corresponding direct configuration. The runner refuses existing raw outputs; use a clean research checkout or a separate output path to rerun. This validation is outside the exploration/confirmation hypothesis family.\n`;
fs.writeFileSync(path.join(ROOT,'docs/EXACT_VALIDATION.md'),doc);
console.log(JSON.stringify({output:'stage2/data/processed/exact-validation.json',audit:result.audit,maxima}));
if(jointFamilyMisses)process.exitCode=1;
