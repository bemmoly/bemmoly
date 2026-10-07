---
'@bemmoly/core': minor
'@bemmoly/web': minor
---

Settings are now guarded by the capability that owns them. Anyone holding a
`workspace.*.manage` capability can read the settings list, and saving a key needs the
capability for its group: `appearance.*` needs "Set appearance and themes"
(`workspace.appearance.manage`), `email.*` needs `workspace.email.manage`, `system.*` needs
`workspace.system.manage`, and every other workspace key needs `workspace.settings.manage`.
People who were given only the appearance capability can now save the workspace look.
Behaviour change: holding only `workspace.settings.manage` no longer lets someone change email
or system settings; give them the email or system capability as well.
