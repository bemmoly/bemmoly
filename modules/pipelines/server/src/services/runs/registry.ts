import type { SqlExecutor } from '@bemmoly/core';

/*
 * Where runners push the images they build: the registry set on a cloud connection, the oldest
 * connection first when several name one. With none, images stay on the runner's machine,
 * which is enough for the local provider and nothing else.
 */
export async function registryOf(sql: SqlExecutor): Promise<string | null> {
  const [row] = await sql<{ registry: string }[]>`
    select config->>'registry' as registry from cloud_connections
    where coalesce(config->>'registry', '') <> ''
    order by created_at, id limit 1`;
  return row?.registry ?? null;
}
