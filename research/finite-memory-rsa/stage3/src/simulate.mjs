import { performance } from 'node:perf_hooks';
import { Lattice } from '../../src/lattice.mjs';
import { RNG } from '../../src/rng.mjs';
import { simulateStochastic } from '../../stage2/src/stochastic.mjs';

const compiled = new WeakMap();
const safe = value => { if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Actual kinetic count exceeds the exact integer range; no terminal result recorded'); return value; };
const exchangeMask = (mask, flip) => flip ? ((mask & 1) << 1) | ((mask & 2) >> 1) : mask;
export const controllerName = controller => String(controller.classId ?? controller.key ?? controller.id ?? 'finite-controller');

/** Validate once and precompile the deterministic failure functional graph. */
export function compileController(controller) {
  if (!controller || typeof controller !== 'object') throw new TypeError('A deterministic controller object is required');
  if (compiled.has(controller)) return compiled.get(controller);
  const outputs = Array.from(controller.outputs ?? []), transitions = Array.from(controller.transitions ?? [], row => Array.from(row));
  const n = outputs.length;
  if (n < 1 || n > 4 || transitions.length !== n || (controller.initial ?? 0) !== 0
    || outputs.some(o => o !== 0 && o !== 1) || transitions.some(row => row.length !== 2
      || row.some(q => !Number.isInteger(q) || q < 0 || q >= n))) throw new RangeError('Require 1..4 states, rooted initial=0, H/V outputs and [failure,success] targets');
  const paths = Array.from({ length: n }, (_, initial) => {
    const states = [], seen = new Map(); let q = initial;
    while (!seen.has(q)) { seen.set(q, states.length); states.push(q); q = transitions[q][0]; }
    const start = seen.get(q), prefix = states.slice(0, start), cycle = states.slice(start);
    let mask = cycle.reduce((value, state) => value | (1 << outputs[state]), 0);
    const suffixMasks = Array(start + 1); suffixMasks[start] = mask;
    for (let i = start - 1; i >= 0; i--) { mask |= 1 << outputs[prefix[i]]; suffixMasks[i] = mask; }
    return { states, prefix, cycle, cycleMask: suffixMasks[start], suffixMasks, supportMask: suffixMasks[0] };
  });
  const result = { outputs, transitions, initial: 0, states: n, paths };
  compiled.set(controller, result); return result;
}

class Runs {
  constructor() { this.total = 0; this.switches = 0; this.last = null; this.length = 0; this.maximum = 0; }
  add(orientation, count = 1) {
    if (!count) return;
    this.total += count;
    if (this.last === orientation) this.length += count;
    else { if (this.last !== null) this.switches++; this.last = orientation; this.length = count; }
    this.maximum = Math.max(this.maximum, this.length);
  }
  repeat(pattern, times) {
    if (!times) return;
    if (pattern.every(o => o === pattern[0])) { this.add(pattern[0], pattern.length * times); return; }
    for (const o of pattern) this.add(o);
    if (times === 1) return;
    let internalSwitches = 0, leading = 1, trailing = 1, current = 1, maximum = 1;
    for (let i = 1; i < pattern.length; i++) {
      if (pattern[i] !== pattern[i - 1]) { internalSwitches++; current = 1; } else current++;
      maximum = Math.max(maximum, current);
    }
    while (leading < pattern.length && pattern[leading] === pattern[0]) leading++;
    while (trailing < pattern.length && pattern[pattern.length - 1 - trailing] === pattern.at(-1)) trailing++;
    const boundarySwitch = Number(pattern[0] !== pattern.at(-1));
    this.total += (times - 1) * pattern.length;
    this.switches += (times - 1) * (internalSwitches + boundarySwitch);
    this.length = trailing; this.last = pattern.at(-1);
    this.maximum = Math.max(this.maximum, maximum, boundarySwitch ? 0 : leading + trailing);
  }
}

/** Exact discrete episode law on a frozen lattice, with sampled actual failures. */
export function sampleFailureEpisode(policy, state, counts, M, rng, flip = 0, trial = null) {
  const path = policy.paths[state], available = Number(counts[0] > 0) | (Number(counts[1] > 0) << 1);
  const failures = [0, 0]; let stateChanges = 0;
  const fail = q => { const o = policy.outputs[q] ^ flip; failures[o]++; stateChanges += Number(policy.transitions[q][0] !== q); trial?.add(o); };
  for (let i = 0; i < path.prefix.length; i++) {
    const q = path.prefix[i];
    if (!(exchangeMask(path.suffixMasks[i], flip) & available)) return { terminal: true, state: q, failures, stateChanges };
    const o = policy.outputs[q] ^ flip, hazard = counts[o] / M;
    if (hazard > 0 && (hazard === 1 || rng.uniform() < hazard)) return { terminal: false, state: q, orientation: o, failures, stateChanges };
    fail(q);
  }
  if (!(exchangeMask(path.cycleMask, flip) & available))
    return { terminal: true, state: path.cycle[0], failures, stateChanges };
  let survival = 1, mass = 0;
  const weights = Array(path.cycle.length), pattern = Array(path.cycle.length);
  for (let i = 0; i < path.cycle.length; i++) {
    const o = policy.outputs[path.cycle[i]] ^ flip, p = counts[o] / M;
    pattern[i] = o; weights[i] = survival * p; mass += weights[i]; survival *= 1 - p;
  }
  mass = Math.min(1, mass);
  if (!(mass > 0)) throw new Error('Positive legal availability produced zero episode success mass');
  const rounds = survival === 0 || mass === 1 ? 0 : safe(Math.floor(Math.log(rng.uniform()) / Math.log1p(-mass)));
  if (rounds) {
    for (const q of path.cycle) { failures[policy.outputs[q] ^ flip] += rounds; stateChanges += rounds * Number(policy.transitions[q][0] !== q); }
    trial?.repeat(pattern, rounds);
  }
  let choice = rng.uniform() * mass;
  let lastPositive = weights.length - 1;
  while (weights[lastPositive] === 0) lastPositive--;
  for (let i = 0; i < path.cycle.length; i++) {
    const q = path.cycle[i];
    if (weights[i] > 0 && (choice < weights[i] || i === lastPositive))
      return { terminal: false, state: q, orientation: policy.outputs[q] ^ flip, failures, stateChanges };
    choice -= weights[i]; fail(q);
  }
  throw new Error('Episode categorical sampling failed');
}

/** Uniform-anchor RSA with an outcome-only rooted deterministic Moore controller. */
export function simulateFinite({ L, k, controller, boundary = 'periodic', seed, engine = 'event',
  trace = false, snapshot = false, validate = false, maxAttempts = null } = {}) {
  if (!['event', 'direct'].includes(engine)) throw new RangeError('Unknown engine');
  if (trace && engine !== 'direct') throw new Error('Attempt trajectories require the direct engine');
  if (maxAttempts !== null && (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1)) throw new RangeError('Invalid diagnostic attempt bound');
  if (maxAttempts !== null && engine !== 'direct') throw new Error('The diagnostic attempt bound is supported only by the direct engine');
  if (controller?.probabilityH !== undefined) {
    if (controller.probabilityH !== .5) throw new RangeError('Only the zero-memory IID fair reference is supported');
    const result = simulateStochastic({ L, k, alpha: .5, beta: .5, boundary, seed, engine, trace, snapshot, validate,
      ...(maxAttempts === null ? {} : { maxAttempts }) });
    return { ...result, controller: controllerName(controller), order2: result.order ** 2, order4: result.order ** 4,
      memory_states: 1, memory_bits: 0, controller_final_state: null, final_state: null, orientation_exchange: null };
  }
  const policy = compileController(controller), began = performance.now(), rng = new RNG(seed), lattice = new Lattice(L, k, boundary);
  const flip = Number(rng.uniform() >= .5), attempted = [0, 0], failed = [0, 0], accepted = new Runs(), trial = new Runs(), trajectory = [];
  let q = 0, attempts = 0, failures = 0, successStateChanges = 0, failureStateChanges = 0;
  try {
    while (lattice.counts[0] + lattice.counts[1] > 0) {
      const available = Number(lattice.counts[0] > 0) | (Number(lattice.counts[1] > 0) << 1);
      if (!(exchangeMask(policy.paths[q].supportMask, flip) & available)) break;
      if (engine === 'direct') {
        if (maxAttempts !== null && attempts >= maxAttempts) throw new Error('Diagnostic attempt bound reached; no terminal result recorded');
        const state = q, o = policy.outputs[q] ^ flip, anchor = lattice.uniformAnchor(o, rng), success = lattice.canPlace(o, anchor);
        attempts++; attempted[o]++; trial.add(o);
        if (success) { lattice.place(o, anchor); accepted.add(o); successStateChanges += Number(policy.transitions[q][1] !== q); }
        else { failures++; failed[o]++; failureStateChanges += Number(policy.transitions[q][0] !== q); }
        q = policy.transitions[q][Number(success)];
        if (trace) trajectory.push({ attempt: attempts, state, orientation: o, success: Number(success),
          coverage: k * (lattice.particles[0] + lattice.particles[1]) / lattice.N });
      } else {
        const event = sampleFailureEpisode(policy, q, lattice.counts, lattice.M, rng, flip, trial);
        for (let o = 0; o < 2; o++) { attempted[o] += event.failures[o]; failed[o] += event.failures[o]; }
        const skipped = event.failures[0] + event.failures[1]; failures += skipped; attempts += skipped;
        failureStateChanges += event.stateChanges;
        if (event.terminal) { q = event.state; break; }
        const o = event.orientation; attempts++; attempted[o]++; trial.add(o); accepted.add(o);
        lattice.place(o, lattice.legal[o][rng.integer(lattice.counts[o])]);
        successStateChanges += Number(policy.transitions[event.state][1] !== event.state);
        q = policy.transitions[event.state][1];
      }
      safe(attempts); safe(failures);
      if (validate) lattice.validate();
    }
    safe(attempts); safe(failures);
    const horizontal = lattice.particles[0], vertical = lattice.particles[1], particles = horizontal + vertical;
    const order = particles ? (horizontal - vertical) / particles : 0, pairs = Math.max(0, particles - 1);
    const result = { controller: controllerName(controller), L, k, boundary, seed, engine, initial_mode: 'fair', initialization: 'global-HV-exchange',
      initial_orientation: policy.outputs[0] ^ flip, orientation_exchange: flip, memory_states: policy.states,
      memory_bits: Math.ceil(Math.log2(policy.states)), final_state: q, controller_final_state: q,
      particles, horizontal, vertical, coverage: particles * k / lattice.N, order, abs_order: Math.abs(order), order2: order * order, order4: order ** 4,
      deadlock: Number(lattice.counts[0] + lattice.counts[1] > 0), geometric_jam: Number(lattice.counts[0] + lattice.counts[1] === 0),
      legal_h: lattice.counts[0], legal_v: lattice.counts[1], attempts, failures, actual_attempts: attempts, actual_failures: failures,
      attempted_h: attempted[0], attempted_v: attempted[1], failed_h: failed[0], failed_v: failed[1], kinetic_kind: 'sampled-actual',
      attempts_per_accepted: particles ? attempts / particles : null, failures_per_accepted: particles ? failures / particles : null,
      accepted_pairs: pairs, accepted_switches: accepted.switches, accepted_switch_fraction: pairs ? accepted.switches / pairs : null,
      accepted_lag1: pairs ? 1 - 2 * accepted.switches / pairs : null, accepted_run_count: particles ? accepted.switches + 1 : 0,
      accepted_mean_run_length: particles ? particles / (accepted.switches + 1) : null, accepted_max_run_length: accepted.maximum,
      actual_switches: trial.switches, trial_switches: trial.switches, trial_switch_fraction: attempts > 1 ? trial.switches / (attempts - 1) : null,
      trial_run_count: attempts ? trial.switches + 1 : 0, trial_mean_run_length: attempts ? attempts / (trial.switches + 1) : null,
      trial_max_run_length: trial.maximum, success_state_changes: successStateChanges, failure_state_changes: failureStateChanges,
      controller_state_changes: successStateChanges + failureStateChanges, elapsed_ms: performance.now() - began };
    if (trial.total !== attempts || accepted.total !== particles || failures + particles !== attempts)
      throw new Error('Actual episode/run bookkeeping inconsistent');
    if (trace) result.trajectory = trajectory;
    if (snapshot) result.lattice = { L, k, boundary, occupancy: Array.from(lattice.occupancy), finalState: q };
    return result;
  } finally {
    lattice.occupancy = null; lattice.legal = null; lattice.index = null;
  }
}
