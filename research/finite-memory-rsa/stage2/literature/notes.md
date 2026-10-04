# Stage II literature and provenance

Accessed 2026-10-04. This is a focused extension of the Stage I literature review,
not a claim that all prior feedback-controlled adsorption papers have been ruled out.
Stage I bibliography and findings remain unchanged.

## Relevant primary sources

- Lebovka, Karmazina, Tarasevich and Laptev (2011), Physical Review E 84, 061603,
  https://arxiv.org/abs/1109.3271 ; DOI 10.1103/PhysRevE.84.061603.
  The existing Stage I review covers RSA/RRSA protocol details. Retaining a
  selected direction after failure has relevant prior art; we do not claim
  that all feedback in RSA is new. Initial direction and stopping conventions
  must match before treating two models as identical.
- Ulyanov, Tarasevich, Eserkepov and Grigorieva (2020), Physical Review E 102,
  042119, https://arxiv.org/abs/2006.01004 ; DOI 10.1103/PhysRevE.102.042119.
  Primary abstract and full arXiv PDF consulted. Equiprobable global directions
  are compatible with local orientational domains. This project measures global
  S and temporal run statistics, not this paper's stack/domain observables.
- Marsaglia and Tsang (2000), A simple method for generating gamma variables,
  ACM Transactions on Mathematical Software 26(3), 363-372,
  https://doi.org/10.1145/358407.358414 . Publisher endpoint returned 403 in this
  session; its full text was not freshly retrieved. Standard Marsaglia-Tsang
  rejection is implemented as mathematics, not copied source.
- Hoermann (1993), The transformed rejection method for generating Poisson
  random variables, Insurance: Mathematics and Economics 12(1), 39-45,
  https://doi.org/10.1016/0167-6687(93)90997-4 . Author/university abstract:
  https://statmath.wu.ac.at/papers/92-04-13.wh.abs.html . Abstract consulted;
  preprint download returned 403. PTRS acceptance is independently audited
  against joint PMFs/generating functions, not justified merely by a citation.

General finite-chain absorption background uses the primary MIT/Oxford materials
linked in ../docs/THEORY.md. Necessary-and-sufficient absorption of a finite
substochastic chain is established mathematics. The work here is its explicit
conditional-failure specialization, two-state formulas, RSA examples, and
reproducible controlled comparison. Novelty and publishability require external
expert review; no first-in-history or phase-transition claim is made.

## Code and artifact sources

The stochastic kernel, residence-cycle derivation, rational absorption extension
and statistical adapters are new project code. Stage I lattice, RNG, arithmetic
and numerical statistics are imported read-only with recorded SHA256 hashes.
Mathematical Gamma/Poisson algorithms receive scholarly citations; no third-party
implementation was vendored or copied. Plotting dependencies remain outside the
repository. The user postponed PDF generation; the Stage II manuscript is plain
Markdown. Any future standalone PDF with DejaVu subsets must carry the actual
font notice alongside and inside the artifact. Docker is not used by this study.
