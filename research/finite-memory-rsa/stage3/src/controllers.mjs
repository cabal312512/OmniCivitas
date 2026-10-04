/** Deterministic rooted Moore controllers. Outcome index 0=F, 1=S; action 0=H, 1=V. */
export const OUTCOME_FAILURE = 0;
export const OUTCOME_SUCCESS = 1;
export const ACTION_HORIZONTAL = 0;
export const ACTION_VERTICAL = 1;

export function validateController(controller) {
  if (!controller || !Array.isArray(controller.outputs) || !controller.outputs.length ||
      !Array.isArray(controller.transitions) || controller.transitions.length !== controller.outputs.length) {
    throw new TypeError('Controller requires equally sized nonempty outputs and transitions arrays');
  }
  const n = controller.outputs.length;
  const initial = controller.initial ?? 0;
  if (!Number.isInteger(initial) || initial < 0 || initial >= n) throw new RangeError('Invalid initial state');
  for (let q = 0; q < n; q++) {
    if (controller.outputs[q] !== 0 && controller.outputs[q] !== 1) throw new RangeError('Actions must be 0=H or 1=V');
    const row = controller.transitions[q];
    if (!Array.isArray(row) || row.length !== 2 || row.some(t => !Number.isInteger(t) || t < 0 || t >= n)) {
      throw new RangeError('Each transition row must contain legal targets [F,S]');
    }
  }
  return initial;
}

function canonicalCore(outputs, transitions, initial) {
  // Reachability is outcome-word reachability, not empirical reachability in one RSA geometry.
  const reachable = [initial];
  const seen = new Set(reachable);
  for (let i = 0; i < reachable.length; i++) {
    for (const target of transitions[reachable[i]]) if (!seen.has(target)) {
      seen.add(target); reachable.push(target);
    }
  }
  const n = reachable.length;
  let blocks = reachable.map(q => outputs[q]);
  while (true) {
    const signatures = new Map();
    const refined = reachable.map(q => {
      const signature = `${outputs[q]}:${blocks[reachable.indexOf(transitions[q][0])]}:${blocks[reachable.indexOf(transitions[q][1])]}`;
      if (!signatures.has(signature)) signatures.set(signature, signatures.size);
      return signatures.get(signature);
    });
    if (refined.every((block, i) => block === blocks[i])) break;
    blocks = refined;
  }
  const rootBlock = blocks[0];
  const queue = [rootBlock];
  const canonicalNumbers = new Map([[rootBlock, 0]]);
  const representatives = [];
  for (let i = 0; i < n; i++) if (representatives[blocks[i]] === undefined) representatives[blocks[i]] = reachable[i];
  const canonicalOutputs = [];
  const canonicalTransitions = [];
  const exchange = outputs[initial];
  for (let i = 0; i < queue.length; i++) {
    const q = representatives[queue[i]];
    canonicalOutputs.push(outputs[q] ^ exchange);
    canonicalTransitions.push(transitions[q].map(target => {
      const block = blocks[reachable.indexOf(target)];
      if (!canonicalNumbers.has(block)) { canonicalNumbers.set(block, queue.length); queue.push(block); }
      return canonicalNumbers.get(block);
    }));
  }
  const key = `${queue.length}:${canonicalOutputs.join('')}:${canonicalTransitions.flat().join(',')}`;
  return { outputs: canonicalOutputs, transitions: canonicalTransitions, initial: 0,
    minimalStateCount: queue.length, reachableStateCount: n, removedUnreachableStates: outputs.length - n,
    mergedReachableStates: n - queue.length, orientationExchanged: exchange === 1, key };
}

export function failureCycleCertificate(controller) {
  const initial = validateController(controller);
  const reachable = new Set([initial]);
  const reachableQueue = [initial];
  for (let i = 0; i < reachableQueue.length; i++) for (const target of controller.transitions[reachableQueue[i]]) {
    if (!reachable.has(target)) { reachable.add(target); reachableQueue.push(target); }
  }
  const cycles = [];
  const completed = new Set();
  for (const start of reachableQueue) {
    if (completed.has(start)) continue;
    const path = [];
    const indices = new Map();
    let q = start;
    while (!completed.has(q) && !indices.has(q)) {
      indices.set(q, path.length); path.push(q); q = controller.transitions[q][0];
    }
    if (indices.has(q)) {
      const states = path.slice(indices.get(q));
      const actions = [...new Set(states.map(state => controller.outputs[state]))].sort();
      const minimum = Math.min(...states);
      const rotateAt = states.indexOf(minimum);
      cycles.push({ states: [...states.slice(rotateAt), ...states.slice(0, rotateAt)], actions,
        mixedActions: actions.length === 2 });
    }
    for (const state of path) completed.add(state);
  }
  cycles.sort((a, b) => a.states[0] - b.states[0]);
  return { universalLiveness: cycles.every(cycle => cycle.mixedActions), failureCycles: cycles,
    deadlockCertificates: cycles.filter(cycle => !cycle.mixedActions).map(cycle => ({
      failureCycle: cycle.states, permanentlyAttemptedAction: cycle.actions[0],
      unattemptedLegalAction: 1 - cycle.actions[0],
      scope: 'Abstract frozen geometry with attempted action illegal and the other action legal; not a claim that every RSA size reaches this geometry'
    })) };
}

