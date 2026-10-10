---
'@bemmoly/core': patch
---

AI calls that are stopped or time out now count toward the monthly budget. Closing an answer or an
editor write while it streams used to record the call at $0. It now charges an estimate for the
prompt and the text that already arrived, so cancelling can no longer get past the budget. Calls the
provider refuses still cost nothing.
