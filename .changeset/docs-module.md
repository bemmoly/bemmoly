---
'@bemmoly/module-docs': minor
'@bemmoly/web': minor
'@bemmoly/server': minor
'@bemmoly/editor': minor
'@bemmoly/ui': minor
'@bemmoly/api-client': minor
---

Docs arrives: spaces of pages your team writes together in real time, with comments, version
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
