---
'@bemmoly/module-docs': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
---

The Docs home and space navigation arrive. /docs shows the workspace's spaces as cards with their
first pages and who has been writing in them, the pages edited most recently, your starred pages
and your drafts and pages in review, the templates to start from, and a "Needs attention" panel
listing the reviews you were asked for and the published pages you own that nobody has edited in
`docs.staleAfterDays` (90 by default); the panel is left out when nothing waits. Before any space
exists the home is a short guide to creating the first one.

A space opens beside a sidebar with its page tree: open and close pages, drag a page above, below
or into another (or move it with Alt and the arrow keys), rename in place with F2, star, copy a
link and move pages to the trash with an Undo on the toast. Each space has a trash at
/docs/s/KEY/trash to restore pages from. The sidebar's head switches between spaces, and its
search finds pages in the space. A space opens on its home page, or on an overview of its pages
when it has none. New pages come from a template picker, at the top of a space or inside a page.
Create › Page opens the picker and Create › Space a dialog for the name, key and colour; creating
a space is offered only to people who hold "Create spaces". Changes made in another tab or by
someone else show up without a reload. On narrow screens the sidebar folds into a drawer.

For API clients: `GET /api/v1/docs/home/attention` lists what needs the caller's attention. No
schema or configuration change.
