---
'@bemmoly/module-docs': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
---

Docs has folders, and a page that is one HTML or PDF file now fills the screen.

A page uploaded with Upload HTML or PDF opens as a file page: the file fills everything under
the header, edge to edge, with its bar kept above it. Its ··· offers Replace file… and Turn into
a page; a written page whose body is one file can go back with Show as a file page.

New folder in a space's ··· and New folder inside on a tree row make a folder and open it with
its name ready to type. A folder has no body: it lists what is in it, with New page (N) and New
folder, and draws a folder icon in the tree and the trail. An empty page can be turned into a
folder from its ···. A Markdown import's directories without an index file now arrive as
folders, and agents can create folders with `docs_create_page` (`kind: "folder"`).

Schema: one changeset (0022) adds `pages.kind`, defaulting to `page`, and marks existing
uploaded pages as file pages. It is fast and reversible.
