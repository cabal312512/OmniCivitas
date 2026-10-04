# Statistical protocol: finite-memory lattice RSA

This protocol separates exploratory enumeration, locked independent confirmation,
and descriptive finite-size studies. It is a methods document, not a result. The
model, controller coding and exact termination proofs are specified separately.
The website remains outside this independent research project.

## Sampling unit and outcomes

One independently seeded complete lattice run is one replicate. Attempts,
particles, sites, pixels and controller states within that run are dependent and
must never inflate the replicate count. Common random seeds may pair different
controllers within a stratum; they do not pair different system sizes into an
independent sample. A seed is explicit and unique for each
`experiment, controller, L, k, boundary` key.

The primary outcome is **terminal coverage**
`theta = k*(N_H+N_V)/L^2`. "Terminal" includes two different events:
geometric jamming (zero legal placements in both orientations) and
controller-induced deadlock (some legal placements remain but the policy cannot
reach a successful orientation under its actual feedback dynamics). The simulator
must identify these exactly rather than by an arbitrary consecutive-failure cap.
Do not call every terminal value a geometric-jamming coverage.

The isotropy statistic is the run-wise absolute orientation order,
`abs_order = |(N_H-N_V)/(N_H+N_V)|`, followed by its ensemble mean. The prespecified
descriptive isotropy threshold is **mean(abs_order) <= 0.1**. Signed mean order is
diagnostic only. An ensemble containing equal numbers of purely horizontal and
purely vertical runs has signed mean order zero and mean absolute order one; it
is not macroscopically isotropic on individual realizations.

Other outcomes are deadlock frequency, residual legal placements, particles,
attempts, failures and per-run failure fraction. Wall time is recorded for
reproducibility, not treated as a hardware-independent scientific outcome.
Event-driven simulation may reconstruct the total number of failed attempts
without their individual orientations. Missing `attempted_h` and `attempted_v`
then remain empty/null, not zero; their summary sample size can be smaller than
the number of runs. Information-theoretic or temporal-correlation estimates
require explicit direct trajectories with the actual action/feedback sequence;
they cannot be reconstructed from total counts or an arbitrary time-thinned log.

## Exploration and selection

The planned atlas includes all 64 deterministic one-bit controller codes at
L=16,32; k=2,3,4,8; initially 64 independent seeds per cell. Boundary conditions
are explicit; open and periodic results are never silently pooled. The exact
controller-equivalence analysis distinguishes state relabeling from an actual
change of initial state and H/V exchange. Multiple codes from the same behavior
class are not treated as independent discoveries.

The atlas is exploratory. Its rankings, sample Pareto frontier, apparent
deadlock rarity and uncertainty bars guide selection, but no hypothesis-testing
claim is made about a winner chosen from those same data. Retain all controllers,
including negative results and degenerate always-H/always-V cases. A memoryless
fair-coin baseline is mandatory. Fixed probability-bias baselines and the
previously published orientation-persistence/relaxation RSA rule must be
distinguished from a new feedback concept; the existence of the latter prevents
claiming that success/failure feedback itself is novel.

Before generating confirmation results, write a specification containing:

- Pilot experiment labels, selected controller IDs and behavioral rationale.
- Confirmation experiment labels and fixed `(L,k,boundary)` strata.
- Baseline IDs and the exact comparisons. If a bias grid is used, either choose
  a comparator on pilot data and lock it, or test against **every** specified
  grid point with correction. Do not select the best bias on confirmation data
  and then present it as one prespecified comparison.
- Expected replicate count and disjoint pilot/confirmation seeds.
- Primary outcome, alpha, isotropy threshold, and the selection rule.

`analysis/summarize.mjs --lock-spec ... --write-lock ...` seals a JSON lock with
pilot file hashes, pilot seeds, code hash and UTC time. It refuses to overwrite
an existing lock or seal a lock with confirmation data supplied. This is local
preregistration, not a public registry or cryptographic proof of temporal
priority. Preserve the lock with the run manifest and research log. Changes
after looking at confirmation results create a new exploratory analysis and
require new independent confirmation data; they do not replace the original.

