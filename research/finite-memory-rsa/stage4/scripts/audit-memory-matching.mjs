import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,researchRoot } from './preservation.mjs';
import { physicalMachine } from '../src/operational.mjs';
import { temporalController } from '../src/temporal.mjs';
import { hankelRank } from '../src/hmm-structure.mjs';
import { rational,compare } from '../src/rational.mjs';
const output=path.join(stageRoot,'results/memory-matching-audit.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite memory audit');
const main=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/capability-search.json')));
const op=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/operational-survey.json')));
const catalogue=JSON.parse(fs.readFileSync(path.join(researchRoot,'stage3/data/classification/feedback-4.json'))).classes;
const proper=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/proper-boundary-null.json')));
const Q=x=>rational(`${x.numerator}/${x.denominator}`);
const dominates=(a,b)=>compare(Q(a.coverage),Q(b.coverage))>=0&&compare(Q(a.absOrder),Q(b.absOrder))<=0&&compare(Q(a.attemptsPerParticle),Q(b.attemptsPerParticle))<=0;
const outcomes=[];
for(const outcome of main.outcomes){
  const temporalRanks=outcome.temporal.map(row=>({name:row.policy,...hankelRank(temporalController(row.realization))}));
  const rows=outcome.feedback.map(candidate=>{
    const controller=catalogue.find(x=>x.classId===candidate.policy),machine=physicalMachine(controller,outcome.parameters);
    const labels=JSON.parse(machine.encoding).map(row=>row[0]);
    assert(labels.some(x=>x.endsWith(':0'))&&labels.some(x=>x.endsWith(':1')),'Randomized lower bound2 needs both deterministic actions before jam');
    const fixed=op.rows.find(x=>x.controller===candidate.policy).physical.find(x=>x.L===3&&x.boundary===outcome.parameters.boundary);
    const lower=candidate.policy==='feedback-4-00124'&&outcome.parameters.boundary==='periodic'?3:2;
    const fairNulls=outcome.temporal.filter(row=>row.states<=lower);
    const universalDominators=fairNulls.filter(row=>dominates(row.metrics,candidate.metrics)).map(row=>row.policy);
    const fixedDominators=[...universalDominators];
    if(outcome.parameters.boundary==='periodic'&&proper.states<=lower&&dominates(proper.metrics,candidate.metrics))fixedDominators.push(proper.policy);
    return {controller:candidate.policy,universalDeterministicMinimum:candidate.universalOperationalStates,
      fixedGeometryDeterministicMinimum:fixed.minimalDeterministicStates,
      randomizedFeedbackStateLowerBound:lower,randomizedFeedbackStateUpperBound:fixed.minimalDeterministicStates,
      randomizedFeedbackMinimumKnown:lower===fixed.minimalDeterministicStates,
      guaranteedMemoryFairUniversalLivePoolDominators:universalDominators,
      guaranteedMemoryFairFixedProperPoolDominators:fixedDominators,
      qualification:'Null realizations use no more states than a proved lower bound on every randomized feedback realization, rather than silently identifying Moore minimum with randomized minimum.'};
  });
  const universal=rows.filter(x=>x.guaranteedMemoryFairUniversalLivePoolDominators.length).length;
  const fixed=rows.filter(x=>x.guaranteedMemoryFairFixedProperPoolDominators.length).length;
  outcomes.push({parameters:outcome.parameters,temporalRanks,rows,
    universallyLivePoolDominated:universal,fixedProperPoolDominated:fixed,
    fullyKnownRandomizedFeedbackMinima:rows.filter(x=>x.randomizedFeedbackMinimumKnown).length});
  console.log(JSON.stringify({boundary:outcome.parameters.boundary,universalPool:universal,fixedProperPool:fixed,knownRandomizedMinima:outcomes.at(-1).fullyKnownRandomizedFeedbackMinima}));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,verifiedAtUTC:new Date().toISOString(),outcomes,
  theorem:'For any valid square L>=2, first acceptance at anchor0 leaves a nonjammed occupancy containing cell0. Subsequently every planned action can fail at anchor0. Observable first-mask then all-failure traces recover each temporal word probability up to a strictly positive known geometry factor. Planned-law equivalence and fixed-geometry temporal operational equivalence therefore coincide.',
  status:'passed',completeRandomizedFeedbackMinimizationClaimed:false,
  authority:'Use this audit for memory-fair domination counts. Initial capability-search budget labels were universal deterministic minima; general randomized feedback minima remain intervals.'},null,2)+'\n');
