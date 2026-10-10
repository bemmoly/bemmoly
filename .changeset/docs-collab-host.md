---
'@bemmoly/core': minor
'@bemmoly/server': minor
---

The server now hosts live collaborative documents at `/collab`, on its own port and
authenticated with the session cookie. Every change is stored in Postgres as it happens and
survives restarts; a page's text, word count, search index and links update two seconds after
typing stops.

Two new optional environment keys cap each editing connection; empty keeps the default.
`BEMMOLY_COLLAB_MAX_MESSAGE_BYTES` is the largest message one socket may send, from 64 KiB to
16 MiB (2 MiB by default). `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES` is how many document messages
one socket may send per 10 seconds (1200 by default); caret and selection updates count
separately, up to three times that, so moving the caret never spends the typing budget. A
socket over a limit is closed and the editor reconnects on its own, keeping what was typed.
Measured in a browser, the fastest key repeat with the caret moving sends about 70 messages a
second, half of them carets, so the defaults leave room for two people typing flat out.

Run one API process per install for live editing; with several, route `/collab` with session
affinity. The bundled Caddy configuration keeps editing connections open across a
configuration reload. No schema change.
