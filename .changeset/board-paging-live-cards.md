---
'@bemmoly/module-work': minor
'@bemmoly/web': patch
'@bemmoly/ui': patch
'@bemmoly/api-client': patch
'@bemmoly/shared': patch
---

Long boards open faster and stay quiet under load. The board loads the first 50 cards of each
column; the rest of a column loads as you scroll to its foot, or with "Show N more" there.
Column counts and WIP limits still count every card, and drag and drop, the keyboard move,
filters and swimlanes work as before. When someone changes an issue, every open board now
fetches just that card and moves, updates, adds or removes it in place, instead of every
viewer reloading the whole board; a burst of changes is gathered into one read, and the
Backlog reloads once per burst rather than once per change. A card dropped at the end of a
partly loaded column now lands right below the card it was dropped under.

The web app's first load is about 30 kB (gzipped) lighter: Home, the settings-only API calls,
the logo files, the icons the frame does not draw at first, the settings sidebar and the
shortcuts and About dialogs now load when they are first needed.

For API users: `GET /api/v1/work/boards/:id/view` now returns the first 50 cards of each column
by default. Each column carries a `nextCursor`; pass `column` and `cursor` for that column's
next page, `limit` (up to 500) for a larger page, or `issueIds` for only the named cards. No
configuration or schema changes.
