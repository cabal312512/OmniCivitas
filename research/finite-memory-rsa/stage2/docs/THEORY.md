# Stage II: stochastic liveness, singular kinetics and exact absorption

This document concerns the new stochastic one-bit family and its mathematical
extensions. Stage I code, experiments and conclusions are retained unchanged.
Statements about an arbitrary frozen occupancy are distinguished from claims
about physically reachable occupancies starting from the empty substrate.
None of the finite-state results below establishes a thermodynamic phase
transition or a packing advantage of feedback.

## 1. Model

The lattice, rods and uniformly sampled candidate anchors follow Stage I:
`M=L²` anchors per orientation on a periodic square lattice and
`M=L(L-k+1)` valid contained anchors on an open square lattice. Periodic
geometric multiplicity is retained. A candidate is drawn after orientation
choice; no coordinates or legal counts are supplied to the controller.

The state is the currently held orientation `q∈{H,V}`. Its direction flips
with probability `α` after success and `β` after failure. The initial direction
is an independent fair H/V draw. All transition randomization is independent
of anchor sampling, conditional on the current state and reported outcome.
Thus `α=β=r` is an outcome-independent temporal controller, not a feedback
policy under another name. Its un-stopped attempt sequence is a stationary
symmetric two-state Markov chain with lag-one signed-orientation correlation
`1-2r`. For `0<r≤1`, un-stopped orientation runs are geometrically distributed
with mean `1/r`; `r=0` keeps the initial orientation forever. Empirical runs
truncated at a geometry-dependent stopping time need not retain that
uncensored run-length law.

Finite square geometry, symmetric transition rules and fair initialization
make the distribution of accepted-particle order `S` exactly symmetric under
`S→−S`. Consequently `ES=0` for every parameter point. This says nothing about
realization-wise isotropy: the mixture of fixed H and V runs has `E|S|=1`.
Stage II therefore retains `E|S|`, `ES²`, `ES⁴`, signed distributions and
quantiles as distinct observables.

## 2. General stochastic finite-state controller on a frozen lattice

Let a finite controller have states `Q`, orientations `O`, pre-outcome action
probabilities `π(o|q)`, and failure transition probabilities
`T_F(q'|q,o)`. The transition can depend on the controller's own chosen
orientation as well as the binary result; it receives no anchor or spatial
information. Define frozen-lattice success hazards `a_o=A_o/M_o`, where
`A_o` is the legal-anchor count. In the square two-orientation model the
candidate denominators are equal, but this general definition permits
orientation-specific denominators.

The **substochastic failure kernel** is

`F_X(q,q') = Σ_o π(o|q)(1-a_o)T_F(q'|q,o)`.

Its row deficit is the next-attempt success probability

`ℓ_X(q) = 1−Σ_q' F_X(q,q') = Σ_o π(o|q)a_o`.

The formula accounts for outcome-dependent reweighting of randomized actions.
The distribution of the chosen action *conditional on a failure* is
proportional to `π(o|q)(1-a_o)`, not generally to `π(o|q)`. Therefore the
unweighted failure-update chain cannot replace `F_X` in a geometry-specific
liveness calculation.

