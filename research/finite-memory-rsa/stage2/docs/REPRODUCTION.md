# Stage II source-only reconstruction

Use Node 22 or newer. No npm package, Docker service or global Python installation
is required for this entry point. Run commands from the `finite-memory-rsa`
research directory. Windows development on the original machine first enters its
existing project environment, so the installed Node and temporary directory stay
under the local dependency root; that wrapper is not a portable dependency.

```sh
node stage2/scripts/reproduce.mjs --profile quick --output ../rsa-stage2-quick
node stage2/scripts/reproduce.mjs --profile full --output ../rsa-stage2-full
```

The destination must not exist and must be outside the original research tree.
The wrapper never deletes or overwrites an existing destination. If `--output` is
omitted, a uniquely named directory under the operating system's temporary
directory is used. On the original machine choose a new directory under the
configured dependency disk explicitly. Paths in the program and plan are portable.

The output is a new research root, containing `stage2/` and the few parent modules
required by relative imports. Copied files are source, configurations, protocols
and test source, not archived raw/processed data, figures or sealed locks. Stage I
contributes only its lattice, RNG, rational/helper and numerical/CSV modules;
none of its scientific simulation or controller studies run. The original Stage I
and Stage II directories remain unchanged.

## Quick

Quick runs the Stage II BigInt exact small-system study, then eight representative
stochastic controllers at L=16, k=4, periodic boundary, 16 independent seeds per
controller starting at 60000001. All arms share that block for paired diagnostics.
It creates 128 actual terminal rows and their accepted-run histograms, and calls
the current Stage II analyzer without a confirmation lock. The analyzer checks
terminal/count identities and optional observables; the wrapper checks raw and
histogram hashes and row/group counts. The data are labeled `quick-pilot`, not
holdout evidence. There is no claim about a coverage advantage, matching to an
archived fixture, or an increased research sample size.

The eight points are (0,0), (0,1), (1,0), (1,1), (.5,.5), (1,.001), (.02,1) and
(.85,.5). The exact calculation covers 52 L=2/3 dimer systems under both
boundaries, with the nine rational endpoint/half-probability pairs and four
quarter-probability checks. Exact results and quick Monte Carlo data are distinct
outputs; the L=16 quick rows are not an exact-distribution fidelity test.

## Full and lock order

Full reads the explicit portable plan at `stage2/docs/reproduction-plan.json`.
`--plan` accepts a different path relative to Stage II. Before starting, it checks
that all listed configuration/specification files exist, output names are unique,
pilot names agree, and every locked arm's seed block agrees with its post-lock
experiment configuration. A missing final specification or mismatched seed block
stops the run instead of falling back to a guessed study.

The current plan reconstructs these eight experiment configurations sequentially:

1. `landscape`, `refinement`, `refinement_success_flip`, `large_size`,
   `exact_validation_event`, `exact_validation_direct` run before the new lock.
2. The new exact results and the two reconstructed exact-validation experiments
   are compared by the existing Stage II validation script.
3. Only the three designated pilot experiments feed `lockFamily`. Their new raw
   hashes and the copied analysis/numerical-source hashes are recorded. The frozen
   hypothesis specification is retained, and a new `experiments/reproduction.lock.json`
   is sealed before either post-lock experiment begins. The archived
   `experiments/confirmation.lock.json` is excluded from the source copy.
4. `confirmation` and `confirmation_stability` use their unchanged fixed
   parameters, strata and seed blocks. Stability belongs to the same explicit
   hypothesis family. The wrapper checks that their start timestamps follow the
   new lock and runs the complete Stage II analyzer with that new lock. Its
   `analysisExperiments` list explicitly includes the six main experiment CSVs;
   the two exact-validation CSVs remain separate implementation evidence.

The specified matched diagonal parameters are frozen decisions based on the
original pilot. During reconstruction, the lock code recomputes their matching
source estimates from the reconstructed pilot rather than fabricating pilot
null observations. No new winner selection, margin tuning or additional scientific
confirmation sample is performed. Replaying the same seeds tests deterministic
reconstruction; it does not double any sample count or create a second study.

Every process runs sequentially through the already active Node executable. Logs
stream to files rather than accumulating a large stdout buffer. The wrapper does
not launch the website or infrastructure. The existing simulation configurations
retain their original repetition counts, including reduced counts at L=1024/2048;
the wrapper never silently reduces them to finish sooner.

## Evidence and limits

Each fresh output contains `stage2/results/reproduction-proof.json`, per-command
logs, newly generated raw manifests/histograms and analysis audits. The proof
records the runtime, copied source SHA-256 values, exit codes, exact case count,
experiment counts/seed blocks and, for full, the new lock hash and timestamp.
A failed process retains a proof with status `failed` and its log; no successful
full result is inferred merely because the source/configuration exists.

This wrapper does not run the integrated unit suite, Python plot/PDF generation,
the separate fixed-geometry rare-excursion diagnostic, or any Stage I simulation.
Those checks and artifacts have their own evidence. Optional plot rendering from
a successfully reconstructed full directory can use its copied
`stage2/analysis/figures.py`, with NumPy and Matplotlib installed in the user's
chosen environment. No claim about another operating system follows from a
Windows-only run.

Quick was actually verified in a new source-only directory on Windows x64 with
Node v24.14.1 on 2026-10-03 UTC: all three subprocesses exited zero, all 52 exact
cases were generated, and the raw/histogram manifest checks plus analyzer audit
passed for 128 rows in eight groups. The active analyzer SHA-256 was
`b158b2bdf12f4e198526b8967bfa0b2ce825088f7613eba8b60e23e43c770a52`.
No archived raw results or locks were copied and no package was installed.

Full is implemented but has not been executed by the wrapper author during this
task; the archived original studies are not substituted for that missing evidence.
