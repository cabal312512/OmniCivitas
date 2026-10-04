import { decodeController, validateController, allControllers, classifyControllers } from './controllers.mjs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };

/** Reduced arbitrary-precision fractions; floating values are presentation only. */
export class Fraction {
  constructor(n = 0n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (!d) throw new RangeError('Zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const divisor = gcd(n, d);
    this.n = n / divisor; this.d = d / divisor;
  }
  add(x) { return new Fraction(this.n * x.d + x.n * this.d, this.d * x.d); }
  sub(x) { return new Fraction(this.n * x.d - x.n * this.d, this.d * x.d); }
  mul(x) { return new Fraction(this.n * x.n, this.d * x.d); }
  div(x) { return new Fraction(this.n * x.d, this.d * x.n); }
  eq(x) { return this.n === x.n && this.d === x.d; }
  get zero() { return this.n === 0n; }
  number() { return Number(this.n) / Number(this.d); }
  toJSON() { return { numerator: this.n.toString(), denominator: this.d.toString(), value: this.number() }; }
}

const ZERO = new Fraction();
const ONE = new Fraction(1n);
const bits = mask => { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; };

export function enumeratePlacements(L, k, boundary = 'periodic') {
  if (!Number.isInteger(L) || !Number.isInteger(k) || L < 1 || k < 1 || k > L || L > 3) throw new RangeError('Exact solver accepts 1 <= k <= L <= 3');
  if (boundary !== 'periodic' && boundary !== 'open') throw new RangeError('Boundary must be periodic or open');
  const placements = [[], []];
  for (let orientation = 0; orientation < 2; orientation++) {
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (boundary === 'open' && (orientation ? y : x) + k > L) continue;
      let mask = 0;
      for (let step = 0; step < k; step++) {
        const xx = (x + (orientation === 0 ? step : 0)) % L;
        const yy = (y + (orientation === 1 ? step : 0)) % L;
        mask |= 1 << (yy * L + xx);
      }
      // Retain duplicates: the uniformly drawn anchor, rather than a distinct
      // geometric k-mer, is the elementary candidate event (important at k=L).
      placements[orientation].push(mask);
    }
  }
  return placements;
}

const addMass = (map, key, p) => { if (!p.zero) map.set(key, (map.get(key) ?? ZERO).add(p)); };

/**
 * Exact absorbing law. Failures change only q; their deterministic prefix and
 * cycle are summed as a geometric series. Each success increases occupancy,
 * so the remaining memoized recursion is an acyclic mask dynamic program.
 * baseline='fair' samples H/V independently with probability 1/2 per attempt.
 */
