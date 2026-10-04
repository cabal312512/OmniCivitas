import test from 'node:test';
import assert from 'node:assert/strict';
import { allControllers, decodeController, canonicalKey, classifyControllers, failureCycle } from '../src/controllers.mjs';

test('all 64 encodings are unique and follow the declared failure/success bit order', () => {
  const controllers = allControllers();
  assert.equal(controllers.length, 64);
  assert.equal(new Set(controllers.map(c => JSON.stringify([c.outputs, c.transitions]))).size, 64);
  for (const c of controllers) {
    for (let q = 0; q < 2; q++) {
      assert.equal(c.outputs[q], (c.id >>> (4 + q)) & 1);
      for (let y = 0; y < 2; y++) assert.equal(c.transitions[q][y], (c.id >>> (2 * q + y)) & 1);
    }
  }
  assert.throws(() => decodeController(64), RangeError);
  assert.throws(() => decodeController(-1), RangeError);
});

test('minimal rooted automata give 26 oriented classes and 13 H/V-exchange classes', () => {
  const classes = classifyControllers();
  assert.equal(classes.orientedClassCount, 26);
  assert.equal(classes.exchangeClassCount, 13);
  assert.deepEqual(classes.orientedClasses.map(c => c.ids.length).sort((a,b) => a-b), [...Array(24).fill(1),20,20]);
  assert.deepEqual(classes.exchangeClasses.map(c => c.ids.length).sort((a,b) => a-b), [...Array(12).fill(2),40]);
  assert.deepEqual(classes.records.filter(c => c.universallyFailureFair).map(c => c.id), [17,19,25,27,33,35,41,43]);
});

test('state relabelling preserves the rooted machine, including its initial-state relabelling', () => {
  for (const c of allControllers()) {
    const relabelled = {
      outputs: [c.outputs[1],c.outputs[0]],
      transitions: [c.transitions[1].map(q => 1-q),c.transitions[0].map(q => 1-q)], initial: 1,
    };
    assert.equal(canonicalKey(c), canonicalKey(relabelled));
  }
});

test('the canonical quotient agrees with exhaustive finite feedback-word behaviour', () => {
  // The product of two two-state machines has at most four states. If their
  // output streams differ, a shortest distinguishing word visits at most
  // four product states and therefore has at most three edges. Four is safe.
  const signature = c => {
    const outputs = [];
    const walk = (q, depth) => {
      outputs.push(c.outputs[q]);
      if (depth) { walk(c.transitions[q][0], depth-1); walk(c.transitions[q][1], depth-1); }
    };
    walk(c.initial, 4); return outputs.join('');
  };
  const controllers = allControllers();
  for (const a of controllers) for (const b of controllers) assert.equal(canonicalKey(a) === canonicalKey(b), signature(a) === signature(b));
});

test('failure cycles distinguish a transient orientation from an orientation visited forever', () => {
  assert.deepEqual(failureCycle(decodeController(35)), { prefix: [], cycle: [0,1] });
  assert.deepEqual(failureCycle(decodeController(36)), { prefix: [], cycle: [0] });
  assert.deepEqual(failureCycle(decodeController(37)), { prefix: [0], cycle: [1] });
});
