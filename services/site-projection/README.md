# WEB2 site projection

This optional Phoenix/OTP service derives anonymous site history and finite character dialogue. Existing q8 PostgreSQL progress and favorites remain the only authority. The caller reads that state before requesting a projection, then stores the returned checkpoint only in an isolated projection record. No database or account routes are mounted here. Neither engineering projects nor game saves enter this service.

## Protocol

`POST /stock.php`, JSON, body at most 196,608 bytes:

```json
{
  "schema": "ocv.site-projection/1",
  "session": "00000000-0000-4000-8000-000000000013",
  "snapshot": {"mask": 7, "favorites": [{"id": "json", "folder": "默认"}], "nickname": "路人"},
  "events": [{"id": "00000000-0000-4000-8000-000000000001", "seq": 1, "kind": "collect", "data": {"slot": 0}}],
  "message": "where"
}
```

Allowed event data is closed:

| kind | data |
| --- | --- |
| collect | `{"slot":0}`; slot 0 through 29 |
| favorite | `{"id":"json","folder":"默认","action":"add"}`; action add/remove/move |
| talk | `{"message":"hello"}`; hello/where/again/bye |
| achievement | `{"code":"hunt-30"}`; hunt-30/favorite-first/visitor-return |

`events` may be empty. A top-level `message` selects a response without counting a talk; a talk event records its idempotent history. With no message, the newest accepted talk is restored. Nicknames and folder labels are bounded inert labels; address/password/phone fields, arbitrary dialogue text and unknown keys are rejected before actor creation. The caller must send only the validated anonymous nickname already used by the site. No password-shaped input is forwarded here.

The output contains schema/session, mask/count/favorites copied from the supplied snapshot, talks, dialogue, checkpoint, deduplicated, sequence, history and SHA-256 digest. Event collect/favorite/achievement data changes history only. Even a recovered collect history cannot replace a smaller authoritative mask or reintroduce deleted favorites. `status=complete` means processing finished; `sequence.status=incomplete` separately identifies missing or expired sequence history.

For recovery send `"prior":{"checkpoint":previousResponse.checkpoint}`. Checkpoints bind to their anonymous session and contain a versioned CSV cell holding a JSON string containing canonical JSON. Recovery validates every layer and its checksum. That checksum detects corruption; it is not a credential. A live actor keeps the newer revision when the caller supplies an older checkpoint. The caller persists completed projection checkpoints serially per session, avoiding competing stale writes. Actor loss or service restart recovers from that externally stored checkpoint; otherwise the response reports only its bounded current history. Memory is never PostgreSQL evidence.

Each checkpoint retains 256 `[sequence,UUID,eventDigest]` rows within its most recent 256 sequence numbers, 16 chronological talk records, 16 chronological favorite records and three fixed achievement codes. Counters and sequences are capped at 1,000,000,000. A sequence at/below the retention floor is explicitly expired, cannot increment counters and cannot claim full replay completeness. Conflicting UUID/sequence reuse rejects the whole batch. Late missing events reorder retained talk/favorite history by real sequence. Exact-once replay applies within the retained window; older history is represented by aggregates and an explicit floor.

The optional response `notification` supplies a signed 10-minute ticket and `stock:<session>` topic. A Phoenix v2 client connects at `/linen/websocket?vsn=2.0.0&token=...`, joins that topic with an empty payload, and receives `projection` notices. Channels accept no mutations. Four subscribers per session, 64 HTTP/websocket connections, a small per-actor queue, bounded notification queues and expiry stop subscriptions. This route remains internal unless a later authorized integration deliberately exposes it. Ordinary page loading should not start this service.

## Integration and verification batch

Implementation status is **runtime and consumer verified within the documented limits**. The guarded serial build produced image `sha256:7a246a96ea05a7a74d519712d48f2533352bcd147706af4ed4ebe660fdffba88`. Twelve actual ExUnit checks passed, followed by real Phoenix HTTP readiness, reversed/repeated events, stop/start checkpoint recovery, smaller supplied snapshot preservation and a two-session capacity limit (the third session returned HTTP 429). The native maximum-counter checkpoint crosscheck measured 38,316 CSV bytes and 42,638 JSON-envelope bytes for 256 retained identifiers. Original notices for sixteen resolved packages were read in the runtime. Evidence is `phase13-projection-runtime.json` and `phase13-projection-tests.log` in the configured external report directory. This isolated service batch did not exercise PostgreSQL or the ordinary page consumer; the root dispatcher owns those separate proofs.

Use a root-context Docker build only after the existing Docker-storage guard verifies the actual disk. Compose keeps this out of core, with port 4013 reachable only on the private Compose network and no published host port. It uses a 256 MiB memory/0.5 CPU cap and bounded rotated logs, and the existing dispatcher stops only services it started. A measured cap may be adjusted by the existing resource allocator. The Dockerfile fixes two ordinary schedulers and small async/dirty scheduler pools. All downloads/build caches are `/ocv-cache` on the verified container disk. No bind mount of dependencies into the source tree is needed. Runtime uses non-root `ocv` and `mix run --no-compile --no-deps-check --no-halt`, so the normal service supports a read-only filesystem, 32 MiB `/tmp`, PID 64, dropped capabilities and no-new-privileges. `GET /ready` and `/health` both return HTTP 200 with `status=ready`; neither response claims a database was exercised.

For an already installed Windows toolchain, run through the existing environment entry:

