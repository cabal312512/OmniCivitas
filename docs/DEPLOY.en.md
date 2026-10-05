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

All 24 services remain in [compose.yaml](../compose.yaml). Core needs no profile. Select optional groups when needed.

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

The helper uses one 768 MiB test container at a time and downloads SDKs only when selected. Earlier audits exercised a clean Windows clone, Linux container userspace and isolated six-service deployment with new volumes. Remote Actions passed installation, ledger checks, all five build targets, 299 Vitest tests, six Node tests and three Jest tests on each of Windows, Linux and macOS. The Linux browser job passed two Cypress cases. Evidence is recorded in [publication status](github-publication.json). Independent Linux Engine/macOS Docker host deployments remain unverified. [The portability audit](PUBLIC-RELEASE.md) preserves earlier evidence and its scope.

`ocv.ps1` and `scripts/Enter-OcvEnvironment.ps1` are optional helpers for the original machine. Other users run standard commands. Dependencies, tools, caches, build output, real environment files, tokens, certificates, runtime databases, Docker volumes and WSL disks do not belong in Git. Small third-party packages also install from package.json / pnpm-lock.yaml.

## Background receipts

Background receipts use the existing core PostgreSQL/Redis and gateway named volume; no optional profile is required. Gateway startup applies the new migration automatically. Keep existing volumes during upgrades. `OCV_AFTER_RUN_LIMIT=128`, `OCV_AFTER_TABLE_LIMIT=6` and `OCV_AFTER_TABLE_EVERY=5` control retention and bounded table rotation. The observer transmits result digests/size metadata, never raw tool inputs or output text, and does not change the existing output/export. In database-free host development it quietly backs off. See [background route/storage details](AFTER-ROUTES.md) and run `node scripts/verify-after.mjs` against a running core when checking this feature.

## On-demand branches

For optional on-demand language/database/message branches, start core, then run `pnpm civilization:after` in a separate terminal (Node 24 + trusted Docker CLI access required). Services are queued and run in bounded batches, then containers started by the dispatcher stop; named volumes persist. Existing tool results remain available immediately. Default job admission budget is 6144 MiB, constrained by Docker memory minus 1536 MiB reserve; smaller hosts can lower `OCV_RUNNER_BUDGET_MIB` and may skip heavy branches. An 8 GiB-or-larger host is recommended for the complete catalogue/cold builds. The dispatcher creates a private worker key in ignored `.env`; never publish it. Request graceful stop with `pnpm civilization:after --stop`. `node scripts/after-runner.mjs` is the pnpm-free equivalent. See [branch catalogue, ownership, retention and operational details](AFTER-ROUTES.md#optional-on-demand-dispatcher). This host process is optional; the public default remains core.

## License and contact

Original code: **MIT — Copyright (c) 2026 cabal312512**; see [LICENSE](../LICENSE). Third-party code, fonts, music and other assets retain their own terms. MIT does not relicense them. Required notices: [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt), [EFFECT-SOURCES.md](EFFECT-SOURCES.md), generated `/licenses/bundled-notices.txt`.

Media: [MEDIA_NOTICE.md](../MEDIA_NOTICE.md) / `/legal/`. Research music: **Holizna — Retro Wave Collection**, [OpenGameArt](https://opengameart.org/content/retro-wave-collection), CC0. Existing author/source credits remain. Contact: **user31436@proton.me**.

Author-only prompts and handoffs stay locally and are excluded from the current public source and new releases. [Source-publication policy](../config/source-publication.json) declares them. Scientific sources/results and original seals remain; the scientific publication subset declares its exclusions separately.
