import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRows, quantile, distribution, summarizeRows, frontierRows,
  lockFamily, analyzeConfirmation, summarizeHistograms, summarizeExploration, finiteSizeEffects } from '../analysis/summarize.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function raw({ controller = 'feedback', experiment = 'landscape', seed = '1001',
  alpha = .1, beta = 1, horizontal = 10, vertical = 10, initial_orientation = 'H' } = {}) {
  const particles = horizontal + vertical;
  return { experiment, controller, seed, alpha, beta, L: 16, k: 4, boundary: 'periodic',
    initial_mode: 'fair', initial_orientation, engine: 'phase-type', kinetic_kind: 'conditional-expectation',
    particles, horizontal, vertical, coverage: particles * 4 / 256,
    order: (horizontal - vertical) / particles, abs_order: Math.abs(horizontal - vertical) / particles,
    deadlock: 0, legal_h: 0, legal_v: 0, elapsed_ms: .1,
    expected_attempts: particles + 7.5, expected_failures: 7.5,
    accepted_pairs: particles - 1, accepted_switches: Math.min(8, 2 * Math.min(horizontal, vertical)) };
}

test('phase-type expected waiting is noninteger and never silently reclassified as actual attempts', () => {
  const row = normalizeRows([raw()])[0];
  near(row.expected_attempts, 27.5); near(row.expected_attempts_per_particle, 1.375);
  assert.equal(row.actual_attempts, null);
  assert.equal(summarizeRows([row])[0].metrics.actual_attempts.n, 0);
  assert.throws(() => normalizeRows([{ ...raw(), actual_attempts: 28, actual_failures: 8 }]), /cannot be labeled actual/);
  assert.throws(() => normalizeRows([{ ...raw(), expected_failures: '' }]), /incomplete/);
  assert.throws(() => normalizeRows([{ ...raw(), expected_attempts: 28 }]), /inconsistent expected/);
});

test('actual counters must be integral; accepted lag1 is a distinct product statistic', () => {
  const source = { ...raw(), kinetic_kind: 'actual', engine: 'direct', expected_attempts: '', expected_failures: '',
    actual_attempts: 28, actual_failures: 8, actual_switches: 10 };
  const row = normalizeRows([source])[0];
  near(row.accepted_lag1, 1 - 16 / 19); near(row.actual_switch_fraction, 10 / 28);
  assert.throws(() => normalizeRows([{ ...source, actual_attempts: 27.5, actual_failures: 7.5 }]), /must be integers/);
  assert.throws(() => normalizeRows([{ ...raw(), accepted_switches: 20 }]), /accepted sequence/);
  assert.throws(() => normalizeRows([{ ...raw(), initial_mode: 'H' }]), /fair/);
  assert.throws(() => normalizeRows([{ ...raw(), deadlock: 1, legal_h: 1 }]), /liveness/);
});

test('moments and signed distributions expose cancellation rather than calling it isotropy', () => {
  const samples = normalizeRows([raw({ horizontal: 20, vertical: 0 }), raw({ seed: '1002', horizontal: 0, vertical: 20, initial_orientation: 'V' })]);
  const group = summarizeRows(samples)[0];
  near(group.metrics.order.mean, 0); near(group.metrics.abs_order.mean, 1);
  near(group.metrics.order2.mean, 1); near(group.metrics.order4.mean, 1);
  near(group.binderMomentRatio, 2 / 3); assert.equal(group.cancellationWarning, true);
  assert.deepEqual(group.signedDistribution.sorted, [-1, 1]);
  assert.equal(group.signedDistribution.bins.reduce((sum, bin) => sum + bin.count, 0), 2);
});

test('type-7 quantiles and DKW inverse bounds are explicit and conservative', () => {
  near(quantile([-1, -.5, 0, .5, 1], .25), -.5);
  near(quantile([0, 1], .25), .25);
  const dist = distribution(Array.from({ length: 100 }, (_, i) => i / 99), [0, 1]);
  near(dist.dkwEpsilon, Math.sqrt(Math.log(40) / 200));
  assert.ok(dist.quantiles['0.5'].ciLow < .5 && dist.quantiles['0.5'].ciHigh > .5);
  assert.equal(dist.quantiles['0'].ciLow, 0); assert.equal(dist.quantiles['1'].ciHigh, 1);
  const empty = distribution([]); assert.equal(empty.dkwEpsilon, null); assert.equal(empty.quantiles['0.5'].value, null);
});

