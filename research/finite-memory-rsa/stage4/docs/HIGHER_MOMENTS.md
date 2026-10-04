# Higher moments from positive forests and layered paths

Let F_ε be a finite nonnegative substochastic rational matrix for all sufficiently
small positive ε. Let ρ_ε be a nonnegative initial subprobability row (missing
mass means immediate T=0). Prune states unreachable from its nonzero support.
Assume every remaining state can reach the absorbing sink. Rational entries,
off-diagonal edges and sink leaks have positive leading germs c ε^v, v≥0;
identically zero terms are removed. Only this local ε→0 regime is claimed.

Write G=(I−F)⁻¹. Add sink edges of weight 1−Σ_jF_ij and off-diagonal edges F_ij.
Let D be the sum of products of weights of all directed spanning trees rooted
at the sink. Let W_ij be the sum for directed two-root forests rooted at sink
and j, with i in j's component. The classical all-minors forest identity gives
G_ij=W_ij/D. Stage III established the corresponding mean valuation; it is
not presented again as a new theorem.

The new step here computes **all fixed higher-moment leading coefficients**
using these positive Green germs and layered graph products, without determinant
algebra for each moment. The classical discrete phase-type identity is

\[
E[(T)_\ell]=\ell!\,\rho G(FG)^{\ell-1}\mathbf1,
\qquad E[T^j]=\sum_{\ell=1}^j {j\brace\ell}E[(T)_\ell].
\]

It follows from the probability-generating function or summing the survival
tail; the powers agree with G^ℓ F^(ℓ−1) since G and F commute. It is credited
to standard phase-type theory, not claimed as an original formula.

**Positive-germ theorem.** For each fixed j, the leading exponent and constant
of E[T^j] are obtained by:

1. Minimize summed edge valuations over eligible trees/forests, adding products
   of coefficients across ties, to obtain leading D and W_ij.
2. Divide these positive leading terms to obtain every nonzero Green entry.
3. Multiply the resulting germs along the layered G/F paths in each factorial
   moment. Minimize exponent and sum coefficients across all tied paths.
4. Form the positive Stirling sum; take its smallest exponent, adding all tied
   factorial contributions with their Stirling weights.

**Proof.** A finite sum of positive leading germs has minimum power and the sum
of coefficients at that power; a product adds powers and multiplies coefficients.
The forest expressions have no cancellation. Division by D preserves the
leading ratio since its coefficient is positive. Each fixed-order matrix
product has finitely many nonnegative paths. Stirling numbers are nonnegative,
so the final raw-moment sum also has no cancellation. These operations therefore
retain both exponent and coefficient, including all critical ties. □

This is an algorithmic graph interpretation of the higher moments, conditional
on classical identities. It is not a claim of priority for all-minors theory or
phase-type moments. Diagonal holding probabilities enter the F layers; they
must not be discarded merely because forest edges exclude self-loops.

Six new models, moments j=1,…,6, give 36 leading terms. Five polynomial models
agree with an independent rational-resolvent calculation; the rational hazard
model agrees with the scalar geometric formula. The graph path uses **zero
determinant calls**. For rare entry ε³ and dwell hazard ε², raw-moment pole orders
are [0,1,3,5,7,9]: the mean is finite while every higher moment diverges. At
entry ε⁴/dwell ε², the second moment has limiting constant 3, consisting of
baseline 1 plus rare-tail 2. This critical addition is lost by a rule keeping
only the dwell exponent. Unreachable closed states are pruned, whereas reachable
nonabsorbing support is rejected. For hazard ε²/(1+ε), r_j=2j and C_j=j!.

The helper permits up to six algebraic transient states, but the new study uses
only one-, two- and three-state rare-event kernels; no RSA controller exceeds
four states. Enumeration is exponential and is not a scalable forest optimizer.
Only leading terms are calculated, not full rational moment functions or a
uniform error bound at finite ε. See `results/higher-moments.json` for every
kernel, forest certificate, path contribution and independent comparison.
