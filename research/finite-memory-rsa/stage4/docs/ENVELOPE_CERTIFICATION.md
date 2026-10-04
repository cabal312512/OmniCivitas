# Certified envelopes and what they do not certify

## A global outer relaxation

Set J=Eθ−μE|S|−νE[A/N], μ,ν≥0. A temporal controller draws an infinite
orientation word independently of anchors. Its objective is an average of
fixed-word objectives. It is therefore bounded by the largest fixed-word upper
bound. This covers the full ≤4-state edge-HMM family, arbitrary random initial
states, and even unlimited-memory temporal word laws. No parameter grid is
being declared exhaustive.

For each prefix of length T, enumerate its exact anchor-path counts, accounting
for paths already jammed at their actual stopping times. At live prefix states
replace the unknown suffix by a certified upper reward. Maximize over every
prefix, obtaining B_T(μ,ν). For every proper temporal policy,

\[
E\theta\le B_T(\mu,\nu)+\mu s+\nu c
\quad\text{if }E|S|\le s,\ E[A/N]\le c.
\]

Take the minimum across all available T and multiplier pairs. These are
half-space **outer bounds**, not a description of the possibly nonconvex
four-state attainable region. A bound can exceed every attainable temporal
point because its relaxed continuation is permitted to see occupancy.

Square-lattice transposition preserves θ, |S| and A/N, so enumerating first-H
words covers first-V words without granting a controller a free persistent coin.
T=4,8,12 gives 8,128,2048 prefixes for each boundary.

## Two safe suffixes

The basic bound allows every physically reachable terminal completion (N,h)
from current occupancy x and uses reward
θ(N)−μ|2h−N|/N−ν[T+N−N(x)]/N. At least N−N(x) additional trials are needed.

The stronger bound retains past T/N exactly at terminals, but charges future
attempts by ν/N_max, where N_max=floor(L²/k). Because eventual N≤N_max,
this undercharges future costs, hence raises the reward safely. Allow full
occupancy feedback after the prefix. Terminal V_T(x)=θ−μ|S|−νT/N. For a live
state, legal count l_a and anchor multiplicities m_xy,

\[
V_T(x)=\max_{a:l_a>0}
\left[\sum_y {m_{xy}\over l_a}V_T(y)-{\nu M\over N_{\max}l_a}\right].
\]

This eliminates geometric waiting in the full-information one-attempt Bellman
inequality. The displayed value dominates each action's expected successor
value minus ν/N_max, including a completely illegal action. Iterating that
inequality until proper absorption bounds every possible continuation; there
is no claim that a ≤4-state temporal controller can implement it. Since every
success increases occupancy, the values are computed acyclically.

All active path counts are exact integers bounded by M^T below 2^53; an unsafe
horizon is rejected. Rewards, denominators, comparisons and maxima use BigInt
rationals. All prefixes' raw numerators and the maximizing words are retained.
Separate BigInt map-based replay verifies every selected maximizing prefix in
both modes. A raw anchor-tree test independently checks a T=4 instance.

## Actual bounds

There are 30 supports per mode: two boundaries × three horizons × five fixed
multiplier pairs. The strengthened T=12 values are:

| μ | ν | periodic | open |
|---:|---:|---:|---:|
| 0 | 0 | 0.888888889 | 0.888888889 |
| 0 | 0.05 | 0.705856287 | 0.726119358 |
| 0.1 | 0.05 | 0.670931178 | 0.679432123 |
| 1 | 0.05 | 0.465879855 | 0.263912765 |
| 0.1 | 0.2 | 0.121833372 | 0.207108625 |

Authoritative exact fractions are in `results/temporal-envelope-informed.json`
and `data/envelope-informed-{periodic,open}.json`; decimals above are presentation.
No tested feedback point strictly crosses these certified outer bounds. This
does **not** imply that all feedback points lie in the temporal attainable set.

## A sharp density-only negative result

On periodic 3×3 domino RSA, θ≤8/9 by parity. A two-state temporal schedule
H once, then V forever attains exactly 8/9, with E|S|=1/2 and E[A/N]=37/10.
After the first H rod, each of three columns admits exactly one V domino.
The three column-arrival probabilities per attempted V are 1/9,1/9,3/9.
They remain unchanged until that column is filled. Uniform anchors and inclusion-
exclusion give expected remaining trials

\[
9+9+3-9/2-9/4-9/4+9/5=69/5.
\]

Add the first trial and divide by deterministic N=4 to get 37/10. This is also
checked by exact joint-law absorption and independent Bellman residuals.

Thus the complete fixed-geometry-proper ≤4-state temporal density envelope is
exactly 8/9 and no feedback can improve that **one** objective. It is not a
joint Pareto inclusion theorem. This schedule fails the stronger abstract
universal-liveness requirement and is improper on open 3×3. Neither scope is
silently substituted for the other.

## Capability search and honest memory matching

All 166 archived live ≤3-structural-state controllers deduplicate to 144
universal operational classes. Four-state selection adds 48 controllers from
145 structural-feature strata, by a fixed structural rule rather than previous
winner status. Both tiny geometries are evaluated: 350 new exact feedback cases
and 34 read-only cached invariant objective points. True stochastic temporal
examples add 24 new exact cases. An 800-point switching grid is exploratory.

A separately declared seven-parameter two-state edge-HMM refinement takes
5176 floating objective evaluations. Two retained feasible points are evaluated
exactly and independently Bellman-checked. Neither dominates the archived
feedback-2-00010 point; failure of local search is not a certified gap.

For fairness, the authoritative `results/memory-matching-audit.json` charges
each null realization no more states than a **proved lower bound** on randomized
feedback memory. Both deterministic actions on positive histories give lower
bound two, and the activation example has lower bound three. General feedback
minimum remains an interval. Universally live selected nulls dominate 127/192
periodic and 86/192 open feedback points in all three objectives. Including the
fixed-proper boundary schedule changes the periodic count to 128. These are
feasible inclusions for those individual points, not a full-region theorem.
The complete same-operational-memory joint stochastic frontier remains open.
