# Review before main sampling

An independent agent read the enumeration, simulation episode law and root search
pipeline. Before any main experiment observations, the review identified and corrected:

1. Seal the actual read-only IID dependency (`stage2/src/stochastic.mjs`), require all
   expected sources, and seal both controller catalogues rather than silently skip a
   misspelled dependency path.
2. Record the entire coarse mean Pareto set, while explicitly advancing it subject
   to a computational cap. The cap is 180 feedback controllers in total per k,
   including the protected one-bit classes, plus all 16 temporal comparators and IID.
3. A minimal three-state candidate still consumes a two-bit budget. A two-bit frontier
   claim must compare with all 16 live temporal behaviors with at most four states,
   not only the five temporal behaviors with at most three states. One-bit results
   have a separate at-most-two-state comparison.

These are pre-observation changes, not significance-driven amendments. The locked
confirmation family will include all 16 temporal comparators for every selected
candidate, with memory-specific subsets only used for explicit subsidiary claims.
