# Contributing to Bemmoly

Thank you for helping. The contributor contract is [AGENTS.md](AGENTS.md); it applies to every
change, whether a person or an AI agent writes it. Read it before your first pull request.

## Start in ten minutes

```sh
nvm use            # Node 24, from .nvmrc
corepack enable    # or install pnpm 11
pnpm i
pnpm dev           # Postgres in Docker, server on :8080, web on :5173
```

`pnpm dev` starts `pgvector/pgvector:pg18` with `docker-compose.dev.yml` when a Docker daemon is
running (Docker, OrbStack or Colima) and nothing already answers on port 5432, waits for it to be
healthy, writes `apps/server/.env` on the first run, and starts the server and the web shell
with hot reload. Open http://localhost:5173.

### Devcontainer and Codespaces

Open the repository in a devcontainer (or a Codespace) and everything above is ready: Node 24,
pnpm, Docker, and Postgres 18 on `localhost:5432` with a separate `bemmoly_test` database that
`pnpm test:integration` uses. Run `pnpm dev` as usual.

## Before you open a pull request

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm test:integration   # real Postgres through Testcontainers
pnpm build && pnpm size && pnpm test:e2e
pnpm changeset          # for any user-visible change
```

CI runs the same commands plus Lighthouse budgets, Semgrep, secret scanning, a dependency audit
and an image scan. [.github/CI.md](.github/CI.md) lists every check, the ones branch protection
requires, and how to run each locally (Semgrep and gitleaks run from their Docker images).

- Architecture: [docs/tech-design.html](docs/tech-design.html). Decisions that change it are
  recorded in [docs/adr](docs/adr).
- Pixel source of truth: [docs/design/mocks](docs/design/mocks).
- Commits follow Conventional Commits with one author and no attribution trailers (AGENTS.md,
  section 4).
- Security issues go to the private address in [SECURITY.md](SECURITY.md), never to a public
  issue.
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Release notes

Release notes are assembled from `.changeset/` entries. Write the entry for an admin reading the
Update dialog: what changed, in plain language, and anything they must do. The release tooling
adds the rest itself: it lists new schema changesets from the `changelog/` folders (flagging the
ones marked `slow` or `irreversible`, or that run a backfill) and the keys added to or removed
from `apps/server/.env.example`.

## Tests that guard the budgets

- List and board endpoints declare how many queries they may run, with `expectMaxQueries`
  from `@bemmoly/core/testing`; the test fails on an N+1.
- Unexpected errors must reach the person with a reference: every error body carries
  `requestId`, and the web app renders errors through `toErrorSurface` from `@bemmoly/shared`.

## Observability while you work

- Logs: `LOG_FORMAT=pretty` (set by `pnpm dev`) for a terminal, `json` everywhere else. Log with
  `request.log` at boundaries; never log a raw user id, a token or content people wrote.
- Metrics: set `BEMMOLY_METRICS_TOKEN` and scrape `http://localhost:8080/metrics` with
  `Authorization: Bearer <token>`. Kernel services report through `getMetrics()` from
  `@bemmoly/core/telemetry`.
- Traces: set `OTEL_EXPORTER_OTLP_ENDPOINT` to a local collector. Without it, tracing is off and
  nothing is loaded.

## Issues and labels

Bug reports and feature requests use the issue forms. `good first issue` and `help wanted` are
curated by maintainers, never applied automatically. Labels are defined in
`.github/labels.json`; change them there, not in the GitHub UI.
