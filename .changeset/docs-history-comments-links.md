---
'@bemmoly/core': minor
'@bemmoly/module-docs': minor
'@bemmoly/editor': minor
---

Pages now keep a version history. A version is saved when a page is published, when someone
chooses "Save version" (optionally naming it), and automatically every 30 minutes while a page
is being edited, crediting everyone who edited since the last one. Any two versions, or a
version and the page as it is now, can be compared block by block: a paragraph that moved
shows as moved, and an edited paragraph, table cell or list item shows the words and formatting
that changed. Restoring a version applies it as a live edit that everyone with the page open
sees, and records the restore as a version of its own, so nothing is lost.

Pages can be commented on, as a whole or on selected text. Threads have replies, can be
resolved and reopened, and mentioning someone sends them a notification (people who cannot open
the page are never notified). An inline comment follows its text through later edits and is
marked "text changed" when the quoted words are edited or deleted. Comments can carry a
suggested fix that is applied as a live edit with "Apply fix"; nothing writes these
suggestions yet, and spaces marked as excluded from AI never receive them.

Links between pages and issues are kept up to date on every edit: a page shows what it links
to, the pages that link back to it, and the issues that reference it, and other modules can
ask which pages link to one of their records. Every list shows only what the person may open.

Pages can be exported as Markdown or as a single self-contained HTML file, and a page with
everything under it as a zip whose files link to each other. Markdown folders and Confluence
storage-format pages can be imported into a space; Confluence macros Bemmoly does not know
become labelled placeholder blocks. Imports of more than 25 files or 512 KB run in the
background. PDF export is not included yet.

Schema: one changeset, `0013-docs-revision-tracking`, adds two columns to `pages`
(`revision_editor_ids`, `revision_pending_since`) and an index on `page_revisions`; it is
additive and reversible. For module authors: `ctx.entities.resolve` resolves another module's
record by id or key, `EntityDefinition.canView` now receives the request context, and
`ctx.links.addReferenceSource` / `ctx.links.referencesTo` answer "what points at this record"
across modules.
