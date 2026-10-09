# Deployment

[中文部署说明](DEPLOY.zh-CN.md)

The web interface uses Astro, Next.js, Angular and NestJS. Ordinary development, builds and primary features work without the entire infrastructure stack. Docker starts only core by default.

## Local development

Install **Node.js 24.14.1**, **pnpm 10.34.6** and Git:

```sh
git clone https://github.com/cabal312512/OmniCivitas.git
cd OmniCivitas
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:8080**, or **/research/** for the research interface. Initial startup prepares Angular, the gateway and research downloads sequentially. The large research archive takes time to process. Stop with Ctrl+C.

Without a database URL, development uses bounded in-memory storage; records do not survive a restart. Docker core uses real PostgreSQL/Redis persistence. Identity screens use local demonstration state; no account API is mounted. Do not enter real passwords.

Build before testing: storage tests import compiled gateway code.

```sh
pnpm build
pnpm test
pnpm test:jest
```

Five build targets run sequentially. Change `OCV_WEB_PORT`, `OCV_PORTAL_PORT`, `OCV_NEXT_PORT` and `OCV_GATEWAY_PORT` to distinct available ports when necessary. Standard commands require no specific disk layout, username, local PowerShell wrapper or cache variables.

## Docker core

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

## Optional profiles

All configured services remain in [compose.yaml](../compose.yaml). Core needs no profile. Select optional groups when needed.

| Profile | Additional services | Container memory caps including core |
| --- | --- | ---: |
| core | Default six services | 1728 MiB |
| databases | MySQL, MongoDB, MinIO, archive API | 2944 MiB |
| legacy | Spring, FastAPI, Laravel, Fiber, ASP.NET SOAP, Sinatra, Hono, MySQL | 4000 MiB |
| messaging | RabbitMQ, Kafka, MongoDB, message workers | 3968 MiB |
| search | Elasticsearch | 3008 MiB |
| monitoring | OpenTelemetry, Prometheus, Grafana | 2240 MiB |
| maximum / everything | All optional services | 10400 MiB |

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

Smaller machines should use separate profile sessions and stop optional services before compiling. These are container caps, not total host RAM estimates; Docker, the OS, caches and compilation also consume memory. Maximum defaults to an **8192 MiB** aggregate budget. The expanded full service set has **10400 MiB** of container caps and needs an explicit budget of at least that amount plus sufficient host memory; use smaller batches otherwise. Adjust `OCV_CONTAINER_BUDGET_MIB` for the workload. Java, Kafka and Elasticsearch use small development heaps. Important services have memory, CPU, PID and log limits.

Resource budgets are bounded development defaults. Size Docker and per-service limits for the selected workload; public commands never change host WSL memory, swap or disk settings.

## Configuration and persistence

Only [.env.example](../.env.example) is committed. Copy it to `.env` if needed; never commit actual environment files.

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

## Troubleshooting

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

## Tests and platform scope

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

`ocv.ps1` is an optional PowerShell wrapper using configured tools or PATH. Local overrides are optional and ignored by publication; see [portable configuration](PORTABILITY.md). Dependencies, tools, caches, build output, real environment files, tokens, certificates, runtime databases, Docker volumes and WSL disks do not belong in Git. Small third-party packages also install from package.json / pnpm-lock.yaml.

## Background receipts

Background receipts use the existing core PostgreSQL/Redis and gateway named volume; no optional profile is required. Gateway startup applies the new migration automatically. Keep existing volumes during upgrades. `OCV_AFTER_RUN_LIMIT=128`, `OCV_AFTER_TABLE_LIMIT=6` and `OCV_AFTER_TABLE_EVERY=5` control retention and bounded table rotation. The observer transmits result digests/size metadata, never raw tool inputs or output text, and does not change the existing output/export. In database-free host development it quietly backs off. See [background route/storage details](AFTER-ROUTES.md) and run `node scripts/verify-after.mjs` against a running core when checking this feature.

## On-demand branches

For optional on-demand language/database/message branches, start core, then run `pnpm civilization:after` in a separate terminal (Node 24 + trusted Docker CLI access required). Services are queued and run in bounded batches, then containers started by the dispatcher stop; named volumes persist. Existing tool results remain available immediately. Default job admission budget is 6144 MiB, constrained by Docker memory minus 1536 MiB reserve; smaller hosts can lower `OCV_RUNNER_BUDGET_MIB` and may skip heavy branches. An 8 GiB-or-larger host is recommended for the complete catalogue/cold builds. The dispatcher creates a private worker key in ignored `.env`; never publish it. Request graceful stop with `pnpm civilization:after --stop`. `node scripts/after-runner.mjs` is the pnpm-free equivalent. See [branch catalogue, ownership, retention and operational details](AFTER-ROUTES.md#optional-on-demand-dispatcher). This host process is optional; the public default remains core.

## Signals laboratory

The numeric Vue filename in the project root controls the shared job tier. The included `128.vue` is the highest tier: at most 128 active jobs, with no queued-job count limit. Rename it to a number from `1.vue` to `128.vue`; `32.vue`, for example, permits 32 active jobs and 2,048 queued jobs. Lower tiers allow `N*64` queued jobs. Keep exactly one such file. Its tank-game component is independent and dormant: neither the website nor the scheduler imports it, and the scheduler reads only the filename. Legacy empty numeric files without an extension remain supported. The gateway reads the root through a private read-only mount; this directory is not a public file server. Gateway and dispatcher notice renames automatically. Lowering the tier lets current jobs finish before further admission. Queued work expires after 24 hours by default (`OCV_AFTER_QUEUE_TTL_SECONDS`). If the marker is absent, `OCV_RUNNER_CONCURRENCY` and `OCV_AFTER_QUEUE_LIMIT` are fallback settings; queue limit `0` disables only the count limit.

This is a job ceiling, not a promise of 128 simultaneous native computations. Optional services are shared, reference counted, and bounded by their actual CPU, memory and process limits. The dispatcher derives native execution slots from those limits and protects large-result reads separately. A stronger host can raise `OCV_RUNNER_BUDGET_MIB`, `OCV_SIGNALS_NATIVE_MEM`/`CPU`/`PIDS` and `OCV_MECHANICS_NATIVE_MEM`/`CPU`/`PIDS`; changing the numeric filename does not allocate more RAM by itself. Default local resource caps remain small.

An optional `OCV_RUNNER_MAX_CONCURRENCY` ceiling can reduce active dispatch independently of the numeric filename. It defaults to 128 and remains subject to actual service resource limits.

Open `/signals/` through the underlined **通信实验** link in the homepage recommendations, global search, or selected maze pages. The Angular workbench includes editable packet-network topologies, circuit schematics and a BPSK/CRC laboratory. Browser calculations use the included, original C++/Rust WebAssembly engines; neither a native compiler nor optional server services are needed for these calculations. Plot and project downloads retain the settings used for their result.

The workbench also inspects individual packet hops, directional link utilization and queue wait, and measures circuit traces from their recorded samples. Optional RF parameters produce a free-space line-of-sight budget through the same Rust engine. For its physical inputs, measurement definitions and exclusions, see [the numerical model documentation](../pinia/receipt2/README.md). The RF result does not change the waveform's configured Eb/N0 until explicitly applied. Network coordinates remain drawing coordinates.

Normal Run/Simulate buttons start browser computation and enqueue a matching background calculation. The browser result remains visible; **查看复核结果** selects the cached native result only when clicked. Circuit transient and AC runs use finer numerical sampling in the background within existing solver limits; DC, packet events and the seeded communication realization retain their original model. Project storage and background runs require core PostgreSQL and the host dispatcher:

```sh
docker compose up -d --wait
pnpm civilization:after
```

Keep the second command running in a terminal on the Docker host. It uses the existing private worker lease and task queue, starts only the current preparation/calculation/analysis batch, and stops containers it started when that batch finishes. Java writes a preparation receipt; Go records a checksum manifest; native C++/Rust computes; Python independently checks the output and persists a bounded audit. PostgreSQL remains the source of truth for projects and jobs. No Docker socket is exposed to the browser or gateway, and browser input cannot choose shell commands.

`pnpm civilization:circuits -- --reuse-images` is an optional manual warm-up of laboratory services, including core; it does not replace the dispatcher. Default Compose startup still selects core only. Limits are configurable, and an over-budget maximum selection is rejected rather than silently increasing RAM. Stop the dispatcher with `node scripts/after-runner.mjs --stop`; this preserves named volumes. A stopped dispatcher leaves new jobs queued; browser calculations remain available. Projects are bounded to 128 inactive heads and eight ordinary revisions per project, with queued and active snapshots protected until their jobs end. Completed-job retention defaults to `max(128, tier * 4)`, or 512 at the highest tier; `OCV_AFTER_TERMINAL_LIMIT` overrides it within 32–10,000 records. Older terminal results expire when this retention bound is reached.

The network model uses seeded loss, shortest-delay routes and independent FIFO link directions with serialization and propagation delay. It is an educational packet model, not a full 5G, satellite PHY or hardware emulator. The circuit engine supports R/C/L, independent sources and ideal switches with DC, AC and backward-Euler transient analysis. Unsupported devices produce diagnostics.

Optional engine rebuild: `pnpm signals:engines` uses bounded Docker builds and publishes the three first-party engine files plus their runtime notices. Ordinary `pnpm build` validates their source/artifact hashes and uses the already included binaries. This optional rebuild needs registry access and more disk space; it is not an installation prerequisite. Linked Wasm runtime licenses are available at `/signals/engines/NOTICE.txt`; the Go PostgreSQL driver notice is retained in `docs/licenses/lib-pq-1.10.9.txt` and its container image.

## 机械工坊

Open `/workshop/` through **机械工坊** in the **Games (游戏)** category, global search, or the maze pages `/maze/table/`, `/maze/offices/settings/` and `/maze/route/a/b/c/d/e/`. This page retains the site's header and uses a C#/Blazor editor, Rust/Rapier 2D simulation, reusable Vue components and Svelte replay. The optional 3D view changes appearance only. Normal Run and parameter experiments compute locally while submitting a matching native job. **查看复核结果** stays disabled until the current job's reviewed result is cached; completion never switches the display automatically. Click the enabled button to display that cache. Initial examples run locally. Browser computation remains available when the dispatcher is stopped.

Saved project revisions and native parameter experiments use the existing PostgreSQL snapshots, private worker lease and bounded dispatcher. For these operations, run core and `pnpm civilization:after` as described above. The mechanical batch starts C# model preparation, the fixed Rust executable, and C# result review separately. Native requests reduce the integration step without going below 1/240 s and retain at most 4,800 steps and 256 frames; exported requests describe the actual numerical settings. Both paths support the same features. The original numerical result is stored and read back from PostgreSQL before review. Leave the dispatcher running on the Docker host. Independent engineering jobs share the queue and services within the selected capacity and resource limits. At a bounded tier, a full queue returns 429 while browser computation continues.

Workshop polling reads once per second for the first 120 attempts, then every 15 seconds, with a seven-day absolute waiting limit. Temporary read failures retry after 15 seconds while the result button stays disabled; cancellation remains available for an unfinished job. Editing, rerunning or leaving the page invalidates the old display request. A reviewed result is cached before the button becomes enabled, and is displayed only on click. Expired or trimmed records show an expiry status. The browser waiting limit does not extend the default 24-hour queue TTL or completed-result retention.

Ordinary `pnpm build` validates the included browser runtime and source hashes. The optional `pnpm workshop:engines` rebuilds the workbench and Rust engine through sequential Docker builds with a 3 GiB builder cap; it needs registry access and free Docker disk space. `docker compose --profile mechanics build dotnet mechanics-native` builds the optional server workers. Numerical limits are documented in [the mechanical model](../pinia/folder2/README.md). Runtime notices are retained at `/workshop/engines/NOTICE.txt` and `docs/licenses/workshop-runtime/`.

This is a bounded planar model with ideal transmissions, not a full CAD, finite-element or 3D rigid-body solver. Rollback appends a revision while preserving retained snapshots. Local modules stay in the current browser unless explicitly exported or saved to the server.

## License and contact

Original code: **MIT — Copyright (c) 2026 cabal312512**; see [LICENSE](../LICENSE). Third-party code, fonts, music and other assets retain their own terms. MIT does not relicense them. Required notices: [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt), [EFFECT-SOURCES.md](EFFECT-SOURCES.md), generated `/licenses/bundled-notices.txt`.

Media: [MEDIA_NOTICE.md](../MEDIA_NOTICE.md) / `/legal/`. Research music: **Holizna — Retro Wave Collection**, [OpenGameArt](https://opengameart.org/content/retro-wave-collection), CC0. Existing author/source credits remain. Contact: **user31436@proton.me**.

Author-only prompts and handoffs stay locally and are excluded from the current public source and new releases. [Source-publication policy](../config/source-publication.json) declares them. Scientific sources/results and original seals remain; the scientific publication subset declares its exclusions separately.

Optional music/certificate/projection/index workers use the same dispatcher. See [SITE-SERVICES.md](SITE-SERVICES.md) for resource caps, first-use builds and bounded storage.
