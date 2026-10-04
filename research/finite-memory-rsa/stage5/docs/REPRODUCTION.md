# Reproduction, verification and archived evidence

## What actually ran

The closing work used Node `v24.14.1` on Windows. Scientific computations
use built-in modules and repository sources, with no new external package
installation. Existing NumPy/Matplotlib rendered three PNG/SVG pairs; all
were visually inspected. No TeX, PDF, Docker, old main Monte Carlo, expanded
controller-state search or website runtime was started.

All current research test files (sixteen files across the research tree)
were run once with `--test-concurrency=1`. The saved report records **142
passed, zero failed, cancelled or skipped**, 8,519.416 ms. Some existing tests
exercise small toy ensembles or classifications; this is not a rerun of
the frozen scientific main experiments. Eleven new tests cover signed
rounding, negative heap priorities, simplex coverings, independent LP-dual
agreement, raw-anchor multiplicities, direct hidden-word short horizons,
nested boxes, convex support logic, exhaustive density macros, proper
class counts and ordered support intervals.

The certificate verifier checked 240,006 word-prefix node bounds independently
using raw anchors and exact tail inequalities; replayed 9,000 parameter
leaf bounds; and independently checked 6,800 new rational Bellman scalar
equalities plus absorption reachability. Parameter replay shares its Bellman
engine with generation. It is supplemented by independently regenerated raw
geometry, LP-dual and direct short-horizon tests, not advertised as a wholly
independent implementation.

## Ordinary entry points

From a clone's research directory, use a recent Node version supporting the
standard built-in test runner. No global project wrapper is required:

```powershell
Set-Location research/finite-memory-rsa
$researchTests = @(rg --files -g '*.test.mjs' -g '!node_modules/**')
node --test --test-concurrency=1 $researchTests
node stage5/scripts/reproduce.mjs --workdir <new-directory-outside-research>
```

The placeholder must be replaced with a new actual directory. On Linux/macOS
the equivalent explicit Node test-file list and the same reconstruction
command can be used. Those platforms were not executed in this acceptance,
so this is an entry-point design claim, not recorded runtime validation.
The clean reconstruction needs no downloaded dependencies. It rejects an
existing work directory or a directory inside the frozen research tree.

On the current user's computer, dot-source the existing environment wrapper
before commands. It directs tools, caches and work files to the authorized
dependency drive. This is local development configuration, not a hardcoded
disk requirement in the scientific source. `OCV_DEPS_ROOT` gives an optional
default reconstruction work directory; elsewhere supply `--workdir`.

## Clean-source run retained for this delivery

[clean-reconstruction.json](../results/clean-reconstruction.json) records a
real separate-directory run. The import closure copied **fourteen** current
source/fixture files, checksummed each, and left all input hashes unchanged.
It freshly recomputed all six retained new exact joint laws, checked their
expected metrics and law hashes, verified 6,800 Bellman equations, repeated
the periodic/open density macro traversals (120/62 states and 9/8 terminal
atoms), checked the five dominance rows, constructed a new 31-node word
certificate and a new three-box parameter certificate, and compared simplex
LPs against an independently evaluated dual. Logs are retained under
`results/evidence/`.

This is current-source reconstruction in a clean directory, **not**:

* an independently written second exact-law solver;
* replay of all 240,006 full-size word nodes in that clean run;
* fresh execution of the historical hundreds of thousands of Monte Carlo runs;
* a cross-platform or website clean-clone deployment audit.

The independent raw-anchor certificate checks are a different evidence layer
from the copied-source exact recomputation. Expected fixture hashes are
regression targets derived from retained outputs, not newly invented truth.

## Read-only acceptance versus regeneration

`node stage5/scripts/final-audit.mjs` verifies frozen inputs, deliverables,
existing certificate hashes, tests and reconstruction evidence. After sealing
it validates the saved audit and seal without rewriting them. This is a
lightweight artifact audit, not another performance or Monte Carlo test.

Scientific generation scripts refuse to overwrite existing result files.
The full study is retained, so **do not run generation scripts in this frozen
directory merely to verify it**. In a separately authorized disposable copy,
their dependency order would be initialization, raw hull attempt, feasible
lower search, word and parameter supports, density/properness/dominance
certificates, then certificate verification. A new full budget run is not
required for this delivery and no old-study commands are part of that chain.

`scripts/plot-final.py` creates only the current plot artifacts from saved
results. The acceptance has already inspected the saved figures; changing
them after sealing would change their hashes.

## Historical preservation and manifests

The earlier seals cover 165, 368, 195 and 462 files respectively: **1,190
frozen scientific files**. The separate website baseline covers 52 more.
All were hash-checked before and after this stage. The three original
requirement-ledger hashes also remain unchanged. The current
[FINAL_EVIDENCE_MANIFEST.json](../results/FINAL_EVIDENCE_MANIFEST.json)
indexes every archived raw/processed/source artifact with its prior hash,
size and stage. It records that these are archived evidence, not newly
rerun results. The earlier seal files themselves are bound by their hashes.

The new [research-manifest.json](../results/research-manifest.json) hashes
every current Stage V source and retained artifact except itself. Its
non-self-referential scope includes the manuscript, review, acceptance audit,
cross-stage index and status. Read-only recomputation of those hashes checks
the seal. No new PDF is part of this stage; older archives are preserved as-is.
