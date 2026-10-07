# Foundation release (0.1.0): plan

Companion to `docs/tech-design.html` (v0.10). The foundation release builds the kernel, the shell, the design
system and the install/update/backup path. It ships no Work or Docs features on purpose: every
later release is built on, and verified through, what it produces.

## What you will be able to do with 0.1.0

On your laptop:

1. `git clone`, `pnpm i`, `pnpm dev`. Postgres 18 starts in Docker, the changelog runs with the
   `demo` context, server and web start with hot reload, the browser opens on the setup wizard.
2. Complete the six-step wizard: health checks, first admin, import (stub), people (invite by
   email, delivered to the dev mailbox page), AI provider (catalog picker and connection form,
   live from models.dev with the bundled fallback; no AI features yet), theme, summary.
3. Log in, switch between the eight theme presets and a custom brand colour, light and dark.
4. Use Settings: People (users, invites, teams), Roles and permissions (capability matrix with
   org locks), Modules (enable and disable a sample module, watch nav and changelog react),
   Appearance, Email (SMTP form, test send), Storage and backups (run one, see it verified),
   Updates (version, channel, release notes), System (health, queue, last backup, AI spend
   placeholder), Audit log.
5. Receive an in-app notification and the matching email, live over the WebSocket.
6. Press ⌘K and search users and settings pages.

On a VM (Multipass, OrbStack, Lima or a real EC2):

7. `curl -fsSL <installer> | sh` brings up Postgres 18 (pgvector), Lattice, Caddy and the
   updater, prints the URL, and the wizard appears over HTTPS.
8. `lattice status | doctor | logs | backup | backups list | restore | db status | db validate |
   db plan | db history | upgrade | rollback` all work. Upgrade and rollback are demonstrated
   between two local image tags, including the pre-upgrade backup and the automatic rollback
   on a failed health check. The in-app Update button runs the same flow.

Quality bar, also part of the output: CI green (typecheck, lint with the layering and file-size
rules, unit, integration against real Postgres, Playwright for wizard and login, size budget),
Storybook showing every component next to its mock, ADR-0001, CONTRIBUTING, SECURITY.md.

Not in 0.1.0: issues, boards, docs, AI generation, importers, SSO, integrations. The module system
is proven with a throwaway `sample` module that registers a route, a nav entry, a capability, a
job and a changeset.

## Order of work

### W0 Skeleton (sequential, one agent, first)

Everything else depends on this landing first.

- pnpm workspaces + Turborepo; TypeScript 7 strict, ESM; Node 24 pinned in `.nvmrc` and `engines`.
- ESLint with: 300-line limit, import boundaries (modules import only `@lattice/core`; services
  never import routes or controllers; kernel service folders expose `index.ts` only), Prettier.
- Vitest, Testcontainers Postgres helper, Playwright config, size-limit, GitHub Actions workflow.
- `packages/shared` (zod 4 schemas, error codes, capability enum, module ids).
- `packages/core` skeleton with the module contract (`contract.ts`), registry, loader and the
  changelog runner interfaces, `config/env.ts` with zod and fail-fast.
- `apps/server` host: Fastify 5 app factory, pino, request id, the one error handler, `/healthz`,
  `/readyz`, static serving of the web build.
- `apps/web` Vite 8 + React 19 shell booting from `GET /api/v1/modules`.
- `packages/ui` with the design tokens extracted from the mocks (Classic plus the eight presets)
  and Tailwind 4 consuming them.
- `docker-compose.dev.yml` with `pgvector/pgvector:pg18`; `pnpm dev` script; `.env.example`.
- Interfaces every workstream codes against, written as TypeScript in `packages/core`:
  `LatticeModule`, `ModuleContext` registries, `EmailSender`, `ObjectStore`, `EventBus`,
  `authorize()`, `settings.get/set`, `realtime.publish`, `Changeset`.

### Parallel workstreams (one agent each, own worktree, own folders)

| Stream | Owns | Delivers |
|---|---|---|
| A. Data kernel | `packages/core/src/services/{changelog,modules,settings,realtime,jobs,storage}`, `packages/core/changelog`, `models/` | Changelog runner (changesets, checksums, preconditions, contexts, `down`, advisory lock, per-module tracking, `lattice db` CLI), module loader and migrator, Drizzle schema for kernel tables, settings with AES-256-GCM secrets, pg-boss setup, NOTIFY hub and WebSocket endpoint, disk ObjectStore, `sample` module |
| B. Identity and access | `packages/core/src/services/{identity,authz,audit}` and their routes and controllers | Users, argon2id passwords, sessions, invitations, API tokens, teams, roles, capability matrix with org locks, `module_grants`, `authorize()`, rate limiting backed by Postgres, audit log, CSRF and headers |
| C. Email and notifications | `packages/core/src/services/{email,notifications}` | `EmailSender` with `smtp` and `log`, outbox worker, react-email templates themed from workspace brand, dev mailbox page, SMTP test, digest batching, inbox tables, realtime push, preferences |
| D. Design system | `packages/ui` | Every component the 0.1.0 screens need, ported from mock markup: button, input, select, badge, status badge, avatar, table, modal, drawer, dropdown, tabs, toast, tooltip, empty state, command palette shell, theme switcher, custom theme builder (brand colour to full token set with contrast check). Storybook with mock-side-by-side stories |
| E. Web shell and settings | `apps/web`, `packages/core-web` | TanStack Router, Query, Zustand, generated API client, auth pages, six-step setup wizard, top nav, settings frame and every 0.1.0 settings page, inbox, ⌘K over users and settings, module chunk loader, PWA manifest |
| F. Deploy and operations | `deploy/`, `packages/core/src/services/system` | Multi-stage Dockerfile (Node 24, Postgres 18 client tools), Compose with Caddy and updater, the updater service (update, rollback, status over the internal network with a token), `install.sh` with `--modules` and `--no-in-app-updates`, `lattice` CLI, backups (dump, incremental attachments, manifest, encryption, GFS retention, verification), restore, release manifest and update check, Updates and Storage pages' API |
| G. Observability and quality | `.github/`, `docs/adr`, root docs, `packages/core/src/config/logger.ts`, metrics | Logger redaction, Prometheus metrics, optional OTel, CI gates wired to real checks, nightly install test workflow (fresh VM, installer, wizard via API, upgrade, restore), devcontainer, CONTRIBUTING, SECURITY.md, LICENSE, ADR-0001 from the tech design |

Rules for the streams: match the mocks pixel for pixel and verify in a running browser; follow
`engineering-standards`; no file over 300 lines; no cross-stream edits (open an interface
change request in the shared package instead); every schema change is a changeset; every
PR green before merge.

### Integration

After the streams land: wire the wizard to real services end to end, run the Playwright suite,
build the image, run the installer on a fresh VM, demonstrate upgrade and rollback, then tag
`v0.1.0`.

## Decisions taken for 0.1.0

- Node 24 LTS now; move to 26 when it enters LTS.
- Drizzle ORM 1.0 release candidate, pinned; revisit when 1.0 is on the `latest` tag.
- The updater is a small Node service using the Docker Engine API over the socket, kept in this
  repository so there is one language and one review process.
- Licence MIT, copyright "Lattice contributors".
