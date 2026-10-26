# @bemmoly/server

## 1.6.2

### Patch Changes

- @bemmoly/module-docs@1.6.2
  - @bemmoly/module-pipelines@1.6.2
  - @bemmoly/module-work@1.6.2
  - @bemmoly/core@1.6.2
  - @bemmoly/shared@1.6.2

## 1.6.1

### Patch Changes

- @bemmoly/module-docs@1.6.1
  - @bemmoly/module-work@1.6.1
  - @bemmoly/module-pipelines@1.6.1
  - @bemmoly/core@1.6.1
  - @bemmoly/shared@1.6.1

## 1.6.0

### Minor Changes

- d793d2c: A link to a page or an issue pasted into WhatsApp, Slack or any other chat app now previews with
  its title ("PLT-204 Fix login", "Cache plan") and the workspace's name, instead of a generic
  "Bemmoly". Chat apps fetch the link signed out, so anyone holding it sees the title, never the
  content. It is on by default; admins can turn it off under Settings › General › Sharing (the new
  `workspace.linkPreviews` setting). No schema change.

### Patch Changes

- Updated dependencies [7060fa3]
- Updated dependencies [229ccb1]
- Updated dependencies [d793d2c]
  - @bemmoly/module-docs@1.6.0
  - @bemmoly/core@1.6.0
  - @bemmoly/shared@1.6.0
  - @bemmoly/module-work@1.6.0
  - @bemmoly/module-pipelines@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [05e2355]
  - @bemmoly/module-docs@1.5.0
  - @bemmoly/module-work@1.5.0
  - @bemmoly/core@1.5.0
  - @bemmoly/module-pipelines@1.5.0
  - @bemmoly/shared@1.5.0

## 1.4.0

### Patch Changes

- cfe109d: The server ships with patched releases of three libraries that had high severity denial of
  service advisories: zod 4.6.6 (validation of oversized collections could exhaust memory),
  body-parser 2.4.0 under the MCP endpoint (trailing bytes after a compressed body) and undici
  7.30.1 under the AI providers (excessive content encodings). No schema or configuration change.
- Updated dependencies [2ad8011]
- Updated dependencies [cfe109d]
- Updated dependencies [a28c0cc]
- Updated dependencies [bc80b3a]
- Updated dependencies [76b0690]
- Updated dependencies [7e9b170]
- Updated dependencies [b72b9e0]
- Updated dependencies [50337e9]
- Updated dependencies [42e5e99]
- Updated dependencies [8e8b0be]
- Updated dependencies [741ded5]
- Updated dependencies [ae5576a]
- Updated dependencies [24ba06a]
  - @bemmoly/module-work@1.4.0
  - @bemmoly/core@1.4.0
  - @bemmoly/shared@1.4.0
  - @bemmoly/module-docs@1.4.0
  - @bemmoly/module-pipelines@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [da321bb]
- Updated dependencies [debc7b4]
- Updated dependencies [5dae368]
- Updated dependencies [4fae3da]
- Updated dependencies [d6208c1]
  - @bemmoly/module-work@1.3.0
  - @bemmoly/module-docs@1.3.0
  - @bemmoly/core@1.3.0
  - @bemmoly/shared@1.3.0
  - @bemmoly/module-pipelines@1.3.0

## 1.2.0

### Minor Changes

- c41a835: Command line tools sign in with a device code: `bp login` shows a code, you approve it on
  `/device` in a signed-in browser, and the tool receives an API token limited to its module
  for 90 days, listed in Settings › API tokens. The OAuth metadata now advertises
  `device_authorization_endpoint`. Schema: kernel changeset `0115-identity-oauth-device` adds
  the `oauth_device_codes` table. No new configuration keys.
- c41a835: Bemmoly Pipelines: build, test, release and deploy, as a separate product on the same
  install. An admin enables the `pipelines` module in Settings › Modules and chooses who may use
  it; its own web app is served at `/pipelines/`, with its own shell, and people who only use
  Work and Docs never see it.

  - **Catalog.** Every application in Domain › Group › Application, with its owning team, tier
    and labels, read from `.bemmoly/application.yaml` in its repository or created by hand, and
    found by scanning connected repositories.
  - **Pipelines on your own runners.** `bemmoly-runner` claims jobs from a pool and runs each
    step as a container (or as a process with `--local`), streams logs live with secrets
    masked, reports JUnit results and keeps artifacts. Runs start from pushes, pull requests,
    merge queues, schedules or Run pipeline…; Re-run failed runs only what failed. A pipeline
    that cannot start fails its run and says why.
  - **Releases and promotions.** A passing build becomes a release; Promote takes it through
    Dev, Staging and Prod regions with gates, approvals by another person, canaries judged on
    metrics that roll a bad release back by themselves, freezes, and one-click roll back. The `local` provider deploys to
    this machine's Docker, with a real canary splitting traffic between two containers.
  - **Bring your CI.** Keep another CI for builds: `bp release create` or the `bemmoly/release`
    GitHub Action registers its image as a release, signed with the workflow's OIDC token or a
    scoped CI token.
  - **For you, the Map, Runs, Insights.** What is yours and in flight, the whole organisation's
    delivery live on one screen (rewind it to any moment in the last day), and DORA measures by
    domain, group and team.
  - **Access.** Roles bound to teams at a scope, owning teams as Maintainers, policies in CEL
    shown as sentences; every refusal says why and whom to ask, and Platform › Access explains
    any decision.
  - **Platform.** Runner pools and capacity, environments, and clouds with landing zones,
    Google Cloud first (tested against recorded responses).

  `pnpm --filter @bemmoly/module-pipelines seed:demo` seeds the Acme demo organisation;
  docs/pipelines/try-it.md walks through all of it. Schema: Pipelines changesets `0001` to
  `0018` create its `pipeline_*` and `cloud_*` tables when the module is enabled; the kernel adds
  `0115` for command line sign-in with a device code. No new configuration keys are required.

### Patch Changes

