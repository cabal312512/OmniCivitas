# Independent review of the Stage II stochastic event sampler

Review date: **2026-10-04**. Reviewed source: `stage2/src/stochastic.mjs`, SHA-256 **49586d0fadb4ad0b5d93c1537c4025a17b9c1b121b5cbfab264934329f088c26**. Also read `stage2/docs/SIMULATOR.md`, the Stage II user brief, Stage II tests and the inherited RNG implementation. Stage I code, data and tests were not changed or rerun.

## Assessment

No substantive error was found in the fixed-lattice joint residence/cycle decomposition, negative-binomial aggregation, orientation-resolved failed-trial counts or final-transition accounting. The mathematical event law samples actual waiting-time fluctuations jointly with the accepted orientation; it does not substitute conditional mean waits for observations.

The main clarification needed is numerical: the implemented PTRS acceptance calculation uses a **truncated Stirling correction**, not an exact evaluation of log(k!). The negative-binomial mixture is an exact distributional identity in ideal arithmetic; the implementation remains a finite-precision pseudorandom sampler. This distinction should appear explicitly beside the “exact” algorithm language, rather than only in the later general floating-point caveat.

## Algebraic checks

For a fixed lattice, let p_i = A_i/M, q_i = 1 − p_i, and h_i = p_i + q_i beta. A trial exits the current-orientation residence by success with probability p_i or by failed flip with probability q_i beta. Held failures have probability q_i(1 − beta).

A residence's joint probability of n held failures followed by success is

`[q_i(1 − beta)]^n p_i`.

It factors as geometric residence mass `(1 − h_i)^n h_i` times exit probability `p_i/h_i`. The analogous failed-flip exit factor is `q_i beta/h_i`. Thus exit type and residence length are independent. This independence justifies aggregation conditional on the cycle count; it is not an approximation replacing a latent dependence.

Starting in orientation o, write s_i = p_i/h_i and c_i = q_i beta/h_i. Two failed-flip exits return the bit to o and form a cycle. The total probability of an eventual successful exit within one cycle is

`m = s_o + c_o s_other = 1 − c_o c_other`.

The sum form used by the source avoids cancellation of a small m. Then:

- C, complete unsuccessful cycles, has the geometric-failures law with parameter m.
- J = 0/1 denotes success in o/other, with conditional probabilities s_o/m and c_o s_other/m. C and J are independent.
- There are C + 1 residences in o, and C + J residences in the other direction.
- Conditional on C and J, held failures in the two directions are independent negative-binomial variables with these shapes and their respective h values.
- Failed-flip exits add C + J failures in o and C failures in the other direction.
- Failure-induced flips total **2C + J**, and the accepted orientation is `o XOR J`.

Every one of these identities matches `nextAcceptedEvent`. The final successful trial contributes one attempt and zero failures. Uniform selection from the accepted orientation's legal-anchor list is the conditional distribution of the original uniform anchor given success. It does not allow the controller to observe geometry.

The Gamma–Poisson identity also has the correct parameterization. If G ~ Gamma(r, scale = 1), and F conditional on G is Poisson(G(1 − h)/h), then

`E[z^F] = [h / (1 − (1 − h)z)]^r`.

This is the probability generating function of the number of failures before r Bernoulli(h) successes. Summing geometric-failure draws for r ≤ 16 and using that mixture for larger r implements the same ideal distribution, including non-Gaussian tails. The r = 0 and h = 1 cases correctly return zero; positive r and h = 0 correctly reject an infinite waiting time.

## Absorption and liveness boundaries

- Both legal counts zero: geometric jamming, with no next event sampled.
- beta = 0 and the held direction has zero legal anchors: controller absorption. If the opposite count is positive, the result is deadlock under the declared {H,V} allowed set.
- beta = 0 and the held direction remains legal: a single-orientation geometric wait, and no failure flips.
- beta > 0 with at least one legal orientation: eventual success with probability one in the ideal model. beta = 1 is periodic but still live; aperiodicity is unnecessary.

The `failureKernel` determinant and absorption entries were checked against `(I − Q)^−1 R`. Its expected-wait expression also gives the stated blocked-start identity `T_empty = 1/beta + (2 − p)/p`. This divergence is kinetic cost; it is not evidence of packing benefit.

These are mathematical statements about positive real beta. They should not be recast as an arbitrary-precision guarantee of every floating-point parameter accepted by the JavaScript signature. Parameters near underflow or beyond supported integer counts can throw; direct Bernoulli tests below the inherited uniform resolution cannot reproduce an arbitrary positive real probability.

## Last controller update versus trial adjacency

`controller_flips` includes the outcome-conditioned update after the last successful deposition. There is no subsequent attempted orientation in the diagnosed terminal state, so that last successful flip contributes no trial adjacency. The source subtracts exactly `lastSuccessFlip`:

`trial_switches = failure_flips + success_flips − lastSuccessFlip`.

Termination cannot newly arise after a failed trial in this alpha/beta model: failure changes no geometry, positive beta remains live, and beta = 0 cannot change the held direction. Consequently the final observed trial is a success, which makes this accounting consistent in both engines. The direct engine's recorded sequence independently checks the identity. Strict trial alternation correctly has attempts − 1 adjacency switches, although its controller performs attempts flips.

Accepted-run statistics concern the actual accepted sequence. Event trial-run count and mean follow exactly from attempts and adjacency switches; the event engine appropriately leaves trial maximum and histogram null because their ordering was not retained. The so-called lag-1 fields are uncentered sign-product means, as the document correctly states, not Pearson correlations under imbalance.

## Independent small verification actually run

The scratch verification used only standard Node and the inherited RNG, outside the repository. It did not run the project test suite or any new landscape/large-L experiment. Each comparison used independent analytical probabilities, rather than copying the event decomposition as its oracle.

