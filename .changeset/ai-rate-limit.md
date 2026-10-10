---
'@bemmoly/core': patch
'@bemmoly/server': patch
---

Routes that call an AI model now have their own per-person rate limit: 60 requests a minute on each
route, set with `BEMMOLY_RATE_LIMIT_AI_PER_USER`. This covers answers, plans, summary refreshes,
ghost text, /ai writes, suggested fixes, and the admin's provider tests and discovery. Before, these
only shared the general 600-a-minute budget.
