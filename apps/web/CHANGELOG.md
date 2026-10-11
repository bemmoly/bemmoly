# @bemmoly/web

## 0.11.0

### Minor Changes

- 50fff66: Appearance moves out of the sidebar's person menu into a small Appearance button beside your
  name (stacked above your avatar on the collapsed rail). It offers Light, Dark and Match system.

  Only a workspace admin now sets the theme. Personal themes are retired: `PUT /me/appearance`
  refuses a theme with 403 and stores only the mode, a personal theme saved before is ignored, and
  personal custom themes can no longer be created. In Settings › Appearance, people who are not
  admins see the workspace theme read-only beside their own mode. The "Let people pick their own
  theme" switch is gone; `appearance.personalThemes` is now inert and always reported as false.
  No schema change.

### Patch Changes

- bc72030: Sign-in: a smaller product panel showing Work, Docs, Inbox and AI; single sign-on is the filled primary action; tighter helper copy.
- Updated dependencies [50fff66]
- Updated dependencies [1aca27c]
  - @bemmoly/shared@0.11.0
  - @bemmoly/ui@0.11.0
  - @bemmoly/api-client@0.11.0
  - @bemmoly/core-web@0.11.0

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

### Patch Changes

- Updated dependencies [e6982a1]
  - @bemmoly/shared@0.10.0
  - @bemmoly/api-client@0.10.0
  - @bemmoly/ui@0.10.0
  - @bemmoly/core-web@0.10.0

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

### Patch Changes

- Updated dependencies [250098f]
  - @bemmoly/shared@0.9.0
  - @bemmoly/api-client@0.9.0
  - @bemmoly/core-web@0.9.0
  - @bemmoly/ui@0.9.0

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
  - @bemmoly/ui@0.8.0
  - @bemmoly/shared@0.8.0
  - @bemmoly/api-client@0.8.0
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
  - @bemmoly/api-client@0.7.0
  - @bemmoly/core-web@0.7.0
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

- c4215a9: The updater now moves itself to the release it installs, verified with cosign like the app image, so updater fixes reach existing installs (ADR 0020). `bemmoly upgrade` does the same, and `bemmoly sync-updater` moves an older updater once. Clicking Update opens a dialog with each step's live status; every admin sees a running update, a second one is refused, and the page reloads onto the new version when it is ready.

### Patch Changes

- aff36d5: A fresh install's empty Home now offers admins one button, "Turn on Work and Docs", which
  turns both modules on with nobody granted yet; it is hidden when the image pins the module
  set. A sprint past its end date says Overdue on the board, as it already did on Home.
  Settings › Modules no longer calls a module that never ran "Up to date" or offers to remove
  data it does not have. Key hints inside filled buttons are readable, the AI insight bar's text
  wraps on phones instead of truncating to a letter, card selection marks sit inside the card on
  touch screens, Home stops suggesting a keyboard shortcut on phones, and the issue types table
  keeps descriptions inside their column on phones.
- Updated dependencies [4e0e170]
- Updated dependencies [aff36d5]
- Updated dependencies [4cbf7a1]
- Updated dependencies [c4215a9]
  - @bemmoly/shared@0.6.0
  - @bemmoly/api-client@0.6.0
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

- fc28637: Settings › Roles no longer lists "Manage billing and license". Nothing ever checked it, and
  Bemmoly has nothing to buy. Schema: the kernel changeset `0109-identity-drop-billing-capability`
  deletes the stored grants of `workspace.billing.manage` on update; it is quick and reversible.
