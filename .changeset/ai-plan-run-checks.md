---
'@bemmoly/core': patch
---

Palette plans are checked again as they run. Each step re-checks the person's right to run AI
actions and their opt-out, and re-reads the change it makes. A step that no longer fits fails
instead of running. Undo checks the person may still make that change. A plan more than an hour
old can no longer be run: ask again for a fresh one.
