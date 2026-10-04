import { Fraction, rational, ZERO, ONE, sum, inverse, matvec, json, number } from './rational.mjs';
import { geometryModel } from './geometry-model.mjs';

export function temporalController({ initial, H, V, name = 'stochastic-temporal' }) {
  const n = H?.length;
  if (!Number.isInteger(n) || n < 1 || n > 4 || V?.length !== n || [...H, ...V].some(row => row.length !== n)) throw new RangeError('Temporal family has 1..4 states');
  const emission = [H, V].map(matrix => matrix.map(row => row.map(rational)));
  const pi = (initial ?? Array.from({ length: n }, (_, q) => Number(q === 0))).map(rational);
  if (pi.length !== n || pi.some(x => x.n < 0n) || !sum(pi).eq(ONE)) throw new RangeError('Invalid initial distribution');
  for (let q = 0; q < n; q++) if (emission.some(matrix => matrix[q].some(x => x.n < 0n)) || !sum(emission.flatMap(matrix => matrix[q])).eq(ONE)) throw new RangeError('Invalid symbol-labelled row');
  return { name, n, initial: pi, failure: emission, success: emission, temporal: true };
}
export function feedbackController(controller) {
  const n = controller.outputs.length, initial = Array.from({ length: n }, (_, q) => q === (controller.initial ?? 0) ? ONE : ZERO);
  const matrices = outcome => [0,1].map(action => Array.from({ length: n }, (_, q) => Array.from({ length: n }, (_, r) =>
    controller.outputs[q] === action && controller.transitions[q][outcome] === r ? ONE : ZERO)));
  return { name: controller.classId ?? 'deterministic-feedback', n, initial,
    failure: matrices(0), success: matrices(1), temporal: false };
}
export function switchingTemporal(alpha, beta, name = 'switching') {
  const a = rational(alpha), b = rational(beta);
  return temporalController({ name, H: [[ONE.sub(a), a], [ZERO, ZERO]], V: [[ZERO, ZERO], [b, ONE.sub(b)]] });
}
export function universalTemporalLiveness(policy) {
  const { n } = policy, T = policy.success[0].map((row, i) => row.map((x, j) => x.add(policy.success[1][i][j])));
  const reachable = new Set(policy.initial.flatMap((x, i) => x.zero ? [] : [i]));
  let changed = true;
  while (changed) { changed = false; for (const i of [...reachable]) for (let j = 0; j < n; j++) if (!T[i][j].zero && !reachable.has(j)) { reachable.add(j); changed = true; } }
  const bad = [];
  for (let set = 1; set < (1 << n); set++) {
    const states = [...reachable].filter(i => set & (1 << i));
    if (!states.length || states.length !== Array.from({ length: n }, (_, i) => i).filter(i => set & (1 << i)).length) continue;
    if (states.some(i => T[i].some((p, j) => !p.zero && !(set & (1 << j))))) continue;
    const actions = [0,1].filter(a => states.some(i => policy.success[a][i].some(p => !p.zero)));
    if (actions.length !== 2) bad.push({ states, actions });
  }
  return { live: bad.length === 0, unreachableStates: n - reachable.size, closedMonochromaticSets: bad };
}
export function orientationWordProbability(policy, word) {
  let row = [...policy.initial];
  for (const action of word) row = Array.from({ length: policy.n }, (_, j) => sum(row.map((p, i) => p.mul(policy.success[action][i][j]))));
  return sum(row);
}

