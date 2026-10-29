import type { SqlClient } from '@bemmoly/core';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { environmentHome, secretIdOf, sharedHome, storedVersion } from './home.ts';

/*
 * Values from before secrets existed, moved into the secret store. A changeset cannot call a
 * cloud, so it only marks them; this sweep writes each to the store and clears it here. Until
 * it can, the row says why, and the Variables tab shows that sentence.
 */

export interface UnmovedSecret {
  id: string;
  application_id: string;
  application_key: string;
  environment_id: string | null;
  environment_key: string | null;
  name: string;
  value: string;
}

const UNMOVED = `v.id, v.application_id, a.key as application_key, v.environment_id,
  e.key as environment_key, v.name, v.value`;

/** One value to its home, then cleared here. A failure is recorded on the row and rethrown. */
export async function moveSecret(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  row: UnmovedSecret,
): Promise<void> {
  try {
    const home = row.environment_id
      ? await environmentHome(sql, providers, row.application_id, row.environment_id)
      : await sharedHome(sql, providers);
    const secret = secretIdOf(row.application_key, row.environment_key, row.name);
    const { version } = await home.secrets.writeVersion(home.connection, {
      account: home.account,
      name: secret,
      value: row.value,
    });
    // Someone may have set it again meanwhile; their write wins.
    await sql`
      update pipeline_variables set value = null, secret_ref = ${secret},
        secret_account_id = ${home.accountId}, version = ${storedVersion(version)}, problem = null,
        updated_at = now()
      where id = ${row.id} and kind = 'secret' and value = ${row.value}`;
  } catch (error) {
    await sql`
      update pipeline_variables set problem = ${(error as Error).message}
      where id = ${row.id} and value is not null`;
    throw error;
  }
}

export async function selectUnmoved(
  sql: SqlClient,
  filter: { applicationId?: string; environmentId?: string } = {},
): Promise<UnmovedSecret[]> {
  return sql<UnmovedSecret[]>`
    select ${sql.unsafe(UNMOVED)}
    from pipeline_variables v
    join pipeline_applications a on a.id = v.application_id
    left join pipeline_environments e on e.id = v.environment_id
    where v.kind = 'secret' and v.value is not null
      and (${filter.applicationId ?? null}::uuid is null
        or v.application_id = ${filter.applicationId ?? null}::uuid)
      and (${filter.environmentId ?? null}::uuid is null
        or v.environment_id is null or v.environment_id = ${filter.environmentId ?? null}::uuid)
    order by v.id
    limit 200`;
}

/** Moves every value it can; the rest keep their reason and wait for the next sweep. */
export async function moveUnmovedSecrets(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
): Promise<{ moved: number; waiting: number }> {
  let moved = 0;
  let waiting = 0;
  for (const row of await selectUnmoved(sql)) {
    try {
      await moveSecret(sql, providers, row);
      moved += 1;
    } catch {
      // The reason is on the row for the screen; the next sweep tries again.
      waiting += 1;
    }
  }
  return { moved, waiting };
}
