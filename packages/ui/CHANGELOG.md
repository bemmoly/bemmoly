# @bemmoly/ui

## 1.6.0

No changes in this release.

## 1.5.0

### Minor Changes

- 05e2355: The + on a space and on every page in the Docs sidebar now opens a small menu: Page, Folder or
  Upload file. Upload file turns the file you pick into a full-screen file page right there,
  named after the file, with Undo in the toast. The New page dialog's upload button now reads
  Upload file too.

## 1.4.0

### Minor Changes

- 7e9b170: Docs has folders, and a page that is one HTML or PDF file now fills the screen.

  A page uploaded with Upload HTML or PDF opens as a file page: the file fills everything under
  the header, edge to edge, with its bar kept above it. Its ··· offers Replace file… and Turn into
  a page; a written page whose body is one file can go back with Show as a file page.

  New folder in a space's ··· and New folder inside on a tree row make a folder and open it with
  its name ready to type. A folder has no body: it lists what is in it, with New page (N) and New
  folder, and draws a folder icon in the tree and the trail. An empty page can be turned into a
  folder from its ···. A Markdown import's directories without an index file now arrive as
  folders, and agents can create folders with `docs_create_page` (`kind: "folder"`).

  Schema: one changeset (0022) adds `pages.kind`, defaulting to `page`, and marks existing
  uploaded pages as file pages. It is fast and reversible.

- b72b9e0: A story whose dates run past its epic's target now shows an amber "After <epic>" warning on the
  roadmap's issue rows and on its board card. The warning offers two fixes: extend the epic's target
  to the story's last day, or move the story's dates back so it ends with the epic. No schema
  or configuration change.

## 1.3.0

### Minor Changes

- 5dae368: Pages can hold PDF and HTML files. Add one with the new File block (/file), or drop or paste
  it into a page; it shows as a preview with Expand to full screen, and images gain Expand too.
  Agents add files over MCP with `docs_upload_file`, at the end of a page or anywhere in its
  Markdown. HTML runs in a sandbox with an origin of its own: it may load scripts, styles, fonts
  and images over https but cannot send data anywhere, and opened outside a page it downloads
  instead of showing (ADR 0047). No schema or configuration change; uploads keep the
  `BEMMOLY_UPLOAD_MAX_BYTES` limit.

## 1.2.0

### Minor Changes

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

- f471fce: Add a Reports view to Work projects: sprint burndown and burnup, the sprint report (completed,
  not completed, added, removed), velocity, cumulative flow, created vs resolved, the control
  chart, time in status, time tracking, field statistics (one or two fields) and epic and
  version burnups, all rebuilt from issue history. Adds
  `LineChart`, `BarChart` and `ScatterChart` to the UI kit.

## 1.1.0

No changes in this release.

## 1.0.0

### Minor Changes

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

- aa811e8: The sidebar's brand goes to Home: the Bemmoly wordmark, or under a customer logo their name and
  "on Bemmoly"; the caret beside the name opens the workspace menu.
- f5efb20: The docked issue panel on the Board, Backlog and Roadmap can be resized: hover its left edge and
  drag, or focus the edge and use the arrow keys. The width (360 to 960px) is remembered in the
  browser; double-click the edge to go back to 400px.
- ad6dd60: An accessibility pass to WCAG 2.2 AA across the product. Every signed-in screen starts with a
  **Skip to content** link, and every screen has a level-one heading. Backlog rows are grid rows,
  and a keyboard move there now says where the row landed. Small targets (removing a label, the
  actions under a comment, Assign to me) are at least 24px. Muted text stays readable on selected
  rows in Inbox and ⌘K, and amber avatars are a shade darker so their initials meet 4.5:1. Links
  inside a sentence are underlined. A WCAG audit of every screen, in all five themes, light and
  dark, desktop and phone, now runs in CI; `docs/accessibility-conformance.md` says what is
  covered and how to report a problem.

## 0.13.1

### Patch Changes

