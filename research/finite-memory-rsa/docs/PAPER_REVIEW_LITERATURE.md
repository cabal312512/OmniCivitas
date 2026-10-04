# Literature review of the manuscript template

Reviewed: **2026-10-04**. Scope: the Related work section, in-text citation mapping and References in `paper/manuscript.template.md`, checked against the existing verified `literature/references.bib` and source-access notes. The RRSA implementation was inspected read-only to understand the stated comparison. No new large search, experiment, website edit or manuscript edit was performed.

## Required corrections

### 1. Replace the unverified Privman reference, rather than mixing publication records

The template's reference 2 is absent from the current twelve-entry verified bibliography. It joins a 2000 journal citation to a 2006 arXiv identifier while calling that record verified. Neither the author/year/page combination nor the claimed relationship between versions has been verified in this project. Do not leave this citation in a deliverable or rely on the final “bibliographic metadata take precedence” sentence to excuse it.

The smallest supported repair is to use the already verified **Ziff (1994)** reference for the arrival-history distinction. Replace reference 2 with:

> 2. R. M. Ziff. Traces of the arrival history in the jammed state of random sequential adsorption. Journal of Physics A: Mathematical and General 27, L657–L662 (1994). https://doi.org/10.1088/0305-4470/27/18/003

This maps to `ziff1994history`. The Introduction's `[1,2]` then supports general RSA context plus persistent arrival-history structure. Update the Related work sentence as provided below. This repair keeps the existing twelve-entry bibliography unchanged. If Privman is important to the author, verify and add the exact record separately; do not reconstruct metadata from memory.

### 2. Correct the Purvis reference's title and two author names

Reference 6 currently has the correct DOI/volume/article number but the wrong title and unsupported initials. The verified record is `purvis2015availability`. Replace it with:

> 6. B. E. Purvis, L. Reeve, J. A. D. Wattis and Y. Mao. Scaling behavior near jamming in random sequential adsorption. Physical Review E 91, 022118 (2015). https://doi.org/10.1103/PhysRevE.91.022118

The accepted-manuscript rendering uses a shorter first-author form; the registered journal metadata verified in this project uses **B. E. Purvis**. Neither “D. H. Purvis” nor “R. G. Reeve” is supported.

### 3. Separate Bonnier's isotropic work from Lebovka's partial-orientation work

The current sentence attributes partially oriented k-mers jointly to Bonnier [3] and Lebovka [4]. The inspected Bonnier paper concerns ordinary isotropic square-lattice line-segment deposition, finite sizes and time-series estimates. Lebovka is the inspected partial-orientation/RRSA comparison. State those contributions separately.

### 4. Narrow the established-algorithm statement to what the references support

Purvis [6] establishes availability as an observable and analyzes its relationship to coverage. The first Related work paragraph also says efficient rejection skipping is established, without giving a specific supporting algorithm reference in its six-reference list. That general statement may be true, but this exact citation mapping does not document it. The minimal repair is to keep the supported availability statement; the project's event sampler remains explained mathematically elsewhere.

## Direct replacement for Related work paragraph 1

Use the following paragraph together with the reference 2 and reference 6 corrections:

> Evans [1] reviews random and cooperative sequential adsorption. Ziff [2] studies arrival-history imprints in jammed one-dimensional dimer deposits; this structural memory is distinct from internal controller memory. Bonnier et al. [3] study isotropic square-lattice k-mers and finite-size effects, while Lebovka et al. [4] compare partially oriented RSA and relaxation RSA. Gan and Wang [5] give the high-precision isotropic square-lattice dimer estimate 0.906823(2), useful for a large-system baseline check. Availability is already an established observable; Purvis et al. [6] analyze its relationship to coverage and adsorption kinetics.

This text uses only the archived verified records. No new source is needed.

## RRSA attribution and stopping rule

The existing manuscript correctly identifies the main novelty boundary: RRSA already retains orientation after failure and redraws it after success, which can be represented by an outcome-dependent stochastic two-state policy. Keep that acknowledgment. It is inaccurate to introduce finite-memory feedback generally as unprecedented.

There is one stopping-rule distinction to sharpen. `src/rrsa.mjs` checks the **currently held orientation**. It can accept further particles in that direction after the opposite orientation's availability reaches zero. The inspected Lebovka model description states termination upon exhaustion along one direction; it does not provide operational pseudocode resolving every implementation detail. We should not imply that the code has been verified to reproduce the paper's complete stopping procedure. In particular, “Like their protocol” in the source comment is stronger than the source inspection warrants. This is an attribution/documentation issue; the implemented finite-state policy is clearly defined and need not be changed to repair it.

Suggested replacement for Related work paragraph 2:

> The relaxation RSA (RRSA) protocol in [4] retains a rejected particle's orientation while drawing new positions, then redraws orientation after success. Outcome-dependent temporal orientation choice therefore predates this study and can be represented as a stochastic two-state controller. Our descriptive RRSA-like reference implements that retention/redraw rule, starting with a fair random direction and terminating when its held direction has no legal placement. Under our allowed set {H,V}, remaining placements in the opposite direction are labeled controller deadlock. The source describes stopping upon exhaustion in one direction; we have not established that all details of its stopping convention match ours. Its tabulated endpoint coverages are consequently contextual comparisons rather than same-protocol ground truth, including for this descriptive reference.

In Results 6.2, replace the beginning “RRSA with fair redraw after success yields…” with **“Our RRSA-like reference with fair redraw after success yields…”**. Retain the statement that it was added after confirmation and is descriptive. The numerical values themselves were not re-audited in this literature review.

## Reference list consistency

References 1, 3, 4 and 5 match the verified records in their substantive bibliographic fields. Expand initials only if desired; fix ordinary spaces between journal names, volume, pages and years in the exported report. Gan–Wang's journal year is correctly **1998**, although its arXiv preprint is from 1997.

After replacement, the six numbered references map to:

| Number | Verified BibTeX key |
| --- | --- |
| 1 | `evans1993review` |
| 2 | `ziff1994history` |
| 3 | `bonnier1994segments` |
| 4 | `lebovka2011oriented` |
| 5 | `gan1998series` |
| 6 | `purvis2015availability` |

Replace the final precedence sentence with a transparent archive statement:

> The complete twelve-entry bibliography, search record and source-access limitations—including the unretrieved 2012 publisher note—are archived in literature/references.bib, literature/search-log.json and literature/notes.md.

A final report's own references should be correct; readers should not have to consult another file to determine which citation metadata to believe.

## Claims that already have appropriate limits

- The abstract explicitly denies a priority claim over existing outcome-dependent RSA protocols.
- Related work calls the search targeted, not systematic, and does not infer absence from an unsuccessful exact-keyword search.
- The unretrieved 2012 publisher note is acknowledged without guessing its contents.
- The aligned-dimer discrepancy is reported as a printed-value inconsistency against 1 − exp(−2), without claiming its cause or assigning it to that note.
- The high-precision isotropic dimer number is presented as a numerical series estimate, and the finite-size baseline is assessed for statistical compatibility rather than six-digit reproduction.
- The stated contributions concern this controller classification, terminal-state calculation and comparison. They do not claim that history dependence, availability, correlated adsorption or generic feedback control was invented here.

No additional novelty wording is required once the specific reference and RRSA-attribution repairs above are made.
