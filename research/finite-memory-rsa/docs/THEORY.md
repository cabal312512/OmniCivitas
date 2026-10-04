# Finite-memory RSA: model, controller quotient and exact small systems

This document gives finite-system statements. It does not establish novelty,
thermodynamic-limit optimality, or a causal information–packing law. The exact
calculations below use no random seeds because they sum the entire probability
law rather than sampling it.

## 1. Model and conventions

Let the substrate be an `L × L` square lattice and let `1 ≤ k ≤ L`.
An H or V candidate is a straight length-`k` segment. The occupied set `X`
only increases; every accepted candidate adds exactly `k` previously empty
sites. There are `M = L²` oriented anchors for periodic boundaries and
`M = L(L-k+1)` valid oriented anchors for open boundaries. Open-boundary
anchors are sampled uniformly conditional on being wholly inside the lattice.
This is a modelling choice: sampling all lattice sites and treating an
out-of-bounds candidate as failure would be a different feedback process.

Periodic candidates retain anchor multiplicity. At `k=L`, several anchors
represent the same geometric segment but remain distinct candidate events.
Neither the controller nor its state update receives the anchor coordinates.

A deterministic controller is a rooted Moore machine
`C = (Q,q₀,g,F,T)`, where `g(q)` is H or V, `F(q)` is the state after failure,
and `T(q)` is the state after success. A uniform independent anchor is drawn
for every attempt; `g(q)` is chosen before that anchor is inspected. The
controller receives only the binary success/failure result. In the one-bit
family `Q={0,1}` and `q₀=0`.

The controller identifier is

`id = transitionBits + 16 * orientationBits`,

with `g(q) = (id >> (4+q)) & 1`,
`F(q) = (id >> (2q)) & 1`, and
`T(q) = (id >> (2q+1)) & 1`; H=0 and V=1.
This enumerates exactly `4 × 16 = 64` distinct labelled controllers.

If the accepted H and V particle counts are `N_H,N_V`, then
`θ = k(N_H+N_V)/L²` and
`S = (N_H-N_V)/(N_H+N_V)` (set `S=0` if no particle is accepted).
`E|S|` is reported separately from `|E S|`. Pooling an H-biased experiment
with its V-biased rotation can make `E S=0` while individual realizations
remain strongly ordered; that mixture is not evidence of realization-level
isotropy.

## 2. Behavioural equivalence: 26 classes, or 13 after H/V exchange

Two rooted controllers are behaviourally equivalent if, for **every finite
binary feedback word**, their orientation outputs at every prefix agree.
This is stronger than observing similar packing statistics on one system.
The definition fixes the initial state. A state relabelling must relabel the
initial state too; swapping 0 and 1 while silently resetting the root to 0
can change the experiment.

The canonical representation removes graph-unreachable states, minimizes
the output-labelled deterministic machine, and numbers the minimized states
by a failure-first, success-second breadth-first walk from the root. H/V
exchange is an optional second quotient, not silently part of equivalence.

**Proposition 1.** The 64 controllers have exactly 26 rooted orientation-labelled
behavioural classes: two classes of 20 controllers each and 24 singleton
classes. After global H/V exchange they have 13 classes: one class of 40
controllers and 12 classes of size two.

**Proof.** A constant output function yields one constant stream, independent
of transitions: 16 labelled controllers for H and 16 for V. When outputs
differ, state 1 is unreachable precisely when both transitions from state 0
return to 0. The four choices for state 1's unused transitions add four
controllers to each corresponding constant-stream class. The remaining
mixed-output controllers are `2(16-4)=24`. Both states are reachable and have
different outputs, hence are distinguishable. Because the initial output
identifies the root and the two output labels identify both states, changing
any reachable transition changes the response to some feedback word. They
are therefore singleton classes. H/V exchange pairs these 24 and pairs the
two constant-stream classes. ∎

The implementation additionally checks every pair against their outputs for
all binary words of length at most four. A shortest distinguishing word for
two two-state Moore machines visits at most four product states before a
mismatch, so this finite check suffices. The complete IDs and canonical keys
are in `data/processed/controller_classes.json`.

## 3. Jamming, transient waiting and policy deadlock

Let `A_o(X)` be the number of legal anchored placements in orientation `o`.
The controller-state success probability is `a_q=A_g(q)(X)/M`.

* **Geometric jamming:** `A_H(X)=A_V(X)=0`.
* **Closed controller deadlock:** the all-failure trajectory from the current
  state visits only states with `a_q=0`, while at least one allowed orientation
  has a legal placement. No future success is possible from this state.
