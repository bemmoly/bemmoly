# @bemmoly/module-docs

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

- ad16b63: MCP and the palette can browse and write Docs: `docs.list_spaces`, `docs.list_tree`,
  `docs.create_page` and `docs.update_page` (Markdown bodies), `docs.get_page` with an optional
  Markdown body, and page search that also matches a space's key or name.
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

- 3ff8f77: **Large imports no longer create duplicate pages.** A Markdown file import, or an Import from Confluence, of more
  than 200 pages saved its pages, then failed while telling open screens about them, and each
  retry imported the pages again, up to three times. Realtime updates of any size now go out in
  batches. A failed update after the data is saved is logged and counted in
  `bemmoly_realtime_publish_errors_total` and no longer fails the job. A retried import job now
  finds what an earlier run wrote and does not write it again. The importers for Import from Confluence, Import from Jira, CSV and AI
  clients (MCP) now record each page, issue, comment, board and sprint in the same
  transaction that creates it, so a resumed import does not create these twice.

  Schema: Docs adds the `page_imports` table (changeset `0018-docs-page-imports`), which is
  additive and safe to roll back. No configuration change. Imports that already ran with
  duplicates are not cleaned up automatically. Find the extra copies in the page tree and delete
  them.

- 2632307: Faster under load on small machines. Creating an issue reads the end of the backlog from the
  board index alone (live issues only; a restored issue that would share a rank moves to the
  end) and takes its number in one statement, still gap-free. The page tree and page placement
  in Docs now use their index for top-level pages. Authorization answers are shared across
  requests for up to five seconds and dropped as soon as a role, membership, grant, person or
  API token changes: kernel changeset `0114-identity-authz-notify` adds triggers that notify
  `bemmoly_authz` on commit (ADR 0036). The database pool is sized from the CPU count (four per
  CPU, 10 to 40) unless `BEMMOLY_DB_POOL_MAX` sets it; the Helm chart sets `databasePoolMax: 10`
  per pod.
- ad6dd60: An accessibility pass to WCAG 2.2 AA across the product. Every signed-in screen starts with a
  **Skip to content** link, and every screen has a level-one heading. Backlog rows are grid rows,
  and a keyboard move there now says where the row landed. Small targets (removing a label, the
  actions under a comment, Assign to me) are at least 24px. Muted text stays readable on selected
  rows in Inbox and ⌘K, and amber avatars are a shade darker so their initials meet 4.5:1. Links
  inside a sentence are underlined. A WCAG audit of every screen, in all five themes, light and
  dark, desktop and phone, now runs in CI; `docs/accessibility-conformance.md` says what is
  covered and how to report a problem.
- Updated dependencies [981bce2]
- Updated dependencies [05f614a]
- Updated dependencies [aa811e8]
- Updated dependencies [17674ec]
- Updated dependencies [a00717d]
- Updated dependencies [3ff8f77]
- Updated dependencies [c5849e4]
- Updated dependencies [1e9cdf9]
- Updated dependencies [2632307]
- Updated dependencies [903e416]
- Updated dependencies [f5efb20]
- Updated dependencies [ad6dd60]
  - @bemmoly/core@1.0.0
  - @bemmoly/ui@1.0.0
  - @bemmoly/api-client@1.0.0
  - @bemmoly/shared@1.0.0
  - @bemmoly/editor@1.0.0
  - @bemmoly/core-web@1.0.0

## 0.13.1

### Patch Changes

- Updated dependencies [9288d90]
  - @bemmoly/ui@0.13.1
  - @bemmoly/core@0.13.1
  - @bemmoly/core-web@0.13.1
  - @bemmoly/editor@0.13.1
  - @bemmoly/api-client@0.13.1
  - @bemmoly/shared@0.13.1

## 0.13.0

### Minor Changes

- 50cfe36: Org admins can now manage the templates every space offers in Settings › Docs. The page lists
  the org-wide templates with how many pages each started and who added it, searches them, sets
  the order the template picker shows, archives a template with Undo (it leaves every picker until
  restored) and restores archived ones. A template opens a preview of its body and the fields its
  page form asks for; custom templates edit in place, with a name, description, category, icon,
  fields and body. The six built-in templates are now read only: they can be ordered, archived or
  duplicated into an editable copy, and edits an install made to them before this release are
  kept. Spaces keep their own templates.

  A new Docs permission, "Manage org templates" (`docs.templates.manage`), on for org admins only
  by default, gates these changes; anyone else gets a 403. Org templates were previously changed
  under "Manage workspace settings". No configuration or schema change.

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