test('frontier retains every arm and matches against the entire observed null line without inference', () => {
  const rows = normalizeRows([
    raw({ controller: 'null-p0', alpha: 0, beta: 0, horizontal: 22, vertical: 0 }),
    raw({ controller: 'null-p5', alpha: .5, beta: .5, horizontal: 10, vertical: 10 }),
    raw({ controller: 'null-p1', alpha: 1, beta: 1, horizontal: 11, vertical: 11 }),
    raw({ controller: 'feedback', horizontal: 12, vertical: 11 }),
  ]);
  const frontier = frontierRows(summarizeRows(rows));
  assert.equal(frontier.length, 4);
  const candidate = frontier.find(row => row.controller === 'feedback');
  assert.equal(candidate.eligible_null_count, 2); assert.equal(candidate.best_eligible_null, 'null-p1');
  assert.equal(candidate.matched_null, 'null-p1'); assert.ok(candidate.excess_over_eligible_null_means > 0);
  assert.match(candidate.interpretation, /no continuum/);
  assert.equal(frontier.find(row => row.controller === 'null-p5').on_null_sample_frontier, 0);
});

function fixtureLock() {
  const pilot = normalizeRows([raw(), raw({ controller: 'null', alpha: .5, beta: .5, seed: '1002' })]);
  const common = { experiment: 'confirmation', L: 16, k: 4, boundary: 'periodic', controller: 'feedback', baseline: 'null', seedBlock: { start: 2001, count: 4 } };
  const spec = { pilotExperiments: ['landscape'], selectionRule: 'Fixture-only fixed matching, not a research decision', familyAlpha: .05,
    tests: [{ ...common, id: 'coverage', metric: 'coverage', alternative: 'two-sided', nullDifference: 0 },
      { ...common, id: 'noninferiority', metric: 'abs_order', alternative: 'less', nullDifference: .01 }] };
  return { pilot, spec, lock: lockFamily(pilot, [], spec) };
}

function confirmationRows() {
  return normalizeRows([0, 1, 2, 3].flatMap(i => [
    raw({ experiment: 'confirmation', seed: String(2001 + i), horizontal: 12 + i, vertical: 12 + i }),
    raw({ experiment: 'confirmation', controller: 'null', alpha: .5, beta: .5, seed: String(2001 + i), horizontal: 10 + i, vertical: 11 + i }),
  ]));
}

test('explicit lock fixes both comparison hypotheses, parameter signatures and independent seed blocks', () => {
  const { pilot, spec, lock } = fixtureLock();
  assert.equal(lock.familySize, 2); assert.equal(lock.tests[1].armParameters.feedback.beta, 1);
  assert.equal(lock.tests[1].expectedRepetitions, 4);
  assert.throws(() => lockFamily([...pilot, ...confirmationRows()], [], spec), /after confirmation/);
  const reused = structuredClone(spec); reused.tests[0].seedBlock.start = 1001;
  assert.throws(() => lockFamily(pilot, [], reused), /reused pilot/);
  const repeated = structuredClone(spec); repeated.tests[1].id = 'coverage';
  assert.throws(() => lockFamily(pilot, [], repeated), /Repeated locked/);
});

test('one-sided paired anisotropy noninferiority shares the complete corrected family', () => {
  const { lock } = fixtureLock(), result = analyzeConfirmation(confirmationRows(), lock);
  assert.equal(result.audit.status, 'complete'); assert.equal(result.tests.length, 2);
  const ni = result.tests[1];
  assert.ok(ni.mean < 0); assert.ok(ni.pRaw > 0 && ni.pRaw < .001); assert.equal(ni.rejectAtAlpha, true);
  assert.ok(ni.simultaneousUpperOneSided < .01); assert.ok(ni.pHolm >= ni.pRaw);
  assert.equal(ni.n, 4); assert.match(ni.method, /less/);
});

test('missing, unexpected, duplicate and leaked paired seeds remain in their original family slots', () => {
  const { lock } = fixtureLock(), rows = confirmationRows();
  for (const damaged of [rows.slice(1), [...rows, rows[0]], rows.map((row, i) => i < 2 ? { ...row, seed: '1001' } : row),
    rows.map((row, i) => i < 2 ? { ...row, seed: '9999' } : row)]) {
    const result = analyzeConfirmation(damaged, lock);
    assert.equal(result.audit.status, 'invalid-or-incomplete'); assert.equal(result.tests.length, 2);
    assert.equal(result.tests[1].pRaw, null); assert.equal(result.tests[1].pHolm, 1);
  }
  const changed = rows.map(row => row.controller === 'feedback' ? { ...row, alpha: .2 } : row);
  assert.equal(analyzeConfirmation(changed, lock).tests[0].parameterMatch, false);
});

test('constant nonzero paired effects are not assigned an artificial zero p value', () => {
  const { lock } = fixtureLock(), rows = confirmationRows();
  // Coverage gains are identical on this fixed lattice size despite different S.
  const coverage = analyzeConfirmation(rows, lock).tests[0];
  assert.equal(coverage.degenerateNonzeroDifference, true); assert.equal(coverage.pRaw, null);
  assert.equal(coverage.pHolm, 1); assert.equal(coverage.rejectAtAlpha, false);
});

