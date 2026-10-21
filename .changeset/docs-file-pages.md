---
'@bemmoly/module-docs': minor
---

New page can now be a file: Upload HTML or PDF in the New page dialog makes a page named after
the file (or the title typed) whose body is that file, previewed and expandable to full screen.
A file the server refuses removes the new page again. Adds `POST /api/v1/docs/pages/:pageId/files`,
which adds a stored file at the end of a page's body.