/** Exact linear-span language equivalence of two rational edge-emitting HMMs. */
export function temporalEquivalence(first, second) {
  const d = first.n + second.n, matrices = [0,1].map(a => Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) =>
    i < first.n && j < first.n ? first.success[a][i][j] : i >= first.n && j >= first.n ? second.success[a][i - first.n][j - first.n] : ZERO)));
  const queue = [{ row: [...first.initial, ...second.initial.map(x => ZERO.sub(x))], word: [] }], basis = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { row, word } = queue[cursor];
    if (!sum(row).zero) return { equivalent: false, witnessWord: word,
      firstProbability: json(orientationWordProbability(first, word)), secondProbability: json(orientationWordProbability(second, word)), rank: basis.length };
    let reduced = [...row];
    for (const vector of basis) {
      const coefficient = reduced[vector.pivot];
      if (!coefficient.zero) reduced = reduced.map((x, i) => x.sub(coefficient.mul(vector.row[i])));
    }
    const pivot = reduced.findIndex(x => !x.zero);
    if (pivot < 0) continue;
    const divisor = reduced[pivot]; reduced = reduced.map(x => x.div(divisor));
    basis.push({ pivot, row: reduced }); basis.sort((a, b) => a.pivot - b.pivot);
    for (let a = 0; a < 2; a++) queue.push({ row: Array.from({ length: d }, (_, j) => sum(row.map((p, i) => p.mul(matrices[a][i][j])))), word: [...word, a] });
  }
  return { equivalent: true, rank: basis.length, proof: 'Exact reachable row-span annihilates the all-ones column' };
}

