import test from 'node:test';
import assert from 'node:assert/strict';
import { Fraction } from '../../src/exact.mjs';
import { exactFinite } from '../src/exact.mjs';

const ZERO = new Fraction(), ONE = new Fraction(1n), HALF = new Fraction(1n, 2n);
const f = value => new Fraction(BigInt(value));
const jsonKey = item => [item.occupiedMask, item.horizontal, item.vertical, item.reason, item.finalState ?? 0].join(':');
const fixtures = [
  { id: 'constant', outputs: [0], transitions: [[0, 0]], initial: 0 },
  { id: 'alternation', outputs: [0, 1], transitions: [[1, 1], [0, 0]], initial: 0 },
  { id: 'failure-flip', outputs: [0, 1], transitions: [[1, 0], [0, 1]], initial: 0 },
  { id: 'success-flip', outputs: [0, 1], transitions: [[0, 1], [1, 0]], initial: 0 },
  { id: 'prefix-dead', outputs: [0, 0, 1, 1], transitions: [[3, 1], [2, 1], [3, 0], [3, 0]], initial: 0 },
  { id: 'four-cycle', outputs: [0, 0, 1, 1], transitions: [[1, 2], [2, 3], [3, 0], [0, 1]], initial: 0 },
  { id: 'three-temporal', outputs: [0, 1, 1], transitions: [[1, 1], [2, 2], [0, 0]], initial: 0 },
];

/** Independent full one-trial absorbing chain, not failure-episode elimination. */
function oracle(controller, boundary, flip = 0) {
  const L = 2, k = 2, iid = controller.probabilityH === .5;
  const placements = [[], []];
  for (let o = 0; o < 2; o++) for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    if (boundary === 'open' && (o ? y : x) + k > L) continue;
    let mask = 0;
    for (let j = 0; j < k; j++) mask |= 1 << ((o ? (y + j) % L : y) * L + (o ? x : (x + j) % L));
    placements[o].push(mask);
  }
  const M = placements[0].length, nodes = [], index = new Map();
  const intern = value => {
    const key = [value.mask, value.q, value.h, value.v].join(':');
    if (!index.has(key)) { index.set(key, nodes.length); nodes.push({ ...value, edges: [] }); }
    return index.get(key);
  };
  intern({ mask: 0, q: 0, h: 0, v: 0 });
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i], legal = placements.map(row => row.filter(mask => !(mask & node.mask)));
    let live = iid;
    if (!iid) {
      const seen = new Set(); let q = node.q;
      while (!seen.has(q)) { seen.add(q); if (legal[controller.outputs[q] ^ flip].length) live = true; q = controller.transitions[q][0]; }
    }
    if (!legal[0].length && !legal[1].length) node.reason = 'geometric';
    else if (!live) node.reason = 'deadlock';
    if (node.reason) continue;
    const orientations = iid ? [0, 1] : [controller.outputs[node.q] ^ flip];
    const mass = new Fraction(1n, BigInt(M * orientations.length));
    for (const o of orientations) for (const candidate of placements[o]) {
      const success = !(node.mask & candidate);
      const next = intern({ mask: success ? node.mask | candidate : node.mask,
        q: iid ? 0 : controller.transitions[node.q][Number(success)],
        h: node.h + Number(success && o === 0), v: node.v + Number(success && o === 1) });
      node.edges.push({ next, mass });
    }
  }
  const transient = nodes.map((node, i) => ({ node, i })).filter(item => !item.node.reason);
  const absorbing = nodes.map((node, i) => ({ node, i })).filter(item => item.node.reason);
  const ti = new Map(transient.map((item, i) => [item.i, i])), ai = new Map(absorbing.map((item, i) => [item.i, i]));
  const A = transient.map((item, i) => transient.map((other, j) => i === j ? ONE : ZERO));
  const R = transient.map(() => absorbing.map(() => ZERO));
  for (const { node, i } of transient) for (const edge of node.edges) {
    const row = ti.get(i);
    if (ti.has(edge.next)) A[row][ti.get(edge.next)] = A[row][ti.get(edge.next)].sub(edge.mass);
    else R[row][ai.get(edge.next)] = R[row][ai.get(edge.next)].add(edge.mass);
  }
  function gaussian(rhs) {
    const matrix = A.map((row, i) => [...row, ...rhs[i]]), n = A.length, columns = rhs[0].length;
    for (let pivot = 0; pivot < n; pivot++) {
      const row = matrix.findIndex((values, i) => i >= pivot && !values[pivot].zero);
      assert.ok(row >= 0, 'Transient-chain inverse exists');
      [matrix[pivot], matrix[row]] = [matrix[row], matrix[pivot]];
      const denominator = matrix[pivot][pivot];
      matrix[pivot] = matrix[pivot].map(value => value.div(denominator));
      for (let i = 0; i < n; i++) if (i !== pivot && !matrix[i][pivot].zero) {
        const factor = matrix[i][pivot];
        matrix[i] = matrix[i].map((value, j) => value.sub(factor.mul(matrix[pivot][j])));
      }
    }
    return matrix.map(row => row.slice(n, n + columns));
  }
  const probabilities = gaussian(R);
  // M_t = H_t + Q M_t: every actual trial adds one to its eventual terminal reward.
  const timeMasses = gaussian(probabilities);
  return new Map(absorbing.map(({ node }, i) => [[node.mask, node.h, node.v, node.reason, iid ? 0 : node.q].join(':'),
    { probability: probabilities[ti.get(0)][i], timeMass: timeMasses[ti.get(0)][i] }]));
}

