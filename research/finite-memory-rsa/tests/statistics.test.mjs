import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, csvText, normalizeRows, studentTCDF, studentTQuantile, studentTTwoSidedP, regularizedBeta,
  descriptive, wilson, holm, exactMcNemar, pairedEffect, summarizeRows, lockFamily,
  analyzeConfirmation, paretoRows } from '../analysis/summarize.mjs';
import { conditionalInformation, summarizeRescue, summarizeDynamics } from '../analysis/extensions.mjs';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function row({ experiment = 'atlas', controller = '19', seed = '100001', horizontal = 10, vertical = 10,
  L = 8, k = 2, deadlock = 0, legal_h = 0, legal_v = 0 } = {}) {
  const particles = horizontal + vertical, attempts = particles + 10;
  return { experiment, controller, seed, L, k, boundary: 'periodic', particles, horizontal, vertical,
    coverage: particles * k / (L * L), order: particles ? (horizontal - vertical) / particles : 0,
    abs_order: particles ? Math.abs(horizontal - vertical) / particles : 0,
    deadlock, legal_h, legal_v, attempts, failures: 10, elapsed_ms: .01,
    attempted_h: horizontal + 5, attempted_v: vertical + 5 };
}

test('CSV quotes, BOM, escaped quotes and CRLF round-trip without seed coercion', () => {
  const input = '\uFEFFname,seed,note\r\n"a,b",0001,"say ""hello""\nnext"\r\n';
  const parsed = parseCSV(input);
  assert.deepEqual(parsed, [{ name: 'a,b', seed: '0001', note: 'say "hello"\nnext' }]);
  assert.deepEqual(parseCSV(csvText(parsed)), parsed);
  assert.throws(() => parseCSV('a,a\n1,2'), /Duplicate/);
  assert.throws(() => parseCSV('a,b\n1'), /column/);
  assert.throws(() => parseCSV('a\n"one'), /Unclosed/);
});

test('sample SD, SE and Student-t 95% intervals use n-1, not particle counts', () => {
  const stats = descriptive([1, 2, 3, 4, 5]);
  near(stats.mean, 3); near(stats.sd, Math.sqrt(2.5)); near(stats.se, Math.sqrt(.5));
  near(stats.ciLow, 1.03675683852, 1e-9); near(stats.ciHigh, 4.96324316148, 1e-9);
  assert.equal(descriptive([5]).se, null); assert.equal(descriptive([5]).ciLow, null);
  assert.equal(descriptive([null, undefined, NaN]).mean, null);
  assert.equal(descriptive([1, null, 3]).n, 2);
});

test('Student-t and beta numerical values match independent analytic/table values', () => {
  near(regularizedBeta(.25, 1, 1), .25);
  near(regularizedBeta(.5, 2, 2), .5);
  // df=1 is a Cauchy distribution; df=2 CDF has a closed form.
  for (const t of [-10, -2, -.2, 0, .2, 2, 10]) {
    near(studentTCDF(t, 1), .5 + Math.atan(t) / Math.PI, 1e-12);
    near(studentTCDF(t, 2), .5 + t / (2 * Math.sqrt(t * t + 2)), 1e-12);
  }
  near(studentTQuantile(.975, 1), 12.7062047361747, 1e-9);
  near(studentTQuantile(.975, 9), 2.262157162798, 1e-10);
  near(studentTQuantile(.975, 63), 1.9983405425207, 1e-9);
  near(studentTCDF(studentTQuantile(.999, 511), 511), .999, 1e-12);
  // Large finite t must not become p=0 merely because CDF rounds to one.
  near(studentTTwoSidedP(1e10, 1), 2 / (Math.PI * 1e10), 1e-21);
  assert.ok(studentTTwoSidedP(10, 511) > 0);
  assert.ok(studentTTwoSidedP(10, 511) < 1e-20);
});

