# OmniCivitas

**Outcome-only control of lattice adsorption: operational memory and certified temporal comparisons.**

A computational study of irreversible random sequential adsorption under a restricted information channel. A controller chooses horizontal or vertical rods and receives only the success or failure of its previous proposal. It cannot inspect occupancy, count legal placements, move deposited particles or restart the physical process. The comparison is with outcome-blind temporal controllers at the same *physical operational memory*.

This repository contains the simulator, behavioral catalogue, exact rational solvers, frozen empirical records, proof certificates, figures, manuscripts and interactive observation interface. Research is paused after its final authorized round. The manuscript is an AI-assisted research draft, **not a peer-reviewed publication**.

![Orientation-response landscape](research/finite-memory-rsa/stage2/figures/final/landscape-landscape-L64-k4-periodic.png)

*Archived finite-size response landscape. Colour represents an empirical objective, not an exact capability theorem.*

## Main findings

For the periodic 3 × 3 dimer system, every proper deterministic one-bit feedback controller is weakly dominated by the convex hull of proper outcome-blind two-state temporal controllers. Consequently, for all nonnegative weights μ and ν,

```math
\max_{F\;\mathrm{proper,deterministic}} J(F)
\leq \sup_{T\;\mathrm{proper},\;|Q|\leq2} J(T),
\qquad J=\mathbb E[\theta]-\mu\mathbb E[|S|]-\nu\mathbb E[A/N].
```

The temporal family uses the complete edge-emitting hidden Markov representation: action and next state are sampled jointly. A linear objective on a convex combination is no better than on at least one component; the witness does not treat a mixture selector as free memory.

![Physical memory activation](research/finite-memory-rsa/stage4/figures/01-operational-memory.png)

On both open and periodic 3 × 3 lattices, the two-state temporal density supremum is exactly **8/9**. Positive-parameter universally live families approach it. Finite attainment on the open lattice is not established, and convergence of density does not imply convergence of adsorption cost.

The open-boundary joint comparison remains unresolved. At (μ, ν) = (1.25, 0.4), the certified interval for the selected feedback advantage is

```text
−0.148856582394992 ≤ J(F10) − J* ≤ +0.007477505542617.
```

It crosses zero. It proves neither an advantage nor equality. Process-law separation can coexist with absence of a scoped averaged-objective advantage. The results do not establish raw-point inclusion, equality of nonconvex attainable sets, an arbitrary randomized-feedback theorem or a thermodynamic-limit claim.

![Observation interface](docs/assets/observation-console.png)

![Singular excursion networks](research/finite-memory-rsa/stage3/figures/singular-graphs.png)

*Finite-kernel excursion structure belongs to the rare-event methodological supplement; it is distinct from the adsorption capability theorem.*

## Evidence and implementation

| Retained evidence | Scope |
| --- | --- |
| 226,816 terminal simulations; 36 locked comparisons | Archived finite-size empirical record |
| 768 external rescue pairs; 192 direct probes | Diagnostic interventions, not controller capabilities |
| 64 deterministic encodings; 26 oriented / 13 symmetry-reduced classes | Outcome-only behavioral classification |
| 240,006 prefix nodes; 9,000 parameter leaf boxes | Certified support bounds and recomputed interval evidence |
| 6,800 rational Bellman equalities | Exact-law verification |
| 142 / 142 research tests in the final retained run | Model, enumeration, statistics and certificate checks |

These counts describe different evidence types; they are not independent replications of one result. Shared engines and reconstruction limits are documented in the [reproduction record](research/finite-memory-rsa/stage5/docs/REPRODUCTION.md). Negative results and unresolved intervals are retained.

| Read / inspect | Location |
| --- | --- |
| Unified manuscript | [FINAL_MANUSCRIPT.md](research/finite-memory-rsa/stage5/paper/FINAL_MANUSCRIPT.md) |
| Exact theorems and proofs | [FINAL_CAPABILITY_THEOREMS.md](research/finite-memory-rsa/stage5/docs/FINAL_CAPABILITY_THEOREMS.md) |
| Global certification | [GLOBAL_CERTIFICATION.md](research/finite-memory-rsa/stage5/docs/GLOBAL_CERTIFICATION.md) |
| Rational adsorption solver | [exact.mjs](research/finite-memory-rsa/src/exact.mjs) |
| Complete temporal kernels | [temporal.mjs](research/finite-memory-rsa/stage4/src/temporal.mjs) |
| Word-prefix bounds | [word-bound.mjs](research/finite-memory-rsa/stage5/src/word-bound.mjs) |
| Continuous parameter bounds | [parameter-bound.mjs](research/finite-memory-rsa/stage5/src/parameter-bound.mjs) |
| Certificate verifier | [verify-certificates.mjs](research/finite-memory-rsa/stage5/src/verify-certificates.mjs) |
| Final adversarial review | [FINAL_REVIEW.md](research/finite-memory-rsa/stage5/FINAL_REVIEW.md) |
| Literature and attribution | [FINAL_LITERATURE.md](research/finite-memory-rsa/stage5/docs/FINAL_LITERATURE.md) |

