import fs from 'node:fs';
import path from 'node:path';
import { stageRoot, researchRoot, hash } from './preservation.mjs';
import { universalOperational } from '../src/operational.mjs';
import { temporalController, switchingTemporal, feedbackController, exactController, numericController, universalTemporalLiveness } from '../src/temporal.mjs';
import { geometryModel } from '../src/geometry-model.mjs';
import { Fraction, rational, compare, json } from '../src/rational.mjs';
const output = path.join(stageRoot, 'results/capability-search.json');
if (fs.existsSync(output)) throw new Error('Refuse to overwrite completed capability search');
const read = file => JSON.parse(fs.readFileSync(file));
const catalogue = read(path.join(researchRoot, 'stage3/data/classification/feedback-4.json')).classes;
const small = read(path.join(researchRoot, 'stage3/data/classification/feedback-3.json')).classes;
const protocol = read(path.join(stageRoot, 'experiments/protocol.json'));
const previous = read(path.join(researchRoot, 'stage3/results/exact-survey.json'));
const cached = new Map(previous.cases.map(row => [`${row.key}|${row.boundary}`, row]));
const selected = new Map();
for (const controller of small.filter(x => x.universalLiveness)) {
  const original = catalogue.find(x => x.key === controller.key), op = universalOperational(original);
  if (!selected.has(op.key)) selected.set(op.key, { controller: original, op, reason: 'Complete <=3-state structurally-live catalogue, deduplicated by universal operational law' });
}
const featureGroups = new Map();
for (const controller of catalogue.filter(x => x.minimalStateCount === 4 && x.universalLiveness)) {
  const op = universalOperational(controller);
  if (op.minimalDeterministicOperationalStates !== 4) continue;
  const indegree = Array(4).fill(0); controller.transitions.forEach(row => indegree[row[1]]++);
  const key = JSON.stringify([controller.failureCycles.map(x => x.states.length).sort(),
    controller.outputs.reduce((a, b) => a + b, 0), indegree.sort(),
    controller.transitions.filter((row, q) => row[1] === q).length]);
  if (!featureGroups.has(key)) featureGroups.set(key, []);
  featureGroups.get(key).push({ controller, op });
}
const groupKeys = [...featureGroups.keys()].sort(), maxNew = Math.min(48, groupKeys.length);
for (let i = 0; i < maxNew; i++) {
  const key = groupKeys[Math.floor(i * groupKeys.length / maxNew)];
  const row = featureGroups.get(key).find(x => !selected.has(x.op.key));
  if (row) selected.set(row.op.key, { ...row, reason: `Four-state invariant stratum ${key}; fixed structure selection, not old-performance winner selection` });
}
const feedbackCandidates = [...selected.values()];
console.log(JSON.stringify({ stage: 'selection', feedbackOperationalClasses: feedbackCandidates.length,
  completeThreeStateLiveStructuralClasses: small.filter(x => x.universalLiveness).length,
  fourStateInvariantStrata: groupKeys.length, selectedStrata: maxNew }));
const outcomes = [];
const serialize = policy => ({ name: policy.name, initial: policy.initial.map(x => `${x.n}/${x.d}`),
  H: policy.success[0].map(row => row.map(x => `${x.n}/${x.d}`)), V: policy.success[1].map(row => row.map(x => `${x.n}/${x.d}`)) });
const dominance = (temporal, feedback) => compare(rational(temporal.coverage), rational(feedback.coverage)) >= 0 &&
  compare(rational(temporal.absOrder), rational(feedback.absOrder)) <= 0 &&
  compare(rational(temporal.attemptsPerParticle), rational(feedback.attemptsPerParticle)) <= 0;
