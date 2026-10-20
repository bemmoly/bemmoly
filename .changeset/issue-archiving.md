---
'@bemmoly/module-work': minor
'@bemmoly/shared': minor
'@bemmoly/web': minor
---

Issues can be archived. Archive an issue from its ··· menu, from a card's or row's menu, or from
the bulk bar, and Undo puts it back. An archived issue leaves the board, the backlog, lists,
search, My work and the roadmap, but still opens by its key and still counts in reports. Its page
says it is archived and offers Unarchive. In a query, `archived IS NOT EMPTY` lists archived
issues. Automation rules have a new Archive action.

Schema: one changeset (0034) adds `issues.archived_at` and an index on archived issues. It is
fast and reversible.
