---
'@bemmoly/core': patch
'@bemmoly/shared': patch
'@bemmoly/api-client': patch
'@bemmoly/web': patch
'@bemmoly/module-sample': patch
---

Fresh installs start with no module enabled. A module runs only once an admin enables it in
Settings › Modules (or lists it in `BEMMOLY_MODULES`, which still pins the set). Enabling a
module now asks "Who can use it?": Nobody yet (recommended; only org admins can open it),
Everyone, or Specific teams. Nothing is granted that the admin did not choose; the access a
module suggests is shown as a hint only. Access can be changed later under Users › Module
access, and the audit log records the access chosen on enable. `bemmoly-db modules enable`
takes `--access none|everyone|teams` and `--team <id>`, and defaults to none. The Sample
module is a developer example: it stays in the image but is off until enabled and suggests no
access. Existing installs keep the modules and grants they have; to turn Sample off, use
Disable in Settings › Modules. No configuration or schema change.
