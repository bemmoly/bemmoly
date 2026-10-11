---
'@bemmoly/core': patch
'@bemmoly/server': patch
'@bemmoly/shared': patch
'@bemmoly/module-work': patch
'@bemmoly/module-docs': patch
---

Fixes a hang where a busy install stopped answering altogether. When several members at once
changed issue statuses, commented on issues or pages, or edited issues that tell watchers,
each of those requests held a database connection while waiting for a second one; with ten at
once every connection waited on another, and every request hung until Postgres was restarted.
Those requests now do all their work on the one connection they hold, and the same is true of
notification emails, settings reads, transition conditions, board ranking and Docs imports.

A starved database pool can no longer hang the install. A request that waits too long for a
connection now fails with a 503 (`unavailable`, with Retry-After) and an error in the server
log, and the install recovers on its own as soon as connections come free. Statement and idle
transaction timeouts end anything stuck on the database side.

New settings in `.env` (milliseconds; 0 switches one off): `BEMMOLY_DB_STATEMENT_TIMEOUT_MS`
(default 10000), `BEMMOLY_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` (default 60000),
`BEMMOLY_DB_ACQUIRE_TIMEOUT_MS` (default 10000), and `BEMMOLY_DB_NESTED_ACQUIRE` (`warn` by
default; `throw` for development). Changesets, backups, restores and the `bemmoly` command line
keep their own, longer limits. No schema change.
