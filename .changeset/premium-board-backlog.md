---
'@bemmoly/ui': minor
'@bemmoly/module-work': minor
---

The Board and the Backlog now look and behave as two views of the same issues. Cards and rows
show the same fields in the same order, epics keep one stored colour on every screen, and both
screens share one filter bar whose filters live in the address, so a filtered view can be shared
and survives a reload. Filters now hide issues instead of fading them, and every count follows.
One click opens an issue in a peek beside the list (`?issue=KEY`), with ↑↓ or j and k to step
through. Cards and rows offer assign, open and more on hover and on right-click, columns offer
New issue in place, and deleting an issue can be undone for a few seconds. On the Backlog, rows
can be selected with their box, Shift or Cmd, and a bulk bar assigns, sets priority, moves to a
sprint or deletes. The sprint strip shows a two-tone progress bar, and Complete sprint opens the
real dialog. On phones the Board shows one column at a time.

Schema: adds a nullable `color` column to `issues` (changeset `0023-work-epic-color`), filled for
existing epics in rank order. It is reversible.
