import type postgres from 'postgres';
import type { ChangelogEntry, ChangesetState } from '../../contracts/changelog.ts';

/** A pooled client or one reserved connection; both run tagged queries. */
export type Connection = postgres.Sql;

export interface HistoryRow extends ChangelogEntry {
  description: string;
  /** The newest of `tags`, kept for readers from before a row could carry several. */
  tag: string | null;
  /** Every tag on this row, oldest first: upgrades with no new changeset tag the same row. */
  tags: string[];
  progress: Record<string, unknown>;
  slow: boolean;
  irreversible: boolean;
}

interface RawRow {
  module: string;
  id: string;
  author: string;
  description: string;
  checksum: string;
  executed_at: Date | string;
  execution_ms: number;
  order_executed: number;
  app_version: string;
  contexts: string[];
  state: ChangesetState;
  tag: string | null;
  tags: string[];
  progress: Record<string, unknown>;
  slow: boolean;
  irreversible: boolean;
}

/**
 * The runner creates its own table before anything else runs, as Liquibase
 * does; it must exist before the kernel's first changeset can be recorded.
 * The Drizzle model in models/schema-changelog.ts describes the same shape.
 */
export async function ensureChangelogTable(sql: Connection): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_changelog (
      module text NOT NULL,
      id text NOT NULL,
      author text NOT NULL,
      description text NOT NULL DEFAULT '',
      checksum text NOT NULL,
      executed_at timestamptz NOT NULL DEFAULT now(),
      execution_ms integer NOT NULL DEFAULT 0,
      order_executed integer NOT NULL,
      app_version text NOT NULL,
      contexts text[] NOT NULL DEFAULT '{}',
      state text NOT NULL CHECK (state IN ('ran', 'marked_ran', 'rolled_back', 'started')),
      tag text,
      progress jsonb NOT NULL DEFAULT '{}',
      slow boolean NOT NULL DEFAULT false,
      irreversible boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (module, id)
    )`;
  // Installs created before these flags existed gain them here.
  await sql`ALTER TABLE schema_changelog ADD COLUMN IF NOT EXISTS slow boolean NOT NULL DEFAULT false`;
  await sql`
    ALTER TABLE schema_changelog ADD COLUMN IF NOT EXISTS irreversible boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE schema_changelog ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'`;
  await sql`
    UPDATE schema_changelog SET tags = ARRAY[tag]
    WHERE tag IS NOT NULL AND cardinality(tags) = 0`;
}

export async function changelogTableExists(sql: Connection): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    select to_regclass('schema_changelog') is not null as exists`;
  return row?.exists ?? false;
}

function toEntry(row: RawRow): HistoryRow {
  return {
    module: row.module,
    id: row.id,
    author: row.author,
    description: row.description,
    checksum: row.checksum,
    executedAt: new Date(row.executed_at),
    executionMs: row.execution_ms,
    orderExecuted: row.order_executed,
    appVersion: row.app_version,
    contexts: row.contexts,
    state: row.state,
    tag: row.tag,
    tags: row.tags,
    progress: row.progress,
    slow: row.slow,
    irreversible: row.irreversible,
  };
}

/** Every recorded row in execution order; empty before the first run. */
export async function readHistory(sql: Connection, module?: string): Promise<HistoryRow[]> {
  if (!(await changelogTableExists(sql))) return [];
  const rows = module
    ? await sql<
        RawRow[]
      >`select * from schema_changelog where module = ${module} order by order_executed`
    : await sql<RawRow[]>`select * from schema_changelog order by order_executed`;
  return rows.map(toEntry);
}

export interface RecordInput {
  module: string;
  id: string;
  author: string;
  description: string;
  checksum: string;
  appVersion: string;
  contexts: readonly string[];
  state: ChangesetState;
  executionMs: number;
  slow: boolean;
  irreversible: boolean;
}

/** Inserts or rewrites the row for (module, id) with the next execution order. */
export async function recordChangeset(sql: Connection, input: RecordInput): Promise<HistoryRow> {
  const [row] = await sql<RawRow[]>`
    insert into schema_changelog (module, id, author, description, checksum, executed_at,
      execution_ms, order_executed, app_version, contexts, state, progress, slow, irreversible)
    values (${input.module}, ${input.id}, ${input.author}, ${input.description}, ${input.checksum},
      now(), ${input.executionMs},
      (select coalesce(max(order_executed), 0) + 1 from schema_changelog),
      ${input.appVersion}, ${sql.array([...input.contexts])}, ${input.state}, '{}',
      ${input.slow}, ${input.irreversible})
    on conflict (module, id) do update set
      author = excluded.author, description = excluded.description, checksum = excluded.checksum,
      executed_at = excluded.executed_at, execution_ms = excluded.execution_ms,
      order_executed = excluded.order_executed, app_version = excluded.app_version,
      contexts = excluded.contexts, state = excluded.state, tag = null, tags = '{}',
      slow = excluded.slow, irreversible = excluded.irreversible,
      progress = case when schema_changelog.state = 'started' then schema_changelog.progress
                      else '{}'::jsonb end,
      updated_at = now()
    returning *`;
  if (!row) throw new Error(`schema_changelog row for ${input.module}/${input.id} was not written`);
  return toEntry(row);
}

export async function finishChangeset(
  sql: Connection,
  key: { module: string; id: string },
  state: ChangesetState,
  executionMs: number,
): Promise<HistoryRow> {
  const [row] = await sql<RawRow[]>`
    update schema_changelog set state = ${state}, execution_ms = ${executionMs}, updated_at = now()
    where module = ${key.module} and id = ${key.id}
    returning *`;
  if (!row) throw new Error(`schema_changelog row for ${key.module}/${key.id} is missing`);
  return toEntry(row);
}

export async function updateChecksum(
  sql: Connection,
  key: { module: string; id: string },
  checksum: string,
): Promise<void> {
  await sql`
    update schema_changelog set checksum = ${checksum}, updated_at = now()
    where module = ${key.module} and id = ${key.id}`;
}

export async function markRolledBack(
  sql: Connection,
  key: { module: string; id: string },
): Promise<void> {
  await sql`
    update schema_changelog set state = 'rolled_back', updated_at = now()
    where module = ${key.module} and id = ${key.id}`;
}

export async function saveProgress(
  sql: Connection,
  key: { module: string; id: string },
  progress: Record<string, unknown>,
): Promise<void> {
  await sql`
    update schema_changelog
    set progress = ${JSON.stringify(progress)}::jsonb, slow = true, updated_at = now()
    where module = ${key.module} and id = ${key.id}`;
}

/**
 * Adds a tag to the most recently executed row, keeping the tags it has (re-tagging with
 * the same name moves it to the end); returns the row, or undefined on an empty changelog.
 */
export async function tagLatest(sql: Connection, tag: string): Promise<HistoryRow | undefined> {
  const [row] = await sql<RawRow[]>`
    update schema_changelog
    set tag = ${tag}, tags = array_append(array_remove(tags, ${tag}::text), ${tag}::text),
      updated_at = now()
    where (module, id) = (
      select module, id from schema_changelog
      where state in ('ran', 'marked_ran') order by order_executed desc limit 1)
    returning *`;
  return row ? toEntry(row) : undefined;
}
