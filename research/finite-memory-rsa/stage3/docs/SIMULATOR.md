# Stage III finite-state RSA engine

The new modules are `stage3/src/simulate.mjs` and `stage3/src/exact.mjs`.
They do not alter Stage I/II sources, datasets or conclusions. They use the frozen
parent lattice, RNG and rational-arithmetic helpers. The only stochastic special
case, the zero-memory IID fair reference, delegates to the frozen
`stage2/src/stochastic.mjs` with alpha=beta=.5. Its physical sampler may retain an
orientation for bookkeeping, but its behavioral policy has no outcome memory.
No stochastic four-state transition optimization is implemented here.

## Controller contract

```js
import { simulateFinite } from './stage3/src/simulate.mjs';
import { exactFinite } from './stage3/src/exact.mjs';

const controller = {
  id: 'example',
  outputs: [0, 0, 1, 1],
  transitions: [[1, 2], [2, 3], [3, 0], [0, 1]],
  initial: 0,
};
const run = simulateFinite({ L: 64, k: 4, controller, seed: 12345 });
const exact = exactFinite({ L: 3, k: 2, controller });
```

Outputs are H=0 and V=1. Each transition row is `[failureTarget, successTarget]`.
The output is selected before its proposal outcome is known. Rooted initial state
is always zero; one through four supplied states are accepted. Outcome-blind
controllers use identical F/S targets and run through the same deterministic
engine. Catalogues supply minimized representatives; the engine does not perform
minimization or infer a scientific memory threshold from a padded input.
The result name uses `classId`, then `key`, then `id`, so catalogue namespaces
remain stable. `compileController` validates once and caches copied transition
tables/failure paths in a WeakMap. A controller object must not be mutated after
its first use.

An independent fair bit is drawn from the run's seeded RNG and XORed with every
output for the entire run. This is a fair *global H/V exchange*, with the same
rooted automaton; it is not an independent direction draw on every trial. The
IID reference is specified separately as `{id:'iid-fair', probabilityH:.5}`;
other custom orientation probabilities are rejected. All runs require an explicit
unsigned 32-bit seed. Sharing a seed pairs runs but does not imply identical
attempt tapes across distinct policies or engines.

Uniform candidate anchors are drawn conditional only on the proposed direction.
Periodic anchors retain their geometric multiplicity. Open boundaries draw only
fully contained rods, M=L(L-k+1) anchors in each direction. The controller reads
only its state and the success/failure bit. Legal-anchor sets and geometry are
internal sampling/termination machinery, never controller inputs.

## Event law and strict termination

`engine:'direct'` samples each original candidate trial. The default `event`
engine uses the deterministic failure orbit from the current state: a transient
prefix followed by a cycle of length at most four. On the frozen lattice,
success hazard at state q is A[g(q)]/M. Prefix trials are sampled individually.
For one full cycle, let survival be R and first-success position weights be
`w_j = hazard_j * product(previous failure probabilities)`. The number of entirely
failed cycles is a geometric realization with mass 1-R; conditional first-success
position has probabilities w_j/(1-R). The chosen legal anchor is uniform.
The selected state's success transition then updates the controller.

This preserves the original discrete attempt law, including sampled actual
waiting time and direction counts. Large skipped cycles are counted without
iterating through every failed proposal. Their orientation switch/run summaries
are computed from the repeated finite pattern. No skipped waiting time is replaced
by its conditional expectation.

Geometric jam means A_H=A_V=0. Controller deadlock means legal placements remain,
but the entire deterministic future failure orbit from the current state has no
legal output. Both engines stop at the first state where this can be certified by
the external termination observer. In particular, after a live prefix trial fails,
a newly blocked suffix is recognized immediately; phantom zero-hazard suffix
attempts are not added. A prefix that can still succeed is sampled, and its
actually failed attempts are included. The infinite failed tail after certified
termination is omitted. This is an explicit observation/stopping convention,
not a claim that the controller itself observes legal counts.

There is no consecutive-failure cutoff. An optional positive integer
`maxAttempts` is supported only for direct validation; reaching it throws and
produces no terminal result. Event mode rejects that option. Unsafe integer
kinetic counts also throw rather than silently rounding or returning a terminal
record. The inherited finite-resolution RNG bounds representable remote tails;
geometric sampling is exact for the stated discrete law up to floating arithmetic
and PRNG discretization, not arbitrary-precision random sampling.

## Returned observations

