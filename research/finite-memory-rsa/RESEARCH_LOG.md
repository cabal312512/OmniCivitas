# Research log

## 2026-10-04 — definitions before results

The user authorized an independent serious research project based on Prompt.txt,
with no website integration in this round. Sources, data, paper and figures live
here under stable names. Existing website code and its requirement ledger remain
unchanged; this does not authorize its phase9 audit.

The initial novelty premise needs narrowing: Lebovka et al. (2011) already
studied RRSA with orientation persistence after failure and reselection after
success. Thus success/failure history is not claimed to be new. We focus on a
complete rooted-controller classification and rigorous policy-dependent stops.
Literature notes distinguish their one-orientation stop from our geometric jam.

The baseline aligned-dimer value is calculated as 1−exp(−2), not copied from a
table with an apparent last-digit typo. The i.i.d. isotropic dimer benchmark is
about0.906823; finite lattice means need not equal its infinite-system value.

A minimal two-state event engine and an independent full-trial engine have been
implemented. The event engine skips failure cycles analytically and retains
waiting time. No occupancy statistics are exposed to the controller. Direct
trace data are kept separate. A first unit check caught an H/V-first expectation
error in a test (ID19 is V-first, ID35 is H-first); only that test expectation
was corrected. The original failed log is retained locally.

The full64-controller atlas is exploratory; its seeds and choices cannot serve
as confirmatory evidence. Confirmation configuration will be locked before new
data are generated, including temporal alternation, fair i.i.d. orientation,
aligned controls and any necessary bias controls. Further directions depend on
these results; no million-policy scan is promised merely because it is possible.

## 2026-10-04 — classification, exact stopping and scope

All64 encodings were reduced to26 rooted orientation-labelled behaviours, or13
under H/V exchange. Equivalence follows every feedback word from the specified
root; resetting the root during a state permutation would be an invalid quotient.
Eight encodings have a structural failure-fair certificate. Four H-first cases
are33/35/41/43;35 is open-loop alternation, so only33/41/43 enter the feedback
confirmation family. The certificate is sufficient on arbitrary non-jammed
lattices, not necessary from an empty lattice at every particular L,k.

Exact BigInt absorption laws cover384 controller/system combinations,24 tiny
baseline cases and monomer checks. Independent full-trial transition graphs and
linear solving validate the event elimination. A local post-first-rod calculation
separates temporal persistence from availability anisotropy: substantial41
persistence also exists at equal availability. Its small O(M^-2) excess is not
a macroscopic scaling result. This prevents an attractive local explanation
from being incorrectly promoted to a phase claim.

## 2026-10-04 — pilot, seal and genuinely new confirmation

The exploratory atlas has33,280 runs. The original36-test family lock was sealed
at2026-10-03T17:17:38.407Z, before confirmation started; its initial source hash
and pilot seeds remain unchanged. Confirmation retained all13 H-first classes
and9 fixed bias controls, with512 new seeds at L64,k2/3/4/8. Primary tests compare
all three failure-fair feedback classes with both fair IID and open-loop35,
including the0.1 absolute-order threshold. Runs, not attempts, are replicates.
Paired differences use common seeds without claiming identical attempt tapes.

The five main datasets plus the later RRSA-like reference contain226,816
completed terminal records. Final raw/analysis audits report0 duplicate keys,
0 missing primary pairs and0 pilot-seed leakage. Stored source hashes all match
the unchanged data-generating sources. Size and open-boundary experiments use
their own independently named seed ranges.

Two analysis implementation failures were repaired after sealing: a spread
argument exceeded the engine's argument-list limit when reading131,072 rows;
and subtracting a near-one CDF rounded a tiny two-sided p-value to zero. The
second calculation now uses a direct beta tail. Neither changed the planned
family, model, seeds, selection or formulas. Old diagnostics are preserved in
results/diagnostics; the historical lock was not overwritten or re-sealed.

One initial simulator test used a V-first ID with an H-first expectation; the
expectation was corrected. One intervention test demanded exact floating equality
for2.0000000000000018; it now uses a justified1e-12 tolerance. The corresponding
failed outputs remain archived. These are test corrections, not successful runs
retroactively fabricated from failures.

## 2026-10-04 — the central result changed the research route

There is no confirmed low-anisotropy coverage gain over both temporal nulls in
the locked family. Policy41 is sufficiently balanced for dimers but the adjusted
coverage intervals include zero. At k8 it gains0.0026665 over35 with Holm
p0.00703, while mean absolute order is0.50643: the density benefit is not an
isotropic memory benefit. Declining anisotropy across sizes does not prove its
infinite-size limit. The negative result and its finite resolution are retained.

Policy38 accepts H/V alternately and is almost perfectly balanced, yet deadlocks
in91.8-94.9% of the L64 confirmation runs. We therefore asked a narrower diagnostic
question: is real capacity left? External geometric continuation of768 frozen
lattices adds coverage without moving any old particle. This intervention is
outside the controller's information budget and is not counted as its advantage.
RRSA-like2048 descriptive runs and192 direct trajectories were also added after
confirmation, outside the primary36 tests. Conditional plugin information
distinguishes feedback-dependent switching but does not measure causal benefit.

No credible phase transition, universal no-memory theorem or optimal continuous
bias follows. Two-bit search, noisy/delayed feedback and full spatial-cluster
statistics were deliberately deferred. OPEN_QUESTIONS.md and the25-chapter
coverage record specify what remains; absence is not silently marked complete.

## 2026-10-04 — environment and finished reproducibility

Scientific source/deliverables remain here; downloads, actual tools/packages,
cache and temporary reconstructions are under the designated dependency root.
Core simulation/statistics use standard Node only. Python3.12.10's portable
archive was checked against its official SHA256 metadata before execution;
an obsolete release-page MD5 for a repackaged archive was not accepted as proof.
Optional packages are pinned in the two requirements files.

A first batch used a relative environment-script prefix from the research
directory, where that relative script did not exist. The standard-library
calculation nevertheless completed, but the environment preparation was not
counted as successful. Subsequent commands use the repository script's absolute
path. The entire study was reconstructed in a fresh dependency-root directory
using the correct environment and existing portable Node, independently of the
website. This provides actual evidence rather than assuming the initial prefix
worked. No package installs or Docker commands occurred in the failed-prefix
batch.

Quick reconstruction passed37/37 integrated research tests and520 archived
scientific rows. Full reconstruction executed all12 logged stages successfully;
its226,816 terminal records match every scientific column of the original
records, excluding elapsed_ms only. All768 rescue records,192 trajectory summaries
and36 statistical results match too. The historical results were not overwritten.
This is same-runtime deterministic reconstruction, not evidence of second-OS
validation or independent scientific replication. Proofs are in results/.

Thirteen figure sets, the Chinese report and a10-page English research PDF are
complete. Internal theory/literature review corrected an unverified reference,
the Purvis metadata, a B=1 branch and the RRSA stopping attribution. All10 PDF
pages were rendered and viewed; table values are generated from processed data,
not manually invented. An initial PDF text check caught formatting spaces inside
thousands separators; those were corrected without changing data or statistics.
No external peer review or journal submission has occurred. Existing52 website
files match their prior frozen hashes. Website integration and phase9 remain
unauthorized in this research-only round.
