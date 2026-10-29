import type { SqlExecutor } from '@bemmoly/core';
import type { EnvironmentClass, Provider } from '../../../../shared/common.ts';
import { environmentProtectionSchema, type Environment } from '../../../../shared/environments.ts';
import type { EnvironmentRow } from '../../models/environments.ts';

const toEnvironment = (row: EnvironmentRow): Environment => ({
  id: row.id,
  key: row.key,
  name: row.name,
  class: row.class as EnvironmentClass,
  provider: row.provider as Provider,
  region: row.region,
  position: row.position,
  cloudAccount:
    row.account_id && row.account_external_id && row.account_name
      ? { id: row.account_id, externalId: row.account_external_id, name: row.account_name }
      : null,
  // Stored jsonb may predate a field; parsing fills its default rather than sending undefined.
  protection: environmentProtectionSchema.parse(row.protection),
});

/** Live environments left to right, or the one with `key`. */
export async function selectEnvironments(sql: SqlExecutor, key?: string): Promise<Environment[]> {
  const rows = await sql<EnvironmentRow[]>`
    select e.id, e.key, e.name, e.class, e.provider, e.region, e.position, e.protection,
      c.id as account_id, c.external_id as account_external_id, c.name as account_name
    from pipeline_environments e
    left join cloud_accounts c on c.id = e.cloud_account_id
    where e.archived_at is null and (${key ?? null}::text is null or e.key = ${key ?? null})
    order by e.position, e.id`;
  return rows.map(toEnvironment);
}