`simulateFinite` accepts `boundary`, `engine`, `validate`, `trace` and `snapshot`.
Validation of dense legal sets is disabled in the main hot path. Attempt-level
traces require the direct engine. Snapshots are optional copies; lattice typed
arrays are released in `finally`, including after errors. Dense buffers use about
17 L² bytes, independent of a skipped cycle's number of attempts.

Every terminal result has actual attempts/failures (and `actual_*` aliases),
attempted/failed H/V counts, particles and accepted H/V counts, coverage, signed S,
|S|, S², S⁴, legal counts, jam/deadlock flags, final controller state, initialization
bit, elapsed milliseconds and `kinetic_kind:'sampled-actual'`.
`attempts_per_accepted` is the individual run's A/N. Accepted and proposal-level
adjacent orientation switches, run counts, mean/max run lengths are distinct.
The final controller state update after a success is a controller transition,
but contributes no fictitious proposal pair. State changes and orientation
switches are not interchangeable. For fewer than two observations, pair fractions
are null. The IID reference has behavioral memory zero and a null controller
state; its frozen implementation may expose additional sampler diagnostics.

## Exact rational reference and kinetic reward

`exactFinite`, also exported as `exactTerminal`, accepts the same deterministic
controller or IID fair reference. Geometry is limited to 1<=k<=L<=3 by the frozen
parent placement enumerator. All probabilities and moments use BigInt fractions;
the JSON shape is `{numerator, denominator, value}`, with `value` a presentation
float. A memoized occupancy/state recursion sums the complete failure-cycle
geometric series and the two global orientation exchanges exactly.

Metrics include coverage and its square/variance, signed order, absolute order,
order square/fourth moment, particle count, jam/deadlock probability and:

- `expectedTerminalAttempts`: E[A] before the explicit termination convention.
- `expectedFailures`: E[A-N].
- `expectedAttemptsPerParticle`: E[A/N].
- `expectedFailuresPerParticle`: E[(A-N)/N].

The mean of ratios is computed by retaining each terminal outcome's weighted
first attempt moment, E[A·1_terminal]. Each successor combines its own weighted
episode duration with the child's weighted remaining duration. The full terminal
law then divides each such moment by that outcome's terminal N before summing.
It never substitutes E[A]/E[N]. A concrete test has E[A]=2, E[N]=1.5 but
E[A/N]=1.5, whereas the ratio of means is 4/3.

Distribution records contain the occupied mask, H/V counts, terminal reason,
final state, rational probability and `attemptFirstMomentMass`. Exact deadlock
cost omits an infinite tail; it does not mean finite time to another success after
deadlock. No thermodynamic limit, controller dominance or rare-exploration theorem
is inferred by this engine.

## Validation and measured runtime

The new tests passed **8/8** under Node v24.14.1 on Windows x64. They include a
separate original-trial absorbing Markov chain, built from independently enumerated
tiny placements and solved by rational Gaussian elimination. Its complete joint
terminal probabilities and terminal-weighted attempt rewards agree with the new
exact episode solver. Direct trajectories independently reconstruct all attempt,
failure, orientation switch and run statistics. Fixed-seed direct and event tests
agree with exact terminal/kinetic references under predeclared broad diagnostic
bounds; these are implementation checks, not research confirmation samples.
The selected L=3 periodic dimer references include alternation 21304/24219 and
IID fair 48/55; fair global exchange gives exactly zero E[S].

```sh
node --test --test-concurrency=1 stage3/tests/simulator.test.mjs stage3/tests/exact.test.mjs
```

A separate throughput benchmark sampled forty spaced universally live catalogue
representatives, without dense-set validation or snapshots. After twenty warmup
runs, measured event execution was:

| L | k | Runs | Total milliseconds |
|---:|---:|---:|---:|
| 16 | 4 | 400 | 16.45 |
| 16 | 8 | 400 | 9.85 |
| 64 | 4 | 128 | 45.55 |
| 64 | 8 | 128 | 35.50 |
| 256 | 4 | 4 | 18.01 |
| 256 | 8 | 4 | 16.27 |

Maximum observed RSS was about 172 MB, including the fully parsed 28,534-class
catalogue, not merely one lattice. These warm microbenchmark timings exclude
streaming result I/O and do not promise identical runtime for every class or host.
Machine-readable local benchmark evidence is retained separately under the
developer's runtime-report directory. No website, Docker service, Stage I/II study
reconstruction, dependency installation or cross-platform execution was performed
for these new engine checks.
