import { createModuleObjects, createObjectStore, type SqlClient } from '@bemmoly/core';
import { loadDatabaseEnv, loadEnv, storageS3ConfigOf } from '@bemmoly/core/config';
import type { LogObjects } from '../../server/src/services/logs/store.ts';

/** The seed's database, read by the kernel's loader. */
export function loadSeedConfig(): { databaseUrl: string } {
  return { databaseUrl: loadDatabaseEnv().DATABASE_URL };
}

/**
 * Pipelines' corner of the install's object store, the one the server reads job logs from:
 * the same environment and the same storage backend setting the server boots with.
 */
export async function loadPipelinesObjects(sql: SqlClient): Promise<LogObjects> {
  const env = loadEnv();
  const [row] = await sql<{ backend: string | null }[]>`
    select value #>> '{}' as backend from settings where key = 'system.storage.backend'`;
  const s3 = storageS3ConfigOf(env);
  const store = createObjectStore({
    backend: row?.backend === 's3' ? 's3' : 'disk',
    dataDir: env.BEMMOLY_DATA_DIR,
    ...(s3 ? { s3 } : {}),
  });
  return createModuleObjects('pipelines', () => store);
}
