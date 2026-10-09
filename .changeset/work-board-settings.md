---
'@bemmoly/module-work': patch
---

Projects gain a settings screen at Project settings › Board. It shows which org default the board
inherits and how many settings the project has changed, with the full list a click away, and has
tabs for columns mapped to workflow statuses (add, rename, drag to reorder, move statuses between
columns, WIP limits), swimlanes including lanes written as queries, quick filters, the card
fields and their order, card colours by priority, type, epic or a query, and Scrum or Kanban with
sprint length, working days and the estimation unit. A live preview beside the tabs follows every
edit. Each tab is read first and changed only after Edit; saving shows what changes, and a change
that takes cards off the board, such as removing a column that holds issues or switching a Kanban
board to Scrum, says so and asks first. Reset to org default shows the difference and asks for a
typed word. People who may only edit WIP limits can change those and nothing else. Issue types and
fields get their own settings pages to inherit, override or reset the org default. Queries are
checked as they are typed and offer suggestions. Boards can now store colour rules; boards saved
before keep working unchanged. No schema or configuration change.
