# @bemmoly/deploy

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

- c5849e4: Queue depth counts only jobs that can run now: `bemmoly_job_queue_depth` and `bemmoly status`
  no longer include scheduled jobs such as digests, which show apart as
  `bemmoly_job_queue_delayed` and `queueDelayed`. `bemmoly sync-updater` no longer prints an older
  updater's usage line or restarts the app. `bemmoly doctor` warns when Postgres is tuned for a
  different machine size, and the new `bemmoly tune` re-applies the tuning after a resize, asking
  before it restarts the database.
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

- 2632307: Faster under load on small machines. Creating an issue reads the end of the backlog from the
  board index alone (live issues only; a restored issue that would share a rank moves to the
  end) and takes its number in one statement, still gap-free. The page tree and page placement
  in Docs now use their index for top-level pages. Authorization answers are shared across
  requests for up to five seconds and dropped as soon as a role, membership, grant, person or
  API token changes: kernel changeset `0114-identity-authz-notify` adds triggers that notify
  `bemmoly_authz` on commit (ADR 0036). The database pool is sized from the CPU count (four per
  CPU, 10 to 40) unless `BEMMOLY_DB_POOL_MAX` sets it; the Helm chart sets `databasePoolMax: 10`
  per pod.

## 0.13.1

No changes in this release.

## 0.13.0

### Minor Changes

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

## 0.12.0

### Minor Changes

- b769aed: The host `bemmoly` command now follows the release it manages. Until now only the installer
  wrote it, so an install that was upgraded kept the command it started with, and newer commands
  such as `sudo bemmoly sync-updater` answered "Unknown command".

  - `sudo bemmoly upgrade` moves the command to the new release once the app runs it, from the
    release's new `bemmoly-cli-X.Y.Z.tar.gz`, after cosign verifies the signed
    `release-manifest.json` and the tarball matches the checksum listed there. A command that
    cannot be verified is refused and never fails the upgrade.
  - In-app updates: the updater leaves its release's command in `/var/bemmoly/cli-update`, and the
    next `sudo bemmoly …` installs it before running.
  - `sudo bemmoly self-update [version]` refreshes the command on demand; `--from FOLDER` uses an
    extracted air-gap bundle, which now carries the command and the signed manifest.
    `sudo bemmoly version` prints the command's, the app's and the updater's versions.
  - `install.sh --refresh-cli` replaces only the command and leaves the app, its images and
    `.env` untouched. An install whose command is older than this runs it once:
    `curl -fsSL https://get.bemmoly.com | sh -s -- --refresh-cli`.

  No schema change. No new required configuration; `COSIGN_PUBLIC_KEY` and `BEMMOLY_RELEASES_URL`
  in `.env` are optional, for forks that sign with a key and for release mirrors. The release
  manifest gains an optional `cli` field (ADR 0024).

- 0194a84: Work descriptions and comments that arrive as Markdown typed into plain lines (from the API, an
  AI client or a CSV import) now show as headings, lists, code and tables; the parsed version is
  saved only once someone edits it. While editing a card's description, a grip beside the hovered
  line drags that block to a new place.

  When a domain is set, the installer checks whether it already points at the server and, if not,
  prints the A record to add, with a Cloudflare link when the zone is on Cloudflare. The install
  carries on either way.

  An issue open in the Board's side panel no longer lets the page scroll into blank space.
  No schema or configuration change.

### Patch Changes

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

## 0.11.0

No changes in this release.

## 0.10.0

No changes in this release.

## 0.9.0

No changes in this release.

## 0.8.0

No changes in this release.

## 0.7.0

No changes in this release.

## 0.6.0

### Minor Changes

- c4215a9: The updater now moves itself to the release it installs, verified with cosign like the app image, so updater fixes reach existing installs (ADR 0020). `bemmoly upgrade` does the same, and `bemmoly sync-updater` moves an older updater once. Clicking Update opens a dialog with each step's live status; every admin sees a running update, a second one is refused, and the page reloads onto the new version when it is ready.

## 0.5.0

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

No changes in this release.

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

## 0.1.5

No changes in this release.

## 0.1.4

No changes in this release.

## 0.1.3

No changes in this release.

## 0.1.2

No changes in this release.

## 0.1.1

No changes in this release.

## 0.1.0

No changes in this release.
