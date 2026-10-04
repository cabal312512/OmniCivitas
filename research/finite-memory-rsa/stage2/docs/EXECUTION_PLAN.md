# Stage II execution and inference boundaries

Only this independent research stage is authorized; the website remains at its
previous stop. Existing Stage I code, parameters, locks, figures and conclusions
are immutable inputs. A preservation check is saved before and after Stage II.

1. Separate stochastic simulation and rational solver, tested against original
   trial dynamics and five special points. No arbitrary failure timeout is a jam.
2. Complete coarse alpha,beta square (increments0.05), k4/8,L64,n64, then
   independently named local refinement around small alpha and high beta.
3. New fair-initial policy41 large-size study, L128/256/512/1024/2048,k4/8, with
   IID and alternation nulls. Repetitions are explicitly configured per size,
   and may decrease at the largest size if measured runtime warrants it.
4. Analyze exploration only. Preserve all diagonal nulls and signed distributions.
   Candidate selection, matched-null fitting and comparison margins are public.
5. Freeze candidates, nulls, seeds, outcome definitions and a full multiplicity
   family before independent confirmation; no holdout retuning.
6. Mathematical failure-kernel liveness and beta->0 waiting singularity are
   distinct from terminal density and thermodynamic behaviour.
7. Produce reproducible data, analysis, figures, scientific report and a Stage II
   paper, preserving negative and inconclusive results. Record exact evidence
   and defer two-bit enumeration unless this stage supplies a concrete reason.

## Seed separation

Stage I used seeds below2000000. Stage II coarse exploration starts10000001,
refinement12000001, large-size studies20000001, exact Monte Carlo checks30000001,
confirmation40000001 and late diagnostics50000001. Each L,k stratum receives an
explicit offset in its experiment configuration. Policies in a stratum share
seeds for paired comparisons, not an identical attempt tape. Different studies
never borrow pilot seeds for formal confirmation. Reconstruction with the same
seeds does not increase the scientific sample size.

## Runtime

Use standard Node and the already installed optional Python plotting/PDF tools.
No website test, Docker build or new framework is needed. The kernel has roughly
17L² bytes of lattice buffers (about68MiB at2048), and experiments stream records
instead of retaining all lattices. Start with one simulation process; do not
launch the full website infrastructure. Tools/caches/temp copies remain under
the local dependency root; source and final scientific deliverables remain here.