test('Wilson intervals retain uncertainty for zero events and all events', () => {
  const zero = wilson(0, 64), all = wilson(64, 64);
  near(zero.ciLow, 0); near(zero.ciHigh, .05662405979280533);
  near(all.ciLow, 1 - zero.ciHigh); near(all.ciHigh, 1);
  near(wilson(50, 100).ciLow, .4038315303659957);
  near(wilson(50, 100).ciHigh, .5961684696340044);
  assert.equal(wilson(0, 0).rate, null);
});

test('Holm keeps whole family and produces monotone adjusted p values', () => {
  assert.deepEqual(holm([.01, .04, .03]), [.03, .06, .06]);
  assert.deepEqual(holm([.01, null, .04, .03]), [.04, 1, .09, .09]);
  assert.throws(() => holm([-.1]), /Invalid/);
});

test('paired effects use same-seed covariance and exact McNemar discordances', () => {
  const first = [{ seed: '2', coverage: .7 }, { seed: '1', coverage: .9 }, { seed: '3', coverage: .6 }];
  const second = [{ seed: '1', coverage: .8 }, { seed: '2', coverage: .65 }, { seed: '3', coverage: .6 }];
  const effect = pairedEffect(first, second, 'coverage', 10);
  near(effect.mean, .05); near(effect.sd, .05);
  assert.equal(effect.n, 3); assert.ok(effect.simultaneousCiHigh > effect.ciHigh);
  assert.equal(pairedEffect(first, second.slice(0, 2), 'coverage').missingB, 1);
  near(exactMcNemar(0, 5), .0625); near(exactMcNemar(1, 7), .0703125);
  assert.equal(exactMcNemar(0, 0), 1);
  const binary = pairedEffect([{ seed: '1', deadlock: 1 }, { seed: '2', deadlock: 1 }],
    [{ seed: '1', deadlock: 0 }, { seed: '2', deadlock: 0 }], 'deadlock');
  assert.equal(binary.onlyA, 2); assert.equal(binary.onlyB, 0); near(binary.pRaw, .5);
  const constant = pairedEffect(first, first.map(item => ({ ...item, coverage: item.coverage - .25 })), 'coverage');
  assert.equal(constant.pRaw, null); assert.equal(constant.degenerateNonzeroDifference, true);
});

test('missing orientation counts remain null and terminal/count identities are checked', () => {
  const memoryless = row(); memoryless.attempted_h = ''; memoryless.attempted_v = '';
  const normalized = normalizeRows([memoryless])[0];
  assert.equal(normalized.attempted_h, null); assert.equal(normalized.attempted_h_fraction, null);
  assert.equal(summarizeRows([normalized])[0].metrics.attempted_h.n, 0);
  assert.throws(() => normalizeRows([{ ...row(), coverage: .7 }]), /inconsistent/);
  assert.throws(() => normalizeRows([{ ...row(), legal_h: 1 }]), /deadlock/);
  assert.throws(() => normalizeRows([{ ...row(), attempted_h: '' }]), /only one/);
});

test('signed-order cancellation does not satisfy run-wise isotropy', () => {
  const groups = summarizeRows(normalizeRows([row({ horizontal: 20, vertical: 0 }), row({ seed: '100002', horizontal: 0, vertical: 20 })]));
  near(groups[0].metrics.order.mean, 0); near(groups[0].metrics.abs_order.mean, 1);
  assert.equal(groups[0].observedIsotropic, false); assert.equal(groups[0].cancellationWarning, true);
  const pareto = paretoRows(groups); assert.equal(pareto[0].observed_isotropic, 0);
});