export function exactController(policy, parameters, { retainLaw = true, retainBellmanCertificate = false } = {}) {
  if (!Number.isInteger(policy.n) || policy.n < 1 || policy.n > 4 || policy.initial.length !== policy.n || !sum(policy.initial).eq(ONE) || policy.initial.some(x=>x.n<0n)) throw new RangeError('Invalid compiled controller');
  for(let q=0;q<policy.n;q++){
    for(const matrices of [policy.failure,policy.success])if(matrices.length!==2||matrices.some(matrix=>matrix.length!==policy.n||matrix.some(row=>row.length!==policy.n))||matrices.some(matrix=>matrix[q].some(x=>x.n<0n))||!sum(matrices.flatMap(matrix=>matrix[q])).eq(ONE))throw new RangeError('Invalid outcome transition row');
    for(let a=0;a<2;a++){
      if(!sum(policy.failure[a][q]).eq(sum(policy.success[a][q])))throw new RangeError('Action probability cannot depend on the unobserved next outcome');
      if(policy.temporal&&policy.failure[a][q].some((x,r)=>!x.eq(policy.success[a][q][r])))throw new RangeError('Temporal update cannot depend on outcome');
    }
  }
  const model = geometryModel(parameters), n = policy.n, answers = Array(model.nodes.length), inverses = new Map();
  // Exact fixed-geometry liveness need not imply abstract universal liveness.
  // Remove unreachable product states before inverting a failure block.
  const reachable = model.nodes.map(() => new Set()), queue = [];
  const addReachable = (i, q) => { if (!reachable[i].has(q)) { reachable[i].add(q); queue.push([i, q]); } };
  policy.initial.forEach((p, q) => { if (!p.zero) addReachable(0, q); });
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [i, q] = queue[cursor], node = model.nodes[i]; if (node.jam) continue;
    for (let action = 0; action < 2; action++) for (let r = 0; r < n; r++) {
      if (!policy.failure[action][q][r].zero && node.legal[action] < model.M) addReachable(i, r);
      if (!policy.success[action][q][r].zero) for (const edge of node.successors[action]) addReachable(edge.target, r);
    }
  }
  const add = (map, key, mass) => { if (!mass.zero) map.set(key, (map.get(key) ?? ZERO).add(mass)); };
  for (const index of model.order) {
    const node = model.nodes[index];
    const qs = [...reachable[index]].sort((a, b) => a - b);
    if (!qs.length) { answers[index] = Array.from({ length: n }, () => ({ metrics:Array(4).fill(ZERO), law:new Map(), attempts:new Map() })); continue; }
    if (node.jam) {
      const metrics = [new Fraction(BigInt(parameters.k * node.n), BigInt(parameters.L * parameters.L)),
        new Fraction(BigInt(Math.abs(2 * node.h - node.n)), BigInt(node.n)), new Fraction(1n, BigInt(node.n)), ZERO];
      answers[index] = Array.from({ length: n }, () => ({ metrics, law: new Map([[`${node.mask}:${node.h}`, ONE]]), attempts: new Map() }));
      continue;
    }
    const inverseKey = `${node.legal.join(',')}|${qs.join(',')}`;
    if (!inverses.has(inverseKey)) {
      const F = Array.from({ length: n }, (_, q) => Array.from({ length: n }, (_, r) => sum([0,1].map(a =>
        policy.failure[a][q][r].mul(new Fraction(BigInt(model.M - node.legal[a]), BigInt(model.M)))))));
      const reduced = inverse(qs.map(i => qs.map(j => (i === j ? ONE : ZERO).sub(F[i][j]))));
      const full = Array.from({ length:n }, () => Array(n).fill(ZERO));
      qs.forEach((q, i) => qs.forEach((r, j) => full[q][r] = reduced[i][j]));
      inverses.set(inverseKey, full);
    }
    const Z = inverses.get(inverseKey), b = Array.from({ length: n }, () => Array(4).fill(ZERO));
    const laws = Array.from({ length: n }, () => new Map()), attempts = Array.from({ length: n }, () => new Map());
    for (const q of qs) for (let a = 0; a < 2; a++) for (let r = 0; r < n; r++) {
      if (policy.success[a][q][r].zero) continue;
      for (const edge of node.successors[a]) {
        const weight = policy.success[a][q][r].mul(new Fraction(BigInt(edge.multiplicity), BigInt(model.M)));
        const child = answers[edge.target][r];
        for (let metric = 0; metric < 4; metric++) b[q][metric] = b[q][metric].add(weight.mul(child.metrics[metric]));
        if (retainLaw) {
          for (const [key, value] of child.law) add(laws[q], key, weight.mul(value));
          for (const [key, value] of child.attempts) add(attempts[q], key, weight.mul(value));
        }
      }
    }
    const evaluated = Array.from({ length: n }, () => Array(4).fill(ZERO));
    for (let metric = 0; metric < 3; metric++) matvec(Z, b.map(row => row[metric])).forEach((x, q) => evaluated[q][metric] = x);
    matvec(Z, b.map((row, q) => row[3].add(evaluated[q][2]))).forEach((x, q) => evaluated[q][3] = x);
    const solvedLaw = Array.from({ length: n }, () => new Map()), solvedAttempts = Array.from({ length: n }, () => new Map());
    if (retainLaw) {
      for (let q = 0; q < n; q++) for (let r = 0; r < n; r++) if (!Z[q][r].zero) {
        for (const [key, value] of laws[r]) add(solvedLaw[q], key, Z[q][r].mul(value));
        for (const [key, value] of attempts[r]) add(solvedAttempts[q], key, Z[q][r].mul(value));
      }
      for (let q = 0; q < n; q++) for (let r = 0; r < n; r++) if (!Z[q][r].zero)
        for (const [key, value] of solvedLaw[r]) add(solvedAttempts[q], key, Z[q][r].mul(value));
    }
    answers[index] = evaluated.map((metrics, q) => ({ metrics, law: solvedLaw[q], attempts: solvedAttempts[q] }));
  }
  const metrics = Array(4).fill(ZERO), law = new Map(), attemptLaw = new Map();
  policy.initial.forEach((p, q) => {
    for (let metric = 0; metric < 4; metric++) metrics[metric] = metrics[metric].add(p.mul(answers[0][q].metrics[metric]));
    if (retainLaw) {
      for (const [key, value] of answers[0][q].law) add(law, key, p.mul(value));
      for (const [key, value] of answers[0][q].attempts) add(attemptLaw, key, p.mul(value));
    }
  });
  if (retainLaw) {
    if (!sum([...law.values()]).eq(ONE)) throw new Error('Absorption mass does not normalize');
    const weighted = sum([...attemptLaw].map(([key, value]) => {
      const mask = Number(key.split(':')[0]), node = model.nodes.find(x => x.mask === mask);
      return value.div(new Fraction(BigInt(node.n)));
    }));
    if (!weighted.eq(metrics[3])) throw new Error('Independent terminal reward and inverse-N dynamic program disagree');
  }
  return { policy: policy.name, temporal: policy.temporal, parameters,
    states: n, metrics: Object.fromEntries(['coverage','absOrder','inverseN','attemptsPerParticle'].map((name, i) => [name, json(metrics[i])])),
    law: retainLaw ? [...law].sort(([a], [b]) => a.localeCompare(b)).map(([key, probability]) => ({ key, probability: json(probability), attemptFirstMomentMass: json(attemptLaw.get(key) ?? ZERO) })) : null,
    bellmanCertificate: retainBellmanCertificate ? model.nodes.map((node, i) => ({ mask:node.mask, h:node.h,
      reachableStates:[...reachable[i]].sort((a,b)=>a-b),
      values:answers[i].map((answer,q)=>reachable[i].has(q)?answer.metrics.map(x=>`${x.n}/${x.d}`):null) })) : undefined,
    diagnostics: { physicalCountStates: model.nodes.length, distinctFailureBlocks: inverses.size },
    convention: 'Fixed initial realization, no uncounted persistent H/V coin. E[A/N] from terminal-weighted rewards; only geometric jam, finite absorption required.' };
}

