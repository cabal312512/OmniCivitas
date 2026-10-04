# Phase 9 code license audit

2026-10-04. Scope: original repository code, copied/used example code and third-party code actually included in generated application bundles. Independently installed Docker/WSL products are outside website-code attribution.

Original project code has a root MIT `LICENSE`. Third-party packages and media retain their own terms. Existing `THIRD_PARTY_NOTICES.txt`, public `/third-party-notices.txt`, `docs/EFFECT-SOURCES.md` and `/legal/code/` are retained. No ownership or media authorization is invented.

## Distributed code

The build collector examines modules actually emitted into chunks, including dormant chunks still distributed. It retains copyright/permission text after minification, writes consolidated notices and emits package/version/source-license hashes. It does not equate every installed package with shipped website code.

| Output | Actual current inventory |
| --- | --- |
| Portal `/licenses/bundled-inventory.json` | 51 packages across 62 chunks |
| Worker `/licenses/worker-inventory.json` | sql.js and Papa Parse in one worker chunk |
| Next client `.next/licenses/next-inventory.json` | 11 packages across 20 chunks |
| Next server `.next/server/chunks/licenses/next-inventory.json` | 12 packages across 10 chunks |

A separate empty Next server compilation emits an empty inventory; it is not counted as more packages. Inventories may overlap. Full notices are in adjacent `*-notices.txt` and emitted chunks. Generated files are build outputs rather than dependencies committed to Git.

Twenty existing public license resources, including the main notice, were fetched from the deployed portal and matched byte-for-byte. New browser/worker notices and inventories were fetched successfully. Missing license text fails the build rather than silently omitting a package.

## Sources and exceptions

- Three.js package/examples: MIT. Bloom/transmission/environment references and use are documented in `EFFECT-SOURCES.md`; no external model, environment photo or whole site was copied.
- GSAP: original copyright and Standard License reference retained; it is not described as MIT.
- Alpine 3.17.4: npm omitted the separate license, so the exact official tagged MIT license is retained in `docs/licenses/alpinejs-3.17.4-LICENSE.md`.
- piccolore 0.1.3: package declares ISC and identifies picocolors as upstream; package and fork omit a separate license file. The upstream ISC notice is retained with this provenance explicit. It is not represented as a file retrieved from the fork.
- seedrandom: complete original embedded MIT notice retained. javascript-natural-sort: original author/MIT declaration plus standard permission terms, labeled because the package omits a separate license file.
- Next vendored dependencies: their own notices are collected. The omitted edge-runtime cookie license is supplied from the official Vercel repository. The server-only marker's original MIT metadata and standard terms are retained without inventing a copyright holder. CC0 declarations are labeled as such.
- DOMPurify's existing Apache/MPL resources remain; distributed package terms are not replaced with this project's MIT license.

Backfill provenance and hashes remain in the collector, generated inventories and `docs/licenses/` for future reviewers.

## Media and research

The user's unified media statement remains `MEDIA_NOTICE.md` and `/legal/`, with exactly 100 existing language options. It does not assert individual permissions. Author credits remain for Efilheim's anamnesis game music and Holizna's Retro Wave Collection research music. Scientific references, AI-assistance statements, negative results and limitations are unchanged.

The audit does not claim unknown-origin memes are cleared for redistribution or covered by MIT. It does not add redundant statements for independently installed Docker, WSL, browsers or every build tool. Later copied assets/code should be reviewed against their actual terms.

Local runtime evidence: `F:\OCVdeps\runtime\reports\phase9-release-runtime.json`. Generated inventories retain original package notice hashes.
