---
'@bemmoly/core': patch
'@bemmoly/module-work': patch
---

Fixes found by the end-to-end Work flows. Page loads no longer count against the strict
ten-a-minute limit for sign-in and setup, which locked everyone behind one office address out
with "Too many requests". Mentioning someone in an issue description now notifies them, as a
mention in a comment does. On the board, a card moved twice in a row is judged by the
transitions of its current status, a card dropped with the keyboard keeps the focus, a card
dropped on a column's refusal note says why it stays, quick moves no longer jump back while
the server catches up, and a link to a project you cannot see says so instead of inviting you
to create one. Realtime updates refetch only what changed, and an issue's activity now reads
"created the issue" rather than "changed created". No configuration or schema change.
