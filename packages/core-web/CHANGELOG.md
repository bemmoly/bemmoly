# @bemmoly/core-web

## 1.4.0

### Patch Changes

- Updated dependencies [cfe109d]
- Updated dependencies [7e9b170]
- Updated dependencies [b72b9e0]
- Updated dependencies [50337e9]
  - @bemmoly/shared@1.4.0
  - @bemmoly/ui@1.4.0
  - @bemmoly/api-client@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [5dae368]
- Updated dependencies [4fae3da]
  - @bemmoly/shared@1.3.0
  - @bemmoly/ui@1.3.0
  - @bemmoly/api-client@1.3.0

## 1.2.0

### Patch Changes

- bee8b7b: The sidebar now shows Work and Docs as separate areas. Each has its own header row, and the one
  you are in is highlighted. Links that cover the whole area (All projects, Roadmap, Docs home) now
  sit at the top of their section, above the list of projects or spaces.
- Updated dependencies [c41a835]
- Updated dependencies [33f0341]
- Updated dependencies [c41a835]
- Updated dependencies [f471fce]
  - @bemmoly/shared@1.2.0
  - @bemmoly/api-client@1.2.0
  - @bemmoly/ui@1.2.0

## 1.1.0

### Patch Changes

- @bemmoly/api-client@1.1.0
  - @bemmoly/shared@1.1.0
  - @bemmoly/ui@1.1.0

## 1.0.0

### Minor Changes

- ad6dd60: An accessibility pass to WCAG 2.2 AA across the product. Every signed-in screen starts with a
  **Skip to content** link, and every screen has a level-one heading. Backlog rows are grid rows,
  and a keyboard move there now says where the row landed. Small targets (removing a label, the
  actions under a comment, Assign to me) are at least 24px. Muted text stays readable on selected
  rows in Inbox and ⌘K, and amber avatars are a shade darker so their initials meet 4.5:1. Links
  inside a sentence are underlined. A WCAG audit of every screen, in all five themes, light and
  dark, desktop and phone, now runs in CI; `docs/accessibility-conformance.md` says what is
  covered and how to report a problem.

### Patch Changes

- Updated dependencies [05f614a]
- Updated dependencies [aa811e8]
- Updated dependencies [a00717d]
- Updated dependencies [1e9cdf9]
- Updated dependencies [f5efb20]
- Updated dependencies [ad6dd60]
  - @bemmoly/ui@1.0.0
  - @bemmoly/api-client@1.0.0
  - @bemmoly/shared@1.0.0

## 0.13.1

### Patch Changes

- Updated dependencies [9288d90]
  - @bemmoly/ui@0.13.1
  - @bemmoly/api-client@0.13.1
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

- Updated dependencies [004ebc2]
- Updated dependencies [b40f43b]
- Updated dependencies [daf0ccc]
- Updated dependencies [c7db7da]
- Updated dependencies [2191962]
- Updated dependencies [fb6b0e3]
- Updated dependencies [53e1640]
- Updated dependencies [8d1901a]
  - @bemmoly/ui@0.13.0
  - @bemmoly/shared@0.13.0
  - @bemmoly/api-client@0.13.0

## 0.12.0

### Minor Changes

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

- Updated dependencies [b769aed]
- Updated dependencies [403ef1d]
- Updated dependencies [0194a84]
- Updated dependencies [ea2125f]
  - @bemmoly/shared@0.12.0
  - @bemmoly/ui@0.12.0
  - @bemmoly/api-client@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [50fff66]
- Updated dependencies [1aca27c]
  - @bemmoly/shared@0.11.0
  - @bemmoly/ui@0.11.0
  - @bemmoly/api-client@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [e6982a1]
  - @bemmoly/shared@0.10.0
  - @bemmoly/api-client@0.10.0
  - @bemmoly/ui@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [250098f]
  - @bemmoly/shared@0.9.0
  - @bemmoly/api-client@0.9.0
  - @bemmoly/ui@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [31f9a87]
  - @bemmoly/ui@0.8.0
  - @bemmoly/shared@0.8.0
  - @bemmoly/api-client@0.8.0

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
  - @bemmoly/shared@0.7.0
  - @bemmoly/api-client@0.7.0
  - @bemmoly/ui@0.7.0

## 0.6.0

### Minor Changes

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
  - @bemmoly/shared@0.6.0
  - @bemmoly/api-client@0.6.0
  - @bemmoly/ui@0.6.0

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
- Updated dependencies [5321f9d]
  - @bemmoly/shared@0.5.0
  - @bemmoly/api-client@0.5.0
  - @bemmoly/ui@0.5.0

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

- Updated dependencies [e7df029]
- Updated dependencies [ab5214d]
- Updated dependencies [2ab05df]
- Updated dependencies [8f4df5f]
- Updated dependencies [bb4a602]
- Updated dependencies [e5697e8]
- Updated dependencies [d568104]
- Updated dependencies [259e195]
  - @bemmoly/ui@0.4.0
  - @bemmoly/shared@0.4.0

## 0.3.0

### Minor Changes

- 27dec1d: For module authors and API clients, the kernel gains what let Docs and Work point at each
  other without importing each other. `ctx.entities.resolve` finds a record any enabled module
  registered, by id or key, filtered to what the person may see; `ctx.entities.resolveMany` does
  it for a whole list in one batch, and `EntitySummary` can carry the facts a renderer shows,
  such as an issue's status. `EntityDefinition.canView` now receives the request context.
  `ctx.links.addReferenceSource` and `ctx.links.referencesTo` answer "what points at this record"
  across modules, which is how an issue lists its linked docs. A module that ships
  `web/src/entities.tsx` lends a chip, card, table and search for the records it owns, and other
  modules' screens draw them through `useEntityRenderer(kind)`, keeping a placeholder while the
  owner is off. Work registers its issues, so Docs pages show live issue chips and tables. In the
  web kernel, `preloadable` and `useLoaded` load a lazy screen before rendering it, and module
  chunks now load that way, so opening a module no longer waits out React's 300 ms Suspense
  reveal.

  Deprecated: `PATCH /api/v1/docs/pages/:id` still accepts `snapshot` and applies it as one live
  edit, but write page bodies through `/collab`; the field is removed in 0.4. No configuration or
  schema change.

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

- e2aa5d2: Home now shows sections from the modules you can open, above "Your modules". A module adds one
  by shipping `web/src/home.tsx`; a section that fails to load shows a retry card and leaves the
  rest of Home working. Work adds "My work": the issues assigned to you, reported by you and
  watched by you, each tab with its count, served by `GET /api/v1/work/my-issues`. No
  configuration or schema change.
- 7625bb6: Unsaved work in Work settings is no longer lost when leaving through the top bar, Back or a
  typed address. Board settings with an unsaved draft shows its unsaved-changes bar and waits for
  Keep editing or Discard and leave; the dialogs that add an issue type or a custom field ask
  before dropping a name that was typed; the workflow editor finishes saving the draft before it
  leaves, and asks only when that save fails. Modules get the same guard the workspace settings
  pages use, so any module page can hold a move away from unsaved work. No configuration or
  schema change.
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

- @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

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
