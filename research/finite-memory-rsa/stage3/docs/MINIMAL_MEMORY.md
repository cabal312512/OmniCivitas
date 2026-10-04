# What the minimum-memory statements actually establish

This note separates three questions: expressing outcome-sensitive behavior,
guaranteeing liveness, and improving RSA packing. They have different proofs
and different scopes. The deterministic rooted Moore model and canonical
counts are defined in `CLASSIFICATION.md`; action is emitted before the next
outcome, and each run uses one fixed fair global H/V exchange.

## Expressive outcome feedback begins with one bit

Consider the minimal two-state controller

| State | Output | After failure | After success |
| ---: | --- | ---: | ---: |
| 0 | H | 1 | 0 |
| 1 | V | 0 | 1 |

It switches action after failure and retains action after success. Starting at
0, the empty outcome word emits H. The one-letter word `F` emits `H,V`, while
the one-letter word `S` emits `H,H`. These are the **shortest counterfactual
pair** exposing outcome sensitivity: empty words cannot differ, while one
outcome already suffices. Every outcome-blind controller, regardless of its
number of states, emits the same next action for every word of the same length.
It cannot match both traces. This is an automaton-capability proof, not a
comparison of likely outcomes in a particular RSA geometry.

One observed trace such as `H,V` can be matched by an ordinary temporal
schedule. It is the equal-length counterfactual pair, not a single observation,
that proves dependence on the feedback input. Therefore a request for a
single shortest path distinguishing this example from every temporal schedule
must not be substituted for the correct pair-of-words argument.

A one-state deterministic controller has a constant output and cannot express
this dependence. Consequently one bit is necessary and sufficient for
deterministic outcome-sensitive word behavior. The enumeration provides 12
exactly-two-state feedback behaviors versus two temporal behaviors, with the
orientation quotient and fixed initial root understood. It does **not** prove
one bit is sufficient or insufficient for a useful large-system packing gain.

## Two states are necessary and sufficient for universal deterministic liveness

Here universal liveness means almost-sure eventual acceptance from every
outcome-reachable controller state in every abstract frozen two-action geometry
with at least one positive success probability. It is stronger than successful
completion from an empty lattice for one particular L/k.

The lower bound is immediate. A one-state deterministic controller outputs
only H or only V. Make that orientation illegal while retaining legal anchors
of the other orientation. Its failure self-loop has zero success hazard and
cannot escape. Randomizing one global exchange at initialization does not
repair almost-sure liveness: it only mixes symmetry-related constant policies.

For the upper bound, use two states with distinct outputs and failure map
`0→1→0`. The failure cycle contains both actions. Whichever orientation is
legal is tried once per traversal, with positive chance of acceptance;
survival for infinitely many traversals has probability zero. Success targets
may be either state, so the argument applies again after an acceptance.
On a finite lattice only finitely many particles fit. Thus only geometric jam
can stop a universally live controller. The failure-cycle criterion proves
exactly four live two-state classes, including strict temporal alternation.

This establishes the minimum **deterministic** universally live state count
as two, or one bit. IID fair orientation choice uses no evolving finite-state
memory and is also live, but is a stochastic policy outside the deterministic
lower-bound statement. No claim that all live algorithms require one bit is
made. These support-graph facts specialize standard finite absorbing-process
theory; they are not a new general Markov-chain result.

## Matched-memory packing is a separate question

Within a budget of at most four states, every candidate must be compared with
all 16 live temporal behavioral classes, even if the candidate itself minimizes
to three states. A three-state-only comparison is an intermediate capability
comparison, not the full two-bit comparison. The one-bit budget separately
contains all four live feedback classes and its one live temporal class.

The exact survey uses `L=3,k=2` under both periodic and open boundaries. It
includes all 16 live temporal classes, all four live feedback classes with at
most two states, and an additional IID fair reference. When coarse results are
available, it adds at most 12 feedback mechanisms selected per exploratory
source k=4/8. Selecting the mechanisms does not change the exact system's k=2.
The extra candidates are not an exhaustive exact survey of all 8730 live
four-state feedback classes. Following the updated research instruction,
selection prefers middle-stage L64 constrained/Pareto mechanisms, and the
formal lock's candidates are also included for interpretation. Their exact
outcomes never retune the independent confirmation family.

