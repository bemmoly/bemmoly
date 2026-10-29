import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { ClusterRow } from '../../models/clusters.ts';

/* Reads and writes of clusters: one per environment, created or attached. */

const COLUMNS = `k.id, k.connection_id, c.name as connection_name, c.provider as connection_provider,
  c.layout as connection_layout, c.boundary_ref as connection_boundary_ref,
  c.config as connection_config, k.environment_id, e.key as environment_key,
  e.name as environment_name, e.class as environment_class, k.origin, k.mode, k.project_id,
  k.location, k.name, k.status, k.release_channel, k.gateway, k.problems, k.last_checked_at,
  k.created_at, a.external_id as account_external_id, a.config as account_config`;

const FROM = `cloud_clusters k
  join cloud_connections c on c.id = k.connection_id
  join pipeline_environments e on e.id = k.environment_id
  left join cloud_accounts a on a.id = e.cloud_account_id`;

export async function listClusters(sql: SqlExecutor): Promise<ClusterRow[]> {
  return sql<ClusterRow[]>`
    select ${sql.unsafe(COLUMNS)} from ${sql.unsafe(FROM)}
    where e.archived_at is null order by e.position, e.key`;
}

export async function requireCluster(sql: SqlExecutor, id: string): Promise<ClusterRow> {
  const [row] = await sql<ClusterRow[]>`
    select ${sql.unsafe(COLUMNS)} from ${sql.unsafe(FROM)} where k.id = ${id}`;
  if (!row) throw new NotFoundError('No cluster has that id');
  return row;
}

export interface EnvironmentPlace {
  id: string;
  key: string;
  region: string | null;
  account_external_id: string | null;
  account_config: Record<string, unknown> | null;
  connection_id: string | null;
  connection_name: string | null;
  connection_config: Record<string, unknown> | null;
}

/** An environment and the project and connection its deploys go to. */
export async function requireEnvironmentPlace(
  sql: SqlExecutor,
  environmentId: string,
): Promise<EnvironmentPlace> {
  const [row] = await sql<EnvironmentPlace[]>`
    select e.id, e.key, e.region, a.external_id as account_external_id,
      a.config as account_config, c.id as connection_id, c.name as connection_name,
      c.config as connection_config
    from pipeline_environments e
    left join cloud_accounts a on a.id = e.cloud_account_id
    left join cloud_connections c on c.id = a.connection_id
    where e.id = ${environmentId} and e.archived_at is null`;
  if (!row) throw new NotFoundError('No environment has that id');
  if (!row.connection_id || !row.account_external_id) {
    throw new ValidationError(
      `Choose a project for ${row.key} in Platform › Environments first; its cluster goes beside it`,
    );
  }
  return row;
}

const violated = (error: unknown) =>
  typeof error === 'object' && error !== null
    ? ((error as { code?: string; constraint_name?: string }).constraint_name ?? null)
    : null;

export async function insertCluster(
  sql: SqlExecutor,
  input: {
    connectionId: string;
    environmentId: string;
    environmentKey: string;
    origin: 'created' | 'attached';
    mode: 'autopilot' | 'standard';
    projectId: string;
    location: string;
    name: string;
    gateway: { namespace: string; name: string } | null;
    createdBy: string | null;
  },
): Promise<string> {
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into cloud_clusters
        (connection_id, environment_id, origin, mode, project_id, location, name, gateway,
         created_by)
      values (${input.connectionId}, ${input.environmentId}, ${input.origin}, ${input.mode},
        ${input.projectId}, ${input.location}, ${input.name},
        ${input.gateway ? JSON.stringify(input.gateway) : null}::jsonb, ${input.createdBy})
      returning id`;
    if (!row) throw new Error('insert returned nothing');
    return row.id;
  } catch (error) {
    const constraint = violated(error);
    if (constraint?.includes('environment_id')) {
      throw new ConflictError(`${input.environmentKey} has a cluster already; one is enough`);
    }
    if (constraint?.includes('project_id')) {
      throw new ConflictError(`${input.name} in ${input.projectId} is in Pipelines already`);
    }
    throw error;
  }
}

export async function recordClusterCheck(
  sql: SqlExecutor,
  id: string,
  check: {
    status: 'creating' | 'ready' | 'failed';
    problems: readonly string[];
    mode: 'autopilot' | 'standard' | null;
    releaseChannel: string | null;
  },
): Promise<void> {
  await sql`
    update cloud_clusters set status = ${check.status},
      problems = ${JSON.stringify(check.problems)}::jsonb,
      mode = coalesce(${check.mode}, mode),
      release_channel = coalesce(${check.releaseChannel}, release_channel),
      last_checked_at = now(), updated_at = now()
    where id = ${id}`;
}

/** Applications that would deploy into this environment's cluster on their next deploy. */
export async function applicationsOnCluster(
  sql: SqlExecutor,
  environmentId: string,
): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`
    select a.key from pipeline_applications a
    cross join pipeline_environments e
    left join pipeline_application_runtimes r
      on r.application_id = a.id and r.environment_id = e.id
    where e.id = ${environmentId} and a.archived_at is null
      and coalesce(r.runtime, a.file_runtimes ->> e.key, e.default_runtime) <> 'cloud-run'
    order by a.key`;
  return rows.map((row) => row.key);
}

export async function deleteCluster(sql: SqlExecutor, id: string): Promise<void> {
  await sql`delete from cloud_clusters where id = ${id}`;
}
