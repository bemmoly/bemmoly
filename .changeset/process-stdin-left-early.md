---
'@bemmoly/core': patch
---

Restoring uploads from a backup no longer fails now and then with "Premature close": when tar finishes reading an archive and exits cleanly before the rest of its input is written, the exit status decides, not the closed pipe.
