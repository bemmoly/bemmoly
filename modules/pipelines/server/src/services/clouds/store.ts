import type { SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { Layout } from '../../../../shared/clouds.ts';
import type { EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type {
  ConnectionRow,
  PlanRow,
  ZoneEnvironmentRow,
  ZoneGroupRow,
} from '../../models/clouds.ts';
import type { ConnectionRecord } from '../providers/contract.ts';
import type { ConnectCloud } from './connections.ts';
import type { ZoneInput } from './layout.ts';
import { keyOf } from './order.ts';
import type { RecordedResource } from './tree.ts';

/* Reads and writes of connections, plans and what the reconciler recorded. */

const CONNECTION_COLUMNS = `id, provider, name, status, principal, boundary_ref, layout, config,
  last_checked_at, last_error, problems, created_at`;

const PLAN_COLUMNS = `id, connection_id, layout, spec_hash, desired, tree, counts, blockers,
  warnings, billing, status, attempts, last_error, created_at`;

export const toRecord = (row: ConnectionRow): ConnectionRecord => ({
  id: row.id,
  provider: row.provider as Provider,
  name: row.name,
  layout: row.layout as Layout,
  boundaryRef: row.boundary_ref,
  config: row.config,
});

export async function listConnections(sql: SqlClient): Promise<ConnectionRow[]> {
  return sql<ConnectionRow[]>`
    select ${sql.unsafe(CONNECTION_COLUMNS)} from cloud_connections order by created_at, id`;
}

export async function requireConnection(sql: SqlClient, id: string): Promise<ConnectionRow> {
  const [row] = await sql<ConnectionRow[]>`
    select ${sql.unsafe(CONNECTION_COLUMNS)} from cloud_connections where id = ${id}`;
  if (!row) throw new NotFoundError('No cloud connection has that id');
  return row;
}

/** How a sign-in choice is stored: the credential kinds the Google Cloud clients read. */
function credentialsOf(body: Extract<ConnectCloud, { provider: 'gcp' }>) {
  switch (body.signIn) {
    case 'vm':
      return { kind: 'metadata' };
    case 'application_default':
      return { kind: 'application_default' };
    case 'workload_identity_file':
      return { kind: 'external_account', config: body.credentialFile ?? {} };
  }
}

/** Config is everything the body says except its name and layout; never a secret. */
export function configOf(body: ConnectCloud): Record<string, unknown> {
  const config: Record<string, unknown> = { ...body };
  for (const key of ['provider', 'name', 'layout', 'signIn', 'credentialFile']) delete config[key];
  return body.provider === 'gcp' ? { ...config, credentials: credentialsOf(body) } : config;
}

export async function insertConnection(
  sql: SqlClient,
  body: ConnectCloud,
  createdBy: string | null,
): Promise<ConnectionRow> {
  const { provider, name, layout } = body;
  const config = configOf(body);
  // The folder bootstrap.sh made is the boundary from the start: Pipelines never makes one.
  const boundary =
    body.provider === 'gcp' && body.mode === 'managed' && body.folderId
      ? `folders/${body.folderId}`
      : null;
  const [row] = await sql<ConnectionRow[]>`
    insert into cloud_connections (provider, name, layout, config, boundary_ref, created_by)
    values (${provider}, ${name}, ${layout}, ${JSON.stringify(config)}::jsonb, ${boundary},
      ${createdBy})
    returning ${sql.unsafe(CONNECTION_COLUMNS)}`;
  if (!row) throw new Error('insert returned nothing');
  return row;
}

export async function recordCheck(
  sql: SqlClient,
  id: string,
  check: { ok: boolean; principal: string | null; problems: string[] },
): Promise<ConnectionRow> {
  const [row] = await sql<ConnectionRow[]>`
    update cloud_connections
    set status = ${check.ok ? 'connected' : 'failed'},
      principal = coalesce(${check.principal}, principal),
      last_error = ${check.ok ? null : check.problems.join(' ')},
      problems = ${JSON.stringify(check.problems)}::jsonb,
      last_checked_at = now(), updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(CONNECTION_COLUMNS)}`;
  if (!row) throw new NotFoundError('No cloud connection has that id');
  return row;
}

/** Sets or clears one key of a connection's config, keeping the rest. */
export async function setConfigValue(
  sql: SqlClient,
  id: string,
  key: 'registry' | 'ciAccountId',
  value: string | null,
): Promise<ConnectionRow> {
  const [row] = await sql<ConnectionRow[]>`
    update cloud_connections
    set config = case when ${value}::text is null then config - ${key}::text
        else config || jsonb_build_object(${key}::text, ${value}::text) end,
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(CONNECTION_COLUMNS)}`;
  if (!row) throw new NotFoundError('No cloud connection has that id');
  return row;
}

export async function recordBoundary(sql: SqlClient, id: string, ref: string): Promise<void> {
  await sql`update cloud_connections set boundary_ref = ${ref}, updated_at = now() where id = ${id}`;
}

/**
 * The environments on this connection's provider, and the catalog the layouts split by. An
 * environment that deploys into a project someone attached is left out: a landing zone never
 * takes over a project a person chose.
 */
export async function zoneInput(
  sql: SqlClient,
  connection: ConnectionRow,
  layout: Layout,
  environmentKeys: readonly string[] | undefined,
): Promise<ZoneInput> {
  const environments = await sql<ZoneEnvironmentRow[]>`
    select e.id, e.key, e.name, e.class from pipeline_environments e
    where e.archived_at is null and e.provider = ${connection.provider}
      and (${environmentKeys ? sql`e.key = any(${environmentKeys as string[]}::text[])` : sql`true`})
      and not exists (
        select 1 from cloud_accounts a
        where a.origin = 'attached' and (a.id = e.cloud_account_id or a.id in (
          select m.cloud_account_id from pipeline_environment_accounts m
          where m.environment_id = e.id)))
    order by e.position, e.id`;
  if (environmentKeys && environments.length < new Set(environmentKeys).size) {
    throw new NotFoundError(`Some of those environments do not exist on ${connection.provider}`);
  }
  const domains = await sql<Array<{ id: string; key: string; name: string }>>`
    select id, key, name from pipeline_domains order by position, id`;
  const groups = await sql<ZoneGroupRow[]>`
    select id, key, name, domain_id from pipeline_groups order by domain_id, key`;
  return {
    connection: { id: connection.id, name: connection.name, layout, config: connection.config },
    environments: environments.map((row) => ({ ...row, class: row.class as EnvironmentClass })),
    domains,
    groups: groups.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      domainId: row.domain_id,
    })),
  };
}

