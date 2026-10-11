# @bemmoly/api-client

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

### Patch Changes

- Updated dependencies [31f9a87]
  - @bemmoly/shared@0.8.0

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
  - @bemmoly/shared@0.7.0

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

### Patch Changes

- Updated dependencies [4e0e170]
- Updated dependencies [4cbf7a1]
- Updated dependencies [c4215a9]
  - @bemmoly/shared@0.6.0

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
- Updated dependencies [fc28637]
- Updated dependencies [9911c5f]
  - @bemmoly/shared@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [8f4df5f]
  - @bemmoly/shared@0.4.0

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

- @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/shared@0.2.2

## 0.2.1

### Patch Changes

- @bemmoly/shared@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
  - @bemmoly/shared@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- @bemmoly/shared@0.1.6

## 0.1.5

### Patch Changes

- @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- b98d0c0: Settings › Updates has a "Check for updates" button that fetches the release list right away instead of waiting for the daily check, and the page says plainly when the list has never been fetched or the last check failed, rather than claiming you are on the latest release.
- @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- 04c4f3a: Settings pages no longer let a stray click change something. Storage and backups, Updates, Email
  and notifications and Workspace details open showing your current values; each section has an
  Edit button, and Save stays off until you change something. Changes that can lose backups or
  stop people working (lowering retention, removing the backup bucket, turning off local
  encryption, switching the update channel, sending email to the dev mailbox) say what will happen
  before they are saved, and the riskiest ask you to type a word to confirm. If you leave a page or
  have two sections open with unsaved changes, a bar at the bottom says so.

  Restoring a backup is easier to find: every backup that can be restored has a Restore button, a
  Restore… button at the top of Storage and backups lets you pick one, and the confirmation explains
  maintenance mode, what is replaced and the fallback copy kept of your current data. The backups
  table scrolls sideways on narrow screens instead of cutting off its buttons.

  The top bar no longer shows arrows on links that do not open a menu. Create opens a clear menu of
  what you can make, or explains that it fills once a module is enabled, with a link to Settings ›
  Modules for admins. Icons across the app are clearer, including real Inbox and theme icons in the
  top bar, and dropdown arrows are larger and darken while open. The Team filter in Settings › Users
  can be searched, and abandoned people searches stop instead of finishing in the background.

- @bemmoly/shared@0.1.3

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
- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/shared@0.1.2

## 0.1.1

### Patch Changes

- @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
