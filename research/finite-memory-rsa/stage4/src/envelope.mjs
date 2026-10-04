import { Fraction, rational, ZERO, ONE, compare, json } from './rational.mjs';
import { geometryModel } from './geometry-model.mjs';
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
const scaled = (value, denominator) => {
  if (denominator % value.d !== 0n) throw new Error('Support scaling is not integral');
  return value.n * (denominator / value.d);
};
export function terminalCompletions(model) {
  const result = Array(model.nodes.length);
  for (const i of model.order) {
    const node = model.nodes[i];
    result[i] = node.jam ? [{ n: node.n, h: node.h }] : [...new Map(node.successors.flatMap(row => row.flatMap(edge =>
      result[edge.target].map(tuple => [`${tuple.n}:${tuple.h}`, tuple])))).values()];
  }
  return result;
}
export function supportSpecification(model, specification) {
  const mu = rational(specification.imbalance), nu = rational(specification.cost);
  if (mu.n < 0n || nu.n < 0n) throw new RangeError('Constrained-envelope multipliers must be nonnegative');
  let countDenominator = 1n;
  for (let n = 1; n <= model.Nmax; n++) countDenominator = lcm(countDenominator, BigInt(n));
  const D = lcm(lcm(BigInt(model.L * model.L), mu.d * countDenominator), nu.d * countDenominator);
  const reward = (tuple, attempts) => new Fraction(BigInt(model.k * tuple.n), BigInt(model.L * model.L))
    .sub(mu.mul(new Fraction(BigInt(Math.abs(2 * tuple.h - tuple.n)), BigInt(tuple.n))))
    .sub(nu.mul(new Fraction(BigInt(attempts), BigInt(tuple.n))));
  return { mu, nu, D, countDenominator, reward,
    integer: (tuple, attempts) => scaled(reward(tuple, attempts), D) };
}

