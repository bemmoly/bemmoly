import type { SqlClient } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { DeployVariable } from '../providers/contract.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { moveSecret, selectUnmoved } from './move.ts';

/*
 * The variables one deploy runs with: the environment's own value for a name wins over the one
 * for every environment. A secret is named by where it lives and its version, never by value.
 * A value still waiting to move into the store is moved first, so it never reaches a revision
 * as plain text.
 */

interface DeployRow {
  name: string;
  kind: 'plain' | 'secret';
  value: string | null;
  secret_ref: string | null;
  version: number;
  account: string | null;
}

export async function variablesForDeploy(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  applicationId: string,
  environmentId: string,
): Promise<DeployVariable[]> {
  for (const row of await selectUnmoved(sql, { applicationId, environmentId })) {
    await moveSecret(sql, providers, row);
  }
  const rows = await sql<DeployRow[]>`
    select distinct on (v.name) v.name, v.kind, v.value, v.secret_ref, v.version,
      a.external_id as account
    from pipeline_variables v
    left join cloud_accounts a on a.id = v.secret_account_id
    where v.application_id = ${applicationId}
      and (v.environment_id = ${environmentId} or v.environment_id is null)
    order by v.name, v.environment_id nulls last`;
  return rows.map((row): DeployVariable => {
    if (row.kind === 'plain') return { name: row.name, kind: 'plain', value: row.value ?? '' };
    if (!row.secret_ref || !row.account) {
      throw new ValidationError(
        `The project ${row.name} lived in is gone. Set ${row.name} again, then deploy`,
      );
    }
    return {
      name: row.name,
      kind: 'secret',
      account: row.account,
      secret: row.secret_ref,
      version: String(row.version),
    };
  });
}
