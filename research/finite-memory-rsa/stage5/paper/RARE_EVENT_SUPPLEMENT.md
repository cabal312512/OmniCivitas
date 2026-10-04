# Rare-event kinetics and estimation: archived technical supplement

This supplement reorganizes existing results. No new rare-event model,
Monte Carlo dataset or real-RSA splitting experiment was introduced in the
closing study. These methodological results are separate from the capability
theorems in [the main manuscript](FINAL_MANUSCRIPT.md).

## Singular exploration and endpoint hazards

Small exploration probabilities can make a controller proper while making
its absorption time extremely variable. The archived randomized-feedback
analysis distinguishes blocked waiting of order `1/β` from rare entry into
a long-lived excursion. In a suitable scaling, the mean contribution stays
finite while the second moment diverges. Convergence of a bounded terminal
observable therefore need not imply convergence of the attempt cost.
Substituting the exploration parameter's zero endpoint before taking an
expectation can change the admissibility class or lose a rare tail.

Archived diagnostic examples include seven waiting-time mean calculations;
one ordinary confidence interval missed its known target, while the recorded
conservative Chebyshev bounds covered their targets. These examples diagnose
estimation difficulty, not an improved RSA packing policy. They should not
be folded into the main RSA Monte Carlo sample totals.

## Positive forest expansions

For finite killed chains, Green functions and hitting times can be represented
through positive graph/forest sums. The matrix-tree and all-minors background
is classical, particularly Chaiken and Chebotarev–Agaev. The archived use
extracts small-parameter valuations without cancellation in determinant
expressions. Controllers with persistent excursion memory and those with
reset memory can have the same shortest escape length but different mean
exponents; an escape-path length alone does not determine the kinetic pole.

Higher moments use layered products of positive Green-function terms,
combined with the standard factorial-moment and Stirling-number relations
for discrete phase-type distributions. Six archived kernels were checked
at orders one through six, giving 36 leading terms. The graph route called
no determinant routine. For entry rate `ε³` and dwell scale `ε⁻²`, recorded
raw-moment pole orders are `[0,1,3,5,7,9]`; at the critical `ε⁴` entry scaling
the second-moment constant is three, decomposing as `1+2`. A hazard
`ε²/(1+ε)` produces order-j coefficient `j!` and pole order `2j` in the
recorded benchmark. These are explicit finite-kernel results, not general
laws for arbitrary adsorption controllers.

## Splitting with an unknown entry probability

The archived ideal oracle estimator does not require supplying the rare
entry probability as known input. Fixed-population level weights and the
terminal dwell contribution give an unbiased estimator under the declared
sampling/resampling assumptions. This is an application of classical
multilevel splitting and sequential Monte Carlo ideas, not a claim to have
invented particle splitting.

For the product benchmark with three level probabilities `q_i=ε` and
terminal dwell hazard `p=ε³`, the contribution is one and the exact relative
variance is

`∏_{i=1}^3 [1+(1-q_i)/(N q_i)] · [1+(1-p)/N] − 1`.

The archived experiment retained 128 batches and 64,019 dwell samples,
521,233 oracle calls and 192,000 resampling operations. At `ε=.02`, 31 of
32 naive batches had no entry, compared with zero empty-entry splitting
batches. Finite-grid observations do not establish a uniform joint limit
as ε and population size vary. The computational cost includes resampling;
finite PRNG and floating arithmetic qualify the ideal unbiasedness statement.

A credible real-RSA excursion requires a physically meaningful level design
and validation. None was already available at negligible cost, so the
optional proof-of-concept was deliberately omitted rather than filled with
a contrived favorable example. No future experiment is started automatically.

## Provenance and classical sources

The underlying sources and outputs are frozen under `stage2/`,
`stage3/` and `stage4/` relative to the research root. The final
[evidence index](../results/FINAL_EVIDENCE_MANIFEST.json) supplies their
paths and hashes; it labels them archived rather than recomputed.

* Chaiken (1982), all-minors matrix-tree theorem:
  [SIAM](https://epubs.siam.org/doi/10.1137/0603033).
* Chebotarev and Agaev (2002), forest matrices and Laplacians:
  [Author preprint](https://arxiv.org/abs/math/0508178).
* Bo Friis Nielsen, discrete phase-type lecture notes (DTU, October 2022),
  especially factorial/raw moments:
  [Course notes](https://www2.imm.dtu.dk/courses/02407/lectnotes/ftf.pdf).
* Glasserman, Heidelberger, Shahabuddin and Zajic (1999), multilevel splitting:
  [Operations Research](https://pubsonline.informs.org/doi/10.1287/opre.47.4.585).
* Del Moral, Doucet and Jasra (2006), sequential Monte Carlo samplers:
  [JRSS B](https://doi.org/10.1111/j.1467-9868.2006.00553.x),
  [Author PDF](https://www.stats.ox.ac.uk/~doucet/delmoral_doucet_jasra_sequentialmontecarlosamplersJRSSB.pdf).

Full access and scope notes are in
[FINAL_LITERATURE.md](../docs/FINAL_LITERATURE.md).
