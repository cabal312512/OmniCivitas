# Model and terminal-state conventions

Each trial chooses H or V from a controller, then samples uniformly from the
geometrically admissible anchors for that orientation. An empty straight k-mer
is deposited irreversibly; otherwise the trial fails. Periodic anchors number
L² per orientation; open anchors number L(L−k+1). H and V are both part of the
geometric orientation set, even for a controller that never chooses one of them.
The controller observes only its state and the previous binary outcome.

Controller IDs are exactly: bit 4+q is g(q) (H=0,V=1), and bit 2q+y is f(q,y)
(failure=0,success=1). q starts at zero. The action precedes its outcome.
Thus there are 64 raw controllers, not 64 different behaviours. State relabeling
must carry the initial state with it. See THEORY.md for the rooted quotient.

On a fixed lattice, follow only failure edges from the current state. If none
of the orientations along this finite prefix/cycle has a legal anchor, no more
deposition is possible. If both global legal counts are zero the state is a
geometric jam; otherwise it is controller-induced deadlock. Neither is inferred
from an arbitrary long failure run. A transient state with positive success
probability is sampled before a zero-success recurrent cycle is declared dead.
“Terminal coverage” always includes both cases; “jamming coverage” is reserved
for geometric jams. A one-direction jam is not a two-direction geometric jam.

The event engine uses legal counts solely to reproduce the unobserved random
trials, not to choose a spatially informed control action. A prefix failure has
its original probability. A cycle with successive hazards a_i has survival
B=product(1−a_i); complete failed cycles are sampled geometrically, and the
first successful state has conditional mass product_{j<i}(1−a_j)*a_i/(1−B).
Its anchor is uniform in the corresponding legal set. Uniform trials imply
this conditional distribution exactly. Virtual attempted-placement time is
preserved, with ordinary finite-precision pseudorandom sampling limits.

For a memoryless orientation distribution p(H), the next successful orientation
has weight p(H)*legal_H versus (1−p(H))*legal_V, and total waiting time is
geometric with hazard [p(H)*legal_H+(1−p(H))*legal_V]/M. The event engine does
not sample the individual failed orientations of this baseline: those two CSV
fields are empty. Direct trajectories contain every actual attempt and outcome.
They are used for dynamics/information diagnostics, not fabricated from jumps.

The reported attempts/failures stop at entry into a diagnosed terminal state;
the infinitely many subsequent failures of a deadlocked process are excluded.
Counts and time do not enter f or g. Coverage, accepted-particle orientation,
residual legal counts and deadlock probability are primary measurements.

Acceptance anisotropy is |S|=|N_H−N_V|/(N_H+N_V) per realization. Averaging S
alone can falsely call a mixture of fully aligned samples isotropic. Coverage
comparisons use independent confirmation seeds after exploratory selection.
Alternation (IDs19/35) does not read feedback; it is an essential temporal null.

The simulator is single-process JavaScript using typed arrays and no packages,
chosen because an existing portable Node runtime permits actual experiments
without installing a compiler. Scientific analysis/figures use only NumPy and
Matplotlib. Other machines may use normal Node/Python; no drive layout is needed.
