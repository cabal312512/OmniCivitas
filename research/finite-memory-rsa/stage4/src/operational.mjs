import crypto from 'node:crypto';
import { canonicalizeController, validateController } from '../../stage3/src/controllers.mjs';

export function universalOperational(controller) {
  const initial = validateController(controller), firstAction = controller.outputs[initial];
  const afterSuccess = controller.transitions[initial][1];
  const suffix = canonicalizeController({ ...controller, initial: afterSuccess });
  const outputs = suffix.outputs.map(action => action ^ Number(suffix.orientationExchanged));
  const transitions = suffix.transitions;
  const reusable = outputs.flatMap((action, q) => action === firstAction && transitions[q][1] === 0 ? [q] : []);
  const key = `${firstAction}|${outputs.length}:${outputs.join('')}:${transitions.flat().join(',')}`;
  const realization = { outputs: [...outputs], transitions: transitions.map(row => [...row]), initial: reusable[0] ?? outputs.length };
  if (!reusable.length) { realization.outputs.push(firstAction); realization.transitions.push([0, 0]); }
  return { key, firstAction, continuation: { outputs, transitions, initial: 0 },
    continuationStates: outputs.length, initialReusableStates: reusable,
    minimalDeterministicOperationalStates: outputs.length + Number(!reusable.length), realization };
}

export function geometry({ L, k, boundary = 'periodic' }) {
  if (!Number.isInteger(L) || !Number.isInteger(k) || k < 1 || L < k || L > 12 || !['periodic','open'].includes(boundary)) throw new RangeError('Witness geometry: 1<=k<=L<=12');
  const placements = [[], []];
  for (let a = 0; a < 2; a++) for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    if (boundary === 'open' && (a ? y : x) + k > L) continue;
    let mask = 0n;
    for (let j = 0; j < k; j++) mask |= 1n << BigInt(((y + (a ? j : 0)) % L) * L + (x + (a ? 0 : j)) % L);
    placements[a].push(mask);
  }
  return { L, k, boundary, placements, M: placements[0].length };
}
const jammed = (mask, placements) => placements.every(row => row.every(p => (p & mask) !== 0n));

/** Complete finite physical trace automaton, with uniformly labelled anchor events. */
export function physicalMachine(controller, parameters) {
  const initial = validateController(controller), { placements, M } = geometry(parameters);
  const nodes = [], seen = new Map();
  const get = (mask, q) => {
    if (jammed(mask, placements)) q = -1;
    const key = `${mask}:${q}`;
    if (!seen.has(key)) { seen.set(key, nodes.length); nodes.push({ mask, q }); }
    return seen.get(key);
  };
  get(0n, initial);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.output = `${node.mask}:${node.q < 0 ? 'J' : controller.outputs[node.q]}`;
    node.targets = node.q < 0 ? Array(M).fill(i) : placements[controller.outputs[node.q]].map(p => {
      const success = (p & node.mask) === 0n;
      return get(success ? node.mask | p : node.mask, controller.transitions[node.q][Number(success)]);
    });
  }
  let colors = [], initialColors = new Map();
  for (const node of nodes) {
    if (!initialColors.has(node.output)) initialColors.set(node.output, initialColors.size);
    colors.push(initialColors.get(node.output));
  }
  let rounds = 0;
  while (true) {
    const ids = new Map(), next = nodes.map(node => {
      const key = `${node.output}|${node.targets.map(i => colors[i]).join(',')}`;
      if (!ids.has(key)) ids.set(key, ids.size);
      return ids.get(key);
    }); rounds++;
    if (next.every((x, i) => x === colors[i])) break;
    colors = next;
  }
  const representatives = new Map();
  nodes.forEach((node, i) => { if (!representatives.has(colors[i])) representatives.set(colors[i], node); });
  const queue = [colors[0]], names = new Map([[colors[0], 0]]), canonical = [];
  for (let i = 0; i < queue.length; i++) {
    const node = representatives.get(queue[i]);
    const targets = node.targets.map(target => {
      const color = colors[target];
      if (!names.has(color)) { names.set(color, queue.length); queue.push(color); }
      return names.get(color);
    });
    canonical.push([node.output, targets]);
  }
  const encoding = JSON.stringify(canonical);
  return { sha256: crypto.createHash('sha256').update(encoding).digest('hex'),
    encoding, reachableProductStates: nodes.length, minimizedProductStates: canonical.length, rounds };
}