function factorial(n) { let value = 1n; for (let i = 2; i <= n; i++) value *= BigInt(i); return value; }
function choose(n, k) { let value = 1n; for (let i = 1; i <= k; i++) value = value * BigInt(n - i + 1) / BigInt(i); return value; }

/** Combinatorial recurrence for rooted accessible transition graphs; independent of minimization/code enumeration. */
export function accessibleGraphCount(stateCount, { temporal = false } = {}) {
  labelledControllerCount(stateCount, temporal);
  const alphabet = temporal ? 1 : 2;
  const accessible = [0n];
  for (let n = 1; n <= stateCount; n++) {
    let count = BigInt(n) ** BigInt(alphabet * n);
    for (let r = 1; r < n; r++) count -= choose(n - 1, r - 1) * accessible[r] * BigInt(n) ** BigInt(alphabet * (n - r));
    accessible[n] = count;
  }
  return { rootedLabelledTransitionGraphs: accessible[stateCount].toString(),
    canonicalAccessibleTopologies: (accessible[stateCount] / factorial(stateCount - 1)).toString(),
    rootedStateRelabellingsPerAccessibleGraph: factorial(stateCount - 1).toString() };
}

/** Closed-form sequence count for temporal classes, independently of any graph enumeration. */
export function temporalMinimalSequenceCount(stateCount) {
  labelledControllerCount(stateCount, true);
  const primitive = [0n];
  for (let period = 1; period <= stateCount; period++) {
    let count = 2n ** BigInt(period);
    for (let divisor = 1; divisor < period; divisor++) if (period % divisor === 0) count -= primitive[divisor];
    primitive[period] = count;
  }
  let orientationLabelled = primitive[stateCount];
  for (let period = 1; period < stateCount; period++) orientationLabelled += 2n ** BigInt(stateCount - period - 1) * primitive[period];
  const minimalClasses = orientationLabelled / 2n;
  const nonlive = stateCount === 1 ? 1n : 2n ** BigInt(stateCount - 2);
  return { minimalClasses: minimalClasses.toString(), liveMinimalClasses: (minimalClasses - nonlive).toString(),
    primitiveBinaryPeriodWords: primitive[stateCount].toString() };
}

export function canonicalizeController(controller) {
  const initial = validateController(controller);
  const canonical = canonicalCore(controller.outputs, controller.transitions, initial);
  return { ...canonical,
    temporalEquivalent: canonical.transitions.every(([f, s]) => f === s),
    constantAction: canonical.minimalStateCount === 1,
    ...failureCycleCertificate(canonical) };
}

export function labelledControllerCount(stateCount = 4, temporal = false) {
  if (!Number.isInteger(stateCount) || stateCount < 1 || stateCount > 4) throw new RangeError('Supported state count is 1..4');
  return 2 ** stateCount * stateCount ** (stateCount * (temporal ? 1 : 2));
}

export function decodeLabelledController(index, stateCount = 4, { temporal = false } = {}) {
  const count = labelledControllerCount(stateCount, temporal);
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Labelled index is outside enumeration');
  const outputMask = index % (2 ** stateCount);
  let digits = Math.floor(index / (2 ** stateCount));
  const outputs = Array.from({ length: stateCount }, (_, q) => (outputMask >> q) & 1);
  const transitions = [];
  for (let q = 0; q < stateCount; q++) {
    const failure = digits % stateCount; digits = Math.floor(digits / stateCount);
    const success = temporal ? failure : digits % stateCount;
    if (!temporal) digits = Math.floor(digits / stateCount);
    transitions.push([failure, success]);
  }
  return { outputs, transitions, initial: 0 };
}

/** Independent Moore pair-distinguishability table, not partition-refinement minimization. */
export function isBehaviorallyMinimal(controller) {
  validateController(controller);
  const n = controller.outputs.length;
  const marked = new Set();
  const pair = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    if (controller.outputs[a] !== controller.outputs[b]) marked.add(pair(a, b));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      if (marked.has(pair(a, b))) continue;
      if ([0, 1].some(outcome => {
        const targetA = controller.transitions[a][outcome], targetB = controller.transitions[b][outcome];
        return targetA !== targetB && marked.has(pair(targetA, targetB));
      })) { marked.add(pair(a, b)); changed = true; }
    }
  }
  return marked.size === n * (n - 1) / 2;
}