- Updated dependencies [004ebc2]
- Updated dependencies [b40f43b]
- Updated dependencies [2a65f20]
- Updated dependencies [daf0ccc]
- Updated dependencies [c7db7da]
- Updated dependencies [2191962]
- Updated dependencies [fb6b0e3]
- Updated dependencies [53e1640]
- Updated dependencies [8d1901a]
  - @bemmoly/ui@0.13.0
  - @bemmoly/core@0.13.0
  - @bemmoly/shared@0.13.0
  - @bemmoly/api-client@0.13.0
  - @bemmoly/core-web@0.13.0
  - @bemmoly/editor@0.13.0

## 0.12.0

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

- Updated dependencies [b769aed]
- Updated dependencies [403ef1d]
- Updated dependencies [7ca4a6a]
- Updated dependencies [0194a84]
- Updated dependencies [ea2125f]
- Updated dependencies [51ca8f4]
  - @bemmoly/shared@0.12.0
  - @bemmoly/core-web@0.12.0
  - @bemmoly/core@0.12.0
  - @bemmoly/ui@0.12.0
  - @bemmoly/api-client@0.12.0
  - @bemmoly/editor@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [50fff66]
- Updated dependencies [1aca27c]
  - @bemmoly/core@0.11.0
  - @bemmoly/shared@0.11.0
  - @bemmoly/ui@0.11.0
  - @bemmoly/api-client@0.11.0
  - @bemmoly/core-web@0.11.0
  - @bemmoly/editor@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [e6982a1]
  - @bemmoly/core@0.10.0
  - @bemmoly/shared@0.10.0
  - @bemmoly/api-client@0.10.0
  - @bemmoly/ui@0.10.0
  - @bemmoly/core-web@0.10.0
  - @bemmoly/editor@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [250098f]
  - @bemmoly/core@0.9.0
  - @bemmoly/shared@0.9.0
  - @bemmoly/api-client@0.9.0
  - @bemmoly/core-web@0.9.0
  - @bemmoly/editor@0.9.0
  - @bemmoly/ui@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [31f9a87]
  - @bemmoly/ui@0.8.0
  - @bemmoly/core@0.8.0
  - @bemmoly/shared@0.8.0
  - @bemmoly/api-client@0.8.0
  - @bemmoly/editor@0.8.0
  - @bemmoly/core-web@0.8.0

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

### Patch Changes

- Updated dependencies [8559222]
- Updated dependencies [65c412a]
  - @bemmoly/core@0.7.0
  - @bemmoly/shared@0.7.0
  - @bemmoly/api-client@0.7.0
  - @bemmoly/core-web@0.7.0
  - @bemmoly/editor@0.7.0
  - @bemmoly/ui@0.7.0

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
  - @bemmoly/api-client@0.6.0
  - @bemmoly/editor@0.6.0
  - @bemmoly/ui@0.6.0
  - @bemmoly/core-web@0.6.0

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

- 43c54ed: New issue opened from the sidebar while a board was still loading could start in the wrong
  project, then close itself and its open project picker a moment later. It now starts in the
  project the address names and stays open. Workspaces with more than 100 projects, or more than
  200 Docs spaces, now see all of them in the switcher, the pickers, the sidebar and their screens.

  Ask your docs suggests questions about your own recent pages, or none in a new workspace. An
  answer's source line reads "by AI", a comment's suggested fix uses the standard AI suggestion card
  with Apply fix and Not useful on it, and a Docs page's browser tab shows the page's name.

