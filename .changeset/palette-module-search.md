---
'@bemmoly/core': patch
'@bemmoly/shared': patch
'@bemmoly/web': patch
'@bemmoly/module-work': patch
---

The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
from search providers that modules register with `ctx.search.addProvider`; it asks only the
modules a person can open, and each provider keeps to what that person may see. Work answers
with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
"Issues" group and scope. No configuration or schema change.
