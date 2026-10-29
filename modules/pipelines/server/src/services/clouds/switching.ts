import type { SqlClient } from '@bemmoly/core';
import type { DesiredZone } from './layout.ts';
import type { KeptAccount } from './tree.ts';

/*
 * Changing the layout of a managed connection ("switch any time"). A new layout's plan adds
 * the accounts it needs and points each environment at its new account. It never deletes:
 * accounts the new layout no longer declares are kept as they are, listed in the plan, and
 * left for a person to empty and delete. What already runs in an old account keeps running
 * there until then; the next deploy of each service goes to the new one.
 */

/** Accounts Pipelines created for this connection that `zone` no longer declares. */
export async function keptAccounts(
  sql: SqlClient,
  connectionId: string,
  zone: DesiredZone,
): Promise<KeptAccount[]> {
  const declared = zone.accounts.map((account) => account.externalId);
  return sql<KeptAccount[]>`
    select external_id as "externalId", name from cloud_accounts
    where connection_id = ${connectionId} and origin = 'created'
      and not (external_id = any(${declared}::text[]))
    order by external_id`;
}

/** One sentence per environment whose deploys would go to a different account. */
export async function moveWarnings(
  sql: SqlClient,
  connectionId: string,
  zone: DesiredZone,
): Promise<string[]> {
  const rows = await sql<
    Array<{ environment_id: string; name: string; domain_id: string | null; account: string }>
  >`
    select m.environment_id, e.name, m.domain_id, a.external_id as account
    from pipeline_environment_accounts m
    join pipeline_environments e on e.id = m.environment_id
    join cloud_accounts a on a.id = m.cloud_account_id
    where a.connection_id = ${connectionId}`;
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const account of zone.accounts) {
    const served = account.environments ?? (account.environment ? [account.environment] : []);
    for (const environment of served) {
      // A layout without domains replaces every domain's mapping of the environment.
      const before = rows.filter(
        (row) =>
          row.environment_id === environment.id &&
          (!account.domain || row.domain_id === account.domain.id) &&
          row.account !== account.externalId,
      );
      for (const now of before) {
        const key = `${now.environment_id}:${now.account}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push(
          `${now.name} moves from ${now.account} to ${account.externalId}. Its next deploy goes to the new project; what runs in the old one keeps running until you remove it`,
        );
      }
    }
  }
  return warnings;
}

export function keptWarning(kept: readonly KeptAccount[]): string[] {
  if (kept.length === 0) return [];
  const names = kept.map((account) => account.externalId).join(', ');
  return [
    `This layout no longer uses ${names}. Pipelines keeps ${kept.length === 1 ? 'it' : 'them'} and never deletes a project; delete ${kept.length === 1 ? 'it' : 'them'} in Google Cloud once nothing runs there`,
  ];
}
