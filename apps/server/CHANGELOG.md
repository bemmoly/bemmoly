# @bemmoly/server

## 0.4.0

### Patch Changes

- Updated dependencies [e7df029]
- Updated dependencies [ab5214d]
- Updated dependencies [2ab05df]
- Updated dependencies [8f4df5f]
- Updated dependencies [bb4a602]
- Updated dependencies [e5697e8]
- Updated dependencies [259e195]
  - @bemmoly/module-work@0.4.0
  - @bemmoly/module-docs@0.4.0
  - @bemmoly/core@0.4.0
  - @bemmoly/shared@0.4.0
  - @bemmoly/module-sample@0.4.0

## 0.3.0

### Minor Changes

- 27dec1d: The server now hosts live collaborative documents at `/collab`, on its own port and
  authenticated with the session cookie. Every change is stored in Postgres as it happens and
  survives restarts; a page's text, word count, search index and links update two seconds after
  typing stops.

  Two new optional environment keys cap each editing connection; empty keeps the default.
  `BEMMOLY_COLLAB_MAX_MESSAGE_BYTES` is the largest message one socket may send, from 64 KiB to
  16 MiB (2 MiB by default). `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES` is how many document messages
  one socket may send per 10 seconds (1200 by default); caret and selection updates count
  separately, up to three times that, so moving the caret never spends the typing budget. A
  socket over a limit is closed and the editor reconnects on its own, keeping what was typed.
  Measured in a browser, the fastest key repeat with the caret moving sends about 70 messages a
  second, half of them carets, so the defaults leave room for two people typing flat out.

  Run one API process per install for live editing; with several, route `/collab` with session
  affinity. The bundled Caddy configuration keeps editing connections open across a
  configuration reload. No schema change.

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
  - @bemmoly/core@0.3.0
  - @bemmoly/module-work@0.3.0
  - @bemmoly/module-docs@0.3.0
  - @bemmoly/module-sample@0.3.0
  - @bemmoly/shared@0.3.0

## 0.2.2

### Patch Changes

- @bemmoly/module-sample@0.2.2
  - @bemmoly/module-work@0.2.2
  - @bemmoly/core@0.2.2
  - @bemmoly/shared@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [ca5b2c4]
  - @bemmoly/module-work@0.2.1
  - @bemmoly/module-sample@0.2.1
  - @bemmoly/core@0.2.1
  - @bemmoly/shared@0.2.1

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

- Updated dependencies [dcbcae4]
- Updated dependencies [7d09c70]
- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [c646c34]
- Updated dependencies [66e9507]
- Updated dependencies [83c390e]
- Updated dependencies [cab0760]
- Updated dependencies [a28fa79]
- Updated dependencies [80faa4d]
- Updated dependencies [158db6a]
- Updated dependencies [e2aa5d2]
- Updated dependencies [72bd7b9]
- Updated dependencies [e2aa5d2]
- Updated dependencies [d313831]
- Updated dependencies [7d09c70]
- Updated dependencies [b4f5ea9]
- Updated dependencies [9c7de90]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
- Updated dependencies [5935186]
- Updated dependencies [7d09c70]
  - @bemmoly/core@0.2.0
  - @bemmoly/module-work@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/module-sample@0.2.0

## 0.1.7

### Patch Changes

- @bemmoly/module-sample@0.1.7
  - @bemmoly/core@0.1.7
  - @bemmoly/shared@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a13da15]
  - @bemmoly/core@0.1.6
  - @bemmoly/module-sample@0.1.6
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

- Updated dependencies [0278663]
  - @bemmoly/core@0.1.5
  - @bemmoly/module-sample@0.1.5
  - @bemmoly/shared@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [b98d0c0]
  - @bemmoly/core@0.1.4
  - @bemmoly/module-sample@0.1.4
  - @bemmoly/shared@0.1.4

## 0.1.3

### Patch Changes

- @bemmoly/core@0.1.3
  - @bemmoly/module-sample@0.1.3
  - @bemmoly/shared@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [8337385]
- Updated dependencies [8337385]
  - @bemmoly/core@0.1.2
  - @bemmoly/shared@0.1.2
  - @bemmoly/module-sample@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [a2b7f81]
  - @bemmoly/core@0.1.1
  - @bemmoly/module-sample@0.1.1
  - @bemmoly/shared@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [293b01b]
- Updated dependencies [b403d58]
- Updated dependencies [c7e5a48]
  - @bemmoly/core@0.1.0
  - @bemmoly/shared@0.1.0
  - @bemmoly/module-sample@0.1.0
