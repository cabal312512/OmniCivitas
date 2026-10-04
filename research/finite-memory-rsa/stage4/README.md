# Stage IV — stochastic temporal null and physical controller memory

Completed 2026-10-04. The serious research lives here; the website is unchanged.
Stage I–III remain frozen. No PDF was generated.

Read [the Chinese acceptance report](results/RESEARCH_REPORT.zh.md), then
[the English paper](paper/paper.md). Exact, exploratory and unresolved statements
are separated. There is **no certified joint feedback advantage over the complete
same-memory stochastic temporal family**. There are exact process-law,
operational-memory, scoped density and higher-moment results.

| Area | Main files |
|---|---|
| Authority/design | `docs/USER_BRIEF.zh.txt`, `experiments/protocol.json`, `RESEARCH_LOG.md` |
| Complete null/equivalence | [STOCHASTIC_NULL.md](docs/STOCHASTIC_NULL.md), `src/temporal.mjs`, `src/hmm-structure.mjs` |
| Physical quotient/threshold | [OPERATIONAL_THEORY.md](docs/OPERATIONAL_THEORY.md), `results/operational-survey.json`, `results/activation-randomized-lower-bound.json` |
| Certified global outer supports | [ENVELOPE_CERTIFICATION.md](docs/ENVELOPE_CERTIFICATION.md), `data/envelope*.json` |
| Capability/memory fairness | `results/capability-search.json`, `results/memory-matching-audit.json`, `results/temporal-refinement.json` |
| Higher moments | [HIGHER_MOMENTS.md](docs/HIGHER_MOMENTS.md), `results/higher-moments.json` |
| Unknown entry | [UNKNOWN_ENTRY.md](docs/UNKNOWN_ENTRY.md), `results/unknown-entry-splitting.json`, `data/splitting-dwell.csv` |
| Attribution/limits | [LITERATURE.md](docs/LITERATURE.md), [OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md), [REQUIREMENTS_COVERAGE.md](docs/REQUIREMENTS_COVERAGE.md) |
| Reproduction/acceptance | [REPRODUCTION.md](docs/REPRODUCTION.md), `results/clean-reconstruction.json`, `results/acceptance-audit.json`, `results/research-manifest.json` |

Scientific Node code requires only the standard library plus the frozen in-repo
scientific sources/catalogue. Normal portable commands from this directory:

```sh
node --test tests/core.test.mjs
node scripts/reproduce.mjs --workdir /a/new/external/directory
```

Use the project's configured development wrapper on the current Windows machine;
do not fall back to C-drive package tools. Reproduction never overwrites retained
results. Optional figure rendering needs NumPy/Matplotlib. Do not rerun archived
Stage I–III scripts or advance to another research/website stage automatically.