![Exact dominance witness](research/finite-memory-rsa/stage5/figures/01-periodic-support-negative.png)

The scientific core uses Node.js without npm dependencies. A bounded reconstruction writes into a new directory and compares the retained 520-record quick reference, rather than rerunning the complete empirical programme:

```sh
cd research/finite-memory-rsa
node scripts/reproduce.mjs --profile quick --output ../rsa-check
```

The output directory must not already exist. Manuscript sources, scientific figures, data and original seals are published. **Compiled paper PDFs are excluded**, including from regenerated website download bundles. The original seal still lists the omitted PDF; [the publication policy](config/research-publication.json) declares its path, original hash and size. This is a documented subset of the sealed archive, not a new scientific seal. Author-only research briefs are also excluded from the public subset and retained locally. Figure PDFs remain available. No new experiments or PDFs were generated for this release.

With these distinctions, the next step in relating the operational trace hierarchy to the full joint capability region would be to
The web interface uses Astro, Next.js, Angular and NestJS. Ordinary development, builds and primary features work without the entire infrastructure stack. Docker starts only core by default.


Install **Node.js 24.14.1**, **pnpm 10.34.6** and Git:

```sh
git clone https://github.com/cabal312512/OmniCivitas.git
cd OmniCivitas
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:8080** Initial startup prepares Angular, the gateway and research downloads sequentially. The large research archive takes time to process. Stop with Ctrl+C.

Without a database URL, development uses bounded in-memory storage; records do not survive a restart. Docker core uses real PostgreSQL/Redis persistence. Identity screens use local demonstration state; no account API is mounted. Do not enter real passwords.

Build before testing: storage tests import compiled gateway code.

```sh
pnpm build
pnpm test
pnpm test:jest
```

Five build targets run sequentially. Change `OCV_WEB_PORT`, `OCV_PORTAL_PORT`, `OCV_NEXT_PORT` and `OCV_GATEWAY_PORT` to distinct available ports when necessary. Standard commands require no specific disk layout, username, local PowerShell wrapper or cache variables.

### Docker core

Use Docker Engine with Compose v2 on Linux, or Docker Desktop in Linux-container mode on Windows/macOS. From the root:

```sh
docker compose up --build -d --wait
docker compose ps
```

Only **edge, portal, next, gateway, PostgreSQL and Redis** start by default. The entrance is **http://127.0.0.1:8080**. Initial builds download dependencies and generate research resources. Source files occupy approximately 1 GB; dependencies, images and caches need additional space.

Standard Node commands provide a bounded sequential builder:

```sh
pnpm civilization:core
pnpm civilization:status
pnpm civilization:stop
```

The builder has a 3 GiB cap and stops after compilation. Stopping services preserves named volumes. `docker compose down` also preserves data; **`docker compose down -v` deletes volume data**.

### Optional profiles

For queued, on-demand backend work, run `pnpm civilization:after` alongside core; `pnpm civilization:after --stop` requests a graceful stop. It starts bounded service batches and preserves named volumes. This optional trusted host process requires Node 24 and Docker CLI access; see [dispatch and storage details](docs/AFTER-ROUTES.md) before enabling it on another machine.

All 24 services remain in [compose.yaml](compose.yaml). Core needs no profile. Select optional groups when needed.

| Profile | Additional services | Container memory caps including core |
| --- | --- | ---: |
| core | Default six services | 1728 MiB |
| databases | MySQL, MongoDB, MinIO, archive API | 2944 MiB |
| legacy | Spring, FastAPI, Laravel, Fiber, ASP.NET SOAP, Sinatra, Hono, MySQL | 3616 MiB |
| messaging | RabbitMQ, Kafka, MongoDB, message workers | 3968 MiB |
| search | Elasticsearch | 3008 MiB |
| monitoring | OpenTelemetry, Prometheus, Grafana | 2240 MiB |
| maximum / everything | All optional services | 7840 MiB |

```sh
pnpm civilization:databases
pnpm civilization:legacy
pnpm civilization:messaging
pnpm civilization:monitoring
pnpm civilization:search
pnpm civilization:batch legacy,messaging,search
pnpm civilization:maximum
```

The controller stops unrelated optional project containers before switching groups. Raw Compose commands retain previously started services:

```sh
docker compose --profile legacy up --build -d --wait
docker compose --profile legacy stop
```

Smaller machines should use separate profile sessions and stop optional services before compiling. These are container caps, not total host RAM estimates; Docker, the OS, caches and compilation also consume memory. Maximum defaults to an **8192 MiB** aggregate budget; adjust `OCV_CONTAINER_BUDGET_MIB` on other hardware. Java, Kafka and Elasticsearch use small development heaps. Important services have memory, CPU, PID and log limits.

The original machine's 24 GB RAM and daily 9 GiB / optional maximum 11 GiB WSL settings are local optimizations. Public commands do not modify WSL settings or require equivalent hardware.

### Configuration and persistence

Only [.env.example](.env.example) is committed. Copy it to `.env` if needed; never commit actual environment files.

```sh
# Linux / macOS
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Compose reads `.env`. Direct `pnpm dev` uses process environment variables; set overrides in the terminal. The example covers addresses, ports, database/message credentials, resources and heaps. Replace demo credentials before shared deployment. `OCV_DATABASE_URL` and `OCV_RABBIT_URL` override assembled connection strings; URL-encode reserved characters in credentials.

