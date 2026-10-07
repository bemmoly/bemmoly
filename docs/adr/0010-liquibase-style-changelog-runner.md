# ADR 0010: Schema changes run through a Liquibase-style changelog runner in the kernel

- Status: accepted
- Date: 2026-10-07
- Tech design: [§5 Stack decisions](../tech-design.html#stack) (Schema changes), [§7.1 Schema changelog](../tech-design.html#database)

## Context

A folder of numbered SQL files is enough for one app with one schema. Bemmoly has a kernel and
several modules, each owning tables, each enabled at a different time, and contributors who
ship data backfills as well as DDL. Updates must be safe to roll back within a minor release.
The established model for this (tracked ids, checksums, preconditions, contexts, rollback, code
changesets) comes from Liquibase and Mongock, but their tools need a JVM or a separate binary.

## Decision

1. A small runner in the kernel, written in TypeScript on the existing Postgres driver, owns
   schema changes. Each module (and the kernel) has a `changelog/` folder of changesets, one
   TypeScript file each, ordered by numeric prefix.
2. A changeset has a stable id, author, description, optional preconditions and contexts,
   `up`, and `down` where the change is reversible; `irreversible` and `slow` are declared.
3. The runner records (module, id, author, checksum) per changeset and fails boot when an
   applied changeset's source changes, unless the old checksum is listed with a reason.
4. Changesets run at boot under a Postgres advisory lock, kernel first, then enabled modules
   in dependency order. A disabled module's changesets wait until it is enabled.
5. Drizzle Kit generates DDL for a new changeset; squawk lints the SQL for unsafe operations.

## Consequences

- One mechanism for DDL and data changes, per module, with the safety properties updates and
  rollbacks rely on (see the rollback modes in tech design §18).
- Release notes can list a release's changesets and flag the slow and irreversible ones,
  which the release tooling reads from the changelog folders.
- The runner is code the project owns and must test: round trips, checksums and locking run
  against real Postgres in integration tests.

## Alternatives considered

- **Liquibase or Flyway.** Mature, but a JVM in the image and XML or YAML changelogs.
- **A schema tool shelled out to at boot.** Some features sit behind a paid tier, and it is
  a second binary to ship and update.
- **A plain migration library or the ORM's migrator alone.** No preconditions, contexts or
  per-module tracking, so those would be rebuilt on top anyway.
