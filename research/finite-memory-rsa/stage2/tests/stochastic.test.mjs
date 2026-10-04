import test from 'node:test';
import assert from 'node:assert/strict';
import { Lattice } from '../../src/lattice.mjs';
import { RNG } from '../../src/rng.mjs';
import { failureKernel, nextAcceptedEvent, negativeBinomialFailures, simulateStochastic } from '../src/stochastic.mjs';

function moments(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return { mean, variance, se: Math.sqrt(variance / values.length) };
}
function compareSamples(first, second, name, standardErrors = 7) {
  const a = moments(first), b = moments(second);
  assert.ok(Math.abs(a.mean - b.mean) <= standardErrors * Math.sqrt(a.se ** 2 + b.se ** 2) + 1e-12, `${name}: ${a.mean} versus ${b.mean}`);
}
function directFixedEvent(state, counts, M, beta, rng) {
  const failures = [0, 0];
  let switches = 0;
  for (;;) {
    if (rng.uniform() < counts[state] / M) return { o: state, failures, failure_flips: switches };
    failures[state]++;
    if (rng.uniform() < beta) { state ^= 1; switches++; }
  }
}
// Independent Gaussian elimination of (I-Q)x=b, not the simulator's closed form.
function solve2(Q, rhs) {
  const a = [[1 - Q[0][0], -Q[0][1], rhs[0]], [-Q[1][0], 1 - Q[1][1], rhs[1]]];
  const factor = a[1][0] / a[0][0];
  for (let j = 0; j < 3; j++) a[1][j] -= factor * a[0][j];
  const second = a[1][2] / a[1][1];
  return [(a[0][2] - a[0][1] * second) / a[0][0], second];
}

test('explicit seed and probabilities are validated; event never invents an attempt trace', () => {
  const base = { L: 4, k: 2, alpha: 0.2, beta: 0.8, seed: 4 };
  assert.throws(() => simulateStochastic({ ...base, seed: undefined }), /Seed/);
  assert.throws(() => simulateStochastic({ ...base, alpha: -0.01 }), /alpha/);
  assert.throws(() => simulateStochastic({ ...base, beta: NaN }), /beta/);
  assert.throws(() => simulateStochastic({ ...base, trace: true }), /direct/);
  assert.throws(() => simulateStochastic({ ...base, engine: 'direct', maxAttempts: 1 }), /no terminal result/);
  assert.equal(simulateStochastic({ ...base, maxAttempts: 1 }).kinetic_kind, 'sampled-actual');
});

test('two-state absorption probabilities and mean waiting agree with independent linear algebra', () => {
  for (const counts of [[2, 7], [0, 6], [10, 3], [1, 1]]) {
    for (const beta of [0.01, 0.3, 0.5, 1]) {
      const p = counts.map(value => value / 10);
      const Q = p.map((value, state) => [0, 1].map(next => (1 - value) * (state === next ? 1 - beta : beta)));
      const absorption = solve2(Q, [p[0], 0]), waiting = solve2(Q, [1, 1]);
      for (const state of [0, 1]) {
        const result = failureKernel(counts, 10, beta, state);
        assert.ok(Math.abs(result.next_h - absorption[state]) < 1e-11);
        assert.ok(Math.abs(result.expected_attempts - waiting[state]) < 1e-9);
        assert.ok(Math.abs(result.next_h + result.next_v - 1) < 1e-12);
      }
    }
  }
});

test('cycle event sampler preserves joint orientation, failures and switches against direct trials', () => {
  for (const [counts, beta, start] of [[[2, 7], 0.3, 0], [[0, 4], 0.4, 0], [[2, 1], 1, 1], [[8, 6], 0.7, 1]]) {
    const directRng = new RNG(700 + start), eventRng = new RNG(900 + start), direct = [], event = [];
    for (let j = 0; j < 20000; j++) {
      direct.push(directFixedEvent(start, counts, 10, beta, directRng));
      event.push(nextAcceptedEvent(start, counts, 10, beta, eventRng));
    }
    const measures = {
      orientation: r => r.o,
      failure_h: r => r.failures[0], failure_v: r => r.failures[1],
      switches: r => r.failure_flips,
      joint_hv: r => r.failures[0] * r.failures[1],
      joint_switch_failure: r => r.failure_flips * (r.failures[0] + r.failures[1])
    };
    for (const [name, measure] of Object.entries(measures)) compareSamples(direct.map(measure), event.map(measure), name);
  }
});

