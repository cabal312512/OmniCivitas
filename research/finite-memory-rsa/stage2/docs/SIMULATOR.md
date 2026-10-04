# Stochastic one-bit simulator and kinetic evidence

`src/stochastic.mjs` is new Stage II code. It imports the original `Lattice`
and `RNG` without changing either Stage I file. No package, database, container
or GPU is involved. Rod placement still uses the incremental dense legal-anchor
sets, with O(k²) invalidations per accepted rod and about 17 L² bytes of lattice
typed-array storage. At L=2048 that is approximately 68 MiB before small runtime
overhead and any requested copied snapshot.

## Model and public entry points

```js
import { simulateStochastic } from './src/stochastic.mjs';
const result = simulateStochastic({
  L: 128, k: 8, alpha: 0.05, beta: 0.95, seed: 12345,
  boundary: 'periodic', engine: 'event'
});
```

Every call requires an explicit unsigned 32-bit seed. The first orientation is
a fair H/V draw; H=0 and V=1. Each attempted candidate anchor is uniform among
the M geometrically admissible anchors for that orientation, including occupied
ones. M=L² for periodic boundaries and M=L(L−k+1) for open boundaries.
After the binary success/failure observation, the controller flips its one
orientation bit with probability alpha/beta respectively. Neither coordinates,
legal counts, occupancy, coverage, elapsed time nor attempt count enters this
controller transition. Initial direction and position do not use spatial
information. The event engine conditions spatial sampling on success inside
the simulator; it gives the controller no additional input.

The five special points are (0,1) policy-41-type feedback, (1,0) flip only after
success, (1,1) strict trial alternation, (1/2,1/2) fair i.i.d. trial orientation,
and (0,0) hold the initial direction. All use the same fair initial convention.
The diagonal alpha=beta is the outcome-independent symmetric Markov temporal
null. Event and direct engines reproduce the same probability law but consume
different pseudorandom draws, so equal seeds need not give equal configurations.

The module also exports `failureKernel(counts,M,beta,state)`,
`nextAcceptedEvent(state,counts,M,beta,rng)`, `geometricFailures(p,rng)` and
`negativeBinomialFailures(r,p,rng)` for independent verification and analysis.
The kernel reports analytical absorption probabilities and a mean waiting
time. Those analytical quantities are not fabricated observations.

## Fixed-lattice two-state kernel

Write p_o=legal_o/M and q_o=1−p_o. Success freezes the next accepted direction;
failure updates the bit and leaves the lattice unchanged. The transient
failure matrix and immediate absorption matrix are

```text
Q = [ q_H(1−beta)   q_H beta    ]     R = diag(p_H,p_V).
    [ q_V beta     q_V(1−beta) ]
```

For a live state the next-accepted kernel is (I−Q)^−1 R. Define
h_o=p_o+q_o beta and
D=p_H p_V+beta(p_H q_V+p_V q_H). This expression for D avoids subtracting
nearly equal terms when beta is small. The rows of the absorption matrix are

```text
K_H = [ p_H h_V / D,         p_V q_H beta / D ]
K_V = [ p_H q_V beta / D,    p_V h_H / D      ].
```

Expected additional trial counts, including the successful trial, are
T_H=(h_V+q_H beta)/D and T_V=(h_H+q_V beta)/D. For beta=0 a held direction with
p_o>0 instead has K_oo=1 and T_o=1/p_o; an empty held direction is absorbing.

These formulas determine the next rod's direction but do not alone generate
its waiting time. Sampling a direction from K and replacing the time by T
would destroy actual kinetic fluctuations and time/direction correlations.
The implemented event method samples their joint law as follows.

## Exact residence-cycle event sampling

While the bit holds o, each trial either succeeds with probability p_o, fails
and flips with probability q_o beta, or fails and holds with probability
q_o(1−beta). A residence consists of G_o held failures followed by one exit.
Here G_o has the geometric-failures distribution with parameter h_o, and its
exit type is independent of G_o: success has probability s_o=p_o/h_o and
failed flip has probability c_o=q_o beta/h_o.

Starting in o, two failed-flip exits form a complete return cycle. Its survival
probability is c_o c_other. Thus the number C of complete cycles before the
first accepted rod is geometric with absorption mass
m=s_o+c_o s_other=1−c_o c_other. The sum expression is used numerically, so a
small mass does not disappear through cancellation. The terminating rod is
accepted in o with conditional probability s_o/m, and in the other direction
with conditional probability c_o s_other/m.

Let J indicate termination in the other direction. There are C+1 residences
in o and C+J residences in the other direction. Conditional on C and J, the
numbers of held failures are independent NB(C+1,h_o) and NB(C+J,h_other).
Adding C+J failed-flip exits to the first direction and C exits to the second
gives the actual orientation-resolved failures. There are exactly 2C+J
failure-induced flips. Finally, the accepted anchor is uniform in the legal
set for the accepted orientation, which is the exact conditional law of an
original uniform trial given that it succeeded.