/** Independent generation: rooted BFS restricted-growth graphs, without enumerating labelled n-state machines. */
export function enumerateCanonicalAccessible(stateCount, { temporal = false } = {}) {
  labelledControllerCount(stateCount, temporal);
  const edgesPerState = temporal ? 1 : 2;
  const edges = new Array(edgesPerState * stateCount).fill(0);
  let topologyCount = 0;
  let accessibleOutputAssignments = 0;
  let minimalCount = 0;
  let liveMinimalCount = 0;
  const minimalKeys = new Set();
  const explore = (position, discovered) => {
    const source = Math.floor(position / edgesPerState);
    if (position === edges.length) {
      if (discovered !== stateCount) return;
      topologyCount++;
      const transitions = Array.from({ length: stateCount }, (_, q) => temporal ?
        [edges[q], edges[q]] : [edges[2 * q], edges[2 * q + 1]]);
      for (let mask = 0; mask < 2 ** (stateCount - 1); mask++) {
        accessibleOutputAssignments++;
        const outputs = Array.from({ length: stateCount }, (_, q) => q ? (mask >> (q - 1)) & 1 : 0);
        const canonical = { outputs, transitions, initial: 0,
          key: `${stateCount}:${outputs.join('')}:${transitions.flat().join(',')}` };
        if (!isBehaviorallyMinimal(canonical)) continue;
        if (minimalKeys.has(canonical.key)) throw new Error('Restricted-growth generation repeated a minimal class');
        minimalKeys.add(canonical.key); minimalCount++;
        if (failureCycleCertificate(canonical).universalLiveness) liveMinimalCount++;
      }
      return;
    }
    // A source cannot have outgoing edges before rooted BFS has discovered it.
    if (source >= discovered) return;
    const largestTarget = Math.min(discovered, stateCount - 1);
    for (let target = 0; target <= largestTarget; target++) {
      edges[position] = target;
      explore(position + 1, discovered + (target === discovered ? 1 : 0));
    }
  };
  explore(0, 1);
  return { stateCount, temporal, topologyCount, accessibleOutputAssignments, minimalCount, liveMinimalCount,
    keys: minimalKeys };
}

export function enumerateClassification({ stateCount = 4, temporal = false, progress } = {}) {
  const count = labelledControllerCount(stateCount, temporal);
  const catalog = new Map();
  const mapping = new Uint32Array(count);
  const degeneracy = { unreachable: 0, mergedReachable: 0, constantAction: 0, temporalEquivalent: 0, universalLiveness: 0 };
  for (let index = 0; index < count; index++) {
    const decoded = decodeLabelledController(index, stateCount, { temporal });
    const c = canonicalCore(decoded.outputs, decoded.transitions, 0);
    let entry = catalog.get(c.key);
    if (!entry) {
      const certificate = failureCycleCertificate(c);
      entry = { id: catalog.size, key: c.key, outputs: c.outputs, transitions: c.transitions, initial: 0,
        minimalStateCount: c.minimalStateCount, temporalEquivalent: c.transitions.every(([f, s]) => f === s),
        constantAction: c.minimalStateCount === 1, ...certificate,
        labelledMultiplicity: 0, firstLabelledRepresentative: index,
        labelledRootHorizontal: 0, labelledRootVertical: 0 };
      catalog.set(c.key, entry);
    }
    entry.labelledMultiplicity++;
    entry[decoded.outputs[0] === 0 ? 'labelledRootHorizontal' : 'labelledRootVertical']++;
    mapping[index] = entry.id;
    if (c.removedUnreachableStates) degeneracy.unreachable++;
    if (c.mergedReachableStates) degeneracy.mergedReachable++;
    if (entry.constantAction) degeneracy.constantAction++;
    if (entry.temporalEquivalent) degeneracy.temporalEquivalent++;
    if (entry.universalLiveness) degeneracy.universalLiveness++;
    if (progress && index % 131072 === 0) progress({ done: index, total: count, classCount: catalog.size });
  }
  const classes = [...catalog.values()].sort((a, b) => a.minimalStateCount - b.minimalStateCount || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const oldIds = new Map();
  for (let id = 0; id < classes.length; id++) {
    const entry = classes[id]; oldIds.set(entry.id, id); entry.id = id;
    entry.classId = `${temporal ? 'temporal' : 'feedback'}-${stateCount}-${String(id).padStart(5, '0')}`;
  }
  for (let i = 0; i < mapping.length; i++) mapping[i] = oldIds.get(mapping[i]);
  const byMinimalStates = [];
  for (let minimalStateCount = 1; minimalStateCount <= stateCount; minimalStateCount++) {
    const selected = classes.filter(entry => entry.minimalStateCount === minimalStateCount);
    byMinimalStates.push({ minimalStateCount, classes: selected.length,
      universalLiveClasses: selected.filter(entry => entry.universalLiveness).length,
      temporalEquivalentClasses: selected.filter(entry => entry.temporalEquivalent).length,
      labelledMultiplicity: selected.reduce((sum, entry) => sum + entry.labelledMultiplicity, 0) });
  }
  return { schemaVersion: 1, stateCount, temporal, labelledCount: count, classCount: classes.length,
    universalLiveClassCount: classes.filter(entry => entry.universalLiveness).length,
    temporalEquivalentClassCount: classes.filter(entry => entry.temporalEquivalent).length,
    actionEncoding: ['H', 'V'], outcomeEncoding: ['F', 'S'], initial: 0,
    canonicalConvention: 'Reachable Moore minimization; root H by global H/V exchange; BFS failure then success',
    degeneracy, byMinimalStates, classes, mapping };
}
