---
'@bemmoly/core': patch
---

Server logs for a failed AI call no longer contain the prompt, the provider's raw response or a key
that the provider echoed back. The log keeps the failure, its status and the provider's words with
any key removed.
