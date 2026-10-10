# @bemmoly/web

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