function inverseFloat(matrix) {
  const n = matrix.length, a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (Math.abs(a[p][k]) < 1e-13) throw new RangeError('Singular numeric failure block');
    [a[k], a[p]] = [a[p], a[k]]; const divisor = a[k][k];
    for (let j = 0; j < 2 * n; j++) a[k][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== k) { const weight = a[i][k]; for (let j = 0; j < 2 * n; j++) a[i][j] -= weight * a[k][j]; }
  }
  return a.map(row => row.slice(n));
}
/** Exploration only: never used for any certificate or exact claim. */
export function numericController(policy, model) {
  const n = policy.n, fail = policy.failure.map(matrix => matrix.map(row => row.map(number))), success = policy.success.map(matrix => matrix.map(row => row.map(number)));
  const answers = Array(model.nodes.length), inverses = new Map();
  for (const index of model.order) {
    const node = model.nodes[index];
    if (node.jam) { answers[index] = Array.from({ length: n }, () => [model.k * node.n / (model.L * model.L), Math.abs(2 * node.h - node.n) / node.n, 1 / node.n, 0]); continue; }
    const key = node.legal.join(',');
    if (!inverses.has(key)) inverses.set(key, inverseFloat(Array.from({ length: n }, (_, q) => Array.from({ length: n }, (_, r) =>
      Number(q === r) - [0,1].reduce((v, a) => v + fail[a][q][r] * (model.M - node.legal[a]) / model.M, 0)))));
    const Z = inverses.get(key), b = Array.from({ length: n }, () => Array(4).fill(0));
    for (let q = 0; q < n; q++) for (let a = 0; a < 2; a++) for (let r = 0; r < n; r++) if (success[a][q][r])
      for (const edge of node.successors[a]) for (let metric = 0; metric < 4; metric++) b[q][metric] += success[a][q][r] * edge.multiplicity / model.M * answers[edge.target][r][metric];
    const result = Z.map(row => Array.from({ length: 4 }, (_, metric) => row.reduce((v, z, r) => v + z * b[r][metric], 0)));
    for (let q = 0; q < n; q++) result[q][3] += Z[q].reduce((v, z, r) => v + z * result[r][2], 0);
    answers[index] = result;
  }
  return ['coverage','absOrder','inverseN','attemptsPerParticle'].reduce((values, name, i) => ({ ...values,
    [name]: policy.initial.reduce((v, p, q) => v + number(p) * answers[0][q][i], 0) }), {});
}
