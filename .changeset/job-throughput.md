---
'@bemmoly/core': patch
'@bemmoly/server': patch
---

Background jobs no longer back up for hours after a burst. Every job queue used to take one job
every 2 seconds, about 30 a minute however quick the jobs were, so a burst of emails,
notifications, digests, imports or AI work could take hours to drain (5,800 jobs took over 3
hours). A queue now takes its next job as soon as the last one finishes and only waits between
checks when it is empty: 500 quick jobs now finish in about a second instead of about 17
minutes. Emails and digests now run four at a time; backups, imports and AI work still run one
at a time.

Jobs and requests share the database connections, so a single Bemmoly process now runs at most
4 jobs at once, keeping the rest of its 10 connections for requests (a `BEMMOLY_ROLE=worker`
process runs up to 8). No configuration or schema change.
