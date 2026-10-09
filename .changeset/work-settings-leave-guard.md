---
'@bemmoly/module-work': patch
'@bemmoly/core-web': patch
'@bemmoly/web': patch
---

Unsaved work in Work settings is no longer lost when leaving through the top bar, Back or a
typed address. Board settings with an unsaved draft shows its unsaved-changes bar and waits for
Keep editing or Discard and leave; the dialogs that add an issue type or a custom field ask
before dropping a name that was typed; the workflow editor finishes saving the draft before it
leaves, and asks only when that save fails. Modules get the same guard the workspace settings
pages use, so any module page can hold a move away from unsaved work. No configuration or
schema change.
