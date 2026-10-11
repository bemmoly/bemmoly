# Contributing to Bemmoly

Thank you for helping. The contributor contract is [AGENTS.md](AGENTS.md); it applies to every
change, whether a person or an AI agent writes it. Read it before your first pull request.

## Find something to work on

- **Good first issues.** [`good first issue`](https://github.com/bemmoly/bemmoly/labels/good%20first%20issue)
  marks small tasks with one obvious place to start; each names the files to read and what
  "done" means. [`help wanted`](https://github.com/bemmoly/bemmoly/labels/help%20wanted) marks
  larger ones the maintainers would welcome help with. Say on the issue that you are taking it,
  so two people do not do the same work.
- **Bugs.** Any open [`bug`](https://github.com/bemmoly/bemmoly/labels/bug) with steps to
  reproduce is fair game. A failing test that reproduces it is a welcome pull request on its own.
- **Docs and the guides.** Typos, unclear steps in the [install guide](https://bemmoly.com/docs/install)
  and missing answers are small, useful first changes.
- **Bigger changes.** Open an issue or a thread in
  [Discussions › Ideas](https://github.com/bemmoly/bemmoly/discussions/categories/ideas) first.
  A change that alters the technical design or the design system needs an ADR, and agreeing on
  the shape before the code saves you a rewrite.

Bemmoly is a young project with a small maintainer team. Reviews usually take a few days; a
small pull request that follows AGENTS.md is reviewed fastest.

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
- How every screen looks and behaves: the design system,
  [docs/design/system](docs/design/system/README.md). The old mocks in `docs/design/mocks` are
  history.
- Commits follow Conventional Commits with one author and no attribution trailers (AGENTS.md,
  section 4).
- Security issues go to GitHub's private vulnerability reporting, as [SECURITY.md](SECURITY.md)
  describes, never to a public issue.
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

Bug reports and feature requests use the issue forms; questions go to
[Discussions › Q&A](https://github.com/bemmoly/bemmoly/discussions/categories/q-a) (see
[SUPPORT.md](SUPPORT.md)). `good first issue` and `help wanted` are curated by maintainers,
never applied automatically: a maintainer files a good first issue with its own form, which
asks for the task, where to start, what "done" means and who can help. Labels are defined in
`.github/labels.json`; change them there, not in the GitHub UI.