- 9911c5f: New page now makes the page where you are and opens it with the cursor in the title, with Undo in the toast. An empty page offers the space's templates and an import, and N creates a page from the Docs home and from a space.

  The Docs home opens with Jump back in, a single list with Recent, Starred, My drafts and For review, and Needs you beside it. A space's overview now shows Start here, what is waiting in review, its top-level pages and who changed what. An empty space asks for its first page.

  The trash shows who deleted each page and where it was, and lets you preview a page before restoring it. Space and workspace admins can delete a page forever or empty the trash, after typing a confirmation. Pages are now deleted for good 30 days after they go to the trash, by a nightly background job.

  ⌘K shows pages with their icon, where they live and the line that matched. Inside a space, it searches that space first.

  Export… offers Markdown, HTML or PDF (through your browser's Save as PDF). Import lets you choose the page the imported pages go under, and lists what each file became.

  Schema: none. New endpoints: `DELETE /api/v1/docs/spaces/:spaceKey/trash` and `DELETE /api/v1/docs/spaces/:spaceKey/trash/:pageId`.

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
  - @bemmoly/shared@0.5.0
  - @bemmoly/api-client@0.5.0
  - @bemmoly/core-web@0.5.0
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

- d568104: Workspace settings pages take on the new design: read-then-edit sections on quiet cards, one table
  style for members, teams, modules, backups and the audit log, calm sentence-case status pills, and
  shaped loading skeletons with a Retry on errors. On phones, tables keep their key columns, card
  grids stack and long values truncate instead of overlapping.
- 603f6f6: The setup wizard is redesigned. It opens with a welcome and a one-line server health summary
  (details open on their own when something needs attention), then asks for the workspace and
  your account on separate steps, with a live preview of the sidebar, a password strength meter
  and a show or hide toggle. Every step has Back, Skip for now where it is allowed, and Enter to
  continue; fields are checked as you leave them, a failed save offers Retry, and coming back
  later resumes where you were. The Look step previews each theme as a small board, puts the
  brand colour inline and shows where your logo will go. Setup ends on a launchpad that lists what
  was set, links anything you skipped to Settings, and offers your next steps. The header shows
  the version actually running instead of a fixed one.
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
  - @bemmoly/core-web@0.4.0
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

- 27dec1d: The top bar fits a phone: below 640px the brand shows its mark, the module links scroll
  sideways inside the bar with the current one kept in view, search folds into an icon below
  768px, and Ask Bemmoly hides. Before, the bar widened every page on a phone and pushed side
  panels off screen. Empty and missing-page states can now title themselves as headings, and links
  in Docs pages are faintly underlined so they read without relying on colour. No configuration or schema
  change.
- Updated dependencies [27dec1d]
- Updated dependencies [27dec1d]
- Updated dependencies [27dec1d]
  - @bemmoly/core-web@0.3.0
  - @bemmoly/ui@0.3.0
  - @bemmoly/api-client@0.3.0
  - @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/api-client@0.2.2
  - @bemmoly/core-web@0.2.2
  - @bemmoly/shared@0.2.2
  - @bemmoly/ui@0.2.2

## 0.2.1

### Patch Changes

- @bemmoly/api-client@0.2.1
  - @bemmoly/core-web@0.2.1
  - @bemmoly/shared@0.2.1
  - @bemmoly/ui@0.2.1

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

- e2aa5d2: Home now shows sections from the modules you can open, above "Your modules". A module adds one
  by shipping `web/src/home.tsx`; a section that fails to load shows a retry card and leaves the
  rest of Home working. Work adds "My work": the issues assigned to you, reported by you and
  watched by you, each tab with its count, served by `GET /api/v1/work/my-issues`. No
  configuration or schema change.
- e2aa5d2: The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
  from search providers that modules register with `ctx.search.addProvider`; it asks only the
  modules a person can open, and each provider keeps to what that person may see. Work answers
  with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
  "Issues" group and scope. No configuration or schema change.
- 7d09c70: Projects now have members you can manage. Open Members from a project's row menu in the
  project list, or from the project switcher, to see who can open the project and the role each
  person holds in it. Project admins add people (found by name or email) or whole teams, change
  a role in place, and remove someone after reading back what they lose. A project always keeps
  one project admin. Whoever creates a project becomes its project admin, and everyone in the
  owning team joins with the team's default role. People see only the projects they belong to in
  the project list; org admins still see every project. Access to a project's issues, search,
  boards and Home follows membership on the next request, and LQL issue queries, which failed
  for everyone, now work and respect it too. Every change is in the audit log. The API is
  `GET` and `POST /api/v1/work/projects/:key/members`, and `PATCH` and `DELETE
/api/v1/work/projects/:key/members/:userId`. No configuration or schema change.
- b4f5ea9: Issue descriptions, acceptance criteria and other document fields, and comments, are now written
  in a rich text editor instead of a plain text box. The tools are bold, italic, mention, link and
  code, with headings, bulleted and numbered lists, checklists, quotes and code blocks for
  descriptions; the usual shortcuts work (⌘B, ⌘I, ⌘E, ⌘K for a link, ⌘↵ to save or post, Escape
  to cancel), and typing / offers the blocks. Type @ to mention someone, or # to link an issue by
  key or title; issue keys you type or paste become links on their own, and pasted web addresses
  do too. Text reads the same after saving as it did while you wrote it. The editor loads the
  first time you edit, so pages that only show text stay as fast as before. Existing descriptions
  and comments open unchanged. No schema or configuration change.
- 7625bb6: Unsaved work in Work settings is no longer lost when leaving through the top bar, Back or a
  typed address. Board settings with an unsaved draft shows its unsaved-changes bar and waits for
  Keep editing or Discard and leave; the dialogs that add an issue type or a custom field ask
  before dropping a name that was typed; the workflow editor finishes saving the draft before it
  leaves, and asks only when that save fails. Modules get the same guard the workspace settings
  pages use, so any module page can hold a move away from unsaved work. No configuration or
  schema change.
- 7d09c70: The workflow editor shows how many issues sit in each status, counting only projects that use
  the workflow and issues you can open (`GET /api/v1/work/workflows/:id/status-counts`, with an
  optional `projectId`); Board settings uses the same counts to warn before a change hides
  cards. Publishing a workflow now records when it was published, shown in the Workflows list
  in place of the last change, and keeps where each status was drawn, so a published workflow
  opens with its layout. A project's own copy of a workflow now takes the project's issues and
  board columns with it.

  Project settings can override and reset each scheme: issue types, fields, the workflow and the
  board (`GET /api/v1/work/projects/:key/schemes`, `GET …/schemes/:kind/diff`, `POST
…/schemes/:kind/override` and `…/reset`). Overriding copies the org default into the project
  and moves its issues onto the copy; resetting moves them back and drops the copy, and the diff
  lists every row the project changed. A project's issue type or field copy can now be edited by
  its id alone.

  Schema change: changeset `0021-work-workflow-publish-details` adds `workflows.published_at`
  and nullable `x` and `y` columns on `workflow_statuses`. It is fast, fills the publish time of
  existing workflows from their last update, and can be rolled back.

- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [2e14b26]
- Updated dependencies [72bd7b9]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
  - @bemmoly/core-web@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/ui@0.2.0
  - @bemmoly/api-client@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/api-client@0.1.7
  - @bemmoly/core-web@0.1.7
  - @bemmoly/shared@0.1.7
  - @bemmoly/ui@0.1.7

## 0.1.6

### Patch Changes

- @bemmoly/api-client@0.1.6
  - @bemmoly/core-web@0.1.6
  - @bemmoly/shared@0.1.6
  - @bemmoly/ui@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [0278663]
  - @bemmoly/core-web@0.1.5
  - @bemmoly/api-client@0.1.5
  - @bemmoly/shared@0.1.5
  - @bemmoly/ui@0.1.5

## 0.1.4

### Patch Changes

- b98d0c0: Settings › Updates has a "Check for updates" button that fetches the release list right away instead of waiting for the daily check, and the page says plainly when the list has never been fetched or the last check failed, rather than claiming you are on the latest release.
- Updated dependencies [b98d0c0]
  - @bemmoly/api-client@0.1.4
  - @bemmoly/core-web@0.1.4
  - @bemmoly/shared@0.1.4
  - @bemmoly/ui@0.1.4

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

- Updated dependencies [04c4f3a]
  - @bemmoly/ui@0.1.3
  - @bemmoly/api-client@0.1.3
  - @bemmoly/core-web@0.1.3
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
- 3fb2621: Every dropdown is now the same control, whether it holds three options or three hundred. The
  arrow on each dropdown is darker so you can see it, the list opens in a popover that is never
  cut off by a table or a panel, and it works from the keyboard. Long lists show the first 50
  with a search box; people pickers (team lead, module access, the audit log's actor) search the
  whole workspace on the server as you type, and role and team pickers can be searched too. The
  "···" menu on a user row in Settings › Users now opens where you can see it.
- 42a4218: The setup wizard's appearance step builds a custom theme in place: "Build a custom theme with
  your brand color instead" opens the brand colour, light or dark, surfaces and typeface controls
  under the preset tiles, the whole page previews the result as you edit, and Finish setup saves
  it. Before, the link left the wizard and sent you back to the import step. An admin who opens
  another page before finishing setup now returns to the step they were on.

  Logos on the setup and Settings › AI option cards are no longer greyed out: provider marks use
  the primary text colour, the Jira and Confluence marks use their brand colours (adjusted on dark
  themes so they stay readable), and "Coming soon" cards fade as a whole.

- Updated dependencies [8337385]
- Updated dependencies [8337385]
- Updated dependencies [3fb2621]
  - @bemmoly/shared@0.1.2
  - @bemmoly/api-client@0.1.2
  - @bemmoly/ui@0.1.2
  - @bemmoly/core-web@0.1.2

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
- 54faa51: Before a workspace has a look of its own (the setup wizard, the sign-in page), Bemmoly now
  opens in the Classic light theme instead of following the computer's dark mode. Once setup
  saves a theme, everyone sees it, and members can still pick light or dark for themselves when
  the workspace allows it.
- f4fe47e: Picking a theme in the setup wizard's Appearance step, or in Settings › Appearance, now
  re-themes the whole page at once, so you can see it before saving. Saving keeps it for the
  workspace; skipping the step, discarding, or leaving the page returns to the saved look.
- Updated dependencies [e231a13]
- Updated dependencies [94c57cc]
  - @bemmoly/ui@0.1.1
  - @bemmoly/api-client@0.1.1
  - @bemmoly/core-web@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Minor Changes

- c7e5a48: Settings are now guarded by the capability that owns them. Anyone holding a
  `workspace.*.manage` capability can read the settings list, and saving a key needs the
  capability for its group: `appearance.*` needs "Set appearance and themes"
  (`workspace.appearance.manage`), `email.*` needs `workspace.email.manage`, `system.*` needs
  `workspace.system.manage`, and every other workspace key needs `workspace.settings.manage`.
  People who were given only the appearance capability can now save the workspace look.
  Behaviour change: holding only `workspace.settings.manage` no longer lets someone change email
  or system settings; give them the email or system capability as well.

### Patch Changes

- e61b7a9: The web app paints its top bar and logo as soon as the stylesheet arrives, before its
  JavaScript runs or the first API call returns, so a cold load on a phone shows the frame in
  under a second instead of a blank page. The app's code still downloads from the start, at low
  priority, and replaces the frame in a single step once the first page is ready.
- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
  - @bemmoly/api-client@0.1.0
  - @bemmoly/core-web@0.1.0
  - @bemmoly/ui@0.1.0
