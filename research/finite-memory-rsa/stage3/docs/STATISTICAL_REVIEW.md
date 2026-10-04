# Stage III independent read-only statistical review

The frozen primary inference is numerically reproduced. The review checked every one of the **284,040** main raw rows and recomputed all **612** locked paired tests. It confirms **379** Holm rejections, **36 margin-qualified joint pairs**, and no successful one-bit or two-bit every-null gate. This is a post-holdout validation, not a second preregistration or new inferential sample. No locked simulator, experiment, selection or analysis source was edited.

The audit implementation is [read-only-statistical-audit.mjs](../results/evidence/read-only-statistical-audit.mjs); its recorded result is [statistical-audit.json](../results/evidence/statistical-audit.json). It has its own row-inventory, seed pairing, Welford contrast and Holm implementation. It reuses the validated read-only parent Student-t tail/quantile functions. Thus contrast and correction logic are independently computed, while numerical tail evaluation is shared.

## Design and inventory

| Dataset | L | k | Runs | Inferential role |
| --- | --- | --- | ---: | --- |
| Coarse | 16 | 4,8 | 209,928 | Exploratory complete live-catalogue screen |
| Middle | 32,64 | 4,8 | 38,784 | Exploratory selected/capped screen |
| Confirmation | 64 | 4,8 | 35,328 | Locked independent seed blocks |
| Total | | | 284,040 | These stages are not pooled as confirmatory replicates |

Confirmation has 46 arms, with 768 realizations each. For each rod length there are six candidates (three newly selected mechanisms and three protected outcome-sensitive one-bit controls), sixteen complete live temporal comparators with at most four states, and IID fair. The family size is `2 × 6 × 17 × 3 = 612`. A three-state controller occupies the two-bit budget and faces all four-state temporal controls. The one-bit gate separately restricts candidates and deterministic temporal controls to at most two states and retains the stochastic zero-behavioral-memory IID reference.

The raw inventory matches the exact arm plan, including its effective periodic boundary. No extra, missing, duplicate or unlocked row was accepted. CSV hashes, compact parsed-plan hashes, source seals, analysis seals, protocol hash and selection provenance all match their appropriate metadata. File-byte and compact-plan hashes are different objects; [HASH_CONVENTIONS.md](HASH_CONVENTIONS.md) explains the convention.

| Stage/stratum | First seed | Last seed |
| --- | ---: | ---: |
| Coarse k4 | 80000001 | 80000012 |
| Coarse k8 | 80100001 | 80100012 |
| Middle L32,k4 | 82000001 | 82000064 |
| Middle L64,k4 | 82010001 | 82010064 |
| Middle L32,k8 | 82100001 | 82100064 |
| Middle L64,k8 | 82110001 | 82110064 |
| Confirmation k4 | 90000001 | 90000768 |
| Confirmation k8 | 90100001 | 90100768 |

There is no pilot/holdout seed overlap. Seeds are deliberately shared across candidate/control arms within a stratum, producing valid paired contrasts under the seeded realization design; dependence between hypotheses does not invalidate Holm's arbitrary-dependence correction. A terminal realization, rather than a deposition trial or lattice site, is the statistical replicate. Seeded PRNG streams are the computational approximation to independent realizations.

The recorded middle finish is 04:15:46.322 UTC, the original lock time is **04:17:16.153 UTC**, and confirmation starts at **04:17:16.346 UTC**, all on 4 October 2026. The review verifies consistent recorded sequencing and frozen hashes. These local timestamps are not an independently timestamped public preregistration service.

## Direction, margins and correction

For paired candidate/control realization metrics, the analyzer tests positive means of:

```text
coverage:   theta_candidate - theta_control
imbalance:  0.01 + absS_control - absS_candidate
cost:       1.10 * (A/N)_control - (A/N)_candidate
```

The lower-tail noninferiority null is transformed into this positive-benefit form before applying the one-sided Student-t upper tail. For negative t the tail is near one, not the smaller two-sided tail. Cost noninferiority refers to `E[(A/N)_candidate] < 1.10 E[(A/N)_control]`; it is neither a test of `E[A]/E[N]` nor a per-realization relative-cost ratio. The `.01` imbalance tolerance is an absolute margin.

Holm includes every locked candidate, rod length, control and metric in one 612-test family, including failed and negative tests. A joint pair requires all three adjusted tests to reject. Separately reported Bonferroni simultaneous two-sided t intervals are not pointwise intervals and are not substituted for Holm p values. All 612 stored means, SDs, SEs, one-sided p values, adjusted p values and simultaneous interval limits agree with the independent recomputation within the audit's explicit floating-point tolerance. All rejection decisions match.

The finite-variance Student-t/CLT approximation is a limitation. It does not provide an exact finite-sample guarantee for discrete coverage or skewed/heavy-tailed trial cost. Pairing, multiplicity correction and actual count sampling fix different problems; they do not remove this approximation. Holm controls family error conditional on appropriately calibrated individual tests, not regardless of their calibration.

## What the result establishes

The 36 joint pairs pass **coverage superiority with imbalance/cost noninferiority allowances**. These allowances permit increased mean absolute imbalance below `.01` and increased mean cost below ten percent. Such a pair is not necessarily a strict three-coordinate Pareto improvement. The 379 rejected scalar hypotheses are also not 379 independent successful mechanisms; some reject noninferiority nulls against relatively imbalanced or costly controls.

An exact discrete-frontier extension, a strict Pareto improvement against one control, a margin-qualified joint pair, and dominance over every null are different claims. A new point can extend a frontier without dominating each existing frontier point. Failure of the stronger every-null gate therefore does not prove that the achievable frontier is unchanged, and is not equivalence or an absence theorem. The gate is the predefined sufficient condition for escalating this selected-candidate search. Its failure correctly leaves new L256+ exploration unopened.

Structural classification is exhaustive through four deterministic states. Main performance confirmation is restricted to selected mechanisms, and middle advancement is capped. It cannot establish that every pruned feedback behavior fails at larger lattices. Exact L3,k2 results have their own finite-geometric scope; an exact non-dominated tiny-system tradeoff is not a demonstrated L64 or asymptotic gain. Empirical holdout Pareto points and numerical temporal-mixture comparisons are descriptive; no simultaneous confidence frontier is proved by those diagrams.

## Frozen-source limitations and validation guards

The archived analyzer is an implementation for this fixed L64,768-realization design, **not a general statistical library**. Its generic grouping only keys on rod length and controller, hardcodes 768, and does not independently enforce all planned boundary/L/experiment/seed-block metadata. The new validator checks those omitted fields on every actual row. All present inputs match, so these omissions do not change the recorded result.

Its degenerate branch assigns p=0 to a positive constant observed contrast with SE=0. A zero empirical variance is not generally evidence that the underlying contrast is a known deterministic constant; using that branch as a universal inferential rule would be unsafe. All **612 actual SEs are strictly positive**, so this branch is dormant here. The reproduction validator rejects any future zero-SE nonzero-effect primary contrast instead of silently changing the frozen method. No inference was rerun under an amended test.

The reproducibility check in [REPRODUCTION.md](REPRODUCTION.md) additionally rebuilt classifications, sampled representative original seeds and solved small exact/theory examples from a new source-only copy. It validates implementation reproducibility. It is not a full independently seeded repetition of the research or independent cross-platform certification.
