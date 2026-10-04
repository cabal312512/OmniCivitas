import { performance } from 'node:perf_hooks';
import { Lattice } from '../../src/lattice.mjs';
import { RNG } from '../../src/rng.mjs';

function probability(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be in [0,1]`);
}
function safeCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Virtual kinetic count exceeds the exact integer range; no terminal result recorded');
  return value;
}

// Number of failures before one Bernoulli success. No truncation or timeout.
export function geometricFailures(p, rng) {
  probability(p, 'geometric probability');
  if (p === 0) throw new RangeError('A zero-hazard waiting time is infinite');
  return p === 1 ? 0 : safeCount(Math.floor(Math.log(rng.uniform()) / Math.log1p(-p)));
}

// Published rejection algorithms, implemented from their mathematical formulae:
// Marsaglia--Tsang (2000) Gamma; Hoermann (1993) PTRS Poisson. No normal or
// deterministic approximation replaces a discrete waiting-time distribution.
function gammaInteger(shape, rng) {
  if (shape === 1) return -Math.log(rng.uniform());
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const z = Math.sqrt(-2 * Math.log(rng.uniform())) * Math.cos(2 * Math.PI * rng.uniform());
    const base = 1 + c * z;
    if (base <= 0) continue;
    const v = base ** 3, u = rng.uniform();
    if (u < 1 - 0.0331 * z ** 4 || Math.log(u) < z * z / 2 + d * (Math.log(v) + 1 - v)) return d * v;
  }
}
function logPoissonMass(k, mean) {
  if (k === 0) return -mean;
  if (k < 16) {
    let factorialLog = 0;
    for (let j = 2; j <= k; j++) factorialLog += Math.log(j);
    return k * Math.log(mean) - mean - factorialLog;
  }
  // Stable deviance near k=mean; avoids subtracting two O(mean log mean) terms.
  const x = (k - mean) / mean;
  let deviance;
  if (Math.abs(x) < 0.1) {
    let sum = 0, power = x * x;
    for (let n = 2; n <= 32; n++) {
      sum += (n % 2 ? -1 : 1) * power / (n * (n - 1));
      power *= x;
    }
    deviance = mean * sum;
  } else deviance = k * Math.log(k / mean) + mean - k;
  const inverse = 1 / k, square = inverse * inverse;
  const correction = inverse * (1 / 12 - square * (1 / 360 - square * (1 / 1260 - square / 1680)));
  return -deviance - Math.log(2 * Math.PI * k) / 2 - correction;
}
function poisson(mean, rng) {
  if (mean === 0) return 0;
  if (!Number.isFinite(mean) || mean > Number.MAX_SAFE_INTEGER / 8) throw new RangeError('Poisson mixture exceeds the supported exact integer range');
  if (mean < 10) {
    const limit = Math.exp(-mean);
    let product = 1, count = 0;
    do { product *= rng.uniform(); count++; } while (product > limit);
    return count - 1;
  }
  const b = 0.931 + 2.53 * Math.sqrt(mean), a = -0.059 + 0.02483 * b;
  const inverseAlpha = 1.1239 + 1.1328 / (b - 3.4), squeeze = 0.9277 - 3.6224 / (b - 2);
  for (;;) {
    const u = rng.uniform() - 0.5, v = rng.uniform(), us = 0.5 - Math.abs(u);
    const k = Math.floor((2 * a / us + b) * u + mean + 0.43);
    if (k < 0 || (us < 0.013 && v > us)) continue;
    if (us >= 0.07 && v <= squeeze) return safeCount(k);
    if (Math.log(v * inverseAlpha / (a / (us * us) + b)) <= logPoissonMass(k, mean)) return safeCount(k);
  }
}

/** Sum of r independent geometric(p) failure counts, using the exact
 * Gamma--Poisson representation for a large number of residence blocks.
 * This is a distributional identity, not a Gaussian approximation.
 */
export function negativeBinomialFailures(r, p, rng) {
  safeCount(r); probability(p, 'negative-binomial probability');
  if (r === 0 || p === 1) return 0;
  if (p === 0) throw new RangeError('An infinite negative-binomial waiting time cannot be sampled');
  if (r <= 16) {
    let total = 0;
    for (let j = 0; j < r; j++) total = safeCount(total + geometricFailures(p, rng));
    return total;
  }
  return poisson(gammaInteger(r, rng) * ((1 - p) / p), rng);
}

/** Q describes one failed trial followed by its orientation update. The
 * stable determinant avoids cancellation in det(I-Q) when beta is tiny.
 * Mean and absorption probabilities are fixed-lattice analytical quantities.
 */
export function failureKernel(counts, M, beta, state = 0) {
  probability(beta, 'beta');
  if (![0, 1].includes(state) || !Number.isSafeInteger(M) || M < 1 || counts.length !== 2 || counts.some(n => !Number.isSafeInteger(n) || n < 0 || n > M)) throw new RangeError('Invalid fixed-lattice kernel');
  const p = counts.map(n => n / M), q = p.map(value => 1 - value);
  const Q = [[q[0] * (1 - beta), q[0] * beta], [q[1] * beta, q[1] * (1 - beta)]];
  if (p[0] + p[1] === 0 || (beta === 0 && p[state] === 0)) return { Q, p, live: false, next_h: null, next_v: null, expected_attempts: Infinity };
  if (beta === 0) return { Q, p, live: true, next_h: Number(state === 0), next_v: Number(state === 1), expected_attempts: 1 / p[state] };
  const h = [p[0] + q[0] * beta, p[1] + q[1] * beta];
  const determinant = p[0] * p[1] + beta * (p[0] * q[1] + p[1] * q[0]);
  const next_h = p[0] * (state === 0 ? h[1] : q[1] * beta) / determinant;
  const next_v = p[1] * (state === 1 ? h[0] : q[0] * beta) / determinant;
  const expected_attempts = (h[1 - state] + q[state] * beta) / determinant;
  return { Q, p, h, determinant, live: true, next_h, next_v, expected_attempts };
}

/** Exact event draw on a fixed lattice. A residence exits either through a
 * success or through a failed flip. Two failed exits constitute a cycle.
 * Conditional residence lengths are independent of the exit types.
 */
export function nextAcceptedEvent(state, counts, M, beta, rng) {
  const p0 = counts[state] / M, p1 = counts[1 - state] / M;
  if (counts[0] + counts[1] === 0 || (beta === 0 && counts[state] === 0)) return { terminal: true, state, failures: [0, 0], failure_flips: 0 };
  if (beta === 0) {
    const failures = [0, 0];
    failures[state] = geometricFailures(p0, rng);
    return { terminal: false, state, o: state, failures, failure_flips: 0 };
  }
  const h0 = p0 + (1 - p0) * beta, h1 = p1 + (1 - p1) * beta;
  const s0 = p0 / h0, s1 = p1 / h1, c0 = (1 - p0) * beta / h0;
  // s0+c0*s1 = 1-c0*c1; the sum is stable for a tiny absorption hazard.
  const mass = Math.min(1, s0 + c0 * s1);
  const cycles = geometricFailures(mass, rng);
  const second = rng.uniform() * mass >= s0;
  const residence0 = cycles + 1, residence1 = cycles + Number(second);
  const failures = [0, 0];
  failures[state] = safeCount(negativeBinomialFailures(residence0, h0, rng) + cycles + Number(second));
  failures[1 - state] = safeCount(negativeBinomialFailures(residence1, h1, rng) + cycles);
  const o = state ^ Number(second);
  return { terminal: false, state: o, o, failures, failure_flips: safeCount(2 * cycles + Number(second)) };
}

function runRecorder() {
  const histogram = new Map();
  let previous = null, length = 0, maximum = 0, switches = 0, count = 0;
  const finish = () => {
    if (!length) return;
    histogram.set(length, (histogram.get(length) ?? 0) + 1);
    maximum = Math.max(maximum, length); count++;
  };
  return {
    record(o) {
      if (previous === o) length++;
      else { finish(); length = 1; if (previous !== null) switches++; }
      previous = o;
    },
    result() { finish(); return { histogram: Object.fromEntries([...histogram].sort((a, b) => a[0] - b[0])), maximum, switches, count }; }
  };
}

export function simulateStochastic({ L, k, alpha, beta, seed, boundary = 'periodic', engine = 'event', trace = false, snapshot = false, validate = false, maxAttempts = 100000000 } = {}) {
  const began = performance.now();
  probability(alpha, 'alpha'); probability(beta, 'beta');
  if (!['direct', 'event'].includes(engine)) throw new RangeError('Unknown engine');
  if (trace && engine !== 'direct') throw new RangeError('Attempt-level traces require the direct engine');
  if (!Number.isInteger(L) || L < 2 || !Number.isSafeInteger(L * L) || L * L > 0x7fffffff) throw new RangeError('Lattice anchors must fit signed Int32 indices');
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new RangeError('Invalid direct validation bound');
  const rng = new RNG(seed), lattice = new Lattice(L, k, boundary);
  const initial = rng.integer(2), attempted = [0, 0], failed = [0, 0], trajectory = [];
  const acceptedRuns = runRecorder(), trialRuns = engine === 'direct' ? runRecorder() : null;
  let state = initial, attempts = 0, failures = 0, failureFlips = 0, successFlips = 0, lastSuccessFlip = 0, conditionalMeanSum = 0;
  try {
    while (lattice.counts[0] + lattice.counts[1] > 0 && (beta > 0 || lattice.counts[state] > 0)) {
      let o = state, success, event;
      if (engine === 'direct') {
        if (attempts >= maxAttempts) throw new Error('Direct validation reached its safety bound; no terminal result recorded');
        const anchor = lattice.uniformAnchor(o, rng);
        success = lattice.canPlace(o, anchor);
        attempts++; attempted[o]++; trialRuns.record(o);
        if (success) lattice.place(o, anchor);
        else { failures++; failed[o]++; }
      } else {
        const kernel = failureKernel(lattice.counts, lattice.M, beta, state);
        conditionalMeanSum += kernel.expected_attempts;
        event = nextAcceptedEvent(state, lattice.counts, lattice.M, beta, rng);
        if (event.terminal) throw new Error('Live state incorrectly diagnosed as terminal');
        const skipped = safeCount(event.failures[0] + event.failures[1]);
        for (let direction = 0; direction < 2; direction++) {
          failed[direction] = safeCount(failed[direction] + event.failures[direction]);
          attempted[direction] = safeCount(attempted[direction] + event.failures[direction]);
        }
        failures = safeCount(failures + skipped); attempts = safeCount(attempts + skipped + 1);
        failureFlips = safeCount(failureFlips + event.failure_flips);
        o = event.o; state = o; attempted[o]++;
        lattice.place(o, lattice.legal[o][rng.integer(lattice.counts[o])]);
        success = true;
      }
      if (success) acceptedRuns.record(o);
      // This controller has exactly one bit and sees only the binary outcome.
      // Geometry enters the event sampler, never the transition probability.
      const chance = success ? alpha : beta;
      const flip = chance === 1 || (chance > 0 && rng.uniform() < chance);
      if (flip) { state ^= 1; if (success) successFlips++; else failureFlips++; }
      lastSuccessFlip = success ? Number(flip) : 0;
      if (trace) trajectory.push({ attempt: attempts, orientation: o, success: Number(success), next_orientation: state, coverage: k * (lattice.particles[0] + lattice.particles[1]) / lattice.N });
      if (validate && (success || engine === 'event')) lattice.validate();
    }
    const horizontal = lattice.particles[0], vertical = lattice.particles[1], particles = horizontal + vertical;
    const order = (horizontal - vertical) / particles, accepted = acceptedRuns.result(), trial = trialRuns?.result();
    // The final success update has no subsequent attempted rod: remove it
    // from trial adjacency statistics, but retain it in controller_flips.
    const trialSwitches = safeCount(failureFlips + successFlips - lastSuccessFlip);
    if (trial && trial.switches !== trialSwitches) throw new Error('Direct switch accounting mismatch');
    const result = {
      L, k, alpha, beta, seed, boundary, engine, initial_mode: 'fair', initial_orientation: initial, final_orientation: state,
      particles, NH: horizontal, NV: vertical, horizontal, vertical,
      coverage: particles * k / lattice.N, order, abs_order: Math.abs(order),
      deadlock: Number(lattice.counts[0] + lattice.counts[1] > 0),
      geometric_jam: Number(lattice.counts[0] + lattice.counts[1] === 0), legal_h: lattice.counts[0], legal_v: lattice.counts[1],
      attempts, failures, attempted_h: attempted[0], attempted_v: attempted[1], failed_h: failed[0], failed_v: failed[1],
      accepted_switches: accepted.switches, trial_switches: trialSwitches,
      accepted_pairs: particles - 1,
      actual_attempts: attempts, actual_failures: failures, actual_switches: trialSwitches, kinetic_kind: 'sampled-actual',
      success_flips: successFlips, failure_flips: failureFlips, controller_flips: safeCount(successFlips + failureFlips),
      attempts_per_accepted: attempts / particles, failures_per_accepted: failures / particles,
      accepted_run_count: accepted.count, accepted_mean_run_length: particles / accepted.count, accepted_max_run_length: accepted.maximum,
      accepted_switch_rate: particles > 1 ? accepted.switches / (particles - 1) : null,
      accepted_lag1_correlation: particles > 1 ? 1 - 2 * accepted.switches / (particles - 1) : null,
      accepted_lag1: particles > 1 ? 1 - 2 * accepted.switches / (particles - 1) : null,
      trial_run_count: trialSwitches + 1, trial_mean_run_length: attempts / (trialSwitches + 1),
      trial_max_run_length: trial?.maximum ?? null,
      trial_switch_rate: attempts > 1 ? trialSwitches / (attempts - 1) : null,
      trial_lag1_correlation: attempts > 1 ? 1 - 2 * trialSwitches / (attempts - 1) : null,
      accepted_run_histogram: accepted.histogram, trial_run_histogram: trial?.histogram ?? null,
      kinetic_sampling: engine === 'event' ? 'exact-residence-cycle-negative-binomial' : 'direct-trials',
      conditional_mean_attempts_sum: engine === 'event' ? conditionalMeanSum : null,
      elapsed_ms: performance.now() - began
    };
    if (trace) result.trajectory = trajectory;
    if (snapshot) result.lattice = { L, k, boundary, occupancy: Array.from(lattice.occupancy), finalState: state };
    return result;
  } finally {
    // No lattice buffers are retained in a registry, closure or result. The
    // optional snapshot is a copy; each simulation releases its typed arrays.
    lattice.occupancy = null; lattice.legal = null; lattice.index = null;
  }
}
