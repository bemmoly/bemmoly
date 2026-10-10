---
'@bemmoly/web': minor
'@bemmoly/core-web': minor
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/ui': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': patch
---

The Board can now select cards like the Backlog: tick a card's corner, Shift-click for a range or
⌘-click for one more, and the same bar assigns, sets priority, moves to a sprint or deletes them
with Undo. A Display menu on the Board lets each person choose the card fields, a compact density
and whether empty columns show; it never changes the board for anyone else.

Assigning, changing priority and moving to a sprint from a card, a row, the issue menu or the bulk
bar now shows at once, dims the issue until the server answers, puts it back if the change is
refused, and offers Undo. The Board, Backlog and Issue page show who else is looking at them.
Issues can be linked from their menu on the Board and Backlog.

Every icon button has the same tooltip, with its shortcut. Epics keep their colour on every
screen, project and space tiles are drawn the same everywhere, and labels that shouted in
capitals are now in sentence case. On a phone the Backlog keeps each issue's title and the
sprint's name, and Board lanes keep the epic's name. Home's My issues moves with j and k, an issue
created over a Scrum board joins the running sprint, and the loading screen follows the theme you
last used.

Someone who opens an issue in a project they are not a member of is now told so, and who can add
them, instead of being told the server did not answer.

Live updates and presence over the realtime connection are now limited to the people who can open
the project or space, as the project and space lists already were.
