---
'@bemmoly/core': patch
---

Fix people behind one shared address (an office network) being locked out with "This page did not load". The web app reads the setup status on every page load, and that read counted against the strict sign-in limit of ten requests a minute per address. It now counts against the ordinary per-person budget; creating the first admin stays strictly limited.