const metricQ = metric => `${metric.numerator}/${metric.denominator}`;
const Qmetrics = metrics => Object.fromEntries(Object.entries(metrics).map(([k, x]) => [k, metricQ(x)]));
const envelope = read(path.join(stageRoot, 'results/temporal-envelope-informed.json'));
let newExactFeedbackCases = 0, reusedExactFeedbackCases = 0, newExactTemporalCases = 0;
for (const parameters of protocol.tinySystems) {
  const model = geometryModel(parameters), feedback = [];
  for (const selection of feedbackCandidates) {
    const key = `${selection.controller.key}|${parameters.boundary}`, old = cached.get(key);
    let result;
    if (old) {
      const metrics = { coverage: old.metrics.coverage, absOrder: old.metrics.absOrder,
        attemptsPerParticle: old.metrics.expectedAttemptsPerParticle };
      result = { policy: selection.controller.classId, parameters, states: selection.op.minimalDeterministicOperationalStates,
        metrics, reusedFrozenStageIII: true, evidenceFile: `../stage3/${old.file}`, evidenceSha256: old.sha256,
        invariantScope: 'Only H/V-transposition-invariant objectives reused; no unsymmetrized trace law reconstructed from the archived mixture.' };
      reusedExactFeedbackCases++;
    } else {
      const realization = { ...selection.op.realization, classId: selection.controller.classId };
      result = exactController(feedbackController(realization), parameters);
      const name = `data/feedback-${parameters.boundary}-${selection.controller.classId}.json`;
      const bytes = JSON.stringify(result, null, 2) + '\n'; fs.writeFileSync(path.join(stageRoot, name), bytes);
      result = { ...result, law: undefined, evidenceFile: name, evidenceSha256: hash(bytes), reusedFrozenStageIII: false };
      newExactFeedbackCases++;
    }
    feedback.push({ ...result, structuralStates: selection.controller.minimalStateCount,
      universalOperationalStates: selection.op.minimalDeterministicOperationalStates, selectionReason: selection.reason });
  }
  const grid = [];
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) {
    const policy = switchingTemporal(`${a}/20`, `${b}/20`, `switch-${a}-${b}`);
    grid.push({ policy, alpha: `${a}/20`, beta: `${b}/20`, metrics: numericController(policy, model) });
  }
  const nullSelections = new Map();
  const add = row => nullSelections.set(row.policy.name, row.policy);
  add(grid.find(x => x.policy.name === 'switch-20-20'));
  add(grid.find(x => x.policy.name === 'switch-10-10'));
  for (const metric of ['coverage','absOrder','attemptsPerParticle']) add([...grid].sort((a, b) => metric === 'coverage' ? b.metrics[metric] - a.metrics[metric] : a.metrics[metric] - b.metrics[metric])[0]);
  for (const weights of protocol.supportMultipliers) {
    const mu = Number(rational(weights.imbalance).n) / Number(rational(weights.imbalance).d), nu = Number(rational(weights.cost).n) / Number(rational(weights.cost).d);
    const score = row => row.metrics.coverage - mu * row.metrics.absOrder - nu * row.metrics.attemptsPerParticle;
    add([...grid].sort((a, b) => score(b) - score(a))[0]);
  }
  for (const candidate of feedback.filter(x => x.universalOperationalStates <= 2)) {
    const feasible = grid.filter(row => row.metrics.coverage >= candidate.metrics.coverage.value - 1e-13 &&
      row.metrics.absOrder <= candidate.metrics.absOrder.value + 1e-13 && row.metrics.attemptsPerParticle <= candidate.metrics.attemptsPerParticle.value + 1e-13);
    if (feasible.length) add(feasible.sort((a, b) => a.metrics.attemptsPerParticle - b.metrics.attemptsPerParticle)[0]);
  }
  const dense = [
    { name:'edge-2', H:[['3/10','1/10'],['1/10','1/10']], V:[['1/10','5/10'],['2/10','6/10']] },
    { name:'edge-3', H:[[4,1,1],[1,2,1],[0,1,2]].map(row=>row.map(x=>`${x}/12`)), V:[[1,3,2],[3,1,4],[2,2,5]].map(row=>row.map(x=>`${x}/12`)) },
    { name:'edge-4', H:[[4,1,0,1],[1,3,1,1],[1,1,2,0],[0,1,2,1]].map(row=>row.map(x=>`${x}/16`)), V:[[1,4,3,2],[2,1,3,4],[4,3,2,3],[5,2,1,4]].map(row=>row.map(x=>`${x}/16`)) }
  ];
  for (const configuration of dense) add({ policy: temporalController(configuration) });
  add({ policy: temporalController({ name: 'IID-fair', H:[['1/2']], V:[['1/2']] }) });
  const temporal = [];
  for (const policy of nullSelections.values()) {
    const live = universalTemporalLiveness(policy); if (!live.live) throw new Error('Selected null is not live');
    const result = exactController(policy, parameters);
    const name = `data/temporal-${parameters.boundary}-${policy.name}.json`, bytes = JSON.stringify({ ...result, realization: serialize(policy), liveness: live }, null, 2) + '\n';
    fs.writeFileSync(path.join(stageRoot, name), bytes); newExactTemporalCases++;
    temporal.push({ ...result, law: undefined, realization: serialize(policy), evidenceFile:name, evidenceSha256:hash(bytes) });
  }
  const bounds = envelope.certificates.find(x => x.parameters.boundary === parameters.boundary).bounds;
  const comparisons = feedback.map(candidate => {
    const point = Qmetrics(candidate.metrics), admissible = temporal.filter(x => x.states <= candidate.universalOperationalStates);
    const dominating = admissible.filter(x => dominance(Qmetrics(x.metrics), point)).map(x => x.policy);
    const upperRows = bounds.map(bound => {
      const value = rational(metricQ(bound.supportUpper)).add(rational(metricQ(bound.imbalanceMultiplier)).mul(rational(point.absOrder)))
        .add(rational(metricQ(bound.costMultiplier)).mul(rational(point.attemptsPerParticle)));
      return { bound, value };
    });
    const best = upperRows.reduce((a, b) => compare(a.value, b.value) < 0 ? a : b);
    const lower = admissible.filter(x => compare(rational(metricQ(x.metrics.absOrder)), rational(point.absOrder)) <= 0 &&
      compare(rational(metricQ(x.metrics.attemptsPerParticle)), rational(point.attemptsPerParticle)) <= 0)
      .sort((a,b) => -compare(rational(metricQ(a.metrics.coverage)), rational(metricQ(b.metrics.coverage))))[0];
    return { controller:candidate.policy, memoryBudget:candidate.universalOperationalStates, dominatingCertifiedTemporalPoints:dominating,
      fullTemporalConstrainedCoverageUpper:json(best.value), attainingUpperClaimed:false,
      bestExactPoolConstrainedLower: lower ? { policy:lower.policy, coverage:lower.metrics.coverage } : null,
      coverageMinusCertifiedUpper:json(rational(point.coverage).sub(best.value)),
      certifiedOutsideFullTemporalEnvelope:compare(rational(point.coverage),best.value)>0 };
  });
  const gridFile = `data/temporal-grid-${parameters.boundary}.json`;
  const gridBytes=JSON.stringify({parameters,scope:'Exploratory lower points only; 400 rational transition configurations, floating evaluation',rows:grid.map(x=>({alpha:x.alpha,beta:x.beta,metrics:x.metrics}))},null,2)+'\n';
  fs.writeFileSync(path.join(stageRoot,gridFile),gridBytes);
  outcomes.push({ parameters, feedback, temporal, comparisons, exploratoryGrid:{file:gridFile,sha256:hash(gridBytes),configurations:grid.length},
    dominatedFeedbackPoints:comparisons.filter(x=>x.dominatingCertifiedTemporalPoints.length).length,
    certifiedObjectiveGaps:comparisons.filter(x=>x.certifiedOutsideFullTemporalEnvelope).length });
  console.log(JSON.stringify({ boundary:parameters.boundary, feedback:feedback.length,exactTemporal:temporal.length,
    dominated:outcomes.at(-1).dominatedFeedbackPoints, certifiedGaps:outcomes.at(-1).certifiedObjectiveGaps }));
}
const result={schemaVersion:1,completedAtUTC:new Date().toISOString(),protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/protocol.json'))),
  feedbackSelection:{completeThreeStateStructuralLive:small.filter(x=>x.universalLiveness).length,
    universalOperationalClasses:feedbackCandidates.length,fourStateInvariantStrata:groupKeys.length,selectedFourStateStrata:maxNew},
  newExactFeedbackCases,reusedExactFeedbackCases,newExactTemporalCases,outcomes,
  noMonteCarloPackingRuns:true,
  interpretation:'Exact point inclusion/domination is verified only against the explicit feasible HMM pool. No certified outside-envelope point means no gap established, not complete inclusion or impossibility. Outer certificates cover every stochastic temporal controller; lower grids do not.'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'complete',newExactFeedbackCases,reusedExactFeedbackCases,newExactTemporalCases}));