Add an absorbing success state `⊙`, with transition probability `ℓ_X(q)` from
state `q`. This produces an ordinary finite Markov chain. The standard
closed-class and absorption framework is background, not a new general
Markov-chain theorem. See the primary university materials on
[finite-chain absorption equations](https://ocw.mit.edu/courses/12-109-petrology-fall-2005/ac57b74d28aa40c74da4e42b4016fcb3_markov.pdf)
and [finite-state class decomposition](https://ocw.mit.edu/courses/6-262-discrete-stochastic-processes-spring-2011/3558b08622765d26c2b0a7d2eeeac885_MIT6_262S11_chap03.pdf).
Our contribution here is its explicit translation into feedback-controlled
adsorption and the distinction between the relevant quantifiers.

### Theorem A: exact frozen-lattice liveness criterion

Fix `X` and a current state `q`. In the directed graph of positive entries of
`F_X`, restrict to states reachable from `q`. Then the next successful
placement occurs almost surely **if and only if every bottom strongly
connected component contains at least one state with `ℓ_X>0`**. Equivalently,
there is no reachable bottom component all of whose rows retain total
failure mass one. Under the condition, the expected next-success time is
finite. If the lattice is non-geometrically jammed and the condition fails,
the process has positive probability of entering a closed controller deadlock.

Here a bottom SCC has no outgoing positive failure edge; a singleton with
no such edges is included and has leakage one. The usual BSCC terminology
is documented in this [Oxford primary research report, Appendix A.2](https://www.cs.ox.ac.uk/files/8188/CS-RR-16-03.pdf).

**Proof.** A reachable nonleaking bottom component is a closed communicating
class in the augmented chain, distinct from success. A positive-probability
failure path reaches it, after which success is impossible. Conversely,
suppose every failure bottom component contains a leaking state. Every
reachable state has a positive-probability path through failure edges to
such a component and then to success. Because the graph is finite, these
paths can be chosen with bounded length and a strictly positive minimum
path probability `δ`. Applying the Markov property in blocks of that length
bounds survival by `(1−δ)^n`. Survival tends to zero and its sum is finite,
proving both almost-sure success and finite expectation. ∎

A legal action supported only in a transient state supplies a finite chance,
not an almost-sure guarantee. For instance, an H state with hazard `1/2`
that moves after failure to a permanent V state with hazard zero succeeds
with probability only `1/2`. The next state is a genuine closed deadlock.

### Why geometry weighting matters

Consider two states. At `q=0`, H/V are chosen fairly. A *failed H* moves to
`q=1`; a failed V stays at `q=0`. At `q=1`, only V is chosen and failure stays
there. For hazards `(a_H,a_V)=(1,0)`, the putative failed-H edge never occurs:
`F_X(0,0)=1/2`, `F_X(0,1)=0`. Success from `q=0` is almost sure despite the
unweighted graph's reachable permanent-V class. At `(1/2,0)`, that edge has
positive mass and a deadlock becomes accessible. This counterexample shows
why using the unweighted chain can give the wrong answer for a particular
geometry/state pair. The hazard-one configuration in this abstract example
need not be a physically realizable partially occupied k-mer lattice.

## 3. A geometry-independent strong certificate

Define the stochastic, unweighted forced-failure chain

`G(q,q')=Σ_o π(o|q)T_F(q'|q,o)`.

For a bottom class `C` let its action support be the union of all orientations
with `π(o|q)>0` at some `q∈C`.

### Theorem B: strong all-availability criterion

For a declared current state `q`, the following are equivalent:

1. For **every abstract availability vector** `a∈[0,1]^O` with at least one
   positive component, the next success occurs almost surely from `q`.
2. Every bottom class of `G` reachable from `q` supports every orientation
   in `O`.

This is a strong geometry-independent property. It is **not** asserted
necessary for safety from an empty substrate at a fixed `L,k`, or even for
all physically admissible availabilities of a special particle geometry.
For an entire adsorption process, the criterion must hold at every state
reachable through **both success and failure** updates, since a successful
placement may move the controller outside the initial forced-failure reach.

**Proof of sufficiency.** Suppose a nonleaking bottom class `C` of `F_X` were
reachable. Nonleakage means `π(o|q)a_o=0` for every `q∈C` and every orientation.
Hence all supported actions in `C` have zero success hazard. On these rows
`F_X=G`, including their outgoing entries. Thus `C` is also a reachable bottom
class of `G`, but it lacks every orientation with positive availability,
contradicting full action support. Apply Theorem A.

**Proof of necessity under the stated quantifier.** Suppose a reachable
bottom class `C` of `G` omits orientation `o*`. Set `a_(o*)=ε∈(0,1)` and all
other hazards to zero. Every positive `G` edge remains a positive `F_X` edge,
because the reweighting factors are strictly positive. Thus `C` remains
reachable, closed and nonleaking under `F_X`. By Theorem A, success is not
almost sure. ∎

The monomer (`k=1`) geometry gives a concrete limitation: the two physical
orientation hazards are always equal, so an always-H controller reaches
geometric jamming while its forced-failure action support omits V. Arbitrary
abstract availability vectors with H blocked and V legal are not realizable
for monomers. Likewise, controller-graph reachability alone does not prove
reachability of the matching occupancy/controller-state pair from empty RSA.

## 4. Closed forms for the (α,β) family

On a frozen lattice write `a=A_H/M`, `b=A_V/M`. Because orientation is the
state, the substochastic failure kernel is

```text
F = [ (1-a)(1-β)   (1-a)β     ]
    [ (1-b)β       (1-b)(1-β) ].
```

The success-transition parameter `α` does not enter this next-success episode;
it acts only after acceptance. Define

`D = ab + β(a+b−2ab)`.

Whenever `D>0`, the fundamental matrix is

```text
(I-F)^−1 = (1/D) [ b+β(1-b)   β(1-a)   ]
                  [ β(1-b)     a+β(1-a) ].
```

Its entry `N_ij` counts expected attempts in orientation `j` before the next
success, starting in `i`. Next-success orientation probabilities are
`N_ij a_j`, and expected attempt counts are its row sums:

`τ_H = [b+β(2−a−b)]/D`,

`τ_V = [a+β(2−a−b)]/D`.

The rational inverse is checked against the exact matrix identity. It is
also distinct from Stage I's deterministic failure-cycle summation.

### Corollary C: any positive failure exploration prevents policy deadlock

For `β>0` and a non-geometrically-jammed frozen lattice, `a+b>0` and `D>0`.
The forced-failure chain is irreducible on H and V, including the periodic
`β=1` case. Every failure recurrent class supports both orientations.
Therefore the next acceptance occurs almost surely. Accepted occupancy can
increase only `floor(L²/k)` times; the entire finite RSA run reaches geometric
jamming almost surely for every `α∈[0,1]`.

If both directions are legal, every attempt has success hazard at least
`1/M`, so `τ≤M`. If exactly one direction is legal with hazard `p≥1/M`, the
largest mean is `1/β+2/p−1`. A uniform finite-system bound is consequently

`E[attempts to geometric jam] ≤ floor(L²/k)(1/β+2M−1)`.

The bound is loose and is not a practical runtime prediction or a large-L
scaling law. It makes explicit why almost-sure liveness does not imply a
small kinetic cost.

For `β=0` the current direction never changes during failure. If that direction
is blocked and the other is legal, there is strict deadlock. If the current
direction is legal, its next-success waiting law is geometric with mean
`1/a_q`; `α` then chooses the post-success direction. The structural absence
of exploration can therefore cause deadlock, but does not force deadlock at
every geometry or particle size.

## 5. Singular small-exploration kinetics

Suppose H is blocked (`a=0`) and V has a fixed positive hazard `b`.
For every `β>0` the formulas reduce to

`τ_H = 1/β + 2/b − 1`,

`τ_V = 2/b − 1`.

Starting in the blocked direction, waiting diverges exactly as `1/β` as
`β→0⁺`. This conditional statement requires a one-orientation-blocked state;
when both hazards remain strictly positive, the corresponding means instead
converge to `1/a` or `1/b`. Divergence of a full-run mean additionally requires
sufficient probability of visiting such blocked-start episodes.

### Rare excursions and failure of uniform integrability

Even starting in legal V there is a singularity in the **mean**. At `β=0`,
`τ_V=1/b`; at every positive `β`, `τ_V=2/b−1`. For `0<b<1`, these differ.

The probability of entering the blocked H state before the next success is

`e_β = (1-b)β / [b+(1-b)β]`.

It follows by competing repeated V outcomes: V success has probability `b`,
switch-on-failure has probability `(1-b)β`, and stay-on-failure has probability
`(1-b)(1-β)`. Once H is entered, its return time to V is geometric with mean
`1/β`. The fundamental matrix gives expected total H attempts
`N_(V,H)=(1-b)/b`, independent of positive `β`. V attempts retain mean `1/b`.
Thus an O(β)-probability excursion with O(1/β) duration has a finite mean
contribution that persists as `β→0⁺`.

For any finite `n`, survival is exactly

`P(T_next>n | i) = [F^n 1]_i`.

The source exposes a BigInt rational matrix-power tail oracle. Starting in V,
the finite-n tails converge to `(1-b)^n`, the `β=0` geometric law: there is
weak convergence in distribution. Nevertheless the means do not converge.
Indeed, if `G_β` is the first H sojourn, its independence from the preceding
entry event gives

`P(T_next>n | V) ≥ e_β(1-β)^n`.

For fixed truncation `K`,
`e_β E[G_β 1_(G_β>K)]→(1-b)/b>0`. Hence the waiting-time family is not
uniformly integrable. This is a finite-chain rare-excursion phenomenon, not
a thermodynamic phase transition. A small fixed sample can miss most
excursions and severely underestimate the exact mean, so a tiny-β Monte Carlo
mean needs uncertainty and tail evidence rather than a smooth plotted fit.

The frozen-kernel source also returns exact second moments and variances.
With `N=(I-F)^−1` and `τ=N1`, the second moment is `2Nτ−τ`.
For the blocked-H, legal-V example with `b=1/2`,
`Var(T|V)=2/β+6` and `Var(T|H)=1/β²+1/β+6`. Thus at `β=10⁻⁴`, a legal-start
mean of three coexists with variance 20,006. At β zero that same legal-start
mean is two and its variance is two. A variance estimate from a sample that
contains no rare excursion can radically understate uncertainty.

## 6. A completely soluble two-by-two dimer system

For either boundary convention, after the first dimer there is one legal
orientation with hazard `1/2`, and the orthogonal direction is blocked.
The first acceptance occurs at attempt one. Its post-success orientation
is legal with probability `1−α` and blocked with probability `α`.

For every `β>0`:

`Eθ_terminal=1`, `P_deadlock=0`, `E|S|=1`,

`E[terminal attempts]=4+α/β`.

For `β=0`:

`Eθ_terminal=1−α/2`, `P_deadlock=α`, `E|S|=1`,

`E[recognized-terminal attempts]=3−2α`.

The zero-β stopping cost is time to diagnosis of a closed deadlock or entry
into geometric jam. It is **not** a finite next-success time from a deadlock,
which is infinite. This distinction is represented explicitly by the exact
kernel API (`null` for an infinite next-success expectation).

For `α>0`, terminal coverage and deadlock probability jump at the exploration
endpoint. At `α=0`, density stays one but the mean cost jumps from three to
four as β leaves zero. The changed recurrent structure and rare excursions
fully explain these finite-system discontinuities; they should not be called
critical phenomena or large-system packing benefit.

## 7. Special points and Stage I correspondence

| (α,β) | behaviour | Stage I reference, mixed fairly over initial H/V |
|---|---|---|
| (0,0) | retain initial direction forever | always H / always V |
| (0,1) | preserve success, switch failure | 41 / 25 |
| (1,0) | switch success, preserve failure | 38 / 22 |
| (1,1) | switch every attempt; ignores outcome | 35 / 19 |
| (1/2,1/2) | next direction independent fair coin | fair i.i.d. orientation |

For `(1,0)`, accepted rods alternate, giving `|N_H−N_V|≤1`, yet strict deadlock
is possible. For `(1,1)`, the alternation is over **attempts**, not accepted
particles, and uses no feedback. Fair initialization changes signed-order
statistics but leaves H/V-symmetric density, absolute-order and terminal-
reason observables of the corresponding deterministic Stage I references
unchanged. Tests compare those laws without changing or regenerating Stage I.

## 8. Exact reference computations and validation

`stage2/src/exact-stochastic.mjs` uses reduced BigInt rational probabilities
and the two-state inverse above. For each `(occupied mask,q)` it obtains the
next-success orientation law, chooses uniformly among that orientation's
legal anchored candidates, applies the rational post-success flip `α`, and
recurses on strictly increased occupancy. Conditional terminal distributions
retain added H/V particle counts. Expected terminal attempt costs use the
fundamental row sum plus the weighted post-success continuation costs.
Singular β-zero blocked states have terminal recognition cost zero and are
recorded separately as deadlocks.

The reference contains the nine core points
`{0,1/2,1}×{0,1/2,1}`, plus four validation pairs
`(1/4,3/4),(3/4,1/4),(0,1/4),(1,1/4)`, on `L=2,3`, `k=2`, each with periodic
and open boundaries: 52 complete absorbing laws. Their JSON includes
numerators/denominators, coverage and variance, `E|S|`, `ES`, `ES²`, `ES⁴`,
geometric/deadlock probabilities, expected recognized-terminal attempts and
expected failures. This is exact finite-system evidence, not Monte Carlo.

Thirteen tests passed in the recorded run. They include an independent global
attempt-level Markov linear system for all nine core points on both 2×2
boundaries; that oracle retains failed attempts and does not reuse the failure
inverse. Other checks cover probability conservation, special-point Stage I
comparisons, monomer coupon-collector cost `25/3` on 2×2, exact kernel
identities, survival tails, and counterexamples to overstrong liveness claims.
No website or GPU test is involved.

From the research project root, with ordinary Node on PATH:

```sh
node --test stage2/tests/exact-stochastic.test.mjs
node stage2/src/exact-stochastic.mjs
```

The generated reference is
`stage2/data/processed/exact-small-systems.json`. Source hashes include the
new exact solver and its read-only Stage I arithmetic/placement helper.
All floating values are presentation approximations; rational numerator and
denominator are authoritative.

## 9. Scientific boundary

Theorem A is necessary and sufficient for a **particular** frozen-lattice/
state pair. Theorem B concerns **all abstract** availability vectors. Neither
turns controller graph reachability into empty-start geometric reachability.
Positive β proves liveness, not high density, isotropy or fast adsorption.
Local fixed-lattice mean singularities say nothing on their own about
large-system signed-order distributions. Those packing and size questions
remain empirical and must be compared with the entire outcome-independent
temporal-null frontier, with exploration kept distinct from confirmation.

Background sources accessed 4 October 2026: the MIT primary course PDFs and
Oxford primary report linked above. The support-kernel specialization,
closed-form two-state formulas and finite-RSA endpoint consequences are
derived explicitly here; no claim of priority for general finite-chain
absorption or rare-event mathematics is made.
