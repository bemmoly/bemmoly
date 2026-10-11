---
'@bemmoly/module-work': minor
'@bemmoly/ui': minor
---

Cards on the board now look the same for everyone. The card layout (fields, order, card colour
and colour rules) is set only by project admins and org admins in Project settings › Board ›
Cards; the board's Display menu no longer offers personal card fields or a compact density, and
choices people saved for those in their browser are ignored. Display keeps "Show empty columns",
links admins to the Cards settings, and tells everyone else where the layout is set. Saving a
board's configuration, cards included, needs "Configure board"; anyone else gets a 403.

Quick filters ("Only my issues", "Recently updated", "Blocked" and the project's own quick
filters) are now toggle chips in the Board and Backlog filter row instead of items in the Filter
menu. A few show in the row, the rest sit behind "+N more", and the choice stays in the address.
No configuration or schema change.
