# Portable tools and local overrides

The public project uses Node 24.14.1, pnpm 10.34.6 and, for container services, Docker with Compose v2. No particular drive, account name, WSL configuration or author-owned file is required. Follow [the deployment guide](DEPLOY.en.md) for installation and service profiles.

`pnpm dev` and `pnpm civilization:dev` start the same development entrance. `pnpm civilization:serve` serves existing build outputs. Both routes include the portal, Next application and gateway. Run `pnpm build` before serving. `pnpm civilization:docker` checks the Docker engine; on Windows/macOS it can open an installed Docker Desktop application. On Linux, start Docker using the host's service manager. This command never installs Docker or rewrites host settings.

Optional PowerShell commands use tools on PATH:

```powershell
.\ocv.ps1 install --frozen-lockfile
.\ocv.ps1 dev
```

The optional [configuration example](../config/runtime.local.example.json) can be copied to `config/runtime.local.json`. The copy stays private. With no configuration, runtime reports and dispatcher state use `.ocv-runtime/` in the clone. Package installation retains its normal pnpm behavior.

```json
{
  "depsRoot": ".ocv-runtime",
  "storageGuard": false,
  "tools": {}
}
```

`depsRoot` may be relative to the repository or an absolute path chosen by the operator. `tools` accepts `node`, `pnpm`, `docker` and `nginx` as PATH commands or configured executable/script paths. `dockerDesktop` accepts an application file path on Windows, or an application name/path on macOS. Node uses the running executable; pnpm also recognizes the active package manager. Nginx is optional and is not needed by the standard dev/serve entrance. Tool overrides include `OCV_NODE_CLI`, `OCV_PNPM_CLI`, `OCV_DOCKER_CLI`, `OCV_NGINX_CLI` and `OCV_DOCKER_DESKTOP`. `OCV_RUNTIME_CONFIG` selects another local configuration file, and `OCV_DEPS_ROOT` overrides the runtime directory. None of these variables is required.

`storageGuard` is an opt-in local storage check. The PowerShell wrapper translates `storageGuard: true` into `OCV_LOCAL_STORAGE_GUARD=1`; direct pnpm commands only enable the guard when that environment variable is explicitly set. The private configuration must also contain the operator's actual `dockerStorage` policy (data location, swap file and accepted WSL memory limits). Keep it `false` for an ordinary installation. Docker owns the locations of its images and named volumes. Machine storage migrations, downloads and administrator setup are deliberately outside the public command set.

Public port overrides are `OCV_WEB_PORT`, `OCV_PORTAL_PORT`, `OCV_NEXT_PORT` and `OCV_GATEWAY_PORT`; choose distinct available ports. Verification reads the same `.env` settings and accepts `OCV_BASE_URL` / `OCV_GRAFANA_BASE_URL`. Database checks query the actual container settings, rather than prescribing account names. Changes to initialization credentials do not alter existing database accounts.

The numeric Vue filename sets the shared job tier. An optional `OCV_RUNNER_MAX_CONCURRENCY` or private `runnerMaxConcurrency` setting can lower the dispatch ceiling independently of that tier; its default is 128. Container limits and execution bounds still apply. Optional services remain available and start only for their selected profiles or queued work.

## Publication boundary

[The source policy](../config/source-publication.json), `.gitignore`, `.dockerignore` and source archive exclusions retain private configurations, author prompts, internal ledgers and historical acceptance writers on the maintainer's machine. Public build and runtime scripts remain included. Scientific sources, results, figures and original seals remain unchanged; their declared publication subset is separate.

`ledger:sync` is an author-only regeneration operation and is absent from the public package commands. The original generator is retained locally. `pnpm ledger:check` checks local ledgers when available and explicitly reports their omission in a public clone.

Before publication, run:

```sh
node scripts/check-release.mjs --worktree
node scripts/audit-public-files.mjs --worktree
node scripts/check-public-source.mjs
```

For a short local verification, run `node --test tests/portability-runtime.test.mjs tests/portable-verification.mjs tests/publication-boundary.test.mjs`. After building, `node tests/portability-serve.mjs` checks the normal serve entrance with empty runtime configuration and temporary ports, then stops only its own processes. It uses installed tools and build outputs; it is not a fresh-install or container-infrastructure test.

These previews do not run Git or change an index. An actual release runs `node scripts/check-release.mjs` against tracked files and rejects private files that are still tracked. Ignore rules alone cannot remove files committed earlier: remove them from the next public index while retaining local originals, using a normal commit. Previous commits and tags are retained; no history rewrite is required.

Historical records may retain original provenance or container paths. They are not active host dependencies. Containers continue to use their own internal filesystem layout; tests that deliberately check rejection of hardcoded paths retain their fixtures.

Large retained-result checks accept `OCV_SH3_LARGE_JOB` or `OCV_SH4_LARGE_JOB` from the current deployment. Supply an existing completed or failed job with its real receipt data, and make its required adapters available first. These checks do not create or replace service images, automatically start/stop adapters, or rely on a maintainer's job IDs.
