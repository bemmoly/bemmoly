<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./packages/ui/assets/brand/generated/readme-hero-ocean.png">
    <img alt="Bemmoly: Your work. Your platform. Self-hosted issues and docs. Open source, no pricing, nothing to buy. Install with curl -fsSL https://get.bemmoly.com | sh" src="./packages/ui/assets/brand/generated/readme-hero.png" width="100%">
  </picture>
</p>

<p align="center"><strong>Your work. Your platform.</strong></p>

<p align="center">
  <a href="https://bemmoly.com">Website</a> ·
  <a href="https://bemmoly.com/docs/install">Install guide</a> ·
  <a href="https://bemmoly.com/docs">Docs</a> ·
  <a href="https://bemmoly.com/changelog">Changelog</a>
</p>

<p align="center">
  <a href="https://github.com/bemmoly/bemmoly/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/bemmoly/bemmoly/ci.yml?branch=main&label=CI"></a>
  <a href="https://github.com/bemmoly/bemmoly/actions/workflows/security.yml"><img alt="Security" src="https://img.shields.io/github/actions/workflow/status/bemmoly/bemmoly/security.yml?branch=main&label=Security"></a>
  <a href="./LICENSE"><img alt="Licence: MIT" src="https://img.shields.io/badge/licence-MIT-blue"></a>
  <a href="https://github.com/bemmoly/bemmoly/tags"><img alt="Latest release" src="https://img.shields.io/github/v/tag/bemmoly/bemmoly?label=release"></a>
  <a href="https://bemmoly.com/self-hosting"><img alt="Deploy in 5 minutes" src="https://img.shields.io/badge/deploy-in%205%20minutes-blue"></a>
</p>

Bemmoly is open source, self-hosted, AI-first issues and docs for your whole company. Plan
sprints on a board, write the spec next to the issue it explains, and ask questions of
everything your team has written, all in one app that runs on your own server. Your data stays
in your Postgres, behind your login, under your backups.

It is one app image and one Postgres, installed with one command on a $20 server and upgraded
from inside the app. Every module ships in the image; turn on the ones you use. It is MIT
licensed and free forever, with no licence or per-seat fee on top of your server. Imports from
Jira and Confluence (from 0.5) bring your existing projects and pages with you.

## Quick start

On a fresh Linux VM with a domain pointing at it:

```sh
curl -fsSL https://get.bemmoly.com | sh
```

About five minutes later the installer prints your address; open it to create the first admin.

Requirements:

- A VM with 2 vCPU and 4 GB of memory (enough for about 200 people)
- Ubuntu (Debian, Fedora and Amazon Linux are supported but not yet tested end to end)
- Root or sudo, 10 GB of free disk, ports 80 and 443, and a domain pointing at the VM

The installer sets up Docker, Postgres, HTTPS, backups and updates; it checks the
requirements itself and prints the fix for anything missing. Docker Compose, Kubernetes (Helm), an existing
Postgres and offline installs are covered at
[bemmoly.com/self-hosting](https://bemmoly.com/self-hosting), and the
[install guide](https://bemmoly.com/docs/install) walks through every step.

## What you get

- **Automatic HTTPS.** Certificates are requested and renewed for you.
- **Backups with retention and verification.** Nightly, kept 7 days, 4 weeks and 3 months,
  and verified.
- **One-command upgrades and rollback.** A failed health check rolls back on its own, and you
  can roll back by hand for 7 days.
- **In-app updater.** Read the release notes, then update with one click.
- **Modules.** Every module ships in the one image; enable and disable them in Settings.
- **SSO-ready identity.** Sessions, roles and a capability matrix today; OIDC, SAML and SCIM
  plug into the same identity in 0.5.
- **Audit log.** Who changed what, when and from where, with before and after, exportable
  as CSV.
- **Metrics.** Prometheus metrics and structured logs, with optional OpenTelemetry.

## Status

**0.2 adds the Work module** to the 0.1 foundation (the kernel and its module system, the setup
wizard, people and roles, email and notifications, backups and updates, the design system). Work
has projects with members, issues with types, custom fields and history, workflows with a visual
editor, Kanban and Scrum boards, the backlog and sprints, LQL and saved filters, issue search in
⌘K and "My work" on Home. It ships in every install and stays off until an admin enables it in
Settings › Modules. Try it in the [live demo](https://bemmoly.com/demo), which runs in your
browser on sample data.

| Release | Scope                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| 0.2     | **Work** (released): projects, issues, workflows, boards, backlog and sprints, filters     |
| 0.3     | **Docs**: spaces, the page tree, a collaborative editor, revisions, comments, templates    |
| 0.4     | **AI**: summaries, ask-your-docs with citations, the ⌘K palette with plans, any provider   |
| 0.5     | **Import and integrations**: importers, OIDC, SAML and SCIM, webhooks, automation, roadmap |
| 1.0     | **Launch**: Helm and Terraform, air-gap bundle, PWA, accessibility and security review     |

The plan for each release, and what it must prove before it ships, is in section 24 of the
[technical design](docs/tech-design.html).

## Screenshots

These come from the product design: the board shipped in 0.2 (without the AI summary, which
arrives with AI in 0.4), and the ⌘K command bar's plans arrive in 0.4. The
[live demo](https://bemmoly.com/demo) shows the app as it ships.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./apps/site/src/assets/screens/board-ocean.png">
  <img alt="The Board: a sprint board with the issue panel open and an AI summary of the issue" src="./apps/site/src/assets/screens/board.png">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./apps/site/src/assets/screens/command-ocean.png">
  <img alt="The command palette turning a request into a plan of changes that waits for confirmation" src="./apps/site/src/assets/screens/command.png" width="66%">
</picture>

<img alt="Step one of the setup wizard: the workspace name, address and first admin" src="./apps/site/src/assets/setup/admin.png" width="66%">

## Architecture

Bemmoly is a TypeScript monorepo: a Fastify host boots the kernel (identity, permissions,
settings, notifications, jobs, realtime, search, the AI runtime) and loads each enabled module,
and a React shell loads one chunk per module. Postgres is the only datastore, holding the data,
the job queue, full-text search and vector embeddings. Modules talk to each other only through
kernel registries and events, so each can be turned off without breaking the rest.

- Technical design: [docs/tech-design.html](docs/tech-design.html) (open in a browser)
- Product design mocks: [docs/design/mocks](docs/design/mocks) (open `Bemmoly App.dc.html`)
- Foundation release plan: [docs/plan/foundation.md](docs/plan/foundation.md)
- Decisions since the design: [docs/adr](docs/adr)

## Contributing

Start with [AGENTS.md](AGENTS.md), the contract for every change, whether a person or an AI
agent writes it, and [CONTRIBUTING.md](CONTRIBUTING.md) for the checks to run before a pull
request. You need Node 24, pnpm 11 and Docker (for Postgres); then it takes ten minutes:

```sh
nvm use            # Node 24, from .nvmrc
corepack enable    # or install pnpm 11
pnpm i
pnpm dev           # Postgres 18 in Docker, server on :8080, web on :5173
```

Open http://localhost:5173. A devcontainer (and Codespaces) has all of it ready.

## Security

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Please do not open
a public issue for a security bug.

## Licence

[MIT](LICENSE). Bemmoly is free to use, change and self-host, forever.