- 33f0341: Imports from Jira and Confluence handle big sites. Connecting now only lists projects or
  spaces, so it answers in seconds even with 1,500 projects. Then you choose in a searchable,
  filterable list that shows each project's type, lead and issue count. Counts load as rows come
  into view. The list marks projects imported before, keys already in use here, and projects the
  token can't read. It has a tri-state select all, Shift ranges, ⌘A, and Undo after clearing.
  Selecting "all except a few" works at any size: the 500-project limit is gone. Personal spaces
  are listed too and start unticked. On cloud sites, issue counts come from project search's
  experimental `expand=insight`, with one count per project when it is missing.

  Before you start, Options lets you choose what to bring: comments, attachments, sprints and
  boards, and links between issues (for spaces: comments and attachments). It also sets where
  each project or space goes: a new one with a key you can edit, or an existing one, with
  numbers continuing from its last key. A key that is already taken is now an error you fix; it
  is never merged into the project or space that holds it. Imports used to merge silently in that
  case. Options also matches people by email when you plan, and lets you pick a member or keep a
  placeholder for anyone. Review sums up what Start will do.

  While it runs, the import shows an overall percentage that never goes back and one row per
  project or space. A project or space that fails no longer fails the others. The import ends
  "finished with errors", gives the reason in plain words (for example, the source kept answering
  "too many requests"), and Retry carries it on from where it stopped. The report groups results
  by project with Open board, and offers every skipped record as a CSV download. Whoever started
  the import gets an Inbox notice when it ends. The setup wizard keeps to Connect and Choose,
  starts the import in the background with the default options, and no longer promises change
  history.

  A new "Change history" option, off by default, brings each issue's changelog into issue
  activity, dated when each change happened, and earlier page versions into page history as
  imported versions. Running the import again adds only what is new.

  Admins: kernel changeset `0502-import-containers` adds the `import_containers` table and
  enables `pg_trgm`, which Bemmoly already requires. It copies the projects and spaces of existing
  import jobs into the new table. `0503-import-plan-options` adds target columns to it and the
  `import_people` table. `0504-import-progress` adds per-container progress columns, the
  `import_skips` table and the `completed_with_errors` job status (a previous release's client
  shows such a job as unknown). Docs changeset `0019-docs-imported-revisions` allows the
  `imported` page revision kind.

- Updated dependencies [c41a835]
- Updated dependencies [33f0341]
- Updated dependencies [c41a835]
- Updated dependencies [0435d23]
- Updated dependencies [f471fce]
  - @bemmoly/core@1.2.0
  - @bemmoly/shared@1.2.0
  - @bemmoly/module-work@1.2.0
  - @bemmoly/module-docs@1.2.0
  - @bemmoly/module-pipelines@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [ab404c3]
  - @bemmoly/module-work@1.1.0
  - @bemmoly/module-docs@1.1.0
  - @bemmoly/core@1.1.0
  - @bemmoly/shared@1.1.0

## 1.0.0

### Major Changes

- 981bce2: **Bemmoly 1.0.** Self-hosted issues and docs for your whole team, in one Docker image and one
  Postgres, 100% open source under MIT, with no subscription and no in-app purchases. 1.0 changes
  nothing you have to act on: it is the release everything below has been building towards, and
  from here versions follow Semantic Versioning's usual rules.

  - **Work**: projects, issues with custom fields, workflows drawn in a visual editor, Kanban and
    Scrum boards, the backlog and sprints, LQL and saved filters, a roadmap of epics on a
    timeline, and automation rules.
  - **Docs**: spaces and a page tree, a live collaborative editor, comments, revisions, issue
    links with live status, Markdown import, and export to Markdown and HTML, or to PDF with the
    optional PDF renderer.
  - **AI, optional**: off until an admin turns it on, with any provider from the models.dev
    catalog or a model on your own network: summaries with sources, answers from your docs,
    help in the editor, ⌘K plans you confirm, and an MCP server for AI clients.
  - **Imports**: Import from Jira and Import from Confluence (Cloud or Data Center) or a CSV file, previewed before
    anything is written.
  - **Sign-in and people**: single sign-on with OpenID Connect or SAML 2.0, and SCIM 2.0
    provisioning.
  - **Connections**: outgoing webhooks signed with HMAC-SHA256, and code hosts (GitHub, connected
    in one click, and GitLab) linking pull requests, branches and commits to issues.
  - **Your look**: five themes in light and dark, your brand colour and your own logo.
  - **Running it**: one command on a VM, Docker Compose, your own Postgres, a Helm chart or the
    Terraform module; automatic HTTPS, nightly verified backups, and one-click updates with
    automatic rollback.

  What 1.0 promises is what the contributor contract already requires of every release
  (AGENTS.md §6): every release runs against the previous minor's database and tolerates the
  previous minor's clients, so updates and rollbacks are safe within one minor, and security
  fixes ship as patches on the current minor. No schema or configuration change.

### Minor Changes

- a00717d: Connect GitHub in one click. In Settings › Code hosts, Connect GitHub now opens GitHub with a
  Bemmoly app ready to create: its webhook, read-only access to pull requests, code and checks,
  and the events Bemmoly uses. Create it, choose its repositories, and you are back in Bemmoly
  connected, with the last 30 days backfilled. No App ID, installation ID, private key or
  repository list to copy by hand; that form is still there under "Enter app details by hand".
  Works on github.com (your account or an organization) and on Enterprise Server. If GitHub
  cannot reach `BEMMOLY_PUBLIC_URL` (a localhost or private address), the app is created without a
  webhook and the dialog says so; backfill still works.

  Schema: kernel changeset `0702-integrations-app-slug` (a nullable `app_slug` column on
  `integrations`). No new configuration.

- 1e9cdf9: Docs pages export to PDF files when an install runs the new optional PDF renderer: Export as PDF
  in a page's More menu and the export dialog make a PDF on A4 or Letter with the title and page
  numbers on every page, a contents page for a page and the pages under it, coloured code,
  tables, images and issue chips. One page downloads when it is ready; a bigger export arrives in
  the inbox with a download link, and files are kept for a day. Without the renderer nothing
  changes: PDF stays the browser's print view, now set in the new print type.

  For admins: the renderer is a pinned headless Chromium image that runs locked down and with no
  network beside the app. Turn it on with the `pdf` Compose profile and
  `BEMMOLY_PDF_URL=http://pdf:3000`, with `pdf.enabled=true` in the Helm chart, or by building
  the air-gap bundle with `BEMMOLY_AIRGAP_PDF=true` (deploy/README.md, "PDF export"). New
  settings: `BEMMOLY_PDF_URL`, `BEMMOLY_PDF_TIMEOUT_MS`, `BEMMOLY_PDF_MAX_BYTES`. Schema: the
  Docs changeset `0017-docs-page-exports` adds the `page_exports` table (fast, reversible).

### Patch Changes

- c5849e4: Queue depth counts only jobs that can run now: `bemmoly_job_queue_depth` and `bemmoly status`
  no longer include scheduled jobs such as digests, which show apart as
  `bemmoly_job_queue_delayed` and `queueDelayed`. `bemmoly sync-updater` no longer prints an older
  updater's usage line or restarts the app. `bemmoly doctor` warns when Postgres is tuned for a
  different machine size, and the new `bemmoly tune` re-applies the tuning after a resize, asking
  before it restarts the database.
- 2632307: Faster under load on small machines. Creating an issue reads the end of the backlog from the
  board index alone (live issues only; a restored issue that would share a rank moves to the
  end) and takes its number in one statement, still gap-free. The page tree and page placement
  in Docs now use their index for top-level pages. Authorization answers are shared across
  requests for up to five seconds and dropped as soon as a role, membership, grant, person or
  API token changes: kernel changeset `0114-identity-authz-notify` adds triggers that notify
  `bemmoly_authz` on commit (ADR 0036). The database pool is sized from the CPU count (four per
  CPU, 10 to 40) unless `BEMMOLY_DB_POOL_MAX` sets it; the Helm chart sets `databasePoolMax: 10`
  per pod.
