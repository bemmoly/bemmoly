---
'@bemmoly/core': patch
'@bemmoly/server': patch
'@bemmoly/deploy': minor
'@bemmoly/perf': patch
'@bemmoly/site': patch
---

Queue depth counts only jobs that can run now: `bemmoly_job_queue_depth` and `bemmoly status`
no longer include scheduled jobs such as digests, which show apart as
`bemmoly_job_queue_delayed` and `queueDelayed`. `bemmoly sync-updater` no longer prints an older
updater's usage line or restarts the app. `bemmoly doctor` warns when Postgres is tuned for a
different machine size, and the new `bemmoly tune` re-applies the tuning after a resize, asking
before it restarts the database.