test('generic exact law and terminal-weighted E[A/N] match a full one-step Markov oracle', () => {
  for (const controller of [...fixtures, { id: 'iid-fair', probabilityH: .5 }]) for (const boundary of ['open', 'periodic']) {
    const expected = new Map();
    for (const flip of controller.probabilityH === .5 ? [0] : [0, 1]) for (const [key, item] of oracle(controller, boundary, flip)) {
      const weight = controller.probabilityH === .5 ? ONE : HALF, previous = expected.get(key) ?? { probability: ZERO, timeMass: ZERO };
      expected.set(key, { probability: previous.probability.add(item.probability.mul(weight)), timeMass: previous.timeMass.add(item.timeMass.mul(weight)) });
    }
    const result = exactFinite({ L: 2, k: 2, controller, boundary });
    let totalAttempts = ZERO, cost = ZERO;
    for (const item of result.distribution) {
      const target = expected.get(jsonKey(item)); assert.ok(target, 'Independent oracle has terminal outcome');
      assert.deepEqual(item.probability, target.probability.toJSON());
      assert.deepEqual(item.attemptFirstMomentMass, target.timeMass.toJSON());
      totalAttempts = totalAttempts.add(target.timeMass);
      cost = cost.add(target.timeMass.div(f(item.horizontal + item.vertical)));
      expected.delete(jsonKey(item));
    }
    assert.ok([...expected.values()].every(item => item.probability.zero));
    assert.deepEqual(result.metrics.expectedTerminalAttempts, totalAttempts.toJSON());
    assert.deepEqual(result.metrics.expectedAttemptsPerParticle, cost.toJSON());
  }
});

test('selected L=3 references and exact fair global symmetry are preserved', () => {
  const alternate = exactFinite({ L: 3, k: 2, controller: fixtures[1] });
  assert.equal(alternate.metrics.coverage.numerator, '21304'); assert.equal(alternate.metrics.coverage.denominator, '24219');
  const fair = exactFinite({ L: 3, k: 2, controller: { id: 'iid-fair', probabilityH: .5 } });
  assert.equal(fair.metrics.coverage.numerator, '48'); assert.equal(fair.metrics.coverage.denominator, '55');
  for (const controller of fixtures) {
    const answer = exactFinite({ L: 3, k: 2, controller });
    assert.equal(answer.metrics.order.numerator, '0');
    assert.ok(answer.metrics.expectedTerminalAttempts.value >= answer.metrics.particleCount.value);
    assert.ok(answer.metrics.expectedAttemptsPerParticle.value >= 1);
  }
});

test('weighted kinetic expectation is a mean of per-run ratios, not a ratio of means', () => {
  const answer = exactFinite({ L: 2, k: 2, controller: fixtures[4] });
  assert.equal(answer.metrics.expectedTerminalAttempts.value, 2);
  assert.equal(answer.metrics.particleCount.value, 1.5);
  assert.equal(answer.metrics.expectedAttemptsPerParticle.value, 1.5);
  assert.notEqual(answer.metrics.expectedAttemptsPerParticle.value, answer.metrics.expectedTerminalAttempts.value / answer.metrics.particleCount.value);
});