- 9911c5f: New page now makes the page where you are and opens it with the cursor in the title, with Undo in the toast. An empty page offers the space's templates and an import, and N creates a page from the Docs home and from a space.

  The Docs home opens with Jump back in, a single list with Recent, Starred, My drafts and For review, and Needs you beside it. A space's overview now shows Start here, what is waiting in review, its top-level pages and who changed what. An empty space asks for its first page.

  The trash shows who deleted each page and where it was, and lets you preview a page before restoring it. Space and workspace admins can delete a page forever or empty the trash, after typing a confirmation. Pages are now deleted for good 30 days after they go to the trash, by a nightly background job.

  ⌘K shows pages with their icon, where they live and the line that matched. Inside a space, it searches that space first.

  Export… offers Markdown, HTML or PDF (through your browser's Save as PDF). Import lets you choose the page the imported pages go under, and lists what each file became.

  Schema: none. New endpoints: `DELETE /api/v1/docs/spaces/:spaceKey/trash` and `DELETE /api/v1/docs/spaces/:spaceKey/trash/:pageId`.

- 0abb59e: Writing a Docs page now feels like a writing tool. Select words and a bubble offers Text (turn the
  block into a heading, list, quote or code), bold, italic, strikethrough, code, link and highlight,
  then Comment, and Ask AI when the workspace has AI on. ⌘K adds a link in place: paste an address
  or search pages and issues. Highlight is new (⌘⇧H or ==text==); pages written before it open
  unchanged.

  Every block has a + and a grip in the margin on hover, or after Esc selects it: + adds a block
  and opens the / menu there, the grip drags the block to a new place and opens Turn into,
  Duplicate, Copy link to block (for headings) and Delete, which can be undone from the toast.
  ⌥⇧↑ and ⌥⇧↓ move a block, ⌘D duplicates it.

  The / menu is grouped (Basic blocks, AI, Insert, From Work), shows each block's icon, a short
  description and its Markdown shortcut, has a Text row, and opens below the caret unless there is
  truly no room. Code blocks show their language, which writers can change, and a Copy button.
  Table tools are icon buttons with tooltips.

  Issues inside a page read like Work: inline issues show the type, key, title and a status glyph
  instead of a capitalised pill, and a new Issue card block shows status, priority, assignee,
  sprint and epic, live. Linked work lists the issues in the page with how far along they are, the
  issues and pages that link here, and shows an issue once even when it appears in both lists.

  A browser tab still open on the previous release can't show Issue card blocks; refresh it after
  updating.

- a85ffa6: Docs now lives in the same frame as the rest of Bemmoly. Spaces are rows in the sidebar's Docs
  section, and the space you are in opens to its page tree right there: drag pages to reorder or
  nest them, use Alt and the arrow keys, rename with F2, and add a page inside another with its +.
  A right-click opens the same menu as the row's ···. Double-click a space, or press F on it, to
  give it the whole section with a filter; Esc gives every space back. Which pages are open, and
  which space is focused, are remembered for each person. The page tree column inside a space, the
  "pages" bar on phones and the space switcher are gone.

  Every Docs screen uses the one header: a page's trail reads space, parents and page, each a link,
  with its status as a menu right after it. Docs home, a space's overview and its trash use the
  reading column; a page keeps its own 700px column. A page, space or list that fails to load
  stays in the frame, keeps the sidebar and offers Try again, as does the sidebar's filter.

  The page summary (TL;DR) and suggested fixes on comments appear only when the workspace has AI
  turned on, in the AI colour. With AI off, nothing AI is shown.

- eb5e3bb: A Docs page now has a face and a margin. Pages take a drawn icon in one of eight tints and an
  optional drawn cover, both chosen in place, and covers can be undone. One row of properties under
  the title (status, owner, reviewers, labels, when it was edited and how long it takes to read)
  replaces the chips and the About panel, and every value edits where it is shown. One right margin
  shows the outline, the comments or the linked work, chosen from header buttons with counts
  (⌘⌥O, ⌘⌥C, ⌘⌥L). Comments get a marker beside each anchored line, and threads sit level with
  their passages; resolving a thread can be undone, and J, K, R and E work from the keyboard.
  Version history is now a mode of the page (⌘⌥H) with a day-grouped timeline, and Restore happens
  at once with Undo instead of asking first. Share says who can see the page and copies its link.
  Collaborators' caret names fade after three seconds still.

  Schema: adds a nullable `cover` column to `pages` (changeset `0016-docs-page-cover`). It is
  reversible and the previous minor ignores it.

- 15ee6eb: Using a template from inside a new page fills that page instead of making a second one, so no "Untitled" page is left in the trash. A page shows its status once, in the header, and reviewers are picked in a popover that saves as you tick.

  Focus mode on a space now takes the whole sidebar. A page can be duplicated, or moved, from its row in the sidebar or from its ··· menu, and on a page N makes a page beside it and Shift+N one inside it. Each Docs screen lists its shortcuts in the ? overlay.

  The header and the margin fade while you type and come back when you move the pointer. The page column sits in the middle of the page with the outline beside it, the title is drawn at the review's size again, and on a phone the header keeps room for the page's name. Start here lists the pages the space's home page links to.

  A page made from another page no longer opens on an error screen, and a missing page names itself in the header trail.

  Schema: none. Endpoints: none.

- Updated dependencies [0a04d0d]
- Updated dependencies [43c54ed]
- Updated dependencies [db35948]
- Updated dependencies [fc28637]
- Updated dependencies [9911c5f]
- Updated dependencies [0abb59e]
- Updated dependencies [a85ffa6]
- Updated dependencies [eb5e3bb]
- Updated dependencies [15ee6eb]
- Updated dependencies [5321f9d]
  - @bemmoly/core@0.5.0
  - @bemmoly/shared@0.5.0
  - @bemmoly/api-client@0.5.0
  - @bemmoly/core-web@0.5.0
  - @bemmoly/ui@0.5.0
  - @bemmoly/editor@0.5.0

## 0.4.0

### Minor Changes

- 2ab05df: Bemmoly takes on its logo's colours and a quieter visual system. The accent is the logo blue
  (the mid blue in dark mode), AI is the logo lilac and nothing else, and epics have their own
  violet. Every text grey now reads at 4.5:1 or better on every surface in every theme, so muted
  text that was hard to read is fixed everywhere at once, and the Midnight and Ocean themes get
  readable primary buttons. Type, radii and shadows are fewer and consistent.

  Icons are drawn instead of typed, so they look the same on every computer: issue types are
  tiles with a drawn mark, priority is three neutral bars with only the most urgent level in red,
  and keyboard shortcuts are drawn keys ("Ctrl" off Apple platforms). Custom issue types show
  their own icon and colour instead of a task's, and Settings › Issue types shows every type's
  icon rather than a stored character. Status pills follow their category, so In review and QA
  read as in progress (blue). Avatars are solid colours with white initials, labels are outlined
  pills with their own colour, and project, team and module tiles share one shape.

  Workspace logo colours no longer recolour the Bemmoly mark under a custom theme. Tooltips name
  their shortcut, deleting something reversible shows Undo for six seconds, relative times show
  the full date on hover, and every keyboard focus shows the same ring.

  Workflow status colours stored by earlier versions are drawn as their nearest new colour, and
  the issue type icon field now takes an icon name of up to 40 characters. No configuration or
  schema change.

- 259e195: Every signed-in screen now sits in one frame: a sidebar with the Bemmoly mark and your workspace,
  Search and New, Home, Inbox and My issues, then Work's projects with their Board, Backlog and
  Settings and Docs' spaces, with Settings, Help, the version and your account at the foot. The top
  bar is gone. Press `[` to fold the sidebar to a narrow rail (it remembers), and on a phone the
  sidebar opens from the menu button with a bottom bar for Home, Inbox, New and My issues. Settings
  use the same sidebar, and Esc takes you back to where you were.

  Creating opens over the page you are on instead of taking you elsewhere. ⌘K shows what you opened
  recently and what the current screen can do, Tab filters it by type, and `?` lists every
  shortcut, including C for a new issue, `/` to search and G chords to move between places.

  The Inbox is a two-pane triage view: Mentions, Reviews and Assigned segments, items grouped by
  day, the issue itself beside each item, and J/K to move, E to mark done and S to snooze, each
  with Undo. Home shows your issues by status, the inbox and the current sprint, and an issue
  opened from either steps through that list with J and K. Sign-in pages lead with your workspace
  and say "Powered by Bemmoly", tab titles name the page and the workspace, and a missing or broken
  page stays inside the frame with a way back. Once a workspace logo can be uploaded, it leads the
  sidebar with "on Bemmoly" under it. No configuration or schema change.

### Patch Changes

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

- Updated dependencies [e7df029]
- Updated dependencies [ab5214d]
- Updated dependencies [2ab05df]
- Updated dependencies [8f4df5f]
- Updated dependencies [bb4a602]
- Updated dependencies [e5697e8]
- Updated dependencies [d568104]
- Updated dependencies [259e195]
  - @bemmoly/ui@0.4.0
  - @bemmoly/core-web@0.4.0
  - @bemmoly/editor@0.4.0
  - @bemmoly/core@0.4.0
  - @bemmoly/shared@0.4.0
  - @bemmoly/api-client@0.4.0

## 0.3.0

### Minor Changes

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
- Updated dependencies [27dec1d]
  - @bemmoly/core@0.3.0
  - @bemmoly/core-web@0.3.0
  - @bemmoly/editor@0.3.0
  - @bemmoly/ui@0.3.0
  - @bemmoly/api-client@0.3.0
  - @bemmoly/shared@0.3.0