The three performance coordinates are exact `E[θ]`, `E[|S|]` and `E[A/N]`,
where A is the number of actual trials before terminal recognition and N is
the accepted particle count. **`E[A/N]` is not `E[A]/E[N]`.** The exact solver
retains terminal-probability-weighted attempt rewards and every rational
terminal probability. All surveyed deterministic controllers have a structural
liveness certificate; the exact deadlock mass is separately checked to be zero.

The script computes strict rational dominance by cross-multiplying BigInt
numerators and denominators. It distinguishes a new non-dominated objective
point from dominating every temporal controller. Exact equality with an
existing temporal point is neither. An exact tiny-lattice benefit cannot prove
a k4/k8 finite-size effect, much less an asymptotic gain or a two-bit minimum
for useful feedback. Independently seeded matched-memory confirmation is a
different research step.

## Exact evidence and reproduction

Individual rational laws and weighted attempt rewards are retained in
`data/exact/*.json`; their hashes, selection provenance, complete matched
temporal contrasts and frontiers are collected in `results/exact-survey.json`.
The runnable entry is:

```sh
node scripts/exact-survey.mjs --baseline-only
node scripts/exact-survey.mjs
```

The first command performs only the exhaustive small-memory/baseline survey.
The second prefers middle-L64 mechanisms when `results/middle-groups.json`
exists, otherwise uses available `results/coarse-groups.json`, and includes
feedback identities in an existing confirmation lock. Matching source-sealed
case files are reused, never overwritten or
counted as new samples. If scientific sources differ, the script refuses to
reinterpret existing exact cases. Stage I/II and website hashes are read-only
checked before and after execution. Core commands use standard Node and
relative project paths; local Windows execution uses its environment wrapper.

## Completed exact results

The independently validated frozen engine produced **86 controller/system
cases for 43 distinct controller identities**. The initial exhaustive baseline
has 42 cases; 12 mechanisms per exploratory source k were selected from L64
middle-stage means, with overlap and already-covered one-bit controllers
removed from additional work. All nine feedback identities in the formal lock
are included. Each identity is solved once under each boundary. Duplicate
behavior appearing in feedback and temporal roles remains explicitly labelled
and is not an independent observation. The individual case files occupy about
1.8 MB and contain full rational terminal laws and attempt-moment masses.

The following table isolates the complete one-bit comparison. “Failure-switch”
is the expressive example above. “Success-reset V” emits H at initialization,
then sets state1 after every success; its failure transition toggles H/V.
Its canonical key is `2:01:1,1,0,1` (`feedback-4-00010`).

| Boundary | Controller | E[θ] | E[abs S] | E[A/N] |
| --- | --- | ---: | ---: | ---: |
| Periodic | Temporal alternation | .8796399521 | .4055580741 | 4.3988332117 |
| Periodic | Failure-switch, success-hold | .8621330360 | .4910186555 | 4.4843667856 |
| Periodic | Success-reset V | .8796399521 | .4084149970 | 4.3723622760 |
| Open | Temporal alternation | .8775297619 | .4928875812 | 3.7556734960 |
| Open | Failure-switch, success-hold | .8582341270 | .5478400072 | 3.5952153309 |
| Open | Success-reset V | .8775297619 | .4945921266 | 3.7263208174 |

For success-reset V relative to alternation, the exact periodic differences are

`ΔE[θ]=0`, `ΔE[abs S]=334/116909`, `ΔE[A/N]=-4481/169280`.

The exact open-boundary differences are

`ΔE[θ]=0`, `ΔE[abs S]=3/1760`, `ΔE[A/N]=-263/8960`.