An initial eight-code proposal was superseded after the complete atlas and
rooted behavioral quotient were available. The pilot contains 33,280 runs and
520 cells: 64 controllers plus fair coin, two sizes and four lengths, 64 seeds
each. Its raw CSV SHA-256 is
`e4c06a961bdcd631bf49099d0fbb733f1e585311c01d721d78cf9181e1b7c152`.
This change precedes confirmation, not a reinterpretation of a failed holdout.

The recorded confirmation decision includes **all 13 H/V-quotient behavior
representatives**, 0,33,34,35,37,38,39,41,42,43,45,46,47, and nine memoryless
probabilities 0.1,0.2,...,0.9, at L=64, k=2,3,4,8 with 512 new seeds per cell.
Only a smaller fixed mechanistic family is inferential: failure-reactive
representatives **33,41,43**, each versus **fair coin random-0.5 and open-loop
controller 35**, in the four k strata. These are 24 paired coverage tests plus
12 one-sided isotropy tests: **36 hypotheses total**. The rest of the all-class
and bias-grid results receive descriptive CIs; their apparent best controller or
best bias does not become a retrospectively selected significance test.
The executed class IDs and the final hypothesis family are distinguished in
the JSON lock. All results, including harm, bias and deadlock, remain reportable.

The final stratum and comparator list is the actual JSON lock. Pilot seeds
start at 100001; confirmation seeds at 200001;
finite-size seeds at 300001; small-system Monte Carlo seeds at 400001. Keep all
ranges disjoint in the execution manifest.

## Estimation and uncertainty

For each separate stratum, report n, mean, **sample** standard deviation using
`n-1`, standard error `sd/sqrt(n)`, minimum, maximum and a pointwise two-sided
95% Student-t interval `mean +/- t_(.975,n-1)*SE`. With n=1 the standard deviation,
SE and interval are undefined/null, not spuriously zero. Student-t coverage is
exact for normally distributed run-level data and approximate otherwise; large
independent samples support the CLT approximation. Small-n, bounded, bimodal or
rare-event outcomes require restraint. Raw distributions must remain available.
The implementation does not claim that a 95% interval contains the particular
true value with probability 0.95 after observing the data.

Deadlock frequencies use two-sided **Wilson score** 95% intervals, not Wald
intervals. Zero observed deadlocks does not establish zero probability: for
example the upper Wilson bound remains positive. A conditional distribution of
coverage among geometrically jammed runs would select on an outcome affected by
the policy; it is descriptive, not the primary causal comparison.

Controller-minus-baseline effects are computed from **per-seed differences**
within the same L,k,boundary, with their own sample SD, SE and Student-t interval.
This accounts for common-random-number covariance. Equal seed labels must
actually mean reproducibly independent streams across seeds and a documented
coupling across policies; labels alone cannot establish useful coupling.
Unmatched or duplicate seeds invalidate a planned complete paired comparison;
the analyzer records incomplete status and exits nonzero instead of silently
dropping runs. A zero-variance nonzero difference has an undefined ordinary
t-statistic and no inferential p-value; it is not automatically infinite evidence.

For binary paired deadlock comparisons, use the conditional exact McNemar test:
given m discordant pairs, the number in one direction has Binomial(m,0.5) under
the null. Report discordant counts and the two-sided tail probability. The
run-wise paired difference interval is an approximate t interval, not a Wilson
interval for a difference of proportions. No discordant pairs means p=1.

## The locked hypothesis family

Primary coverage comparisons have two-sided paired-t p-values, preserving the
ability to detect either benefit or harm. A positive mean is required to call a
rejection an improvement. Isotropy eligibility has a separate one-sided test
within the **same** family: H0 mean(|S|)>=0.1 against mean(|S|)<0.1, one for every
selected controller and locked stratum. This avoids claiming an isotropic benefit
based on signed-order cancellation or an uncertain sample threshold crossing.

