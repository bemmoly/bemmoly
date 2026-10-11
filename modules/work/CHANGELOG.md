# @bemmoly/module-work

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

- db35948: Dragging a card on a large board feels instant again: the card shows in its new column in the
  frame after you let go, as it did before 0.4.0, instead of a beat later. A drop now redraws only
  the cards it moved, opening an issue or typing in the filter no longer redraws every card, and
  the Backlog's rows no longer all redraw after each drop. A card's hover tools and a row's menu are
  drawn the first time the pointer or the keyboard reaches them, so they look and work as before.
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
  - @bemmoly/editor@0.4.0
  - @bemmoly/core@0.4.0
  - @bemmoly/shared@0.4.0
  - @bemmoly/api-client@0.4.0

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

## 0.2.2

### Patch Changes

- @bemmoly/api-client@0.2.2
  - @bemmoly/core@0.2.2
  - @bemmoly/core-web@0.2.2
  - @bemmoly/editor@0.2.2
  - @bemmoly/shared@0.2.2
  - @bemmoly/ui@0.2.2

## 0.2.1

### Patch Changes

- ca5b2c4: The workflow editor's canvas now fits beside the settings sidebar and the side panel at every
  width, so the page no longer runs under the panel. The canvas scrolls inside its own card: with
  the wheel or trackpad, or by dragging on empty canvas. It opens on the workflow's statuses, and
  selecting a status or transition from the side panel, or nudging one with the arrow keys,
  scrolls it into view. Statuses still drag, transitions still draw from the handle, and the
  canvas keeps the design's 1000 x 560 size. No configuration or schema change.
- @bemmoly/api-client@0.2.1
  - @bemmoly/core@0.2.1
  - @bemmoly/core-web@0.2.1
  - @bemmoly/editor@0.2.1
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
- c646c34: Work gains the Backlog screen at /work/backlog. Each open sprint shows its dates, goal, status
  counts and points, with planned sprints measured against their capacity, above the backlog of
  unplanned issues. Issues can be dragged within and between sprints and the backlog, alone or
  several at once after a shift or cmd selection, and moved from the keyboard: space picks a row
  up, the arrow keys move it and space drops it. The order changes on screen at once and the
  server confirms it. The epics panel shows each open epic's progress and filters the list, as do
  the search box and the type and assignee filters. Issues and epics can be created in place,
  sprints can be created, edited, deleted before they start, started with their dates and goal,
  and completed, choosing where unfinished issues go. The screen updates live when someone else
  changes the plan, and stays smooth with a thousand issues in the backlog. No schema or
  configuration change.
- 66e9507: The board's ··· button now opens a menu: Board settings, Workflow, and Copy board link, which
  puts the board's address on the clipboard. On windows narrower than 1200px, an issue opened
  from the board slides over the board behind a dimmed backdrop instead of squeezing it; Escape
  or a click on the backdrop closes it and returns you to the card. Wider windows keep the panel
  beside the board as before. No configuration or schema change.
- 83c390e: The Work board is now a working screen instead of a placeholder. A project's board shows its
  columns mapped to statuses with counts and WIP limits, swimlanes, and cards laid out with the
  board's card fields and colour rule; Scrum boards show the active sprint with its dates, goal
  and velocity, Kanban boards show work in flight, cycle time and a throughput trend. Cards move
  by drag and drop or from the keyboard (space picks a card up, the arrows carry it, space drops
  it, Escape puts it back). A move into another column goes through the workflow, and a column
  the workflow does not allow says why before the card is dropped; a move within a column
  reorders it at once while the server confirms. The filter row adds people, epic, type and label
  filters, quick filters, grouping, and an LQL bar that checks the query as it is typed and
  suggests fields, operators and values. Cards open in a panel beside the board, and the board
  updates live when someone else changes an issue. Long columns render in windows, so a 500-card
  board stays responsive. No configuration or schema change.
- cab0760: Projects gain a settings screen at Project settings › Board. It shows which org default the board
  inherits and how many settings the project has changed, with the full list a click away, and has
  tabs for columns mapped to workflow statuses (add, rename, drag to reorder, move statuses between
  columns, WIP limits), swimlanes including lanes written as queries, quick filters, the card
  fields and their order, card colours by priority, type, epic or a query, and Scrum or Kanban with
  sprint length, working days and the estimation unit. A live preview beside the tabs follows every
  edit. Each tab is read first and changed only after Edit; saving shows what changes, and a change
  that takes cards off the board, such as removing a column that holds issues or switching a Kanban
  board to Scrum, says so and asks first. Reset to org default shows the difference and asks for a
  typed word. People who may only edit WIP limits can change those and nothing else. Issue types and
  fields get their own settings pages to inherit, override or reset the org default. Queries are
  checked as they are typed and offer suggestions. Boards can now store colour rules; boards saved
  before keep working unchanged. No schema or configuration change.
- a28fa79: The board loads faster, most of all on large projects: a 500-card board reads its cards in less
  than half the time, and a board of nearly 5,000 cards about five times faster. When the
  workflow refuses a move, only that card goes back; other cards you dropped meanwhile stay where
  you put them. Screen readers now hear a move as pending at the drop, then that it went through
  or why it did not, instead of hearing it moved before the server had answered.

  Schema: one new index, `issues_project_updated_idx` on issues (project_id, updated_at), built
  concurrently by the Work changelog (`0022-work-issues-updated-index`), so an upgrade does not
  block writes while it builds. No configuration change.

