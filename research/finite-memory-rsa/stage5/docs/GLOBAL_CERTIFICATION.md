# Global support certification

The authoritative output is
[certificate-verification.json](../results/certificate-verification.json).
Decimal tables below are displays; exact rational numerators and denominators
in that file define the bounds.

## Complete probability domain

For two hidden states, `K_H,K_V≥0` and `(K_H+K_V)1=1`.
Each row is a four-entry simplex, giving six independent transition/emission
parameters. The initial distribution adds one parameter. For a fixed pair
of matrices the expected reward is affine in the initial distribution, so
its maximum is attained at one of the two initial-state vertices. If a
proper initial mixture gives positive weight to a state, that state's
conditional process is proper with finite cost as well. Thus maximizing
over the two vertices loses no admissible support value. The certification
includes both vertices; the local feasible search can relabel its initial
state as zero. One-state models and degenerate probabilities are included.

The matrices jointly sample the action and next state **before** the
adsorption result. Their joint probabilities are not factorized into
independent emission and transition parameters. Feedback-dependent kernels
are excluded from the null. An arbitrary mixture of HMMs need not retain a
two-state realization; only mixtures realizable by the complete matrices
are in the matched class.

## Feasible lower bounds

The predeclared protocol is [protocol.json](../experiments/protocol.json).
Eight directions were selected using only frozen objective points before
the new feasible search. Ten starts per non-density direction and bounded
dyadic stick-breaking coordinate moves produced 13,207 floating objective
evaluations. These evaluations are exploration, not certificates.

Six retained new realizations have rational probabilities and were solved
with the exact finite product-chain solver. Each saved file in `data/lower-*.json`
contains a terminal joint law and rational Bellman values. Reverse
reachability checks properness; an independent raw-anchor residual checker
checks 6,800 scalar Bellman equations. Archived feasible points are reused
with provenance hashes. Density uses the separately proved approximating
family; its support lower bound does not assert finite attainment on open
boundaries.

## Unlimited temporal word upper bound

Sample the entire outcome-independent word in advance. The mixture theorem
in [FINAL_CAPABILITY_THEOREMS.md](FINAL_CAPABILITY_THEOREMS.md) reduces the
unrestricted stochastic comparator to deterministic words.

A prefix tree propagates exact integer anchor multiplicities with denominator
`M^t`. A path is stopped at its actual geometric jam time; its terminal reward
includes that time, not the current prefix depth. For surviving occupancies,
a rational suffix supersolution allows full information and more action
choice than any temporal schedule. It accounts for the past cost `t/N`
in the terminal reward and charges future attempts conservatively using
`1/N_max≤1/N`. Allowing physical-state-dependent future choices and reducing
a nonnegative cost penalty can only increase the optimal reward.

For each physical state, the saved rational tail values satisfy the
one-step supersolution inequalities for both actions, with their uniform
anchor multiplicities, and the jam boundary values. These inequalities
bound every proper completion by finite truncation and absorption; remaining
terminal terms converge because the terminal observables are bounded and
the admissible cost is integrable. Improper completions are never assigned
an artificial favorable terminal reward.

The maximal remaining leaf is split into its two children. Splitting replaces
one cylinder of infinite words by two cylinders; retained and pruned leaves
still cover the entire space. Lattice transposition permits a first-H root:
the first-V subtree has identical support. Six directions used 20,000
expansions each, with a depth cap of 80. The actual depths were 17–28.
The budget left 240,006 recorded nodes in total, not an exhaustive depth-80
tree. An independent checker regenerates raw placements and anchor counts,
checks all prefix bounds and rational tail inequalities, and verifies the
complete partition without calling the word-bound engine.

## Two-state continuous parameter boxes

The second upper bound partitions the two four-entry row simplexes using
dyadic interval endpoints with denominator `2^20`, propagation of row-sum
constraints, and longest-side bisection. This is a covering of the continuous
parameter domain, not a search over dyadic grid points. Boundary and singular
parameters are included without inverting a potentially singular matrix.

For each box, a horizon-36 Bellman recursion maximizes a four-coefficient
linear expression over that box's bounded simplex at every physical state,
hidden state and time. Greedy bounded-simplex allocation solves this local
LP. Allowing different row choices at different physical states and times
is a relaxation of a stationary outcome-blind HMM. It therefore bounds every
HMM whose rows are in the box, including initial-state mixtures by the
vertex argument above. The horizon tail is the same conservative
full-information relaxation, not an uncharged truncation.

Each direction evaluated 2,999 tree boxes (17,994 total), within the cap of
3,000. All 9,000 terminal boxes, including pruned ones, were replayed and
the partition checked. Unit tests compare the greedy LP with an independently
enumerated dual and compare a fixed-parameter short horizon with direct
hidden-word/anchor expansion. **The parameter Bellman replay shares its
engine with generation**; it is not a completely independent implementation.
Independent raw geometry and dual tests reduce this risk without eliminating
it.

In every selected direction this box bound was looser than the unlimited
word bound. It did not tighten the final support interval. This unsuccessful
method remains in the evidence rather than being presented as a solved
global rational optimization.

## Directed arithmetic and pruning

Probability counts and rational tail values use BigInt. The final bound
engines use fixed-point integers with scale `2^48`: conversions, weighted
expectations and LP calculations round upwards, including signed quantities.
Reported upper fractions are exact quotients of these integers, not raw
floating optimizer values. Tests exercise negative ceiling division.

The integer pruning cutoff is derived from the exact feasible lower bound.
For negative lower values, JavaScript BigInt division truncates toward zero,
so the cutoff can be up to one unit above the true lower value. The final
upper explicitly includes this cutoff as well as the surviving leaf maxima.
Hence this naming/rounding detail cannot discard a value above the reported
upper. It would be incorrect to claim every pruned branch lies below the
exact unrounded feasible lower bound. The verifier checks the same covering
logic and that the exact lower never exceeds the reported upper.

## Final supports, fixed-proper scope

| Geometry | μ | ν | Certified lower | Certified upper | Width |
| --- | ---: | ---: | ---: | ---: | ---: |
| periodic | 0 | 0 | 0.888888888889 | 0.888888888889 | 0 |
| periodic | 1 | .12 | −.032359294751 | .078560569313 | .110919864064 |
| periodic | .1 | .05 | .653888888889 | .656920069686 | .003031180797 |
| open | 0 | 0 | .888888888889 | .888888888889 | 0 |
| open | 1 | .3 | −.741170873053 | −.625027191999 | .116143681054 |
| open | 1.25 | .4 | −1.238716228873 | −1.082382140935 | .156334087938 |
| open | 1.5 | .5 | −1.736094210914 | −1.538781909448 | .197312301466 |
| open | .1 | .05 | .640457328990 | .662664709658 | .022207380668 |

Let `Δ=J(F10)-J*`. From `L≤J*≤U` one gets
`J(F10)-U≤Δ≤J(F10)-L`. The four open order/cost intervals are respectively

* `(μ,ν)=(1,.3)`: `[−.109931417936033, .006212263117537]`;
* `(1.25,.4)`: `[−.148856582394992, .007477505542617]`;
* `(1.5,.5)`: `[−.188736927276613, .008575374189084]`;
* `(.1,.05)`: `[−.020910201284824, .001297179383116]`.

These are currently certified residual uncertainties, not confident estimates
of a small positive gap. They are too wide to settle the open comparison.
No strict crossing was found. The periodic all-direction support-negative
theorem is a separate dominance proof and does not require these support
intervals themselves to close. Only the two density directions close exactly.
