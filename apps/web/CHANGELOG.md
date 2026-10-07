# @bemmoly/web

## 0.1.0

### Minor Changes

- c7e5a48: Settings are now guarded by the capability that owns them. Anyone holding a
  `workspace.*.manage` capability can read the settings list, and saving a key needs the
  capability for its group: `appearance.*` needs "Set appearance and themes"
  (`workspace.appearance.manage`), `email.*` needs `workspace.email.manage`, `system.*` needs
  `workspace.system.manage`, and every other workspace key needs `workspace.settings.manage`.
  People who were given only the appearance capability can now save the workspace look.
  Behaviour change: holding only `workspace.settings.manage` no longer lets someone change email
  or system settings; give them the email or system capability as well.

### Patch Changes

- e61b7a9: The web app paints its top bar and logo as soon as the stylesheet arrives, before its
  JavaScript runs or the first API call returns, so a cold load on a phone shows the frame in
  under a second instead of a blank page. The app's code still downloads from the start, at low
  priority, and replaces the frame in a single step once the first page is ready.
- Updated dependencies [b403d58]
  - @bemmoly/shared@0.1.0
  - @bemmoly/api-client@0.1.0
  - @bemmoly/core-web@0.1.0
  - @bemmoly/ui@0.1.0