export async function recordedResources(
  sql: SqlClient,
  connectionId: string,
): Promise<Map<string, RecordedResource>> {
  const rows = await sql<
    Array<{
      kind: string;
      name: string;
      account: string;
      status: string;
      spec_hash: string | null;
      reconciled: boolean;
    }>
  >`
    select r.kind, r.name, a.external_id as account, r.status, r.spec_hash,
      r.last_reconciled_at is not null as reconciled
    from cloud_resources r join cloud_accounts a on a.id = r.account_id
    where a.connection_id = ${connectionId}`;
  return new Map(
    rows.map((row) => [
      keyOf(row as never),
      {
        status: row.status as RecordedResource['status'],
        specHash: row.spec_hash,
        everReconciled: row.reconciled,
      },
    ]),
  );
}

export async function insertPlan(
  sql: SqlClient,
  plan: Omit<PlanRow, 'id' | 'status' | 'attempts' | 'last_error' | 'created_at'> & {
    createdBy: string | null;
  },
): Promise<PlanRow> {
  const [row] = await sql<PlanRow[]>`
    insert into cloud_landing_zone_plans
      (connection_id, layout, spec_hash, desired, tree, counts, blockers, warnings, billing,
        created_by)
    values (${plan.connection_id}, ${plan.layout}, ${plan.spec_hash},
      ${JSON.stringify(plan.desired)}::jsonb, ${JSON.stringify(plan.tree)}::jsonb,
      ${JSON.stringify(plan.counts)}::jsonb, ${plan.blockers}::text[], ${plan.warnings}::text[],
      ${plan.billing === null ? null : JSON.stringify(plan.billing)}::jsonb, ${plan.createdBy})
    returning ${sql.unsafe(PLAN_COLUMNS)}`;
  if (!row) throw new Error('insert returned nothing');
  return row;
}

export async function findPlan(sql: SqlClient, id: string): Promise<PlanRow | null> {
  const [row] = await sql<PlanRow[]>`
    select ${sql.unsafe(PLAN_COLUMNS)} from cloud_landing_zone_plans where id = ${id}`;
  return row ?? null;
}

export async function setPlanStatus(
  sql: SqlClient,
  id: string,
  status: 'applying' | 'applied' | 'failed',
  error: string | null = null,
): Promise<void> {
  await sql`
    update cloud_landing_zone_plans
    set status = ${status}, last_error = ${error}, updated_at = now(),
      applied_at = case when ${status} = 'applied' then now() else applied_at end
    where id = ${id}`;
}

/** Marks the plan applying and counts the attempt, which keys its job. */
export async function startApplying(sql: SqlClient, plan: PlanRow): Promise<number> {
  const [row] = await sql<{ attempts: number }[]>`
    update cloud_landing_zone_plans
    set status = 'applying', attempts = attempts + 1, last_error = null, updated_at = now()
    where id = ${plan.id}
    returning attempts`;
  await sql`
    update cloud_connections set layout = ${plan.layout}, updated_at = now()
    where id = ${plan.connection_id}`;
  return row?.attempts ?? plan.attempts + 1;
}

/** Older previews of the same connection can no longer be applied once one is. */
export async function supersedeOtherPlans(sql: SqlClient, connectionId: string, keep: string) {
  await sql`
    update cloud_landing_zone_plans set status = 'superseded', updated_at = now()
    where connection_id = ${connectionId} and id <> ${keep} and status = 'planned'`;
}
