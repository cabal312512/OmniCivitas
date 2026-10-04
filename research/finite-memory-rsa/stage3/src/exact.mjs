import { Fraction, enumeratePlacements } from '../../src/exact.mjs';
import { compileController, controllerName } from './simulate.mjs';

const ZERO = new Fraction(), ONE = new Fraction(1n), HALF = new Fraction(1n, 2n);
const addMass = (map, key, value) => { if (!value.zero) map.set(key, (map.get(key) ?? ZERO).add(value)); };
const sum = values => values.reduce((total, value) => total.add(value), ZERO);
const popcount = mask => { let count = 0; while (mask) { mask &= mask - 1; count++; } return count; };

/** General 1..4-state exact terminal law and finite pre-termination attempt mean. */
export function exactFinite({ L, k, controller, boundary = 'periodic' } = {}) {
  const placements = enumeratePlacements(L, k, boundary), M = placements[0].length;
  const iid = controller?.probabilityH !== undefined;
  if (iid && controller.probabilityH !== .5) throw new RangeError('Only the IID fair reference is supported');
  const policy = iid ? null : compileController(controller), memo = new Map();
  let failureBlocks = 0, deadCycleBlocks = 0;
  const solve = (mask, initial, flip) => {
    const key = `${mask}:${initial}:${flip}`;
    if (memo.has(key)) return memo.get(key);
    const legal = placements.map(row => row.filter(candidate => !(candidate & mask)));
    const law = new Map(), attemptMass = new Map(), successors = []; let attempts = ZERO;
    if (legal[0].length + legal[1].length === 0) addMass(law, `${mask}:0:0:geometric:${initial}`, ONE);
    else if (iid) {
      const available = legal[0].length + legal[1].length;
      const mass = new Fraction(1n, BigInt(available));
      attempts = new Fraction(BigInt(2 * M), BigInt(available));
      for (let o = 0; o < 2; o++) for (const candidate of legal[o]) successors.push({ candidate, orientation: o, next: 0, mass, timeMass: mass.mul(attempts) });
    } else {
      failureBlocks++;
      const path = policy.paths[initial];
      const available = Number(legal[0].length > 0) | (Number(legal[1].length > 0) << 1);
      const actionMask = value => flip ? ((value & 1) << 1) | ((value & 2) >> 1) : value;
      let survival = ONE, recognized = false;
      for (let i = 0; i < path.prefix.length; i++) {
        const q = path.prefix[i], orientation = policy.outputs[q] ^ flip;
        if (!(actionMask(path.suffixMasks[i]) & available)) {
          const terminal = `${mask}:0:0:deadlock:${q}`;
          addMass(law, terminal, survival); addMass(attemptMass, terminal, survival.mul(new Fraction(BigInt(i))));
          deadCycleBlocks++; recognized = true; break;
        }
        attempts = attempts.add(survival);
        const perAnchor = survival.div(new Fraction(BigInt(M)));
        for (const candidate of legal[orientation]) successors.push({ candidate, orientation, next: policy.transitions[q][1], mass: perAnchor,
          timeMass: perAnchor.mul(new Fraction(BigInt(i + 1))) });
        survival = survival.mul(new Fraction(BigInt(M - legal[orientation].length), BigInt(M)));
      }
      if (!recognized) {
        if (!(actionMask(path.cycleMask) & available)) {
          const terminal = `${mask}:0:0:deadlock:${path.cycle[0]}`;
          addMass(law, terminal, survival); addMass(attemptMass, terminal, survival.mul(new Fraction(BigInt(path.prefix.length))));
          deadCycleBlocks++;
        } else {
          const failures = path.cycle.map(q => new Fraction(BigInt(M - legal[policy.outputs[q] ^ flip].length), BigInt(M)));
          const cycleFailure = failures.reduce((total, value) => total.mul(value), ONE);
          const repeat = survival.div(ONE.sub(cycleFailure));
          const skippedTime = cycleFailure.div(ONE.sub(cycleFailure)).mul(new Fraction(BigInt(path.cycle.length)));
          let within = ONE;
          for (let i = 0; i < path.cycle.length; i++) {
            const q = path.cycle[i], orientation = policy.outputs[q] ^ flip;
            attempts = attempts.add(repeat.mul(within));
            const perAnchor = repeat.mul(within).div(new Fraction(BigInt(M)));
            const episodeTime = skippedTime.add(new Fraction(BigInt(path.prefix.length + i + 1)));
            for (const candidate of legal[orientation]) successors.push({ candidate, orientation, next: policy.transitions[q][1], mass: perAnchor,
              timeMass: perAnchor.mul(episodeTime) });
            within = within.mul(failures[i]);
          }
        }
      }
    }
    for (const { candidate, orientation, next, mass, timeMass } of successors) {
      if (mass.zero) continue;
      const child = solve(mask | candidate, next, flip);
      attempts = attempts.add(mass.mul(child.attempts));
      for (const [terminal, probability] of child.law) {
        const [end, h, v, reason, state] = terminal.split(':');
        const target = `${end}:${Number(h) + Number(orientation === 0)}:${Number(v) + Number(orientation === 1)}:${reason}:${state}`;
        addMass(law, target, mass.mul(probability));
        addMass(attemptMass, target, timeMass.mul(probability).add(mass.mul(child.attemptMass.get(terminal) ?? ZERO)));
      }
    }
    if (!sum([...law.values()]).eq(ONE)) throw new Error('Exact absorption mass failed at ' + key);
    if (!sum([...attemptMass.values()]).eq(attempts)) throw new Error('Exact weighted-attempt normalization failed at ' + key);
    const answer = { law, attempts, attemptMass }; memo.set(key, answer); return answer;
  };
  const law = new Map(), attemptMass = new Map(); let expectedAttempts;
  if (iid) {
    const answer = solve(0, 0, 0); for (const [key, p] of answer.law) addMass(law, key, p);
    for (const [key, value] of answer.attemptMass) addMass(attemptMass, key, value); expectedAttempts = answer.attempts;
  } else {
    const first = solve(0, 0, 0), second = solve(0, 0, 1);
    for (const answer of [first, second]) for (const [key, p] of answer.law) addMass(law, key, p.mul(HALF));
    for (const answer of [first, second]) for (const [key, value] of answer.attemptMass) addMass(attemptMass, key, value.mul(HALF));
    expectedAttempts = first.attempts.add(second.attempts).mul(HALF);
  }
  const metrics = { coverage: ZERO, coverageSquared: ZERO, order: ZERO, absOrder: ZERO, orderSquared: ZERO, orderFourth: ZERO,
    particleCount: ZERO, deadlockProbability: ZERO, geometricProbability: ZERO, expectedTerminalAttempts: expectedAttempts, expectedAttemptsPerParticle: ZERO };
  const coverageLaw = new Map(), distribution = [];
  for (const [key, probability] of law) {
    const [maskText, hText, vText, reason, qText] = key.split(':'), mask = Number(maskText), h = Number(hText), v = Number(vText), count = h + v;
    const coverage = new Fraction(BigInt(popcount(mask)), BigInt(L * L)), order = count ? new Fraction(BigInt(h - v), BigInt(count)) : ZERO;
    const orderSquared = order.mul(order);
    for (const [name, value] of Object.entries({ coverage, coverageSquared: coverage.mul(coverage), order,
      absOrder: new Fraction(order.n < 0n ? -order.n : order.n, order.d), orderSquared, orderFourth: orderSquared.mul(orderSquared), particleCount: new Fraction(BigInt(count)) }))
      metrics[name] = metrics[name].add(probability.mul(value));
    const type = reason === 'deadlock' ? 'deadlockProbability' : 'geometricProbability';
    metrics[type] = metrics[type].add(probability);
    const terminalAttemptMass = attemptMass.get(key) ?? ZERO;
    if (count > 0) metrics.expectedAttemptsPerParticle = metrics.expectedAttemptsPerParticle.add(terminalAttemptMass.div(new Fraction(BigInt(count))));
    else if (!terminalAttemptMass.zero) throw new Error('Nonzero attempts with zero accepted particles');
    addMass(coverageLaw, String(popcount(mask)), probability);
    distribution.push({ occupiedMask: mask, horizontal: h, vertical: v, reason, finalState: iid ? null : Number(qText), probability: probability.toJSON(),
      attemptFirstMomentMass: terminalAttemptMass.toJSON() });
  }
  metrics.coverageVariance = metrics.coverageSquared.sub(metrics.coverage.mul(metrics.coverage));
  metrics.expectedFailures = expectedAttempts.sub(metrics.particleCount);
  metrics.expectedFailuresPerParticle = metrics.expectedAttemptsPerParticle.sub(ONE);
  if (!metrics.order.zero || !metrics.deadlockProbability.add(metrics.geometricProbability).eq(ONE))
    throw new Error('Fair exchange symmetry or terminal normalization failed');
  return { parameters: { L, k, boundary, controller: controllerName(controller), initial: 0, initialOrientation: 'fair-global-exchange',
    memoryStates: iid ? 1 : policy.states, behavioralMemoryBits: iid ? 0 : Math.ceil(Math.log2(policy.states)) },
    method: 'BigInt rational deterministic failure-prefix/cycle elimination, occupancy-monotone memoized recursion, and an exact fair global H/V mixture.',
    stoppingConvention: 'Stop at geometric jam or first state whose entire failure orbit has no legal output. Count preceding sampled trials; omit the infinite blocked tail.',
    metrics: Object.fromEntries(Object.entries(metrics).map(([name, value]) => [name, value.toJSON()])),
    terminalCoverageLaw: [...coverageLaw].map(([occupied, p]) => ({ occupied: Number(occupied), probability: p.toJSON() })).sort((a, b) => a.occupied - b.occupied),
    distribution: distribution.sort((a, b) => a.occupiedMask - b.occupiedMask || a.horizontal - b.horizontal || String(a.reason).localeCompare(b.reason) || (a.finalState ?? 0) - (b.finalState ?? 0)),
    diagnostics: { memoizedStates: memo.size, failureBlocks, deadCycleBlocks },
    kineticDefinitions: { expectedTerminalAttempts: 'E[A]', expectedAttemptsPerParticle: 'E[A/N], from terminal-outcome-weighted attempt rewards; not E[A]/E[N]', expectedFailuresPerParticle: 'E[(A-N)/N]' },
    limitations: 'Expected attempts are finite pre-recognition cost, not a waiting time to a success after deadlock. Exact geometry is limited to L<=3.' };
}

export const exactTerminal = exactFinite;
