---
'@bemmoly/core': patch
---

A page edited in a burst is always compacted: the collab host stores every pending update before a document's change hook runs, so a slow write can no longer hide updates from the compaction check.
