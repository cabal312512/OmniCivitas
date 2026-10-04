# Literature review: finite-state temporal feedback in lattice RSA

Search and source inspection date: **2026-10-04**. Bibliographic fields were checked against publisher pages and Crossref's DOI registration API. Full texts were inspected on arXiv or author/institutional repositories where available. This is a targeted review, not a systematic-review claim and not proof of priority.

## Most consequential finding

The proposed broad novelty claim is too strong: a success/failure-dependent orientation protocol already appears in **relaxation RSA (RRSA)**. Our potentially distinctive scope is the **complete classification and comparison of the specified deterministic two-state controllers**, with a precisely defined termination rule and independent exact-system validation. A targeted search has not located a paper doing that exact combination. That observation is provisional.

## Closest prior model and validation references

### Lebovka, Karmazina, Tarasevich and Laptev (2011)

*Random sequential adsorption of partially oriented linear k-mers on a square lattice*, Physical Review E **84**, 061603. [Publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.84.061603), [arXiv full text](https://arxiv.org/html/1109.3271), DOI **10.1103/PhysRevE.84.061603**. Sections II–III and Table I inspected.

Ordinary RSA redraws orientation after a rejected trial. RRSA retains that orientation and samples new positions until success, then draws another orientation. This is outcome-dependent temporal control, expressible as a stochastic two-state controller. Their explicit stopping rule is exhaustion in **one** direction; ours checks both directions and controller reachability. Consequently, their anisotropic endpoints cannot be treated as identical-model ground truth. For k ≤ 4, isotropic deposits are denser than fully aligned deposits; larger k can reverse this trend.

Table I's aligned one-dimensional values are k = 2: **0.864665717**, k = 3: **0.823652963**, k = 4: **0.803893480**. The isotropic values are roughly 0.9068, 0.8466 and 0.8104. Their unusual printed notation, e.g. `0.906(8)`, is retained as approximate guidance, not interpreted here as a conventional high-precision uncertainty estimate. An associated publisher correction exists; see below.

### Lebovka et al. (2012), publisher correction

*Publisher's Note: Random sequential adsorption of partially oriented linear k-mers on a square lattice [Phys. Rev. E 84, 061603 (2011)]*, Physical Review E **85**, 029902. DOI **10.1103/PhysRevE.85.029902**. Its existence, title and identifiers were verified on the original APS article and Crossref. The correction's full text could not be retrieved. **No claim is made about its content or whether it changes numerical results.** [Publisher correction](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.85.029902).

### Gan and Wang (1998)

*Extended series expansions for random sequential adsorption*, The Journal of Chemical Physics **108**, 3010–3012. DOI **10.1063/1.475687**; [arXiv full text](https://arxiv.org/pdf/cond-mat/9710340). The preprint is from 1997; the journal article is from **1998**. Section IV, PDF page 3, inspected.

This is a strong external check for the 50/50 random-orientation square-lattice dimer baseline: the high-order series estimate is **θ∞ = 0.906823(2)**. It also compares a previously published Monte Carlo estimate of 0.906820(2). This is a numerical/series benchmark, not an exact closed-form two-dimensional solution. A finite-L simulation should be compared with its own sampling interval and finite-size behavior, rather than required to reproduce all six digits.

### Bonnier, Hontebeyrie, Leroyer, Meyers and Pommiers (1994)

*Adsorption of line segments on a square lattice*, Physical Review E **49**, 305–312. DOI **10.1103/PhysRevE.49.305**; [publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.49.305), [arXiv full text](https://arxiv.org/pdf/cond-mat/9307043). Model description and Table I, PDF page 16, inspected.

The paper compares Monte Carlo coverage estimates with seventh-order time-series calculations. Table I provides useful isotropic reference values: k = 2, **0.9068(1)**, and k = 4, **0.8106(1)** at the largest tabulated sizes for those lengths. It studies ordinary RSA and finite-size fluctuations, not a finite-state outcome controller. Its large-k study cautions against treating a single small lattice as a thermodynamic result.

## Broader related work and differences

### Evans (1993)

*Random and cooperative sequential adsorption*, Reviews of Modern Physics **65**, 1281–1329. DOI **10.1103/RevModPhys.65.1281**; [publisher abstract](https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.65.1281). Publisher abstract and bibliographic metadata inspected; subscription full text was unavailable.

This review establishes RSA/CSA as irreversible, nonequilibrium processes and covers kinetics, spatial correlations and percolation. Cooperative adsorption and clustering are existing themes; a change in deposition statistics or domains alone is not a priority claim. The review is background, not evidence for a specific uninspected theorem or controller classification.

### Thompson and Glandt (1992)

*Low-coverage kinetics of correlated sequential adsorption*, Physical Review A **46**, 4639–4644. DOI **10.1103/PhysRevA.46.4639**; [publisher abstract](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.46.4639). Abstract and bibliographic metadata inspected.

The study analyzes a correlated irreversible adsorption model related to slowly moving spheres, including density expansions and jamming coverage. Correlated adsorption therefore predates this project. Its mechanism is different from choosing H/V solely from a small success/failure automaton; this conclusion concerns the described model, not every correlated-adsorption paper.

### Pastor-Satorras and Rubí (2001)

*Model of correlated sequential adsorption of colloidal particles*, Physical Review E **64**, 016103. DOI **10.1103/PhysRevE.64.016103**; [publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.64.016103), [arXiv full text](https://arxiv.org/pdf/cond-mat/0105018). Model description inspected.

Candidate positions are correlated with already adsorbed particles: a position is sampled as an occupied particle's location plus a random displacement. The correlation strength controls chaining, jamming and connectivity. This uses spatial information and modifies the position distribution, both excluded from our base controller model. It is a close keyword hit but not the same information constraint.

### Douglas, Schneider, Frantz, Lipman and Granick (1997)

*The origin and characterization of conformational heterogeneity in adsorbed polymer layers*, Journal of Physics: Condensed Matter **9**, 7699–7718. DOI **10.1088/0953-8984/9/37/005**; [author-group full text](https://groups.mrl.illinois.edu/granick/Publications/PDF%20files/1997/Granick%20group%20-%2092%20-%20conformational%20heterogeneity.pdf). The ARSA model passage and article metadata inspected.

Adaptive RSA changes a particle's shape/cross-sectional size to fit available uncovered substrate. Thus “adaptive RSA” already has a specific spatially responsive usage. Our particles keep a fixed shape and receive no geometry. The difference must be stated explicitly rather than renaming our model “adaptive RSA” and implying that adaptability is new.

### Ziff (1994)

*Traces of the arrival history in the jammed state of random sequential adsorption*, Journal of Physics A: Mathematical and General **27**, L657–L662. DOI **10.1088/0305-4470/27/18/003**; [DOI record](https://doi.org/10.1088/0305-4470/27/18/003). Crossref metadata and the original paper's author-uploaded full-text reproduction were inspected; the IOP page was blocked.

This paper treats the arrival-time imprint in final one-dimensional dimer gaps. RSA can retain a structural memory of deposition history without a controller having internal memory. Finding history-dependent final correlations in our simulations is therefore insufficient evidence of a new memory-control effect. The comparison must isolate the action protocol.

### Purvis, Reeve, Wattis and Mao (2015)

*Scaling behavior near jamming in random sequential adsorption*, Physical Review E **91**, 022118. DOI **10.1103/PhysRevE.91.022118**; [publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.91.022118), [institutional full text](https://nottingham-repository.worktribe.com/OutputFile/744921). Abstract, model definitions and discussion inspected.

Availability—the number of legal landing locations—is an existing observable used to connect coverage and kinetics, with separate availabilities for competing species. Tracking legal H and V placements is consequently an instrumentation choice, not a new information observable. In our experiments the simulator may track it, but the controller must not receive it. The paper's scaling results should not be imported unchanged into our feedback-dependent process.

### Slutskii, Barash and Tarasevich (2018)

*Percolation and jamming of random sequential adsorption samples of large linear k-mers on a square lattice*, Physical Review E **98**, 062130. DOI **10.1103/PhysRevE.98.062130**; [publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.98.062130), [arXiv full text](https://arxiv.org/pdf/1810.06800). Abstract and algorithm sections inspected.

It studies isotropic, periodic-lattice k-mer deposition at very large k using parallel simulation. This supports the relevance of true saturation and large-system validation; it does not supply a finite-memory control result. Its percolation-at-jamming claims concern genuine jammed configurations. They cannot be applied automatically to our controller-deadlocked endpoints that retain legal placements.

### Koza and Kondrat (2025)

*Percolation and jamming in random sequential adsorption of straight k-mers on square, triangular, and cubic lattices*, Physical Review E **111**, 034112. DOI **10.1103/PhysRevE.111.034112**; [publisher abstract](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.111.034112). Abstract and registration metadata inspected.

The abstract states percolation properties of saturated nonoverlapping lattice k-mer states and discusses generalizations. This is recent related geometric work. Full proofs were not inspected, and no proof detail is invoked here. A policy terminal state is not automatically one of the theorem's jammed states.

## Model consequences and critical controls — our reasoning

The following are **project analysis**, not attributed literature results.

1. **Use terminal coverage as the umbrella endpoint.** Geometric jamming with allowed set {H,V} requires A_H = A_V = 0. An always-H endpoint with A_H = 0 < A_V is a controller-induced deadlock under this allowed set; it is ordinary jamming in the different, H-only particle ensemble. Report this convention prominently.
2. **RRSA is a genuine nearby outcome policy.** Let q be the retained orientation. After failure, q is unchanged; after success, q is redrawn with the prescribed H probability. It is a stochastic two-state policy with no need to inspect positions. Deterministic switch-on-success is related but is not identical to redrawing.
3. **Forced alternation is an essential null.** The deterministic update f(q,S) = f(q,F) = 1 − q uses a one-bit clock but ignores the feedback. Compare outcome-responsive controllers against it as well as IID 50/50 orientations. “One bit outperforms IID” does not alone prove feedback is responsible.
4. **Success switching has a built-in balance constraint.** When q switches only after success and g assigns opposite orientations, successful H/V depositions alternate. Hence |N_H − N_V| ≤ 1. This apparent isotropy can coexist with deadlock after one direction runs out. It must not be confused with a dense, geometrically jammed isotropic packing.
5. **Mean signed order is insufficient.** An ensemble mixing H-dominated and V-dominated runs can have E[S] = 0 while E[|S|] is large. Record |S| and S² per run. A post-selected subset of low-|S| runs is not an isotropy-preserving policy.
6. **Event skipping must preserve failed transitions.** Sampling only successful legal placements while ignoring f(q,F) changes the model. Legal-placement lists belong to the simulator, not the controller. Exact terminal-state laws can be accelerated by a mathematically derived failure-orbit sampler; attempt-time observables additionally require the skipped-attempt distribution.
7. **Check transient states as well as recurrent failure cycles.** With fixed occupancy, successive failures follow q → f(q,F). A later all-blocked cycle does not justify skipping a prefix state that still has a positive probability of success. Deadlock detection must be exact for the current state or correctly sample survival through that prefix.
8. **Mark initial conditions in equivalence claims.** State relabeling must relabel q₀ too. Holding q₀ = 0 while renaming the states can change a controller's law. H/V exchange is a distributional square-lattice symmetry; it is not necessarily an identical seeded trajectory.
9. **Information measures are secondary.** Aggregate mutual information can mix different coverage stages. A deterministic update also induces feedback/action dependence by construction. Neither fact proves causal packing improvement or efficient use of physical information.

## Suggested validation targets

| Protocol and model | Target | Evidential use |
| --- | ---: | --- |
| k = 1, H/V allowed | θ_terminal = 1 | Exact model sanity check, not a literature fit |
| Always H or always V, k = 2, L → ∞ | 1 − exp(−2) = 0.8646647168… | Exact one-dimensional aligned check; note the last digits below |
| Always H or always V, k = 3, L → ∞ | ≈ 0.823652963 | Numerical evaluation of the published exact integral |
| Always H or always V, k = 4, L → ∞ | ≈ 0.803893480 | Numerical evaluation of the published exact integral |
| IID H/V = 1/2, k = 2, L → ∞ | 0.906823(2) | Gan–Wang series estimate; compare statistical and finite-L errors |
| IID H/V = 1/2, k = 4 | ≈ 0.8106 | Bonnier Monte Carlo reference; no precision beyond source support |

**Important numerical discrepancy:** Lebovka Table I prints the aligned dimer value as `0.864665717`, but the closed-form expression 1 − exp(−2) evaluates to **0.864664716763…**. Use the mathematical expression as the validation target. This review identifies the discrepancy without claiming to know its origin or the unread publisher correction's content.

The aligned k-mer integral printed as Eq. (1) in Lebovka is

\[
\theta_{\mathrm{aligned}}(k)
=k\int_0^\infty \exp\!\left[-u-2\sum_{j=1}^{k-1}\frac{1-e^{-ju}}j\right]du.
\]

An independent numerical check used x = exp(−u) to transform the integral to the finite interval [0,1], then composite Simpson integration with 65,536 and 131,072 panels. The two resolutions agree within 7 × 10⁻¹⁵ for k = 1, 2, 3, 4 and 8. Results: k = 3, **0.82365296317734**; k = 4, **0.80389347991537**; k = 8, **0.77518483321087**. This checks the decimals and does not provide a rigorous quadrature-error bound. Infinite-line values are not exact expectations for small periodic rings.

## Search scope and reproducibility

Queries were run through the available web search engine, with publisher/arXiv full-text follow-up and DOI metadata queries. Search families included memory, finite-state, finite-memory, feedback, success/failure, history-dependent, adaptive, internal-state, temporal correlations, correlated adsorption, partially oriented k-mers, and finite-memory stochastic packing. The literal queries and inspected sources are recorded in `search-log.json`.

Some searches returned generated summaries, Wikipedia or generic packing/control papers. These were discovery aids or excluded hits; scientific claims above rely on original papers, official abstracts, institutional author copies or DOI metadata. No third-party code, paper figures or downloaded PDFs are redistributed in this directory.

Limits: no exhaustive citation-network crawl, Web of Science/Scopus database search, non-English search or author consultation has been completed. Some publisher full texts are unavailable, and the 2012 correction remains unread. Before claiming publication novelty, inspect that correction and the references/citations of the RRSA paper more widely.

## Safe wording for a report

“We examine all 64 deterministic two-state success/failure-driven orientation controllers under a fixed, spatially blind candidate-selection rule. Outcome-dependent orientation retention already appears in RRSA. Our comparison separates geometric jamming from controller deadlock and includes exact small-system and feedback-independent temporal baselines. We do not claim that temporal dependence in adsorption, or feedback in packing generally, is new.”
