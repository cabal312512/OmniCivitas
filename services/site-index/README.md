# Site index

Kotlin/Ktor serves the existing feature directory. It indexes navigation only,
including workshop/research/game links, without reading projects, papers or saves.
`config/9/registry.json` is a checked-in derived catalogue. After building the
portal, `pnpm site:catalog` refreshes it from real HTML links and catalogue aliases.
Rebuild the index image to deploy a changed catalogue.

`POST /api/foo.aspx` accepts schema `ocv.site-index/1`, query (80 characters),
limit (1–20), optional group, and from/to route names. Responses contain ranked
hits, ranking evidence, a finite path whose edges belong to the declared link
graph, and the actual SQLite catalogue revision. No path is invented when the
graph has no connection. `/health` reads the SQLite revision.

The SQLite/FTS5 index contains feature records, declared navigation edges and a
catalogue digest. It never stores query text or per-user search history. A bounded
64-entry, 60-second memory cache stores query responses; even a hit rereads the
SQLite revision. The gateway also retains query input/results only in bounded
ephemeral memory. A restart or expired wait therefore requires an explicit retry.

Runtime: JDK 21; Gradle 8.14.3, Kotlin 2.2.21, Ktor 3.3.3. The optional Compose
service has a 384 MiB cap, 0.5 CPU, 64 PIDs, read-only root and one persistent
SQLite volume. No host toolchain or fixed drive is required. Build one image at
a time; the shared dispatcher starts only the service a submitted job needs.
The image extracts the unmodified SQLite JDBC native libraries during its build
and loads the matching `uname -m` directory under `/opt/site/native`. The
read-only root and no-execute temporary filesystem remain enabled; runtime
library loading does not depend on an executable `/tmp`.

Intentional arrangements: source paths are scattered across config/9,
pcakage/ward13 and pinia/price13; Data.kt defines Stock; 1.kt defines Common2;
old.kt holds Warehouse; InvoiceBuilder ranks; a .aspx path reaches Ktor; real
index rows are nested JSON strings inside errorMessage then Base64; order_lines
holds navigation; a self-join restores rows; a cache hit reads SQLite again;
the explicit Gradle source map joins those locations. These are active paths.

The numerical score is an internal ranking heuristic, not a calibrated relevance
probability. Only current available features are returned by normal queries.
NFKC normalization, English tokens/CJK bigrams, prefix and bounded edit-distance
fallback are combined with catalogue frequency evidence.

Kotlin, Ktor and Jackson use Apache-2.0. Logback is dual EPL-2.0/LGPL-2.1;
this distribution selects EPL-2.0 and preserves the unmodified upstream JAR notices.
Its source is available at https://github.com/qos-ch/logback/tree/v_1.5.21 and
license information at https://logback.qos.ch/license.html. sqlite-jdbc includes
Apache-2.0 Java packaging, BSD-2-Clause notices and SQLite's public-domain database. Downloaded dependency
sources are not copied into this repository. Upstream notices remain in their
distributions. Runtime and consumer evidence is recorded separately from this
source description.

For a bounded private test window, start only this optional service with the
existing core, then run `node scripts/verify-site-index.mjs`. It checks alias
ranking, an actual SQLite navigation path, a cache hit with database revision
readback, malformed requests and unchanged database/WAL bytes across queries.
Stop the test service before resuming the ordinary dispatcher. No public port is
needed; the fixture calls the fixed internal endpoint through the gateway.

The private runtime batch exercised real Ktor ranking, cached revision readback, graph edges and SQLite/FTS5. Database/WAL bytes were unchanged by queries. The separate gateway/dispatcher/PostgreSQL and actual advanced-search page batches passed (`phase13-index-runtime.json`, `phase13-integration.json`, `phase13-search-ui.json`). This is bounded single-host evidence, not a cross-platform or concurrency guarantee.