test('large-count NB aggregation retains its exact discrete mean, variance and CDF', () => {
  for (const [r, p] of [[17, 0.8], [12000, 0.35], [10000, 0.999], [200000, 0.95]]) {
    const rng = new RNG(1110 + r), values = [];
    for (let j = 0; j < 30000; j++) values.push(negativeBinomialFailures(r, p, rng));
    assert.ok(values.every(Number.isSafeInteger));
    const measured = moments(values), expectedMean = r * (1 - p) / p, expectedVariance = r * (1 - p) / (p * p);
    assert.ok(Math.abs(measured.mean - expectedMean) < 7 * Math.sqrt(expectedVariance / values.length), `${r},${p} mean`);
    // Broad seven-sigma sampling bound for the sample variance, with the NB
    // fourth central moment (3v²+v[6/p²-6/p+1]).
    const fourth = 3 * expectedVariance ** 2 + expectedVariance * (6 / (p * p) - 6 / p + 1);
    assert.ok(Math.abs(measured.variance - expectedVariance) < 7 * Math.sqrt((fourth - expectedVariance ** 2) / values.length), `${r},${p} variance`);
    if (r === 17) {
      let mass = p ** r, cdf = mass;
      for (let n = 1; n <= 3; n++) { mass *= (r + n - 1) / n * (1 - p); cdf += mass; }
      const measuredCdf = values.filter(n => n <= 3).length / values.length;
      assert.ok(Math.abs(measuredCdf - cdf) < 7 * Math.sqrt(cdf * (1 - cdf) / values.length));
    }
  }
});

test('tiny positive beta recovers the other orientation without a failure timeout', () => {
  const beta = 1e-6, kernel = failureKernel([0, 5], 10, beta, 0), rng = new RNG(991), values = [];
  assert.equal(kernel.live, true);
  assert.equal(kernel.next_v, 1);
  assert.ok(Math.abs(kernel.expected_attempts - (1 / beta + 3)) < 1e-6);
  for (let j = 0; j < 10000; j++) {
    const event = nextAcceptedEvent(0, [0, 5], 10, beta, rng);
    assert.equal(event.terminal, false); assert.equal(event.o, 1);
    values.push(event.failures[0] + event.failures[1] + 1);
  }
  const measured = moments(values);
  assert.ok(Math.abs(measured.mean - kernel.expected_attempts) < 7 * measured.se);
  assert.ok(Math.max(...values) > 1e6);
  assert.equal(failureKernel([0, 5], 10, 0, 0).live, false);
  assert.equal(nextAcceptedEvent(0, [0, 5], 10, 0, new RNG(5)).terminal, true);
});

test('dense legal-anchor update is consistent with occupancy at periodic and open boundaries', () => {
  for (const boundary of ['periodic', 'open']) for (const k of [1, 2, 4, 8]) {
    const lattice = new Lattice(8, k, boundary), rng = new RNG(710 + k);
    while (lattice.counts[0] + lattice.counts[1]) {
      let o = rng.integer(2);
      if (lattice.counts[o] === 0) o ^= 1;
      lattice.place(o, lattice.legal[o][rng.integer(lattice.counts[o])]);
      assert.equal(lattice.validate(), true);
    }
  }
});