* **Transient waiting:** the all-failure orbit includes a legal-output state.
  Long strings of failures can occur without either kind of jamming.

A deterministic all-failure orbit has a finite prefix and a recurrent cycle.
If every orientation on the recurrent cycle is unavailable, the process can
enter a closed deadlock after its transient prefix. A legal orientation on
the prefix provides only a finite number of chances; it does not establish
almost-sure future success. Conversely, one legal orientation visited on the
cycle implies that the probability of never succeeding is zero, conditional
on reaching that cycle. This follows from independent uniform anchors and a
cycle survival probability strictly smaller than one.

These definitions are relative to the full allowed geometric set `{H,V}`,
including for an always-H baseline. Thus an always-H run can terminate in
controller deadlock despite having completed H-only RSA. A simulator that
labels every aligned terminal configuration “jammed” changes the question.

**Proposition 2 (failure-cycle certificate).** A controller avoids closed policy
deadlocks for every occupancy/controller-state pair if every graph-reachable
all-failure recurrent cycle contains both H and V outputs. More precisely,
this condition is sufficient on every finite lattice with the above anchor
sampling. For particle geometries admitting a valid occupancy with one
orientation blocked and the other legal, it is also necessary when the
quantifier permits arbitrary graph-reachable controller states and arbitrary
valid occupancies.

**Proof.** For any non-geometrically-jammed occupancy, one of H or V has a
legal candidate. Every failure cycle then has a success probability bounded
away from zero over each traversal; an indefinitely unsuccessful cycle has
probability zero. A success strictly increases occupancy, and there are at
most `floor(L²/k)` successes, so the process reaches geometric jamming almost
surely. For the converse, if a cycle emits only H, choose a configuration
with no legal H placement but a legal V placement and start at a state on
that cycle; every future attempt fails. Interchange H and V for the other
case. For example on a 2×2 dimer lattice, an occupied vertical column leaves
the other column legal for V but no legal H placement. ∎

The necessity clause is deliberately **not** a claim that this adverse pair
is reachable from the empty lattice under the particular controller.
Actual empty-start deadlock probability remains a geometric/dynamical
question. Monomers are another exception to a necessity assertion: whenever
an empty site remains, both orientations are available.

**Corollary 2.1.** In the two-state family, the structural certificate is held
by precisely eight controllers: IDs `17,19,25,27,33,35,41,43`. They have distinct
outputs and `F(0)=1,F(1)=0`. H/V exchange reduces them to four behaviours.
From an arbitrary non-jammed state their expected attempts to the next
success are at most `2M`, because every pair of attempts has success
probability at least `1/M`. Expected attempts up to entry into geometric
jamming are consequently at most `2M floor(L²/k)` (termination is checked at
entry, without adding an infinite post-jamming failure tail).

For H-first policies these four behaviours are:

| ID | after failure | after success | interpretation |
|---:|---|---|---|
| 33 | switch | reset H | failure switching with H reset |
| 35 | switch | switch | strict alternation on every attempt |
| 41 | switch | preserve | preserve success, switch failure |
| 43 | switch | reset V | failure switching with V reset |

ID 35 ignores the feedback value because its failure and success transition
maps are identical. It is an open-loop one-bit-memory baseline. An advantage
over i.i.d. fair orientation therefore cannot be credited to feedback solely
because ID 35 has an internal state.

## 4. Exact absorbing computation

The complete Markov state is `(X,q)`; accepted orientation counts can be
carried as additive observables. Ordinary attempt transitions contain
self-loops and failure cycles, but successful transitions increase `|X|`
by exactly `k`. The exact solver exploits this partial order.

For a fixed `X`, enumerate the all-failure states `q₀,…,q_{r+c-1}` with prefix
length `r` and cycle length `c`. Write `b_i=1-a_{q_i}` and
`B=∏_{i=r}^{r+c-1} b_i`. The probability that the next accepted event is one
specific legal anchor at prefix index `j<r` is

`(∏_{i<j} b_i)/M`.

For a specific legal anchor at cycle index `r+j`, when `B<1`, it is

`(∏_{i<r} b_i)(∏_{i=r}^{r+j-1} b_i) / (M(1-B))`.

The accepted orientation is `g(q_{r+j})`; the next controller state is
`T(q_{r+j})`. If `B=1`, no cycle state has a legal placement. The probability
of absorption without another success is `∏_{i<r} b_i`, classified as deadlock
unless both legal counts are zero. Prefix accepted events still contribute
their individual probabilities.

