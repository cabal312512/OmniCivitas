# Outcome feedback under a fixed memory budget — Stage III

Stage III is a completed, separate research stage. Stage I/II scientific sources,
data and conclusions remain frozen. Website integration and its release phase are
outside this stage. No PDF is generated.

Read [the Chinese research report](results/RESEARCH_REPORT.zh.md), the
[English paper](paper/paper.md), and the precise proof notes:
[classification](docs/CLASSIFICATION.md), [minimal memory](docs/MINIMAL_MEMORY.md),
and [singular exploration](docs/SINGULAR_THEORY.md).

The complete labelled spaces contain 1,048,576 feedback controllers and 4,096
outcome-blind temporal controllers. They reduce to 28,534 and 24 rooted behavioral
classes, including 8,730 and 16 universally live classes respectively. An exact
tiny-lattice example already gives a new cost/imbalance tradeoff with one bit;
the independent L64 holdout does not confirm a candidate satisfying the full
matched-memory joint-benefit gate. This does not prove a large-system impossibility.

The strongest general analysis concerns fixed-geometry failure kernels: the mean
singularity is a difference of directed tree and eligible forest valuations, with
an exact leading constant. Shortest exploratory-path length alone is insufficient.
Rare entry and long dwell give explicit moment/UI thresholds and a measurement
experiment contrasting naive and conditional Monte Carlo.

## Files and evidence

| Path | Purpose |
| --- | --- |
| `docs/USER_BRIEF.zh.txt` | Verbatim Stage III user brief |
| `experiments/search-protocol.json` | Pre-observation search, budgets, seeds and gate |
| `experiments/confirmation.lock.json` | Candidates, 612 tests and source/analysis seals locked before holdout |
| `src/controllers.mjs`, `data/classification/` | Exact minimization/enumeration, multiplicities, liveness certificates and per-label audit maps |
| `src/simulate.mjs`, `src/exact.mjs` | Generic four-state actual-kinetic RSA and BigInt exact terminal/reward solver |
| `src/frontier.mjs`, `src/convex-frontier.mjs` | Multi-objective selection and optional external-mixture diagnostics |
| `src/phase-type.mjs`, `data/theory/` | Rational-polynomial moments, graph certificates and nine exact models |
| `data/raw/`, `results/*groups.json` | All 284,040 main terminal observations and summaries |
| `data/exact/`, `results/exact-survey.json` | 86 exact L3/k2 cases and rational frontier comparisons |
| `data/rare-event/` | Ten models, two methods, 2,000,000 retained draws and 2,000 batches |
| `results/synthesis.json` | 1,440 constrained empirical optimization cells and memory frontiers |
| `results/confirmation-analysis.json` | Full locked-family holdout results; approximate joint gains clearly distinguished from strict dominance |
| `results/raw-audit.json`, `results/research-manifest.json` | Row-level checks, frozen-stage preservation and final artifact hashes |
| `figures/` | Six standalone figure sets, PNG/SVG only |
| `docs/REPRODUCTION.md`, `docs/STATISTICAL_REVIEW.md` | Clean-source reconstruction and independent inference review |
| `docs/REQUIREMENTS_COVERAGE.md`, `docs/OPEN_QUESTIONS.md` | Completed scope, explicit deferred work and limits |

## Portable commands

From `research/finite-memory-rsa`, use an ordinary current Node installation:

```text
node --test stage3/tests/*.test.mjs
node stage3/scripts/reproduce.mjs --profile quick --workdir /your/temporary/reconstruction
```

Node 24 accepts that test glob even when the shell does not expand it. The
reproduction guide gives the exact tested command and full
mode. Main experiment scripts refuse to overwrite existing observations. Use a
fresh reconstruction directory when rerunning the workflows. NumPy/Matplotlib
are optional only for `python stage3/scripts/plot_results.py`; the research
simulation, exact solvers, tests and reconstruction use Node standard libraries.

On the current Windows machine, dot-source the project's local environment before
commands. Tools, temporary reconstruction and plotting caches live under the
configured dependency root; no source command requires the user's drive layout.

## Claim discipline

Structural enumeration is complete. Performance search is multifidelity and only
L16 is exhaustive over the live class catalogue; fifty k8 survivors were capped
before middle-fidelity runs. The L64 holdout has six feedback candidates per k,
all sixteen temporal comparators and IID fair. Its 0.01 imbalance and 10% cost
margins define a qualified joint benefit, not strict Pareto dominance. No candidate
passes every comparator. Exact tiny-system frontier extension and this gate are
different questions. Stochastic four-state optimization, thermodynamic limits,
three-bit brute force and a multi-action adsorption survey were not performed.
