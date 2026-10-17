# Architecture decision records

How to write one is in [ADR-0001](0001-record-architecture.md). One decision per record; an
accepted record is never edited except to mark it superseded.

| ADR                                                     | Decision                                                         | Status   |
| ------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture.md)                     | The technical design is the architecture record                  | accepted |
| [0002](0002-typescript-7-with-typescript-6-for-lint.md) | TypeScript 7 typechecks; TypeScript 6 serves typescript-eslint   | accepted |
| [0003](0003-no-server-build-step.md)                    | No server build step; Node runs the TypeScript sources           | accepted |
| [0004](0004-log-format-not-environment-names.md)        | LOG_FORMAT chooses the log output, not the environment's name    | accepted |
| [0005](0005-classic-preset-exact-others-derived.md)     | Classic uses exact mock colours; other presets derive tints      | superseded in part by 0015 |
| [0006](0006-ai-sdk-with-models-dev-catalog.md)          | The AI SDK is the only AI integration, driven by models.dev      | accepted |
| [0007](0007-one-website-and-one-mobile-app.md)          | One website and one mobile app for every module                  | accepted |
| [0008](0008-modules-ship-in-one-image.md)               | Every module ships in the one image, enabled per install         | accepted |
| [0009](0009-updater-sidecar.md)                         | In-app updates go through a small updater sidecar                | accepted |
| [0010](0010-liquibase-style-changelog-runner.md)        | Schema changes run through a Liquibase-style changelog runner    | accepted |
| [0011](0011-postgres-only.md)                           | Postgres is the only database                                    | accepted |
| [0012](0012-shared-editor-loaded-on-first-use.md)       | One shared editor package, loaded the first time an editor opens | accepted |
| [0013](0013-modules-read-documents-with-the-editor-schema.md) | Module server code reads documents with the editor's schema | accepted |
| [0014](0014-collab-host-in-the-kernel.md) | The collaboration host lives in the kernel; modules register kinds | accepted |
| [0015](0015-premium-visual-system.md) | The design review is the source of truth for the shell and visual language | superseded in part by 0016 |
| [0016](0016-design-system-is-canonical.md) | One written design system is the canonical rulebook for UI | accepted |
| [0017](0017-ai-streams-as-ndjson.md) | Streamed AI replies are NDJSON over the request that asked | accepted |
| [0018](0018-ai-code-behind-subpath-exports.md) | AI code a lazy screen needs sits behind its own subpath export | accepted |
| [0019](0019-ai-writes-only-through-a-confirmed-plan.md) | AI changes data only through a step a person confirmed | accepted |
| [0020](0020-updater-updates-itself.md) | The updater moves itself to the release it installs | accepted |
| [0021](0021-themes-are-pairs-mode-is-personal.md) | Themes are pairs; mode is personal | accepted |
| [0022](0022-sign-in-shell-and-bemmoly-once.md) | The sign-in shell, and Bemmoly appears once | accepted |
| [0023](0023-card-layout-is-the-boards-quick-filters-in-the-row.md) | Card layout is the board's; quick filters sit in the filter row | accepted; decision 1 changed by 0029; point 2 superseded in part by 0030 |
| [0024](0024-cli-follows-its-release.md) | The bemmoly command follows the release it manages | accepted |
| [0025](0025-i18n-lingui-catalogs-per-namespace.md) | Text is ICU messages in per-namespace catalogs, on Lingui's runtime | accepted |
| [0026](0026-mcp-clients-sign-in-with-oauth.md) | MCP clients sign in with OAuth, identified by client metadata documents | accepted |
| [0027](0027-consent-screen-uses-the-sign-in-shell.md) | The MCP consent screen uses the sign-in shell | accepted |
| [0028](0028-deploy-kits.md) | The Helm chart brings its own Postgres; Terraform runs the installer on one VM | accepted |
| [0029](0029-cards-draw-exactly-the-boards-fields.md) | Cards draw exactly the board's card fields | accepted; decision 6 superseded in part by 0030 |
| [0030](0030-modules-own-an-org-defaults-page-in-settings.md) | Modules own an org defaults page in Settings | accepted |
| [0031](0031-org-templates-are-managed-in-settings-built-ins-read-only.md) | Org templates are managed in Settings › Docs; built-ins read only | accepted |
| [0032](0032-job-workers-drain-continuously-under-a-process-cap.md) | Job workers drain continuously, under one cap per process | accepted |
| [0033](0033-the-site-header-carries-sponsor-in-rose.md) | The site header carries Sponsor, in rose | accepted |
| [0034](0034-avatar-amber-darkened-to-carry-white-initials.md) | Avatar amber is darkened to carry white initials at 4.5:1 | accepted |
| [0035](0035-pdf-export-through-an-optional-renderer.md) | PDF export through an optional renderer, the print view without it | accepted |
| [0036](0036-authorization-lookups-cached-per-process.md) | Authorization lookups cached per process, emptied by a database notification | accepted |
| [0037](0037-pipelines-is-a-separate-product-with-its-own-shell.md) | Pipelines is a separate product with its own shell | accepted; amends 0016 for the frame |
| [0038](0038-pipelines-policies-are-cel-evaluated-in-process.md) | Pipelines policies are CEL, evaluated in process with cel-js | accepted |
| [0039](0039-pipelines-dispatches-jobs-with-its-own-postgres-queue.md) | Pipelines dispatches jobs with its own Postgres queue | accepted |
| [0045](0045-code-hosts-carry-events-and-module-writes.md) | Code hosts carry events and the writes modules need | accepted; changes the code-host contract |
| [0046](0046-command-line-tools-sign-in-with-a-device-code.md) | Command line tools sign in with a device code | accepted; adds the device grant to the OAuth server |