/** Same full physical trace law iff no reachable output mismatch; no mean comparisons. */
export function distinguishingWitness(first, second, parameters, { nodeLimit = 250000 } = {}) {
  const g = geometry(parameters), initialA = validateController(first), initialB = validateController(second);
  const queue = [{ mask: 0n, a: initialA, b: initialB, parent: -1 }], seen = new Set([`0:${initialA}:${initialB}`]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor];
    if (jammed(node.mask, g.placements)) continue;
    if (first.outputs[node.a] !== second.outputs[node.b]) {
      const history = []; let index = cursor;
      while (queue[index].parent >= 0) {
        const row = queue[index]; history.push({ action: row.action, anchorIndex: row.anchor,
          outcome: row.success ? 'S' : 'F', occupiedAfter: row.mask.toString() }); index = row.parent;
      }
      history.reverse();
      return { status: 'distinguished', geometry: parameters, history,
        firstDifferingActions: [first.outputs[node.a], second.outputs[node.b]],
        historyProbability: { numerator: '1', denominator: (BigInt(g.M) ** BigInt(history.length)).toString() },
        exploredStates: cursor + 1, discoveredStates: queue.length };
    }
    const action = first.outputs[node.a];
    for (let anchor = 0; anchor < g.M; anchor++) {
      const p = g.placements[action][anchor], success = (p & node.mask) === 0n;
      const mask = success ? node.mask | p : node.mask;
      const a = first.transitions[node.a][Number(success)], b = second.transitions[node.b][Number(success)];
      const key = `${mask}:${a}:${b}`;
      if (seen.has(key)) continue;
      if (queue.length >= nodeLimit) return { status: 'resource-cap', geometry: parameters, nodeLimit, discoveredStates: queue.length };
      seen.add(key); queue.push({ mask, a, b, parent: cursor, action, anchor, success });
    }
  }
  return { status: 'equivalent', geometry: parameters, exploredStates: queue.length };
}

export function abstractSuffixWitness(first, second) {
  const initialA = validateController(first), initialB = validateController(second);
  if (first.outputs[initialA] !== second.outputs[initialB]) return { outcomes: [], initialActionMismatch: true };
  const queue = [{ a: first.transitions[initialA][1], b: second.transitions[initialB][1], word: ['S'] }], seen = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor], key = `${node.a}:${node.b}`;
    if (seen.has(key)) continue; seen.add(key);
    if (first.outputs[node.a] !== second.outputs[node.b]) return { outcomes: node.word, initialActionMismatch: false };
    for (let outcome = 0; outcome < 2; outcome++) queue.push({ a: first.transitions[node.a][outcome],
      b: second.transitions[node.b][outcome], word: [...node.word, outcome ? 'S' : 'F'] });
  }
  return null;
}
export function constructiveWitness(first, second, { k = 2, boundary = 'periodic' } = {}) {
  const difference = abstractSuffixWitness(first, second);
  if (!difference) return { status: 'universally-equivalent', proof: 'Same first action and arbitrary-word post-first-success continuation' };
  const successes = difference.outcomes.filter(x => x === 'S').length;
  let L = k;
  const anchors = size => boundary === 'periodic' ? size * size : size * (size - k + 1);
  while (anchors(L) <= successes * k * k) L++;
  const g = geometry({ L, k, boundary });
  let mask = 0n, a = validateController(first), b = validateController(second);
  const history = [];
  for (const outcome of difference.outcomes) {
    if (first.outputs[a] !== second.outputs[b]) throw new Error('Suffix BFS returned a nonshortest witness');
    const action = first.outputs[a], success = outcome === 'S';
    const anchor = g.placements[action].findIndex(p => ((p & mask) === 0n) === success);
    if (anchor < 0 || jammed(mask, g.placements)) throw new Error('Constructive size bound failed');
    if (success) mask |= g.placements[action][anchor];
    history.push({ action, anchorIndex: anchor, outcome, occupiedAfter: mask.toString() });
    a = first.transitions[a][Number(success)]; b = second.transitions[b][Number(success)];
  }
  if (jammed(mask, g.placements) || first.outputs[a] === second.outputs[b]) throw new Error('Witness has no exposed action difference');
  return { status: 'distinguished', geometry: { L, k, boundary }, history,
    firstDifferingActions: [first.outputs[a], second.outputs[b]],
    historyProbability: { numerator: '1', denominator: (BigInt(g.M) ** BigInt(history.length)).toString() },
    sizeBound: 'M > (#successes) k^2 leaves a legal anchor for both actions at every prefix', minimalGeometryClaimed: false };
}
