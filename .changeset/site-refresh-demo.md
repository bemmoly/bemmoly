---
'@bemmoly/site': patch
---

bemmoly.com leads with "Keep your work in-house." and has a live demo at /demo: the real app on
sample data, running in the visitor's browser with no server behind it, signed in and reset on
every reload. The homepage's product shot is now a live preview of it (the board, an issue and
the workflow editor) that loads only when someone presses Try it. Every feature on the homepage
carries a status badge, so Docs (0.3), AI (0.4) and what follows read as coming rather than
shipped, and every page names one version, the newest release. The web app gains a demo build
(`pnpm --filter @bemmoly/web build:demo`) used only by the site; installs are unchanged, with no
configuration or schema change.
