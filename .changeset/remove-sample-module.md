---
'@bemmoly/server': minor
'@bemmoly/core': patch
'@bemmoly/shared': patch
'@bemmoly/web': patch
---

The Sample module is no longer in the image, so it no longer shows in Settings › Modules, the
sidebar or Users › Module access. It was a developer example that proved the module contract; a
test-only fixture module now does that and never ships.

Existing installs that enabled Sample update normally: the server boots without warnings and
Sample simply stops loading. Users › Module access no longer lists grants for a module the image
does not ship; the grants stay stored. Nothing is dropped: the `sample_items` table, Sample's
rows in `schema_changelog`, `modules` and `module_grants`, and its `sample.greeting` setting stay
in the database, unused. To remove the table through the app, disable Sample and use Remove data
in Settings › Modules before updating (it takes a backup first); after the update it can only be
dropped by hand (`DROP TABLE sample_items;`). If `BEMMOLY_MODULES` lists `sample`, take it out
before updating: the server refuses to start when the pin names a module the image does not
ship. No schema change.