```powershell
. .\scripts\Enter-OcvEnvironment.ps1
. .\services\site-projection\enter.ps1
Push-Location .\services\site-projection
$env:MIX_ENV = 'test'
mix deps.get
mix compile --warnings-as-errors
mix test
Pop-Location
```

The helper places Mix/Hex/dependencies/builds under the configured dependency root; on this machine it must be the configured external runtime directory. A dependency fetch creates the real `mix.lock` in the service source directory. Keep that generated lock as a source deliverable after the authorized batch; do not invent transitive lock entries. In the image the generated lock is `/work/services/site-projection/mix.lock`; copy that file back to `services/site-projection/mix.lock` from a stopped temporary container. To run the twelve checks in the built image, override `MIX_ENV=test`, `OCV_PROJECTION_SERVER=false` and run `mix test --warnings-as-errors --seed 0`. The verification container needs its ordinary writable layer because it compiles the test configuration; the production service remains read-only. Do not run a second simultaneous build.

After unit/runtime checks, post `fixtures/reversed.json` over actual HTTP. It should return mask 7, count 3, talk count 1, one duplicate, collect history [0,2], no sequence gaps. Store the checkpoint in the isolated PG projection record, stop/start the service, resend it in `prior`, and verify four duplicates and unchanged talk history/digest. Then supply mask 1/favorites [] and verify those authoritative values survive replay. Root evidence must separately show its real PG read/write; this service's in-memory result is not a substitute. Reuse the existing character/favorite UI for an explicit interaction and render only its short reply/progress.

The meaningful ExUnit cases cover reversed/repeated events, snapshot reconciliation, late gaps, dialogue recovery, conflicting events, corrupt/cross-session checkpoints, expired replay, privacy rejection, OTP process loss/TTL, actual Endpoint/controller routing and a real Phoenix Channel notice/read-only boundary. A root-only extra capacity check can start with `OCV_PROJECTION_SESSIONS=2` and verify a third new session returns HTTP 429. Mark each actual proof independently in the phase report; file presence is not verification.

## Dependency sources

Original copyright and license texts for all sixteen resolved Hex packages are linked in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The [notice manifest](notices/manifest.json) records exact package versions, primary metadata URLs and verified archive SHA-256 values; the original telemetry NOTICE and Castore README copyright section are retained too.

Exact direct pins were checked against primary package records: [Phoenix 1.7.24](https://hex.pm/packages/phoenix/1.7.24), [plug_cowboy 2.8.1](https://hex.pm/packages/plug_cowboy/2.8.1), [Jason 1.4.4](https://hex.pm/packages/jason/1.4.4). Phoenix 1.7.24 is the 1.7 branch maintenance release selected here. The earlier 1.7.23 and plug_cowboy 2.7.3 package pages flagged advisories and were not selected. Phoenix is MIT; Cowboy adapter and Jason are Apache-2.0; Cowboy and cowlib are ISC. Retain transitive notices from the packages actually fetched in the authorized build.

The first real dependency resolution selected Cowboy 2.20.0/cowlib 2.21.0 and flagged EEF-CVE-2026-43966 and EEF-CVE-2026-43969. Live [Hex package metadata](https://hex.pm/api/packages/cowlib) shows 2.21.0 as the latest stable cowlib; the [EEF response-header advisory](https://cna.erlef.org/osv/EEF-CVE-2026-43966.json) and [EEF cookie-encoder advisory](https://cna.erlef.org/osv/EEF-CVE-2026-43969.json) list no published fixed SEMVER release. These versions are now explicitly pinned, retaining the warning. The service explicitly selects Cowboy's `invalid_response_headers: :error_terminate`, the server mitigation described by EEF for Cowboy 2.16+. Its response headers are application constants, and it has no outbound HTTP/cookie encoder. This is a bounded service mitigation, not a claim that cowlib is patched. The [Cowboy dependency metadata](https://hex.pm/api/packages/cowboy/releases/2.20.0) requires cowlib >=2.21.0; overriding an older library would break that compatibility contract.

The first fetch timed out before compilation; that failed build log remains separate evidence. Fetching now uses one Hex request at a time with a 120-second request timeout. Hex/Rebar setup, dependency fetching and compilation are separate build layers; a BuildKit cache mount retains Hex tarballs across failed fetch retries on the verified Docker disk. No automatic infinite retry loop is added.

The actual endpoint and supervision boundary follows [Phoenix.Endpoint documentation](https://phoenix.hexdocs.pm/1.7.21/Phoenix.Endpoint.html), and the actor lifecycle follows the standard [Elixir GenServer behaviour](https://elixir.hexdocs.pm/GenServer.html). The build base is the [official Elixir image](https://hub.docker.com/_/elixir), fixed to `1.17.3-otp-27-alpine`; its selected image and actual native runtime were confirmed in the guarded serial build described above. This source uses no release/publication tooling.

The active file/AR map is `role-map.json`; mapped arrangements execute in the real projection path. It records the isolated native evidence separately from the later gateway/PostgreSQL/page consumer proofs. Normal successful collect/favorite/talk writes schedule projection automatically; ordinary loading does not. If a direct first visit has no hunt identity, favorites use the existing anonymous desk/profile identity; an already-present hunt identity takes precedence.

The existing gateway/worker/PostgreSQL integration and actual collect/favorite/dialogue consumers were verified in the separate deployment batch (`phase13-integration.json` and the three projection UI reports). Automatic writes use the real anonymous identities; a direct tool visit does not require first visiting the hunt page. Native-only reports remain separate, and retained-history/high-concurrency/independent-host limits still apply.