- 9288d90: The "Import from Jira" and "Import from Confluence" cards in Setup and Settings › Import
  now show a neutral import icon instead of the vendor’s logos; the product names stay as plain
  labels. A new lint rule, `bemmoly/no-atlassian-marks`, keeps the vendor’s logos out of the
  codebase.

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
- 2191962: Work has a roadmap. Open it beside a project's Board and Backlog (G R), or for every project from
  the Work section. Epics and versions sit on a timeline you can zoom by weeks, months or quarters
  and group by project or team, with their progress, what waits on what, and a forecast of when
  each lands. Drag a bar, or use the arrow keys on it, to move its dates; Undo puts them back.

  The forecast comes from your team's own pace (points per sprint when the project runs estimated
  sprints, issues finished a week otherwise), shown as a likely date and a range with how sure it
  is, and explained in plain words. With too little history it says so instead of guessing. It is
  plain arithmetic: no AI is involved and nothing is sent anywhere.

  Issues and versions gain an optional start date (set it on the issue page, or by moving a bar).
  `GET /api/v1/work/roadmap` serves the roadmap; the issue and version PATCHes accept `startAt`.
  Schema change: changeset `0025-work-start-dates` adds a nullable `start_at` date to `issues` and
  `versions`; it is quick, additive and reversible.

### Patch Changes

- 004ebc2: Board cards now draw exactly the card layout set in Project settings › Board › Cards, on Scrum and
  Kanban boards alike. Every field there has a place on the card: issue type, key, priority, labels,
  estimate, assignee, linked docs, blocked, due date (red once overdue), subtask progress, reporter,
  created date and the new "Time in column". Fields show in the order the settings list them, and a
  field shows only on cards whose issue has a value for it (an unassigned card shows the empty
  assignee ring). Before, Kanban cards ignored Estimate, always showed the time in column ("0d")
  and the done tick, the type always showed, and due date, reporter and created date never did.

  Card color "By epic" and colour rules on `epic` now paint on any board, not only when the lanes
  are epics. The settings preview is the board's own card, with a second sample showing an issue
  without values. Board settings compare the board with Work's default board when the org has no
  default board scheme, so the "Based on…" note counts changes and "Reset to default" works.

  Kanban boards that want the time in column back turn on "Time in column" in Cards. No
  configuration or schema change. That field is new in stored board settings: before rolling back to
  0.11.0, turn it off, or that version shows the board as two empty columns.

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

- 0194a84: Work descriptions and comments that arrive as Markdown typed into plain lines (from the API, an
  AI client or a CSV import) now show as headings, lists, code and tables; the parsed version is
  saved only once someone edits it. While editing a card's description, a grip beside the hovered
  line drags that block to a new place.

  When a domain is set, the installer checks whether it already points at the server and, if not,
  prints the A record to add, with a Cloudflare link when the zone is on Cloudflare. The install
  carries on either way.

  An issue open in the Board's side panel no longer lets the page scroll into blank space.
  No schema or configuration change.

## 0.11.0

### Minor Changes

- 1aca27c: Cards on the board now look the same for everyone. The card layout (fields, order, card colour
  and colour rules) is set only by project admins and org admins in Project settings › Board ›
  Cards; the board's Display menu no longer offers personal card fields or a compact density, and
  choices people saved for those in their browser are ignored. Display keeps "Show empty columns",
  links admins to the Cards settings, and tells everyone else where the layout is set. Saving a
  board's configuration, cards included, needs "Configure board"; anyone else gets a 403.

  Quick filters ("Only my issues", "Recently updated", "Blocked" and the project's own quick
  filters) are now toggle chips in the Board and Backlog filter row instead of items in the Filter
  menu. A few show in the row, the rest sit behind "+N more", and the choice stays in the address.
  No configuration or schema change.

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

No changes in this release.

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

No changes in this release.

## 0.6.0

### Patch Changes

- aff36d5: A fresh install's empty Home now offers admins one button, "Turn on Work and Docs", which
  turns both modules on with nobody granted yet; it is hidden when the image pins the module
  set. A sprint past its end date says Overdue on the board, as it already did on Home.
  Settings › Modules no longer calls a module that never ran "Up to date" or offers to remove
  data it does not have. Key hints inside filled buttons are readable, the AI insight bar's text
  wraps on phones instead of truncating to a letter, card selection marks sit inside the card on
  touch screens, Home stops suggesting a keyboard shortcut on phones, and the issue types table
  keeps descriptions inside their column on phones.

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

