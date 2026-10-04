# Finite-memory RSA: Stage II

Serious computational research, completed 4 October 2026. Start with
`results/RESEARCH_REPORT.zh.md` or the English manuscript `paper/paper.md`.
The exact second-stage user brief is `docs/user-brief.txt`. Stage I code,
datasets, papers and conclusions are immutable read-only inputs.

## Answers supported by this stage

- **Feedback control:** four independently evaluated mechanism representatives
  do not establish a coverage/anisotropy benefit over the entire tested
  temporal-null frontier. One k4,L64 comparison with a particular
  proposal-persistence null is positive after Holm correction, but does not
  repeat as a density benefit at L256/512. Low accepted-direction imbalance is
  controllable; universal packing advantage is not established.
- **Policy41 sizes:** measurements reach L2048. Coverage effects shrink and the
  largest-size pointwise intervals include zero. Global bias decreases, but k8
  still has mean absolute S about .148. No infinite-volume limit, equivalence
  conclusion or phase transition is asserted.
- **Liveness:** a geometry-specific substochastic failure-kernel criterion is
  necessary and sufficient. For this family, beta>0 removes strict controller
  deadlock almost surely. Rare waits can diverge; being live is not being fast.

## Evidence

| Evidence | Actual count |
| --- | ---: |
| Complete21x21 pilot, L64,k4/8 | 56448 runs |
| Requested small-alpha refinement | 12800 runs |
| Adaptive opposite-corner refinement | 8448 runs |
| Policy41/fair/alternating, L128..2048 | 3072 runs |
| Independent L64 confirmation | 59392 runs |
| Independent L256/512 stability | 3072 runs |
| Main research terminal runs | 143232 |
| Exact-reference event/direct validation | 212992 runs |
| Rational controller/system cases | 52 |
| Frozen-geometry rare-wait observations | 700000 draws |
| Locked joint multiplicity family | 400 tests |
| Integrated Stage II unit checks | 38 passed |

Tiny-system validation and frozen-geometry draws are not additional packing
replicates. Same-seed reconstruction is not a new scientific sample. The
research uses standard Node and optional Python plotting; Docker and the
website are not involved. The user postponed PDF generation: the manuscript
is delivered as Markdown, and no Stage II paper PDF has been created.

## File map

- `src/stochastic.mjs`: direct trial and residence-cycle event engines;
  joint actual waiting counts, orientation transitions and accepted-run evidence.
- `src/exact-stochastic.mjs`: rational tiny-system absorption and waiting kernel.
- `experiments/*.json`: explicit sizes, probabilities, repetitions and seeds.
- `experiments/confirmation.lock.json`: original sealed400-test family.
- `data/raw/`: individual observations, accepted-run JSONL and completed manifests.
- `data/processed/final/`: authoritative sealed-source main analysis.
- `data/processed/exact-validation.json`, `rare-excursions.json`: separate fidelity
  and kinetic studies. `matching-descriptive/` is supplementary only.
- `figures/final/`: screened PNG/SVG scientific plots. Earlier plots remain
  historical outputs; no new PDF export is needed.
- `docs/THEORY.md`, `SIMULATOR.md`, `STATISTICAL_PROTOCOL.md`: precise model,
  theorem, sampling and inference assumptions.
- `docs/ANALYSIS_SOURCE_AMENDMENT.md`: transparent source-coordination incident;
  primary analysis uses the original sealed source, not the later guarded copy.
- `docs/REQUIREMENTS_COVERAGE.md`, `OPEN_QUESTIONS.md`, `RESEARCH_LOG.md`:
  brief coverage, deferred questions and data-led decisions.

## Portable reproduction

Use Node22 or newer on PATH. From this directory, choose a **new** output folder:

```sh
node --test tests/stochastic.test.mjs tests/exact-stochastic.test.mjs tests/statistics.test.mjs
node scripts/reproduce.mjs --profile quick --output ../../rsa-stage2-quick
node scripts/reproduce.mjs --profile full --output ../../rsa-stage2-full
```

Read `docs/REPRODUCTION.md` for the complete command contract and evidence. Full
reproduction uses the original seeds and fixed experimental route, seals a new
equivalent lock after its pilot and before its holdout, and preserves the
historical lock. It does not rerun Stage I experiments. Shared Stage I source
imports must remain present in the parent research folder. No machine-specific
drive layout, pnpm package or Python package is required for core simulation.
On the current Windows machine, dot-source the project's environment wrapper;
scratch reconstructions, tools and caches belong under its dependency root.

The ideal probability construction is exact; numerical Gamma/Poisson sampling
still uses floating arithmetic and a finite32-bit RNG. The supported study
range is far above its tiny-probability resolution floor. Full trial-run
histograms are unavailable for event aggregation and are stored as null, not
invented or substituted with accepted-run histograms.
