---
'@bemmoly/module-docs': minor
'@bemmoly/ui': minor
---

A Docs page now has a face and a margin. Pages take a drawn icon in one of eight tints and an
optional drawn cover, both chosen in place, and covers can be undone. One row of properties under
the title (status, owner, reviewers, labels, when it was edited and how long it takes to read)
replaces the chips and the About panel, and every value edits where it is shown. One right margin
shows the outline, the comments or the linked work, chosen from header buttons with counts
(⌘⌥O, ⌘⌥C, ⌘⌥L). Comments get a marker beside each anchored line, and threads sit level with
their passages; resolving a thread can be undone, and J, K, R and E work from the keyboard.
Version history is now a mode of the page (⌘⌥H) with a day-grouped timeline, and Restore happens
at once with Undo instead of asking first. Share says who can see the page and copies its link.
Collaborators' caret names fade after three seconds still.

Schema: adds a nullable `cover` column to `pages` (changeset `0016-docs-page-cover`). It is
reversible and the previous minor ignores it.
