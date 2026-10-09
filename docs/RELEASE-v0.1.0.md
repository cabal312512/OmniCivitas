# OmniCivitas — public source release

Public source snapshot: outcome-only lattice adsorption research, exact solvers, frozen data, certificates, manuscripts, figures and an interactive web interface.

- Original code: MIT, Copyright (c) 2026 cabal312512. Third-party code and assets retain their own terms and required notices.
- Compiled paper PDFs are excluded from Git history, source packages and regenerated website downloads. Manuscript sources and figure PDFs remain. Original scientific seals are retained verbatim; `config/research-publication.json` declares the omitted PDF without rewriting historical results.
- Node 24.14.1 / pnpm 10.34.6: `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm build`.
- Docker Compose v2: `docker compose up --build -d --wait`. Only six core services start by default. Optional profiles preserve all 24 configured services.
- Sources and lockfiles are supplied; dependencies, tools, caches, actual environment files, secrets and runtime database contents are not.
- `OmniCivitas-<tag>-source.zip` contains tracked source files. Verify it against `SHA256SUMS.txt`; build outputs and third-party dependency installations are intentionally absent.

Research is paused; this is an AI-assisted draft, not a peer-reviewed publication. The periodic deterministic-feedback comparison and density supremum are scoped exact results; open-boundary joint capability remains unresolved. No experiments or PDF generation were performed for publication.

Windows clean-clone, Linux container userspace and isolated new-volume core deployment were previously exercised. Independent macOS and Linux Engine hosts are not verified. Cross-platform Actions checks run separately from source packaging; publication does not certify their success. Read README and docs/DEPLOY.en.md for deployment, resource budgets, configuration and limitations.

Contact: user31436@proton.me.

The v0.1.1 patch corrects cross-platform CI ordering: all build targets run before tests that import the compiled gateway. Application and scientific behavior are unchanged from v0.1.0.

The v0.1.2 update makes deployment documentation English by default, retains a Chinese alternative, and excludes twelve author-only prompt/agent/handoff files from the current source and new release packages while preserving every local original. It also updates the two storage-test assertions after the internal variable rename. Original scientific seals remain untouched; the declared publication subset now omits five research briefs as well as the paper PDF. Prior commits and tags are retained.
