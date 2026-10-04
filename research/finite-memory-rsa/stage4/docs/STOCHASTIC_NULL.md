# The complete stochastic temporal null

## Model and observables

An attempt chooses H or V and a uniformly sampled **valid anchor** of that
orientation. Open boundaries have M=L(L-k+1) anchors per orientation; periodic
boundaries have M=L². Duplicate periodic footprints remain distinct anchors.
Overlapping rods fail; nonoverlapping rods are accepted. Stop only at geometric
jam, when neither orientation has a legal anchor. A controller deadlock is not
jam. All comparisons start from the empty lattice.

The observable law includes actions, outcomes, occupancies, stopping time and
terminal occupancy/counts. Anchor-labelled histories give convenient positive
witnesses; deterministic decisions depend only on their outcome histories, so
the distinctions used here remain observable without anchor labels.

A stationary n-state temporal controller, 1≤n≤4, is

\[
\pi\ge0,\quad \pi\mathbf1=1,\qquad K_H,K_V\ge0,
\qquad (K_H+K_V)\mathbf1=\mathbf1.
\]

Given state q, draw (action a,next state r) jointly with probability K_a(q,r).
The next-state law must be identical on success and failure. Its planned word
law is p(a₁…a_t)=πK_{a₁}…K_{a_t}1. Joint emission/update is essential: an
emission coin followed by an action-independent transition is a strict subfamily.
The interior dimension, including initial distribution, is 2n²−1: 1,7,17,31.
IID coins, switching chains, deterministic cycles and finite mixtures are useful
examples, not an exhaustive null.

Initial random state is charged to the same n states. A persistent external
orientation coin, phase counter or random controller selector is not free memory.
Controller randomness is independent of anchor randomness. Probabilities are
fixed in time; no outcome-dependent parameter update is hidden in this model.

## Representations and equivalence

State permutations, unreachable states and unobservable linear directions create
redundancy. More generally, an invertible S with S1=1 gives
π'=πS and K'_a=S⁻¹K_aS. When π' and K'_a remain nonnegative, this is a valid
positive realization with exactly the same word law. It need not be a permutation.
`results/hmm-structure.json` contains a rational, strictly positive two-state
example and its explicit non-permutation transformation.

For two rational realizations, start with row [π₁,−π₂], extend independent rows
under the two block-diagonal symbol matrices, and test their sums. If every row
in the reachable span annihilates 1, all word probabilities agree; otherwise the
generated word is an exact witness. At most n₁+n₂ independent rows are needed.
This is the classical weighted/probabilistic-automaton equivalence method, not
a new general HMM theorem. No sampling tolerance enters the decision.

The Hankel matrix H(u,v)=p(uv) has rank at most any realization's state count.
Compute this rank by reachable-row and observable-column spans. Rank=n together
with a valid n-state realization certifies minimal **positive temporal** state
count n. Rank<n only gives a lower bound: a linear reduction can lose positivity.
Recorded true edge examples have ranks 2,3,4, and the fair IID example rank 1.
General minimal positive realization is not solved by these examples.

## A fixed-geometry identification theorem

**Theorem.** On any valid square geometry L≥2 and 1≤k≤L, two temporal
controllers are operationally equivalent iff their complete planned word laws
are equal, even when their hidden representations differ.

**Proof.** Fix any finite orientation word. Accept its first rod at an anchor
containing cell 0. There are still legal anchors of that same orientation in
another row/column, so the resulting occupancy is not jammed. For every later
orientation choose a failed anchor containing cell 0. Occupancy never changes
and the run cannot stop. The probability of the observable first-footprint,
then-all-failure trace equals the word probability times a strictly positive,
known geometry factor: first-footprint multiplicity divided by M, followed by
the number of failed anchors of each prescribed orientation divided by M.
This factor is independent of hidden state. Thus equality of all operational
traces recovers equality of every word probability. Conversely, equal word laws
coupled to the same independent anchors give equal complete RSA laws. □

Consequently the minimal positive **temporal** realization does not shrink with
these geometries. This does not identify a temporal process's minimum among
feedback realizations. It also does not extend the deterministic-feedback Moore
quotient to arbitrary randomized feedback.

## Exact absorption and liveness scopes

Use product states (occupancy mask,accepted-H count,hidden state). Occupancy
strictly increases at success. Within one occupancy the rational failure matrix
is F_x(q,r)=Σ_a K_a^F(q,r)(M−legal_a(x))/M. Causal feedback kernels must have
the same action row mass on S and F. Temporal kernels also satisfy K_a^F=K_a^S.
Remove unreachable **product** states before inverting I−F_x. Invertibility on
all reachable blocks is checked; a reachable nonabsorbing block is rejected.

For terminal N>0 use θ=kN/L², |S|=|2N_H−N|/N and inverse N. The cost obeys
C_x=(I−F_x)⁻¹(b_C+r_x), where r_x is the solved expected terminal inverse N
and b_C is the success-child cost contribution. This charges each attempted
trial by its eventual 1/N, so it computes E[A/N], not E[A]/E[N]. Terminal joint
(mask,N_H) probabilities and their attempt first-moment masses are retained.
Their weighted sum is separately checked against the cost. The complete time
law is specified by the absorbing product model; it is not stored as an infinite
list of stopping-time probabilities.

The entries are rational functions of controller parameters wherever the relevant
blocks are proper. Singular parameter boundaries require reachability analysis;
they cannot be silently evaluated by an interior inverse.

Two liveness scopes are kept separate. **Fixed-geometry properness** means
almost-sure finite jam for this L,k,boundary. **Abstract universal temporal
liveness** excludes every reachable closed hidden-state set emitting only one
orientation; this suffices to attempt both orientations indefinitely whenever
needed. The latter is stronger. H-once-V-forever is proper on the periodic 3×3
domino geometry and is not abstract-universally live; it is improper on open 3×3.

Independent one-attempt Bellman residuals and reverse paths to jam verify the
two refined points and the proper boundary point: 3384 exact scalar equations.
This checker does not invert failure blocks or rerun the solver's recursion.
