---
'@bemmoly/shared': patch
'@bemmoly/core': patch
---

When the database is too busy to answer, requests now return the plain "temporarily unavailable"
message with a Retry-After header, as intended. Two changes that landed together had left that
error built the wrong way, so its message and code could come out wrong.