- 80faa4d: Work gains the server side of boards, sprints, the backlog, saved filters and metrics. A project
  gets its board the first time it is opened, copied from the org default board scheme or built
  from its workflow, and the board can be configured with columns mapped to statuses, WIP limits,
  swimlanes by epic, assignee, priority, type or a query, quick filters, card fields and colour
  rules. The board view returns every card grouped by column and lane in one request, narrowed by
  an optional query. Scrum projects can plan, start and complete sprints, one active at a time;
  completing a sprint moves unfinished work to the backlog or another sprint and records what was
  committed and completed for the velocity report. The backlog lists sprints with their committed
  points beside capacity, and issues can be dragged between sprints and the backlog. Filters can be
  saved privately or shared with teams. Boards report velocity, the active sprint's burndown, cycle
  time and throughput. Board and sprint changes appear in the audit log. No schema or configuration
  change.
- 158db6a: Fixes found by the end-to-end Work flows. Page loads no longer count against the strict
  ten-a-minute limit for sign-in and setup, which locked everyone behind one office address out
  with "Too many requests". Mentioning someone in an issue description now notifies them, as a
  mention in a comment does. On the board, a card moved twice in a row is judged by the
  transitions of its current status, a card dropped with the keyboard keeps the focus, a card
  dropped on a column's refusal note says why it stays, quick moves no longer jump back while
  the server catches up, and a link to a project you cannot see says so instead of inviting you
  to create one. Realtime updates refetch only what changed, and an issue's activity now reads
  "created the issue" rather than "changed created". No configuration or schema change.
- e2aa5d2: Fixes found by the new Work integration tests:

  - Issues created at the same time in one project get distinct board ranks.
  - `?deleted=false` and `?archived=false` mean false; before, any value listed the trash or
    included archived projects.
  - A transition whose validator asks for a field (an estimate, say) accepts that field in the
    same request that moves the issue.
  - Moving an issue answers with what the transition's post-actions changed, and open boards and
    issue pages refresh to show it.
  - Post-actions and workflow publishes record history with the same field names as every other
    change, so one issue's history reads as one list.
  - Notifications reach only people who can open the issue's project; a mention or an old watch
    no longer sends the issue's title and comment to someone outside it.
  - An issue can only carry labels, a fix version and a component of its own project.
  - Typing a full issue key suggests that issue before keys that extend it.

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
- e2aa5d2: Work projects now have labels, versions and components you can list, create, rename and delete
  under `/api/v1/work/projects/:key/labels`, `/versions` and `/components`. The lists come back in
  name order and take a name prefix (`?q=`), so the create form and the issue page can offer them
  as you type. A version has a planned release date and a status; marking it released records
  when, and moving it back to unreleased clears that. A component can name an active person as
  its lead. Anyone who can edit issues can add a label; everything else needs project
  configuration. Each change is written to the audit log. No configuration or schema change.
- b4f5ea9: Issue descriptions, acceptance criteria and other document fields, and comments, are now written
  in a rich text editor instead of a plain text box. The tools are bold, italic, mention, link and
  code, with headings, bulleted and numbered lists, checklists, quotes and code blocks for
  descriptions; the usual shortcuts work (⌘B, ⌘I, ⌘E, ⌘K for a link, ⌘↵ to save or post, Escape
  to cancel), and typing / offers the blocks. Type @ to mention someone, or # to link an issue by
  key or title; issue keys you type or paste become links on their own, and pasted web addresses
  do too. Text reads the same after saving as it did while you wrote it. The editor loads the
  first time you edit, so pages that only show text stay as fast as before. Existing descriptions
  and comments open unchanged. No schema or configuration change.
- 9c7de90: The Board can save its LQL filter. With a query applied, "Save filter" names it and says who
  sees it: only you, or one of your teams. A Saved filters menu beside the filter bar lists your
  own filters and those shared with your teams, and applies one in a click; your own can be
  renamed or deleted there, with a confirmation before a delete. No configuration or schema
  change.
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
- 7625bb6: Unsaved work in Work settings is no longer lost when leaving through the top bar, Back or a
  typed address. Board settings with an unsaved draft shows its unsaved-changes bar and waits for
  Keep editing or Discard and leave; the dialogs that add an issue type or a custom field ask
  before dropping a name that was typed; the workflow editor finishes saving the draft before it
  leaves, and asks only when that save fails. Modules get the same guard the workspace settings
  pages use, so any module page can hold a move away from unsaved work. No configuration or
  schema change.
- 5935186: Edit workflows visually. Work settings › Workflows lists the org default workflow and the
  project's own copy with the published version, the projects using each and when it last
  changed, and opens the workflow editor: drag statuses to arrange them, drag from a status's
  handle to another to add a transition, and pick conditions, validators and post-actions from the
  rules registry with their settings in the side panel. Changes save to a draft as you work.
  Validate lists the draft's problems and marks the status or transition each one concerns;
  Publish says which version it makes and which projects move to it, and asks where the issues of
  a removed status should go. Everything on the canvas is reachable from the keyboard: Tab between
  statuses and transitions, arrow keys to move a status, Delete to remove one after confirming.
  No configuration or schema change.
- Updated dependencies [dcbcae4]
- Updated dependencies [7d09c70]
- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [2e14b26]
- Updated dependencies [158db6a]
- Updated dependencies [72bd7b9]
- Updated dependencies [d313831]
- Updated dependencies [b4f5ea9]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
  - @bemmoly/core@0.2.0
  - @bemmoly/core-web@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/ui@0.2.0
  - @bemmoly/editor@0.2.0
  - @bemmoly/api-client@0.2.0
