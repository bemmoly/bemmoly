# Schema changelog

The kernel's Liquibase-style runner (tech design 7.1). It applies TypeScript
changesets, records each in `schema_changelog`, and refuses to run a changed
one.

## Writing a changeset

One file per changeset in the owner's `changelog/` folder, a sibling of `src/`:
the kernel's is `packages/core/changelog/`, a module's is
`modules/<id>/changelog/`.

```ts
// packages/core/changelog/0104-teams.ts
import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0104-teams', // must equal the file name
  author: 'priya',
  description: 'Create teams and team_members',
  preconditions: [{ not: { tableExists: { table: 'teams' } }, onFail: 'markRan' }],
  contexts: ['*'], // or ['demo'] for sample data production never runs
  transactional: true, // false for CREATE INDEX CONCURRENTLY
  slow: false, // true for a table rewrite or a big index; listed in release notes
  up: async (ctx) => {
    await ctx.exec(sql`CREATE TABLE teams (id uuid PRIMARY KEY DEFAULT uuidv7(), ...)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE teams`);
  },
});
```

- **Numbering.** Four-digit prefix, then a lowercase dashed name. Within a
  folder prefixes are contiguous, except that a new block of 100 may start:
  the kernel uses 00xx for the data kernel, 01xx for identity, 02xx for email
  and notifications, so streams never collide. Any other gap, a duplicate
  prefix or an id that differs from its file name fails `db validate`, and a
  gap or duplicate also fails boot.
- **Checksums.** The sha256 of the file. Editing a changeset that has run fails
  boot with both hashes. If the edit is intended (a comment, a typo), list the
  recorded hash in `validChecksums` with a reason; the new hash is then stored.
  `runOnChange` re-runs instead; `runAlways` runs on every update.
- **down.** Required unless the change loses data; then omit it and set
  `irreversible: true`. A missing `down` without that flag fails
  `db validate`. Rolling back past an irreversible changeset is refused.
- **Preconditions.** `tableExists`, `columnExists`, `indexExists`, `rowCount`,
  `sqlCheck`, and `not` around any of them. Each states what must hold to run;
  when it does not, `onFail` decides: `halt` stops the run, `markRan` records
  it as done without running (upgraded and fresh installs converge), `skip`
  leaves it pending, `warn` logs and runs anyway.
- **Arrays.** Drizzle expands a JS array inside `sql` into a row; pass one as a
  single parameter with `sql.param(ids)`, e.g. `id = any(${sql.param(ids)}::uuid[])`.
- **Backfills.** `ctx.backfill(table, { batch }, async (rows) => …)` walks the
  table by `id` in batches and stores progress on the changelog row; a
  non-transactional changeset that crashed resumes where it stopped after
  `db update --retry-started`. A changeset that backfills is recorded as slow.
- **Services.** Code changesets reach kernel services through `ctx.services`.
- **Generating DDL.** Edit the Drizzle model, then write the matching SQL into
  the next changeset (see `src/models/README.md`).

## How it runs

Kernel first, then enabled modules in dependency order, under one Postgres
advisory lock, so replicas starting together apply each changeset once. Each
changeset runs in its own transaction; a non-transactional one writes a
`started` row first, so a crash shows as `started`, not as pending. The server
runs pending changesets at boot unless `BEMMOLY_DB_AUTO_MIGRATE=false`, with
the contexts in `BEMMOLY_DB_CONTEXTS` (default `production`). Enabling a module
runs its changelog under the same lock.

## Which version a row records

Every row's `app_version` is the release that applied it, from one source:
`BEMMOLY_VERSION` when it is set (the release image sets it from the tag),
otherwise the version in `apps/server/package.json`. Every workspace package
carries the same version, so a source checkout records the release it is
building towards. `appVersionOf` in `apps/server/src/config/version.ts` is the
only place that decides; the server, `bemmoly-db` and `bemmoly-system` all use
it, and backup manifests and Settings › System show the same value.

## bemmoly-db

`node apps/server/src/cli.ts <scope> <command>` (the `bemmoly-db` bin of
`@bemmoly/server`). It reads `DATABASE_URL`, `BEMMOLY_DB_CONTEXTS` and
`BEMMOLY_MODULES` from the environment; `pnpm --filter @bemmoly/server db …`
loads `apps/server/.env`. Exit codes: 0 success, 1 a problem was found or a
command failed, 2 usage. Every command takes `--json`.

| Command                                                                            | What it does                                                                                                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db status [--contexts a,b]`                                                       | Pending changesets per module (kernel and enabled modules), flagged slow or irreversible                                                                  |
| `db validate`                                                                      | Ids, order, duplicates, missing `down`, checksums against what ran; exit 1 on errors                                                                      |
| `db plan [--contexts a,b]`                                                         | The SQL `update` would run, without running it, in a read-only transaction                                                                                |
| `db update [--contexts a,b] [--retry-started]`                                     | Apply pending changesets                                                                                                                                  |
| `db history [--module id\|*]`                                                      | Every recorded row in execution order                                                                                                                     |
| `db tag <name>`                                                                    | Tag the latest applied changeset, e.g. the version being left before an upgrade; a changeset keeps every tag it is given, so `--to-tag` finds any of them |
| `db rollback --to <id> \| --count <n> \| --to-tag <tag> [--module id] [--dry-run]` | Run `down` newest first; `--dry-run` lists the steps and exits 1 if one is irreversible                                                                   |
| `modules list`                                                                     | Every module in the image with its state and pending changesets                                                                                           |
| `modules enable <id>`                                                              | Run its changelog, enable it; running servers follow within a second                                                                                      |
| `modules disable <id>`                                                             | Hide it; its data stays                                                                                                                                   |
| `modules remove-data <id> --confirm <id>`                                          | After a backup, run its `down` changesets (module must be disabled)                                                                                       |

`modules …` acts as a system actor and is refused while `BEMMOLY_MODULES` pins
the set. `remove-data` refuses until the backup hook is wired.
