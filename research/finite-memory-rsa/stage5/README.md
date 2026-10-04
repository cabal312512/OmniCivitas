# Final research delivery

**PROJECT STATUS: PAUSED AFTER STAGE V**

The closing study is complete within its declared budget. It proves a
periodic deterministic-one-bit support-negative theorem and the density
supremum on both tiny boundaries, while leaving the open joint and arbitrary
randomized-feedback questions unresolved. No Stage VI, website integration
or new PDF is authorized or started.

Read these in order:

1. [Chinese final summary](results/FINAL_SUMMARY.zh.md).
2. [Unified English manuscript](paper/FINAL_MANUSCRIPT.md).
3. [Capability proofs and scope](docs/FINAL_CAPABILITY_THEOREMS.md).
4. [Global bounds and remaining intervals](docs/GLOBAL_CERTIFICATION.md).
5. [Hostile final review](FINAL_REVIEW.md).
6. [Reproduction and check boundaries](docs/REPRODUCTION.md).

The [rare-event supplement](paper/RARE_EVENT_SUPPLEMENT.md) reorganizes
archived methodological work. [Literature notes](docs/FINAL_LITERATURE.md)
distinguish classical tools and close prior art from model-specific results.
[Requirements coverage](docs/REQUIREMENTS_COVERAGE.md) records partial items
without marking the open question solved. [Project status](PROJECT_STATUS.md)
contains the only three suggested questions for a possible future restart.

## Evidence map

* `experiments/protocol.json`: direction rule and finite budgets declared
  before the new feasible optimization.
* `data/lower-*.json`: six new rational realizations, joint laws and Bellman values.
* `data/word-certificate-*.json`: six full prefix partitions and tail certificates.
* `data/parameter-certificate-*.json`: six continuous parameter partitions.
* `results/periodic-negative.json`: explicit all-direction dominance witnesses.
* `results/density-limit.json`: density limit and macro traversal certificates.
* `results/feedback-scope.json`: all thirteen structural classes and properness.
* `results/certificate-verification.json`: exact support intervals and checks.
* `results/all-research-tests.txt`: 142/142 current research tests, run once.
* `results/clean-reconstruction.json`: fourteen copied inputs and six rebuilt cases.
* `figures/`: three visually inspected PNG/SVG pairs; no numerical data invented.
* [Final evidence index](results/FINAL_EVIDENCE_MANIFEST.json): archived raw and
  processed artifact paths/hashes, plus current check outputs.
* [Acceptance audit](results/acceptance-audit.json): preservation and deliverable checks.
* [Final source/artifact hashes](results/research-manifest.json): Stage V seal.

All source and artifact links resolve relative to this directory; runnable
science uses Node built-ins and local research modules, not the host's disk
layout. The plotting script uses the already available Python NumPy/Matplotlib
environment. Work directories for reconstruction are supplied explicitly
or through the optional local `OCV_DEPS_ROOT` optimization.
