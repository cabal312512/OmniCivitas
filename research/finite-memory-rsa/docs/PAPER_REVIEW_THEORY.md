# Internal theory review of the manuscript

Review date: 4 October 2026, Asia/Shanghai.

Reviewed file: `paper/manuscript.template.md`, SHA-256
`5bd914268083d9aab2449923bbfa6a38d7f17d55affc145d71056fd693c5aa83`.
This is an internal AI-assisted review, not external peer review.

## Scope and overall finding

Read the entire template for model definitions, controller equivalence,
failure-cycle mathematics, exact absorption, isolated-rod counting,
orientation order, information boundaries and the strength of conclusions.
Cross-checked controller definitions against the implemented encoding and
previously validated theory, and checked the RRSA initial-state convention
against `src/rrsa.mjs`. This pass ran no simulations and did not independently
recalculate empirical confidence intervals or re-audit the literature.

No substantive theory contradiction was found. The manuscript distinguishes
terminal coverage from geometric jamming, distinguishes `E|S|` from `|ES|`,
correctly identifies 35 as open-loop rather than feedback improvement, and
correctly states that 38's accepted rods alternate despite frequent policy
deadlock. The local first-rod calculation is explicitly prevented from becoming
a thermodynamic symmetry-breaking claim. The qualified negative conclusion
is appropriately not a universal memory impossibility theorem. The following
precision corrections should be made before final rendering.

## Required precision corrections

1. **Section 4.3, zero-success cycle.** Current sentence:

   > “We sample the number of complete failed cycles geometrically; conditional on cycle success, the first successful state has mass product_(j<i)(1-a_j)*a_i/(1-B).”

   Replace with:

   > “When B<1, we sample the number of complete failed cycles geometrically; conditional on cycle success, the first successful state has mass product_(j<i)(1-a_j)*a_i/(1-B). When B=1, the cycle permits no success and is absorbing after any transient prefix; the residual legal counts distinguish geometric jamming from policy deadlock.”

   The existing conditional expression has an undefined denominator at the
   policy deadlocks central to the paper. The implementation already treats
   that branch correctly; this is a mathematical exposition correction.

2. **Section 3, initialization scope.** Current fragment:

   > “q_0=0.”

   Replace with:

   > “The deterministic two-state enumeration uses q_0=0. Memoryless controls have no directional state; the RRSA reference draws its initial held direction with the stated H probability.”

   `simulateRRSA` draws the initial direction, whereas the deterministic
   catalogue fixes the root. Both are legitimate model choices, but the
   blanket initialization statement should not conceal their difference.

3. **Section 4.1, reachable-state proof.** Current fragment:

   > “a reachable second state requires at least one initial-state edge to leave it”

   Replace with:

   > “state 1 is reachable precisely when at least one transition from initial state 0 enters state 1”

   The current pronoun can incorrectly refer to the second state. The correct
   counting remains twelve transition tables for each mixed output function.

4. **Section 4.4, extra anisotropy term.** Current sentence:

   > “The additional first-rod anisotropy effect is(a-b)(1-a)/[(2-a)(a+b-ab)], order M to the power-2 at fixed k.”

   Replace with:

   > “Relative to the equal-availability counterfactual that holds a fixed and sets b=a, the additional same-orientation probability is (a-b)(1-a)/[(2-a)(a+b-ab)], of order M^-2 at fixed k.”

   This identifies the actual subtraction used in the derivation. It avoids
   interpreting the expression as a general causal or macroscopic anisotropy
   contribution. Keep the following explicit limitation sentence.

## Recommended scope clarifications

* In the abstract, replace “No tested feedback class demonstrates …” with
  “Within the prespecified comparisons, none of the three failure-fair
  feedback representatives demonstrates …”. The present limitations section
  already explains this distinction, but the abstract should make its
  confirmatory scope equally explicit.
* In Section 4.4, replace “across2x2 and3x3 systems, two boundaries and
  eligible k values” with “for (L,k)=(2,2),(3,2),(3,3), each under periodic and
  open boundaries”. This makes the exact count `64×3×2=384` inspectable and
  distinguishes additional monomer sanity checks.

These clarifications do not require new simulations, altered hypotheses,
changed data, or revised physical conclusions. They tighten presentation
around the already implemented and validated model.
