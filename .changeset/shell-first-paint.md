---
'@bemmoly/web': patch
---

The web app paints its top bar and logo as soon as the stylesheet arrives, before its
JavaScript runs or the first API call returns, so a cold load on a phone shows the frame in
under a second instead of a blank page. The app's code still downloads from the start, at low
priority, and replaces the frame in a single step once the first page is ready.
