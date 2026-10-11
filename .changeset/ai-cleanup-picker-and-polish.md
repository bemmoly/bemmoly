---
'@bemmoly/module-work': patch
'@bemmoly/module-docs': patch
'@bemmoly/core-web': patch
'@bemmoly/ui': patch
'@bemmoly/web': patch
---

New issue opened from the sidebar while a board was still loading could start in the wrong
project, then close itself and its open project picker a moment later. It now starts in the
project the address names and stays open. Workspaces with more than 100 projects, or more than
200 Docs spaces, now see all of them in the switcher, the pickers, the sidebar and their screens.

Ask your docs suggests questions about your own recent pages, or none in a new workspace. An
answer's source line reads "by AI", a comment's suggested fix uses the standard AI suggestion card
with Apply fix and Not useful on it, and a Docs page's browser tab shows the page's name.
