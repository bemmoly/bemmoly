---
'@bemmoly/core': patch
---

The audit log now records settings, modules and backups, as Settings › Audit log says it does:
`setting.updated` and `setting.reset` with the value before and after (secrets only as set or
not set), `module.enabled`, `module.disabled` and `module.data_removed` with the module's state
and the changesets reversed, and `backup.started`, `backup.verified`, `backup.restored` and
`backup.restore_failed`. Each row is written in the same transaction as the change; a restore's
row is written into the restored database once it finishes. A save that leaves a setting as it
was writes no row.
