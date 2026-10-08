---
'@bemmoly/core': minor
---

Modules can now write the kernel's audit log. The module context carries an audit recorder
whenever the database is present, so a module records who created a project or overrode a
scheme in the same audit log that settings changes use, inside its own transaction. No
configuration or schema change.
