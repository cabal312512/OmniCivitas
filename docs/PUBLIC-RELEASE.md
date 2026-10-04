# Public release portability audit

Publication update — 5 October 2026: [GitHub repository](https://github.com/cabal312512/OmniCivitas) and [v0.1.2 release](https://github.com/cabal312512/OmniCivitas/releases/tag/v0.1.2) are now published. Deployment is English by default, with a Chinese alternative. Twelve author-only inputs/handoffs remain intact locally and are excluded from the current public index; the paper PDF remains excluded. The original scientific seals and ledgers are unchanged. Remote Windows/Linux/macOS workspace checks and Linux Cypress passed; release packaging also passed. See github-publication.json for exact runs, downloaded ZIP verification and retained historical limits. The audit below is its earlier dated snapshot.

2026-10-04 · Phase 9 · Completed within the recorded platform scope.

Standard public entry points are independent of the original Windows drive layout. A fresh Windows clone and a fresh Linux container environment actually installed, built and started the application. A separate Compose project with new named volumes verified the default six-service deployment and real PostgreSQL/Redis persistence. No GitHub repository was published by this audit.

## Standard entry points

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
docker compose up --build -d --wait
```

Node 24.14.1, pnpm 10.34.6 and Compose v2 are the tested versions. `pnpm dev` does not require Docker or optional infrastructure. Without a database URL, it explicitly uses bounded memory storage; this is useful for ordinary tools and is not presented as proof of database execution. Docker core uses real PostgreSQL and Redis. See the root README for configuration, optional profiles and test commands.

## Twelve user requirements

The original `public-release-requirements.json` remains byte-for-byte intact. Current dispositions are also recorded individually in `phase9-final-audit.json`.

| ID | Result and evidence |
| --- | --- |
| P01 | Public application/configuration/startup paths do not prescribe a host drive or username. Tracked-file scanning plus manual classification distinguishes container paths, historical source/documents and optional local helpers. |
| P02 | Runtime storage uses named volumes. Docker's physical storage disk is outside application configuration. Actual isolated core deployment created its own project-prefixed volumes. |
| P03 | Default bind mounts are repository-relative, read-only configuration. Machine-specific `compose.local.yaml` is ignored and must be passed explicitly. |
| P04 | Default npm/pnpm/Nx configuration no longer requires local cache variables. Fresh stores installed dependencies with zero reused packages. The original wrapper still redirects actual local work to its approved dependency disk. |
| P05 | Standard install/build/dev and unprofiled Compose startup were executed. Public commands do not invoke the original PowerShell wrapper. |
| P06 | Published ports, addresses, credentials, container caps and heaps have environment overrides. Clean deployment used a different port and database user/database. Optional MinIO worked with changed credentials. Database initialization changes require a new volume or explicit database administration. |
| P07 | Only `.env.example` is supplied. The actual staged source snapshot was checked for dependency/cache directories, private keys and token patterns, environment/data files and large files. No matching secrets or forbidden runtime files were found. This is a scoped scan, not a universal secret detector. |
| P08 | All 24 services and selective profiles remain. Six unprofiled core services are the default. The maximum controller enforces a configurable aggregate container budget; Windows WSL settings remain local. |
| P09 | Source/startup support ordinary Windows/Linux/macOS toolchains. Actual Windows host and Linux container userspace tests passed. A separate Linux Engine host and a macOS host were unavailable; host-specific execution remains unverified. CI is configured for all three systems but was not remotely run. |
| P10 | Changes concern deployment, public commands, finite failure handling, license delivery and acceptance. Original visual layers, dormant versions and frozen research remain. |
| P11 | This dedicated audit covers paths, host/ports, volumes, environment, secret patterns, tracked files and clean installation/startup. Each kind of evidence is distinguished below. |
| P12 | Public startup and imports do not require the developer's disk layout or physical RAM size. Resource defaults are small and configurable. |

## Actual clean-environment evidence

| Environment | Executed | Limits |
| --- | --- | --- |
| Fresh Windows Git clone | Empty store; standard frozen-lockfile install; five sequential build targets; standard dev without local guard/cache variables; tool/validation/fictional-account paths; memory storage and real WebSocket upgrade | Same physical Windows/Docker machine, separate clone/tool/cache environment. Clean full unit run had one cold math import timeout; its timeout was increased and the affected 17-test group passed. This is not one full Windows passing run. |
| Fresh Linux container | Empty store; standard install/build; one full 299-test Vitest run, six Node tests and three Jest tests; standard dev and real HTTP/WebSocket requests | Linux userspace under this Windows Docker engine. Dev requests were exercised inside the container because dev binds loopback. Not proof of a separate Linux Engine host or externally published dev port. |
| Isolated Compose project | Clean-clone context, bounded sequential builder; no-profile `docker compose up -d --wait`; exactly six healthy core; new volumes and changed database/port settings; 13 real storage/TTL/AOF/restart/limit checks | Base images could be cached. Fresh application/dependency/data deployment does not mean every registry byte was redownloaded. |
| Optional storage boundary | Explicit Hono/MinIO startup, changed credentials, actual object read, chunked oversized request rejected with HTTP 413 | Optional services stopped after the batch. |
| Current deployed production | Four focused browser cases passed together; 20 original license resources matched exact bytes; generated license inventories delivered; six core healthy; builder stopped | Focused boundary suite, not a rerun of all historical browser/game tests. |

Temporary clones, tools, logs and runtime data were stored under the original machine's approved dependency directory. That location is not a dependency of public commands. The main project was not initialized or pushed as a GitHub repository; an independent temporary Git snapshot inspected the actual tracked-file set.

## Runtime sizes and service selection

| Profile selection, including core | Sum of container memory caps |
| --- | ---: |
| core | 1728 MiB |
| databases | 2944 MiB |
| legacy | 3616 MiB |
| messaging | 3968 MiB |
| monitoring | 2240 MiB |
| search | 3008 MiB |
| maximum / everything | 7840 MiB |

These are enforced caps, not total host RAM measurements or promises of equal usage. OS, Docker, cache and builds also consume memory. The original machine retains its daily 9 GiB WSL cap and optional 11 GiB maximum setting. The 3 GiB builder runs while optional services are stopped and is stopped afterward. All 24 services were actually healthy during the bounded maximum batch; the resting state is only core. Smaller machines should use separate profile sessions. Direct Compose commands keep previously started containers until explicitly stopped.

Elasticsearch, Kafka and Java have small development heaps; important containers have memory/swap/CPU/PID limits and bounded logs. Container DNS is independent of disks and published ports. Edge Nginx resolves changing service addresses through Docker DNS and preserves external hosts/ports in slash redirects. Installed Nginx 1.30.5 passed syntax/reload and actual 8080/custom-Host redirect checks. [Nginx documents dynamic upstream resolution](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve) in open-source versions from 1.27.3 onward.

## Files, licenses and remaining limits

Generated typing files, caches, dependencies, builds, local overrides and runtime data are ignored. Frozen scientific `.log` files are deliberately retained as research artifacts; they are not live application logs. Git checkout preserves source bytes through `.gitattributes`, including sealed research. Public research downloads are regenerated from those sources.

`LICENSE` covers original code under MIT. Notices for actually emitted third-party code are retained with distributed bundles; see `PHASE-9-LICENSES.md`. The unified media statement and music author credits remain. Third-party media permission is not inferred from MIT.

Platform and game limitations are recorded in `PHASE-9-ACCEPTANCE.md`. No remote CI run, GitHub publication, research experiment or new PDF is claimed. Local raw evidence: `F:\OCVdeps\runtime\reports\phase9-*`. Report paths are documentation, not public runtime settings.
