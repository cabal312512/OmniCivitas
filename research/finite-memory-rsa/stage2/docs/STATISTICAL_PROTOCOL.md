# Stage II statistical protocol

This stage studies stochastic one-bit outcome feedback while leaving every Stage I
source, raw result, lock and conclusion unchanged. This document is written before
Stage II confirmation. Exploratory parameter grids are not a confirmatory sample.
The final experiment sizes, seed blocks and selected comparison family are recorded
in a separate immutable JSON lock before its new-seed simulations begin.

## Model and sampling unit

After a successful proposal the orientation flips with probability alpha; after a
failed proposal it flips with probability beta. The initial H/V direction is a
fair random draw in every arm. Candidate anchors remain uniform; controllers see
only success/failure. At alpha=beta=p the orientation chain is independent of
outcomes, giving the temporal-null line, including persistent p=0, IID p=.5 and
alternating p=1 endpoints. Equal orientation labels under a fair ensemble do not
imply balanced individual realizations.

One independent lattice run is one observation. Attempts, particles, grid sites,
bins and exact-solver states are not independent replicates. Common seeds within a
comparison pair give a valid paired design, without guaranteeing useful variance
reduction. Different sizes use independently allocated seed blocks; a curve does
not constitute repeated measurements of one lattice or more runs at one size.

The intended exploration retains the entire alpha/beta grid, the entire tested
diagonal and any explicitly recorded refinement near small alpha, large beta.
The implemented coarse grid is 21x21 at L=64,k=4,8 with 64 runs per point;
50 refinement points use 128 runs at the same sizes. Identical evaluated
parameters across these independent pilot blocks can be pooled in an explicitly
named combined exploration summary. The original per-experiment groups remain,
and the pooled observations are never counted as new simulations.
After those pilot results suggested balanced-success/failure-exploration behavior,
an explicitly exploratory 33-point refinement of alpha=.95,.99,1 and eleven
small beta values adds 128 runs per point at both k=4,8. This adaptation occurs
before holdout and is included in its seed-exclusion/hash record, not retroactively
called preregistered confirmation.
Pilot t intervals and distribution bands describe the observed groups; adaptive
choice and pooling of previously seen points do not receive a claim of nominal
post-selection coverage. All pilot rankings/frontiers and their intervals remain
exploratory. Formal inferential conclusions use the independent locked holdout.
There is no inferential declaration that a finite grid represents every real-valued
controller. The large-size investigation compares policy41, fair orientation and
strict alternation at k=4,8 and L=128,256,512,1024,2048, subject to actual recorded
replicate counts. No result is asserted before those simulations exist.

## Terminal versus kinetic observables

For N accepted rods, S=(N_H-N_V)/N and theta=k*N/L^2. Primary descriptive outcomes
are terminal theta, |S|, signed S, S^2 and S^4, geometric-jam and controller-deadlock
probabilities. A deadlock leaves legal placements; a geometric jam does not.
Runs terminating with deadlock remain in terminal averages. Failed-step limits
must not be mistaken for terminal states. The simulator's exact/support-graph
termination definition and phase-type waiting algorithm are documented separately.

An event engine can produce a correct terminal distribution while reporting only
conditional expectations of skipped waiting times. Such fields are named
`expected_attempts`, `expected_failures`, optionally `expected_switches`, and
`kinetic_kind=conditional-expectation`. They are not sampled attempts. Their
run-to-run uncertainty concerns the conditional-expectation statistic and does
not include the omitted conditional waiting-time variance. Direct simulation or
an exact discrete waiting-time sampler instead reports `actual_attempts`,
`actual_failures`, `actual_switches` and `kinetic_kind=sampled-actual`. The Stage II
event engine uses a joint residence-cycle / negative-binomial waiting sampler,
with an exact Gamma-Poisson construction and rejection sampling rather than a
normal approximation. These actual waiting realizations remain distinct from
the diagnostic `conditional_mean_attempts_sum`. Here exact refers to the ideal
distributional identities: the implementation still uses a discrete seeded PRNG,
IEEE arithmetic and finite Stirling/deviance series inside rejection decisions.
The supported parameter range and numerical audit are recorded in
`SIMULATOR_REVIEW.md`; no arbitrary-precision claim is made. Infinite failed tails after
certified deadlock/jam are
excluded from the finite pre-termination cost in both cases. No plot pools these
two estimands. A ratio of conditional expectations is not the expected ratio of
sampled counts.

