# Final capability theorems and their boundaries

The principal comparison is fixed-geometry properness on the square lattice
`L=3, k=2`, with uniform independent proposal anchors. Both contestants must
reach **geometric** jam almost surely and have finite `E[A/N]`. A controller
deadlock with available placements is inadmissible. The initial direction is H;
first-V counterparts have the same three objectives by lattice transposition.
Write `v=(Eθ,E|S|,E[A/N])`, with `S=(N_H-N_V)/N`, and
`J(v)=vθ-μ vS-ν vC`, where `μ,ν≥0`. The temporal null contains every stationary
edge-emitting HMM with at most two hidden states, not merely switching policies.

## 1. Proper deterministic one-bit feedback has two-state operational memory

The frozen structural catalogue has thirteen H/V-normalized classes with at
most two Moore states. The current independent physical reachability audit is
[feedback-scope.json](../results/feedback-scope.json). For a finite product
chain, absorption is almost sure exactly when every reachable nonterminal
state has a path to a geometric jam state: otherwise a reachable closed class
avoids jam; conversely no such closed class remains. Finite-state absorption
then has a geometric tail and finite mean. This tests physical properness,
not an arbitrary numerical iteration cutoff.

The periodic proper physical classes are `{4,12}`, `5`, `6`, `9`, `10`.
On the open square they are `5`, `6`, `9`, `10`. Codes 4 and 12 describe the
same periodic physical process because the first proposal is necessarily a
success. The constant-H class is not proper on either square.

Every proper class has positive-probability pre-jam histories prescribing H
with certainty and other such histories prescribing V with certainty. A
one-state stationary randomized feedback machine emits the same action law
on all histories and cannot meet both requirements. The known deterministic
two-state realization gives the matching upper bound. Thus each contestant's
randomized operational minimum is exactly two, under this action-before-
observation convention. This is stronger than simply counting source states.

## 2. All-direction periodic support-negative theorem

**Theorem.** On periodic `L=3,k=2`, for every `μ,ν≥0`,

`max_{proper deterministic one-bit feedback F} J(F)
 ≤ sup_{proper temporal HMM with ≤2 states T} J(T)`.

**Certificate and proof.** Let `T_a` be strict alternation, `T_b` the switching
chain with H→V probability 1 and V→H probability `7/10`, and `T_c` the word
H followed by V forever. All three are proper on this periodic square and
use at most two temporal states. The archived exact laws and current rational
coordinate calculations are recorded in
[periodic-negative.json](../results/periodic-negative.json).

| Feedback physical class | Dominating temporal convex-hull vector |
| --- | --- |
| 4/12 | `T_c`, identical complete physical process |
| 5 | `T_a`, strictly better in all three coordinates |
| 6 | `T_a`, strictly better in all three coordinates |
| 9 | `T_a`, identical objective vector |
| 10 | `(9/10)v(T_b)+(1/10)v(T_c)`, strictly better in all three coordinates |

For the last row the exact favorable slacks are

* coverage: `5190136/1359533565`;
* order reduction: `96801926273279/8713915732116855`;
* cost reduction: `5848032782749165024711/300855089910120186767040`.

They are positive rational numbers. For every permitted scalarization,
`J(F10) ≤ .9 J(T_b)+.1 J(T_c) ≤ max(J(T_b),J(T_c))`. One constituent is
therefore enough for each direction. **The convex mixture is not claimed to
be a two-state implementation.** Its persistent selector may require extra
memory, and no selector is smuggled into the null.

Equivalently, these feedback vectors lie in the monotone dominated closure
of the convex hull of proper two-state temporal vectors: increase coverage
and decrease the two penalties. This does **not** establish exact membership
of the raw feedback points in that convex hull, equality of the nonconvex
attainable sets, or a single temporal controller dominating class 10 in all
coordinates. The earlier raw-membership attempt remains inconclusive in
[convex-membership.json](../results/convex-membership.json).

The theorem is about **deterministic** one-bit feedback. It does not settle
the entire randomized feedback continuum, open boundaries, stronger universal
liveness, larger systems, or other particles. `T_c` is fixed-periodic proper
but not abstract-universally live; replacing admissibility would invalidate
this proof.

## 3. Exact density supremum on both tiny geometries

**Theorem.** For either open or periodic `L=3,k=2`, the density supremum of
proper temporal controllers with at most two states is `8/9`. The same
supremum holds when temporal competitors are required to be abstract-
universally live.

**Proof.** At most four dimers fit on nine sites, so `θ≤8/9`. For `0<β≤1`
use initial state `(1,0)` and

