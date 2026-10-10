# @bemmoly/ui

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
