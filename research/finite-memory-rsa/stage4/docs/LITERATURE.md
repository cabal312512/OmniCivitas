# Primary literature and attribution

Primary metadata/abstracts were checked online on 2026-10-04; the DTU phase-type
notes' discrete-moment formula was read in the primary PDF. This is a focused
method check, not a comprehensive novelty or priority search. No external
source-code snippet or third-party media was copied into Stage IV. Node's
standard library and the frozen in-project exact/controller libraries are used;
NumPy/Matplotlib only render figures.

| Source | Role and access scope |
|---|---|
| W.-G. Tzeng (1992), *A Polynomial-Time Algorithm for the Equivalence of Probabilistic Automata*, [SIAM DOI](https://epubs.siam.org/doi/10.1137/0221017) | Classical probabilistic-automaton equivalence; primary abstract/metadata. The rational row-span checker is an implementation of that kind of linear method, not an original equivalence algorithm. |
| B. Vanluyten, J. C. Willems, B. De Moor (2008), *Equivalence of state representations for hidden Markov models*, [publisher](https://www.sciencedirect.com/science/article/pii/S0167691107001429), DOI 10.1016/j.sysconle.2007.10.004 | Primary abstract on nonunique state representations; no claim that a similarity classification solves all positive realization problems. |
| Q. Huang, R. Ge, S. M. Kakade, M. Dahleh, *Minimal Realization Problems for Hidden Markov Models*, [author preprint](https://arxiv.org/abs/1411.3698) | Primary abstract/preprint record; generic realization context. Our full-rank examples certify their own state counts, not a general positive-HMM minimization algorithm. |
| P. Chebotarev, R. Agaev (2002), *Forest matrices around the Laplacian matrix*, [author preprint](https://arxiv.org/abs/math/0508178), DOI 10.1016/S0024-3795(02)00388-9 | Classical positive directed-forest identities, already used in Stage III; no new claim for the mean identity. |
| S. Chaiken (1982), *A Combinatorial Proof of the All Minors Matrix Tree Theorem*, [SIAM DOI](https://epubs.siam.org/doi/10.1137/0603033) | All-minors foundation; cited as established theory, not independently rediscovered. |
| B. F. Nielsen (October 2022), *Lecture notes on phase-type distributions*, [DTU notes](https://www2.imm.dtu.dk/courses/02407/lectnotes/ftf.pdf) | Discrete factorial moments in the primary notes, pp. 8–9; the factorial identity is classical. Stage IV's work is positive-germ graph composition for fixed higher moments. |
| P. Glasserman, P. Heidelberger, P. Shahabuddin, T. Zajic (1999), *Multilevel Splitting for Estimating Rare Event Probabilities*, [publisher DOI](https://pubsonline.informs.org/doi/10.1287/opre.47.4.585) | Primary abstract; multilevel splitting is established rare-event methodology. |
| P. Del Moral, A. Doucet, A. Jasra (2006), *Sequential Monte Carlo Samplers*, JRSS B 68(3), 411–436, [publisher DOI](https://doi.org/10.1111/j.1467-9868.2006.00553.x), [author PDF](https://www.stats.ox.ac.uk/~doucet/delmoral_doucet_jasra_sequentialmontecarlosamplersJRSSB.pdf) | Primary publisher metadata/abstract; standard SMC/resampling context. Our unnormalized-measure induction is written explicitly rather than claiming invention of splitting. |

The project-specific contributions are the forced-first-success operational
quotient and reuse criterion, exact catalogue consequences, a randomized physical
memory threshold, finite-prefix temporal-envelope certificates, the scoped
periodic density theorem, and higher-moment/unknown-entry applications. Publication
novelty beyond this focused check remains unestablished. Mathematical attribution
does not mean an external code dependency was vendored or relicensed.