`accepted_pairs=N-1` and `accepted_switches` count adjacent accepted-rod directions.
The statistic `accepted_lag1=1-2*accepted_switches/accepted_pairs` is the empirical
mean product of adjacent +/-1 accepted orientations, not a centered Pearson
correlation and not proposal-level persistence. It may change because adsorption
filters proposals. For N<2 it is missing, not zero. When available, the expected
proposal switch fraction has a separate label and denominator. Endpoint/final
orientation updates that do not precede another proposal must be specified by
the engine, rather than silently included as observed orientation pairs.
The actual proposal statistic uses denominator `actual_attempts-1`, named
`trial_switch_fraction` and `trial_lag1`; it excludes the final success update
without another proposal. The actual counts include sampled skipped failures
from the exact event sampler. Full accepted-run histograms are saved for every
run; trial histograms absent from event-engine output remain unavailable, rather
than reconstructed as observed samples from a conditional expectation. Pooled
histogram counts describe sequence runs, not independent inferential replicates.

## Descriptive uncertainty and distribution evidence

Use mean, sample SD (n-1), SE and pointwise 95% Student-t confidence intervals for
run-level scalar outcomes. These are exact for independent normal observations
and approximate otherwise. Small-n or bimodal S distributions are shown, not
hidden by their signed mean. n=1 has no estimated variance or t interval.
Deadlock and jam probabilities use Wilson intervals. Zero observed deadlocks
do not prove zero probability.

Every signed-S distribution retains the sorted observations, fixed common bins,
type-7 empirical quantiles and an empirical CDF. A Dvoretzky-Kiefer-Wolfowitz
band has epsilon=sqrt(log(2/alpha)/(2*n)), valid uniformly in S for independent
identically distributed runs within that group. Quantile intervals invert that
band conservatively; if an inverted tail is outside [0,1], the known support
endpoint -1 or +1 is used. Pointwise/group-wise confidence labels are retained;
these distribution bands are not automatically simultaneous over every policy.
Display signed S, |S|, E[S^2], E[S^4] and quantiles rather than inferring isotropy
from E[S] alone. The optional Binder-style moment ratio is descriptive and has
no unsupported error bar. No automated bimodality, phase-transition or infinite-
size declaration follows from a histogram or finite-size curve.

## Frontiers and persistence matching

All evaluated points stay in the data and plots. Sample Pareto membership maximizes
mean theta and minimizes mean |S| within the same L,k,boundary,initialization and
engine/kinetic stratum. The temporal-null sample frontier uses only alpha=beta;
ties and dominated points remain available. These noisy sample frontiers are
exploratory. An apparent excess over eligible null means is not a p-value or
proof of continuum dominance.

When exploration identifies a candidate, choose persistence-matched diagonal
controls using only pilot groups under a stated distance, tie-break and grid.
Default matching minimizes the absolute difference of mean `accepted_lag1`;
an expected proposal-switch fraction is a separate optional match, not an
interchangeable notion. Record the chosen p, both pilot estimates, their CIs,
absolute mismatch, and whether the pilot candidate has diagonal controls with
no greater mean |S|. Selecting the maximum-coverage anisotropy-eligible null is
also pilot selection and must be frozen. Do not choose or retune p from holdout
data. Testing one matched null supports that comparison, not all null controllers.
Claims against all tested fixed nulls require all relevant locked contrasts.
An additional analytically matched proposal-persistence null can use p equal to
the pilot mean trial switch fraction, because a diagonal controller flips every
proposal pair independently with probability p. The explicit lock records the
pilot controller, experiments, L,k,boundary, statistic, n, SE and CI producing p.
This new null has no fabricated pilot coverage or accepted-persistence estimate.
It is then simulated on fresh holdout seeds. Its trial-persistence match does not
imply that its accepted sequence, entire run-length distribution or evolving
adsorption trajectory matches. An accepted-lag target outside the tested null
range is reported as out of range, rather than relabeled a good nearest match.
In particular, equality of the per-step flip parameter and a pilot run-mean
switch fraction is not an assertion of exact equality of the null's stopped-run
ratio expectation. Holdout reports its actual ratio and paired matching residual,
descriptively and without another test or adjustment. Matching-source signatures
and seeds must be unique, and the source must be the compared candidate at the
same k/boundary. A parameter transported from pilot L=64 to a larger L remains
frozen; no claim of an empirical match at the larger size precedes its data.