/** Certified outer support envelope over every random outcome-independent word law. */
export function fullInformationTail(model, specification, prefixLength) {
  const spec = supportSpecification(model, specification), values = Array(model.nodes.length);
  for (const i of model.order) {
    const node = model.nodes[i];
    if (node.jam) { values[i] = spec.reward(node, prefixLength); continue; }
    const choices = [0,1].flatMap(action => node.legal[action] ? [
      node.successors[action].reduce((total, edge) => total.add(values[edge.target].mul(new Fraction(BigInt(edge.multiplicity), BigInt(node.legal[action])))), ZERO)
        .sub(spec.nu.mul(new Fraction(BigInt(model.M), BigInt(model.Nmax * node.legal[action]))))
    ] : []);
    values[i] = choices.reduce((a, b) => compare(a, b) > 0 ? a : b);
  }
  return values;
}
export function certifiedEnvelope(parameters, { horizons = [4,8,12], multipliers, informedTail = false } = {}) {
  const model = geometryModel(parameters), maxHorizon = Math.max(...horizons);
  if (horizons.some(t => !Number.isInteger(t) || t < 1) || !Number.isSafeInteger(model.M ** maxHorizon)) throw new RangeError('Horizon exceeds exact safe-integer anchor counts');
  const completions = terminalCompletions(model), specs = multipliers.map(x => supportSpecification(model, x));
  const Dcount = specs[0].countDenominator;
  const rationalTails = informedTail ? horizons.map(T => multipliers.map(spec => fullInformationTail(model, spec, T))) : null;
  if (informedTail) for (let j = 0; j < specs.length; j++) for (const horizon of rationalTails)
    for (const value of horizon[j]) specs[j].D = lcm(specs[j].D, value.d);
  const upper = horizons.map((T, slot) => specs.map((spec, j) => informedTail ? rationalTails[slot][j].map(value => scaled(value, spec.D)) : model.nodes.map((node, i) => {
    const options = completions[i].map(tuple => spec.integer(tuple, T + tuple.n - node.n));
    return options.reduce((a, b) => a > b ? a : b);
  })));
  const leaves = Object.fromEntries(horizons.map(t => [t, []]));
  const maxima = Object.fromEntries(horizons.map(t => [t, specs.map(() => null)]));
  const terminalReward = (node, attempts) => [BigInt(model.k * node.n),
    BigInt(Math.abs(2 * node.h - node.n)) * (Dcount / BigInt(node.n)),
    BigInt(attempts) * (Dcount / BigInt(node.n))];
  const advance = (counts, absorbed, action, time) => {
    const next = new Float64Array(counts.length), reward = absorbed.map(x => x * BigInt(model.M));
    for (let i = 0; i < counts.length; i++) if (counts[i]) {
      const count = counts[i], node = model.nodes[i];
      next[i] += count * (model.M - node.legal[action]);
      for (const edge of node.successors[action]) {
        const mass = count * edge.multiplicity, target = model.nodes[edge.target];
        if (target.jam) {
          const values = terminalReward(target, time);
          values.forEach((x, j) => reward[j] += BigInt(mass) * x);
        } else next[edge.target] += mass;
      }
    }
    return { counts: next, absorbed: reward };
  };
  let visitedPrefixes = 0;
  const visit = (counts, absorbed, word) => {
    visitedPrefixes++; const T = word.length, slot = horizons.indexOf(T);
    if (slot >= 0) {
      const numerators = specs.map((spec, j) => {
        const base = new Fraction(absorbed[0], BigInt(model.L * model.L))
          .sub(spec.mu.mul(new Fraction(absorbed[1], Dcount))).sub(spec.nu.mul(new Fraction(absorbed[2], Dcount)));
        let value = scaled(base, spec.D);
        for (let i = 0; i < counts.length; i++) if (counts[i]) value += BigInt(counts[i]) * upper[slot][j][i];
        if (maxima[T][j] === null || value > maxima[T][j].numerator) maxima[T][j] = { numerator: value, word };
        return value.toString();
      });
      leaves[T].push({ word, numerators });
    }
    if (T >= maxHorizon) return;
    for (const action of T === 0 ? [0] : [0,1]) {
      const child = advance(counts, absorbed, action, T + 1);
      visit(child.counts, child.absorbed, word + action);
    }
  };
  const initial = new Float64Array(model.nodes.length); initial[0] = 1;
  visit(initial, [0n,0n,0n], '');
  const bounds = horizons.flatMap(T => specs.map((spec, j) => {
    const maximum = maxima[T][j], denominator = spec.D * BigInt(model.M) ** BigInt(T);
    return { horizon: T, imbalanceMultiplier: json(spec.mu), costMultiplier: json(spec.nu),
      integerDenominator: denominator.toString(), rawMaxNumerator: maximum.numerator.toString(),
      supportUpper: json(new Fraction(maximum.numerator, denominator)), maximizingPrefix: maximum.word,
      completePrefixes: leaves[T].length };
  }));
  return { schemaVersion: 1, parameters, horizons, multipliers, visitedPrefixes,
    physicalCountStates: model.nodes.length, bounds, leaves,
    coverageConstraints: 'For every mu,nu>=0: coverage <= supportUpper + mu*s + nu*c whenever E|S|<=s and E[A/N]<=c.',
    family: 'All distributions of infinite orientation words independent of anchors/outcomes, hence all <=4-state edge-emitting temporal HMMs.',
    informedTail,
    relaxation: informedTail ? 'After the fixed prefix a fully observed controller chooses orientations, with uniform real anchors. Additional trial cost is lower-bounded by 1/Nmax per attempt, while past T/N is retained exactly in terminal reward.' : 'Past geometric absorption is exact; live prefix states may choose any physically reachable terminal completion, paying at least one trial per remaining acceptance.',
    exactArithmetic: 'Active anchor-path counts are safe integers, bounded by M^T; all rewards and maximization numerators use BigInt rational scaling.',
    symmetry: 'Only first-H words enumerated; first-V upper supports coincide by square-lattice transposition. This is a proof symmetry, not an external persistent controller coin.',
    attainmentClaimed: false, fourStateGlobalOptimumClaimed: false };
}

/** Independent BigInt forward replay of a certificate's proposed maximizing prefix. */
export function replayPrefixUpper(parameters, word, specification, { informedTail = false } = {}) {
  const model = geometryModel(parameters), spec = supportSpecification(model, specification), completions = terminalCompletions(model);
  let counts = new Map([[0, 1n]]), absorbed = ZERO;
  for (let t = 0; t < word.length; t++) {
    const action = Number(word[t]), next = new Map(); absorbed = absorbed.mul(new Fraction(BigInt(model.M)));
    const add = (i, value) => next.set(i, (next.get(i) ?? 0n) + value);
    for (const [i, count] of counts) {
      const node = model.nodes[i]; add(i, count * BigInt(model.M - node.legal[action]));
      for (const edge of node.successors[action]) {
        const mass = count * BigInt(edge.multiplicity), target = model.nodes[edge.target];
        if (target.jam) absorbed = absorbed.add(spec.reward(target, t + 1).mul(new Fraction(mass)));
        else add(edge.target, mass);
      }
    }
    counts = next;
  }
  let value = absorbed;
  const informed = informedTail ? fullInformationTail(model, specification, word.length) : null;
  for (const [i, count] of counts) if (count) {
    const node = model.nodes[i];
    const best = informedTail ? informed[i] : completions[i].map(tuple => spec.reward(tuple, word.length + tuple.n - node.n)).reduce((a, b) => compare(a, b) > 0 ? a : b);
    value = value.add(best.mul(new Fraction(count)));
  }
  return value.div(new Fraction(BigInt(model.M) ** BigInt(word.length)));
}