export function exactTerminal({ L, k, controller, boundary = 'periodic', baseline = null }) {
  const placements = enumeratePlacements(L, k, boundary);
  if (baseline === 'alwaysH') controller = decodeController(0);
  if (baseline === 'alwaysV') controller = decodeController(48);
  if (baseline === 'alternating') controller = decodeController(35);
  const fair = baseline === 'fair';
  if (baseline !== null && !['fair','alwaysH','alwaysV','alternating'].includes(baseline)) throw new RangeError('Unknown baseline');
  if (!fair) {
    if (typeof controller === 'number') controller = decodeController(controller);
    validateController(controller);
  }
  const M = placements[0].length;
  const memo = new Map();
  let failureBlocks = 0;
  let deadCycleBlocks = 0;
  let maxDenominatorDigits = 1;
  const solve = (mask, initialQ) => {
    const key = `${mask}:${initialQ}`;
    if (memo.has(key)) return memo.get(key);
    const legal = placements.map(row => row.filter(p => !(p & mask)));
    const terminal = new Map();
    const geometric = legal[0].length + legal[1].length === 0;
    if (geometric) terminal.set(`${mask}:0:0:geometric`, ONE);
    else {
      const successors = [];
      if (fair) {
        const normalizer = new Fraction(1n, BigInt(legal[0].length + legal[1].length));
        for (let o = 0; o < 2; o++) for (const p of legal[o]) successors.push({ p, o, next: 0, mass: normalizer });
      } else {
        failureBlocks++;
        const states = [];
        const first = new Map();
        let q = initialQ;
        while (!first.has(q)) { first.set(q, states.length); states.push(q); q = controller.transitions[q][0]; }
        const start = first.get(q);
        const failure = states.map(state => new Fraction(BigInt(M - legal[controller.outputs[state]].length), BigInt(M)));
        let prefixSurvival = ONE;
        for (let i = 0; i < start; i++) {
          const state = states[i]; const o = controller.outputs[state];
          const mass = prefixSurvival.div(new Fraction(BigInt(M)));
          for (const p of legal[o]) successors.push({ p, o, next: controller.transitions[state][1], mass });
          prefixSurvival = prefixSurvival.mul(failure[i]);
        }
        const cycleFailure = failure.slice(start).reduce((a, p) => a.mul(p), ONE);
        if (cycleFailure.eq(ONE)) {
          // This is an actual closed failure cycle, not a long waiting time.
          deadCycleBlocks++;
          addMass(terminal, `${mask}:0:0:deadlock`, prefixSurvival);
        } else {
          let cycleSurvival = ONE;
          const repeatFactor = prefixSurvival.div(ONE.sub(cycleFailure));
          for (let i = start; i < states.length; i++) {
            const state = states[i]; const o = controller.outputs[state];
            const mass = repeatFactor.mul(cycleSurvival).div(new Fraction(BigInt(M)));
            for (const p of legal[o]) successors.push({ p, o, next: controller.transitions[state][1], mass });
            cycleSurvival = cycleSurvival.mul(failure[i]);
          }
        }
      }
      // Equal anchors may share a mask; accumulation preserves their original
      // event multiplicity without an artificial orientation preference.
      for (const { p, o, next, mass } of successors) {
        if (mass.zero) continue;
        for (const [end, probability] of solve(mask | p, next)) {
          const [endMask, h, v, reason] = end.split(':');
          addMass(terminal, `${endMask}:${Number(h) + (o === 0 ? 1 : 0)}:${Number(v) + (o === 1 ? 1 : 0)}:${reason}`, mass.mul(probability));
        }
      }
    }
    const probabilitySum = [...terminal.values()].reduce((sum, p) => sum.add(p), ZERO);
    if (!probabilitySum.eq(ONE)) throw new Error(`Absorption mass failed at ${key}: ${JSON.stringify(probabilitySum)}`);
    for (const p of terminal.values()) maxDenominatorDigits = Math.max(maxDenominatorDigits, p.d.toString().length);
    memo.set(key, terminal);
    return terminal;
  };
  const distribution = solve(0, fair ? 0 : controller.initial ?? 0);
  const moments = { coverage: ZERO, absOrder: ZERO, order: ZERO, deadlockProbability: ZERO, geometricProbability: ZERO, particleCount: ZERO, coverageSquared: ZERO };
  const coverageLaw = new Map();
  const terminalLaw = [];
  for (const [key, probability] of distribution) {
    const [maskText, hText, vText, reason] = key.split(':');
    const mask = Number(maskText), h = Number(hText), v = Number(vText), count = h + v;
    const coverage = new Fraction(BigInt(bits(mask)), BigInt(L * L));
    const order = count ? new Fraction(BigInt(h - v), BigInt(count)) : ZERO;
    moments.coverage = moments.coverage.add(probability.mul(coverage));
    moments.coverageSquared = moments.coverageSquared.add(probability.mul(coverage.mul(coverage)));
    moments.order = moments.order.add(probability.mul(order));
    moments.absOrder = moments.absOrder.add(probability.mul(new Fraction(order.n < 0n ? -order.n : order.n, order.d)));
    moments.particleCount = moments.particleCount.add(probability.mul(new Fraction(BigInt(count))));
    moments[reason === 'deadlock' ? 'deadlockProbability' : 'geometricProbability'] = moments[reason === 'deadlock' ? 'deadlockProbability' : 'geometricProbability'].add(probability);
    addMass(coverageLaw, String(bits(mask)), probability);
    terminalLaw.push({ occupiedMask: mask, horizontal: h, vertical: v, reason, probability: probability.toJSON() });
  }
  moments.coverageVariance = moments.coverageSquared.sub(moments.coverage.mul(moments.coverage));
  return {
    parameters: { L, k, boundary, controllerId: fair ? null : controller.id ?? null, baseline },
    method: 'Exact BigInt rational arithmetic; deterministic failure-prefix/cycle elimination and occupancy-monotone memoized dynamic programming. No failure cutoff.',
    metrics: Object.fromEntries(Object.entries(moments).map(([name, value]) => [name, value.toJSON()])),
    terminalCoverageLaw: [...coverageLaw].map(([occupied, probability]) => ({ occupied: Number(occupied), probability: probability.toJSON() })).sort((a,b) => a.occupied - b.occupied),
    distribution: terminalLaw.sort((a,b) => a.occupiedMask - b.occupiedMask || a.horizontal - b.horizontal || a.reason.localeCompare(b.reason)),
    diagnostics: { memoizedStates: memo.size, failureBlocks, deadCycleBlocks, maxDenominatorDigits },
  };
}

/** Complete tiny-system reference study, including every one of the 64 IDs. */
export function exactSmallSystemStudy() {
  const systems = [];
  for (const [L,k] of [[2,2],[3,2],[3,3]]) for (const boundary of ['periodic','open']) {
    systems.push({ L,k,boundary,
      controllers: allControllers().map(controller => exactTerminal({L,k,boundary,controller})),
      baselines: ['fair','alwaysH','alwaysV','alternating'].map(baseline => exactTerminal({L,k,boundary,baseline})),
    });
  }
  return {
    schemaVersion: 1,
    model: 'Uniform valid anchors conditional on orientation; periodic anchors retain geometric multiplicity; deterministic two-state feedback controllers start at q=0.',
    calculation: 'Exact rational absorbing law, not Monte Carlo.',
    sanity: {
      monomers: allControllers().map(controller => exactTerminal({L:2,k:1,controller})),
      singleSiteFair: exactTerminal({L:1,k:1,baseline:'fair'}),
    },
    systems,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../',import.meta.url);
  const output = new URL('data/processed/',root);
  mkdirSync(output,{recursive:true});
  const provenance = {
    generatedAtUTC: new Date().toISOString(), nodeVersion: process.version,
    sourceHashes: Object.fromEntries(['src/controllers.mjs','src/exact.mjs'].map(path => [path,createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex')])),
  };
  const classification = { ...provenance,...classifyControllers() };
  const result = { ...provenance,...exactSmallSystemStudy() };
  writeFileSync(new URL('controller_classes.json',output),JSON.stringify(classification,null,2)+'\n');
  writeFileSync(new URL('exact_small_systems.json',output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({outputDirectory:fileURLToPath(output),systems:result.systems.length,controllersPerSystem:64,orientedClasses:classification.orientedClassCount,exchangeClasses:classification.exchangeClassCount,
    references: result.systems.map(s => ({L:s.L,k:s.k,boundary:s.boundary,
      baselines:s.baselines.map(b => ({baseline:b.parameters.baseline,coverage:b.metrics.coverage,deadlock:b.metrics.deadlockProbability})),
    })),
  },null,2));
}
