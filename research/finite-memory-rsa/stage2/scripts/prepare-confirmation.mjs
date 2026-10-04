#!/usr/bin/env node
/** Prepare a mechanism-based holdout from pilot data. Never reads holdout rows. */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, controllerName} from './run-experiment.mjs';

const pilotExperiments = ['landscape', 'refinement', 'refinement_success_flip'];
const review = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/processed/pilot/candidate-review.json')));
const candidates = [[1,.001], [1,.05], [.02,1], [.85,.5]].map(([alpha,beta]) => ({alpha,beta,name:controllerName(alpha,beta)}));
const diagonal = Array.from({length:21}, (_,i) => ({alpha:i/20,beta:i/20,name:controllerName(i/20,i/20)}));
const armParameters = {}, matches = new Map(), tests = [];
for (const k of [4,8]) {
  const stratum = review.strata.find(s => s.L === 64 && s.k === k && s.boundary === 'periodic');
  if (!stratum) throw new Error('Missing pilot stratum');
  for (const candidate of candidates) {
    const pilot = stratum.mechanismCandidates.find(c => c.controller === candidate.name);
    if (!pilot) throw new Error('Candidate was not evaluated in pilot');
    const p = pilot.trialSwitchRate.mean;
    const name = `proposal-k${k}-${candidate.name}`;
    const match = {alpha:p,beta:p,name};
    matches.set(`${k}/${candidate.name}`, match);
    armParameters[name] = {alpha:p,beta:p,initial_mode:'fair',engine:'event',kinetic_kind:'sampled-actual',
      source:{kind:'pilot-trial-switch-match',controller:candidate.name,L:64,k,boundary:'periodic',
        experiments:pilotExperiments,metric:'trial_switch_fraction'}};
  }
}
const strata = [4,8].map((k,i) => ({L:64,k,repetitions:1024,seedStart:40000001+i*100000,
  points:[...diagonal,...candidates,...candidates.map(c => matches.get(`${k}/${c.name}`))]}));
const stabilityStrata = [256,512].flatMap((L,i) => [4,8].map((k,j) => ({L,k,repetitions:128,
  seedStart:41000001+i*1000000+j*100000,
  points:[...candidates.slice(0,2),diagonal[10],diagonal[20],...candidates.slice(0,2).map(c=>matches.get(`${k}/${c.name}`))]})));
function contrast(experiment,s,c,baseline) {
  for (const metric of ['coverage','abs_order']) tests.push({
    id:`${experiment}/L${s.L}/k${s.k}/${c.name}/${baseline.name}/${metric}`,
    experiment,L:s.L,k:s.k,boundary:'periodic',controller:c.name,baseline:baseline.name,metric,
    alternative:metric==='coverage'?'two-sided':'less',nullDifference:metric==='coverage'?0:.01,
    seedBlock:{start:s.seedStart,count:s.repetitions}});
}
for (const s of strata) for (const c of candidates)
  for (const baseline of [...diagonal,matches.get(`${s.k}/${c.name}`)]) contrast('confirmation',s,c,baseline);
for (const s of stabilityStrata) for (const c of candidates.slice(0,2))
  for (const baseline of [diagonal[10],diagonal[20],matches.get(`${s.k}/${c.name}`)]) contrast('confirmation_stability',s,c,baseline);
const spec = {schemaVersion:2,pilotExperiments,familyAlpha:.05,armParameters,
  selectionRule:'Four fixed mechanism representatives, not pilot density maxima: success-alternation with beta .001 and .05, the requested small-alpha (.02,1) corner, and (.85,.5) near an attainable accepted-correlation null. Preserve regression of the coarse winner in the independent refinement. Compare every candidate with all21 prespecified diagonal nulls and its own pilot-proposal-persistence null. Add independently seeded L256/512 stability for the two success-alternation candidates. No holdout retuning, interpolation, candidate dropping or seed augmentation.',
  design:{primaryOutcome:'coverage',companion:'mean run-wise abs_order',noninferiorityMargin:.01,
    marginInterpretation:'Comparable anisotropy permits an absolute .01 increase; this is not strict Pareto dominance. Strict improvement requires an upper confidence bound below zero.',
    tests:'Paired independent-seed-block Student-t, two-sided coverage and lower-tail noninferiority; approximate finite-sample inference.',
    multiplicity:'Single Holm family of400 tests across both outcomes, all comparisons, lengths and sizes.',
    matching:'Diagonal p equals pilot mean per-run trial_switches/(attempts-1). Matches one scalar proposal persistence at L64 only, not accepted correlation or complete run distributions; matched p is not re-estimated at larger sizes.',
    continuum:'Finite21-point null line plus pilot-fitted points; no universal claim about all temporal controllers.'},tests};
function write(relative,value) {
  const file=path.join(ROOT,relative);
  if(fs.existsSync(file)) throw new Error('Refusing to overwrite confirmation preparation '+relative);
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}
write('experiments/confirmation.json',{name:'confirmation',engine:'event',boundary:'periodic',strata});
write('experiments/confirmation_stability.json',{name:'confirmation_stability',engine:'event',boundary:'periodic',strata:stabilityStrata});
write('experiments/confirmation-spec.json',spec);
console.log(JSON.stringify({tests:tests.length,L64Runs:strata.reduce((n,s)=>n+s.repetitions*s.points.length,0),
  stabilityRuns:stabilityStrata.reduce((n,s)=>n+s.repetitions*s.points.length,0),matches:Object.fromEntries(matches)},null,2));
