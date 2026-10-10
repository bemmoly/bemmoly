---
'@bemmoly/core': minor
'@bemmoly/core-web': minor
'@bemmoly/module-docs': minor
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Spaces now have members you can manage. Whoever creates a space becomes its admin, and a team's
space includes that team's people. Space admins can add people or teams, change their role and
remove them. A space always keeps at least one admin. A page can go to review with any member as
reviewer, and org admins can review in every space. Spaces created before this update get their
creators and team members added automatically.

With Work enabled, issues in a page are live. An issue chip shows the issue's type, key and
current status and opens the issue. An issue table runs its query and lists up to ten matching
issues. Typing `#` searches issues. People only see issues they are allowed to open; any other
issue prints as its bare key. An issue's linked docs and a page's "Referenced in" now work both
ways, including issues whose description links the page. Pages created from a template or
imported link their issues at once. With Work disabled, pages show quiet placeholders as before.

The Docs home shows more on each row: where the page sits ("Engineering / Architecture"), who
last edited its text, and the keys of its linked issues. Space cards show the space's recent
contributors and how many members it has.
