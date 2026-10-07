# Contributing to Bemmoly

Bemmoly is an open source (MIT), self-hosted, AI-first platform for issues and docs: your work,
your platform.
This file is the contract for anyone changing the repository, whether a person or an AI agent.
It is deliberately specific. When it conflicts with a tool's default behaviour, this file wins.

Read first:

- `docs/tech-design.html`: the architecture. Decisions there are settled unless an ADR changes them.
- `docs/design/mocks/`: fourteen product screens. They are the pixel source of truth.
- `docs/plan/foundation.md`: what the first release (0.1.0) contains and how the work is split.
- `docs/adr/`: one record per decision that changed after the tech design.

## 1. Repository layout

```
apps/server       host process: boots the kernel, loads enabled modules, serves the web build
apps/web          React + Vite shell; loads one chunk per enabled module
apps/site         marketing and docs site (Astro); not in the app image
packages/core     the kernel: identity, authz, settings, notifications, email, storage, search,
                  jobs, realtime, AI runtime, entities and links, audit, system, module registry
packages/core-web kernel UI: shell, settings frame, inbox, ⌘K, module chunk loader
packages/shared   zod schemas, API types, enums, capability names, error codes, LQL parser
packages/ui       design tokens, theme presets, components, Storybook
packages/editor   Tiptap schema and base nodes
packages/api-client  typed client generated from the OpenAPI document
modules/<id>      one installable module per folder: changelog/, server/, web/, shared/, module.ts
deploy/           installer, compose, updater, bemmoly CLI, helm, terraform, air-gap bundle
docs/             design, tech design, plans, ADRs
```

