---
'@bemmoly/module-docs': minor
'@bemmoly/server': minor
'@bemmoly/web': minor
'@bemmoly/api-client': minor
---

The Docs module ships in the image, off until an admin enables it in Settings › Modules. It
boots and runs with Work disabled. Enabling it runs its schema changelog, which creates the
documentation tables (spaces, pages with their tree paths and order, the Yjs update log and
compacted state, revisions, comments, the page and issue reference graph, templates, labels and
stars), keeps a weighted search index on pages, and adds the six built-in templates: RFC,
meeting notes, postmortem, product spec, runbook and decision log. It uses the pg_trgm
extension, as Work does. Once enabled, "Docs" appears in the top navigation, "Page" and "Space"
appear in the Create menu, pages show up in the ⌘K palette under "Pages", and the Docs
capabilities (create and configure spaces; view, edit, delete, publish and export) appear in the
roles matrix with their defaults. The API under /api/v1/docs covers spaces, pages with soft
delete and the trash, the page tree, moves across parents and spaces, the review flow with
reviewers, stars, labels, templates, the Docs home's recent and starred lists, and search. The
Docs screens are placeholders over this data until the Docs home and the editor arrive in later
changes of this release. No configuration change.
