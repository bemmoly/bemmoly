import type { SqlClient } from '../../clients/postgres.ts';
import type { ImportMappingRow, ImportMappingStore } from '../../contracts/importer.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

interface MappingRecord {
  source_id: string;
  target_id: string;
  meta: Record<string, unknown>;
  updated_at?: Date | string;
}

const CHUNK = 1000;

const toRow = (record: MappingRecord): ImportMappingRow => ({
  targetId: record.target_id,
  meta: record.meta ?? {},
  ...(record.updated_at ? { updatedAt: new Date(record.updated_at).toISOString() } : {}),
});

/** One source site's mappings; every read and write is scoped to (source, site). */
export function createMappingStore(
  sql: SqlClient,
  scope: { source: string; site: string; jobId: string | null },
): ImportMappingStore {
  const { source, site, jobId } = scope;

  async function setMany(
    kind: string,
    rows: readonly { sourceId: string; targetId: string; meta?: Record<string, unknown> }[],
    executor: SqlExecutor = sql,
  ): Promise<void> {
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      await executor`
        insert into import_mappings (source, site, kind, source_id, target_id, meta, job_id)
        select ${source}, ${site}, ${kind}, r.source_id, r.target_id, r.meta, ${jobId}::uuid
        from jsonb_to_recordset(${JSON.stringify(
          chunk.map((row) => ({
            source_id: row.sourceId,
            target_id: row.targetId,
            meta: row.meta ?? {},
          })),
        )}::jsonb) as r(source_id text, target_id uuid, meta jsonb)
        on conflict (source, site, kind, source_id) do update
          set target_id = excluded.target_id, meta = excluded.meta,
            job_id = excluded.job_id, updated_at = now()`;
    }
  }

  return {
    async get(kind, sourceId) {
      const [record] = await sql<MappingRecord[]>`
        select source_id, target_id, meta from import_mappings
        where source = ${source} and site = ${site} and kind = ${kind}
          and source_id = ${sourceId}`;
      return record ? toRow(record) : null;
    },
    async getMany(kind, sourceIds) {
      const found = new Map<string, ImportMappingRow>();
      for (let start = 0; start < sourceIds.length; start += CHUNK) {
        const records = await sql<MappingRecord[]>`
          select source_id, target_id, meta, updated_at from import_mappings
          where source = ${source} and site = ${site} and kind = ${kind}
            and source_id = any(${sourceIds.slice(start, start + CHUNK) as string[]}::text[])`;
        for (const record of records) found.set(record.source_id, toRow(record));
      }
      return found;
    },
    async all(kind) {
      const records = await sql<MappingRecord[]>`
        select source_id, target_id, meta from import_mappings
        where source = ${source} and site = ${site} and kind = ${kind}`;
      return new Map(records.map((record) => [record.source_id, toRow(record)]));
    },
    async set(kind, sourceId, targetId, meta, executor) {
      await setMany(kind, [{ sourceId, targetId, ...(meta ? { meta } : {}) }], executor);
    },
    setMany,
  };
}
