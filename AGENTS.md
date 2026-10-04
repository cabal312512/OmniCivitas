# OmniCivitas execution contract

Start with `docs/HANDOFF.md` for the current handoff and file map. Read `docs/PHASES.md`, `docs/PROGRESS.md`, the requirement ledgers and `docs/DECISIONS.md` before continuing. The user's latest instructions override the two original source documents.

- There are nine phases. Work only on the phase authorized by the user and stop after its acceptance report. Do not move to the next phase automatically.
- Preserve all 381 A requirements and 351 B requirements verbatim. Record unnumbered source requirements, technical items and screenshot requirements too. Never mark a requirement verified merely because its package is installed or a filename exists.
- Sources, configurations and deliverables stay in `E:\OmniCivitas`. Downloads, actual third-party dependencies, tools, caches, temporary files and runtime data belong under `F:\OCVdeps`. On Windows run commands through `ocv.ps1` or dot-source `scripts/Enter-OcvEnvironment.ps1`. Do not use the pre-existing C: pnpm fallback or global installs.
- Do not pull or build container images until `scripts/Confirm-DockerStorage.ps1` verifies the actual Docker disk is under F:. No unsafe default-path fallback.
- Default to the core group. Start optional services only when needed. Use memory and CPU limits, bounded logs and small development heaps. Build heavy targets sequentially. WSL daily ceiling is 9 GiB; maximum ceiling is 11 GiB, leaving room for Desktop processes within an approximately 12 GiB overall target.
- Historical code explicitly meant to be dormant does not require its toolchain or execution tests. Active technologies require real usage and real runtime evidence, which may be gathered in separate batches.
- Absurd architecture and UI are intentional. Runtime loops, leaked credentials, real account collection, incorrect exported files and inaccessible completion paths are not.
- Account routes are never mounted. No real passwords are transmitted, logged or persisted. Optional infrastructure must not prevent ordinary tools or the shell from working.
- Record partial results and environmental blockers honestly. Never treat memory fallback as proof that PostgreSQL or Redis was exercised.