### Joint probability bins from a full-trial recurrence

Starting from a frozen `(orientation, failed_H, failed_V, flips)` state, the oracle advanced the original individual trial law: success absorbs; failed hold preserves orientation; failed flip toggles it. Probability mass was enumerated through 16 trials, with the remaining tail kept as a separate bin. Event draws were compared on the complete `(accepted orientation, failed_H, failed_V, failure flips)` key, rather than only marginal means.

Each case used 50,000 event samples. Individual bins with probability at least 0.001 were assessed separately; rarer bins were pooled, and the tail was assessed separately. A fixed seven-standard-error diagnostic bound was used. This is a fixed-seed implementation check, not a new scientific hypothesis test.

| Counts (H,V), M | beta | Start | Seed | Assessed bins | Maximum absolute standardized deviation |
| --- | ---: | --- | ---: | ---: | ---: |
| (2,7), 10 | 0.3 | H | 782013 | 50 | 2.360 |
| (0,4), 10 | 0.4 | H | 782014 | 102 | 2.315 |
| (2,1), 10 | 1 | V | 782015 | 17 | 2.367 |
| (8,6), 10 | 0.7 | V | 782016 | 18 | 1.791 |

The final-orientation/failure-flip parity and the bound “failure flips ≤ failed trials” were checked for every draw.

### Nonlinear joint generating-function checks, including the large-NB branch

For weights x_H, x_V and z, the independent full-trial generating kernel is

```text
Q_weighted = [ q_H(1−beta)x_H   q_H beta x_H z   ]
             [ q_V beta x_V z   q_V(1−beta)x_V  ].
```

Solving `(I − Q_weighted)^−1 diag(p_H,p_V)` gives

`E[x_H^F_H x_V^F_V z^flips × indicator(accepted orientation)]`.

This directly tests waiting/flip/orientation dependence over the whole support, including events beyond the 16-trial prefix. Each case used another 50,000 event draws.

| Counts (H,V), M | beta | Start | (x_H,x_V,z) | Seed | Maximum deviation / observed SE |
| --- | ---: | --- | --- | ---: | ---: |
| (1,2), 1000 | 0.5 | H | (0.998,0.999,0.997) | 902701 | 1.312 |
| (1,1), 20000 | 0.5 | V | (0.99995,0.99998,0.99999) | 902702 | 0.559 |
| (0,5), 10 | 10⁻⁶ | H | (0.9999995,0.9,0.8) | 902703 | 1.750 |
| (2,7), 10 | 0.3 | V | (0.8,0.7,0.6) | 902704 | 1.364 |

In the first two cases, 45,045 and 49,842 of the respective 50,000 samples had at least 17 complete cycles. Their residence aggregation therefore exercises the Gamma–Poisson branch rather than only short sums of geometrically distributed variables.

Finally, 30 small direct/event runs covered the five specified parameter points at L = 4, k = 1, 2, 3 and seed 304119. Terminal labels, strict-alternation adjacency and the final controller flip agreed with the declared rules. A frozen beta = 0 blocked-start call correctly returned terminal. These checks support the implementation; they are not proof of every representable parameter or a replacement for the larger archived experiment validations.

Scratch code and machine-readable results were saved as `F:/OCVdeps/tmp/stage2-fixed-kernel-review.mjs` and `.json`. They are review evidence, not a required runtime path or repository dependency. This document records the seeds, parameters, oracle equations and source hash needed to recreate the checks elsewhere.

## Numerical clarification recommended before the report is finalized

For k ≥ 16, `logPoissonMass` computes log(k!) through Stirling terms ending in −1/(1680k⁷). It omits the next +1/(1188k⁹) term. That next-term scale is approximately **1.23 × 10⁻¹⁴ at k = 16** and rapidly decreases with k. The stable deviance branch additionally truncates the power series after n = 32 for |(k − mean)/mean| < 0.1. These truncations are tiny in the supported study range, but are numerical approximations in the rejection decision, in addition to IEEE rounding and discrete uniform resolution.

Suggested addition to `SIMULATOR.md`:

> The residence-cycle construction and Gamma–Poisson mixture are exact distributional identities in the ideal model. The implementation uses finite-precision rejection samplers: Poisson log masses use a stable deviance evaluation and a truncated Stirling correction. Consequently “exact event sampling” refers to the derived stochastic law and retention of actual kinetic fluctuations, not arbitrary-precision numerical sampling or equality of the engines' discrete pseudorandom streams.

The inherited uniform values are midpoints on a 2³² grid. Bernoulli probabilities below approximately 2⁻³³ cannot be represented by the direct `< beta` comparison, and inverse-CDF geometric sampling has a finite representable tail. The current document already warns about tiny probabilities and remote tails. Keep that warning and make the ideal-law qualification explicit near the first event/direct equivalence claim. The reviewed 0.05-step landscape and the 10⁻⁶ validation point do not approach that probability floor.

This clarification does not justify changing completed results or replacing the waiting distribution by a Gaussian/mean surrogate. No observed defect required a scientific-result revision in the reviewed range.

## Optional defensive API improvement

`failureKernel` validates its fixed-state inputs, but the exported `nextAcceptedEvent` helper relies on its caller for valid orientation, counts, M and beta. `simulateStochastic` provides the required probability and lattice checks before calling it, so the reviewed experiment path is protected. If the helper is advertised for independent external callers, either document those preconditions or give it matching validation. This is a boundary-contract improvement, not an identified error in archived simulations.

The published Gamma and PTRS formulas were checked algebraically against the implementation's structure. The publisher/institutional source URLs supplied for this review were attempted, but this review's web fetches failed; no claim is made that those full texts were independently retrieved in this pass. The source-provenance checks already recorded by the main project remain separate evidence.
