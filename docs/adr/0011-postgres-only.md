# ADR 0011: Postgres is the only database

- Status: accepted
- Date: 2026-10-07
- Tech design: [§7 Database](../tech-design.html#database), [§25 Open decisions](../tech-design.html#decisions)

## Context

Self-hosters ask whether they can use the database they already run. Supporting more than one
database is the most expensive commitment an open source project can make: two migration sets,
two query layers, two test matrices and two sets of bugs, permanently. The data is relational at
its core, and the one-container promise depends on Postgres doing the work of several services.

## Decision

1. PostgreSQL 18, with pgvector and pg_trgm, is the only supported database. Postgres 17 is
   accepted with a warning.
2. Postgres also provides full-text search, vector search, the job queue (pg-boss) and
   pub/sub (`LISTEN`/`NOTIFY`); there is no Redis, search engine or broker to install.
3. The choice an admin gets is where Postgres runs: bundled by the installer, external
   (`DATABASE_URL` to a managed service or their own cluster), or from the air-gapped bundle.
4. Flexible data (custom fields, editor content) uses JSONB columns with indexes on the paths
   that are queried.

## Consequences

- One install dependency, one backup target and one thing to tune. Backups and point-in-time
  recovery cover search, vectors and the queue as well as the data.
- Integration tests run against real Postgres, never a mock, because the queue, search and
  `NOTIFY` cannot be imitated honestly.
- Throughput of the queue and pub/sub is bounded by Postgres; comfortable for the target
  sizes, and the reason the design says so explicitly.
- Teams standardised on another database must run Postgres for Bemmoly.

## Alternatives considered

- **A document database as an option.** Doubles every data-layer cost and loses the
  consolidation that makes one container possible.
