# Primary literature and claim boundaries

Accessed 2026-10-04. Searches covered finite-state controller synthesis, limited-memory
POMDP control, accessible automata enumeration, singular/nearly decomposable chains,
matrix forests, rare-event estimation, and outcome/Markov-modulated RSA. Primary
author, proceedings and publisher sources were used. No secondary synopsis is evidence
for a technical theorem. Search snippets were used to find sources, not to establish
an exhaustive novelty claim. No primary match establishing an identical four-state,
matched-memory outcome-only RSA survey was found in these limited searches; that is
not proof of priority.

| Reference | Verified primary source / access | Relevance and limit |
| --- | --- | --- |
| Reis, Moreira and Almeida, *On the Representation of Finite Automata*, DCFS 2005, DCC-2005-04; posted 2009 | [arXiv record](https://arxiv.org/abs/0906.2477), [author manuscript](https://www.dcc.fc.up.pt/~nam/publica/dcfsrma05.pdf) | Canonical accessible automata enumeration is established methodology. Binary Moore outputs and the H/V quotient specialize it here. |
| Almeida, Moreira and Reis, *Aspects of enumeration and generation with a string automata representation* | [Author preprint](https://arxiv.org/abs/0906.3853), abstract and metadata | Exact generation and counting are prior work; this project independently implements a small exhaustive case. |
| Hansen, *An Improved Policy Iteration Algorithm for Partially Observable MDPs*, NIPS 1997, 1015–1021 | [Proceedings](https://papers.nips.cc/paper_files/paper/1997/hash/c930eecd01935feef55942cc445f708f-Abstract.html), abstract and paper link | Finite-state policy representations predate this project. Our irreversible, outcome-limited finite-lattice objective differs from discounted infinite-horizon benchmarks. |
| Poupart and Boutilier, *Bounded Finite State Controllers*, NIPS 2003 | [Proceedings](https://proceedings.neurips.cc/paper_files/paper/2003/hash/4c5bcfec8584af0d967f1ab10179ca4b-Abstract.html), abstract | Fixed-size controller optimization is classical; stochastic bounded policy iteration is not implemented here. |
| Chaiken, *A Combinatorial Proof of the All Minors Matrix Tree Theorem*, SIAM Journal on Algebraic and Discrete Methods 3(3), 319–329 (1982) | [Publisher](https://epubs.siam.org/doi/10.1137/0603033), abstract and bibliographic metadata; primary paper text available through indexed manuscript | All-minors forest identities support the positive forest formula. The matrix-tree identity is not an original theorem of this project. |
| Chebotarev and Agaev, *Forest matrices around the Laplacian matrix*, Linear Algebra and its Applications 356, 253–274 (2002) | [Publisher](https://www.sciencedirect.com/science/article/pii/S0024379502003889), [author preprint](https://arxiv.org/abs/math/0508178) | Weighted directed forest expansions connect adjugates to graph structure. ArXiv posting year 2005 is not publication year. |
| Meyer, *Stochastic Complementation, Uncoupling Markov Chains, and the Theory of Nearly Reducible Systems*, SIAM Review | [Publisher](https://epubs.siam.org/doi/10.1137/1031050), abstract | Nearly reducible chains and slow inter-class leakage have a substantial classical literature. No claim that slow exploration itself is novel. |
| Courtois and Louchard, *Approximation of eigencharacteristics in nearly-completely decomposable stochastic systems*, Stochastic Processes and their Applications 4(3), 283–296 (1976) | [Publisher](https://www.sciencedirect.com/science/article/pii/0304414976900168), abstract and metadata | Perturbations of weakly coupled stochastic systems are known. We use exact finite absorbing kernels rather than borrow unverified asymptotic approximation bounds. |
| Glynn and Iglehart, *Importance Sampling for Stochastic Simulations*, Management Science 35(11), 1367–1392 (1989) | [Publisher record](https://pubsonline.informs.org/doi/10.1287/mnsc.35.11.1367), [author page](https://web.stanford.edu/~glynn/papers/1989/GI89a.html), [author paper](https://www-leland.stanford.edu/~glynn/papers/1989/GI89a.pdf) | Likelihood-ratio estimation and change of measure are classical; our conditional estimator is independently derived. Publisher title is plural; author landing page uses singular. |
| Ulyanov, Tarasevich, Eserkepov and Grigorieva, *Characterization of domain formation during random sequential adsorption of stiff linear k-mers onto a square lattice*, Physical Review E 102, 042119 (2020) | [Author preprint](https://arxiv.org/abs/2006.01004), [publisher](https://journals.aps.org/pre/abstract/10.1103/PhysRevE.102.042119), abstract and metadata | Isotropic proposal does not imply absence of local orientational domains. We measure run-wise global imbalance separately from density and waiting cost. |
| Lebovka, Karmazina, Tarasevich and Laptev, *Random sequential adsorption of partially oriented linear k-mers on square lattice*, Physical Review E 84, 061603 (2011) | [Primary preprint](https://arxiv.org/abs/1109.3271); metadata/abstract checked by root, full manuscript checked by paper author via web | RRSA retains rejected orientation while retrying positions. This is a close earlier outcome-dependent adsorption protocol; its orientation-exhaustion endpoint is not the same universal-live stopping convention used here. Feedback-controlled deposition itself is not claimed new. |

No copied implementation was required: the new enumeration, finite-controller engine,
exact kernel/forest code and selection pipeline are project source. Earlier stages are
read-only dependencies and their original citations and licensing remain intact.

The strongest defensible contribution is a reproducible bounded-controller application,
an explicit matched-memory comparison, and worked singular-kernel counterexamples.
It is not a claim to have invented automaton minimization, POMDP control, phase-type
moments, matrix-tree theorems, importance sampling or uniform integrability.
