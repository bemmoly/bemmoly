import type { SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { AccountRow } from '../../models/clouds.ts';
import type { AccountCheck } from '../providers/contract.ts';

/* Reads and writes of attached accounts: projects a company had before Pipelines. */

const ACCOUNT_COLUMNS = `a.id, a.connection_id, a.external_id, a.name, a.purpose, a.status,
  a.environment_class, a.origin, a.config, a.problems, a.last_checked_at, a.domain_id,
  d.key as domain_key, d.name as domain_name, d.color as domain_color`;

export async function requireAccount(
  sql: SqlClient,
  connectionId: string,
  accountId: string,
): Promise<AccountRow> {
  const [row] = await sql<AccountRow[]>`
    select ${sql.unsafe(ACCOUNT_COLUMNS)}
    from cloud_accounts a left join pipeline_domains d on d.id = a.domain_id
    where a.id = ${accountId} and a.connection_id = ${connectionId}`;
  if (!row) throw new NotFoundError('That connection has no account with that id');
  return row;
}

/** Attaching the same project again updates who Pipelines acts as there. */
export async function upsertAttached(
  sql: SqlClient,
  connectionId: string,
  input: { externalId: string; name: string; config: Record<string, unknown> },
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into cloud_accounts (connection_id, external_id, name, purpose, origin, config, status)
    values (${connectionId}, ${input.externalId}, ${input.name}, 'workload', 'attached',
      ${JSON.stringify(input.config)}::jsonb, 'planned')
    on conflict (connection_id, external_id) do update set
      name = excluded.name, config = excluded.config, origin = 'attached', updated_at = now()
    returning id`;
  if (!row) throw new Error('upsert returned nothing');
  return row.id;
}

/** `adoptName` takes the cloud's own name for the account, when the person gave none. */
export async function recordAccountCheck(
  sql: SqlClient,
  accountId: string,
  check: AccountCheck,
  adoptName: boolean,
): Promise<void> {
  await sql`
    update cloud_accounts set
      status = ${check.ok ? 'ready' : 'failed'},
      name = case when ${adoptName} then coalesce(${check.name}, name) else name end,
      problems = ${JSON.stringify(check.problems)}::jsonb,
      last_checked_at = now(), updated_at = now()
    where id = ${accountId}`;
}

/** Environment keys still deploying into an account; detaching it would strand them. */
export async function environmentsUsing(sql: SqlClient, accountId: string): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`
    select distinct e.key from pipeline_environments e
    left join pipeline_environment_accounts ea on ea.environment_id = e.id
    where e.archived_at is null
      and (e.cloud_account_id = ${accountId} or ea.cloud_account_id = ${accountId})
    order by e.key`;
  return rows.map((row) => row.key);
}

/** Secrets whose values live in an account; detaching it would strand them. */
export async function secretsIn(sql: SqlClient, accountId: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from pipeline_variables where secret_account_id = ${accountId}`;
  return row?.count ?? 0;
}

export async function deleteAccount(sql: SqlClient, accountId: string): Promise<void> {
  await sql`delete from cloud_accounts where id = ${accountId}`;
}
