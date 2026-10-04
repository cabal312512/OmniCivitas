#!/usr/bin/env node
/** Small-system exact capability survey; exploratory candidate selection is not a k4/k8 confirmation. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exactFinite } from '../src/exact.mjs';
import { verifyPreservation } from './preservation.mjs';

const stageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const compare = (a, b) => {
  const difference = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};
function difference(a, b) {
  let n = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  let d = BigInt(a.denominator) * BigInt(b.denominator);
  const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
  const factor = gcd(n < 0n ? -n : n, d); n /= factor; d /= factor;
  return { numerator: String(n), denominator: String(d), value: Number(n) / Number(d) };
}
function exactDominates(a, b) {
  const signs = [compare(a.coverage, b.coverage), -compare(a.absOrder, b.absOrder),
    -compare(a.expectedAttemptsPerParticle, b.expectedAttemptsPerParticle)];
  return signs.every(sign => sign >= 0) && signs.some(sign => sign > 0);
}
const exactEqual = (a, b) => ['coverage', 'absOrder', 'expectedAttemptsPerParticle'].every(metric => compare(a[metric], b[metric]) === 0);
const meanDominates = (a, b) => a.coverage >= b.coverage && a.abs_order <= b.abs_order && a.cost <= b.cost &&
  (a.coverage > b.coverage || a.abs_order < b.abs_order || a.cost < b.cost);

function chooseExploratory(coarse, controllers, maximum = 12) {
  const selections = [];
  for (const k of [4, 8]) {
    const pool = coarse.groups.filter(group => group.k === k && group.kind === 'feedback' &&
      controllers.get(group.controller)?.universalLiveness && !controllers.get(group.controller)?.temporalEquivalent);
    const fair = coarse.groups.find(group => group.k === k && group.controller === 'iid-fair');
    if (!pool.length || !fair) throw new Error(`Coarse selection lacks feedback or fair reference at k=${k}`);
    const frontier = new Set(pool.filter(p => !pool.some(q => meanDominates(q, p))).map(p => p.controller));
    const scores = new Map(pool.map(p => [p.controller, { ...p, wins: 0, pareto: frontier.has(p.controller), budgetCells: [] }]));
    for (const states of [2, 3, 4]) for (const absBudget of [.05, .1, .2, .35, .5, 1]) for (const costMultiplier of [.75, 1, 1.25, 2, 4]) {
      const eligible = pool.filter(p => p.states <= states && p.abs_order <= absBudget && p.cost <= costMultiplier * fair.cost)
        .sort((a, b) => b.coverage - a.coverage || a.abs_order - b.abs_order || a.cost - b.cost || (a.controller < b.controller ? -1 : 1));
      for (const p of eligible.slice(0, 2)) {
        const scored = scores.get(p.controller); scored.wins++; scored.budgetCells.push({ states, absBudget, costMultiplier });
      }
    }
    const selected = [...scores.values()].filter(p => p.wins || p.pareto)
      .sort((a, b) => b.wins - a.wins || Number(b.pareto) - Number(a.pareto) || b.coverage - a.coverage || (a.controller < b.controller ? -1 : 1))
      .slice(0, maximum);
    selections.push({ sourceK: k, sourceL: pool[0]?.L, selected, selectionRule: 'Exploratory budget-cell win count, then empirical Pareto membership, coverage, canonical id; maximum12 per source k. No exact outcome used to select.' });
  }
  return selections;
}

function sourceSeal() {
  const sources = ['src/controllers.mjs', 'src/exact.mjs', 'src/simulate.mjs', 'scripts/exact-survey.mjs',
    'data/classification/feedback-4.json', 'data/classification/temporal-4.json'];
  return Object.fromEntries(sources.map(relative => [relative, hash(fs.readFileSync(path.join(stageRoot, relative)))]));
}

export function runExactSurvey({ includeCoarse = true } = {}) {
  const preservationBefore = verifyPreservation();
  const seal = sourceSeal();
  const feedback = read(path.join(stageRoot, 'data/classification/feedback-4.json')).classes.map(c => ({ ...c, kind: 'feedback' }));
  const temporal = read(path.join(stageRoot, 'data/classification/temporal-4.json')).classes.filter(c => c.universalLiveness).map(c => ({ ...c, kind: 'temporal' }));
  const controllers = new Map([...feedback, ...temporal].map(c => [c.classId, c]));
  const selected = new Map();
  const add = (controller, reason) => {
    if (!selected.has(controller.classId)) selected.set(controller.classId, { controller, reasons: [] });
    selected.get(controller.classId).reasons.push(reason);
  };
  for (const c of temporal) add(c, 'all universally live temporal controllers up to4 states');
  for (const c of feedback.filter(c => c.universalLiveness && c.minimalStateCount <= 2)) add(c, 'all universally live feedback controllers up to2 states');
  add({ classId: 'iid-fair', probabilityH: .5, minimalStateCount: 1, universalLiveness: true, kind: 'iid-reference' }, 'supplementary stochastic zero-memory reference');
  const coarsePath = path.join(stageRoot, 'results/coarse-groups.json');
  const middlePath = path.join(stageRoot, 'results/middle-groups.json');
  let exploration = null;
  if (includeCoarse && fs.existsSync(coarsePath)) {
    const sourcePath = fs.existsSync(middlePath) ? middlePath : coarsePath;
    const source = read(sourcePath);
    const selectionGroups = fs.existsSync(middlePath) ? source.groups.filter(g => g.L === 64) : source.groups;
    exploration = { sourceFile: path.relative(stageRoot, sourcePath).replaceAll('\\', '/'), sourceSha256: hash(fs.readFileSync(sourcePath)), sourceRunCount: source.runs,
      selections: chooseExploratory({ ...source, groups: selectionGroups }, controllers),
      selectionUpdate: 'Initial exhaustive baseline was completed first. Latest parent instruction preferred middle-L64 mechanisms; only new case selection changed, no baseline exact law was recomputed or overwritten.',
      interpretation: 'Selected using only exploratory k4/k8 means, never exact k2 outcomes; source k is a selection tag, not the exact system particle length.' };
    for (const source of exploration.selections) for (const point of source.selected) add(controllers.get(point.controller), `exploratory source k=${source.sourceK}`);
    const lockPath = path.join(stageRoot, 'experiments/confirmation.lock.json');
    if (fs.existsSync(lockPath)) {
      const lock = read(lockPath);
      const named = [...(lock.tests ?? []), ...(lock.families ?? []).flatMap(family => family.candidates ?? [])];
      const ids = [...new Set(named.map(test => test.controller))].filter(id => controllers.get(id)?.kind === 'feedback');
      exploration.lockCandidates = { lockSha256: hash(fs.readFileSync(lockPath)), ids };
      for (const id of ids) add(controllers.get(id), 'formal locked candidate; tiny-system explanation only');
    }
  }
  const dataDirectory = path.join(stageRoot, 'data/exact'); fs.mkdirSync(dataDirectory, { recursive: true });
  const cases = [];
  for (const boundary of ['periodic', 'open']) for (const { controller, reasons } of selected.values()) {
    const name = `L3-k2-${boundary}-${controller.classId}.json`, file = path.join(dataDirectory, name);
    let result;
    if (fs.existsSync(file)) {
      const stored = read(file);
      const scientificSealMatches = Object.entries(seal).filter(([relative]) => !relative.startsWith('scripts/'))
        .every(([relative, expected]) => stored.sourceSeal[relative] === expected);
      if (!scientificSealMatches || stored.controllerKey !== (controller.key ?? 'iid-fair') ||
          stored.result.parameters.L !== 3 || stored.result.parameters.k !== 2 || stored.result.parameters.boundary !== boundary) {
        throw new Error('Refusing to reinterpret or overwrite an exact case with different sources: ' + name);
      }
      result = stored.result;
    } else {
      result = exactFinite({ L: 3, k: 2, controller, boundary });
      if (compare(result.metrics.deadlockProbability, { numerator: '0', denominator: '1' }) !== 0) throw new Error('Certified-live exact case has deadlock mass');
      const stored = { schemaVersion: 1, generatedAtUTC: new Date().toISOString(), sourceSeal: seal,
        controllerKey: controller.key ?? 'iid-fair', controller: controller.probabilityH === undefined ?
          { outputs: controller.outputs, transitions: controller.transitions, initial: 0, minimalStateCount: controller.minimalStateCount, universalLiveness: true } : { probabilityH: .5, minimalStateCount: 1 },
        result };
      fs.writeFileSync(file, JSON.stringify(stored) + '\n', { flag: 'wx' });
    }
    cases.push({ controller: controller.classId, kind: controller.kind, key: controller.key ?? null,
      states: controller.minimalStateCount, boundary, L: 3, k: 2, reasons,
      metrics: result.metrics, diagnostics: result.diagnostics, file: `data/exact/${name}`, sha256: hash(fs.readFileSync(file)),
      originalCaseSourceSeal: read(file).sourceSeal,
      runnerSelectionSourceChangedSinceCase: read(file).sourceSeal['scripts/exact-survey.mjs'] !== seal['scripts/exact-survey.mjs'] });
  }
  const comparisons = [], frontiers = [];
  for (const boundary of ['periodic', 'open']) for (const budgetStates of [2, 3, 4]) {
    const eligible = cases.filter(c => c.boundary === boundary && c.states <= budgetStates && c.kind !== 'iid-reference');
    const nulls = eligible.filter(c => c.kind === 'temporal');
    const genuine = eligible.filter(c => c.kind === 'feedback' && !controllers.get(c.controller).temporalEquivalent);
    const temporalFrontier = nulls.filter(p => !nulls.some(q => exactDominates(q.metrics, p.metrics)));
    const combinedFrontier = eligible.filter(p => !eligible.some(q => exactDominates(q.metrics, p.metrics)));
    frontiers.push({ boundary, budgetStates, temporalClasses: nulls.length, feedbackSurveyed: genuine.length,
      temporalFrontier: temporalFrontier.map(c => c.controller), surveyedCombinedFrontier: combinedFrontier.map(c => c.controller) });
    for (const candidate of genuine) {
      const contrasts = nulls.map(nullCase => ({ baseline: nullCase.controller,
        coverageDifference: difference(candidate.metrics.coverage, nullCase.metrics.coverage),
        absOrderDifference: difference(candidate.metrics.absOrder, nullCase.metrics.absOrder),
        attemptsPerParticleDifference: difference(candidate.metrics.expectedAttemptsPerParticle, nullCase.metrics.expectedAttemptsPerParticle),
        candidateDominates: exactDominates(candidate.metrics, nullCase.metrics),
        baselineDominates: exactDominates(nullCase.metrics, candidate.metrics), metricsEqual: exactEqual(candidate.metrics, nullCase.metrics) }));
      comparisons.push({ boundary, budgetStates, controller: candidate.controller, minimalStates: candidate.states,
        temporalComparators: nulls.length, dominatesEveryTemporal: contrasts.every(c => c.candidateDominates),
        notDominatedByTemporal: contrasts.every(c => !c.baselineDominates),
        newExactNonDominatedPoint: contrasts.every(c => !c.baselineDominates && !c.metricsEqual),
        contrasts, scope: 'Exact L3,k2 conditional mean objectives; complete temporal null at this state budget, only surveyed feedback subset.' });
    }
  }
  if (JSON.stringify(seal) !== JSON.stringify(sourceSeal())) throw new Error('Exact survey source changed during computation');
  const preservationAfter = verifyPreservation();
  const report = { schemaVersion: 1, generatedAtUTC: new Date().toISOString(), sourceSeal: seal,
    scope: 'Exact L3,k2 terminal laws under fair global H/V exchange; full live temporal and one-bit feedback catalogues, plus at most12 exploratory selections per source k.',
    coarseAvailableAndIncluded: Boolean(exploration), exploration, exactCaseCount: cases.length,
    distinctControllerCount: selected.size, actualObjective: 'coverage E[theta], imbalance E[|S|], sampled-attempt reward E[A/N]; all strictly live. E[A/N] is not E[A]/E[N].',
    cases, frontiers, comparisons, preservationBefore, preservationAfter,
    limitations: ['L3,k2 exact capability does not establish an L16/L64,k4/k8 effect or thermodynamic limit.',
      'Only the full temporal and at-most-two-state live feedback catalogues are exhaustive performance surveys; larger feedback candidates are selected exploratory representatives.',
      'Three-state budget comparisons are intermediate; all four-state temporal nulls are used for the full two-bit budget regardless of candidate minimal state count.',
      'A new non-dominated point need not dominate every temporal controller; exact equality is not a strict frontier expansion.',
      'No statistical p-values are attached to exact rational comparisons; numerical value fields are convenience approximations.'] };
  const output = path.join(stageRoot, 'results/exact-survey.json'); fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ exactCases: cases.length, controllers: selected.size, coarseIncluded: Boolean(exploration),
    genuineNewPoints: comparisons.filter(c => c.newExactNonDominatedPoint).map(c => ({ boundary: c.boundary, budgetStates: c.budgetStates, controller: c.controller, states: c.minimalStates })),
    dominatesEveryTemporal: comparisons.filter(c => c.dominatesEveryTemporal).length, output }) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--baseline-only')) throw new Error('Usage: node scripts/exact-survey.mjs [--baseline-only]');
  runExactSurvey({ includeCoarse: !args.includes('--baseline-only') });
}
