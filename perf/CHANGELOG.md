# @bemmoly/perf

## 1.0.0

### Patch Changes

- c5849e4: Queue depth counts only jobs that can run now: `bemmoly_job_queue_depth` and `bemmoly status`
  no longer include scheduled jobs such as digests, which show apart as
  `bemmoly_job_queue_delayed` and `queueDelayed`. `bemmoly sync-updater` no longer prints an older
  updater's usage line or restarts the app. `bemmoly doctor` warns when Postgres is tuned for a
  different machine size, and the new `bemmoly tune` re-applies the tuning after a resize, asking
  before it restarts the database.

## 0.13.1

No changes in this release.

## 0.13.0

No changes in this release.

## 0.12.0

No changes in this release.
