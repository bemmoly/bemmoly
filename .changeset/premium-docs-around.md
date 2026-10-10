---
'@bemmoly/module-docs': minor
'@bemmoly/web': minor
'@bemmoly/ui': minor
'@bemmoly/shared': minor
'@bemmoly/editor': minor
---

New page now makes the page where you are and opens it with the cursor in the title, with Undo in the toast. An empty page offers the space's templates and an import, and N creates a page from the Docs home and from a space.

The Docs home opens with Jump back in, a single list with Recent, Starred, My drafts and For review, and Needs you beside it. A space's overview now shows Start here, what is waiting in review, its top-level pages and who changed what. An empty space asks for its first page.

The trash shows who deleted each page and where it was, and lets you preview a page before restoring it. Space and workspace admins can delete a page forever or empty the trash, after typing a confirmation. Pages are now deleted for good 30 days after they go to the trash, by a nightly background job.

⌘K shows pages with their icon, where they live and the line that matched. Inside a space, it searches that space first.

Export… offers Markdown, HTML or PDF (through your browser's Save as PDF). Import lets you choose the page the imported pages go under, and lists what each file became.

Schema: none. New endpoints: `DELETE /api/v1/docs/spaces/:spaceKey/trash` and `DELETE /api/v1/docs/spaces/:spaceKey/trash/:pageId`.