- db35948: Dragging a card on a large board feels instant again: the card shows in its new column in the
  frame after you let go, as it did before 0.4.0, instead of a beat later. A drop now redraws only
  the cards it moved, opening an issue or typing in the filter no longer redraws every card, and
  the Backlog's rows no longer all redraw after each drop. A card's hover tools and a row's menu are
  drawn the first time the pointer or the keyboard reaches them, so they look and work as before.
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

- 5321f9d: Segmented controls, such as the month switch on Usage and the My issues tabs on Home, now draw
  unselected options in darker text. They now meet 4.5:1 contrast in light themes, up from 4.3:1.

## 0.4.0

### Minor Changes

- e7df029: The Board and the Backlog now look and behave as two views of the same issues. Cards and rows
  show the same fields in the same order, epics keep one stored colour on every screen, and both
  screens share one filter bar whose filters live in the address, so a filtered view can be shared
  and survives a reload. Filters now hide issues instead of fading them, and every count follows.
  One click opens an issue in a peek beside the list (`?issue=KEY`), with ↑↓ or j and k to step
  through. Cards and rows offer assign, open and more on hover and on right-click, columns offer
  New issue in place, and deleting an issue can be undone for a few seconds. On the Backlog, rows
  can be selected with their box, Shift or Cmd, and a bulk bar assigns, sets priority, moves to a
  sprint or deletes. The sprint strip shows a two-tone progress bar, and Complete sprint opens the
  real dialog. On phones the Board shows one column at a time.

  Schema: adds a nullable `color` column to `issues` (changeset `0023-work-epic-color`), filled for
  existing epics in rank order. It is reversible.

- ab5214d: Create issue is now a composer: pick the project and type in its header, write a title and a
  rich description, fill the sections the type requires, and set status, priority, assignee,
  labels, sprint, points and epic as chips that start from where you opened it. Mod+Enter
  creates, "Create another" keeps the dialog open, the toast offers to open the new issue, and
  closing with anything typed asks first. Dialogs open as full-screen sheets on phones and keep
  their buttons in view. Completing a sprint shows how much of it got done, deleting a saved
  filter can be undone, Link issue works from the keyboard, and Create project previews the
  new project's tile and first key.
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

- bb4a602: The issue page reads like a document. Edit the title, the description and every property where
  it is shown; the description saves as you type and says when it has saved. Issues get an
  acceptance-criteria checklist, sub-issue and link sections that are always there, and activity
  that shows comments and history together by default. Status sits at the top of the right rail
  with one-click next steps, and a status change, a removed label or a removed link can be undone
  from the toast. Step to the previous or next issue with j and k. The AI summary appears only
  when AI is turned on.
- e5697e8: Projects is a searchable, sortable table or grid with All, Starred and Archived views; each
  row shows the project's tile, lead, team, method and progress, and a row menu archives a
  project with Undo. Project settings read calmer: Members has role menus and Admins and Invited
  views; Issue types and Fields are tables you rename in place, and issue types reorder by drag
  or with the arrow keys; Board fits all its columns, draws each status with its glyph and says
  in one line what it inherits; the workflow editor deletes a status or transition at once with
  Undo (and Cmd/Ctrl+Z), and publishing is "Review and publish".
- d568104: Workspace settings pages take on the new design: read-then-edit sections on quiet cards, one table
  style for members, teams, modules, backups and the audit log, calm sentence-case status pills, and
  shaped loading skeletons with a Retry on errors. On phones, tables keep their key columns, card
  grids stack and long values truncate instead of overlapping.
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

