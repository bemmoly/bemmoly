import type { CatalogData } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';

export interface SnapshotRow {
  id: string;
  source: 'live' | 'uploaded';
  etag: string | null;
  fetchedAt: string;
  data: CatalogData;
}

interface RawSnapshot {
  id: string;
  source: 'live' | 'uploaded';
  etag: string | null;
  fetched_at: string | Date;
  data: CatalogData;
}

const toRow = (raw: RawSnapshot): SnapshotRow => ({
  id: raw.id,
  source: raw.source,
  etag: raw.etag,
  fetchedAt: new Date(raw.fetched_at).toISOString(),
  data: raw.data,
});

/** Without the data: cheap enough for every status line. */
export async function currentSnapshotMeta(
  sql: SqlExecutor,
): Promise<Omit<SnapshotRow, 'data'> | null> {
  const [row] = await sql<Omit<RawSnapshot, 'data'>[]>`
    select id, source, etag, fetched_at from ai_catalog_snapshots where is_current`;
  if (!row) return null;
  const { id, source, etag, fetchedAt } = toRow({ ...row, data: {} });
  return { id, source, etag, fetchedAt };
}

export async function currentSnapshot(sql: SqlExecutor): Promise<SnapshotRow | null> {
  const [row] = await sql<RawSnapshot[]>`select * from ai_catalog_snapshots where is_current`;
  return row ? toRow(row) : null;
}

const KEEP = 3;

/** Stores a new current snapshot and keeps the last few for the record. */
export async function storeSnapshot(
  sql: SqlExecutor,
  snapshot: {
    source: 'live' | 'uploaded';
    etag: string | null;
    data: CatalogData;
    providerCount: number;
    modelCount: number;
  },
): Promise<void> {
  await sql`update ai_catalog_snapshots set is_current = false where is_current`;
  await sql`
    insert into ai_catalog_snapshots (source, etag, data, provider_count, model_count, is_current)
    values (${snapshot.source}, ${snapshot.etag}, ${JSON.stringify(snapshot.data)}::jsonb,
      ${snapshot.providerCount}, ${snapshot.modelCount}, true)`;
  await sql`
    delete from ai_catalog_snapshots where id not in (
      select id from ai_catalog_snapshots order by fetched_at desc, id desc limit ${KEEP})`;
}

/** A 304 from models.dev: the stored copy is still current, as of now. */
export async function touchSnapshot(sql: SqlExecutor, id: string): Promise<void> {
  await sql`update ai_catalog_snapshots set fetched_at = now() where id = ${id}`;
}
