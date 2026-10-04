import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../../src/rng.mjs';
import { simulateFinite, compileController, sampleFailureEpisode } from '../src/simulate.mjs';
import { exactFinite } from '../src/exact.mjs';

const alternate = { id: 'alternation', outputs: [0, 1], transitions: [[1, 1], [0, 0]], initial: 0 };
const prefix = { id: 'prefix-dead', outputs: [0, 0, 1, 1], transitions: [[3, 1], [2, 1], [3, 0], [3, 0]], initial: 0 };
const cycle = { id: 'four-cycle', outputs: [0, 0, 1, 1], transitions: [[1, 2], [2, 3], [3, 0], [0, 1]], initial: 0 };
const fields = ['coverage', 'abs_order', 'order2', 'order4', 'deadlock', 'attempts', 'attempts_per_accepted'];

function meanSd(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return { mean, se: Math.sqrt(variance / values.length) };
}

test('controller validation and diagnostic aborts never produce terminal data', () => {
  assert.throws(() => compileController({ outputs: [0], transitions: [[1, 0]], initial: 0 }), /Require/);
  assert.throws(() => compileController({ outputs: [0], transitions: [[0, 0]], initial: 1 }), /Require/);
  assert.throws(() => simulateFinite({ L: 8, k: 2, controller: alternate, seed: 1, trace: true }), /direct/);
  assert.throws(() => simulateFinite({ L: 8, k: 2, controller: alternate, seed: 1, maxAttempts: 1 }), /only/);
  assert.throws(() => simulateFinite({ L: 8, k: 2, controller: alternate, seed: 1, engine: 'direct', maxAttempts: 1 }), /no terminal result/);
  assert.throws(() => simulateFinite({ L: 8, k: 2, controller: { probabilityH: .25 }, seed: 1 }), /Only/);
});

test('direct trajectories independently reconstruct every actual counter and run statistic', () => {
  for (const controller of [alternate, prefix, cycle]) for (const boundary of ['periodic', 'open']) {
    const result = simulateFinite({ L: 6, k: 2, controller, boundary, seed: 71000001, engine: 'direct', trace: true, snapshot: true, validate: true });
    const records = result.trajectory, success = records.filter(row => row.success), failed = records.filter(row => !row.success);
    const switches = list => list.slice(1).filter((row, i) => row.orientation !== list[i].orientation).length;
    const maximum = list => { let previous = null, length = 0, max = 0; for (const row of list) { length = row.orientation === previous ? length + 1 : 1; previous = row.orientation; max = Math.max(max, length); } return max; };
    assert.equal(records.length, result.attempts); assert.equal(failed.length, result.failures); assert.equal(success.length, result.particles);
    assert.equal(switches(records), result.trial_switches); assert.equal(switches(success), result.accepted_switches);
    assert.equal(maximum(records), result.trial_max_run_length); assert.equal(maximum(success), result.accepted_max_run_length);
    for (const o of [0, 1]) {
      assert.equal(records.filter(row => row.orientation === o).length, result[o ? 'attempted_v' : 'attempted_h']);
      assert.equal(failed.filter(row => row.orientation === o).length, result[o ? 'failed_v' : 'failed_h']);
    }
    assert.equal(result.lattice.occupancy.filter(Boolean).length, result.k * result.particles);
    assert.equal(result.deadlock + result.geometric_jam, 1);
  }
});

test('zero-hazard suffix is recognized immediately instead of charging phantom failures', () => {
  const policy = compileController(prefix), event = sampleFailureEpisode(policy, 2, [1, 0], 4, new RNG(3));
  assert.equal(event.terminal, true); assert.equal(event.state, 2); assert.deepEqual(event.failures, [0, 0]);
  const forceFail = { uniform: () => .9 };
  const preceding = sampleFailureEpisode(policy, 1, [1, 0], 4, forceFail);
  assert.equal(preceding.terminal, true); assert.equal(preceding.state, 2); assert.deepEqual(preceding.failures, [1, 0]);
});

test('event and original-trial engines agree with exact terminal and kinetic references', () => {
  const n = 1024;
  for (const controller of [alternate, prefix, cycle, { id: 'iid-fair', probabilityH: .5 }]) {
    const target = exactFinite({ L: 2, k: 2, controller });
    const reference = { coverage: target.metrics.coverage.value, abs_order: target.metrics.absOrder.value,
      order2: target.metrics.orderSquared.value, order4: target.metrics.orderFourth.value, deadlock: target.metrics.deadlockProbability.value,
      attempts: target.metrics.expectedTerminalAttempts.value, attempts_per_accepted: target.metrics.expectedAttemptsPerParticle.value };
    for (const engine of ['event', 'direct']) {
      const rows = Array.from({ length: n }, (_, i) => simulateFinite({ L: 2, k: 2, controller, seed: 72000001 + i, engine }));
      for (const metric of fields) {
        const stats = meanSd(rows.map(row => row[metric]));
        assert.ok(Math.abs(stats.mean - reference[metric]) <= 8 * stats.se + 1e-12, `${controller.id}/${engine}/${metric}`);
      }
      for (const row of rows) {
        assert.equal(row.attempts, row.particles + row.failures);
        assert.equal(row.attempted_h + row.attempted_v, row.attempts);
        assert.equal(row.failed_h + row.failed_v, row.failures);
        assert.equal(row.kinetic_kind, 'sampled-actual');
        assert.ok(Number.isSafeInteger(row.attempts));
      }
    }
  }
});

test('four-state failure episode agrees with independent stepwise hazard sampling', () => {
  const policy = compileController(cycle), counts = [1, 3], M = 7, n = 4096;
  const event = [], direct = [];
  for (let i = 0; i < n; i++) {
    const sampled = sampleFailureEpisode(policy, 0, counts, M, new RNG(73000001 + i));
    event.push({ attempts: sampled.failures[0] + sampled.failures[1] + 1, orientation: sampled.orientation });
    const rng = new RNG(74000001 + i); let state = 0, attempts = 0;
    while (true) { const o = cycle.outputs[state]; attempts++; if (rng.uniform() < counts[o] / M) { direct.push({ attempts, orientation: o }); break; } state = cycle.transitions[state][0]; }
  }
  for (const metric of ['attempts', 'orientation']) {
    const a = meanSd(event.map(row => row[metric])), b = meanSd(direct.map(row => row[metric]));
    assert.ok(Math.abs(a.mean - b.mean) <= 8 * Math.hypot(a.se, b.se), metric);
  }
});
