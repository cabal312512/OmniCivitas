import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/simulate.mjs';
import { exactTerminal } from '../src/exact.mjs';
import { Lattice } from '../src/lattice.mjs';
import { regularizedBeta } from '../analysis/summarize.mjs';

const POLICIES=[0,33,35,38,41,43,46,'random-0.5'];
const binKey = (h,v,deadlock) => `${h}:${v}:${deadlock}`;
const betaQuantile = (probability,a,b) => {
  let low=0,high=1;
  for(let iteration=0;iteration<70;iteration++) {
    const middle=(low+high)/2;
    if(regularizedBeta(middle,a,b)<probability) low=middle; else high=middle;
  }
  return (low+high)/2;
};
function clopperPearson(successes,n,alpha) {
  return [successes===0?0:betaQuantile(alpha/2,successes,n-successes+1),
    successes===n?1:betaQuantile(1-alpha/2,successes+1,n-successes)];
}

test('fresh direct/event simulations agree with exact joint terminal laws using simultaneous exact binomial intervals',t=>{
  const n=2048, familyAlpha=.01, cases=[];
  for(const L of [2,3]) for(const boundary of ['periodic','open']) for(const controller of POLICIES) for(const engine of ['event','direct']) {
    const exact=exactTerminal({L,k:2,boundary,...(controller==='random-0.5'?{baseline:'fair'}:{controller})});
    const probabilities=new Map();
    for(const outcome of exact.distribution) {
      const key=binKey(outcome.horizontal,outcome.vertical,Number(outcome.reason==='deadlock'));
      probabilities.set(key,(probabilities.get(key)??0)+outcome.probability.value);
    }
    cases.push({L,boundary,controller,engine,probabilities,exact});
  }
  const comparisons=cases.reduce((sum,scenario)=>sum+scenario.probabilities.size,0);
  const alpha=familyAlpha/comparisons;
  let maximumCoverageError=0,maximumDeadlockError=0,smallestMargin=Infinity;
  const confidenceChecks=[];
  for(const scenario of cases) {
    const counts=new Map();let sumCoverage=0,sumDeadlock=0;
    for(let repetition=0;repetition<n;repetition++) {
      // Disjoint from the saved small_validation data (400001..404096).
      const result=simulate({...scenario,k:2,seed:700001+repetition,validate:repetition<4});
      const key=binKey(result.horizontal,result.vertical,result.deadlock);
      assert(scenario.probabilities.has(key),`Outcome outside exact support: ${JSON.stringify(scenario)} ${key}`);
      counts.set(key,(counts.get(key)??0)+1);
      assert.equal(result.attempts,result.particles+result.failures);
      assert.equal(result.deadlock,Number(result.legal_h+result.legal_v>0));
      assert.equal(result.particles,result.horizontal+result.vertical);
      sumCoverage+=result.coverage;sumDeadlock+=result.deadlock;
    }
    for(const [key,probability] of scenario.probabilities) {
      const count=counts.get(key)??0;
      const [low,high]=clopperPearson(count,n,alpha);
      assert(probability>=low-1e-12&&probability<=high+1e-12,
        `Exact probability ${probability} outside simultaneous CP [${low},${high}], n=${n}, count=${count}, policy=${scenario.controller}, L=${scenario.L}, boundary=${scenario.boundary}, engine=${scenario.engine}, outcome=${key}`);
      smallestMargin=Math.min(smallestMargin,probability-low,high-probability);
      confidenceChecks.push({controller:scenario.controller,L:scenario.L,boundary:scenario.boundary,engine:scenario.engine,
        outcome:key,count,n,exactProbability:probability,confidenceLow:low,confidenceHigh:high});
    }
    maximumCoverageError=Math.max(maximumCoverageError,Math.abs(sumCoverage/n-scenario.exact.metrics.coverage.value));
    maximumDeadlockError=Math.max(maximumDeadlockError,Math.abs(sumDeadlock/n-scenario.exact.metrics.deadlockProbability.value));
  }
  t.diagnostic(JSON.stringify({runs:cases.length*n,groups:cases.length,repetitionsPerGroup:n,
    seedRange:[700001,700001+n-1],jointOutcomeComparisons:comparisons,
    intervalMethod:'Two-sided Clopper-Pearson, Bonferroni family confidence >=99% under independent-run sampling model',
    perComparisonAlpha:alpha,maximumCoverageError,maximumDeadlockError,smallestConfidenceMargin:smallestMargin,confidenceChecks}));
});

test('an isolated periodic H rod blocks 2k-1 H and k^2 V anchors when L>=2k',()=>{
  for(const k of [1,2,3,4,7]) for(const L of [2*k,2*k+1,3*k]) {
    if(L<2) continue;
    const lattice=new Lattice(L,k,'periodic');
    lattice.place(0,0);lattice.validate();
    assert.equal(lattice.M-lattice.counts[0],2*k-1);
    assert.equal(lattice.M-lattice.counts[1],k*k);
    assert.equal(lattice.counts[0]-lattice.counts[1],(k-1)**2);
  }
});

test('policy 41 first-rod continuation law separates state persistence from geometry anisotropy',()=>{
  const M=16,a=13/M,b=12/M;
  const same=a/(a+b-a*b);
  const equalAvailability=1/(2-a);
  assert(Math.abs(same-52/61)<1e-14);
  assert(Math.abs(equalAvailability-16/19)<1e-14);
  assert(Math.abs((same-equalAvailability)-12/1159)<1e-14);
  const increment=(a-b)*(1-a)/((2-a)*(a+b-a*b));
  assert(Math.abs(increment-(same-equalAvailability))<1e-14);
});