For at most 16 residences NB is sampled by summing geometric draws. For a
larger count r the distributional identity is used:
G ~ Gamma(r,scale=1), then F | G ~ Poisson(G(1−h)/h). This is an exact
negative-binomial representation, not a normal approximation. Gamma uses the
published rejection method of [Marsaglia and Tsang (2000)](https://doi.org/10.1145/358407.358414);
Poisson uses multiplication for means below 10 and transformed rejection
(PTRS) for larger means, following [Hörmann (1993)](https://doi.org/10.1016/0167-6687(93)90997-4).
The author's [institutional preprint](https://research.wu.ac.at/ws/portalfiles/portal/18953249/document.pdf)
is accessible. The implementation derives the rejection equations and uses a
stable Poisson log-mass evaluation; it installs and imports no third-party
sampler code.

The event method preserves the joint accepted sequence, total trial waiting
times, failed H/V counts, and controller flip counts. It does not materialize
the order of all the held failures inside aggregated residence blocks.
Consequently, a full trial-run histogram and trial maximum run length remain
null for event runs; they are never reconstructed from expectations or entered
as zeros. Direct runs produce these diagnostics from actual individual trials.
Accepted-run histograms are actual observations in both engines.

## Liveness and stopping

If both global legal sets are empty, the result is a geometric jam. For beta=0,
an empty held legal set is controller deadlock when the other legal set is
nonempty. The simulation stops upon entry into that diagnosed state, before
its infinitely many subsequent failed attempts. It does not wait an arbitrary
number of failures to infer absorption.

If beta>0 and either legal set is nonempty, the finite failure chain reaches
a success almost surely. Beta=1 creates a periodic alternation chain, but its
nonempty direction is still attempted infinitely often conditional on no
success; periodicity does not create deadlock. No event failure timeout is
used. Every accepted rod consumes k empty cells, so only finitely many
accepted events can occur before geometric jamming.

Starting in an empty direction with the other success probability p>0 gives
T_empty=1/beta+(2−p)/p exactly. The 1/beta divergence establishes that removing
strict deadlock with small exploration can incur arbitrarily large expected
kinetic cost. This fixed-lattice statement does not itself establish a packing
benefit or a thermodynamic-limit claim.

Direct `maxAttempts` is a validation safety bound; exceeding it throws an
exception and returns no terminal result. It does not apply to event draws.
Actual counts must remain exact JavaScript safe integers; unsupported count
overflow similarly throws, rather than reporting a jam. The Poisson mixture
also rejects means too close to that integer limit. All methods share ordinary
finite-precision/pseudorandom limitations: the inherited xoshiro128** uniforms
have 32-bit resolution, so extremely tiny Bernoulli probabilities and remote
tails should not be interpreted as arbitrary-precision sampling. Research
grid values and large-L timings must retain their recorded parameter range.

## Returned field definitions

- `NH`, `NV` (also `horizontal`, `vertical`), `particles`, `coverage`, `order`
  and `abs_order` describe accepted rods. Signed order is (NH−NV)/(NH+NV).
- `deadlock`, `geometric_jam`, `legal_h`, `legal_v`, `initial_orientation` and
  `final_orientation` establish the actual terminal convention; initial mode
  is always `fair`.
- `attempts`, `failures`, `attempted_h/v` and `failed_h/v` are sampled actual
  counts, including event virtual trials. `actual_attempts`, `actual_failures`
  and `actual_switches` are explicit aliases; `kinetic_kind='sampled-actual'`.
- `success_flips`, `failure_flips` and `controller_flips` include every
  observed-outcome transition, including the last success update.
  `trial_switches` counts changes between consecutive actual attempted
  directions. The last success flip has no following trial and is excluded
  from this adjacency count. Thus strict alternation has attempts−1 switches.
- `accepted_pairs=particles−1`, `accepted_switches`, accepted run count,
  mean, maximum and histogram refer to consecutive accepted orientations.
- Trial run count and mean are exactly `trial_switches+1` and
  `attempts/(trial_switches+1)`, even when the full event histogram is absent.
  Switch rates use the number of adjacent pairs. `accepted_lag1` and the
  `*_lag1_correlation` fields report the uncentered sign-product mean
  1−2 switches/pairs. They are **not centered Pearson correlations** when an
  observed run has orientation imbalance.
- `conditional_mean_attempts_sum` is the sum of analytical pre-event mean
  waits over visited lattice/controller states. It is present only for event
  runs, is a predictable conditional-mean cost estimator, and must be kept
  separate from actual trial counts. It is not a waiting-time sample or the
  expected cost conditional on the complete realized accepted skeleton.
- `trajectory` is available only with direct `trace:true`. `snapshot:true`
  returns a copied occupancy array, not a retained simulator buffer.
  `elapsed_ms` is wall-clock timing and is excluded from scientific replay.

No lattice is cached between simulations. Typed arrays are released from the
local lattice in a `finally` block, including error paths; default results
contain scalar records and small histograms. Garbage collection timing remains
the responsibility of the JavaScript runtime.

## Validation

`node --test stage2/tests/stochastic.test.mjs` checks explicit seed handling,
the independent 2×2 linear-system oracle, direct/event joint sampling,
negative-binomial means/variances/CDF including large residence counts, tiny
positive beta waiting, all five special points, k=1, dense legal sets under
both boundary conventions, actual beta=0 deadlock with independently counted
remaining geometry, direct/event terminal ensembles and scientific replay.
Statistical checks use fixed seeds and broad predeclared seven-standard-error
sampling bounds; they supplement algebraic checks and do not prove all possible
parameters. The tests do not constitute a Stage II experimental result.
