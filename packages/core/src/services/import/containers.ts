import type {
  ImportContainer,
  ImportCount,
  ImportContainerCounts,
  ImportContainerPage,
  ImportContainerQuery,
  ImportContainerRow,
  ImportSelectionScope,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { ImportContainerRef } from '../../contracts/importer.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/*
 * The rows of import_containers: what a connection found, listed a page at a time in the
 * source's order, searched and filtered with the same rules as matchesScope in the shared
 * schemas, counted on demand, and ticked through selection operations applied in order.
 */

interface ContainerRecord {
  source_id: string;
  position: number;
  key: string | null;
  name: string;
  kind: string;
  type: string | null;
  lead_name: string | null;
  access: 'ok' | 'none';
  count: number | null;
  imported_target_id: string | null;
  imported_key: string | null;
  imported_name: string | null;
  imported_at: Date | string | null;
  key_in_use: boolean;
  selected: boolean;
  target_mode: 'create' | 'existing' | 'update' | null;
  target_key: string | null;
  target_id: string | null;
  target_name: string | null;
  target_note: string | null;
  target_error: string | null;
  run_status: 'waiting' | 'running' | 'done' | 'failed' | null;
  run_phase: string | null;
  run_done: number;
  run_total: number;
  run_error: string | null;
  run_result: { counts?: Record<string, ImportCount>; path?: string | null } | null;
}

const CHUNK = 1000;

const toRow = (record: ContainerRecord): ImportContainerRow => ({
  id: record.source_id,
  key: record.key,
  name: record.name,
  kind: record.kind,
  type: record.type,
  lead: record.lead_name,
  access: record.access,
  count: record.count,
  imported:
    record.imported_target_id && record.imported_at
      ? {
          id: record.imported_target_id,
          key: record.imported_key ?? '',
          name: record.imported_name ?? '',
          at: new Date(record.imported_at).toISOString(),
        }
      : null,
  keyInUse: record.key_in_use,
  selected: record.selected,
  progress: record.run_status
    ? {
        status: record.run_status,
        phase: record.run_phase,
        done: record.run_done,
        total: record.run_total,
        error: record.run_error,
        counts: record.run_result?.counts ?? {},
        path: record.run_result?.path ?? null,
      }
    : null,
  target: record.target_mode
    ? {
        mode: record.target_mode,
        key: record.target_key ?? '',
        id: record.target_id,
        name: record.target_name,
        note: record.target_note,
        error: record.target_error,
      }
    : null,
});

/** Stores what discovery found, in its order; a reconnect replaces nothing (new job). */
export async function insertContainers(
  sql: SqlExecutor,
  jobId: string,
  containers: readonly ImportContainer[],
): Promise<void> {
  for (let start = 0; start < containers.length; start += CHUNK) {
    const chunk = containers.slice(start, start + CHUNK).map((container, index) => ({
      source_id: container.id,
      position: start + index,
      key: container.key,
      name: container.name || container.key || container.id,
      kind: container.kind,
      type: container.type ?? null,
      lead_name: container.lead ?? null,
      access: container.access ?? 'ok',
      count: container.count,
      imported_target_id: container.imported?.id ?? null,
      imported_key: container.imported?.key ?? null,
      imported_name: container.imported?.name ?? null,
      imported_at: container.imported?.at ?? null,
      key_in_use: container.keyInUse ?? false,
    }));
    await sql`
      insert into import_containers (job_id, source_id, position, key, name, kind, type,
        lead_name, access, count, counted_at, imported_target_id, imported_key, imported_name,
        imported_at, key_in_use)
      select ${jobId}::uuid, r.source_id, r.position, r.key, r.name, r.kind, r.type,
        r.lead_name, r.access, r.count, case when r.count is null then null else now() end,
        r.imported_target_id, r.imported_key, r.imported_name, r.imported_at, r.key_in_use
      from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as r(source_id text,
        position int, key text, name text, kind text, type text, lead_name text, access text,
        count int, imported_target_id uuid, imported_key text, imported_name text,
        imported_at timestamptz, key_in_use boolean)
      on conflict (job_id, source_id) do nothing`;
  }
}

/** The SQL twin of matchesScope: a search over key, name and lead, then a filter. */
export function scopeWhere(sql: SqlExecutor, scope: ImportSelectionScope) {
  const q = scope.q?.trim().toLowerCase();
  const like = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const search = like
    ? sql`and (lower(coalesce(key, '')) like ${like} or lower(name) like ${like}
        or lower(coalesce(lead_name, '')) like ${like})`
    : sql``;
  const filter =
    scope.filter === 'new'
      ? sql`and imported_target_id is null and access = 'ok'`
      : scope.filter === 'imported'
        ? sql`and imported_target_id is not null`
        : scope.filter === 'noaccess'
          ? sql`and access = 'none'`
          : scope.filter === 'selected'
            ? sql`and selected`
            : scope.filter === 'failed'
              ? sql`and selected and run_status = 'failed'`
              : scope.filter === 'others'
                ? sql`and selected and run_status is distinct from 'failed'`
                : scope.filter === 'attention'
                  ? sql`and selected and target_mode is not null and (target_error is not null
                  or target_mode <> 'create' or target_key is distinct from key)`
                  : sql``;
  return sql`${search} ${filter}`;
}

export async function filterCounts(
  sql: SqlClient,
  jobId: string,
  q?: string,
): Promise<ImportContainerCounts> {
  const scoped = scopeWhere(sql, { filter: 'all', ...(q ? { q } : {}) });
  const [row] = await sql<ImportContainerCounts[]>`
    select count(*)::int as all,
      count(*) filter (where imported_target_id is null and access = 'ok')::int as new,
      count(*) filter (where imported_target_id is not null)::int as imported,
      count(*) filter (where access = 'none')::int as noaccess,
      count(*) filter (where selected)::int as selected,
      count(*) filter (where selected and target_mode is not null and (target_error is not null
        or target_mode <> 'create' or target_key is distinct from key))::int as attention
    from import_containers where job_id = ${jobId} ${scoped}`;
  return row ?? { all: 0, new: 0, imported: 0, noaccess: 0, selected: 0, attention: 0 };
}

export async function listContainers(
  sql: SqlClient,
  jobId: string,
  query: ImportContainerQuery,
): Promise<ImportContainerPage> {
  const scope = { filter: query.filter, ...(query.q ? { q: query.q } : {}) };
  const after = query.cursor ? Number(query.cursor) : -1;
  const records = await sql<ContainerRecord[]>`
    select source_id, position, key, name, kind, type, lead_name, access, count,
      imported_target_id, imported_key, imported_name, imported_at, key_in_use, selected,
      target_mode, target_key, target_id, target_name, target_note, target_error,
      run_status, run_phase, run_done, run_total, run_error, run_result
    from import_containers
    where job_id = ${jobId} and position > ${after} ${scopeWhere(sql, scope)}
    order by position limit ${query.limit + 1}`;
  const more = records.length > query.limit;
  const items = records.slice(0, query.limit);
  const [view] = await sql<{ total: number; selectable: number; selected: number }[]>`
    select count(*)::int as total, count(*) filter (where access = 'ok')::int as selectable,
      count(*) filter (where selected)::int as selected
    from import_containers where job_id = ${jobId} ${scopeWhere(sql, scope)}`;
  return {
    items: items.map(toRow),
    next: more ? String(items.at(-1)!.position) : null,
    view: view ?? { total: 0, selectable: 0, selected: 0 },
    counts: await filterCounts(sql, jobId, query.q),
  };
}

/** The rows among these ids still to be counted, with what the source needs to count them. */
export async function containerRefs(
  sql: SqlExecutor,
  jobId: string,
  ids: readonly string[] | 'selected',
  onlyUncounted = false,
): Promise<ImportContainerRef[]> {
  const which =
    ids === 'selected' ? sql`and selected` : sql`and source_id = any(${ids as string[]}::text[])`;
  return sql<ImportContainerRef[]>`
    select source_id as id, key, name, kind, count from import_containers
    where job_id = ${jobId} ${which} and access = 'ok'
      ${onlyUncounted ? sql`and count is null` : sql``}
    order by position`;
}

export async function saveCounts(
  sql: SqlExecutor,
  jobId: string,
  counts: Readonly<Record<string, number>>,
): Promise<void> {
  const rows = Object.entries(counts).map(([source_id, count]) => ({ source_id, count }));
  if (!rows.length) return;
  await sql`
    update import_containers c set count = r.count, counted_at = now(), updated_at = now()
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(source_id text, count int)
    where c.job_id = ${jobId} and c.source_id = r.source_id`;
}

export async function countsOf(
  sql: SqlExecutor,
  jobId: string,
  ids: readonly string[],
): Promise<{ id: string; count: number }[]> {
  return sql<{ id: string; count: number }[]>`
    select source_id as id, count from import_containers
    where job_id = ${jobId} and source_id = any(${ids as string[]}::text[]) and count is not null`;
}
