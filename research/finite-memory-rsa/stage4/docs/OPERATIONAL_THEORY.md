# Physical equivalence, memory and distinguishing geometries

## Universal deterministic quotient

Consider deterministic stationary Moore controllers on all valid square L for
fixed k, with either open or periodic boundaries. Their first attempt from empty
is always successful. Delete only the unobserved initial F decision, then minimize
the full continuation rooted at δ_S(q₀). The initial F transition must still be
retained if that original state becomes reachable again after success.

**Theorem 1.** Universal operational equivalence is exactly equality of the
initial action and of these rooted arbitrary-S/F-word continuation laws.

**Proof.** Sufficiency is a same-anchor coupling. For necessity, any finite
distinguishing continuation word can be physically realized on a sufficiently
large lattice. With j accepted rods there are jk occupied cells. Each cell blocks
at most k valid anchors of each orientation, hence at most jk² are blocked.
For a word with at most J successes choose M>Jk². Both orientations retain a
legal anchor throughout; after the first success, each also has an illegal
anchor through an occupied cell. Choose a legal or illegal anchor according to
the desired S/F symbol. Every chosen anchor has probability 1/M, and no prefix
is jammed. The first differing action therefore distinguishes physical laws. □

Let the minimized post-S continuation have d states, rooted at r. Its initial
action is a₀. A state can serve both as the initial state and as a continuation
state precisely when g(q)=a₀ and δ_S(q)=r. Thus the universal minimum among
deterministic stationary realizations is

\[
m_{\rm det}=d+\mathbf1\{\nexists q:g(q)=a_0,\ \delta_S(q)=r\}.
\]

The continuation needs d distinguishable states by Theorem 1. The first state
must either be one of them satisfying the reuse condition or an extra state.
Both constructions are explicit in `src/operational.mjs`. There is no external
free first-attempt counter. The formula was also checked against the minimum
over the complete frozen ≤4-state catalogue, independently of its construction.

## Complete catalogue results

Stage III's 28534 rooted structural classes are reused, not reenumerated.
The archived catalogue normalizes H/V transposition so that the first action is
H. All class counts below are within that complete frozen catalogue; distinct
label-swapped first-V counterparts are not additionally counted. Equivalence
theorems themselves preserve the actual action labels.
Universal physical quotient: **22077 classes**; deterministic minimum 1/2/3/4
has respectively **1/11/422/21643 classes**. Exactly 2373 source controllers
reduce their state count, including 388 with the archived strict liveness flag.
Merging 6457 catalogue classes and reducing 2373 state counts are different facts.

For fixed geometry, minimize the complete reachable (mask,q) trace automaton;
then group the catalogue by its full canonical encoding and take the smallest
controller realization in each group. Hashes are indexing metadata: equality
uses full encodings, not hash coincidence. A minimized product-state count is
not itself a controller-memory count.

| L,k | boundary | physical classes | classes with deterministic minimum 1/2/3/4 |
|---|---|---:|---|
| 2,2 | periodic | 48 | 1 / 5 / 12 / 30 |
| 2,2 | open | 48 | 1 / 5 / 12 / 30 |
| 3,2 | periodic | 16212 | 1 / 11 / 390 / 15810 |
| 3,2 | open | 16212 | 1 / 11 / 390 / 15810 |

Matching counts do not assert that open and periodic laws are equal. Nonlive
controllers retain their infinite failure/action traces; controller deadlock
recognition from older experiments is not used as a geometric terminal event.
Catalogue minima are exact for deterministic realizations: every smaller
deterministic realization is represented in this catalogue. They are only upper
bounds on general randomized-feedback minimal realization.

## A genuine randomized operational-memory threshold

Controller `feedback-4-00124` actually has three structural states:

| q | output | on F | on S |
|---|---|---|---|
| 0 | H | 1 | 1 |
| 1 | H | 2 | 0 |
| 2 | V | 1 | 0 |

Initial state is 0. On 2×2 periodic domino RSA it is equivalent to the two-state
hold-on-S/toggle-on-F controller. Both H and V occur on positive histories before
jam, excluding a stationary one-state randomized realization.

On 3×3 periodic RSA use anchors numbered row-major. History SF at anchors 0,0
has actions HH and prescribes next V, probability 1/81. History SSF at anchors
0,3,0 has actions HHH and prescribes next H, probability 1/729. Both are nonjammed.
Immediately before the final F both histories prescribe H.

**Theorem 2.** No stationary two-state randomized feedback realization matches
this complete law on 3×3 periodic RSA.

**Proof.** Deterministic H and deterministic V on positive histories require,
in a two-state realization, one H-only state and one V-only state. Both pre-F
histories therefore concentrate on the same H state. Conditional on H,F its
transition kernel is identical for both histories: the environment's failure
likelihood is a common factor and cancels in conditioning. The next prescribed
action cannot be V in one case and H in the other. □

The exhibited three-state realization gives the upper bound. Thus even allowing
stationary randomized feedback, operational minimum activates **2→3 at L=3**,
for fixed k=2 periodic squares (the smallest valid L is 2). This is a demonstrated
threshold, not a full stochastic minimization of the catalogue.

## Feedback process laws cannot all be temporal

For `feedback-2-00006` (hold S/toggle F), on 3×3 periodic RSA the histories
SS at anchors 0,3 and SF at anchors 0,0 both have action prefix HH, each probability
1/81. Their next actions are H and V. A temporal controller's hidden posterior
conditional on the same planned action prefix cannot be changed by the anchor/
outcome history: anchor likelihood given actions factors out of hidden state.
Consequently no outcome-independent orientation process, even with unlimited
memory, reproduces this full feedback law. Its stationary randomized feedback
minimum is exactly two states. This is a **process-law** capability theorem;
it proves no strict gap in the three averaged objective coordinates.

## Witness algorithms and limits

Product BFS of (mask,q_A,q_B) returns the shortest distinguishing attempt-history
at a specified geometry, with positive probability M^−t. If all reachable
states agree, it certifies equivalence; if a resource cap intervenes it returns
`resource-cap`, never `equivalent`. Abstract suffix BFS followed by Theorem 1's
M>Jk² construction gives a finite distinguishing geometry for every inequivalent
pair, provided the implementation's L≤12 representation limit is not exceeded.
The bound is sufficient, not necessarily the minimum L. Ascending valid L plus
complete fixed-geometry BFS certifies a minimum only after every smaller geometry
has been closed. The activation example does so. No all-pairs minimum-geometry
table over 28534 controllers was generated, and k/boundary ordering is not given
a spurious universal notion of “smallest”.