Holm's sequentially rejective procedure adjusts **the entire fixed family** of
controller/baseline/stratum/metric comparisons and isotropy tests at alpha=0.05.
It controls family-wise error without assuming independence among tests when
the component p-values are valid. Missing/incomplete or undefined tests occupy
their original family slots conservatively as p=1; they are never discarded to
reduce the correction. Adding new outcomes after results is exploratory.
Sample Pareto membership is never a confirmatory significance result.

Pointwise 95% effect intervals remain labeled pointwise; Holm-adjusted p-values
do not magically turn them into simultaneous intervals. The analyzer additionally
reports Bonferroni simultaneous paired-mean intervals using `alpha/familySize`
and one-sided simultaneous isotropy upper bounds. An "isotropic improvement"
requires a positive coverage effect and a rejected isotropy null, both under
the locked adjustment; report the actual effect and uncertainty, not only a star.
To say an advantage exceeds **every tested memoryless bias** requires positive
evidence against all those fixed baselines. It does not prove optimality over
the untested continuum of biases, other initial states, controller families or
other information structures.

## Finite size, exact validation and extensions

Finite-size curves use actual L=16,32,64,128,256 values, independently seeded
with explicitly varied replicate counts and CI widths. Plotted connecting lines
only guide the eye. No scaling exponent or infinite-size limit is automatically
fit. A subsequent scaling fit must state its model, range, weighting, goodness
of fit, residual checks and sensitivity to exclusion of the smallest sizes;
different plausible fits and negative outcomes remain visible.

Exact small-system probabilities are deterministic mathematical calculations,
not independent Monte Carlo observations. Cross-validation compares simulated
means and deadlock rates against exact targets with uncertainty; a sample
interval failing to cover once can occur by chance and is not automatically a
bug. Repeated failures, implementation invariants and state-enumeration checks
guide investigation. k=1, always-H, always-V, fair coin and orientation-exchange
checks are mandatory sanity cases. A finite-size scan does not establish a
phase transition or spontaneous symmetry breaking by itself.

The two-bit search, stochastic transitions, delay, noise, information quantities
and spatial observables are contingent extensions. Any post-atlas change is
recorded with its reason. Million-controller selection receives its own fresh
holdout rather than reusing the one-bit confirmation. No novelty claim precedes
the primary-literature comparison, especially the known 2011 RRSA persistence
rule which retains a chosen orientation until successful adsorption.

## Files and commands

Raw simulation CSVs remain separate from processed summaries and graphics.
The required simulator fields are `experiment,controller,L,k,boundary,seed,
particles,horizontal,vertical,coverage,order,abs_order,deadlock,legal_h,legal_v,
attempts,failures,elapsed_ms,attempted_h,attempted_v`.

```sh
node analysis/summarize.mjs --input data/raw/atlas.csv --output data/processed/pilot
node analysis/summarize.mjs --input data/raw/atlas.csv --output data/processed/pilot --lock-spec docs/family-spec.json --write-lock docs/confirmation-lock.json
node analysis/summarize.mjs --input "data/raw/*.csv" --output data/processed --lock docs/confirmation-lock.json
python analysis/figures.py --input data/processed --output figures
```

`summary.json/csv` contain descriptive strata; `comparisons.json/csv` contain the
complete locked family; `pareto.csv` explicitly labels a descriptive frontier;
`audit.json` records input hashes, counts, incomplete pairs and seed overlap.
The analyzer checks coverage/order/count identities and terminal legal-placement
flags. Figures are regenerated solely from these processed files; numerical
source data and analysis remain available alongside PDF/PNG graphics. Optional
snapshot figures require an explicit `{empty:0,horizontal:1,vertical:2}` encoding
and a stated seed; an attractive individual snapshot is not statistical evidence.

These are standard portable project commands. Machine-specific environment or
cache paths belong to the developer's local setup, not to the research source.

## Method references

