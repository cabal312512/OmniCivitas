# Exact/Monte Carlo validation

The frozen stochastic exact reference was compared with **212,992 actual simulations**: 106,496 event and 106,496 direct, 52 parameter/geometry strata per engine, 2,048 fair-initialized seeds each. The nine core rational points and four quarter-probability checks cover L=2,3 dimers with both boundaries. Neither reference nor simulator source was modified for this comparison.

Every observed joint (N_H,N_V,deadlock) outcome belonged to the exact support. All terminal count/attempt/legal-placement identities, raw hashes, histogram hashes and completed-source manifest checks passed.

There were **47 misses among 728 pointwise 95% Student-t mean intervals**, and **1 misses among 104 pointwise 95% Wilson deadlock intervals**. These misses are reported; all individual 95% intervals are not required to contain their targets. 0 extra raw containment differences fell within 1e-12 floating endpoint allowance. No empirical sampling tolerance was substituted.

The joint terminal-law fidelity audit used 380 two-sided Clopper–Pearson intervals with Bonferroni alpha 0.01/380. **0 simultaneous intervals missed** their exact probability. Under independent-run sampling, this family has at least 99% simultaneous confidence. Shared engine seed labels do not invalidate the Bonferroni bound. This validates the joint count/terminal-reason law; it is not a full spatial-distribution or large-system correctness proof.

Maximum observed mean discrepancies (descriptive, not pass cutoffs): coverage 0.00740258487654244; absolute order 0.02771448206018473; signed order 0.04101562499999993; terminal attempts 0.68657037456558. Mean kinetic intervals are CLT-based, and the separate rare-excursion study explains why a tiny-beta mean can require special care.

Machine-readable details, including every pointwise interval, exact rational target and simultaneous bin check: `data/processed/exact-validation.json`. Frozen raw CSVs and histograms: `data/raw/exact_validation_event.*`, `data/raw/exact_validation_direct.*`.

Reproduction from the research root, after the two raw experiments exist:

```sh
node stage2/scripts/validate-exact.mjs
```

The input runner commands are `node stage2/scripts/run-experiment.mjs experiments/exact_validation_event.json` and the corresponding direct configuration. The runner refuses existing raw outputs; use a clean research checkout or a separate output path to rerun. This validation is outside the exploration/confirmation hypothesis family.
