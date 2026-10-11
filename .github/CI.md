# CI, quality gates and releases

How the gates of tech design §22 run on GitHub, what branch protection must require, and the
paths CI expects from `deploy/`. Workflow and job names below are load-bearing: branch
protection matches checks by job name, so renaming a job means updating the settings too.

## Workflows

| Workflow                        | Runs on                                       | Jobs (status check names)                                                                |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ci.yml` (CI)                   | pull requests, merge queue, `main`            | **Fast checks**, **Full checks**, **Work end to end**, **Accessibility (theme)**, **Lighthouse** |
| `security.yml` (Security)       | pull requests, merge queue, `main`, weekly    | **Security scans**, **Image scan**                                                       |
| `release.yml` (Release)         | `main`, `v*` tags                             | Version pull request or tag, Plan the release, Image (app, updater), Publish the release |
| `nightly.yml` (Nightly)         | 02:30 UTC daily, manual                       | Fresh VM install, Load budgets (k6)                                                      |
| `soak.yml` (Soak)               | 03:00 UTC Sundays, manual                     | Soak (k6 and the monitor); 24 h on the `SOAK_RUNNER` self-hosted runner, else 5 h        |
| `ai-evals.yml` (AI evals)       | 03:00 UTC daily, manual                       | Live AI evals (skips without a provider key)                                             |
| `deploy-kits.yml` (Deploy kits) | changes to `deploy/`, 03:30 UTC daily, manual | Helm chart, Terraform modules, Offline install                                           |
| `labels.yml` (Labels)           | changes to `.github/labels.json`              | Sync labels                                                                              |

What each check runs:

- **Fast checks**: `pnpm typecheck`, `pnpm lint` (layering, boundaries, 300-line limit),
  `pnpm format:check`, `pnpm i18n:check` (message catalogs well formed, shipped locales
  complete; see `docs/i18n.md`), `pnpm test`, `pnpm eval` (the AI evals against their recordings, no
  key and no network; see `docs/ai-evals.md`) and actionlint over the workflows. A gate job
  over four parallel jobs: Typecheck; Lint, format, catalogs and workflows; Unit tests; AI evals.
- **Full checks**: integration tests against `pgvector/pgvector:pg18`; the bemmoly command's
  self-update in a throwaway container (`pnpm --filter @bemmoly/deploy test:container`: the
  0.11.0 command refreshed, upgraded, and refusing bad signatures with the real cosign);
  `pnpm build` (server, web shell and Storybook), `pnpm size` (shell under 250 KB gzip),
  Playwright end to end. A gate job over parallel jobs: Integration tests in four shards
  (`pnpm turbo run test:integration -- --shard=i/4`, each package's files split four ways),
  the container test, Build and size budget, and End-to-end tests in three Playwright shards.
  The gates run with `if: always()` and fail unless every job they need succeeded.
- **Work end to end**: the Playwright suite in `apps/e2e` against a real install: the server
  from the checkout on the service Postgres, serving the built web app, with Work and Docs
  enabled for everyone through the CLI and people created through the setup and invitation
  endpoints. It runs the Work and Docs flows, turns Work off and on twice from Settings › Modules, and holds a
  500-issue board to the budgets of tech design §20 (board view p95 under 80 ms; a dropped
  card painted within six frames). The budget numbers are printed in the job log. Its own job,
  so a failure there is not read as a Full checks failure.
- **Accessibility (bemmoly | graphite | sand | pine | contrast)**: one runner per theme runs
  `pnpm --filter @bemmoly/web test:a11y` with `A11Y_THEME` set: every screen through axe with
  every rule on, colour contrast included, light and dark, desktop and 390px, on the dev mock
  backend; the Bemmoly runner also runs the keyboard, focus and semantics checks. Any violation
  fails. See `docs/accessibility-conformance.md`.
- **Lighthouse**: the real server serves the built shell; first contentful paint must stay
  under 1.2 s, cold, on the 4G profile in `tools/lighthouse/lighthouserc.cjs`.
- **Load budgets (k6)**, nightly: the server from `main` and Postgres pinned to two CPUs (the
  reference VM's share) with k6 on the other two, the §20 sample dataset seeded (3 projects,
  5,000 issues, 400 pages, 200 people), then `perf/run-suite.sh`: board view, issue detail,
  ⌘K and search, page open over `/collab`, two people typing, and the mixed workload, each
  held to its §20 budget. The results table and the server's own per-route latency go to the
  job summary; a regression opens an issue. Details in `perf/README.md`.
- **Soak**, weekly: the mixed workload for 24 hours (5 on a hosted runner) while
  `perf/src/soak/monitor.ts` samples memory, heap, connections, queues, p95 per window and
  errors; any verdict that fails opens an issue.
- **Helm chart**, **Terraform modules**, **Offline install** (Deploy kits, not required checks:
  they run only when `deploy/` changes): `helm lint --strict` and `ct lint`, then
  `deploy/tests/helm/kind-install.sh` installs, upgrades and uninstalls the chart on kind;
  `deploy/terraform/check.sh` runs fmt, validate, `terraform test` with mocked providers and
  TFLint; `deploy/tests/airgap/offline-install.sh` installs and upgrades from bundles on a
  machine with `--network none`. All three use the two newest published releases.
- **Security scans**: gitleaks over the tree and the new commits, `pnpm audit --audit-level=high`,
  `semgrep --test` on the custom rules, then a Semgrep scan with them (`tools/semgrep/rules`:
  SQL built from strings, raw `fetch` outside clients, `process.env` outside config, console).
- **Image scan**: builds the application image with the commit's revision and build time,
  fails when its OCI labels are missing or left "unknown" (`deploy/scripts/check-image-labels.sh`),
  and fails on fixable high or critical findings from Trivy. Until `deploy/` adds the
  Dockerfile it passes with a notice.

Caches: the pnpm store (through `actions/setup-node`), the Turborepo cache (`.turbo/cache`,
per job and shard, through the `turbo-cache` input of `.github/actions/setup`), Playwright browsers keyed
by the Playwright version, and Docker layers for images.
Every third-party action is pinned to a commit SHA with the version in a comment; Dependabot
keeps both current.

## Branch protection for `main`

Settings › Rules › Rulesets (or Branches › Branch protection rules) for `main`:

- Require a pull request before merging, with **1 approval** and **review from Code Owners**.
  Dismiss stale approvals when new commits are pushed.
- Require status checks to pass, with branches up to date. Required checks:
  - `Fast checks`
  - `Full checks`
  - `Work end to end`
  - `Lighthouse`
  - `Security scans`
  - `Image scan`
- Require linear history; allow **squash merging** only (AGENTS.md §5).
- Block force pushes and deletions. Do not allow bypass except for repository admins in an
  emergency, and say so in the pull request when it happens.
- Optional: enable the merge queue; every required workflow already listens to `merge_group`.

Skipped steps inside a required job (for example the image scan before a Dockerfile exists)
still report success, so turning protection on early does not block anyone.

CODEOWNERS names the maintainers by GitHub username for every folder. Add a team there only
after it exists under `@bemmoly` with write access; GitHub ignores owners it cannot resolve.

## Paths CI expects from `deploy/`

These are planned paths. Each workflow step that needs one skips with a notice until the
file exists; if a file lands elsewhere, change the path at the top of the workflow (they are
marked `TODO(deploy)`).

| Path                                     | Used by                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `deploy/docker/Dockerfile`               | Image scan, Release (app image)                                                     |
| `deploy/updater/Dockerfile`              | Release (updater image)                                                             |
| `deploy/install.sh`                      | Release asset, Nightly installer test                                               |
| `deploy/compose/docker-compose.yml`      | Release asset                                                                       |
| `deploy/helm/bemmoly/`                   | Release asset (`helm package`)                                                      |
| `deploy/scripts/airgap-bundle.sh`        | Release asset; called as `<script> <version> <output dir>`                          |
| `deploy/scripts/release-cli.sh`          | Release asset `bemmoly-cli-X.Y.Z.tar.gz`, listed in the manifest; the updater image |
| `deploy/scripts/smoke-test.sh`           | Nightly: wizard via API, upgrade, restore; called with `--base-url` and `--version` |
| `deploy/release-manifest.schema.json`    | Release: validates `release-manifest.json`                                          |
| `deploy/tests/helm/kind-install.sh`      | Deploy kits: the chart on kind; called as `<script> <from> <to>`                    |
| `deploy/tests/airgap/offline-install.sh` | Deploy kits: offline install and upgrade; called with two bundle files              |
| `deploy/terraform/check.sh`              | Deploy kits: fmt, validate, test and TFLint                                         |

## Releases

`pnpm changeset` adds an entry for a user-visible change. On `main`, the changesets action
keeps a "version packages" pull request up to date. Merging it bumps every `@bemmoly/*`
package together (one fixed group); the next run tags `vX.Y.Z` and publishes:

- `ghcr.io/bemmoly/bemmoly` and `ghcr.io/bemmoly/updater` for `linux/amd64` and `linux/arm64`,
  tagged `X.Y.Z`, `X.Y` and `latest` (stable) or `X.Y.Z-beta.N` and `beta` (beta channel);
- OCI labels with the version, the full commit SHA as `org.opencontainers.image.revision` and
  the build time as `org.opencontainers.image.created`, checked on every platform before the
  image is signed (a label left "unknown" fails the release);
- a keyless cosign signature and an SPDX SBOM (syft) attested on each image;
- release notes from the changeset entries, listing new schema changesets (flagging slow and
  irreversible ones), configuration keys added or removed, and the rollback mode;
- `release-manifest.json`, signed with `cosign sign-blob`, plus the installer, Compose file,
  Helm chart and air-gap bundle from `deploy/`;
- `bemmoly-cli-X.Y.Z.tar.gz`, the host `bemmoly` command, whose SHA-256 the signed manifest
  lists so `bemmoly self-update` can trust it (ADR 0024).

For the beta channel, enter pre mode (`pnpm changeset pre enter beta`) so versions come out as
`X.Y.Z-beta.N`, or push a `vX.Y.Z-beta.N` tag by hand. The release tooling lives in
`tools/release` and has its own tests.

Verify an image:

```sh
cosign verify ghcr.io/bemmoly/bemmoly:X.Y.Z \
  --certificate-identity-regexp '^https://github.com/bemmoly/bemmoly/.github/workflows/release.yml@' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Running the gates locally

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm i18n:check && pnpm test
pnpm test:integration                       # Testcontainers, or BEMMOLY_TEST_DATABASE_URL
pnpm build && pnpm size && pnpm test:e2e
pnpm test:e2e:work                          # Testcontainers, or BEMMOLY_TEST_DATABASE_URL
pnpm audit --audit-level=high

# Semgrep: rule tests, then the scan CI runs
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.178.0 semgrep --test tools/semgrep/rules
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.178.0 \
  semgrep scan --config tools/semgrep/rules --error .

# Secrets and workflows
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 dir /repo --redact
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12

# Load budgets against a running install: provision, seed, then the suite (perf/README.md)
BASE_URL=… CREDENTIALS=… DATASET=… bash perf/run-suite.sh
```

A Semgrep finding that is a deliberate exception is marked in the code with
`// nosemgrep: <rule-id>` and a comment saying why; reviewers decide whether the reason holds.

## Observability endpoints

- `/metrics` serves Prometheus metrics when `BEMMOLY_METRICS_TOKEN` is set, to scrapers that
  send `Authorization: Bearer <token>`. Without the token it answers 404.
- Traces are exported only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; the server starts with
  `node --import @bemmoly/core/telemetry/preload`, which does nothing otherwise.