These weights sum exactly to one. Recursing on `(X∪placement,T(q))` is
acyclic. Memoized conditional terminal distributions retain the added
horizontal and vertical particle counts, enabling exact `Eθ`, `E|S|`, `ES`,
variance, and geometric/deadlock absorption probabilities. All probability
operations use normalized BigInt fractions. Floating values in the JSON
are for display only; numerator and denominator are the authoritative
values. The fair memoryless baseline conditions the next successful event
uniformly on all legal H and V anchors, whose orientation candidate
denominators are equal on a square substrate.

The solver is intentionally limited to `L≤3`. No claim is made that this
small-state exhaustive representation scales to the Monte Carlo sizes.

## 5. Exact results and independent checks

Every one of the 64 labelled controllers was solved for `(L,k)=(2,2),(3,2),
(3,3)`, with periodic **and** open boundaries: 384 controller/system cases.
The four baselines fair, always-H, always-V and strict alternation add 24
cases. Monomer and single-site sanity laws are saved too. Full terminal
distributions are in `data/processed/exact_small_systems.json`.

| system | orientation baseline | exact expected coverage | exact deadlock probability |
|---|---|---:|---:|
| 2×2, k=2, either boundary | fair / aligned / alternation | 1 | 0 |
| 3×3, k=2, periodic | fair | 48/55 | 0 |
| 3×3, k=2, periodic | always H | 2/3 | 7/9 |
| 3×3, k=2, periodic | strict alternation | 21304/24219 | 0 |
| 3×3, k=2, open | fair | 1691/1944 | 0 |
| 3×3, k=2, open | always H | 2/3 | 3/4 |
| 3×3, k=2, open | strict alternation | 5897/6720 | 0 |
| 3×3, k=3, either boundary | fair / aligned / alternation | 1 | 0 |

For the periodic 3×3 aligned-dimer example, each row ends with exactly one
empty cell, uniformly placed among three columns. A remaining V dimer
exists unless the three vacancies occupy three distinct columns. The
probability of distinct columns is `3!/3³=2/9`; hence policy deadlock has
probability `7/9`. Under open boundaries a row vacancy is equally likely at
either endpoint; no vertical placement remains only for the two alternating
row-vacancy sequences out of eight, giving `P_dead=3/4`.

ID 46 is a useful warning against extrapolating one small lattice. It chooses
H initially, then switches permanently to V on its first success. For 2×2
dimers its exact terminal coverage is 1/2 and deadlock probability is 1. For
periodic 3×3 dimers its coverage is 8/9 and deadlock probability is 0. Thus
zero measured deadlock on one size is not a universal failure-fairness
certificate, and a high small-system density can arise from a special
commensurability effect.

Tests independently construct the entire reachable attempt-level transition
graph for all 64 2×2 dimer controllers, find its closed strongly connected
components, and solve the global transient linear system with Gaussian
elimination. Those answers agree with the rational failure-cycle dynamic
program to `10⁻¹²`. The same independent oracle additionally checks fair
orientation and IDs 35, 41 and 46 on both periodic and open 3×3 dimer systems.
This oracle does not use the production recursion. Separate tests verify
probability conservation, H/V exchange, k=1 coverage, the controller quotient,
and the analytic examples above. The two owned test files contain 14 tests;
all passed in the recorded run.

Reproduction commands, from the research project directory with Node on PATH:

```sh
node --test tests/controllers.test.mjs tests/exact.test.mjs
node src/exact.mjs
```

## 6. What the theory does and does not identify

The behavioural quotient is an exact input/output classification, not a
claim that all 13 remaining classes have different terminal coverage for all
lattices. Two distinct controllers can have equal coverage and different
orientation order or waiting dynamics. Correlated attempts can also have
different absorbing laws despite the same marginal orientation frequency.

The controller receives no occupancy information, but its feedback is
generated by occupancy. A pooled mutual information
`I(Y_{t-1};O_t)` can mix stages with very different failure rates. It may even
be nonzero for an open-loop controller because feedback and orientation share
a dependence on the evolving system. It is descriptive unless accompanied
by controls or intervention arguments; it is not a standalone causal measure
of feedback benefit. A valid empirical comparison should separately include
i.i.d. orientation bias baselines, strict open-loop alternation, realization-
level orientation order, seed uncertainty and held-out candidate confirmation.

No theorem above says that feedback improves isotropic packing. That is an
empirical question addressed by the simulator and finite-size study. The
model's restricted information structure, exact controller classification,
and cutoff-free deadlock distinction are meaningful even if that packing
hypothesis is rejected.