test('the five special points implement the requested outcome rules and honest terminal states', () => {
  for (const engine of ['event', 'direct']) for (const [alpha, beta] of [[0, 1], [1, 0], [1, 1], [0.5, 0.5], [0, 0]]) {
    const r = simulateStochastic({ L: 8, k: 3, alpha, beta, seed: 12, engine, trace: engine === 'direct', validate: true });
    assert.equal(r.initial_mode, 'fair');
    assert.equal(r.NH + r.NV, r.particles);
    assert.equal(r.attempts, r.failures + r.particles);
    assert.equal(r.failed_h + r.failed_v, r.failures);
    assert.equal(r.attempted_h + r.attempted_v, r.attempts);
    assert.equal(r.accepted_pairs, r.particles - 1);
    assert.equal(r.accepted_run_count, r.accepted_switches + 1);
    assert.equal(Object.entries(r.accepted_run_histogram).reduce((n, [length, number]) => n + Number(length) * number, 0), r.particles);
    if (beta > 0) { assert.equal(r.deadlock, 0); assert.equal(r.legal_h + r.legal_v, 0); }
    if (alpha === 0) assert.equal(r.success_flips, 0);
    if (beta === 0) assert.equal(r.failure_flips, 0);
    if (alpha === 1) assert.equal(r.success_flips, r.particles);
    if (beta === 1) assert.equal(r.failure_flips, r.failures);
    if (alpha === 1 && beta === 1) assert.equal(r.trial_switches, r.attempts - 1);
    if (alpha === 1 && beta === 0) assert.equal(r.accepted_switches, r.particles - 1);
    if (alpha === 0 && beta === 0) { assert.equal(r.abs_order, 1); assert.equal(r.trial_switches, 0); }
    if (engine === 'event') { assert.equal(r.trial_run_histogram, null); assert.equal(r.trial_max_run_length, null); }
    else {
      const switches = r.trajectory.slice(1).filter((trial, i) => trial.orientation !== r.trajectory[i].orientation).length;
      assert.equal(r.trial_switches, switches);
      for (const trial of r.trajectory) {
        const mustFlip = trial.success ? alpha : beta;
        if (mustFlip === 0 || mustFlip === 1) assert.equal(Number(trial.next_orientation !== trial.orientation), mustFlip);
      }
    }
  }
});

test('beta zero terminal deadlock retains genuinely legal placements in the other direction', () => {
  for (const engine of ['event', 'direct']) {
    const r = simulateStochastic({ L: 8, k: 3, alpha: 0, beta: 0, seed: 12, engine, snapshot: true });
    assert.equal(r.deadlock, 1); assert.equal(r.geometric_jam, 0);
    assert.equal([r.legal_h, r.legal_v][r.final_orientation], 0);
    const occupancy = r.lattice.occupancy, o = 1 - r.final_orientation;
    let counted = 0;
    for (let anchor = 0; anchor < 64; anchor++) {
      const x = anchor % 8, y = Math.floor(anchor / 8);
      let allowed = true;
      for (let j = 0; j < 3; j++) if (occupancy[o === 0 ? y * 8 + (x + j) % 8 : ((y + j) % 8) * 8 + x]) allowed = false;
      counted += Number(allowed);
    }
    assert.ok(counted > 0); assert.equal(counted, [r.legal_h, r.legal_v][o]);
  }
});

test('monomers fill the whole lattice at every special point without fictitious deadlock', () => {
  for (const engine of ['event', 'direct']) for (const [alpha, beta] of [[0, 1], [1, 0], [1, 1], [0.5, 0.5], [0, 0]]) {
    const r = simulateStochastic({ L: 5, k: 1, alpha, beta, seed: 73, engine, validate: true });
    assert.equal(r.coverage, 1); assert.equal(r.particles, 25); assert.equal(r.deadlock, 0);
  }
});

test('event and direct terminal ensembles agree; seed equality does not imply trajectory equality', () => {
  for (const [alpha, beta] of [[0, 1], [1, 0], [0.5, 0.5], [0.1, 0.8], [0.3, 0.05]]) {
    const direct = [], event = [];
    for (let seed = 10000; seed < 11000; seed++) {
      const options = { L: 6, k: 2, alpha, beta, seed };
      direct.push(simulateStochastic({ ...options, engine: 'direct' }));
      event.push(simulateStochastic({ ...options, engine: 'event' }));
    }
    for (const name of ['coverage', 'abs_order', 'deadlock', 'attempts', 'failures', 'trial_switches', 'accepted_switches', 'failed_h', 'failed_v']) compareSamples(direct.map(r => r[name]), event.map(r => r[name]), `${alpha},${beta} ${name}`);
  }
});

test('repeated event runs reproduce all scientific fields and return no live lattice buffers', () => {
  const options = { L: 12, k: 4, alpha: 0.03, beta: 0.95, seed: 90371 };
  const first = simulateStochastic(options), second = simulateStochastic(options);
  delete first.elapsed_ms; delete second.elapsed_ms;
  assert.deepEqual(first, second);
  assert.ok(!Object.values(first).some(value => ArrayBuffer.isView(value)));
  assert.equal(first.lattice, undefined);
});
