# Reproduction and evidence scope

Run from this Stage IV directory with Node.js 24 or compatible modern Node;
scientific code uses no npm package. Older project exact/controller source and
the frozen Stage III catalogue are read-only scientific inputs. They must be
included with the research tree; they are not system installations.

```sh
node --test tests/core.test.mjs
node scripts/reproduce.mjs --workdir /a/new/external/reconstruction-directory
```

On the current Windows development machine, dot-source the project's configured
`scripts/Enter-OcvEnvironment.ps1` before commands, and use its F-drive Node.
Without `--workdir`, reconstruction uses OCV_DEPS_ROOT/tmp when configured;
there is no system-temp fallback. Other computers may supply any new directory
outside the research tree. The code has no required drive letter or username.

Actual clean quick reconstruction copied 16 source/input files into a new F-drive
tree, with no installed packages and no changing copied hashes. It recomputed:
22077 universal classes from the archived 28534-class input; 13 lower-state
physical witnesses; ten exhaustive T=4 certified supports; two complete tiny
joint terminal laws and independent Bellman checks; twelve higher-moment leading
terms; deterministic splitting survival/extinction checks. Logs and input hashes
are retained in `results/clean-reconstruction.json` and `results/evidence/`.
This is a **quick source reconstruction**, not a fresh website clone/deploy
audit, not independent reenumeration of Stage III, and not a rerun of all 377
new exact cases, 28k fixed-geometry classes or the 128-batch splitting study.

Current combined tests: 24/24, `results/unit-tests-acceptance.txt`, Node's human-
readable reporter. Earlier reports are retained, including the initial 21/22
run failing solely on JS negative-zero metadata; normalization fixed it before
the 22/22 and current 24/24 runs. Those older files' `.tap` extension does not
change their actual reporter format. No failed numerical result was discarded.

Individual completed-study scripts refuse output overwrite. To recalculate a
study, create a separate copy/output tree; do not remove retained results to
force it to run. Entry points are:

| Script | Action |
|---|---|
| `operational-survey.mjs` | Full deterministic quotient and fixed tiny trace classes |
| `process-witness.mjs`, `activation-lower-bound.mjs` | Positive physical witnesses and randomized threshold |
| `certify-envelope.mjs` | Complete prefix certificates, basic/informed modes |
| `capability-search.mjs` | Declared exact feedback and temporal feasible pools |
| `refine-temporal.mjs` | Bounded exploratory seven-coordinate refinement |
| `proper-boundary-null.mjs` | Exact proper two-state density-optimal schedule |
| `check-bellman.mjs` | Independent retained-certificate scalar residual checks |
| `hmm-structure-study.mjs`, `audit-memory-matching.mjs` | Temporal rank/equivalence and conservative memory fairness |
| `moment-study.mjs` | New forest/path moment valuation comparisons |
| `splitting-study.mjs` | Fixed unknown-entry product benchmark, raw retention |
| `plot-results.py` | Render retained outputs with NumPy/Matplotlib, no new experiment |
| `audit-results.mjs`, `seal-results.mjs` | Current acceptance/freeze audit and non-overwriting final manifest |

The final manifest binds final sources and retained artifacts. Some source
generalizations were made after early calculations (reachable product-state
inversion, causal validation and negative-zero normalization); independent
residual/quick checks validate the selected affected boundary examples. The
manifest is not falsely presented as a pre-study hash for every calculation.
There was no holdout packing Monte Carlo in Stage IV. All old manifests and
frozen website hashes are checked separately at acceptance.

Figures are five PNG/SVG pairs, visually inspected. Plot reproduction requires
NumPy/Matplotlib separately; the numerical scientific routines do not. The
current machine's Matplotlib cache remains in the local dependency directory.
No PDF or TeX toolchain was installed or generated.