Thus this one-bit feedback buys a small speed gain at a small imbalance cost,
with equal density. Neither point dominates the other. Its objective triple
is not dominated by any of the complete **16 live deterministic temporal**
controllers under either boundary. This is a genuine exact tiny-system
tradeoff-frontier extension, already with one bit; it is not an improvement
in all objectives or an assertion that two bits are the first useful budget.
The success-reset controller itself has the shortest abstract sensitivity witness
`FF→H,V,H` versus `FS→H,V,V`, since its first transition is outcome-blind.
For actual empty-start RSA the first proposal succeeds. The reachable pair
`SF→H,V,H` versus `SS→H,V,V` provides the same distinction: on the exact L3,k2
systems the second V proposal can either overlap the initial H rod or fit,
with positive probability under both boundaries. This feedback sensitivity is
therefore not merely an artifact of an impossible initial failure word.

Failure-switch/success-hold is strictly dominated by alternation on the periodic
system. On the open system it trades lower cost for lower density and greater
imbalance. The fair IID reference is also retained: its periodic density is
`48/55`, versus alternation's `21304/24219`; these independently validated
values are consistency checks, not reconstructed first-stage samples.

Across the full surveyed four-state feedback subset, seven periodic and thirteen
open-boundary controller identities contribute new non-dominated points relative
to the complete deterministic temporal catalogue. **Zero** surveyed controllers
dominate every temporal controller in all three objectives. The highest density
among the selected feedback cases is about .885692 periodic and .883999 open;
the full temporal catalogue reaches .888209 and .887412 respectively. These
maxima do not settle other objective tradeoffs or unsurveyed feedback behavior.
The numbers are exact-rational comparisons of a fixed tiny geometry, not
statistical significance claims.

## A model-specific operational-equivalence theorem

The locked k8 candidate `feedback-4-00206` has outputs `[H,H,V]` and transition
rows `[F,S] = [[1,2],[2,2],[1,1]]`. Its root state0 has different targets, so
arbitrary-word Moore minimization correctly retains three states. However the
specified sampler chooses only valid boundary-respecting anchors, and an empty
lattice makes **every first proposal succeed**. Actual execution therefore
leaves state0 through success to state2. States2 and1 thereafter alternate
unconditionally under both outcomes. The initial action is H, followed by
V,H,V,... on every subsequent trial, up to the fixed global exchange.

A coupling using the same successive uniform anchors proves equality with
ordinary temporal alternation for **every admissible L/k and both boundaries**
from this empty initial condition: actions, accept/reject outcomes, occupancy,
terminal reason and actual trial counts all coincide. This is a model-specific
operational equivalence, not a general assertion that all feedback machines
are temporal. It would fail under a different initial geometry or a sampler
that treats out-of-bound anchors as failures on the first trial.

The exact L3,k2 report confirms all rational metrics equal under both boundaries.
The event implementations can consume their seeded random stream differently,
so identical seeds need not produce identical individual realizations; equality
of process laws is established by the action/anchor coupling instead. This
distinction explains why structural word classes are an intentionally strong
catalogue and why additional geometry-specific symbolic pruning is possible
without altering their exhaustive counts. Those counts classify behavior over
all abstract S/F words; they do not count distinct terminal RSA laws under
this empty-start sampler.

The exact report compares fixed deterministic temporal controllers, not the
entire space of stochastic outcome-blind machines or every externally selected
convex mixture. A read-only numerical convex check found no matching temporal
mixture for the success-reset V point, but this is **not** promoted to an exact
mixture impossibility certificate. Other discrete-frontier points can disappear
under mixtures, so the distinction remains explicit.

All Stage I 165, Stage II 368 and website 52 frozen files passed read-only hash
checks both before and after the completed survey. The initial 42 case files
retain their original source seals and were reused unchanged. Later selection-
runner changes are disclosed per case through `runnerSelectionSourceChangedSinceCase`;
all scientific engine/controller/catalogue hashes remained identical. The
baseline and added cases were not silently resealed or counted as repeats.