test('pilot-only sealing handles numeric codes and blocks confirmation leakage', () => {
  const rows = normalizeRows([row()]);
  const spec = { pilotExperiments: ['atlas'], confirmationExperiments: ['confirmation'], selectedControllers: [19],
    baselineControllers: ['random-0.5'], strata: [{ L: 8, k: 2, boundary: 'periodic' }], expectedRepetitions: 3,
    selectionRule: 'Fixed test fixture, not scientific result' };
  const lock = lockFamily(rows, [], spec);
  assert.deepEqual(lock.selectedControllers, ['19']); assert.equal(lock.comparisons[0].controller, '19');
  assert.throws(() => lockFamily([...rows, { ...rows[0], experiment: 'confirmation' }], [], spec), /Cannot preregister/);
  const conf = normalizeRows([0, 1, 2].flatMap(i => [row({ experiment: 'confirmation', seed: String(200001 + i), horizontal: 12 + i, vertical: 12 }),
    row({ experiment: 'confirmation', controller: 'random-0.5', seed: String(200001 + i), horizontal: 10 + i, vertical: 11 })]));
  const result = analyzeConfirmation(conf, lock);
  assert.equal(result.tests.length, 2); assert.equal(result.audit.familySize, 2);
  assert.equal(result.audit.status, 'complete'); assert.equal(result.tests[0].n, 3);
  assert.equal(result.tests[1].kind, 'isotropy-upper-bound');
  const missing = analyzeConfirmation(conf.slice(1), lock);
  assert.equal(missing.audit.status, 'invalid-or-incomplete'); assert.equal(missing.tests.length, 2);
  assert.equal(missing.tests[0].pRaw, null); assert.equal(missing.tests[0].pHolm, 1);
  const leakage = analyzeConfirmation(conf.map(r => ({ ...r, seed: r.seed === '200001' ? '100001' : r.seed })), lock);
  assert.equal(leakage.audit.reusedPilotSeeds.length, 1);
  assert.equal(leakage.tests[0].complete, false);
});

test('exploratory information distinguishes constant switching, IID actions and outcome feedback', () => {
  const constant = [[[0, 5], [0, 5]], [[0, 5], [0, 5]]];
  const iid = [[[5, 5], [5, 5]], [[5, 5], [5, 5]]];
  const feedback = [[[5, 0], [0, 5]], [[5, 0], [0, 5]]];
  near(conditionalInformation(constant).conditionalMI, 0);
  near(conditionalInformation(iid).conditionalMI, 0);
  const measured = conditionalInformation(feedback);
  near(measured.conditionalMI, 1); assert.equal(measured.switchAfterFailure, 0); assert.equal(measured.switchAfterSuccess, 1);
  const record = { controller: '38', L: 8, k: 2, seed: 1, coverage: .75, attempts: 21,
    conditionalMI: 1, switchAfterFailure: 0, switchAfterSuccess: 1, transitionCounts: feedback };
  assert.equal(summarizeDynamics({ records: [record] }).groups[0].n, 1);
  assert.throws(() => summarizeDynamics({ records: [{ ...record, conditionalMI: .5 }] }), /inconsistent/);
  assert.throws(() => summarizeDynamics({ records: [{ ...record, attempts: 20 }] }), /attempts-1/);
});

test('exploratory rescue reports paired gain including zero-gain geometric jams', () => {
  const first = { L: 4, k: 2, boundary: 'periodic', seed: '1', deadlock: 1,
    before_coverage: .5, after_coverage: .625, coverage_gain: .125, added_particles: 1,
    before_abs_order: 0, after_abs_order: .2 };
  const second = { ...first, seed: '2', deadlock: 0, after_coverage: .5, coverage_gain: 0, added_particles: 0, after_abs_order: 0 };
  const summary = summarizeRescue([first, second]).groups[0];
  near(summary.metrics.coverage_gain.mean, .0625);
  assert.equal(summary.metrics.coverage_gain.n, 2); assert.equal(summary.gainConditionalOnDeadlock.n, 1);
  near(summary.gainConditionalOnDeadlock.mean, .125);
  assert.throws(() => summarizeRescue([{ ...first, deadlock: 0 }]), /geometric jam/);
  assert.throws(() => summarizeRescue([{ ...first, added_particles: 2 }]), /Inconsistent/);
});
