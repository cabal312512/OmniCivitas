# Unknown-entry tail contribution by fixed-effort splitting

The estimator receives a simulator, nested-level transition oracles, terminal
mark oracle and particle count. It does **not** receive rare-entry probability.
At each of s levels simulate N particles to next-level hit or failure, let K_i
survive, multiply weight Z by K_i/N and resample N survivor states uniformly with
replacement. Extinction returns zero. After the final level estimate the
nonnegative tail contribution by Z times the mean of N fresh terminal marks.
Resampling clones state rather than aliasing mutable trajectories.

## Unbiasedness with ideal oracles

Let Q_i be the killed next-level transition kernel and let γ_i=γ_{i−1}Q_i be
the unnormalized entrance-state measure. For any integrable mark f, condition
on current weighted empirical measure Z_{i−1}η^N_{i−1}. Simulated surviving
marks have conditional expectation η^N_{i−1}Q_i f. Conditional on those survivors,
unbiased multinomial resampling has the same empirical mean in expectation.
Multiplication by K_i/N gives

\[
E[Z_i\eta_i^N f\mid\text{previous cohort}]
=Z_{i-1}\eta_{i-1}^N Q_i f.
\]

Induction from correctly sampled initial states yields E[Z_sη_s^Nf]=γ_sf.
Fresh terminal simulation replaces f by its conditional expected mark without
changing that expectation. Extinct cohorts have zero weighted measure. This is
the standard SMC unnormalized-measure argument, applied to a tail contribution.
No analytic entry probability occurs. Requirements are exact level simulation,
unbiased resampling, proper state retention and an integrable mark. Arbitrary
adaptive levels require additional justification and are not used here.

## Controlled benchmark and exact variance

Three independent product levels have q_i=ε; rare entry w=ε³. Conditional dwell
is geometric with hazard p=ε³, mean 1/p, so true contribution w/p=1. The simulator
knows ε to generate Bernoulli hits and dwells, but the splitting algorithm gets
only sampled outcomes. Knowing simulator parameters is not supplying w to the
estimator. Actual RSA entrance levels are a separate, unsolved design problem.

In this product benchmark K_i are independent Binomial(N,q_i); fresh geometric
marks are independent of the level weight. Thus exactly

\[
{\operatorname{Var}(\widehat C)\over C^2}
=\prod_i\left(1+{1-q_i\over Nq_i}\right)
\left(1+{1-p\over N}\right)-1.
\]

Naive n original trials have relative variance (2−p−w)/(nw). For fixed s and
q_i=ε, fixed relative precision scales as N=O(ε⁻¹) for splitting versus
n=O(ε⁻ˢ) for naive sampling. This statement is for this model and oracle-cost
convention, not a universal RSA efficiency theorem.

The fixed design has ε=0.05,0.02; N=1000; 32 independent batches per method and
model; naive uses 4000 original trials per batch. All 128 batches, level survivor
counts and 64019 conditional dwells are retained. Actual simulator oracle calls
total 521233; splitting also uses 192000 resampling draws. These are not equal
wall-time budgets. No RSA packing Monte Carlo was added.

| ε | method | mean estimate | zero-entry batches | observed relative RMSE | theoretical relative RMSE |
|---:|---|---:|---:|---:|---:|
| .05 | naive | 1.06623 | 16/32 | 1.71516 | 1.999875 |
| .05 | splitting | 1.03532 | 0/32 | .214532 | .243203 |
| .02 | naive | .119852 | 31/32 | 1.10452 | 7.90566 |
| .02 | splitting | .915398 | 0/32 | .306682 | .394303 |

The last naive row is deliberately retained: a tail-blind finite experiment
underestimates its actual RMSE. Observed error from 32 batches is not a certified
confidence bound. Exact variance, rather than an attractive scatter plot, is
the main reliability evidence. Seeds and costs are in the declared design and
`results/unknown-entry-splitting.json`.

The implementation uses a 32-bit midpoint PRNG and double inverse-geometric
sampling, so the ideal unbiasedness theorem has finite-grid and floating-point
limitations in the executed benchmark, especially for extremely small hazards.
We do not claim unbiasedness at arbitrary ε of this finite-precision code.
No unknown-probability estimator has yet been deployed on realistic RSA rare
entrance histories; automatic useful level construction and correlated-family
variance guarantees remain open.
