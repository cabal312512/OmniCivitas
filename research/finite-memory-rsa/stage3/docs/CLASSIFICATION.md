# Deterministic controller classification

This is an exact finite structural classification, not a Monte Carlo packing
result. Stage I/II sources and data are read-only inputs; this computation uses
only new Stage III code and standard Node. No PDF is produced.

## Model and observable equivalence

A rooted Moore controller has initial state 0, actions `outputs[q]` with
`0=H, 1=V`, and `transitions[q][outcome]` with `0=F, 1=S`.
It outputs its action **before** receiving the next success/failure outcome.
Two rooted controllers are behaviorally equivalent when they output the same
action string for every finite outcome word, including the empty word.
This is equivalence on arbitrary outcome words, not equality of packing means,
not equivalence only on an observed RSA trajectory, and not spatial symmetry of
an individual realized lattice.

The algorithm removes states unreachable through either outcome, refines Moore
equivalence partitions to a fixed point, forms the quotient, then numbers its
states by rooted breadth-first traversal, scanning failure before success.
A global H/V exchange normalizes the initial output to H. The canonical key is
`n:output-bits:flattened-F,S-targets`. IDs are sorted by state count and then the
key's code-point order, independent of locale. The quotient is unique under
root-preserving relabelling and H/V exchange.

The H/V quotient does not add policy randomness. For the fair-orientation RSA
ensemble, draw **one independent exchange bit per run**, XOR every action with
it, and keep that exchange fixed throughout the run. Drawing a fresh exchange
at each attempt would define a different controller and destroy its memory.

## Exact counts

Counts identify classes under the equivalence above. “At most n states” is a
memory budget, so smaller minimized controllers remain eligible.

| Available states | Feedback labels | Feedback classes | Universally live feedback classes | Temporal labels | Temporal classes | Universally live temporal classes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 1 | 0 | 2 | 1 | 0 |
| 2 | 64 | 13 | 4 | 16 | 3 | 1 |
| 3 | 5832 | 527 | 166 | 216 | 9 | 5 |
| 4 | 1048576 | 28534 | 8730 | 4096 | 24 | 16 |

One, two and four states correspond to deterministic 0-, 1- and 2-bit memory
budgets. Three states is an informative intermediate budget, implementable in
two bits. A stochastic memoryless policy that independently draws H/V on every
attempt is outside this deterministic enumeration and must not be conflated
with its constant-output one-state classes.

For exactly n **minimal** states, the corresponding counts are:

| Minimal states | Feedback classes | Live feedback | Temporal classes | Live temporal |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 0 | 1 | 0 |
| 2 | 12 | 4 | 2 | 1 |
| 3 | 514 | 162 | 6 | 4 |
| 4 | 28007 | 8564 | 15 | 11 |

Thus outcome feedback already adds expressible deterministic behaviors with
one bit. These counts do **not** establish useful packing advantage with one
bit, two bits, or any memory budget; that question requires the matched-memory
performance comparison. Only the strictly live classes are the primary
competitors under the present research design.

## Temporal equivalence is checked after minimization

A temporal controller uses a single map `f(q)`, so its two outcome targets agree.
Conversely, a minimized reachable Moore machine has outcome-independent action
behavior if and only if its failure and success targets agree at every state.
If different targets produced the same suffix behavior, Moore minimization
would have merged them. If different targets remain, a distinguishing suffix
word proves outcome dependence.

The complete 24-class temporal catalogue exactly equals the subset marked
`temporalEquivalent` in the four-state feedback catalogue. Original feedback
graphs may have different target labels that nevertheless merge to a temporal
behavior; testing only the original syntax would miss these degeneracies.

## Universal liveness certificate and its scope

For each outcome-reachable state, follow the deterministic failure map.
Every path eventually enters one of its directed cycles. Mark a controller
universally live if and only if **each such failure cycle contains both H and V**.
The catalogue lists all cycles and, for each monochromatic cycle, an explicit
deadlock certificate: permanently attempted action, opposite potentially legal
action, and cycle states.

For a frozen two-action system with success probabilities `a_H,a_V`, independent
uniform trial anchors and at least one positive `a`, this condition ensures a
next acceptance almost surely from every reachable controller state. If both
probabilities are positive, every attempt has a positive success lower bound.
If only one is positive, every failure cycle visits that action, with a positive
chance of acceptance on each traversal. A finite transient and a finite number
of states then give geometric decay in blocks. Success updates preserve
outcome-reachability, so the reasoning can be repeated after every acceptance.
On a finite RSA lattice there are finitely many acceptances, and termination
can therefore occur only at geometric jam.

Necessity applies to this **abstract universal frozen-geometry/all-reachable-
states requirement**: in a monochromatic failure cycle, make its output action
illegal and the other legal. Failure transitions remain trapped forever.
This is not a claim that the witness geometry is reachable from an empty RSA
lattice at every L/k, nor a necessary condition for one particular geometry.
For example, one fixed orientation fills a monomer lattice but fails the
two-action universal certificate. There is no finite “too many failures”
cutoff masquerading as geometric jam.

This is a specialization of finite failure-kernel/support-graph liveness,
not a claim to have invented a general Markov-chain theorem.

## Independent counting and proofs

### Accessible transition graphs

