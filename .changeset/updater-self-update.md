---
'@bemmoly/updater': minor
'@bemmoly/deploy': minor
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/web': minor
---

The updater now moves itself to the release it installs, verified with cosign like the app image, so updater fixes reach existing installs (ADR 0020). `bemmoly upgrade` does the same, and `bemmoly sync-updater` moves an older updater once. Clicking Update opens a dialog with each step's live status; every admin sees a running update, a second one is refused, and the page reloads onto the new version when it is ready.
