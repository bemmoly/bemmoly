---
'@bemmoly/module-work': patch
---

Closed issues can be reopened. The default workflow had no transition out of Done or Won't do;
Work changeset `0029-work-reopen-transitions` adds a "Reopen" transition back to the first to-do
status (Backlog) from every done status that has no transition of its own ("Reopen", then "Reopen from Won't do"), in the org default
workflow and in the project workflows copied from it, including a saved draft. A done status
that already leads somewhere is left as it was drawn. New installs get it too. Rows only, and
reversible.