Let `A_n` count rooted labelled n-state accessible graphs with d transition
symbols, before outputs are assigned. Counting a general graph by the size r
of its root-reachable set gives the exact recurrence

`A_n = n^(d*n) - sum_{r=1}^{n-1} choose(n-1,r-1) A_r n^(d*(n-r))`.

The reachable set contains the root; its outgoing targets stay inside it, and
all unreachable-state targets are unrestricted. These cases are disjoint and
exhaustive. A root-preserving automorphism of an accessible deterministic graph
fixes every state reached by every word, hence is the identity. Each accessible
unlabelled graph consequently has exactly `(n-1)!` rooted labellings.

For d=2, `A_n` at n=1..4 is `1,12,432,31488`, giving canonical topology counts
`1,12,216,5248`. For d=1 the canonical topology counts are `1,2,3,4`.
The latter are the possible tail/cycle splits of a rooted functional graph.

The independent generator traverses all BFS restricted-growth target strings
and all `2^(n-1)` root-H output assignments. It tests minimality by a
**pair-distinguishability table**, independently of the main partition-
refinement implementation. Its exact keys agree with the labelled enumeration
through n=4. It inspects only 41984 root-H output/topology pairs at n=4,
separately from the 1048576 labelled enumeration.

Each exactly-four-state minimal class has `2*(4-1)!=12` labelled representatives
(two global orientations and six root-preserving state permutations).
Thus `28007*12=336084` is independently checked against the labelled
multiplicity sum for those classes. Smaller quotient classes have varying
weights because redundant/unreachable states can be extended in different
ways; their actual multiplicities are retained rather than treated uniformly.

### Closed temporal sequence count

A rooted temporal behavior is an ultimately periodic binary word with minimal
preperiod μ and primitive period λ; its minimal number of Moore states is
`μ+λ`. Let `P_λ` be the number of primitive labelled binary period words.
It satisfies `P_λ = 2^λ - sum_{d|λ,d<λ} P_d`.

For μ=0 there are `P_λ` rooted words. For μ>0, the final prefix action must
differ from the cyclic predecessor action; otherwise the preperiod shortens.
The remaining μ−1 prefix actions are arbitrary, giving `2^(μ-1) P_λ` words.
Dividing by the free global H/V exchange yields the exact minimal-state count

`M_n = (P_n + sum_{λ=1}^{n-1} 2^(n-λ-1) P_λ)/2`.

This independently gives `M_1..M_4 = 1,2,6,15`. A primitive period greater than
one contains both actions and is live. Period one is nonlive, giving live
minimal counts `0,1,4,11`. Cumulative temporal totals are therefore `1,3,9,24`
and live totals `0,1,5,16`, matching both graph enumerations. The sequence
formula, unlike an observed pattern in Monte Carlo results, is a counting
argument valid under the stated equivalence.

## Label degeneracy and weights

Of the 1048576 four-state feedback labels, 544768 have unreachable states,
375852 merge at least two reachable states, 285184 reduce to a constant action,
323992 have temporal-equivalent behavior, and 226848 are universally live.
These categories **overlap** and must not be summed as a partition.

The disjoint labelled weights by minimal state count 1/2/3/4 are respectively
`285184,153000,274308,336084`, summing exactly to 1048576. Both root orientations
have identical weights in every behavior class. Catalogue entries retain
`labelledMultiplicity`, `labelledRootHorizontal`, `labelledRootVertical` and
the first labelled representative. Neither duplicate labels nor fair exchange
are extra scientific replicates.

## Artefacts and API

Run from the Stage III directory:

```sh
node scripts/classify-controllers.mjs
node --test tests/controllers.test.mjs
```

The classifier accepts an optional `--output DIRECTORY`. Public commands use
relative paths or that explicit argument; no drive layout or dependency is
hardcoded. Windows development uses the project's environment wrapper.

- `src/controllers.mjs`: validation, decoder, canonicalization, certificates,
  labelled enumeration, independent graph/minimality enumeration and formulas.
- `data/classification/feedback-{1,2,3,4}.json`: complete reachable minimal
  representatives, sorted IDs, certificates and labelled weights.
- `data/classification/temporal-{1,2,3,4}.json`: complete matched-memory nulls.
- `*.labelled-to-class.u32le`: unsigned32 little-endian audit map; array
  position is the labelled index and value is the catalogue's numeric `id`.
- `data/classification/summary.json`: exact counts, independent checks,
  source hash, file hashes, generated time and runtime; elapsed time is
  diagnostic rather than a scientific observable.

The low n bits of a labelled index encode outputs q=0..n−1. Remaining
base-n digits encode each state's failure then success target; temporal
decoding uses one target digit per state and duplicates it into `[F,S]`.
Simulator code should retain the string `classId` or `key` in results; numeric
`id` is the dense lookup index. All representatives have `initial:0` and
`minimalStateCount` states. Screening may restrict the four-state catalogue
by minimal state count without enumerating redundant labels again.

Ten necessary unit tests passed, including all 5832 labelled three-state
machines for independent minimality agreement, explicit outcome-word behavior
checks, H/V and state-label invariance, temporal inclusion, success-only
reachable deadlock cycles, malformed inputs and both counting formulas.
The full four-state run separately verified all independent key sets,
multiplicity sums, orientation pairing and temporal-subset equality.
No packing superiority, asymptotic limit, novelty claim or performance
confirmation follows from these structural counts alone.
