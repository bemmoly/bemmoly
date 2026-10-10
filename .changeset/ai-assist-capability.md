---
'@bemmoly/core': patch
'@bemmoly/module-docs': patch
---

The "Use AI assist" permission now applies everywhere AI does. Summaries, briefs, Ask your docs,
ghost text, /ai writes and suggested fixes are refused for a role without it, and its AI surfaces
are hidden. By default that is contractors. Before, only palette plans checked it, so turning it off
in Settings › Roles had no effect.
