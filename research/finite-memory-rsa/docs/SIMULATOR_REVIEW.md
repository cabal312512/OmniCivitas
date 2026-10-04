# Independent simulator review

Review scope: `src/rng.mjs`, `src/lattice.mjs`, `src/simulate.mjs`, and
`scripts/run-experiment.mjs`. This review did not modify the reviewed sources
and did not touch the website. It addresses sampling and scientific validity;
it is not a proof of a pseudorandom generator's independence or an assurance
that finite systems determine the thermodynamic limit.

## 1. Result

No discrepancy was found in the implemented uniform-anchor process, the
incremental legal-placement sets, terminal classification, deterministic
failure-cycle elimination, or the stochastic orientation baseline. A new
independent oracle test ran 131,072 fresh simulations and compared joint
orientation-count/terminal-reason laws with exact rational references. All
comparisons passed simultaneously adjusted confidence checks. The earlier
saved 131,072-run `small_validation` experiment remains a separate dataset;
the new unit run is not appended to it or represented as its raw data.

Reviewed core SHA-256 hashes:

| file | SHA-256 |
|---|---|
| `src/rng.mjs` | `a0af386efd47f97c85eda77fbe7ee175af21dc7d828411004486298d5153aecc` |
| `src/lattice.mjs` | `dfb22252873f7ee861d24fc35b32f67e47785466b9ee8096c063e4aec041f029` |
| `src/simulate.mjs` | `3f4ce9e07d8efdfd4c933e6009390cd5a9f27b650d76b98575e8d258426d8f01` |
| `scripts/run-experiment.mjs` | `81f12482b91298abed7419d50dfcd518672948394eab5a97874d292c1390f713` |

The first three hashes match the saved `small_validation.manifest.json`.
That per-experiment manifest records files in `src/`, so the runner hash is
recorded here separately.

## 2. Sampling and state updates

* The xoshiro128** output and state rotation use the intended 32-bit bit
  operations. JavaScript's signed intermediate representations do not change
  their bit patterns; `Math.imul` supplies the required modulo-2³² product.
  Bounded integer sampling rejects the incomplete residue block, avoiding
  modulo bias. Uniform floating draws use 32-bit interval midpoints and never
  return exactly zero or one. As with ordinary seeded Monte Carlo, statistical
  interval interpretation assumes that distinct seeded runs act as independent
  samples; this review does not prove that assumption for the finite PRNG.
* Open-boundary H anchors are uniformly mapped to the `L(L-k+1)` valid anchors,
  and V anchors have the same count. Periodic multiplicity is retained. The
  model does not treat out-of-bounds open candidates as controller failures.
* Dense legal sets and their inverse indices support uniform conditional
  sampling and O(1) deletion. An accepted rod removes exactly anchors crossing
  its occupied cells. Neither those legal counts nor the chosen anchor is
  passed to the controller.
* On an unchanged lattice, failure transitions form a prefix followed by a
  cycle. The implementation samples the number of entirely failed cycles from
  their geometric law, then the first successful cycle position from the
  correctly survival-weighted probabilities. Sampling a legal anchor only
  after the successful orientation is chosen conditions the original uniform
  candidate event; it does not give the controller access to locations.
* A deadlocked controller can have a legal-output state on its transient
  prefix. Those finite chances are attempted before a zero-success recurrent
  cycle is declared closed. Geometric jamming is checked from both legal sets.
  The direct engine's safety limit throws rather than manufacturing a terminal
  state. At termination, post-terminal infinite failures are not counted.
* The randomized baseline samples the geometric waiting law with overall
  success probability `(p_H A_H + (1-p_H) A_V)/M`, then chooses the successful
  orientation with the corresponding weighted legal counts. Its skipped
  failures are not decomposed by orientation, and that missing information is
  correctly represented by null fields rather than fabricated counts.

## 3. Fresh joint-law oracle

`tests/simulator-oracle.test.mjs` uses policies
`0,33,35,38,41,43,46,random-0.5`, sizes 2 and 3, dimers, both boundaries and
both direct/event engines. Each of the 64 groups has 2,048 runs, with seeds
700001–702048. These seeds are disjoint from the saved small-validation range
400001–404096. The exact reference is recomputed from rational arithmetic.

Final outcomes are grouped by `(N_H,N_V,deadlock)`, retaining more information
than coverage alone. There are 144 positive-probability joint bins across the
groups. For every bin the observed count receives a two-sided Clopper–Pearson
binomial interval with per-comparison alpha `0.01/144`. Bonferroni's union
bound gives family confidence at least 99% under the independent-run sampling
model. Dependence between different policy groups sharing seed labels does
not invalidate that union bound. Outcomes outside the exact support are
rejected directly. Coverage/count/attempt and legal-placement identities are
also checked on every run.

