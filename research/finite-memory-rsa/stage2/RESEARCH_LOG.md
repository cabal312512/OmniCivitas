# Stage II research log

## 2026-10-04: preserve Stage I and ask a sharper question

The user's second research brief authorizes a stochastic one-bit study, large-L
policy41 measurements and stochastic liveness theory. It does not authorize
website integration or a rewrite of Stage I's negative conclusion. All archived
Stage I artifacts and code are checked against its final manifest before work.

The new controller stores its current direction. Initial H/V is a fair coin;
after success it flips with probability alpha and after failure with probability
beta. Candidate anchors remain uniformly random. No geometric quantity is an
observation or policy input. The diagonal alpha=beta is outcome-independent
temporal correlation, an essential null family rather than just a fair-coin
reference. Stochastic initial orientation differs from Stage I's H-first
deterministic encoding and is recorded explicitly.

Exploration and confirmation are separate experiments with new seed blocks.
The first pass covers the complete21x21 square, not just a promising corner.
Small-alpha refinement and persistence matching are exploratory. Any candidates
and their comparisons must be sealed before new holdout data are generated.
Complete tradeoffs remain visible; no inherited sole isotropy cutoff is used.

The large-size study follows policy41-type(0,1), fair(0.5,0.5) and alternating
(1,1), all with randomized initial direction, k4/8 and L128..2048. Distribution
moments and quantiles are required, not just a signed mean that cancels. A finite
size range may support slow crossover without identifying an infinite-volume
limit. New data cannot be relabeled a proof of a thermodynamic transition.

The deterministic failure-cycle sampler cannot be reused unchanged. A separate
two-state absorbing failure kernel and direct trial engine are being implemented.
Tests and exact rational absorption will constrain both coverage and kinetic
sampling before large experiments. The stochastic liveness theorem distinguishes
geometry-specific failure kernels from geometry-free support guarantees.

## Data-led change of route

The complete coarse square produced 56,448 runs. The requested small-alpha,
large-beta region received 12,800 new pilot runs; it reduces the large bias of
the alpha-zero endpoint but retains considerable run-wise anisotropy, especially
at k=8. A different corner, alpha near one and beta small, exhibited strongly
alternating accepted rods and much smaller bias. This motivated a separately
named adaptive refinement of 8,448 runs, not a post hoc confirmation.

The initial coarse point (1,.05) looked unusually dense. Independent refinement
weakened that impression: k=4 coverage changed from .813080 to .811081, k=8 from
.750183 to .747299. Both original datasets remain. The total pooled exploratory
means are .811747 and .748260; no naive selected-point significance is claimed.

## Frozen independent confirmation

The four representatives are (1,.001), (1,.05), (.02,1), and (.85,.5), for both
k=4 and k=8. They distinguish mechanisms rather than maximize pilot density.
Each faces all 21 predeclared diagonal points and its own proposal-persistence
null. The latter's fixed p is the pilot run-mean adjacent trial-switch fraction;
it does not match accepted correlation, a complete run distribution, or exact
stopped-run sample ratios. No p is tuned on holdout observations. Larger-size
stability transports this fixed p rather than re-estimating it.

The lock was written at 2026-10-03T19:40:33.929Z. A separate record at
19:41:14.125Z checked the analysis hash and the absence of both holdout files
before starting them. There are 59,392 L64 runs and 3,072 L256/512 stability
runs, using fresh 40/41/42-million seed blocks. A single Holm family contains
400 tests, with two-sided coverage and lower-tail anisotropy noninferiority
using absolute margin .01. This margin supports comparable bias, not strict
Pareto dominance. All locked tests remain regardless of their outcomes.

The analysis coordination incident and the restoration of the original sealed
source are documented in docs/ANALYSIS_SOURCE_AMENDMENT.md. Original-source
SHA256 B158B2BD... is used for the primary analysis; the later guarded version
is retained separately. The lock, seeds, comparisons, and statistical methods
were not resealed or modified after data collection began.

## Large systems and singular kinetics

The prespecified policy41/fair/alternating study produced 3,072 runs through
L=2048. Bias keeps decreasing, but k=8 still has E|S|=.148457 at that size.
Coverage differences against both main nulls have pointwise intervals crossing
zero there. This is evidence of shrinking finite-size effects, not a proof of
equivalence, a zero infinite-volume limit, or a phase transition.

Fifty-two rational tiny-system cases are compared with 106,496 event and 106,496
direct runs. A separate 700,000-draw fixed-geometry diagnostic demonstrates
rare blocked excursions. At beta=1e-6, no excursion was observed in 100,000
draws, giving a sample mean about2 despite exact mean3. The variance diverges
as beta decreases; a naive sample-variance interval can therefore be misleading.
These diagnostics and model-fidelity intervals are separate from the packing
holdout and never contribute additional terminal packing replications.
