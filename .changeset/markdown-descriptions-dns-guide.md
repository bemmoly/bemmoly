---
'@bemmoly/module-work': minor
'@bemmoly/editor': minor
'@bemmoly/ui': patch
'@bemmoly/deploy': minor
---

Work descriptions and comments that arrive as Markdown typed into plain lines (from the API, an
AI client or a CSV import) now show as headings, lists, code and tables; the parsed version is
saved only once someone edits it. While editing a card's description, a grip beside the hovered
line drags that block to a new place.

When a domain is set, the installer checks whether it already points at the server and, if not,
prints the A record to add, with a Cloudflare link when the zone is on Cloudflare. The install
carries on either way.

An issue open in the Board's side panel no longer lets the page scroll into blank space.
No schema or configuration change.