Every backend package (the kernel and each module's `server/`) has the same shape:
`routes/ controllers/ services/ clients/ models/ middlewares/ config/ utils/`, with the
schema changelog as a sibling folder, never inside `src/`.

## 2. Engineering rules

These are the rules the linter and reviewers enforce. The reasoning is in the tech design.

**Layering.** Routes name a controller and nothing else. Controllers validate input with a zod
schema from `packages/shared`, call one service function and shape the response. Business
logic lives only in `services/`. Models are schema only. Dependencies point one way:
routes → controllers → services → clients and models. A service never imports a route or a
controller.

**Modules.** A module imports `@bemmoly/core` and nothing under `modules/`. Cross-module
behaviour goes through kernel registries and events. The kernel never imports a module.
Inside the kernel, each service folder exposes `index.ts`; other files are private.

**Size.** No file over 300 lines. The linter fails the build. Split by responsibility.

**Validation.** zod 4, everywhere, once. Services take typed, validated arguments, never a
request body or an untyped object.

**Errors.** Services throw typed errors from `packages/shared` (`NotFoundError`,
`ForbiddenError`, `ValidationError`, `ConflictError`, `RateLimitedError`, `ProviderError`).
One error handler maps them to HTTP. Controllers never write status codes by hand. Never
swallow an exception to keep a request green.

**Pluggable capabilities.** Where a capability has more than one implementation (email sender,
object store, importer, SSO provider, workflow rule, automation action, editor node, theme
preset) use interface + factory + one file per implementation. Adding one is one file plus one
registry line plus config. Vendor shapes never leak past the implementation boundary.

**AI.** Exactly one integration: the AI SDK, imported only inside `packages/core/src/services/ai/runtime`.
Providers, their packages, credential forms and models come from the models.dev catalog at
runtime. No file in the repository names a vendor.

**External calls.** Through `clients/`, with an explicit timeout on every call. No raw `fetch`
in a service.

**Security.** Every endpoint is authenticated except health checks and endpoints documented at
the route as anonymous by design. Authorization is checked in the service, with
`authorize(actor, capability, resource)`, after module access. Secrets live in env or in
settings encrypted with the install's secret key, never in source or in client payloads.
Webhooks verify signatures before parsing. Rate limits are always on.

**Data.** Postgres only. Database `bemmoly_db`; tables snake_case plural; columns snake_case;
primary keys UUIDv7 with `uuidv7()` as the default. Every schema change is a changeset in the
owning package's `changelog/` folder: stable id, author, description, optional preconditions,
`up`, and `down` where the change is reversible. Changesets must stay compatible with the
previous minor release (add now, remove later). Indexes ship in the same changeset as the table.

**Configuration.** Env is parsed once with zod in `config/env.ts` and the process fails fast
on a bad key. No `process.env` reads anywhere else. `.env.example` is updated in the same
change as any new key. No environment-name branching in business logic.

**Logging.** pino, structured, request id on every line, redaction configured once. No
`console.log` in committed code. Log at boundaries, not line by line.

**Background work.** Anything slow or external is a pg-boss job with an idempotency key. Job
handlers are thin and call services.

**API.** Resources are plural nouns under `/api/v1`; methods are the verbs; one level of
nesting; query params filter, sort and paginate (keyset); `POST …/:id/<verb>` only when there
is no noun. `201` on create, `204` on delete. Error body `{ code, message, details?, requestId }`.

**Frontend.** Hooks own logic, components stay presentational, files under 300 lines. Server
state in TanStack Query; client state in Zustand; never copy one into the other. All HTTP
through `packages/api-client`. Tokens from `packages/ui` are the only source of colour,
spacing, radius, type and shadow; never a literal colour in a component. One accent is
reserved for AI-produced content and nothing else.

**Design fidelity.** Build from the mock's markup and measurements. Never approximate a
spacing, an icon or a colour. Shared components are reused, never redrawn in a page. New UI is
verified in a running browser against the mock before it is called done, with a screenshot in
the PR beside the mock. The theme is settled; proposals to change it go through an ADR, not a PR.

**Comments.** Explain why, never what. No ticket or issue numbers in source. No commented-out
code. Removing the old path is part of shipping the new one.

## 3. Branches

- `main` is protected: no direct pushes, CI green and one approving review to merge.
- Work on short-lived branches named `<type>/<short-kebab-summary>`, for example
  `feat/changelog-runner`, `fix/invite-expiry`, `docs/adr-updater`, `chore/node-24`.
- Rebase on `main` before opening or updating a pull request. Do not merge `main` into a branch.
- Delete the branch after merge.

## 4. Commits

Commit messages follow Conventional Commits, written in the imperative present tense.

```
<type>(<scope>): <subject>

<body: what changed and why, wrapped at 72 columns>
```

- `type` is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
  `revert`. A breaking change adds `!` after the scope and a `BREAKING CHANGE:` paragraph.
- `scope` is a package, module or area: `core`, `web`, `ui`, `shared`, `work`, `docs`,
  `deploy`, `cli`, `updater`, `changelog`, `ai`, `release`. Omit it only for repository-wide changes.
- `subject` is lowercase, no trailing period, at most 72 characters, and reads as a command:
  "add changelog runner", not "added" or "adds".
- The body explains the reason and any consequence. Reference issues as `Closes #123` in the
  body, never in the subject, and never in source code.
- One author per commit. Do not add `Co-Authored-By`, `Signed-off-by`, generated-by or any other
  attribution trailer. Authorship is the commit author field.
- Milestone or sprint names never appear in commits, tags or versions.
- Keep commits atomic: one logical change that builds and passes tests on its own.

Examples:

```
feat(changelog): run changesets per module under an advisory lock
fix(web): keep the theme switcher in sync after a workspace preset change
docs(adr): record the decision to use the models.dev catalog
build(deploy): pin the Postgres image to pgvector pg18
```

## 5. Pull requests

- Open a draft early. Keep it small; under roughly 400 changed lines is the target. Split
  larger work into a sequence of PRs that each leave `main` working.
- Title follows the commit format and becomes the squash commit. The description says what
  changed, why, how it was tested, and for UI includes a screenshot beside the mock.
- Required before review: the required status checks green (listed in `.github/CI.md`:
  typecheck, lint, unit and integration tests among them); `.env.example`
  current; changesets written for any schema change; a release note entry (section 6) for
  user-visible changes; docs updated where behaviour changed.
- One approving review from a code owner of the touched folder. Authors do not merge their own
  non-trivial PRs. Reviews name the rule they are applying.
- Squash merge. The PR title and description become the commit message, so write them to the
  commit standard above.
- No long-lived feature branches. Behind-a-flag or module-disabled is how unfinished work lands.

## 6. Versioning and releases

- Semantic Versioning. Before 1.0, a minor version adds features and a patch fixes bugs; a
  minor may change behaviour and says so in its notes. From 1.0, the usual rules.
- The first release is `0.1.0`. Versions are plain numbers; no milestone names, no suffixes
  other than `-beta.N` on the beta channel.
- Release notes are assembled from `.changeset/` entries (the `changesets` tool). A
  user-visible PR adds one entry stating the change in plain language, the version bump it
  needs, and any configuration or schema change an admin should know about.
- A release is one tag `vX.Y.Z` that produces, together: the application image
  `ghcr.io/<org>/bemmoly:X.Y.Z`, the updater image, the Helm chart, the air-gap bundle, the
  installer, and notes that list schema changesets (flagging any that are slow or irreversible)
  and configuration changes.
- Channels: `stable` and `beta`. The in-app updater follows the workspace's channel.
- Compatibility: every release must run against the previous minor's database and tolerate
  the previous minor's clients, so updates and rollbacks are safe within one minor.
- Security fixes are released as patches on the current minor and announced per `SECURITY.md`.

## 7. Tests and definition of done

A change is done when: typecheck, lint and build are clean; the service boots; unit tests cover
the service logic; integration tests run against real Postgres for anything touching the
database, queue, realtime or search; Playwright covers any new user flow; new UI is verified in
a browser against the mock; changesets are written and applied; `.env.example` is current; no
secrets are in the diff; and the standards above hold for every touched file.

Tests run with Vitest. Integration tests use Testcontainers Postgres and never mock the
database. AI code is tested against a recorded provider; live evals run nightly.

## 8. Security

Report vulnerabilities privately as described in `SECURITY.md`. Never open a public issue for a
security bug. Dependencies are pinned by lockfile. The dependency audit (`pnpm audit`, failing on
high), the Semgrep rules, secret scanning and image scanning run in CI and block merges.

## 9. Working as an AI agent in this repository

- Read the relevant part of the tech design and the mock before writing code. Do not invent
  behaviour the design does not describe; if the design is silent, choose the simplest option
  and note it in the PR.
- Stay inside the folders your task owns. If you need an interface another stream owns, add or
  change it in `packages/shared` or `packages/core` contracts and say so in the PR; do not edit
  the other stream's implementation.
- Run the checks before you report done. Report test output faithfully; a red test is reported
  as red.
- Verify UI in a running browser. Reading the code that renders a screen is not verification.
- Never commit secrets, never weaken a lint rule to get green, never raise the 300-line limit.
- Commit and PR exactly as sections 4 and 5 describe. No attribution trailers.
