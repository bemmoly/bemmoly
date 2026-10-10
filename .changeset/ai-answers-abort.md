---
'@bemmoly/core': patch
---

Ask your docs answers on a real server again. The answer stopped its own model call as soon as the
question had been read, so every answer failed with "isn't answering right now". It now stops only
when the browser leaves before the answer is finished.
