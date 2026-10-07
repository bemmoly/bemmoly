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
running (Docker, OrbStack or Colima), waits for it to be healthy, writes `apps/server/.env` on the
first run, and starts the server and the web shell with hot reload. Open http://localhost:5173.

## Before you open a pull request

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm test:integration   # real Postgres through Testcontainers
pnpm build && pnpm size && pnpm test:e2e
pnpm changeset          # for any user-visible change
```

- Architecture: [docs/tech-design.html](docs/tech-design.html). Decisions that change it are
  recorded in [docs/adr](docs/adr).
- Pixel source of truth: [docs/design/mocks](docs/design/mocks).
- Commits follow Conventional Commits with one author and no attribution trailers (AGENTS.md,
  section 4).
- Security issues go to the private address in [SECURITY.md](SECURITY.md), never to a public
  issue.
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
