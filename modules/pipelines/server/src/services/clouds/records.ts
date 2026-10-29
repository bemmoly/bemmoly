import type { SqlClient } from '@bemmoly/core';
import type { Layout } from '../../../../shared/clouds.ts';
import type { AccountRow, ResourceRow } from '../../models/clouds.ts';
import type { DesiredResource } from '../providers/contract.ts';
import type { DesiredAccount } from './layout.ts';

/* What the reconciler records about accounts and resources as it works through a plan. */

export type ResourceStatus = 'pending' | 'applying' | 'ready' | 'drifted' | 'failed';
export type AccountStatus = 'planned' | 'creating' | 'ready' | 'drifted' | 'failed';

export async function upsertAccount(
  sql: SqlClient,
  connectionId: string,
  account: DesiredAccount,
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into cloud_accounts
      (connection_id, external_id, name, domain_id, environment_class, purpose)
    values (${connectionId}, ${account.externalId}, ${account.name}, ${account.domain?.id ?? null},
      ${account.environment?.class ?? null}, ${account.purpose})
    on conflict (connection_id, external_id) do update set
      name = excluded.name, domain_id = excluded.domain_id,
      environment_class = excluded.environment_class, purpose = excluded.purpose,
      updated_at = now()
    returning id`;
  if (!row) throw new Error('upsert returned nothing');
  return row.id;
}

export async function upsertResource(
  sql: SqlClient,
  accountId: string,
  resource: DesiredResource,
): Promise<{ id: string; status: ResourceStatus; specHash: string | null }> {
  const [row] = await sql<{ id: string; status: ResourceStatus; spec_hash: string | null }[]>`
    insert into cloud_resources (account_id, kind, name, desired)
    values (${accountId}, ${resource.kind}, ${resource.name}, ${JSON.stringify(resource.spec)}::jsonb)
    on conflict (account_id, kind, name) do update set desired = excluded.desired, updated_at = now()
    returning id, status, spec_hash`;
  if (!row) throw new Error('upsert returned nothing');
  return { id: row.id, status: row.status, specHash: row.spec_hash };
}

export async function markResource(
  sql: SqlClient,
  id: string,
  outcome: {
    status: ResourceStatus;
    observed?: Record<string, unknown> | null;
    specHash?: string;
    error?: string | null;
  },
): Promise<void> {
  const reconciled = outcome.status === 'ready' || outcome.status === 'drifted';
  await sql`
    update cloud_resources set
      status = ${outcome.status},
      observed = case when ${outcome.observed !== undefined}
        then ${outcome.observed === undefined ? null : JSON.stringify(outcome.observed)}::jsonb
        else observed end,
      spec_hash = coalesce(${outcome.specHash ?? null}, spec_hash),
      last_error = ${outcome.error ?? null},
      last_reconciled_at = case when ${reconciled} then now() else last_reconciled_at end,
      updated_at = now()
    where id = ${id}`;
}

export async function setAccountStatus(sql: SqlClient, id: string, status: AccountStatus) {
  await sql`update cloud_accounts set status = ${status}, updated_at = now() where id = ${id}`;
}

/** Points environments at their new account so deploys know where to go. */
export async function mapEnvironment(
  sql: SqlClient,
  layout: Layout,
  account: DesiredAccount,
  accountId: string,
): Promise<void> {
  // A group's account cannot be named by (environment, domain), so groups map nothing yet.
  if (!account.environment || layout === 'per-group-environment') return;
  await sql`
    insert into pipeline_environment_accounts (environment_id, domain_id, cloud_account_id)
    values (${account.environment.id}, ${account.domain?.id ?? null}, ${accountId})
    on conflict (environment_id, domain_id) do update
      set cloud_account_id = excluded.cloud_account_id, updated_at = now()`;
  if (layout === 'per-environment') {
    await sql`
      update pipeline_environments set cloud_account_id = ${accountId}, updated_at = now()
      where id = ${account.environment.id}`;
  }
}

/** Account statuses from their resources: failed beats drifted beats creating. */
export async function rollUpAccounts(sql: SqlClient, connectionId: string): Promise<void> {
  await sql`
    update cloud_accounts a set status = s.status, updated_at = now()
    from (
      select r.account_id,
        case
          when bool_or(r.status = 'failed') then 'failed'
          when bool_or(r.status = 'drifted') then 'drifted'
          when bool_and(r.status = 'ready') then 'ready'
          else 'creating'
        end as status
      from cloud_resources r join cloud_accounts c on c.id = r.account_id
      where c.connection_id = ${connectionId}
      group by r.account_id
    ) s
    where a.id = s.account_id and a.status is distinct from s.status`;
}

export async function listAccountRows(sql: SqlClient, connectionId: string) {
  return sql<AccountRow[]>`
    select a.id, a.connection_id, a.external_id, a.name, a.purpose, a.status, a.environment_class,
      a.origin, a.config, a.problems, a.last_checked_at, a.domain_id, d.key as domain_key, d.name as domain_name, d.color as domain_color
    from cloud_accounts a left join pipeline_domains d on d.id = a.domain_id
    where a.connection_id = ${connectionId}
    order by case a.purpose when 'control' then 0 when 'ci' then 1 else 2 end, a.external_id`;
}

export async function listResourceRows(
  sql: SqlClient,
  connectionId: string,
  status?: ResourceStatus,
) {
  return sql<ResourceRow[]>`
    select r.id, r.account_id, a.external_id as account_external_id, r.kind, r.name, r.desired,
      r.observed, r.spec_hash, r.status, r.last_reconciled_at, r.last_error
    from cloud_resources r join cloud_accounts a on a.id = r.account_id
    where a.connection_id = ${connectionId}
      and (${status ?? null}::text is null or r.status = ${status ?? null})
    order by a.external_id, r.kind, r.name`;
}
