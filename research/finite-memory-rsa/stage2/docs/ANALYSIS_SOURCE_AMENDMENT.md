# Stage II analysis-source timing record

The original confirmation lock remains unchanged. The main agent sealed it at
`2026-10-03T19:40:33.929Z` with analysis SHA-256
`b158b2bdf12f4e198526b8967bfa0b2ce825088f7613eba8b60e23e43c770a52`.
It started independent holdout simulation at `2026-10-03T19:41:14Z`. These times
are the main agent's execution records, not reconstructed preregistration dates.
The fixed 400-test family, all arm parameters, margins and seed blocks were not
changed or resealed.

A parallel analysis worker, before receiving the sealing notice, wrote a small
additional source amendment after sealing but before any holdout analysis. This
is recorded as an actual post-lock edit, not claimed to have preceded the lock.
That temporary version has SHA-256
`47fe48e4561234a7f55e3299bea582b8d6604215c7d729b18b429261148061ae`
and is preserved byte-for-byte as
`stage2/analysis/summarize-guard-amendment.mjs`. It is dormant and is not the
confirmation-analysis entry point.

The changes in that preserved version were:

1. Extra lock-input checks require a proposal-matching source to be the compared
   candidate at the same k/boundary and reject mixed parameter signatures or
   repeated pilot seeds. They affect creation/validation of future locks; the
   existing sealed lock is not recreated through them.
2. An additional purely descriptive `matchingResiduals` output would report
   held-out trial-switch means and their paired difference CI. It had no p-value,
   no family slot and no parameter-retuning rule. It was not used to inspect or
   select holdout outcomes. This output has been removed from the active entry
   point along with the extra input guards when restoring the sealed source.
3. The protocol clarified the difference between a fixed per-step null parameter
   and a stopped-run mean switching ratio, and transporting fixed L=64 parameters
   to larger L. This explanatory amendment does not alter a hypothesis or margin.

No coverage, anisotropy, non-inferiority, Student-t, Holm, confidence-interval or
joint-benefit calculation changed in this temporary amendment. The correction
to a generic joint-benefit gate for an inappropriate coverage `less` contrast
was already part of the sealed `b158...` version and its pre-lock unit tests.

At the main agent's instruction, the worker then restored the active
`stage2/analysis/summarize.mjs` by reversing the exact amendment. Its SHA-256
again matches the original lock **byte for byte**:

```text
B158B2BDF12F4E198526B8967BFA0B2CE825088F7613EBA8B60E23E43C770A52
```

The final confirmation analysis uses this restored, originally sealed source.
There is no new lock, new holdout seed block, holdout rerun or fabricated
pre-registration time. The earlier temporary version's two scoped test passes
are not substituted for the sealed version's original full 14/14 test record.
This file is an execution-history disclosure; it does not constitute another
scientific experiment or confirmatory hypothesis family.
