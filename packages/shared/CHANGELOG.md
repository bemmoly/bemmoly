# @bemmoly/shared

## 1.6.0

### Minor Changes

- d793d2c: A link to a page or an issue pasted into WhatsApp, Slack or any other chat app now previews with
  its title ("PLT-204 Fix login", "Cache plan") and the workspace's name, instead of a generic
  "Bemmoly". Chat apps fetch the link signed out, so anyone holding it sees the title, never the
  content. It is on by default; admins can turn it off under Settings › General › Sharing (the new
  `workspace.linkPreviews` setting). No schema change.

## 1.5.0

No changes in this release.

## 1.4.0

### Minor Changes

- 50337e9: Agents can attach files up to `BEMMOLY_UPLOAD_MAX_BYTES` (10 MiB by default) to Docs pages
  over MCP, not only the roughly 700 KB that fits inside one tool call. The new MCP tool
  `docs.create_upload_link` hands out a single-use upload address, valid for 15 minutes, for one
  file in one page; the agent sends the bytes to it with HTTP `PUT` (`curl -T`), then places the
  file with `docs.upload_file` and the returned `fileId`. The link acts only as the person and
  connection that asked for it, with the same checks as other uploads, and revoking the token or
  disconnecting the app ends it (ADR 0048). Schema: changeset `0505-file-upload-links` adds the
  `file_upload_links` table, fast and reversible. No configuration change.

### Patch Changes

- cfe109d: The server ships with patched releases of three libraries that had high severity denial of
  service advisories: zod 4.6.6 (validation of oversized collections could exhaust memory),
  body-parser 2.4.0 under the MCP endpoint (trailing bytes after a compressed body) and undici
  7.30.1 under the AI providers (excessive content encodings). No schema or configuration change.

## 1.3.0

### Minor Changes

- 5dae368: Pages can hold PDF and HTML files. Add one with the new File block (/file), or drop or paste
  it into a page; it shows as a preview with Expand to full screen, and images gain Expand too.
  Agents add files over MCP with `docs_upload_file`, at the end of a page or anywhere in its
  Markdown. HTML runs in a sandbox with an origin of its own: it may load scripts, styles, fonts
  and images over https but cannot send data anywhere, and opened outside a page it downloads
  instead of showing (ADR 0047). No schema or configuration change; uploads keep the
  `BEMMOLY_UPLOAD_MAX_BYTES` limit.
- 4fae3da: Issues can be archived. Archive an issue from its ··· menu, from a card's or row's menu, or from
  the bulk bar, and Undo puts it back. An archived issue leaves the board, the backlog, lists,
  search, My work and the roadmap, but still opens by its key and still counts in reports. Its page
  says it is archived and offers Unarchive. In a query, `archived IS NOT EMPTY` lists archived
  issues. Automation rules have a new Archive action.

  Schema: one changeset (0034) adds `issues.archived_at` and an index on archived issues. It is
  fast and reversible.

## 1.2.0

### Minor Changes

- c41a835: Command line tools sign in with a device code: `bp login` shows a code, you approve it on
  `/device` in a signed-in browser, and the tool receives an API token limited to its module
  for 90 days, listed in Settings › API tokens. The OAuth metadata now advertises
  `device_authorization_endpoint`. Schema: kernel changeset `0115-identity-oauth-device` adds
  the `oauth_device_codes` table. No new configuration keys.
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

## 1.1.0

No changes in this release.

## 1.0.0

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

### Patch Changes

- 05f614a: Long boards open faster and stay quiet under load. The board loads the first 50 cards of each
  column; the rest of a column loads as you scroll to its foot, or with "Show N more" there.
  Column counts and WIP limits still count every card, and drag and drop, the keyboard move,
  filters and swimlanes work as before. When someone changes an issue, every open board now
  fetches just that card and moves, updates, adds or removes it in place, instead of every
  viewer reloading the whole board; a burst of changes is gathered into one read, and the
  Backlog reloads once per burst rather than once per change. A card dropped at the end of a
  partly loaded column now lands right below the card it was dropped under.

  The web app's first load is about 30 kB (gzipped) lighter: Home, the settings-only API calls,
  the logo files, the icons the frame does not draw at first, the settings sidebar and the
  shortcuts and About dialogs now load when they are first needed.

  For API users: `GET /api/v1/work/boards/:id/view` now returns the first 50 cards of each column
  by default. Each column carries a `nextCursor`; pass `column` and `cursor` for that column's
  next page, `limit` (up to 500) for a larger page, or `issueIds` for only the named cards. No
  configuration or schema changes.