- Updated dependencies [981bce2]
- Updated dependencies [05f614a]
- Updated dependencies [17674ec]
- Updated dependencies [ad16b63]
- Updated dependencies [a00717d]
- Updated dependencies [3ff8f77]
- Updated dependencies [c5849e4]
- Updated dependencies [1e9cdf9]
- Updated dependencies [2632307]
- Updated dependencies [903e416]
- Updated dependencies [ad6dd60]
- Updated dependencies [18f6038]
- Updated dependencies [6669dbc]
- Updated dependencies [0e01359]
  - @bemmoly/core@1.0.0
  - @bemmoly/module-work@1.0.0
  - @bemmoly/module-docs@1.0.0
  - @bemmoly/shared@1.0.0

## 0.13.1

### Patch Changes

- @bemmoly/module-docs@0.13.1
  - @bemmoly/module-work@0.13.1
  - @bemmoly/core@0.13.1
  - @bemmoly/shared@0.13.1

## 0.13.0

### Minor Changes

- b40f43b: Code links. Connect GitHub (github.com or Enterprise Server, as a GitHub App or with a token) or
  GitLab (gitlab.com or self-managed, with a project or group access token) in the new Settings ›
  Integrations › Code hosts, and pull requests, branches and commits that name an issue key
  ("feat/plt-204-sessions", "Fixes PLT-204") show in a Development section on that issue, with
  open, draft, merged or closed, checks and review, updated live. Deliveries are verified against
  the webhook secret before they are read and applied once, so a redelivery changes nothing; the
  card shows the last delivery, a test delivery checks the secret and the token, and a backfill
  reads the last 30 days of pull or merge requests. Each project can move its issues when a linked
  pull request opens or merges (project settings › Development), within its workflow. The AI issue
  summary now reads linked pull requests. New API: `/api/v1/admin/code-hosts` and the anonymous
  webhook `POST /api/v1/code-hosts/:id/webhooks`; `GET /api/v1/work/issues/:key/code-links`;
  `GET` and `PUT /api/v1/work/projects/:key/code-transitions`. Schema: kernel changeset
  `0700-integrations` (integrations, integration_deliveries) and Work changeset
  `0027-work-code-links` (code_links, code_transitions); both add tables only. Credentials are
  sealed with `BEMMOLY_SECRET_KEY`; self-managed hosts on private addresses work as they do for
  identity providers, and `BEMMOLY_ALLOW_PRIVATE_URLS` widens that. No new configuration keys.
- ba2672b: Kubernetes, Terraform and air-gapped installs are now complete paths, each tested on every
  change to the deploy kits.

  The Helm chart can run its own Postgres 18 with pgvector (`postgresql.enabled=true`) or use
  yours (`externalDatabase.url`), generates and keeps the secret key, backup passphrase and
  database password across upgrades and uninstalls, runs pending changesets in a pre-upgrade Job
  before any pod is replaced, adds a startup probe for long first boots, keeps the data volume on
  uninstall, and has `helm test`. Every value is documented in the chart's README, including why
  live collaboration needs one app replica for now. **Upgrading a release of an earlier chart**:
  it defaulted `existingSecret` to `bemmoly`; pass `--set existingSecret=bemmoly` with
  `--reset-then-reuse-values`. The chart refuses to render until it knows which database to use.

  New Terraform: a provider-free module that runs the installer on one VM through cloud-init, with
  inputs for the domain, the size, S3-compatible backups and SMTP, and thin examples for three
  clouds (`deploy/terraform`).

  Air-gapped bundles now carry the `bemmoly` CLI, the models.dev catalog snapshot, `VERSION`,
  `images.txt`, checksums of every file and a cosign signature, and each bundle file is signed
  as a release asset. `install.sh` installs offline from the bundle it sits in (or `--bundle`),
  checking checksums and the signature first; `bemmoly upgrade --bundle <file>` upgrades offline
  with the usual backup, health check and automatic rollback. New `bemmoly settings import <file>`
  sets email and backup settings from a JSON file. Installs from a bundle set
  `BEMMOLY_UPDATER_LOCAL_IMAGES=true` in `.env`. No schema change.

