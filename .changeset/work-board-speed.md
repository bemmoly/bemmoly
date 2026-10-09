---
'@bemmoly/module-work': patch
---

The board loads faster, most of all on large projects: a 500-card board reads its cards in less
than half the time, and a board of nearly 5,000 cards about five times faster. When the
workflow refuses a move, only that card goes back; other cards you dropped meanwhile stay where
you put them. Screen readers now hear a move as pending at the drop, then that it went through
or why it did not, instead of hearing it moved before the server had answered.

Schema: one new index, `issues_project_updated_idx` on issues (project_id, updated_at), built
concurrently by the Work changelog (`0022-work-issues-updated-index`), so an upgrade does not
block writes while it builds. No configuration change.
