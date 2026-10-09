---
'@bemmoly/core-web': patch
'@bemmoly/web': patch
'@bemmoly/module-work': patch
---

Home now shows sections from the modules you can open, above "Your modules". A module adds one
by shipping `web/src/home.tsx`; a section that fails to load shows a retry card and leaves the
rest of Home working. Work adds "My work": the issues assigned to you, reported by you and
watched by you, each tab with its count, served by `GET /api/v1/work/my-issues`. No
configuration or schema change.
