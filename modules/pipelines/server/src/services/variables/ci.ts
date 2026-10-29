import type { SqlClient } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { homeOf } from './home.ts';

/*
 * The values a CI job's steps name, from the variables set for every environment. A secret is
 * read from the store here, in memory, for the one answer the runner collects before its first
 * step; it is never written anywhere. The runner needs the value itself to put in a step's
 * environment and to mask it in logs, and a runner on a laptop has no cloud identity to read
 * the store with, so the server reads it on the runner's behalf.
 */

interface CiRow {
  name: string;
  value: string | null;
  secret_ref: string | null;
  version: number;
  secret_account_id: string | null;
}

export async function ciSecretValues(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  applicationId: string,
  names: readonly string[],
): Promise<Record<string, string>> {
  const rows = await sql<CiRow[]>`
    select name, value, secret_ref, version, secret_account_id from pipeline_variables
    where application_id = ${applicationId} and environment_id is null
      and name = any(${[...names]}::text[])`;
  const values: Record<string, string> = {};
  for (const row of rows) {
    // A plain variable, or a secret from before the store that has not moved yet.
    if (row.value !== null) {
      values[row.name] = row.value;
      continue;
    }
    if (!row.secret_ref) continue;
    const home = await homeOf(sql, providers, row.secret_account_id);
    if (!home.secrets.accessVersion) {
      throw new ProviderError(`${row.name} lives where CI jobs cannot read it yet`);
    }
    values[row.name] = await home.secrets.accessVersion(home.connection, {
      account: home.account,
      name: row.secret_ref,
      version: String(row.version),
    });
  }
  return values;
}
