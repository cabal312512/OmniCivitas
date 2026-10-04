# Stage III source reconstruction

This research entry needs **Node 22 or newer and no installed packages**. The recorded run used Node 24.14.1 on Windows x64. Standard Node commands are portable; Linux and macOS execution were not tested in this task. No Docker, WSL, website, pnpm installation, absolute drive layout or old study outputs are required.

Run from the `research/finite-memory-rsa` directory:

```sh
node stage3/scripts/reproduce.mjs --profile quick --workdir ../rsa-stage3-quick-001
```

`--workdir` must name a **new directory outside this research source tree**. Existing directories are refused, even if empty. The program never deletes or replaces a previous reconstruction. Without this option it creates a unique directory under `OCV_RESEARCH_WORK_ROOT`, or under `OCV_DEPS_ROOT/tmp/rsa-stage3`. If neither environment variable exists, the command asks for a work directory through an error; it has no system-temp fallback. On the current development machine these environment variables keep actual temporary execution on the dependency disk. Other users can choose any suitable local directory.

The new directory contains `source/`, `logs/` and `evidence/reconstruction.json`. An optional `--report NEW_JSON_FILE` writes a second report to a new explicit destination. Failures preserve their partial report and logs; they are never promoted to passes. Node child processes use the current Node executable, standard argument arrays and no platform shell commands.

## What quick actually does

The source copy contains the static import closure of the Stage III entry points, the fixed search protocol, and one small disclosed regression fixture. It includes the read-only parent lattice, RNG, Fraction/placement helpers, numerical analysis helper and Stage II fair-IID sampler because Stage III imports them. It does **not** rerun any Stage I or Stage II study, and does not copy their archived experiments or data. It also does not copy Stage III's full raw data, generated catalogues, sealed lock, exploratory plans or inference results into the fresh workflow's inputs.

`results/evidence/quick-reference.json` is deliberately a reference fixture, not fresh evidence. It contains 78 selected original Stage III CSV records, expected scientific hashes and their provenance. `make-quick-reference.mjs` extracts that fixture from archived artifacts without simulation and refuses to overwrite it. The reconstruction does not call this extractor or silently refresh the expected answers.

The fresh copy then:

1. Regenerates all eight one-through-four-state feedback/temporal catalogues and all eight labelled-index mappings. The frozen generator cross-checks labelled enumeration against an independent accessible-rooted-graph algorithm, a graph-count recurrence, the temporal sequence formula and temporal inclusion. Full catalogue payload hashes and mapping bytes must match the reference. Timestamp and elapsed-time metadata in `summary.json` are not scientific comparison fields.
2. Replays 78 representative seeds: 20 coarse, 40 middle and 18 confirmation rows. These cover both rod lengths, all study lattice sizes, feedback memory strata that exist in each plan, four-state temporal controls, the IID reference, and the first/last seed of each selected arm. All **26** CSV fields must match, including actual attempted/failed counts, signed order, boundary, final state and orientation exchange. Blank IID controller-state fields stay blank.
3. Solves eight L3,k2 exact cases: IID fair, temporal-4-00023, feedback-4-00006 and feedback-4-23071, each with open and periodic boundaries. It compares the full joint terminal law and terminal-weighted attempt rewards, not just rounded means. In particular the cost is exact **E[A/N]**, not E[A]/E[N].
4. Regenerates all nine finite failure-kernel models, including positive-epsilon rational moments, zero endpoints and independent forest certificates. Fourteen additional exact rational checks use elementary persistent-progress, consecutive-success and `T=1+B*G` formulas; they are not copies of stored moment answers.
5. Verifies that every copied source/fixture/protocol file remained byte-identical in both the original tree and the fresh copy.

Scientific JSON hashes recursively sort object keys and retain array order. Entire catalogue/result/model payloads are included. Generation metadata outside those payloads is excluded. Raw CSV records and mapping buffers are compared exactly. These conventions differ deliberately from file-byte hashes and compact parsed-plan hashes; see [HASH_CONVENTIONS.md](HASH_CONVENTIONS.md).

## Recorded quick execution

The actual clean reconstruction ran at 2026-10-04T04:39:16–04:39:20 UTC in a new dependency-disk directory. Its source copy comprised 23 files and the three child commands all exited zero. The total measured wall time was 4.43 seconds. The permanent result is [clean-reconstruction.json](../results/clean-reconstruction.json); detailed replay records, eight newly solved exact laws and rational checks are retained in the fresh directory named by that result. This is the current machine's provenance, not a path dependency of the public command.

Portable copies of the actual child-command logs, regenerated classification summary, replay CSV/checks and rational formula checks are also retained in [clean-source-quick/](../results/evidence/clean-source-quick/). These are review artifacts from the execution, not input data for a new experiment.

| Check | Actual result |
| --- | ---: |
| Regenerated catalogues | 8/8 matching |
| Regenerated labelled mappings | 8/8 matching |
| Replayed scientific rows | 78/78 matching |
| Fields checked per replayed row | 26 |
| Newly solved exact cases | 8/8 matching |
| Regenerated singular models | 9/9 matching |
| Additional exact rational formula checks | 14/14 passing |
| Copied files unchanged | 23/23 |

Replaying fixed seeds is an implementation reproducibility check. These rows are not additional independent study replicates. Classification's independent algorithms provide an internal cross-check; clean execution of the same frozen simulator is not a second independently written simulator or an additional operating-system certification.

## Explicit full primary-workflow mode

```sh
node stage3/scripts/reproduce.mjs --profile full --workdir ../rsa-stage3-full-001
```

**This mode was implemented but not executed in this task.** It really launches source experiment commands, rather than only running tests. Its sequence is classification → new coarse plan and coarse sampling → middle selection and sampling → a freshly generated confirmation lock → confirmation sampling → independent metadata/SE validation → frozen primary analysis → independent numeric comparison → the 2,000,000-observation rare-entry diagnostic → the quick exact/theory subset.

The original sealed lock is only referenced as fixture provenance, never copied as a new preregistration. The new lock must record a time before the fresh holdout starts. Full reproduction uses the original protocol's fixed seed blocks and deterministic selection rules, then checks all three regenerated scientific raw hashes. New timestamps and metadata-dependent selection/lock hashes can legitimately differ. It is a reproduction of the earlier pilot-before-holdout workflow, not a new blinded research study or a new statistically independent confirmation.

Full's scope is all 284,040 **primary** Stage III RSA workflow rows, frozen inference and the separate rare-entry diagnostic. The wrapper solves only the disclosed eight-case exact subset; it does not rebuild the full 86-case survey, manuscript, figures or PDFs. Historical preservation checks requiring the complete old studies are also outside this minimal source-only copy. No existing website files or services are used.

The additional read-only validator refuses altered arm metadata, boundary/L/k/experiment values, duplicate or unlocked seeds, incomplete null inventories and a zero-SE nonzero-effect primary test before the frozen analyzer runs. It supplies validation guards for this fixed design without editing the locked analysis. Current inference was separately reviewed on every row; see [STATISTICAL_REVIEW.md](STATISTICAL_REVIEW.md).
