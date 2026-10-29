---
'@bemmoly/module-pipelines': patch
'@bemmoly/pipelines-web': patch
---

Pipelines no longer offers "This machine", the provider that deploys to the server's own
Docker, unless an admin turns on the new workspace setting `pipelines.providers.local` (off
by default). Admins: an install that used "This machine" must turn the setting on before its
local environments deploy again; `demo:local setup` turns it on for the laptop demo and
`demo:local undo` turns it off.

The local traffic splitter's admin port now always needs its token: one started without a
token refuses every admin request, and a splitter made before tokens existed is replaced,
keeping its routes. `seed:demo -- --reset` now refuses a database that is not on this machine
unless you add `--force`.

In the Pipelines app, Enter on a focused button presses that button instead of opening the
selected journey on For you; the "Remind approvers" button, which only opened the promotion,
is gone; and every segmented control has a name for screen readers. The try-it walkthrough
now says how to turn the simulator on and where each step is checked.
