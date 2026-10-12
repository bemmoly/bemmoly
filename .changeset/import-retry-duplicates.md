---
'@bemmoly/core': patch
'@bemmoly/module-docs': patch
'@bemmoly/module-work': patch
---

**Large imports no longer create duplicate pages.** A Markdown or Confluence file import of more
than 200 pages saved its pages, then failed while telling open screens about them, and each
retry imported the pages again, up to three times. Realtime updates of any size now go out in
batches. A failed update after the data is saved is logged and counted in
`bemmoly_realtime_publish_errors_total` and no longer fails the job. A retried import job now
finds what an earlier run wrote and does not write it again. The Confluence, Jira, CSV and AI
client (MCP) importers now record each page, issue, comment, board and sprint in the same
transaction that creates it, so a resumed import does not create these twice.

Schema: Docs adds the `page_imports` table (changeset `0018-docs-page-imports`), which is
additive and safe to roll back. No configuration change. Imports that already ran with
duplicates are not cleaned up automatically. Find the extra copies in the page tree and delete
them.