## 0.13.1

No changes in this release.

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

- 8d1901a: Workspace admins can now change Work's org defaults in Settings › Modules › Work: the issue
  types, fields, workflow and board (columns, swimlanes, quick filters, cards, sprints and
  estimation) that every project inherits until it overrides them. Each page says how many projects
  use the default and which have their own version. A change to the default board reaches every
  project still following it at once; a project that changed or overrode its board keeps its own.
  A project's Board, Issue types and Fields pages link workspace admins to the matching default,
  and Reset to default now makes a project follow the default again. Settings › Modules › Manage
  modules still turns modules on and off.

  Only workspace admins can change the org defaults; anyone else, including people with the Project
  admin workspace role, now gets a 403. Modules can declare their own settings page in their
  manifest (`settings: { path: '/settings/<id>' }`).

  Schema: one Work changeset, `0026-work-default-board`, seeds the org default board ("Workspace
  board") from the org default workflow on new and existing installs; it is quick and reversible.
  No configuration change.

### Patch Changes

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

- fb6b0e3: When the database is too busy to answer, requests now return the plain "temporarily unavailable"
  message with a Retry-After header, as intended. Two changes that landed together had left that
  error built the wrong way, so its message and code could come out wrong.

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

### Patch Changes

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

## 0.11.0

### Patch Changes

- 50fff66: Appearance moves out of the sidebar's person menu into a small Appearance button beside your
  name (stacked above your avatar on the collapsed rail). It offers Light, Dark and Match system.

  Only a workspace admin now sets the theme. Personal themes are retired: `PUT /me/appearance`
  refuses a theme with 403 and stores only the mode, a personal theme saved before is ignored, and
  personal custom themes can no longer be created. In Settings › Appearance, people who are not
  admins see the workspace theme read-only beside their own mode. The "Let people pick their own
  theme" switch is gone; `appearance.personalThemes` is now inert and always reported as false.
  No schema change.

## 0.10.0

### Minor Changes

- e6982a1: Redesigned sign-in. Every page before sign-in has a form column and, on wide screens, a glimpse
  of the product in the workspace's own theme and mode. Bemmoly appears once: its lockup leads
  when there is no custom logo; with one, the customer's logo leads and "Powered by Bemmoly" sits
  at the foot. Single sign-on comes first, with the provider this device used last marked and
  focused; when single sign-on is required, admins kept as a fallback sign in at
  `/login?method=password`. Errors say what happened: a wrong password marks the field, a rate
  limit counts down, a deactivated account says who can turn it back on, a server that is down is
  retried every 20 seconds without losing what was typed, and a refused single sign-on names the
  provider. Signing out or an ended session says why and remembers the person on this device.
  Forgot password carries the email over and offers a resend; reset names the account, takes one
  password with a strength meter and signs in when saved; invitations accept through the provider
  when single sign-on is set up. An admin whose setup is unfinished is welcomed on first sign-in
  and can skip setup, with the remaining steps on Home. New: `PasswordInput` and a `touch` size in
  `@bemmoly/ui`; setup status adds `theme` and `defaultMode`; `POST
/api/v1/auth/password-reset/preview`; completing a reset returns the user and a session; sign-in
  refusals carry a `reason`. No schema or configuration change.

## 0.9.0

### Minor Changes

- 250098f: Workspace logo upload. Admins with the appearance capability can upload a PNG, SVG or WebP logo
  in Settings › Appearance (up to 1 MB, square or near-square, at least 128 px; SVGs with scripts
  or links are refused), with a live preview of the sidebar and the collapsed rail in light and
  dark, and Replace and Remove with Undo. The logo takes line one of the sidebar ("on Bemmoly"
  stays under it), leads the collapsed rail with the Bemmoly mark at its foot, leads the sign-in
  page above "Powered by Bemmoly", and appears in emails when the workspace URL is https. The
  favicon and tab title stay Bemmoly. New endpoints: `POST` and `DELETE /api/v1/workspace/logo`,
  and an anonymous, cached `GET /api/v1/workspace/logo/:file`; setup status now includes
  `logoUrl`. No schema or configuration change.

## 0.8.0

### Minor Changes

- 31f9a87: Themes and modes. The eight presets become five themes, each designed in light **and** dark:
  Bemmoly (the default, the logo's blue), Graphite, Sand, Pine and High contrast. Mode is now its own
  choice: Light, Dark or Match system, which really follows the computer's setting, live. Each
  person's mode is saved on their account and follows them to every device; the workspace sets the
  default theme and the default mode (new workspaces follow the system). The typeface is a separate
  setting. Admins can make a **custom theme** from one brand colour and a surface style: Bemmoly
  builds checked light and dark versions, adjusts them until text and buttons pass contrast, warns
  when the colour is close to one that already means something (errors, warnings, done, AI), and
  never recolours the logo. A custom theme can be the workspace default, and when personal themes
  are on, people can pick any theme, or make their own, from the user menu. In dark mode Task and
  Epic tiles are lighter so they stay readable.

  Upgrading changes nobody's look: Classic, Dark, Midnight, Ocean and Rose become Bemmoly in their
  old mode, Slate becomes Graphite, Warm becomes Sand and Forest becomes Pine; each workspace keeps
  its mode as the default mode and keeps its typeface. A custom brand colour becomes a workspace
  custom theme. Choices saved in a browser move to the account on the next sign-in.

  Admins: the schema adds the kernel changeset `0600-appearance-themes` (the `custom_themes` and
  `user_appearance_preferences` tables, and a rewrite of the stored `appearance.*` settings). It is
  reversible and quick. New settings: `appearance.defaultMode` and `appearance.customThemeId`.
  `appearance.mode`, `appearance.surfaces` and `appearance.memberModeSwitch` are no longer used and
  will be removed in a later release. New endpoints: `GET`/`PUT /api/v1/me/appearance` and
  `/api/v1/themes`. The demo takes `?theme=pine&mode=dark`.

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

- c4215a9: The updater now moves itself to the release it installs, verified with cosign like the app image, so updater fixes reach existing installs (ADR 0020). `bemmoly upgrade` does the same, and `bemmoly sync-updater` moves an older updater once. Clicking Update opens a dialog with each step's live status; every admin sees a running update, a second one is refused, and the page reloads onto the new version when it is ready.

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

- fc28637: Settings › Roles no longer lists "Manage billing and license". Nothing ever checked it, and
  Bemmoly has nothing to buy. Schema: the kernel changeset `0109-identity-drop-billing-capability`
  deletes the stored grants of `workspace.billing.manage` on update; it is quick and reversible.
- 9911c5f: New page now makes the page where you are and opens it with the cursor in the title, with Undo in the toast. An empty page offers the space's templates and an import, and N creates a page from the Docs home and from a space.

  The Docs home opens with Jump back in, a single list with Recent, Starred, My drafts and For review, and Needs you beside it. A space's overview now shows Start here, what is waiting in review, its top-level pages and who changed what. An empty space asks for its first page.

  The trash shows who deleted each page and where it was, and lets you preview a page before restoring it. Space and workspace admins can delete a page forever or empty the trash, after typing a confirmation. Pages are now deleted for good 30 days after they go to the trash, by a nightly background job.

  ⌘K shows pages with their icon, where they live and the line that matched. Inside a space, it searches that space first.

  Export… offers Markdown, HTML or PDF (through your browser's Save as PDF). Import lets you choose the page the imported pages go under, and lists what each file became.

  Schema: none. New endpoints: `DELETE /api/v1/docs/spaces/:spaceKey/trash` and `DELETE /api/v1/docs/spaces/:spaceKey/trash/:pageId`.

## 0.4.0

### Minor Changes

- 8f4df5f: The Board can now select cards like the Backlog: tick a card's corner, Shift-click for a range or
  ⌘-click for one more, and the same bar assigns, sets priority, moves to a sprint or deletes them
  with Undo. A Display menu on the Board lets each person choose the card fields, a compact density
  and whether empty columns show; it never changes the board for anyone else.

  Assigning, changing priority and moving to a sprint from a card, a row, the issue menu or the bulk
  bar now shows at once, dims the issue until the server answers, puts it back if the change is
  refused, and offers Undo. The Board, Backlog and Issue page show who else is looking at them.
  Issues can be linked from their menu on the Board and Backlog.

  Every icon button has the same tooltip, with its shortcut. Epics keep their colour on every
  screen, project and space tiles are drawn the same everywhere, and labels that shouted in
  capitals are now in sentence case. On a phone the Backlog keeps each issue's title and the
  sprint's name, and Board lanes keep the epic's name. Home's My issues moves with j and k, an issue
  created over a Scrum board joins the running sprint, and the loading screen follows the theme you
  last used.

  Someone who opens an issue in a project they are not a member of is now told so, and who can add
  them, instead of being told the server did not answer.

  Live updates and presence over the realtime connection are now limited to the people who can open
  the project or space, as the project and space lists already were.

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 51cd3ae: Add the Bemmoly Query Language (LQL) parser that the Work module's filter bar, swimlane
  queries, saved filters and automation conditions share. A query such as
  `project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC`
  is parsed into a syntax tree, checked against the issue fields (project, key, type, status,
  status category, priority, assignee, reporter, parent, epic, sprint, estimate, due, created,
  updated, fix version, label, text and `cf.<key>` for custom fields), and printed back in a
  canonical form so saved filters are stored one way. Mistakes come back with the exact position
  and what was expected, so the filter bar can underline them, and autocomplete offers the
  fields, operators, keywords and values that fit where the cursor is. Compiling a query to SQL
  lives in the Work module, not here. No configuration or schema change.

### Patch Changes

- e2aa5d2: The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
  from search providers that modules register with `ctx.search.addProvider`; it asks only the
  modules a person can open, and each provider keeps to what that person may see. Work answers
  with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
  "Issues" group and scope. No configuration or schema change.

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

### Patch Changes

- 8337385: People you invite join as Viewer, the least-privileged role, unless you pick another role:
  in the setup wizard, in Users › Invite people, for a new team's default role and through the
  API, where `roleId` is now optional on `POST /api/v1/invitations`. Invited people now appear
  in Users as INVITED rows and count as invited, with Resend, Copy invite link and Revoke.
  After sending invitations, Bemmoly shows each person's sign-up link to copy and share, and
  says so plainly when outbound email is not set up yet; Copy invite link issues a fresh link
  later (the old one stops working). Invitation and password reset emails now link to pages
  that exist (`/accept-invitation` and `/reset-password`); links sent by earlier versions open
  a missing page, so resend those invitations or copy a new link. No configuration or schema
  change.
- 8337385: Fresh installs start with no module enabled. A module runs only once an admin enables it in
  Settings › Modules (or lists it in `BEMMOLY_MODULES`, which still pins the set). Enabling a
  module now asks "Who can use it?": Nobody yet (recommended; only org admins can open it),
  Everyone, or Specific teams. Nothing is granted that the admin did not choose; the access a
  module suggests is shown as a hint only. Access can be changed later under Users › Module
  access, and the audit log records the access chosen on enable. `bemmoly-db modules enable`
  takes `--access none|everyone|teams` and `--team <id>`, and defaults to none. The Sample
  module is a developer example: it stays in the image but is off until enabled and suggests no
  access. Existing installs keep the modules and grants they have; to turn Sample off, use
  Disable in Settings › Modules. No configuration or schema change.

## 0.1.1

No changes in this release.

## 0.1.0

### Minor Changes

- b403d58: Add email and in-app notifications. Every email goes through an outbox that retries with
  backoff and shows failures in plain words to admins; SMTP and a development `log` provider
  are built in, with a test send that checks SPF and DMARC. Emails are themed from the
  workspace brand colour and logo, say why they were sent, and carry a one-click unsubscribe
  link. Notifications land in the inbox and follow each person's preference per kind: email at
  once, a digest every few minutes or once a day, in-app only, or off.

  Schema: changesets `0200-email-outbox`, `0201-notifications` and
  `0202-notification-preferences` add `email_outbox`, `notifications`,
  `notification_preferences` and `notification_schedules`. Settings: `email.provider`
  (default `log`), `email.smtp.host`, `email.smtp.port`, `email.smtp.security`,
  `email.smtp.username`, `email.smtp.password` (secret), `email.from`, `email.replyTo`,
  `email.digestMinutes`.
