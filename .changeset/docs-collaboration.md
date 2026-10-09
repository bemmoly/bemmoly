---
'@bemmoly/core': minor
'@bemmoly/server': minor
'@bemmoly/module-docs': minor
'@bemmoly/editor': minor
'@bemmoly/web': minor
---

Pages are now edited together in real time. Two or more people can type in the same page at
once, see each other's cursors labelled with their name in their avatar colour, and never
overwrite each other. Edits made while the connection drops stay in the tab and merge when it
returns, and undo only undoes your own changes. People who can view a space but not edit it see
changes live, read-only. Every change is stored in Postgres as it happens and survives restarts;
the page's text, word count, search index and links to other pages update two seconds after
typing stops, and the update log is folded into a single state in the background once it grows
past the "docs.compactThreshold" setting (500 by default).

The server serves collaborative documents at `/collab` on its own port, authenticated with the
session cookie. Two new optional settings in the environment cap each editing connection:
`BEMMOLY_COLLAB_MAX_MESSAGE_BYTES` (2 MiB by default) and `BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES`
(600 messages per 10 seconds). The bundled Caddy configuration keeps editing connections open
across a configuration reload. Run one API process per install for live editing; with several,
route `/collab` with session affinity. No schema change.

For API clients: `PATCH /api/v1/docs/pages/:id` still accepts `snapshot` and applies it as one
edit that open editors see, but the field is deprecated and will be removed in 0.4; write page
bodies through `/collab`.
