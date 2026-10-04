/** Deterministic two-state Moore controllers. H=0, V=1; failure=0, success=1. */
export function decodeController(id) {
  if (!Number.isInteger(id) || id < 0 || id > 63) throw new RangeError('Controller ID must be an integer in [0,63]');
  return {
    id,
    outputs: [(id >>> 4) & 1, (id >>> 5) & 1],
    transitions: [[id & 1, (id >>> 1) & 1], [(id >>> 2) & 1, (id >>> 3) & 1]],
    initial: 0,
  };
}

export function allControllers() { return Array.from({ length: 64 }, (_, id) => decodeController(id)); }

export function validateController(controller) {
  const { outputs, transitions, initial = 0 } = controller;
  if (!Array.isArray(outputs) || !outputs.length || outputs.some(x => x !== 0 && x !== 1)) throw new TypeError('Invalid orientation outputs');
  if (!Array.isArray(transitions) || transitions.length !== outputs.length || transitions.some(row => !Array.isArray(row) || row.length !== 2 || row.some(q => !Number.isInteger(q) || q < 0 || q >= outputs.length))) throw new TypeError('Invalid failure/success transition table');
  if (!Number.isInteger(initial) || initial < 0 || initial >= outputs.length) throw new TypeError('Invalid initial state');
  return controller;
}

/**
 * Rooted behavioural equivalence, not graph appearance: remove unreachable
 * states, minimize the output-labelled deterministic automaton, then number
 * states by BFS from its initial state (failure edge before success edge).
 * Exchange H and V only when explicitly requested.
 */
export function canonicalKey(controller, { exchangeOrientations = false } = {}) {
  validateController(controller);
  const encode = exchange => {
    const reachable = [];
    const seen = new Set([controller.initial ?? 0]);
    const queue = [controller.initial ?? 0];
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      reachable.push(q);
      for (const next of controller.transitions[q]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    let blocks = new Map(reachable.map(q => [q, controller.outputs[q] ^ exchange]));
    while (true) {
      const labels = new Map();
      const nextBlocks = new Map();
      for (const q of reachable) {
        const signature = JSON.stringify([controller.outputs[q] ^ exchange, ...controller.transitions[q].map(next => blocks.get(next))]);
        if (!labels.has(signature)) labels.set(signature, labels.size);
        nextBlocks.set(q, labels.get(signature));
      }
      // Partition stability must be checked by equality relations, because
      // the arbitrary integer labels themselves may have been renumbered.
      const stable = reachable.every(a => reachable.every(b => (blocks.get(a) === blocks.get(b)) === (nextBlocks.get(a) === nextBlocks.get(b))));
      blocks = nextBlocks;
      if (stable) break;
    }
    const representatives = new Map();
    for (const q of reachable) if (!representatives.has(blocks.get(q))) representatives.set(blocks.get(q), q);
    const rootBlock = blocks.get(controller.initial ?? 0);
    const order = [rootBlock];
    const indices = new Map([[rootBlock, 0]]);
    const rows = [];
    for (let i = 0; i < order.length; i++) {
      const q = representatives.get(order[i]);
      const nextIndices = controller.transitions[q].map(next => {
        const block = blocks.get(next);
        if (!indices.has(block)) { indices.set(block, indices.size); order.push(block); }
        return indices.get(block);
      });
      rows.push([controller.outputs[q] ^ exchange, ...nextIndices]);
    }
    return JSON.stringify(rows);
  };
  const original = encode(0);
  return exchangeOrientations ? [original, encode(1)].sort()[0] : original;
}

export function reachableStates(controller) {
  validateController(controller);
  const reached = new Set([controller.initial ?? 0]);
  for (const q of reached) for (const next of controller.transitions[q]) reached.add(next);
  return [...reached].sort((a, b) => a - b);
}

/** All-failure cycle reached from q; its orientations determine exact deadlock. */
export function failureCycle(controller, q = controller.initial ?? 0) {
  validateController(controller);
  const walk = [];
  const first = new Map();
  while (!first.has(q)) { first.set(q, walk.length); walk.push(q); q = controller.transitions[q][0]; }
  return { prefix: walk.slice(0, first.get(q)), cycle: walk.slice(first.get(q)) };
}

export function classifyControllers() {
  const oriented = new Map();
  const rotationEquivalent = new Map();
  const records = allControllers().map(controller => {
    const key = canonicalKey(controller);
    const exchangedKey = canonicalKey(controller, { exchangeOrientations: true });
    if (!oriented.has(key)) oriented.set(key, []);
    if (!rotationEquivalent.has(exchangedKey)) rotationEquivalent.set(exchangedKey, []);
    oriented.get(key).push(controller.id);
    rotationEquivalent.get(exchangedKey).push(controller.id);
    const reachable = reachableStates(controller);
    const cycles = reachable.map(q => failureCycle(controller, q).cycle);
    return {
      ...controller, canonicalKey: key, exchangeCanonicalKey: exchangedKey, reachableStates: reachable,
      universallyFailureFair: cycles.every(cycle => new Set(cycle.map(q => controller.outputs[q])).size === 2),
      failureCycles: cycles,
    };
  });
  return {
    encoding: 'id = transitionBits + 16 * orientationBits; bit (4+q) is g(q), bit (2*q+y) is f(q,y), y=0 failure / 1 success; initial q=0',
    equivalence: 'All finite binary feedback words from the fixed initial state; optional H/V exchange is a separate quotient.',
    total: 64, orientedClassCount: oriented.size, exchangeClassCount: rotationEquivalent.size,
    orientedClasses: [...oriented].map(([key, ids]) => ({ key, ids, representative: ids[0] })),
    exchangeClasses: [...rotationEquivalent].map(([key, ids]) => ({ key, ids, representative: ids[0] })),
    records,
  };
}
