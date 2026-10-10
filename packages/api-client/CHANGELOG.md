# @bemmoly/api-client

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