test('sampled event counters, numeric initialization and missing proposal histograms retain their meaning', () => {
  const source = { ...raw(), initial_orientation: 0, engine: 'event', kinetic_kind: 'sampled-actual',
    expected_attempts: '', expected_failures: '', actual_attempts: 28, actual_failures: 8, actual_switches: 10,
    attempts: 28, failures: 8, trial_switches: 10, conditional_mean_attempts_sum: 29.5,
    accepted_run_count: 9, accepted_mean_run_length: 20 / 9, accepted_max_run_length: 5,
    trial_run_count: 11, trial_mean_run_length: 28 / 11, trial_lag1_correlation: 1 - 20 / 27 };
  const row = normalizeRows([source])[0];
  assert.equal(row.initial_orientation, 'H'); near(row.trial_lag1, 1 - 20 / 27);
  near(row.conditional_mean_attempts_sum, 29.5); near(row.actual_attempts, 28);
  const record = { experiment: row.experiment, controller: row.controller, L: row.L, k: row.k,
    boundary: row.boundary, seed: row.seed, accepted: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 }, trial: null };
  const pooled = summarizeHistograms([record], [row]);
  assert.equal(pooled.groups[0].accepted.runsMeasured, 1); assert.equal(pooled.groups[0].trial.runsMissing, 1);
  assert.throws(() => summarizeHistograms([{ ...record, accepted: { 2: 10 } }], [row]), /inconsistent/);
  assert.throws(() => summarizeHistograms([record, record], [row]), /duplicate/);
});

test('combined exploration pools the same observations once and rejects repeated underlying seeds', () => {
  const rows = normalizeRows([raw(), raw({ experiment: 'refinement', seed: '12001', horizontal: 12, vertical: 12 })]);
  const combined = summarizeExploration(rows);
  assert.equal(combined.length, 1); assert.equal(combined[0].n, 2);
  near(combined[0].metrics.coverage.mean, 22 * 4 / 256);
  assert.equal(combined[0].experiment, 'exploration-combined');
  assert.throws(() => summarizeExploration([rows[0], { ...rows[0], experiment: 'refinement' }]), /repeats/);
});

test('finite-size effects preserve paired covariance without unregistered p values', () => {
  const rows = normalizeRows([0, 1, 2].flatMap(i => [
    raw({ experiment: 'large_size', controller: 'policy41', alpha: 0, beta: 1, seed: String(501 + i), horizontal: 12 + i, vertical: 10 }),
    raw({ experiment: 'large_size', controller: 'fair', alpha: .5, beta: .5, seed: String(501 + i), horizontal: 10 + i, vertical: 10 }),
  ]));
  const results = finiteSizeEffects(rows);
  assert.equal(results.length, 4); assert.equal(results[0].n, 3); near(results[0].mean, 2 * 4 / 256);
  assert.equal(results[0].pRaw, undefined); assert.match(results[0].interpretation, /no post hoc/);
});

test('new proposal-matched null is fixed from pilot actual switching without fictional null observations', () => {
  const pilot = normalizeRows([0, 1].map(i => ({ ...raw({ seed: String(1001 + i) }), kinetic_kind: 'sampled-actual', engine: 'event',
    expected_attempts: '', expected_failures: '', actual_attempts: 28 + i, actual_failures: 8 + i, actual_switches: 10 + i })));
  const { spec } = fixtureLock(), p = (10 / 27 + 11 / 28) / 2;
  spec.tests.forEach(item => { item.baseline = 'matched-null'; });
  spec.armParameters = { 'matched-null': { alpha: p, beta: p, initial_mode: 'fair', engine: 'event', kinetic_kind: 'sampled-actual',
    source: { kind: 'pilot-trial-switch-match', experiments: ['landscape'], controller: 'feedback', L: 16, k: 4, boundary: 'periodic', metric: 'trial_switch_fraction' } } };
  const lock = lockFamily(pilot, [], spec), matched = lock.tests[0].armParameters['matched-null'];
  near(matched.alpha, p); assert.equal(matched.matchingEstimate.n, 2); assert.match(matched.interpretation, /not a pilot-sampled/);
  const wrong = structuredClone(spec); wrong.armParameters['matched-null'].alpha += .01;
  assert.throws(() => lockFamily(pilot, [], wrong), /does not match/);
  const leaked = structuredClone(spec); leaked.armParameters['matched-null'].source.experiments = ['confirmation'];
  assert.throws(() => lockFamily(pilot, [], leaked), /explicit pilot/);
});

test('a coverage less-than-positive-margin rejection cannot be mislabeled as a positive benefit', () => {
  const { lock } = fixtureLock(), rows = confirmationRows();
  rows.filter(row => row.controller === 'feedback').forEach((row, i) => { row.coverage += i % 2 / 64; });
  lock.tests[0].alternative = 'less'; lock.tests[0].nullDifference = .2;
  const result = analyzeConfirmation(rows, lock);
  assert.equal(result.tests[0].rejectAtAlpha, true); assert.ok(result.tests[0].mean > 0);
  assert.equal(result.jointBenefits[0].confirmedJointBenefit, false);
});
