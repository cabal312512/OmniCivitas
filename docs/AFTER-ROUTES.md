# Background receipt processing

2026-10-05 maintenance, authorized after the nine completed website phases. This does not start a tenth phase or extend the frozen research project.

Existing interfaces, result rendering and exports remain unchanged. Ordinary pages now have a noncritical background observer, plus a small draggable/closable progress box only when an optional job is queued. It sends only anonymous event metadata: feature identifier, random per-page session/event IDs, result SHA-256, byte count and character count. Input/output text, files, passwords, accounts, query strings and IP addresses are not sent by this observer. Research/identity pages and the 3D game are excluded.

## Actual route

1. A tool-success event, export, ordinary route entry or one of the existing window buttons schedules a small receipt. The browser serializes work, limits the queue to three entries, spaces events and stops on page exit.
2. NestJS validates the exact seven fields. PostgreSQL and Redis must both be real and available; this route never claims memory fallback as persistence. Failure does not affect the pre-existing local tool result.
3. Redis maintains a shared expiring event ordinal and minute admission counters. The session is reduced to one of 64 rate buckets; there is also a global limit. No unbounded per-user key collection is created.
4. PostgreSQL allocates a shared click count and chooses one of three functions stored as source text in `ocv_after.code_bank`. Even the lookup joins that table to itself.
5. The backend checks the selected source against its compiled-in approved program and SHA-256, writes an exclusive UUID-named `.mjs` file, and actually invokes it in a separate Node process. Its environment excludes application/database secrets. Heap, wall time, input/output and filesystem permissions are bounded. Generated code is **trusted and fixed**; there is no public upload/edit/eval endpoint. Node's permission model is additional hardening, not a malicious-code sandbox. See [Node's permission documentation](https://nodejs.org/api/permissions.html).
6. The program computes a checksum ledger, distribution bins or a fourteen-office itinerary from the metadata. PostgreSQL stores fourteen ordered stamps, a feature counter/residue and a durable receipt. Redis supplies another ordinal that intentionally need not match PostgreSQL's counter after failures.
7. Source, structured execution log and result are mixed into one byte package, then cut into **three byte fragments**. Only fragment 1 goes to browser IndexedDB. Fragment 2 is a backend `.part` file in the existing gateway named volume. Fragment 3 lives in PostgreSQL.
8. Every third successful browser receipt, and every accepted export receipt, reads the actual browser fragment back from IndexedDB and requests reconstruction. A separate random capability ticket, stored only as its hash on the server, gates retrieval. The backend combines the browser/file/database fragments and verifies each checksum and the package digest.
9. Every five accepted background events, shared across users, PostgreSQL genuinely creates **two small tables** in `ocv_after_pockets`, each with three digest-fold rows. The oldest tables are dropped once the six-table cap is exceeded. No client-supplied SQL or identifier is interpolated.
10. Cleanup removes old receipts and their dependent steps, old feature entries, backend fragments and browser fragments. Shared advisory locking covers execution, commit and filesystem cleanup, so one process cannot delete another's live generated file. Locks are explicitly released before returning the pooled connection; see [PostgreSQL advisory locks](https://www.postgresql.org/docs/17/functions-admin.html).

The temporary tables and their registry intentionally have a different lifetime from receipt rows. The durable view `ocv_after.receipts` reconstructs stamp counts by joining runs to their steps; this is used during fragment recovery.

## Bounds

| Resource | Default / hard range |
| --- | --- |
| Active requests | At most 2 per gateway; one accepted generator holds the shared DB lock |
| Generated child | 32 MiB V8 heap, 1500 ms wall timeout; one generated program at a time |
| Program / result / mixed package | 8192 / 4096 / 12288 bytes |
| Receipt rows / backend fragments | 128 retained; configurable 4–256; up to two owned transient files |
| Stamps | 14 per retained receipt; cascading cleanup |
| Dynamic tables | 6 retained; configurable 2–8; two created per cadence |
| Table cadence | Every 5 accepted events; configurable 2–50 |
| Dynamic table rows | Exactly 3 per table |
| Feature rows | At most 128; older entries removed |
| Browser fragments | At most 32, with a 192 KiB retained-record budget |
| Redis admission | 120/minute globally; 24/minute per one-of-64 anonymous bucket |
| Redis rate-key lifetime | 70 seconds; shared ordinal expires after one day |
| Browser failure behavior | Clear pending queue, back off for 60 seconds; no retry loop |

Resource caps bound retained application data, not PostgreSQL's physical high-water storage: repeated row deletion leaves reusable space, and repeated DDL can require routine PostgreSQL maintenance. A high-traffic public server should reduce cadence/rate, monitor disk and run normal database maintenance. The global cadence and rate guard prevent each browser from spawning its own unlimited set of tables.

## Files and deployment

* `services/gateway/src/a1/core.ts`: receipt validation, approved function sources, child execution and byte fragments.
* `services/gateway/src/a1/service.ts`: PostgreSQL/Redis route, stamps, table rotation, recovery and retention.
* `services/gateway/src/main.ts`: two additional POST endpoints: `/api/a1/receipt.cgi`, `/api/a1/recover.cgi/:id`.
* `services/gateway/prisma/migrations/20261005010000_a1/migration.sql`: isolated application schemas/tables/view. Existing schemas and scientific data are untouched.
* `config/apps/portal/src/q7/b.mjs`: invisible observer and bounded IndexedDB fragments.
* `config/apps/portal/src/q7/1.astro`: one extra script import; existing markup remains unchanged.
* `tests/after-core.test.mjs`: focused validation, exact Unicode reconstruction, real file execution and unapproved-source rejection.
* `scripts/verify-after.mjs`: brief real-HTTP smoke verification, including actual table creation and cross-store reconstruction.

Docker's existing gateway startup runs `prisma migrate deploy` before starting NestJS, so fresh and upgraded Compose installations apply the new migration. Existing database volumes must be retained. No new service, dependency, host port or public absolute path is introduced. The default six core services suffice. Optional profiles remain optional.

`.env.example` and Compose expose `OCV_AFTER_RUN_LIMIT`, `OCV_AFTER_TABLE_LIMIT`, `OCV_AFTER_TABLE_EVERY`. Backend files default below `OCV_LOG_DIR`, already `/ocv-data` in the named gateway volume. `OCV_AFTER_DIR` can override runtime placement where needed; it must be writable, private, and not a source directory. Windows helpers continue placing runtime data under the local dependency root.

For standard host development without PostgreSQL/Redis, the observer quietly backs off and tools still run. If using a database with host `pnpm dev`, explicitly apply the migration before testing background persistence. Do not return generated receipts as if they were the tool's exported result; the existing output/export stays authoritative.

`window.__ocvAfter` is a browser debugging status object, not an account. Inspect it alongside IndexedDB `ocv-parts-v1` and backend/database storage when verifying real use. It intentionally contains no raw input/output or capability tickets.

## Optional on-demand dispatcher

The default six core containers still suffice. For the extra branches, run a **trusted host process** with Node 24 and Docker CLI access, alongside a running core:

```sh
pnpm civilization:after
# In another terminal, request graceful shutdown:
pnpm civilization:after --stop
# A finite integration demonstration, instead of the long-running dispatcher:
pnpm civilization:after --tour
```

Direct `node scripts/after-runner.mjs` also works, including on a VPS without pnpm installed. Keep it in a terminal or a supervised service with the repository as working directory. Run only one dispatcher per Compose project. Do not run a tour beside it. The process generates a private 256-bit worker key, retains it in its private runtime directory and adds only `OCV_RUNNER_KEY` to ignored `.env` if absent; preserve other settings. Docker Compose then recreates only gateway to receive that key. Never expose this key or commit `.env`. A loopback entrance is mandatory for the privileged dispatcher; `OCV_BASE_URL`/`OCV_WEB_PORT` select that entrance, not the public HTTPS hostname. No Docker socket is mounted in the application containers.

Accepted tool/export receipts select a family from `services/gateway/src/a1/catalog.json`. Twelve specific tools have explicit mappings; other tools hash to one of the same families. Their normal results are immediate; the optional work runs separately. A progress box appears for a queued job, can be moved/closed, and polls at most 120 times before disappearing. Closing it or leaving the page does not cancel the shared backend job. Research and game pages remain excluded.

| Family / example tool | Real branch and storage |
| --- | --- |
| Relay / JSON | Spring Boot JPA → PostgreSQL; FastAPI SQLAlchemy → three SQLite files; Laravel Eloquent → MySQL; NestJS terminal. Three sequential batches share a root ID |
| gRPC / JSON Patch | Java → Python gRPC stamp → SQLite |
| Analysis / CSV | Python parses CSV/JSON/YAML → DuckDB query |
| Go / calculator | Fiber route returns a tax receipt |
| SOAP / XML | ASP.NET emits a SOAP XML envelope, decoded by the host runner |
| Ruby / regular expressions | Sinatra returns JSON containing another JSON document |
| Object / Markdown | Hono GraphQL lookup → MinIO PUT/GET of a fixed small object |
| Mongo / SQLite tool | Metadata upsert, real readback and oldest-document cleanup |
| Search / hashing | Elasticsearch indexes digest metadata, searches, reads it back and removes old documents |
| Messages / Base64 | Prisma/TypeORM/PostgreSQL → confirmed RabbitMQ publish → bridge → Kafka → Mongoose/MongoDB + Redis; verifies the same digest arrived |
| Monitoring / pipeline | Gateway emits actual OTel spans; collector logs must contain this exact trace ID; Prometheus query and Grafana's 48-panel dashboard are read |
| Next / UUID | Next API forwards a receipt to Prisma and TypeORM, both using PostgreSQL |

This catalogue covers all 18 optional Compose services, in addition to the six core containers. It does not claim every installed dependency or historical dormant component has new runtime coverage. Existing language/backend implementations are reused rather than bypassed by simulated responses.

### Scheduling and bounds

PostgreSQL holds a durable job queue: **4 pending jobs globally**, at most one pending job per family, and **32 terminal records**. The dispatcher holds a renewable 60-second database lease; only one optional batch runs at a time. Pending jobs older than 25 minutes expire; active jobs abandoned by an old lease become failed. Public status requires the receipt's private capability; worker operations require the separate secret header. There is no public arbitrary command/service/code parameter.

Each step starts only the selected services and their dependencies. Missing images are pulled/built only for that step; builds use a checked **3 GiB** builder, sequentially, which is stopped afterward. On the original Windows environment the F: Docker disk guard runs before every pull/build. Named volumes survive stopping; a subsequent task reuses data. The dispatcher stops **only container IDs it started**, and never shuts down a pre-existing user service. Recorded IDs allow cleanup after an interrupted dispatcher acquires the next database lease.

`OCV_RUNNER_BUDGET_MIB=6144` bounds the sum of configured caps for running project containers, selected dependencies and a cold builder when present. Other capped running containers also count; an uncapped foreign container blocks a batch. The ceiling is additionally constrained by Docker's memory total minus **1536 MiB** reserve. Container limits/heaps/log limits in Compose still apply. This is a admission budget, not a measurement or promise of total Windows/WSL memory usage. The original WSL ceiling stays 9 GiB; no maximum profile is activated. Use a smaller budget on smaller machines; some heavy branches then fail with a recorded reason and leave the original tool usable. An 8 GiB-or-larger Docker host is recommended for the complete catalogue, especially cold builds.

Worker reports retain 64 completed and 64 failed summaries; its log is limited to 1 MiB. Runtime state uses `OCV_DEPS_ROOT` when provided, otherwise the user's private state directory; it is never source material. Mongo's added collection and Elasticsearch's added index retain 64 documents each. The object branch overwrites one fixed object. Existing Java/SQLite/MySQL/ORM/message tables keep their prior 256-row/TTL/queue limits; no uncapped new log/table-per-job collection is introduced.

Additional files: `services/gateway/src/a1/jobs.ts`, `services/gateway/src/a1/catalog.json`, migration `20261005020000_a2`, and `scripts/after-runner.mjs`. The dispatcher is opt-in on other deployments: `docker compose up` still starts only core. The original author's machine may keep this host process running; that does not make its disk layout a deployment requirement.

The owner explicitly requested a GitHub push on 2026-10-05 after local acceptance. The acceptance report's `githubUpdated: false` records the earlier local-only snapshot. The original VPS ZIP remains the earlier snapshot; the separate `OmniCivitas-VPS-2026-10-05-backend.zip` includes this maintenance and an exact package-only source-tree manifest. Use that newer bundle when deploying these additions; its source snapshot precedes subsequent remote documentation edits.
