/** Validation only: never changes a frozen source, lock or scientific input. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseCSV, studentTTwoSidedP, studentTQuantile } from '../../../analysis/summarize.mjs';

const SELF = fileURLToPath(import.meta.url);
const STAGE = path.resolve(path.dirname(SELF), '../..');
const RESEARCH = path.resolve(STAGE, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = relative => JSON.parse(fs.readFileSync(path.join(STAGE, relative), 'utf8'));
const near = (a, b) => Math.abs(a - b) <= 2e-11 * Math.max(1, Math.abs(a), Math.abs(b));
const key = row => JSON.stringify([row.experiment, row.controller, row.L, row.k, row.boundary, row.seed]);
const fail = message => { throw new Error(message); };

function welford(values) {
  let mean = 0, m2 = 0, n = 0;
  for (const value of values) { n++; const delta = value - mean; mean += delta / n; m2 += delta * (value - mean); }
  const sd = Math.sqrt(Math.max(0, m2 / (n - 1))), se = sd / Math.sqrt(n);
  return { n, mean, sd, se };
}
function ownHolm(values) {
  const order = [...values.keys()].sort((a, b) => values[a] - values[b] || a - b), adjusted = Array(values.length);
  let running = 0;
  for (let rank = 0; rank < order.length; rank++) {
    running = Math.max(running, Math.min(1, (order.length - rank) * values[order[rank]]));
    adjusted[order[rank]] = running;
  }
  return adjusted;
}

export function auditPrimary({ beforeAnalysis = false, output = 'results/evidence/statistical-audit.json' } = {}) {
  const lock = read('experiments/confirmation.lock.json'), protocolPath = path.join(STAGE, 'experiments/search-protocol.json');
  if (lock.protocolSha256 !== hash(fs.readFileSync(protocolPath))) fail('Locked protocol hash mismatch');
  if (lock.selectionSourceSha256 !== hash(fs.readFileSync(path.join(STAGE, 'results/middle-groups.json')))) fail('Locked pilot summary hash mismatch');
  for (const [relative, expected] of Object.entries(lock.sourceSeal))
    if (hash(fs.readFileSync(path.join(RESEARCH, relative))) !== expected) fail('Changed locked source: ' + relative);
  for (const [relative, expected] of Object.entries(lock.analysisSeal))
    if (hash(fs.readFileSync(path.join(STAGE, relative))) !== expected) fail('Changed locked analysis: ' + relative);
  const allSeeds = new Map(), datasets = [], confirmation = [];
  for (const name of ['coarse', 'middle', 'confirmation']) {
    const plan = name === 'confirmation' ? lock : read(`experiments/${name}.plan.json`);
    const expected = new Set();
    for (const arm of plan.arms) {
      if (!Number.isSafeInteger(arm.seedStart) || !Number.isSafeInteger(arm.repetitions)) fail('Invalid plan seed block');
      for (let i = 0; i < arm.repetitions; i++) {
        const id = key({ experiment: name, controller: arm.controller, L: arm.L, k: arm.k, boundary: arm.boundary ?? 'periodic', seed: arm.seedStart + i });
        if (expected.has(id)) fail('Repeated planned observation'); expected.add(id);
      }
    }
    const bytes = fs.readFileSync(path.join(STAGE, `data/raw/${name}.csv`));
    const seen = new Set(), seeds = new Set(), summary = read(`results/${name}-groups.json`);
    for (const input of parseCSV(bytes.toString('utf8'))) {
      const row = { ...input };
      for (const field of ['L', 'k', 'seed', 'memory_states', 'coverage', 'order', 'abs_order', 'particles', 'horizontal', 'vertical',
        'attempts', 'failures', 'attempts_per_particle', 'deadlock', 'legal_h', 'legal_v', 'attempted_h', 'attempted_v', 'failed_h', 'failed_v']) {
        if (input[field] === '' || !Number.isFinite(Number(input[field]))) fail(`Missing/invalid ${name}/${field}`);
        row[field] = Number(input[field]);
      }
      const id = key(row);
      if (!expected.has(id) || seen.has(id)) fail('Unplanned/duplicated arm, L, k, boundary, experiment or seed: ' + id);
      seen.add(id); seeds.add(row.seed);
      for (const field of ['L', 'k', 'seed', 'particles', 'horizontal', 'vertical', 'attempts', 'failures', 'attempted_h', 'attempted_v', 'failed_h', 'failed_v'])
        if (!Number.isSafeInteger(row[field]) || row[field] < 0) fail('Unsafe raw count');
      if (row.horizontal + row.vertical !== row.particles || row.attempts !== row.particles + row.failures
        || row.attempted_h + row.attempted_v !== row.attempts || row.failed_h + row.failed_v !== row.failures
        || row.attempted_h !== row.horizontal + row.failed_h || row.attempted_v !== row.vertical + row.failed_v
        || !near(row.coverage, row.k * row.particles / (row.L * row.L))
        || !near(row.order, (row.horizontal - row.vertical) / row.particles) || !near(row.abs_order, Math.abs(row.order))
        || !near(row.attempts_per_particle, row.attempts / row.particles)
        || row.deadlock !== 0 || row.legal_h !== 0 || row.legal_v !== 0) fail('Raw terminal/count/kinetic identity failed');
      if (name === 'confirmation') confirmation.push(row);
    }
    if (seen.size !== expected.size || summary.runs !== seen.size || summary.rawSha256 !== hash(bytes)) fail('Missing rows or raw summary hash mismatch');
    if (name === 'confirmation' && !(summary.startedAtUTC >= lock.lockedAtUTC)) fail('Holdout preceded lock');
    allSeeds.set(name, seeds);
    datasets.push({ name, rows: seen.size, boundaryValidated: 'Every row exactly matches its planned boundary', rawSha256: hash(bytes),
      planSha256: hash(Buffer.from(JSON.stringify(plan))), seedMin: Math.min(...seeds), seedMax: Math.max(...seeds),
      startedAtUTC: summary.startedAtUTC, finishedAtUTC: summary.finishedAtUTC });
  }
  const reusedSeeds = [...allSeeds.get('confirmation')].filter(seed => allSeeds.get('coarse').has(seed) || allSeeds.get('middle').has(seed));
  if (reusedSeeds.length) fail('Confirmation shares exploratory seeds');
  const byArm = new Map();
  for (const row of confirmation) { const id = JSON.stringify([row.L, row.k, row.boundary, row.controller]); if (!byArm.has(id)) byArm.set(id, new Map()); byArm.get(id).set(row.seed, row); }
  const tests = [], pairs = [];
  for (const family of lock.families) {
    const liveTemporal = family.nulls.filter(control => control.kind === 'temporal');
    if (liveTemporal.length !== 16 || family.nulls.length !== 17) fail('Incomplete matched-memory null inventory');
    for (const candidate of family.candidates) for (const control of family.nulls) {
      const arm = controller => lock.arms.filter(item => item.L === family.L && item.k === family.k && item.controller === controller);
      const ca = arm(candidate.controller), cb = arm(control.controller);
      if (ca.length !== 1 || cb.length !== 1 || ca[0].repetitions !== 768 || cb[0].repetitions !== 768
        || ca[0].seedStart !== cb[0].seedStart || (ca[0].boundary ?? 'periodic') !== (cb[0].boundary ?? 'periodic')) fail('The locked analyzer is restricted to its fixed 768 paired design');
      const a = byArm.get(JSON.stringify([family.L, family.k, ca[0].boundary ?? 'periodic', candidate.controller]));
      const b = byArm.get(JSON.stringify([family.L, family.k, cb[0].boundary ?? 'periodic', control.controller]));
      const values = [[], [], []], offset = tests.length;
      for (let i = 0; i < 768; i++) {
        const seed = ca[0].seedStart + i, first = a.get(seed), second = b.get(seed);
        if (!first || !second) fail('Missing exact locked paired seed');
        values[0].push(first.coverage - second.coverage);
        values[1].push(lock.absMargin + second.abs_order - first.abs_order);
        values[2].push(lock.costMultiplier * second.attempts_per_particle - first.attempts_per_particle);
      }
      for (let m = 0; m < 3; m++) {
        const stats = welford(values[m]);
        if (stats.se === 0 && stats.mean !== 0) fail('Zero-SE nonzero effect: frozen p=0 branch is inadmissible for this validation');
        const pRaw = stats.se === 0 ? 1 : stats.mean >= 0 ? studentTTwoSidedP(stats.mean / stats.se, stats.n - 1) / 2
          : 1 - studentTTwoSidedP(stats.mean / stats.se, stats.n - 1) / 2;
        const half = studentTQuantile(1 - lock.alpha / (2 * lock.testFamilySize), stats.n - 1) * stats.se;
        tests.push({ k: family.k, candidate: candidate.controller, null: control.controller, metric: lock.metrics[m], ...stats, pRaw,
          simultaneousCiLow: stats.mean - half, simultaneousCiHigh: stats.mean + half });
      }
      pairs.push({ k: family.k, candidate: candidate.controller, null: control.controller, indices: [offset, offset + 1, offset + 2] });
    }
  }
  if (tests.length !== lock.testFamilySize) fail('Whole-family test count mismatch');
  const adjusted = ownHolm(tests.map(item => item.pRaw));
  tests.forEach((item, i) => { item.pHolm = adjusted[i]; item.reject = adjusted[i] < lock.alpha; });
  pairs.forEach(item => { item.marginQualifiedJointBenefit = item.indices.every(index => tests[index].reject); });
  const twoBitGate = lock.families.some(family => family.candidates.some(candidate => pairs.filter(pair => pair.k === family.k && pair.candidate === candidate.controller).every(pair => pair.marginQualifiedJointBenefit)));
  const oneBitGate = lock.families.some(family => family.candidates.some(candidate => candidate.states <= 2 && pairs.filter(pair => pair.k === family.k && pair.candidate === candidate.controller
    && family.nulls.find(control => control.controller === pair.null).states <= 2).every(pair => pair.marginQualifiedJointBenefit)));
  let comparisons = 0;
  if (!beforeAnalysis) {
    const stored = read('results/confirmation-analysis.json');
    if (stored.rawSha256 !== datasets.find(item => item.name === 'confirmation').rawSha256 || stored.lockedFileSha256 !== hash(fs.readFileSync(path.join(STAGE, 'experiments/confirmation.lock.json')))
      || stored.tests.length !== tests.length) fail('Stored primary result hash/count mismatch');
    for (let i = 0; i < tests.length; i++) {
      const actual = tests[i], expected = stored.tests[i];
      for (const field of ['k', 'candidate', 'null', 'metric', 'n', 'reject']) if (actual[field] !== expected[field]) fail('Stored test identity/rejection differs');
      for (const field of ['mean', 'sd', 'se', 'pRaw', 'pHolm', 'simultaneousCiLow', 'simultaneousCiHigh'])
        if (!near(actual[field], expected[field])) fail('Independent scalar recomputation differs: ' + field);
      comparisons++;
    }
    if (stored.rejections !== tests.filter(item => item.reject).length || stored.jointPairs.length !== pairs.filter(item => item.marginQualifiedJointBenefit).length
      || stored.twoBitBenefitEstablished !== twoBitGate || stored.oneBitBenefitEstablished !== oneBitGate) fail('Stored family/gate result differs');
  }
  const result = { schemaVersion: 1, purpose: 'Independent read-only metadata, paired-contrast and whole-family validation; not new inferential sampling',
    verifiedAtUTC: new Date().toISOString(), runtime: { node: process.version, platform: process.platform, arch: process.arch },
    auditSourceSha256: hash(fs.readFileSync(SELF)), datasets, reusedPilotSeeds: reusedSeeds, tests: tests.length, zeroSeTests: tests.filter(item => item.se === 0).length,
    numericStoredTestsCompared: comparisons, rejections: tests.filter(item => item.reject).length, marginQualifiedJointPairs: pairs.filter(item => item.marginQualifiedJointBenefit).length,
    oneBitEveryNullGate: oneBitGate, twoBitEveryNullGate: twoBitGate, status: 'passed',
    interpretation: 'Margins permit a .01 absolute-imbalance increase and 10% mean cost increase. Joint rejection is not strict Pareto dominance. Failure of the every-null gate does not prove absence among pruned controllers or no frontier expansion.',
    numericalIndependence: 'Own Welford differences, seed/metadata checks and Holm implementation; uses the already validated frozen Stage I Student-t tail/quantile routines.',
    limitations: ['The frozen analyzer is limited to this fixed L64,768-run paired design; its omitted metadata guards are supplied here.',
      'All present SEs are positive, so its degenerate positive-constant p=0 branch is dormant. The validator rejects such future input instead of revising locked results.',
      'Student-t/Bonferroni inference is finite-variance CLT-based, not an exact finite-sample guarantee for skewed costs.',
      'The review itself is post-holdout validation, not a new preregistration.'] };
  if (output) { const destination = path.resolve(STAGE, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n'); }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const beforeAnalysis = process.argv.includes('--before-analysis');
  const args = process.argv.slice(2); if (args.some(arg => arg !== '--before-analysis')) fail('Only --before-analysis is accepted');
  console.log(JSON.stringify(auditPrimary({ beforeAnalysis }), null, 2));
}