```
K_H = [[0,1], [0,0]]
K_V = [[0,0], [β,1-β]].
```

This emits an initial H, then V runs interrupted by isolated H probes.
Every two-attempt block in a nonjammed occupancy has probability at least
`β/M` of acceptance, where `M=9` periodic and `M=6` open. There are at most
four acceptances. Hence `E[A]≤2 M N_max/β`; the positive-β controller is
proper and has finite cost. Both directions recur under the stronger
abstract liveness condition as well.

Consider the limiting macro process: after the initial successful H, accept
V placements whenever any legal V remains; when none remains, probe H, and
return to V. An independent exhaustive raw-anchor traversal visits 120
`(occupancy,H-count)` states and nine terminal atoms on the periodic square,
and 62 states and eight terminal atoms on the open square. Every terminal
atom has `N=4`. Counts alone are not the proof: the saved traversal explicitly
checks every legal successor and every terminal occupancy against raw
placements; the clean-source reconstruction repeats this check. See
[density-limit.json](../results/density-limit.json).

Couple the finite-β process to this macro process until it interrupts a V
run while a legal V is still present. A legal V acceptance takes at most M
V trials on average, and there are at most four such successes. A union
bound on the independent interruption coins gives a disagreement
probability at most `4Mβ`. Thus

`Eθ_β ≥ (8/9)(1-4Mβ)`.

Taking `β↓0` closes the density supremum against the parity bound. The
periodic fixed-proper supremum is also attained by `T_c`, with
`(θ,E|S|,E[A/N])=(8/9,1/2,37/10)`. **No finite-controller attainment is
asserted for the open case or the universal-live case.** The β=0 open
controller is improper. The proof concerns bounded terminal density, not
continuity of attempt cost or of the full joint objective vector.

## 4. Temporal word-law mixture theorem

Fix a finite geometry and independently sample an infinite orientation word
`W` and the proposal anchors. Let a temporal word law be proper with finite
`E[A/N]`. Conditional on W it is a deterministic schedule. Fubini implies
that almost every sampled word is proper: a positive-measure set of words
with positive conditional nonabsorption would contradict unconditional
properness. Tonelli for the nonnegative cost implies finite conditional
`E[A/N]` for almost every word. Coverage and absolute order are bounded.
Consequently conditional expectation gives

`J(law)=∫ J(w) dP(w) ≤ sup_{proper finite-cost deterministic w} J(w)`.

Degenerate word laws give the reverse inequality. The unrestricted
stochastic temporal support therefore equals the deterministic infinite-word
support under the same properness and finite-cost standard. Even when
`ν=0`, this statement keeps the declared finite-cost admissibility class.

This theorem does not identify the two-state HMM support with the unrestricted
word support. A deterministic infinite word can require unbounded temporal
memory. The unrestricted support is an upper comparator, not a free matched
memory realization.

## 5. Eventually periodic schedules approximate the unrestricted support

**Theorem (approximation, not attainment).** On a fixed finite RSA geometry,
every proper deterministic word with finite `E[A/N]` can be approximated in
all three objectives by words consisting of a finite prefix followed by
strict H/V alternation. Thus these eventually periodic words have the same
support supremum as all proper finite-cost temporal word laws.

**Proof.** Because `1≤N≤N_max`, finite `E[A/N]` implies finite `E[A]`.
Keep the first T symbols of the original word and alternate thereafter.
Alternation from any nonjammed occupancy has acceptance probability at
least `1/M` in a two-trial block. Its expected remaining time is uniformly
bounded by `C=2 M N_max`. Let `p_T=P(A>T)`. Couple anchors through the prefix;
on `A≤T` both stopped trajectories coincide. The two bounded terminal
objectives differ by at most `p_T`. On the surviving event, use `N≥1` and
the triangle bound on the past and remaining costs to obtain

`|E[A/N]-E[A_T/N_T]| ≤ E[A 1_{A>T}]+C p_T →0`.

The original tail is integrable, and `T p_T≤E[A 1_{A>T}]`. Each replacement
word is proper and finite-cost. Apply the mixture theorem to conclude equality
of the suprema. This is a basic truncation and coupling argument, not a claim
of a novel general automata theorem. It proves neither an optimal finite
prefix nor a bounded optimal period nor two-state attainability.

## What remains undecided

For open boundaries, order/cost directions retain certified intervals that
cross zero after subtracting the strongest deterministic feedback candidate.
Those intervals are too wide to decide advantage. The complete randomized
feedback capability question remains open even periodically. The project
stops with these limitations; no absence of a crossing is converted into
an inclusion theorem.