## Independent confirmation and whole-family correction

Before generating holdout runs, freeze candidate alpha/beta, baseline parameters,
initialization, L,k,boundary, replicate count, exact seed block, metric, direction,
null difference/margin and selection rationale. The lock contains an explicit
list of tests; a changed candidate or new size requires a new independent family.
Pilot and holdout seed blocks are disjoint, including any supplied pilot files.
Input hashes, analysis hash and the read-only Stage I numerical-import hash are
recorded. Neither the existing Stage I 36 tests nor their seeds are reused as
Stage II confirmation evidence.

Each intended improvement comparison includes a paired coverage effect and a
paired |S| non-inferiority contrast. Coverage defaults to a two-sided paired t
test of zero difference, allowing harm as well as benefit; an improvement also
requires its estimated effect to be positive. The non-inferiority null is
H0: E[|S|_candidate-|S|_null] >= margin, with a one-sided lower-tail alternative.
The margin must be justified and fixed before holdout (e.g. .01 absolute S units,
if selected, not a retrospectively enlarged value). Failure to reject is not
equivalence or proof of inferiority. A margin zero is the stricter superiority
comparison; it cannot certify equal anisotropy by accepting its null.

Holm correction at family alpha=.05 covers the complete explicit family of both
coverage and non-inferiority hypotheses across all selected arms and strata.
Incomplete pairs, unexpected/missing seeds and undefined tests retain p=1 in
their family slot. Runs are paired by exact string seed, not file order. A
degenerate nonzero paired difference has an undefined t p-value, never an
automatic p=0. Report effect sizes and pointwise CIs plus Bonferroni simultaneous
two-sided effect intervals / one-sided non-inferiority upper bounds. Holm p-values
do not turn ordinary pointwise CIs into simultaneous intervals. A claimed joint
benefit needs both correctly directed, adjusted rejections for the locked pair.

Large-size baseline effects and any later refinement remain descriptive unless
included in a separately sealed independent family. Retain signed distributions
and sample sizes at every L. Do not fit a thermodynamic limit by default. Any
future fit needs its assumptions, fitting range, residuals, competing models,
small-size sensitivity and independent confirmation; slow crossover remains a
permitted unresolved conclusion. No conclusion about all one-bit controllers
or the necessity of two bits is drawn from finite grids.

## Files and standard commands

Required terminal columns are `experiment,controller,L,k,boundary,seed,alpha,beta,
initial_mode,initial_orientation,engine,kinetic_kind,particles,horizontal,vertical,
coverage,order,abs_order,deadlock,legal_h,legal_v,elapsed_ms`. Kinetic and accepted-
sequence columns described above are optional but must be complete within a row
and consistent with their stated meaning. Missing observables stay null.

```sh
node stage2/analysis/summarize.mjs --input "stage2/data/raw/*.csv" --output stage2/data/processed/pilot
node stage2/analysis/summarize.mjs --input stage2/data/raw/landscape.csv --output stage2/data/processed/pilot --lock-spec stage2/docs/family-spec.json --write-lock stage2/docs/confirmation-lock.json
node stage2/analysis/summarize.mjs --input "stage2/data/raw/*.csv" --output stage2/data/processed --lock stage2/docs/confirmation-lock.json
python stage2/analysis/figures.py --input stage2/data/processed --output stage2/figures
node --test stage2/tests/statistics.test.mjs
```

Node analysis imports only the existing dependency-free Stage I numerical/CSV
functions, read-only. Python uses already available NumPy/Matplotlib. Sources,
data, processed summaries and graphics are separate. The analyzer audits schema,
count/coverage/order identities, optional-column missingness, duplicate run keys,
stratum consistency, all pair counts, seed leakage and the locked family size.
No website, Docker, package install or Stage I recomputation is part of this stage.

The distribution band follows the DKW-Massart inequality; see
[Massart (1990), original paper](https://doi.org/10.1214/aop/1176990746) and the
[independent proof and theorem statements in Reeve (2024)](https://arxiv.org/html/2403.16651v1).
The implementation uses the standard two-sided conservative bound, not Reeve's
sharper local refinements. Student-t, Wilson and Holm numerical routines and their
method references remain in the read-only Stage I analysis and protocol.
