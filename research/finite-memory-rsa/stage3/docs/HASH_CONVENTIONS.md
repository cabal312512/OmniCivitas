# Hash conventions

All hash values use SHA-256. Two encodings appear and are intentionally distinct:

* Experiment summaries (`*-groups.json`) and the independent statistical audit's
  `datasets[].planSha256` hash the compact `JSON.stringify(parsedPlan)` encoding used
  by the runner. This preserves object property order and ignores indentation; it
  is not a general canonical-JSON standard.
* `raw-audit.json` plan hashes, `confirmation-analysis.json.lockedFileSha256`,
  candidate selection input hashes and the final artifact manifest hash the actual
  file bytes, including indentation/newlines.

Consequently a pretty-printed plan can have a different byte hash from its compact
runner encoding without any scientific field changing. The independent validator
checks the compact hash against the experiment's recorded input; the final manifest
also preserves the actual bytes. Source and data hashes are always content-byte
hashes, unless a field explicitly describes a compact JSON encoding.

The initial 42 exact-survey cases keep their original runner/selection seal. A later
selection-runner change extended the case pool without altering solver, controller
or catalogue sources. Each reused case's original seal remains recorded, with the
runner-selection difference separately disclosed. No frozen case is silently resealed.

Stage I/II manifests and all their listed artifacts are checked as historical byte
records. The website's 52-source frozen9 record is a local development evidence file,
not a portable runtime dependency. Local paths in recorded provenance indicate where
the completed experiment ran; application/source commands do not require those paths.
