# Optional website workers

The existing piano, matrix/base/JSON/CSV tools, favorites/character events and
global search use four optional services. Normal successful tool runs, music
sequence playback and stored favorites/character events automatically take their
backend paths. Result buttons open completed records. Offline audio processing
and the arrow-selected advanced search are explicit extensions. Immediate
browser results remain available. The default deployment still runs six core
services; these workers have no public ports and require no additional public
account endpoints.

| Service | Actual responsibility | Default cap |
| --- | --- | --- |
| site-audio | C++ tone/filter/echo/mix, Rust WAV/MIDI byte checks | 256 MiB |
| site-projection | Elixir/Phoenix/OTP event folding and dialogue recovery | 256 MiB |
| site-certificate | Haskell/Servant exact or structural tool certificates | 256 MiB |
| site-index | Kotlin/Ktor feature ranking and SQLite/FTS5 navigation index | 384 MiB |

Use the existing deployment instructions to start core. Set a private
`OCV_RUNNER_KEY` in the ignored `.env`, then run `pnpm civilization:after` on
the Docker host. Keep one dispatcher for a deployment. It uses the existing
PostgreSQL lease, queue, numeric capacity filename and CPU/RAM admission rules.
Do not expose the runner key or Docker API to browsers. Cold workers are built
serially on first use; a first result can exceed the page's finite waiting period.
Retry explicitly after the image is ready. For predictable first-use latency,
prebuild the four services serially without starting them:

```sh
docker compose --profile site-services build site-audio
docker compose --profile site-services build site-projection
docker compose --profile site-services build site-certificate
docker compose --profile site-services build site-index
```

Deployments use configurable tools or PATH as described in PORTABILITY.md.
Service memory/CPU overrides are in `.env.example`; changing 128.vue does not
raise container resource caps.
All four workers plus default core have 2880 MiB of configured container caps;
this is neither measured RAM consumption nor a promise to fit a 1 GiB machine.

PostgreSQL remains authoritative for existing progress/favorites/profile labels.
Projection events/checkpoints are isolated derived data. Exact event replay is
bounded by the retained window; old missing history is reported explicitly.
The index stores only public catalogue data. Queries/results live temporarily
in memory, and PostgreSQL retains only bounded execution metadata/digests.
Advanced search keeps its query out of the page URL and sends no HTTP referrer
on its website-worker requests; ordinary search retains its existing URL behavior.

Music processing uses stored anonymous note scores, up to 18 seconds before
finite echoes (20 seconds output), with at most 256 notes. Processing does not
change local recordings; high/low parts can be exported in separate requests.
Certificates cover the existing small matrix/base operations and at most 64 KiB
per format input, subject to the total request limit. A certificate does not
replace the original result. Optional failures keep original playback, results
and exports available.

Generated music is checked by a separate Rust process, read back from bounded
gateway storage, and downloaded with the job capability. Sixty-four inactive
receipts/files and a 24-hour receipt window are retained; active work is protected.
Projection keeps at most 2048 event records and 128 checkpoints with a seven-day
window. Queries expire after finite waiting/result windows and are lost on restart.
Never interpret an in-memory fallback as PostgreSQL or SQLite execution evidence.

For a running real deployment, `node scripts/verify-site-services.mjs` runs a
serial, bounded integration batch using actual configured PostgreSQL and gateway
addresses. It writes evidence to the configured runtime report directory and
prints no capabilities. Native module fixtures are described in their protocols.
Do not run production fixtures during a busy deployment without choosing an
appropriate test window. Run the one-worker desktop consumer batch with
`pnpm exec playwright test --config tests/phase13.playwright.config.mjs`.