Initialization credentials apply only to **new volumes**. Environment changes do not modify an existing account. Maintain that account or create a separate project volume; do not delete important data to diagnose a credential mismatch.

Docker uses **named volumes** and chooses their physical host disk. Default bind mounts are repository-relative, read-only configuration. Put machine-specific mounts in ignored `compose.local.yaml`:

```sh
docker compose -f compose.yaml -f compose.local.yaml up -d --wait
```

Resource overrides include `OCV_POSTGRES_MEM=512m` and `OCV_MESSAGE_BRIDGE_CPU=0.5`; see `.env.example`. Keep heaps below container caps. Published addresses default to loopback. External access needs an explicit bind address, HTTPS reverse proxy, access controls and firewall configuration. Defaults are for development.

### Troubleshooting

| Symptom | Action |
| --- | --- |
| Installation fails or versions differ | Use the versions above, retain the lockfile and check registry connectivity |
| First startup is slow | Research packaging and frontend builds take time; inspect logs |
| A port is occupied | Change the four `OCV_*_PORT` values without introducing another collision |
| Docker cannot connect | Start Docker, select Linux containers, confirm Compose v2, run `docker info` |
| An optional endpoint reports fallback | Start its profile; fallback does not prove a real service was exercised |
| Changed database credentials do not work | Existing volumes do not reinitialize; maintain the account or use new project volumes |
| RAM is exhausted or a build is killed | Return to core, stop optional groups and build sequentially before increasing budgets |
| WebGL scenes are blank | Check hardware acceleration/WebGL; demos do not alter scientific results |
| Music does not autoplay | A browser may require a first click; pages have audio controls |
| Tests cannot find gateway/dist | Run `pnpm build` first; compiled outputs are absent from Git |
| Seal verification reports missing inputs | Consult the explicit publication exclusions; retained artifacts must still match |

### Tests and platform scope

Unit tests need no full stack. Browser checks need a running application and the corresponding browser:

```sh
pnpm exec cypress install
pnpm test:cypress
pnpm exec playwright install chromium
```

Set `OCV_BASE_URL` for another entrance. Use focused checks during ordinary development. Native integration tests run on demand:

```sh
pnpm civilization:legacy
node scripts/test-languages.mjs java python php go dotnet ruby
```

The helper uses one 768 MiB test container at a time and downloads SDKs only when selected. Use the repository's Actions checks for the current revision. Independent Linux Engine/macOS Docker host deployments remain unverified. Internal requirement ledgers, handoffs and acceptance records are excluded from published sources; `pnpm ledger:check` reports that limitation in a public clone.

`ocv.ps1` and `scripts/Enter-OcvEnvironment.ps1` are optional helpers for the original machine. Other users run standard commands. Dependencies, tools, caches, build output, real environment files, tokens, certificates, runtime databases, Docker volumes and WSL disks do not belong in Git. Small third-party packages also install from package.json / pnpm-lock.yaml.

[中文部署说明](docs/DEPLOY.zh-CN.md)


Original code: **MIT — Copyright (c) 2026 cabal312512**; see [LICENSE](LICENSE).