- daf0ccc: MCP clients can now connect by signing in. Point a client that supports MCP sign-in at
  `https://<host>/mcp` and it opens your browser: you sign in as usual (password or single
  sign-on), see which app is asking, the site that vouches for it and where it sends you back, and
  choose read only or read and write and the modules before connecting. The app gets a one-hour
  access token bound to that MCP address and a 30-day refresh token that is replaced on every use;
  both are stored only as hashes. Connected apps are listed under Settings › Access tokens, where
  you can disconnect them, and deactivating a person ends their connections. Personal access
  tokens keep working as before. Apps identify themselves with a client ID metadata document;
  dynamic client registration is not offered (see `docs/mcp.md` and ADR 0026).

  Settings › Sign-in and SSO lists every org admin and lets you make or remove break-glass admins,
  who keep password sign-in while single sign-on is required. The confirmation names the person,
  each change is audited and every other org admin is told at once (a new "Break-glass admin
  changes" notification). While single sign-on is required at least one break-glass admin always
  remains: removing, demoting or deactivating the last one is refused.

  Schema: changeset `0112-identity-oauth` adds four tables (`oauth_clients`,
  `oauth_authorization_codes`, `oauth_grants`, `oauth_tokens`); new tables only, safe to roll back.
  Configuration: new optional `BEMMOLY_RATE_LIMIT_OAUTH_PER_IP` (default 60 discovery, token and
  revocation requests per address per minute). Client metadata documents are fetched from public
  addresses only unless `BEMMOLY_ALLOW_PRIVATE_URLS` is set.

- c7db7da: The Sample module is no longer in the image, so it no longer shows in Settings › Modules, the
  sidebar or Users › Module access. It was a developer example that proved the module contract; a
  test-only fixture module now does that and never ships.

  Existing installs that enabled Sample update normally: the server boots without warnings and
  Sample simply stops loading. Users › Module access no longer lists grants for a module the image
  does not ship; the grants stay stored. Nothing is dropped: the `sample_items` table, Sample's
  rows in `schema_changelog`, `modules` and `module_grants`, and its `sample.greeting` setting stay
  in the database, unused. To remove the table through the app, disable Sample and use Remove data
  in Settings › Modules before updating (it takes a backup first); after the update it can only be
  dropped by hand (`DROP TABLE sample_items;`). If `BEMMOLY_MODULES` lists `sample`, take it out
  before updating: the server refuses to start when the pin names a module the image does not
  ship. No schema change.

- 53e1640: Outgoing webhooks. Admins add endpoints in Settings › Webhooks and pick the events they want:
  issues created, updated, transitioned or commented, sprints started or completed, and pages
  published or updated. Each delivery is a versioned JSON envelope, or a chat message preset for
  chat tools that take incoming webhooks, signed with HMAC-SHA256 in the `bemmoly-signature` header
  (`t=<unix seconds>,v1=<hex>`). The signing secret is shown once, when the webhook is made or the
  secret is rotated. Failed deliveries retry five times with exponential backoff; the delivery log
  shows each attempt's status code and lets an admin send a test delivery or redeliver any event.
  A webhook that fails five deliveries in a row turns itself off and tells the admins. Webhook
  addresses on private, loopback or link-local networks are refused unless
  `BEMMOLY_ALLOW_PRIVATE_URLS` is set, and redirects are never followed.

  Automation rules in Work. Project admins add rules in Project settings › Automation, and org
  admins add global rules that run in every project: a trigger (issue created, a field changed,
  transitioned, comment added, or a schedule), LQL conditions, and actions (set a field,
  transition, assign, comment, add a label, send a webhook, notify people). Rules act with the
  permissions of the person who last saved them, every action is in the audit log, and the run
  log shows each run's outcome. A rule never re-triggers itself, and a chain of rules stops after
  five in a row.

  Schema: kernel changesets `0113-audit-automation-actor` (audit rows may name the automation
  actor) and `0701-webhooks` (new `webhooks` and `webhook_deliveries` tables); Work changeset
  `0028-work-automation-engine` (rule owners, schedules and run details). No new configuration.

### Patch Changes

- 2a65f20: Background jobs no longer back up for hours after a burst. Every job queue used to take one job
  every 2 seconds, about 30 a minute however quick the jobs were, so a burst of emails,
  notifications, digests, imports or AI work could take hours to drain (5,800 jobs took over 3
  hours). A queue now takes its next job as soon as the last one finishes and only waits between
  checks when it is empty: 500 quick jobs now finish in about a second instead of about 17
  minutes. Emails and digests now run four at a time; backups, imports and AI work still run one
  at a time.

  Jobs and requests share the database connections, so a single Bemmoly process now runs at most
  4 jobs at once, keeping the rest of its 10 connections for requests (a `BEMMOLY_ROLE=worker`
  process runs up to 8). No configuration or schema change.

- Updated dependencies [004ebc2]
- Updated dependencies [b40f43b]
- Updated dependencies [50cfe36]
- Updated dependencies [2a65f20]
- Updated dependencies [daf0ccc]
- Updated dependencies [c7db7da]
- Updated dependencies [2191962]
- Updated dependencies [fb6b0e3]
- Updated dependencies [53e1640]
- Updated dependencies [8d1901a]
  - @bemmoly/module-work@0.13.0
  - @bemmoly/core@0.13.0
  - @bemmoly/shared@0.13.0
  - @bemmoly/module-docs@0.13.0

## 0.12.0

### Patch Changes

- 403ef1d: Bemmoly is ready to speak other languages. Settings › Profile has a Language setting, saved on
  your account so every device follows it: Automatic follows your browser, or pick a language.
  English is the only language shipped so far, so nothing reads differently today; dates, times and
  numbers now follow your language through the browser's own formatting. Settings › Workspace
  offers only the languages Bemmoly ships.

  For people building Bemmoly: the sidebar, menus, page header, phone bar, sign-in and Profile read
  their words from message catalogs (ICU, one per namespace, compiled at build time), modules can
  bring their own through `@bemmoly/core-web`, and `?locale=en-XA` shows a screen in an accented,
  padded pseudo-language for checking layout. API error bodies may now carry `messageId` and
  `values` beside `message`; existing clients are unaffected. The password reset email is written
  through the server's catalog in the workspace's language. See `docs/i18n.md` and ADR 0025.

- 7ca4a6a: Backups now include every uploaded file (page images, the workspace logo, issue attachments)
  and restores put them back. Before this, uploads were left out of backups: the backup read a
  folder the uploads are not stored in. Take a fresh backup after updating; older backups do not
  contain uploads.

  Uploads can now live in an S3-compatible bucket (AWS S3, R2, MinIO, B2): set the
  `system.storage.backend` setting to `s3` and the new `BEMMOLY_STORAGE_S3_BUCKET`,
  `BEMMOLY_STORAGE_S3_REGION`, `BEMMOLY_STORAGE_S3_ENDPOINT`, `BEMMOLY_STORAGE_S3_ACCESS_KEY_ID`,
  `BEMMOLY_STORAGE_S3_SECRET_ACCESS_KEY`, `BEMMOLY_STORAGE_S3_FORCE_PATH_STYLE` and
  `BEMMOLY_STORAGE_S3_PREFIX` keys. Backups copy the bucket's uploads into every backup, and a
  restore writes them back to the bucket. Existing files are not moved between backends.

  The monthly AI budget can no longer be overshot by calls made at the same time: standard and
  strong calls reserve their estimated cost before they run, so calls at the limit are refused
  with "budget reached" instead of all going through.

  Live issue tables in documents load in one request instead of one per row. A page's
  "Referenced in" list finds linking issues through an index instead of scanning every issue.
  `GET /teams/:id` reports the team's real `memberCount` instead of 0.

  Release images now carry the commit SHA and build time in their OCI labels
  (`org.opencontainers.image.revision` and `.created`) instead of "unknown".

  Schema changes: kernel changeset `0410-ai-budget-reservations` adds the
  `ai_budget_reservations` table (reversible). Work changeset
  `0024-work-issues-linked-pages-index` builds a GIN index on `issues` concurrently (reversible);
  on a large workspace it reads every issue once while it builds, without blocking writes.

- ea2125f: Fixes a hang where a busy install stopped answering altogether. When several members at once
  changed issue statuses, commented on issues or pages, or edited issues that tell watchers,
  each of those requests held a database connection while waiting for a second one; with ten at
  once every connection waited on another, and every request hung until Postgres was restarted.
  Those requests now do all their work on the one connection they hold, and the same is true of
  notification emails, settings reads, transition conditions, board ranking and Docs imports.

  A starved database pool can no longer hang the install. A request that waits too long for a
  connection now fails with a 503 (`unavailable`, with Retry-After) and an error in the server
  log, and the install recovers on its own as soon as connections come free. Statement and idle
  transaction timeouts end anything stuck on the database side.

  New settings in `.env` (milliseconds; 0 switches one off): `BEMMOLY_DB_STATEMENT_TIMEOUT_MS`
  (default 10000), `BEMMOLY_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` (default 60000),
  `BEMMOLY_DB_ACQUIRE_TIMEOUT_MS` (default 10000), and `BEMMOLY_DB_NESTED_ACQUIRE` (`warn` by
  default; `throw` for development). Changesets, backups, restores and the `bemmoly` command line
  keep their own, longer limits. No schema change.

- Updated dependencies [b769aed]
- Updated dependencies [403ef1d]
- Updated dependencies [7ca4a6a]
- Updated dependencies [0194a84]
- Updated dependencies [ea2125f]
- Updated dependencies [51ca8f4]
  - @bemmoly/shared@0.12.0
  - @bemmoly/core@0.12.0
  - @bemmoly/module-work@0.12.0
  - @bemmoly/module-docs@0.12.0
  - @bemmoly/module-sample@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [50fff66]
- Updated dependencies [1aca27c]
  - @bemmoly/core@0.11.0
  - @bemmoly/shared@0.11.0
  - @bemmoly/module-work@0.11.0
  - @bemmoly/module-docs@0.11.0
  - @bemmoly/module-sample@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [e6982a1]
  - @bemmoly/core@0.10.0
  - @bemmoly/shared@0.10.0
  - @bemmoly/module-docs@0.10.0
  - @bemmoly/module-sample@0.10.0
  - @bemmoly/module-work@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [250098f]
  - @bemmoly/core@0.9.0
  - @bemmoly/shared@0.9.0
  - @bemmoly/module-docs@0.9.0
  - @bemmoly/module-sample@0.9.0
  - @bemmoly/module-work@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [31f9a87]
  - @bemmoly/core@0.8.0
  - @bemmoly/shared@0.8.0
  - @bemmoly/module-docs@0.8.0
  - @bemmoly/module-work@0.8.0
  - @bemmoly/module-sample@0.8.0

## 0.7.0

### Minor Changes

- 8559222: Bring your work with you: Import from Jira and Confluence, or from a CSV file. An admin opens
  Settings › Import (or the setup wizard's import step, which is the same flow), picks a source,
  enters the site address and an API token or personal access token, and sees what the site holds
  before anything is written: projects or spaces with their counts, then how issue types,
  statuses and custom fields will land (matched, created or only reported). The import runs as a
  background job with live progress and can be cancelled; at the end a report lists what was
  created, updated and skipped, and why.

  **Import from Jira** (Cloud and Data Center): projects with their keys and issue numbers kept, issue types
  and statuses mapped to Work's (statuses Work lacks are added to the project's own workflow),
  custom fields matched by name or created as project fields (kinds Work cannot hold are
  reported), versions, components, boards and sprints, and issues with their descriptions,
  comments, attachments, labels, parents and links. People are matched by email; someone with no
  account here is added as invited (no email is sent), and someone whose address the source site hides becomes
  a deactivated placeholder that keeps their name on what they wrote.

  **Import from Confluence** (Cloud and Data Center): spaces and their page trees, pages converted from
  storage format with links rewritten to the imported pages and issues, unknown macros kept as
  labelled blocks, labels, threaded comments and attachments.

  **CSV**: one issue per row into a project, columns matched by header, so exports from most
  trackers work as they are.

  **Safe to run again.** Every imported record is remembered, so running an import again updates
  what the first run made instead of copying it, and anything edited in Bemmoly since is left
  alone and named in the report. A run that fails part way records why and resumes from where it
  stopped. In our test against a local stand-in for a 10,000-issue project (20,000 comments,
  10,000 links), the whole import took about two minutes on a laptop.

  Credentials are stored encrypted with the install's secret key and are never shown again or
  sent to the browser. Calls to a hosted site may only reach public addresses and a Data Center
  site may be on the local network; `BEMMOLY_ALLOW_PRIVATE_URLS` lifts that, as it does for AI
  providers.

  Admins: the schema adds the kernel changeset `0501-import-jobs` (the `import_jobs` and
  `import_mappings` tables). It is reversible and quick. Import from Jira and from CSV
  requires the Work module, and Import from Confluence the Docs module. Images attached to imported pages show inline
  in the imported pages; other attachments are copied into storage.

- 65c412a: Single sign-on and SCIM provisioning. Admins add identity providers in Settings › Sign-in and
  SSO (or in the setup wizard): any OpenID Connect provider through its discovery URL, or SAML
  2.0 with signed assertions. People are created on first sign-in with a default role, linked to
  an existing account by verified email, and placed in roles and teams from their groups. A test
  sign-in checks a provider without signing anyone in. "Require single sign-on for everyone"
  turns password sign-in off except for break-glass admins; personal access tokens keep working
  and are stopped by revoking them or deactivating the person. SCIM 2.0 at `/scim/v2` creates,
  updates and deactivates people and keeps teams in step, with an audit row for every change.

  Schema: changeset `0111-identity-sso` adds columns to `auth_providers` and the tables
  `auth_sso_flows`, `auth_sso_assertions`, `scim_tokens` and `scim_resources` (reversible).
  Configuration: no new keys. Identity providers on private networks are allowed; link-local
  addresses are refused unless `BEMMOLY_ALLOW_PRIVATE_URLS` is set. Provider secrets are
  encrypted with `BEMMOLY_SECRET_KEY`.

### Patch Changes

- Updated dependencies [8559222]
- Updated dependencies [65c412a]
  - @bemmoly/core@0.7.0
  - @bemmoly/shared@0.7.0
  - @bemmoly/module-work@0.7.0
  - @bemmoly/module-docs@0.7.0
  - @bemmoly/module-sample@0.7.0

## 0.6.0

### Minor Changes

- 4e0e170: Images go into Docs pages by upload, not only by link. Paste a screenshot, drop a file, or pick
  Image from the / menu: the image uploads with its progress shown where it will land, a failed
  upload says why and offers Try again, and everyone else on the page sees it arrive live. A
  selected image's alt text is edited in place.

  Images are stored by Bemmoly as files of the page: people who can edit the page add them, people
  who can read it see them, and nobody else can open them. PNG, JPEG, GIF and WebP are accepted,
  checked by their content rather than their name; SVG is refused. Uploaded images are kept under
  the data directory's attachments folder, so backups include them, and an image no page, version
  or template refers to any more is removed after a day by the housekeeping job. A page exported
  as HTML carries its images inside it, a page and its children exported as a folder carry them in
  an `images/` folder, and a single Markdown file keeps links to them.

  Configuration: `BEMMOLY_UPLOAD_MAX_BYTES` sets the largest upload (10 MiB by default) and
  `BEMMOLY_RATE_LIMIT_UPLOADS_PER_USER` the uploads a person may make per minute (30 by default).
  Schema: kernel changeset `0500-files` adds the `files` table (additive, fast).

- 4cbf7a1: Bemmoly now has a built-in MCP server, so AI desktop apps, coding agents and IDEs can work in
  your workspace as you. Point a client at `/mcp` for every module, or at `/mcp/work` or
  `/mcp/docs` for one. It offers search, the Work and Docs tools the palette uses, issues,
  projects, spaces and pages as readable resources, and two prompts. Every call runs with your
  permissions, writes land in the audit log, and requests are rate limited.

  An admin turns it on, and picks the modules it exposes, in Settings › MCP server. It is off by
  default, and the AI settings do not affect it. Everyone can create personal access tokens in
  Settings › Access tokens: read only or read and write, for every module or only some, shown once
  and stored as a hash. A token limited to some modules is held to them in the REST API too. See
  `docs/mcp.md` to connect a client.

### Patch Changes

- Updated dependencies [4e0e170]
- Updated dependencies [aff36d5]
- Updated dependencies [4cbf7a1]
- Updated dependencies [c4215a9]
  - @bemmoly/core@0.6.0
  - @bemmoly/shared@0.6.0
  - @bemmoly/module-docs@0.6.0
  - @bemmoly/module-work@0.6.0
  - @bemmoly/module-sample@0.6.0

## 0.5.0

### Minor Changes

- 0a04d0d: AI arrives, and it is optional. Bring any provider in the models.dev catalog, a gateway, or a
  model running on your own network, and Bemmoly summarises your work where you read it, answers
  questions from your docs with their sources, drafts in the doc editor and plans changes from
  ⌘K that run only when you confirm them. **AI is off until an admin turns it on, and nothing
  changes for a workspace that leaves it off:** no AI surface is drawn, every AI endpoint except
  the Settings › AI switch refuses, no AI background job runs, and the server makes no AI-related
  request to anyone.

  **Turning it on.** An admin opens Settings › AI and models (or the setup wizard's AI step, which
  also offers "Skip, no AI"), adds a provider from the catalog with its key, or a Local server by
  protocol and address, and presses Test connection, which reports the provider's own answer in
  plain words. Each model role (fast, standard, strong and embedding) then picks a model, with
  capabilities, context size, price and release date shown; a newly connected provider fills every
  empty role with its suggested model. One switch turns AI on for the whole workspace; turned off
  again, every AI surface disappears for everyone and the providers and roles are kept. Keys are
  encrypted with the install's secret key and never shown again. The provider list comes from the
  catalog fetched live by the server, then the last good copy, then the copy in the image; a status
  line says which, and an admin can upload a newer catalog or turn the live fetch off.

  **Summaries where you read.** Every AI card is drawn in the lilac reserved for AI, cites the issue,
  comment, section or page each claim came from, marks a claim without a source "Unsourced", and
  offers "Not useful". The issue page and slide-over say what an issue stands on, who it waits on
  and what it blocks. The Board and Backlog of a running sprint show one line naming the biggest
  risk, refreshed five quiet minutes after the sprint changes. A page's TL;DR sits under its title
  and is rewritten only when the text changes. Consistency checks run when a page is published and a
  minute after an issue it names changes, and show contradictions in the page's Linked work margin
  and in "Needs you" for its owner and reviewers. Home shows a morning brief of what changed in your
  projects and spaces since your last visit, written at 6 a.m. in your time zone. Summaries are
  cached and rewritten only when what they read changed; a failed one says so with Try again and
  never blocks the page.

  **Ask your docs.** With an embedding model set, the Docs home has a question box. The answer
  streams in with numbered citations that open the page at the heading, or the issue, they came
  from. It draws only on pages and issues you can open, checked again with the rules the rest of
  the app uses, combines meaning-based search with keyword search, and says so when nothing in the
  workspace answers instead of guessing. The index follows edits a few seconds after they settle,
  re-embeds only the sections that changed, and backfills when AI is turned on or the embedding
  model changes.

  **AI in the doc editor.** Pause at the end of a line and ghost text suggests how the sentence goes
  on; Tab keeps it, anything else drops it. Each person turns ghost text off for themselves with
  ··· › Ghost text suggestions, and the choice follows them to every device. The / menu's AI group
  and Ask AI on a selection continue, summarize, draft from a heading, improve, shorten, fix
  spelling, translate, turn text into a table or create issues from a section; the answer streams
  into a card below the text with Replace, Insert, Ask again, Discard and Not useful, and one undo
  takes an accepted answer back. An inline comment thread offers Suggest a fix, with Apply fix and
  Not useful on the fix it writes. Nothing AI writes reaches a shared page until someone accepts it,
  so people editing with you never see an unaccepted suggestion. None of this is drawn for readers,
  in a space excluded from AI, or for someone who turned AI off.

  **Plans from ⌘K.** Type a request such as "move everything blocked by PLT-204 to next sprint" and
  choose Plan with Bemmoly (Mod+Enter), or ask a question and get Ask Bemmoly's cited answer. **A
  plan changes nothing until you confirm it.** It lists each change, checked against your own
  permissions; a change you can't make is marked Denied with the reason and left out. Edit plan
  keeps fewer changes and Enter runs it. Each change lands in turn through the same code the app
  uses, keeps running if you close the palette, can be stopped, and Undo puts back everything that
  can be put back. Comments a plan writes are signed "via Bemmoly for" your name. With AI actions
  turned off a plan is a preview that never runs.

  **Privacy.** An admin chooses whether issue and doc content is sent at all (with it off, only
  titles, keys, statuses and field values), whether email addresses and names are replaced before
  sending, which spaces and projects are excluded (never sent, never embedded, and their AI actions
  hidden), whether AI actions may change data, and whether people may turn AI off for themselves
  from their Profile. Someone who opts out sees no AI, and their own writing is kept out of
  summaries other people read and out of the answer index.

  **Budget and cost.** Every AI call is logged with its cost in `ai_runs`, and Settings › AI › Usage
  shows this month's spend by role, purpose and model. An optional monthly budget tells admins at
  80% and again at 100%, in the inbox and by email; at 100% it pauses the standard and strong roles
  until the 1st, and the screens that use them say so in plain words. A call that is stopped or
  times out still counts, at an estimate of what was sent and received. Settings › System status
  shows this month's spend to people who configure AI. Every prompt can be
  overridden in Settings › AI › Prompts, compared with the default line by line and reset.

  Admins should know:

  - **Schema:** ten additive changesets: `0400-ai-providers`, `0401-ai-model-roles`,
    `0402-ai-runs`, `0403-ai-catalog-snapshots`, `0404-ai-prompt-overrides`, `0405-ai-insights`,
    `0406-ai-embeddings` (enables the `vector` extension, which the pgvector Postgres image every
    install runs already ships), `0407-ai-user-opt-outs`, `0408-ai-plans` (`ai_plans` and
    `ai_plan_steps`) and `0409-ai-user-preferences`. Nothing existing is altered.
  - **Settings:** `ai.enabled` (off), `ai.redactEmails` and `ai.redactNames` (off),
    `ai.excludedSpaceIds` and `ai.excludedProjectIds` (none), `ai.perUserOptOutAllowed` (off),
    `ai.monthlyBudgetUsd` (no budget) and `ai.liveCatalog` (on), all edited in Settings › AI. The
    wizard's existing `ai.shareContent` and `ai.allowActions` now take effect.
  - **Environment:** two new optional keys. `BEMMOLY_RATE_LIMIT_AI_PER_USER` sets how many requests a
    minute each person may make to each route that calls a model (60 by default; this covers answers,
    plans, summary refreshes, ghost text, /ai writes, suggested fixes and an admin's provider tests).
    `BEMMOLY_AI_RECORDING` is the absolute path of a JSON file of canned AI replies for end-to-end
    tests and demos; when set, no provider is ever called.
  - **Network:** a provider's address is checked on every call, not only when it is saved, and a
    provider that answers with a redirect is refused. A Local server may use loopback and your private
    network but never link-local addresses such as cloud metadata; `BEMMOLY_ALLOW_PRIVATE_URLS` also
    lets a catalog provider's base URL sit on a private network. Server logs for a failed call keep
    the failure and the provider's words with any echoed key removed, never the prompt.
  - **Permissions:** every AI surface needs "Use AI assist" (roles without it, by default
    contractors, see no AI); running a plan needs "Run AI actions that change data" and "Let AI
    actions change data" on. Each step re-checks those permissions and the person's opt-out as it
    runs, Undo checks the person may still make that change, and a plan expires after an hour. Each step a plan makes writes an
    audit row (`ai.plan.step_run`, actor kind `ai_plan`) that names the plan.
  - **Jobs:** `ai.catalog.refresh` (daily, only while AI is on), `ai.insight`, `ai.brief` (hourly), `ai.plan.run`, and
    `ai.retrieval.index`, `ai.retrieval.reconcile` and `ai.retrieval.backfill` for the answer index.
  - **Notifications:** a new `ai_budget` kind reaches people who configure AI, by email by default.

  For module authors: `ctx.ai` offers `generate`, `stream` and `embed` through one facade, and
  `addTool`, `addContextBuilder`, `addInsightGenerator`, `addRetrievalSource`, `addPromptFile` and
  `addExclusionSource`. Streamed replies are NDJSON (ADR 0017), AI code that only lazy screens
  need sits behind subpath exports such as `@bemmoly/shared/ai-answers` (ADR 0018), and write
  tools only ever become plan steps a person confirms (ADR 0019). A module's event handlers run
  only while that module is enabled, so a disabled module never handles another's events.

### Patch Changes

- Updated dependencies [0a04d0d]
- Updated dependencies [43c54ed]
- Updated dependencies [db35948]
- Updated dependencies [fc28637]
- Updated dependencies [9911c5f]
- Updated dependencies [0abb59e]
- Updated dependencies [a85ffa6]
- Updated dependencies [eb5e3bb]
- Updated dependencies [15ee6eb]
  - @bemmoly/core@0.5.0
  - @bemmoly/shared@0.5.0
  - @bemmoly/module-work@0.5.0
  - @bemmoly/module-docs@0.5.0
  - @bemmoly/module-sample@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e7df029]
- Updated dependencies [ab5214d]
- Updated dependencies [2ab05df]
- Updated dependencies [8f4df5f]
- Updated dependencies [bb4a602]
- Updated dependencies [e5697e8]
- Updated dependencies [259e195]
  - @bemmoly/module-work@0.4.0
  - @bemmoly/module-docs@0.4.0
  - @bemmoly/core@0.4.0
  - @bemmoly/shared@0.4.0
  - @bemmoly/module-sample@0.4.0

## 0.3.0

### Minor Changes

- 27dec1d: The server now hosts live collaborative documents at `/collab`, on its own port and
  authenticated with the session cookie. Every change is stored in Postgres as it happens and
  survives restarts; a page's text, word count, search index and links update two seconds after
  typing stops.

  Two new optional environment keys cap each editing connection; empty keeps the default.
  `BEMMOLY_COLLAB_MAX_MESSAGE_BYTES` is the largest message one socket may send, from 64 KiB to
  16 MiB (2 MiB by default). `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES` is how many document messages
  one socket may send per 10 seconds (1200 by default); caret and selection updates count
  separately, up to three times that, so moving the caret never spends the typing budget. A
  socket over a limit is closed and the editor reconnects on its own, keeping what was typed.
  Measured in a browser, the fastest key repeat with the caret moving sends about 70 messages a
  second, half of them carets, so the defaults leave room for two people typing flat out.

  Run one API process per install for live editing; with several, route `/collab` with session
  affinity. The bundled Caddy configuration keeps editing connections open across a
  configuration reload. No schema change.

- 27dec1d: Docs arrives: spaces of pages your team writes together in real time, with comments, version
  history and live links to your issues. The module ships in the image, off until an admin
  enables it in Settings › Modules, and it works on its own: with Work disabled, or not in the
  image at all, every Docs screen and flow behaves the same, and issue chips print as their keys.

  **The Docs home and spaces.** /docs shows your spaces as cards, with their first pages, recent
  contributors and member count; the pages edited most recently, with where each sits
  ("Engineering / Architecture"), who last changed its text and the issues it references; your
  starred pages, drafts and pages in review; the templates to start from; and a Needs attention
  panel with the reviews you were asked for and the published pages you own that nobody has
  edited in `docs.staleAfterDays` (90 days by default). Before the first space exists the home is
  a short guide to making one. A space opens beside its page tree: open and close pages, drag a
  page above, below or into another (or use Alt and the arrow keys), rename with F2, star, copy a
  link, and move pages to the trash with Undo; each space has a trash to restore from. Whoever
  creates a space is its admin, a team's space includes the team, and space admins add and remove
  people and teams. Create › Page opens a picker with six built-in templates (RFC, meeting notes,
  postmortem, product spec, runbook and decision log); Create › Space is offered to people who
  hold "Create spaces". Pages also show in the ⌘K palette.

  **The doc editor.** A page opens with its place in the space, a status menu that walks the
  review flow (asking for review picks reviewers; publishing and archiving need publish rights),
  a save line ("Saved · Priya is editing"), who else is on the page, a star, Share and a menu to
  move or trash it. Type "/" for blocks: headings, lists, callouts, decisions, tables, images,
  code coloured by language, a table of contents, issue chips and issue tables from a saved
  filter. "[[" links a page and "#" finds an issue; with Work enabled, chips and tables show each
  issue's live status. An outline follows the text beside the body on wide screens, and the About
  panel holds status, owner, reviewers, labels and length. ⌘S says saving is automatic, ⌘. opens
  About and ⌘⌥M (Ctrl+Alt+M) comments on the selected words.

  **Writing together.** Two or more people edit one page at once, see each other's named cursors
  and never overwrite each other. Edits made offline stay in the tab and merge on return, undo
  only undoes your own changes, and people who may only view a space watch changes live. If the
  connection drops the save line says "Offline · changes kept", or "Reconnecting…" when the
  server is only taking a breath, and the page stays editable throughout.

  **Comments, history and linked work.** Comment on a whole page or on selected words; threads
  have replies, @mentions, edit and delete, and resolve or reopen. A comment follows its words
  through later edits and says "Text changed" when they go. A version is saved on publish, when
  you choose Save version, and every 30 minutes of editing; compare any two versions block by
  block, word by word and cell by cell, and restore one as a live edit that is itself kept as a
  version. Linked work lists the issues a page references with their live status, the records
  that reference it and the pages that link back, both ways and only what you may open.

  **Export and import.** Export a page as Markdown or self-contained HTML, or a page and its
  subpages as a zip. Import Markdown files and folders, or a Confluence space export, whose
  unknown macros become labelled blocks rather than being dropped; large imports run in the
  background. PDF export is not included yet.

  **Built to be quick and usable by everyone.** On a space of 1,000 pages the Docs home draws in
  about 70 ms after the app shell and a 20,000-word page paints in about 100 ms and is live in
  about 160 ms; typing stays under one frame. Every Docs screen is checked with axe against WCAG
  2.2 AA in light and dark (the theme's quieter text colours are the known exception), the tree,
  block menu, comments, status and history work from the keyboard alone, the save state is
  announced without chattering, and links in pages are underlined.

  Schema: enabling Docs runs the 15 changesets of its changelog, all additive. `0001-docs-spaces`
  (spaces, tied to the kernel's space membership tables), `0002-docs-templates`,
  `0003-docs-pages` (pages with tree paths, order, search and trigram indexes; it needs the
  `pg_trgm` extension, as Work does), `0004-docs-page-updates` (the Yjs update log),
  `0005-docs-page-state` (the compacted document), `0006-docs-page-revisions`,
  `0007-docs-page-comments`, `0008-docs-links` (the page and issue reference graph),
  `0009-docs-page-labels`, `0010-docs-page-stars`, `0011-docs-page-search-vector` (triggers that
  keep the search index), `0012-docs-default-templates` (seeds the six templates),
  `0013-docs-revision-tracking`, `0014-docs-space-members-backfill` (makes creators and team
  members members of spaces that predate membership) and `0015-docs-content-editor` (who last
  edited a page's body). Each is fast on a new install; each can be rolled back, and the rollback
  of `0014` keeps the memberships it added. Two workspace settings tune Docs:
  `docs.compactThreshold` (fold the update log after 500 updates) and `docs.staleAfterDays`.

### Patch Changes

- Updated dependencies [27dec1d]
- Updated dependencies [27dec1d]
- Updated dependencies [27dec1d]
  - @bemmoly/core@0.3.0
  - @bemmoly/module-work@0.3.0
  - @bemmoly/module-docs@0.3.0
  - @bemmoly/module-sample@0.3.0
  - @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/module-sample@0.2.2
  - @bemmoly/module-work@0.2.2
  - @bemmoly/core@0.2.2
  - @bemmoly/shared@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [ca5b2c4]
  - @bemmoly/module-work@0.2.1
  - @bemmoly/module-sample@0.2.1
  - @bemmoly/core@0.2.1
  - @bemmoly/shared@0.2.1

## 0.2.0

### Minor Changes

- d313831: The Work module ships in the image, off until an admin enables it in Settings › Modules.
  Enabling it runs its schema changelog, which creates the issue tracking tables (projects,
  issue types and fields, workflows, issues, links, labels, versions, components, sprints,
  boards, saved filters, comments, history, work logs, watchers, attachments and automation
  rules) and adds the pg_trgm extension for prefix search, which needs the database owner or a
  superuser to have created it on managed databases that do not allow trusted extensions. Once
  enabled, "Board" and "Backlog" appear in the top navigation as placeholders and the Work
  capabilities (create and configure projects; view, create, edit, move and delete issues;
  manage sprints; configure the board) appear in the roles matrix with their defaults. The
  screens and the API behind them arrive in later changes of this release. No configuration
  change.

### Patch Changes

- Updated dependencies [dcbcae4]
- Updated dependencies [7d09c70]
- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [c646c34]
- Updated dependencies [66e9507]
- Updated dependencies [83c390e]
- Updated dependencies [cab0760]
- Updated dependencies [a28fa79]
- Updated dependencies [80faa4d]
- Updated dependencies [158db6a]
- Updated dependencies [e2aa5d2]
- Updated dependencies [72bd7b9]
- Updated dependencies [e2aa5d2]
- Updated dependencies [d313831]
- Updated dependencies [7d09c70]
- Updated dependencies [b4f5ea9]
- Updated dependencies [9c7de90]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
- Updated dependencies [5935186]
- Updated dependencies [7d09c70]
  - @bemmoly/core@0.2.0
  - @bemmoly/module-work@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/module-sample@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/module-sample@0.1.7
  - @bemmoly/core@0.1.7
  - @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a13da15]
  - @bemmoly/core@0.1.6
  - @bemmoly/module-sample@0.1.6
  - @bemmoly/shared@0.1.6

## 0.1.5

### Patch Changes

- 0278663: Sign-in, password reset and invitation accept are now rate limited per account as well as per
  address. Before this fix, someone using many addresses could keep guessing one person's
  password, or keep sending them reset emails. Each account now gets 10 attempts per route every
  15 minutes, whether or not the address belongs to anyone, and the 11th gets `429 Too Many
Requests` with a `Retry-After` header. A real person locked out by someone else's guessing can
  sign in again when the 15 minutes are up. An address that keeps presenting session cookies or
  API tokens the server refuses is turned away for the rest of the minute after 60 refusals,
  before any more are checked; valid sessions and tokens never count against this.

  All limits stay on, and each maximum can now be set in the environment (empty keeps the
  default): `BEMMOLY_RATE_LIMIT_PER_USER` (API requests per person per minute, 600),
  `BEMMOLY_RATE_LIMIT_AUTH_PER_IP` (anonymous auth requests per address per route per minute, 10),
  `BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT` (attempts per account per route per 15 minutes, 10) and
  `BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP` (refused credentials per address per minute,
  60). Behind a reverse proxy, keep `BEMMOLY_TRUST_PROXY=true` so limits apply to client
  addresses rather than the proxy's. Also fixed: a few text helpers that could stall on unusual
  input with long runs of `/` or `@` now run in linear time. No schema change.

- Updated dependencies [0278663]
  - @bemmoly/core@0.1.5
  - @bemmoly/module-sample@0.1.5
  - @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [b98d0c0]
  - @bemmoly/core@0.1.4
  - @bemmoly/module-sample@0.1.4
  - @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/core@0.1.3
  - @bemmoly/module-sample@0.1.3
  - @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/core@0.1.2
  - @bemmoly/shared@0.1.2
  - @bemmoly/module-sample@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [a2b7f81]
  - @bemmoly/core@0.1.1
  - @bemmoly/module-sample@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [293b01b]
- Updated dependencies [b403d58]
- Updated dependencies [c7e5a48]
  - @bemmoly/core@0.1.0
  - @bemmoly/shared@0.1.0
  - @bemmoly/module-sample@0.1.0