- 27dec1d: The top bar fits a phone: below 640px the brand shows its mark, the module links scroll
  sideways inside the bar with the current one kept in view, search folds into an icon below
  768px, and Ask Bemmoly hides. Before, the bar widened every page on a phone and pushed side
  panels off screen. Empty and missing-page states can now title themselves as headings, and links
  in Docs pages are faintly underlined so they read without relying on colour. No configuration or schema
  change.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 2e14b26: The design system gains the pieces the Work screens are built from, each ported from the Board,
  Backlog, Issue, Board Settings and Workflow mocks with a Storybook story beside its mock crop:
  the board card with its blocked badge, labels, estimate or time in column and colour-rule
  stripe; column headings with WIP limits and the lane drop areas; collapsible swimlanes; quick
  filter chips; the velocity and flow tiles and the capacity bar; sprint containers with their
  headers and backlog rows; the epics panel; the Issue page's subtask, linked issue and acceptance
  criteria rows, activity entries with reactions, the comment box and the Details field list;
  create form layout pieces and the fields table; the workflow canvas with status nodes,
  transition arrows and labels, rule chips and status pills; and the "Inherits from" banner with
  its diff and reset actions. Issue types now include Epic, Incident and Subtask, priorities add
  Lowest, and the type tile comes in the 18px and 36px sizes the type settings use.

### Patch Changes

- 72bd7b9: Work gains its Issue page, the same issue in a slide-over for the board, the create issue form
  and the project list. The Issue page shows the title, the status with the transitions the
  workflow allows, description and rich text fields such as acceptance criteria, subtasks, linked
  issues, and activity with threaded comments, reactions, history and the work log; every field in
  Details edits in place, and the AI summary shows its empty state until AI is turned on. The
  create form lays itself out from the issue type's form layout, checks its required fields and
  names the new issue's key when it is created. Projects lists every project you can see and
  creates new ones with a key, Scrum or Kanban and an owning team. The top bar's Create menu now
  offers Issue and Project, and Projects joins Board and Backlog in the top bar. The select gains
  a ghost look for values edited in place. No schema or configuration change.
- 4d5e58f: The Work screens feel finished. Dialogs, the issue slide-over, menus, dropdowns and toasts now
  open and close with short, calm motion, and nothing moves for people who ask their system for
  reduced motion. A board card lifts when you pick it up and settles where you drop it. Every
  Work screen (board, backlog, issue page and slide-over, projects, members, board settings,
  workflows and Home's "my work") loads into a placeholder shaped like the finished page instead
  of grey blocks, so nothing jumps when the data arrives. Empty boards, sprints, backlogs, saved
  filters, workflow lists and member lists say what they are and offer the one thing to do next.
  The create issue form opens with the cursor in Title, the workflow pages use the same project
  settings sidebar as the rest of project settings, buttons show a pressed state, long names
  show in full on hover, counts line up, and scrollbars inside white panels no longer draw a grey
  ring. No configuration or schema change.

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

## 0.1.5

No changes in this release.

## 0.1.4

No changes in this release.

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

## 0.1.2

### Patch Changes

- 3fb2621: Every dropdown is now the same control, whether it holds three options or three hundred. The
  arrow on each dropdown is darker so you can see it, the list opens in a popover that is never
  cut off by a table or a panel, and it works from the keyboard. Long lists show the first 50
  with a search box; people pickers (team lead, module access, the audit log's actor) search the
  whole workspace on the server as you type, and role and team pickers can be searched too. The
  "···" menu on a user row in Settings › Users now opens where you can see it.

## 0.1.1

### Patch Changes

- e231a13: The first-run setup reads in order. Step 1 asks for the workspace (name, then its address)
  and then for your account (name, email, password), one field per row, in two labelled groups.
  The address is filled in from the browser and shown as a value to check. On the People step
  the email invites have a proper heading that says new people join as Members with no team,
  and the Done summary leaves skipped steps unticked. The note beside the steps now only says
  that everything can be changed later in Workspace settings. No configuration or schema change.
- 94c57cc: The first-run setup wizard shows real logos on its option cards: each AI provider in the
  bundled catalog, the import sources and the single sign-on options, all drawn in the current
  text colour so they follow the theme. Importers and single sign-on are marked "Coming soon"
  instead of looking broken; on the import step "Start clean" is picked from the start, so
  Continue moves on without skipping. Settings › AI uses the same provider logos.

## 0.1.0

No changes in this release.
