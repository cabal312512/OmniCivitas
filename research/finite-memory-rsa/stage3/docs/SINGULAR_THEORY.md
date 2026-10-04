# Singular exploration costs in finite-state failure kernels

Status: proved fixed-kernel results, exact algebraic examples, and completed measurement diagnostics. This document concerns waiting for the next accepted particle on a **fixed geometry**. It does not establish a packing advantage, a thermodynamic phase transition, or the minimum memory required for a packing improvement. Stage I/II sources, data, and conclusions remain frozen.

## 1. The correct object and the scope of exploration

Let $q\in Q$ be an internal controller state. On the current lattice, let $a_o\in[0,1]$ be the success probability of action/orientation $o$ under the specified anchor sampler. If the action distribution is $\pi_\varepsilon(o\mid q)$ and the update conditional on a failed action is $K^F_\varepsilon(q'\mid q,o)$, the substochastic failure kernel is

\[
F_\varepsilon(q,q')=
\sum_o\pi_\varepsilon(o\mid q)(1-a_o)
K^F_\varepsilon(q'\mid q,o).
\tag{1}
\]

The row leak $\ell_q=1-\sum_{q'}F_\varepsilon(q,q')$ is the probability that the next attempt succeeds. A stochastic action must be weighted by its failure probability before its conditional update is included. Averaging controller transitions first and then multiplying by an averaged failure probability generally gives the wrong kernel. The post-success transition is relevant to the **next** occupancy episode, but not to the waiting time within this episode.

Write $T_\varepsilon$ for the number of attempts up to and including the next success. Initially transient mass is a row vector $\rho_\varepsilon$; any missing mass is already absorbed with $T=0$. Then

\[
\Pr(T_\varepsilon>n)=\rho_\varepsilon F_\varepsilon^n\mathbf1,
\qquad n=0,1,\ldots.
\tag{2}
\]

Almost-sure absorption from a given initial distribution requires that every reachable bottom strongly connected component have a nonzero success leak. A path to success from each initial state is insufficient when another accessible closed failure class exists. This is the same finite-chain distinction used in Stage II, now applied to general finite kernels.

**Different exploration mechanisms have different possible exponents.** For example, if a repair assigns some legal action probability at least $c\varepsilon$ in **every** state, and that action has availability $a>0$ on this fixed geometry, then the success hazard is at least $ca\varepsilon$ at every attempt. Consequently

\[
\Pr(T_\varepsilon>n)\le(1-ca\varepsilon)^n,
\quad E T_\varepsilon\le (ca\varepsilon)^{-1},
\quad E T_\varepsilon^j=O(\varepsilon^{-j}).
\tag{3}
\]

Thus such a uniform action-exploration repair cannot produce a mean pole greater than one at fixed positive availability. Higher exponents below arise when exploration changes internal transitions and the controller must traverse several states before it outputs a legal action, or from other specified nonuniform kernels. They must not be attributed to an unspecified generic repair.

## 2. Exact singularity theorem

Assume a finite kernel has entries polynomial in $\varepsilon$, with rational coefficients; rational entries analytic at zero can likewise be treated after clearing nonvanishing denominators. Assume it and its initial distribution are nonnegative and substochastic for sufficiently small $0<\varepsilon<\delta$. Remove states that are identically unreachable from $\rho_\varepsilon$ throughout this punctured interval. Assume all remaining states are almost surely absorbed for every sufficiently small positive $\varepsilon$. At $\varepsilon=0$, closed failure classes are allowed.

Put $A=I-F_\varepsilon$, $D(\varepsilon)=\det A$, and let $v(p)$ be the order of the first nonzero coefficient of a polynomial $p$. For a deterministic initial state $i$, let $C_i$ be the determinant obtained by replacing column $i$ of $A$ with $\mathbf1$. Then

\[
E_iT_\varepsilon=\frac{C_i(\varepsilon)}{D(\varepsilon)}
\sim C\varepsilon^{-r},\qquad
r=v(D)-v(C_i),\qquad
C=\frac{[\varepsilon^{v(C_i)}]C_i}
{[\varepsilon^{v(D)}]D}>0.
\tag{4}
\]

For a polynomial initial distribution, replace $C_i$ with $C_\rho=\sum_i\rho_i C_i$. If all mass starts transient, the mean is at least one and $r\ge0$. A positive exponent of $\varepsilon$, rather than a pole, is possible when the initially transient mass itself vanishes. An identically zero moment is handled separately.

**Proof.** Finite-chain first-step conditioning gives $Am_1=\mathbf1$. Almost-sure absorption of the retained finite states implies $A$ is invertible for positive $\varepsilon$, hence $D$ is not the zero polynomial. Cramer's rule gives the exact quotient. Factoring the lowest nonzero power from numerator and denominator proves (4). Nonnegativity and the positive mean give the sign of the leading ratio. There is no fitting of a power law in this argument.

For higher raw moments $m_j(i)=E_iT^j$, first-step conditioning yields the exact recurrence

\[
(I-F)m_j=\mathbf1+
F\sum_{h=1}^{j-1}{j\choose h}m_h,
\qquad j\ge1.
\tag{5}
\]

Indeed $T=1$ on immediate success and $T=1+T'$ on failure. Expanding $(1+T')^j$ proves (5). Each component, and each initial mixture, is a rational function. Its exact lowest numerator and denominator powers determine its exponent and constant. **The $j$-th moment exponent need not equal $j$ times the mean exponent.** Rare entry, derived below, is an explicit counterexample. A finite observed Monte Carlo mean cannot replace this calculation.

These are applications of classical absorbing-chain algebra, not a newly discovered general Markov-chain theorem. The new work here is the explicit controller/failure-kernel formulation, the executable exact certificates, the mechanism comparisons, and their use in interpreting outcome-limited irreversible adsorption.

## 3. A positive graph certificate for the exponent and constant

Add an absorbing sink $\partial$. For $i\ne j$, give the directed edge $i\to j$ weight $F_{ij}$, and give $i\to\partial$ weight $\ell_i$. Omit self-loops. The reduced **row** Laplacian of this augmented graph is $A=I-F$: its diagonal is $\ell_i+\sum_{j\ne i}F_{ij}=1-F_{ii}$.

Let $\mathcal T$ contain the directed spanning trees oriented toward $\partial$: each transient vertex has one outgoing edge, there are no directed cycles, and every path ends at the sink. Let $\mathcal H_{ij}$ contain directed spanning forests rooted at $\partial$ and $j$, with $i$ in the component rooted at $j$. Classical directed matrix-tree/all-minors identities give

\[
D=\sum_{t\in\mathcal T}\prod_{e\in t}w_e,
\qquad
\operatorname{adj}(A)_{ij}
=\sum_{h\in\mathcal H_{ij}}\prod_{e\in h}w_e,
\qquad
C_i=\sum_j\sum_{h\in\mathcal H_{ij}}\prod_{e\in h}w_e.
\tag{6}
\]

The row convention matters: these are forests following outgoing edges **to** their root, and the mean numerator is the sum over the possible second root $j$. See the original [all-minors matrix-tree theorem, Chaiken (1982)](https://epubs.siam.org/doi/10.1137/0603033) and the author preprint of [Chebotarev and Agaev, *Forest matrices around the Laplacian matrix*](https://arxiv.org/abs/math/0508178), especially the rooted-forest/cofactor formulation. Our code also checks (6) independently by explicit forest enumeration and Cramer's determinants; it does not infer the identity from matching floating-point results.

Each nonzero probability edge has a positive lowest-order coefficient near zero. Give an edge its integer cost $v(w_e)$. Define

\[
d=\min_{t\in\mathcal T}\sum_{e\in t}v(w_e),\qquad
f_i=\min_{j,h\in\mathcal H_{ij}}\sum_{e\in h}v(w_e).
\tag{7}
\]

Then the mean exponent is **a difference of minimum tree and eligible forest costs**,

\[
r_i=d-f_i.
\tag{8}
\]

Its leading constant is the sum of products of leading edge coefficients over all minimum-cost eligible forests, divided by the corresponding sum over minimum-cost sink trees. There is no cancellation among terms of the minimal order. For a fixed initial mixture, include the initially weighted forest sums; for an epsilon-dependent mixture, its entry-weight orders must also be included.

**Proof.** Apply (6). The valuation of each product is the sum of its edge valuations. All minimal-order terms have positive leading coefficients, so the valuation of each sum is its minimum cost, and its leading coefficient is the sum of those positive products. Substitute in (4).

This result depends on the support graph **and edge orders/leading coefficients**. Unweighted graph topology alone does not give the exponent or constant. Nor does the minimum number of exploratory transitions on one success path generally give the mean exponent. Trees encode all competing recurrent regions and forests encode the starting-state residence contribution.

If every nonzero edge and leak is linear in epsilon, each valuation is zero or one. A sink tree has $n$ edges, so $d\le n$, hence $0\le r_i\le n$. This is a coarse kinetic bound under the stated linear-kernel assumption, not a bound on packing improvement or on all nonlinear repairs.

## 4. Shortest-path counterexample and consecutive-reset mechanisms

Fix a legal-state success probability $b\in(0,1]$. There are $r$ blocked states $0,\ldots,r-1$ and a legal state $r$. Start in state zero.

In the **persistent** mechanism, each blocked state holds with probability $1-\varepsilon$ and advances one state with probability $\varepsilon$. In the legal state, success has probability $b$, and failure leaves the state unchanged. The exact waiting time is a sum of $r$ independent $\operatorname{Geom}(\varepsilon)$ variables and one $\operatorname{Geom}(b)$, all on $\{1,2,\ldots\}$:

\[
E T_\varepsilon=\frac r\varepsilon+\frac1b.
\tag{9}
\]

For $r=2$, any path to success uses two exploratory advances, but the mean exponent is **one**, not two. The tree cost is two and the eligible mean-forest cost is one. Progress persists between advances. This directly disproves the general rule “the mean pole equals the minimum number of exploratory transitions on a path to success.” Merely leaving the initial closed class is also insufficient to characterize the full residence cost when another closed class can be entered.

In the **reset** mechanism, a blocked state advances with probability $\varepsilon$, but any nonexploratory attempt sends it back to state zero. Success requires $r$ consecutive advances. First-step conditioning, or the recurrence for a run of $r$ successes in independent Bernoulli trials, gives

\[
E T_\varepsilon=
\varepsilon^{-r}+\varepsilon^{-(r-1)}+\cdots+
\varepsilon^{-1}+\frac1b.
\tag{10}
\]

The initial blocked class is the only zero-epsilon recurrent blocked class; the other progress states return to it unless exploration continues. Here the mean exponent really is $r$, with leading constant one. The legal state contributes only finite waiting. Reset and persistent mechanisms have the **same minimum success-path cost** $r$ and different mean exponents. For $r=3$, the reset example has exactly four states, so a two-bit controller can exhibit an $\varepsilon^{-3}$ kinetic cost under this specified transition-exploration mechanism. This is not a statement that two bits first improve RSA density.

These examples are realizable as fixed-geometry H/V failure controllers: the blocked states output a direction with zero availability; the last state outputs a direction with availability $b$. Epsilon randomizes their failed-attempt state transitions. They are not the uniform action-exploration repair in (3). Their reset structure, rather than the shortest path by itself, is the qualification under which counting consecutive advances gives the exponent.

The exact distributional limits also differ:

\[
\varepsilon T_\varepsilon
\Rightarrow\operatorname{Gamma}(r,1)
\quad\text{(persistent)},\qquad
\varepsilon^r T_\varepsilon
\Rightarrow\operatorname{Exp}(1)
\quad\text{(reset)}.
\tag{11}
\]

For persistence, multiply the probability-generating functions of the independent geometric waits. For reset, split the blocked trajectory into cycles ending at the first nonexploratory attempt or after $r$ consecutive advances. A cycle succeeds with probability $\varepsilon^r$. Its failed-cycle generating function $A_\varepsilon(z)$ satisfies $A_\varepsilon(1)=1-\varepsilon^r$ and $A'_\varepsilon(1)\to1$. Its successful-cycle generating function is $B_\varepsilon(z)=\varepsilon^r z^r$. At $z=\exp(-t\varepsilon^r)$,

\[
\frac{B_\varepsilon(z)}{1-A_\varepsilon(z)}
\longrightarrow\frac1{1+t},\qquad t\ge0.
\]

The independent final legal wait has a transform tending to one on this scale. This proves the exponential limit. Each cycle has length at most $r$; the number of cycles is geometric with parameter $\varepsilon^r$. This domination bounds every fixed higher moment of the scaled wait, including a moment of order greater than any target order, and gives uniform integrability of each fixed scaled power. Therefore reset raw moments satisfy $E T_\varepsilon^j\sim j!\varepsilon^{-jr}$. The persistent leading constants are the gamma moments $r(r+1)\cdots(r+j-1)$.

With $b=1/2$, the independent exact solver and forest enumerator produce:

| Model | States | Minimum success-path cost | Tree cost | Mean-forest cost from 0 | Mean leading term | Leading constants for moments 1–4 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| persistent two-step | 3 | 2 | 2 | 1 | $2\varepsilon^{-1}$ | $2,6,24,120$, orders $1,2,3,4$ |
| reset one-step | 2 | 1 | 1 | 0 | $\varepsilon^{-1}$ | $1,2,6,24$, orders $1,2,3,4$ |
| reset two-step | 3 | 2 | 2 | 0 | $\varepsilon^{-2}$ | $1,2,6,24$, orders $2,4,6,8$ |
| reset three-step | 4 | 3 | 3 | 0 | $\varepsilon^{-3}$ | $1,2,6,24$, orders $3,6,9,12$ |

## 5. Weak convergence, continuity, and uniform integrability

Suppose $F_\varepsilon\to F_0$ and $\rho_\varepsilon\to\rho_0$. Equation (2) implies convergence of every finite-time survival probability. If absorption occurs almost surely at epsilon zero **from the limiting initial distribution**, these probabilities describe a proper finite-valued law $T_0$, and $T_\varepsilon\Rightarrow T_0$. If the zero-epsilon chain has positive nonabsorbing mass from that initial distribution, the limit is defective on finite times; mass escapes to infinity. It must not be called ordinary weak convergence to a proper waiting-time distribution.

If **every state in the perturbatively reachable graph** is absorbed almost surely at epsilon zero, $I-F_0$ is invertible. The inverse and recurrence (5) are continuous near zero; every fixed-order waiting-time moment is continuous. Closed classes that are unreachable only at epsilon zero invalidate this stronger premise: rare entry to such a class can preserve weak convergence while destroying moment continuity.

For a proper limit with $E T_0^j<\infty$, along any sequence $\varepsilon_n\downarrow0$, uniform integrability of $T_{\varepsilon_n}^j$ is equivalent to

\[
E T_{\varepsilon_n}^j\longrightarrow E T_0^j.
\tag{12}
\]

To see necessity, truncate the nonnegative variable at a fixed level, apply weak convergence to the bounded continuous truncation, and then use uniform integrability to let the level grow. Conversely, moment convergence and convergence of truncated expectations make the expected excess above the truncation small; $X\mathbf1_{X>2R}\le2(X-R)_+$ turns this into the uniform-integrability tail bound. This is a standard probability criterion, included to make the inference explicit. Bounded means alone are insufficient.

Bounded finite-horizon path observables are continuous in the kernel entries and initial distribution: their expectations are finite sums of finite products. Bounded continuous functions of a **proper weak waiting-time limit** also have convergent expectations; unbounded kinetic observables require their own moment condition. In contrast, an arbitrary bounded terminal RSA payoff need not agree with an epsilon-zero implementation that labels a closed failure trap as a terminal configuration. That changes the stopping rule; boundedness alone does not justify continuity. A pole calculation by itself does not prove a unique scaled limiting distribution. Equation (11) is separately proved for its two example mechanisms, not inferred from mean asymptotics. None of these fixed-geometry statements implies a continuous terminal RSA coverage at a deadlocking zero-exploration policy.

## 6. Rare entry followed by a long dwell: exact moment thresholds

Let

\[
w=c\varepsilon^s,\qquad p=\varepsilon^r,
\qquad c\in(0,1],\quad s,r\in\mathbb N,
\]

and consider

\[
F_\varepsilon=
\begin{pmatrix}0&w\\0&1-p\end{pmatrix},
\qquad\rho=(1,0).
\tag{13}
\]

Equivalently, $T=1+BG$, where $B\sim\operatorname{Bernoulli}(w)$ and $G\sim\operatorname{Geom}(p)$ are independent. The first attempt either succeeds or enters a sticky failure state. Then

\[
E T=1+\frac wp,
\qquad
\operatorname{Var}(T)=\frac{w(2-p-w)}{p^2}.
\tag{14}
\]

For any fixed integer $j\ge1$, geometric moments satisfy $E G^j\sim j!p^{-j}$. Expanding $(1+BG)^j$ gives

\[
\begin{array}{ll}
s<jr:& E T^j\sim c j!\varepsilon^{s-jr};\\
s=jr:& E T^j\longrightarrow1+c j!;\\
s>jr:& E T^j\longrightarrow1.
\end{array}
\tag{15}
\]

Since $\Pr(B=1)=w\to0$, $T_\varepsilon\Rightarrow1$. Nevertheless $T^j$ is uniformly integrable near zero **if and only if $s>jr$**. Equality gives a finite moment jump; $s<jr$ gives divergence. In particular:

| Parameters | Weak limit | Mean limit | Variance behavior | Interpretation |
| --- | --- | --- | --- | --- |
| $s=r$ | $1$ | $1+c$ | $2c\varepsilon^{-r}$ | finite mean discontinuity, no first-moment UI |
| $r<s<2r$ | $1$ | $1$ | $2c\varepsilon^{s-2r}\to\infty$ | first-moment UI, no second-moment UI |
| $s=2r$ | $1$ | $1$ | $2c$ | second-moment discontinuity |
| $s>2r$ | $1$ | $1$ | $2c\varepsilon^{s-2r}\to0$ | first and second moments continuous |
| $s<r$ | $1$ | diverges | $2c\varepsilon^{s-2r}$ | rare excursions dominate the mean |

The balanced $s=r$ family has mean pole zero but diverging second and higher moments. It disproves both “bounded mean implies UI” and “higher-moment poles are multiples of the mean pole.” The $s=3,r=2$ family shows that variance divergence alone does not imply discontinuity of the mean. At epsilon zero the sticky state is unreachable and the unconditional wait is exactly one; evaluating a singular full inverse without removing that unreachable state would give the wrong endpoint diagnosis.

The generic nonlinear powers in (13) are legitimate finite phase-type families, not a claim that a two-state controller under a *linear uniform* exploration rule realizes every $s,r$. The linear reset examples establish the higher-power mechanism without that conflation.

## 7. Sample requirements and an implemented rare-event estimator

For $N$ independent original-law observations, the probability of seeing no rare entry is exactly

\[
\Pr(\text{no entry})=(1-w)^N.
\tag{16}
\]

Seeing at least one entry with probability 0.95 needs
$N\ge\lceil\log(0.05)/\log(1-w)\rceil\sim\log(20)/w$.
Seeing an entry is not the same as estimating its contribution accurately.

Let the rare **excess** mean be $\mu_{\rm ex}=E(T-1)=w/p$. The naive sample mean has exact squared relative RMSE

\[
\frac{\operatorname{Var}(T)}{N\mu_{\rm ex}^2}
=\frac{2-p-w}{Nw}.
\tag{17}
\]

Thus fixed relative RMS accuracy for the excess requires order $\varepsilon^{-s}$ samples. This is an exact statement about the variance of the specified sample-mean estimator; it is not a lower bound over all possible estimators. Chebyshev gives the sufficient confidence bound

\[
N\ge\frac{\operatorname{Var}(T)}{\eta\delta^2\mu^2}
\quad\Longrightarrow\quad
\Pr(|\overline T-\mu|>\delta\mu)\le\eta,
\tag{18}
\]

where $\mu$ is the targeted total or excess mean and the corresponding estimator is used. This is a conservative sufficient bound, not an optimal sample count or a normal-approximation confidence guarantee.

For the **total** mean, $\operatorname{Var}(T)/(ET)^2$ has different scaling:

\[
\begin{array}{ll}
s<r:& (2/c)\varepsilon^{-s};\\
s=r:& [2c/(1+c)^2]\varepsilon^{-r};\\
r<s<2r:& 2c\varepsilon^{-(2r-s)};\\
s=2r:& 2c;\\
s>2r:& 2c\varepsilon^{s-2r}\to0.
\end{array}
\tag{19}
\]

Relative precision of the total mean can become an easy target when the rare excess itself vanishes. An all-one sample may then meet a 10% total-mean tolerance while failing completely to measure the excess. The target must be specified.

Our implemented **conditional Monte Carlo** estimator draws $G$ from its original dwell law and integrates the known entry probability:

\[
Y=E[T\mid G]=1+wG,
\qquad
E Y=E T,
\qquad
\operatorname{Var}(Y)=\frac{w^2(1-p)}{p^2}.
\tag{20}
\]

This is ordinary conditional expectation/Rao–Blackwell variance reduction, not an importance-sampling estimator mislabeled as conditional sampling. Its exact variance-reduction factor is

\[
\frac{\operatorname{Var}(T)}{\operatorname{Var}(Y)}
=\frac{2-p-w}{w(1-p)}\sim\frac2w,
\quad
\frac{\operatorname{Var}(Y)}{\mu_{\rm ex}^2}=1-p\le1.
\tag{21}
\]

For 10% relative excess error with at least 95% probability, 2,000 ideal independent conditional draws suffice by Chebyshev, uniformly in epsilon; the naive sufficient count grows with the rare-entry inverse probability. The conditional estimator requires a **known** entry probability and a sampleable conditional dwell law. Neither property is guaranteed for a complex RSA controller on an unknown occupancy distribution. The comparison demonstrates an effective method for the specified model, not a universal solution to unknown rare-event dynamics. Classic rare-event methodology is surveyed by [Glynn and Iglehart, *Importance Sampling for Stochastic Simulations* (1989)](https://web.stanford.edu/~glynn/papers/1989/GI89a.html); our estimator is justified directly by (20), and we make no claim to have invented variance reduction.

## 8. Completed fixed-design measurement experiment

`scripts/rare-event-study.mjs` wrote its design and source hashes before sampling. There were ten models, two methods, 100 separately seeded batches per method/model, and 1,000 observations per batch: **2,000,000 retained draws and 2,000 batch replicates**. Each model uses $c=1/2$. Seeds are $70{,}000{,}001+100{,}000\,\text{caseIndex}+10{,}000\,\text{methodIndex}+\text{batchIndex}$, reserved independently of Stage I/II and other Stage III experiments. The two estimators do not share random streams. Independence statements refer to the intended seeded pseudorandom design, not a mathematical proof of independence of PRNG output.

All exact means and original-law variances were checked against the independent symbolic kernel solver before the case was sampled. Geometric waiting times were sampled by inverse transform rather than by literally simulating potentially millions of individual attempts. Every retained dwell and estimator value is in `data/rare-event/draws.csv.gz`; batch rows, design, summary, and a completed SHA-256 manifest are beside it. Source hashes were unchanged between start and completion.

The table reports **observed** relative RMSE of the 100 means of 1,000 draws against the known exact mean, not the relative RMSE of their pooled mean. Zero-entry counts are among those 100 naive batches. The final column reports how many of the 100 pointwise nominal t intervals contained the exact mean for naive/conditional sampling; these are approximate implementation diagnostics, not a multiple-testing family or a guarantee that every interval should cover.

| $s,r$ | Epsilon | Exact total mean | Naive zero-entry batches | Naive observed relative RMSE | Conditional observed relative RMSE | Nominal t coverage naive / conditional |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,1 | 0.01 | 1.5 | 2 | 0.20072 | 0.00962 | 81 / 98 |
| 1,1 | 0.0001 | 1.5 | 98 | 1.21653 | 0.00990 | 2 / 95 |
| 1,1 | 0.000001 | 1.5 | 99 | 62.69428 | 0.01076 | 1 / 91 |
| 2,2 | 0.1 | 1.5 | 1 | 0.17172 | 0.01099 | 85 / 93 |
| 2,2 | 0.01 | 1.5 | 97 | 1.92011 | 0.00992 | 3 / 98 |
| 2,2 | 0.001 | 1.5 | 100 | 0.33333 | 0.01243 | 0 / 91 |
| 3,3 | 0.1 | 1.5 | 68 | 0.45455 | 0.00984 | 25 / 96 |
| 3,3 | 0.01 | 1.5 | 100 | 0.33333 | 0.01066 | 0 / 92 |
| 3,2 | 0.01 | 1.005 | 100 | 0.00498 | 0.000150 | 0 / 99 |
| 1,2 | 0.001 | 501 | 64 | 1.17986 | 0.02883 | 30 / 96 |

The balanced $s=r=2,\varepsilon=0.001$ study saw **no entries in 100,000 original-law observations**. Every naive batch had mean one, sample variance zero, and a degenerate interval excluding the exact mean 1.5. The conditional method's pooled mean was 1.5027686633. Conversely, the $s=r=1,\varepsilon=10^{-6}$ naive study did observe one rare entry; that realization had pooled mean 10.40901 and a batch RMSE much larger than its ideal RMS expectation. This outcome is retained rather than rerun or removed. Rare-event failure can look like either a falsely stable estimate or one extreme overshoot. A 100-replicate empirical RMSE need not approach its theoretical value when the squared error itself has rare large contributions.

For $s=3,r=2,\varepsilon=0.01$, all-one naive batches happen to fall within 10% of the total mean 1.005. They still estimate the excess as zero, miss the exact mean with all their zero-width intervals, and fail to measure the large tail variance. The target distinction in (17)–(19) is operational, not just semantic.

All 1,000 conditional batch means across the ten cases were within 10% of their total exact mean in this realized study. The exact variance results, not this finite success count, support the method. Nominal conditional t coverage ranged from 91 to 99 of 100 batches; it is reported without requiring 95 of 100 or claiming family-wise confidence.

Numerical limitations: simulations use the inherited 32-bit midpoint-uniform RNG and double-precision inverse-geometric calculation. The smallest simulated entry probability was $5\times10^{-7}$, not an arbitrary epsilon limit. Resolution discretizes the Bernoulli event, and the finite uniform grid truncates the longest geometric tails. Integer waiting observations were checked for safe representation. The continuum-limit statements and moment constants come from exact rational algebra/proofs, independently of this finite-precision implementation.

## 9. Executable evidence and boundaries

- `src/phase-type.mjs`: exact rational polynomials, fraction-free determinants, rational-function linear solves, raw moments up to order six, exact numeric absorption diagnosis including unreachable closed states, and survival probabilities by matrix powers. Coefficients are in increasing epsilon order.
- `forestMeanCertificate`: independent enumeration of positive sink trees and eligible two-root forests, capped at six states. The exact matrix solver supports up to eight states. The forest enumerator verifies tree/determinant and mean-forest/Cramer identities before returning its certificate.
- `certifyKernel`: nonnegative Bernstein coefficients provide an **exact sufficient**, not necessary, substochastic certificate on $[0,1]$. A valid polynomial may fail that sufficient test. An explicitly justified smaller interval can be used with certification disabled; that does not turn the solver into an automatic positivity proof.
- `data/theory/phase-type.json`: nine new exact systems; moments, leading coefficients, forest certificates, epsilon-zero diagnosis, and exact evaluations at $1/2,1/10,1/100,1/10000$. Initial-source SHA-256 is `90d13720e6718aeae6e4d5d33068ef4493cc1b2c1b7beea6d3f604773b870949`.
- `tests/phase-type.test.mjs`: ten tests passed after correction of two local API/serialization defects. Oracles include a separate permutation determinant, explicit geometric raw moments, independently enumerated forests, and an original-attempt finite-prefix moment calculation with a bounded residual. The first local run was 8/10, then the complete corrected run was 10/10; unsuccessful initial results are not represented as an initial clean pass.
- `data/rare-event/manifest.json`: completed 2,000,000-draw study, design/source/output hashes, seed range, timestamps, and runtime. The scripts preserve existing outputs and reject an unversioned rerun instead of overwriting an inconvenient realization.

From the research root, the portable standard commands are:

```text
node --test stage3/tests/phase-type.test.mjs
node stage3/src/phase-type.mjs
node stage3/scripts/rare-event-study.mjs
```

The last two require a fresh output directory/version; their current outputs are already generated and frozen. On the present Windows development machine, the environment wrapper is dot-sourced before running them. No third-party packages, website changes, Stage I/II reruns, or PDF generation were needed for these results.

## 10. Primary-source provenance and novelty boundary

1. **Seth Chaiken (1982)**. “A Combinatorial Proof of the All Minors Matrix Tree Theorem.” *SIAM Journal on Algebraic and Discrete Methods* 3(3), 319–329. [Publisher record](https://epubs.siam.org/doi/10.1137/0603033), DOI `10.1137/0603033`. Publisher abstract and bibliographic metadata checked in this stage; the full original article was not read. The concrete positive row-Laplacian specialization is supported by the next full source and by an independent algebraic certificate.
2. **Pavel Chebotarev and Rafig Agaev (2002)**. “Forest matrices around the Laplacian matrix.” *Linear Algebra and its Applications* 356, 253–274. [Author preprint](https://arxiv.org/abs/math/0508178), [full author preprint](https://arxiv.org/pdf/math/0508178), [DOI](https://doi.org/10.1016/S0024-3795(02)00388-9). Full preprint read through the web tool in this stage; no local PDF download. Used for classical directed rooted-forest/cofactor identities, not as a source of our model-specific empirical claims.
3. **Peter W. Glynn and Donald L. Iglehart (1989)**. “Importance Sampling for Stochastic Simulations.” *Management Science* 35(11), 1367–1392. [Author publication page](https://web.stanford.edu/~glynn/papers/1989/GI89a.html), [author-hosted article](https://www-leland.stanford.edu/~glynn/papers/1989/GI89a.pdf). Primary author page/abstract checked; the article link was resolved by the web tool, but full article text was not extracted. Cited only for the established rare-event simulation literature. Conditional-estimator unbiasedness and variance in this document are derived independently.

There is no priority claim for absorbing-chain inverses, Cramer's rule, matrix-tree/forest identities, conditional expectation variance reduction, or uniform-integrability criteria. There is also no demonstrated matched-memory packing benefit in this document. The supported additions are an exact, reproducible controller-kernel singularity analysis; a counterexample to unqualified shortest-path counting; explicit repair-dependent pole bounds; realizable consecutive-reset controller examples; and a controlled measurement comparison that exhibits and remedies rare-entry blindness in its stated model.