Mean confidence intervals and their assumptions follow the
[NIST/SEMATECH confidence-limits guidance](https://itl.nist.gov/div898/handbook/eda/section3/eda352.htm).
Binomial interval choice follows the
[NIST proportion-interval discussion](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm).
Family-wise correction follows Holm (1979), *A Simple Sequentially Rejective
Multiple Test Procedure*, Scandinavian Journal of Statistics 6:65–70
([original paper](https://www.ime.usp.br/~abe/lista/pdf4R8xPVzCnX.pdf)).
These references justify statistical methods, not a novelty claim for the RSA model.

## Recorded execution amendments after sealing

The confirmation lock was sealed at `2026-10-03T17:17:38.407Z`, before any
holdout analysis, with analysis-source SHA-256
`be4edbe74d0c1fd1541bba44265512ec3fef4ce635a0e7fb58e683a76b793c52`.
Two implementation corrections were necessary and reported before editing:

1. Reading the 131,072-row small-validation file with `push(...rows)` exceeded
   JavaScript's function-argument limit. Replacing it with an ordinary loop
   changed no records, grouping or inference.
2. Two-sided t p-values computed by subtracting CDF from one rounded very small
   finite tails to zero. Evaluating the identical regularized-beta tail directly
   avoids cancellation. No null, direction, threshold, family, CI or sample was
   changed. An analytic Cauchy-tail test and finite df=511 test cover the fix.

The original lock and all raw data remain unchanged. The output audit records
the final analysis-source hash separately from the lock hash. An intermediate
comparison file with the rounded p-values is retained as an execution record;
only the numerically corrected full analysis is the final table. These are
documented bug fixes, not post-result selection or additional hypothesis tests.

## Exploratory extensions after primary analysis

The nearest stochastic RRSA-like rule is sampled separately with 512 new seeds
at each L=64,k=2,3,4,8. Its direction is redrawn with p(H)=0.5 after success and
retained after failure. This precise finite-state process is reported with
descriptive means and CIs; it is not added to the already sealed 36 tests.
Its seed range begins at 700001. Distinguish this exact protocol from any
additional safeguards, redraw rules or terminal definitions in the literature.

An external-rescue intervention uses 256 fresh controller38 lattices per
L=64,k=2,4,8, seeds beginning800001. An external observer detects controller
termination and continues irreversible adsorption with a fair coin. Before and
after belong to the same lattice; the main descriptive effect is the per-run
coverage gain **including** zero gains from geometric jams. A gain conditional
on deadlock is additionally labeled descriptive. This observer is not allowed
under the original information structure, so rescue is a diagnostic of stranded
legal placements, not an admissible memory-controller improvement.

Direct trajectories comprise 16 independent runs for each controller35,38,41,
fair coin, at L=32,k=2,4,8. They measure P(switch|previous outcome) and the plug-in
conditional mutual information `I(Y_(t-1); switch_t | O_(t-1))` in bits. Conditioning
on previous orientation avoids an XOR/symmetry cancellation of pooled
`I(Y_(t-1);O_t)`. Per-run estimates, not attempts, form the summary replicates.
These estimates mix stages of a nonstationary adsorption process and retain
finite-sample plug-in bias; even IID actions have a small positive sample
information estimate. CI coverage pertains to the mean plug-in statistic,
not an unbiased population-information parameter, causal directed information,
entropy rate or an information-per-packing exchange rate. No significance test
or new ranking is attached. Deterministic35 switches regardless of outcome,
whereas38 and41 switch on opposite outcomes, despite differing packing and
deadlock results. All twelve fixed-seed snapshots remain illustrative.

Reproduce these summaries separately, because an intervention is not a normal
controller-result row and attempt trajectories do not use the terminal CSV schema:

```sh
node analysis/extensions.mjs --rescue data/raw/interventions/rescue.csv --dynamics data/raw/dynamics/summary.json --output data/processed
python analysis/figures.py --input data/processed --output figures --snapshots data/raw/dynamics/snapshots.json
```

The extension analyzer validates count identities and recomputes each plug-in
information value from the actual 2x2x2 transition counts. It does not modify
the primary analyzer, raw data or confirmation lock.
