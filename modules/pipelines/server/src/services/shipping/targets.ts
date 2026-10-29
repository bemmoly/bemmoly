import type { SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { Layout } from '../../../../shared/clouds.ts';
import type { ClusterGateway } from '../../../../shared/clusters.ts';
import type {
  DeployRuntime,
  EnvironmentClass,
  Provider,
  Runtime,
} from '../../../../shared/common.ts';
import type { ReleaseRow } from '../../models/shipping.ts';
import type {
  CloudProvider,
  DeployTarget,
  Placement,
  ReleaseArtifact,
} from '../providers/contract.ts';
import { withFrontDoor } from '../front-doors/wrap.ts';
import { runtimeProblem } from '../runtimes/fit.ts';
import type { ProviderSourceOrRegistry } from './engine-deps.ts';

/*
 * Where one application deploys in one environment: the environment names its provider;
 * the account comes from the layout (per domain first, then the environment's own), and
 * the connection from the account, or the provider's only connection when it has no
 * accounts (the local Docker provider). The runtime is the one chosen in Pipelines, then the
 * application file's, then the environment's default; a runtime other than the provider's
 * default swaps in that runtime's targets and metrics, deploying into the environment's
 * cluster in the namespace of the application's catalog group. Behind a front door, shifts
 * and roll backs move the front door's weights too (front-doors/wrap.ts).
 */

interface TargetRow {
  application_id: string;
  application_key: string;
  runtime: string;
  environment_id: string;
  environment_key: string;
  environment_class: string;
  region: string | null;
  provider: string;
  account_external_id: string | null;
  account_name: string | null;
  account_config: Record<string, unknown> | null;
  connection_id: string | null;
  connection_name: string | null;
  connection_provider: string | null;
  layout: string | null;
  boundary_ref: string | null;
  config: Record<string, unknown> | null;
  deploy_runtime: string;
  group_key: string | null;
  cluster_id: string | null;
  cluster_origin: string | null;
  cluster_mode: string | null;
  cluster_project: string | null;
  cluster_location: string | null;
  cluster_name: string | null;
  cluster_status: string | null;
  cluster_gateway: ClusterGateway | null;
}

export interface ResolvedTarget {
  provider: CloudProvider;
  target: DeployTarget;
}

export interface ResolveOptions {
  /** The runtime a deployment started on, so a switch mid-canary waits for the next deploy. */
  runtime?: DeployRuntime | undefined;
  /** False leaves the front door out: a runtime move drives it itself. */
  frontDoor?: boolean;
}

function placementOf(row: TargetRow, runtime: DeployRuntime): Placement {
  return {
    runtime,
    namespace: row.group_key ?? 'default',
    cluster:
      row.cluster_id && row.cluster_project && row.cluster_location && row.cluster_name
        ? {
            id: row.cluster_id,
            origin: row.cluster_origin === 'attached' ? 'attached' : 'created',
            mode: row.cluster_mode === 'standard' ? 'standard' : 'autopilot',
            projectId: row.cluster_project,
            location: row.cluster_location,
            name: row.cluster_name,
            gateway: row.cluster_gateway,
          }
        : null,
  };
}

/** The provider with the runtime's own targets and metrics in place of its defaults. */
function forRuntime(provider: CloudProvider, row: TargetRow, placement: Placement): CloudProvider {
  const parts = placement.runtime === 'cloud-run' ? null : provider.runtimes?.[placement.runtime];
  const problem = runtimeProblem({
    runtime: placement.runtime,
    application: row.application_key,
    environment: row.environment_key,
    cluster:
      placement.cluster && row.cluster_status
        ? {
            ...placement.cluster,
            status: row.cluster_status as 'creating' | 'ready' | 'failed',
          }
        : null,
    supported: placement.runtime === 'cloud-run' || Boolean(parts),
  });
  if (problem) throw new ProviderError(problem, { provider: row.provider });
  if (!parts) return provider;
  // The default runtime's metrics would measure the wrong thing, so none beats those.
  const swapped: CloudProvider = { ...provider, targets: parts.targets };
  if (parts.metrics) swapped.metrics = parts.metrics;
  else delete swapped.metrics;
  return swapped;
}

export async function resolveTarget(
  sql: SqlExecutor,
  providers: ProviderSourceOrRegistry,
  applicationId: string,
  environmentId: string,
  options: ResolveOptions = {},
): Promise<ResolvedTarget> {
  const [row] = await sql<TargetRow[]>`
    with app as (
      select a.id, a.key, a.runtime, a.domain_id, a.file_runtimes, g.key as group_key
      from pipeline_applications a left join pipeline_groups g on g.id = a.group_id
      where a.id = ${applicationId}),
    env as (select * from pipeline_environments where id = ${environmentId}),
    account as (
      select c.* from env
      left join app on true
      left join lateral (
        select ea.cloud_account_id from pipeline_environment_accounts ea
        where ea.environment_id = env.id and (ea.domain_id = app.domain_id or ea.domain_id is null)
        order by ea.domain_id nulls last limit 1
      ) mapped on true
      join cloud_accounts c on c.id = coalesce(mapped.cloud_account_id, env.cloud_account_id)
      -- An account from another cloud (left over when an environment moved) does not apply.
      join cloud_connections cc on cc.id = c.connection_id and cc.provider = env.provider
    ),
    connection as (
      select * from cloud_connections
      where id = (select connection_id from account)
        or (not exists (select 1 from account) and provider = (select provider from env))
      order by created_at limit 1
    )
    select app.id as application_id, app.key as application_key, app.runtime,
      env.id as environment_id, env.key as environment_key, env.class as environment_class,
      env.region, env.provider, account.external_id as account_external_id,
      account.name as account_name, account.config as account_config,
      connection.id as connection_id,
      connection.name as connection_name, connection.provider as connection_provider,
      connection.layout, connection.boundary_ref, connection.config,
      coalesce(chosen.runtime, app.file_runtimes ->> env.key, env.default_runtime) as deploy_runtime,
      app.group_key, k.id as cluster_id, k.origin as cluster_origin, k.mode as cluster_mode,
      k.project_id as cluster_project, k.location as cluster_location, k.name as cluster_name,
      k.status as cluster_status, k.gateway as cluster_gateway
    from app cross join env
    left join account on true
    left join connection on true
    left join pipeline_application_runtimes chosen
      on chosen.application_id = app.id and chosen.environment_id = env.id
    left join cloud_clusters k on k.environment_id = env.id`;
  if (!row) throw new ProviderError('The application or environment no longer exists');
  const registry = typeof providers === 'function' ? await providers() : providers;
  const placement = placementOf(row, options.runtime ?? (row.deploy_runtime as DeployRuntime));
  const provider = forRuntime(registry.get(row.provider as Provider), row, placement);
  if (!row.connection_id) {
    throw new ProviderError(
      `${row.environment_key} deploys to ${provider.name}, and no ${provider.name} connection exists. Connect one in Platform › Clouds.`,
      { provider: row.provider },
    );
  }
  const resolved: ResolvedTarget = {
    provider,
    target: {
      connection: {
        id: row.connection_id,
        provider: (row.connection_provider ?? row.provider) as Provider,
        name: row.connection_name ?? row.provider,
        layout: (row.layout ?? 'per-environment') as Layout,
        boundaryRef: row.boundary_ref,
        config: row.config ?? {},
      },
      environment: {
        id: row.environment_id,
        key: row.environment_key,
        class: row.environment_class as EnvironmentClass,
        region: row.region,
      },
      account: row.account_external_id
        ? {
            externalId: row.account_external_id,
            name: row.account_name ?? row.account_external_id,
            config: row.account_config ?? {},
          }
        : null,
      application: {
        id: row.application_id,
        key: row.application_key,
        runtime: row.runtime as Runtime,
      },
      placement,
    },
  };
  return options.frontDoor === false ? resolved : withFrontDoor(sql, resolved);
}

export function artifactOf(release: ReleaseRow): ReleaseArtifact {
  return {
    id: release.id,
    version: release.version,
    commitSha: release.commit_sha,
    imageRepository: release.image_repository,
    imageDigests: release.image_digests,
    resolvedConfig: release.resolved_config,
  };
}
