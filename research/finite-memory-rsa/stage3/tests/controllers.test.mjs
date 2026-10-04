import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeController, decodeLabelledController, labelledControllerCount,
  enumerateClassification, enumerateCanonicalAccessible, accessibleGraphCount,
  failureCycleCertificate, isBehaviorallyMinimal, temporalMinimalSequenceCount } from '../src/controllers.mjs';

function outputWord(controller, outcomes) {
  let state = controller.initial ?? 0;
  const actions = [controller.outputs[state]];
  for (const outcome of outcomes) { state = controller.transitions[state][outcome]; actions.push(controller.outputs[state]); }
  return actions;
}

test('labelled cardinalities are exactly the specified feedback and temporal spaces', () => {
  assert.equal(labelledControllerCount(4), 1048576);
  assert.equal(labelledControllerCount(4, true), 4096);
  assert.equal(labelledControllerCount(2), 64);
  assert.equal(labelledControllerCount(1), 2);
});

test('reachable removal, Moore minimization, state relabelling and global exchange are all respected', () => {
  const c = { outputs: [0, 1, 1, 0], transitions: [[1, 2], [0, 0], [0, 0], [3, 3]], initial: 0 };
  const minimized = canonicalizeController(c);
  assert.equal(minimized.reachableStateCount, 3);
  assert.equal(minimized.removedUnreachableStates, 1);
  assert.equal(minimized.mergedReachableStates, 1);
  assert.equal(minimized.minimalStateCount, 2);
  assert.deepEqual(minimized.outputs, [0, 1]);
  assert.deepEqual(minimized.transitions, [[1, 1], [0, 0]]);
  assert.equal(minimized.temporalEquivalent, true);
  const perm = [2, 3, 1, 0];
  const shifted = { outputs: new Array(4), transitions: new Array(4), initial: perm[0] };
  for (let q = 0; q < 4; q++) { shifted.outputs[perm[q]] = c.outputs[q] ^ 1; shifted.transitions[perm[q]] = c.transitions[q].map(t => perm[t]); }
  assert.equal(canonicalizeController(shifted).key, minimized.key);
});

test('distinct targets in the original graph can still be outcome-blind after behavioral minimization', () => {
  const c = canonicalizeController({ outputs: [0, 1, 1], transitions: [[1, 2], [0, 0], [0, 0]], initial: 0 });
  assert.equal(c.temporalEquivalent, true);
  const sensitive = canonicalizeController({ outputs: [0, 1], transitions: [[0, 1], [0, 1]], initial: 0 });
  assert.equal(sensitive.temporalEquivalent, false);
});

test('every outcome word preserves observable behavior up to the one global H/V exchange', () => {
  for (let index = 0; index < 5832; index += 37) {
    const c = decodeLabelledController(index, 3);
    const minimized = canonicalizeController(c);
    for (let mask = 0; mask < 256; mask++) {
      const outcomes = Array.from({ length: 8 }, (_, j) => (mask >> j) & 1);
      assert.deepEqual(outputWord(c, outcomes).map(action => action ^ c.outputs[c.initial]), outputWord(minimized, outcomes));
    }
  }
});

test('liveness inspects all outcome-reachable failure cycles, including success-only access', () => {
  const unsafe = { outputs: [0, 1, 0], transitions: [[1, 2], [0, 0], [2, 2]], initial: 0 };
  const report = failureCycleCertificate(unsafe);
  assert.equal(report.universalLiveness, false);
  assert.deepEqual(report.deadlockCertificates.map(c => c.failureCycle), [[2]]);
  const unreachable = { outputs: [0, 1, 0], transitions: [[1, 1], [0, 0], [2, 2]], initial: 0 };
  assert.equal(failureCycleCertificate(unreachable).universalLiveness, true);
  assert.equal(canonicalizeController(unreachable).universalLiveness, true);
  assert.equal(canonicalizeController({ outputs: [0], transitions: [[0, 0]], initial: 0 }).universalLiveness, false);
});

test('independent BFS graph generation agrees with labelled minimization and combinatorial recurrence through three states', () => {
  for (const temporal of [false, true]) for (const stateCount of [1, 2, 3]) {
    const labelled = enumerateClassification({ stateCount, temporal });
    const independent = enumerateCanonicalAccessible(stateCount, { temporal });
    const exact = labelled.classes.filter(c => c.minimalStateCount === stateCount);
    assert.equal(exact.length, independent.minimalCount);
    assert.deepEqual(new Set(exact.map(c => c.key)), independent.keys);
    assert.equal(BigInt(independent.topologyCount), BigInt(accessibleGraphCount(stateCount, { temporal }).canonicalAccessibleTopologies));
    assert.equal(labelled.classes.reduce((sum, c) => sum + c.labelledMultiplicity, 0), labelled.labelledCount);
    assert.ok(labelled.classes.every(c => c.labelledRootHorizontal === c.labelledRootVertical));
  }
  assert.equal(enumerateClassification({ stateCount: 2 }).classCount, 13);
});

test('temporal class catalogue exactly equals the outcome-blind subset of feedback classes', () => {
  const feedback = enumerateClassification({ stateCount: 3 });
  const temporal = enumerateClassification({ stateCount: 3, temporal: true });
  assert.deepEqual(new Set(feedback.classes.filter(c => c.temporalEquivalent).map(c => c.key)), new Set(temporal.classes.map(c => c.key)));
});

test('pair-distinguishability independently agrees with Moore refinement on every labelled three-state machine', () => {
  for (let index = 0; index < labelledControllerCount(3); index++) {
    const raw = decodeLabelledController(index, 3);
    const c = canonicalizeController(raw);
    if (c.reachableStateCount === 3) assert.equal(isBehaviorallyMinimal(raw), c.minimalStateCount === 3);
  }
});

test('decode and normalization reject malformed policies, illegal indices and unsupported budgets', () => {
  assert.throws(() => decodeLabelledController(1048576, 4), RangeError);
  assert.throws(() => labelledControllerCount(5), RangeError);
  assert.throws(() => canonicalizeController({ outputs: [0], transitions: [[0, 1]], initial: 0 }), RangeError);
  assert.throws(() => canonicalizeController({ outputs: [2], transitions: [[0, 0]], initial: 0 }), RangeError);
});

test('independent ultimately-periodic word formula gives exact temporal hierarchy and live counts', () => {
  assert.deepEqual([1, 2, 3, 4].map(n => Number(temporalMinimalSequenceCount(n).minimalClasses)), [1, 2, 6, 15]);
  assert.deepEqual([1, 2, 3, 4].map(n => Number(temporalMinimalSequenceCount(n).liveMinimalClasses)), [0, 1, 4, 11]);
  for (const n of [1, 2, 3, 4]) {
    const independent = enumerateCanonicalAccessible(n, { temporal: true });
    assert.equal(BigInt(temporalMinimalSequenceCount(n).minimalClasses), BigInt(independent.minimalCount));
  }
});