All 144 reference probabilities were inside their adjusted intervals. The
maximum observed coverage-mean discrepancy was
`0.004470486111130767`; the maximum deadlock-rate discrepancy was
`0.02094184027777779`. These are observations, **not** chosen acceptance
tolerances. Endpoint floating conversion produced a minimum reported
confidence margin of `−2.22×10⁻¹⁶`; the numerical comparison allowance was
`10⁻¹²`, unrelated to sampling tolerance. The binomial beta quantiles use the
separately tested dependency-free incomplete-beta implementation in the
analysis module.

The three new tests passed in the latest recorded run (approximately 1.34
seconds). The console JSON includes all 144 observed counts, exact reference
probabilities and confidence endpoints, not only the overall pass status.
The raw console report is an execution artifact at
`F:/OCVdeps/runtime/reports/rsa-simulator-oracle-unit.log` on the development
machine. Portable reproduction is:

```sh
node --test tests/simulator-oracle.test.mjs
```

## 4. Isolated-rod mechanism and its limits

Consider one accepted horizontal length-`k` rod on an otherwise empty
periodic lattice with `L≥2k`. Exactly `2k−1` horizontal anchors overlap that
rod: their starting columns lie in `−(k−1),…,(k−1)` relative to its start.
Exactly `k²` vertical anchors overlap it: each of its `k` columns has `k`
vertical starts crossing the occupied row. Consequently

`A_H = M−(2k−1)`, `A_V = M−k²`,

and `A_H−A_V = (k−1)²`. This is a local count, not a macroscopic ordering law.
The `L≥2k` qualifier prevents periodic wraparound coincidences that would
change the horizontal count. Under open boundaries the counts additionally
depend on the rod's position.

Policy 41 preserves its state after success and switches after failure.
Immediately after an H success it therefore starts in H. Holding the
lattice fixed until the next success, let `a=A_H/M` and `b=A_V/M`. Summing
failed H/V cycles gives

`P(next accepted rod is H) = a/[1−(1−a)(1−b)] = a/(a+b−ab)`,

`E(attempts to next success) = (2−a)/(a+b−ab)`.

These expressions apply whenever the denominator is nonzero. They describe
one next-success episode; the geometry changes after that success.

Even in the equal-availability counterfactual `b=a`, the next-success same-
orientation probability is `1/(2−a)`, exceeding one half whenever `a>0`.
Thus persistent state alone already creates a strong early preference. The
extra preference attributable to the isolated rod's differential blockage,
relative to holding the H availability fixed and setting V availability equal
to it, is only

`(a−b)(1−a)/[(2−a)(a+b−ab)]`.

For fixed `k` at large `M`, its numerator is
`(k−1)²(2k−1)/M²`; the increment is O(M⁻²). For `L=4,k=2`, the actual
probability is `52/61≈0.852459`, the equal-availability counterfactual is
`16/19≈0.842105`, and their difference is `12/1159≈0.010354`. An i.i.d. fair
orientation baseline on this fixed geometry instead has accepted-H
probability `a/(a+b)=13/25`. These are different counterfactuals and should
not be conflated.

The local inequality motivates examining persistence and orientation order.
It does **not** prove thermodynamic amplification, spontaneous symmetry
breaking, a feedback advantage under an isotropy constraint, or any optimality
claim. A fixed H initial state is an explicit directional initialization;
macroscopic spontaneous symmetry breaking would need symmetric initialization,
distributional evidence and a separate finite-size argument.

## 5. Reporting and reproducibility caveats

* Matching seeds across policies provides paired run labels and may create
  useful covariance, but event/direct engines and different policies consume
  random words differently. It is not an identical sequence of attempted
  coordinates. Paired confidence intervals remain legitimate for the chosen
  independent seed-pair sampling scheme.
* Attempt-level trajectories are explicitly restricted to the direct engine.
  Its coverage-band information counts use coverage **after** the current
  attempt. Any future information-theory result must state that binning choice
  and distinguish descriptive dependence from causal feedback benefit.
* `run-experiment.mjs` refuses to overwrite an existing raw CSV and closes it
  on failure. A failed run can leave a partial CSV without a completed
  manifest; such a file must not be treated as an accepted experiment. Source
  hashes are collected after completion. The project therefore freezes the
  core during experiment execution; mutation during a run would invalidate
  this provenance interpretation.
* None of the checks substitutes for held-out confirmation, finite-size
  examination, uncertainty reporting, or distinguishing high density from
  policy-induced termination and orientation alignment.
