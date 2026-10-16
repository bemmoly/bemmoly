import type { SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { Layout } from '../../../../shared/clouds.ts';
import type { EnvironmentClass, Provider, Runtime } from '../../../../shared/common.ts';
import type { ReleaseRow } from '../../models/shipping.ts';
import type { CloudProvider, DeployTarget, ReleaseArtifact } from '../providers/contract.ts';
import type { ProviderSourceOrRegistry } from './engine-deps.ts';

/*
 * Where one application deploys in one environment: the environment names its provider;
 * the account comes from the layout (per domain first, then the environment's own), and
 * the connection from the account, or the provider's only connection when it has no
 * accounts (the local Docker provider).
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
  connection_id: string | null;
  connection_name: string | null;
  connection_provider: string | null;
  layout: string | null;
  boundary_ref: string | null;
  config: Record<string, unknown> | null;
}

export interface ResolvedTarget {
  provider: CloudProvider;
  target: DeployTarget;
}

export async function resolveTarget(
  sql: SqlExecutor,
  providers: ProviderSourceOrRegistry,
  applicationId: string,
  environmentId: string,
): Promise<ResolvedTarget> {
  const [row] = await sql<TargetRow[]>`
    with app as (select id, key, runtime, domain_id from pipeline_applications where id = ${applicationId}),
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
      account.name as account_name, connection.id as connection_id,
      connection.name as connection_name, connection.provider as connection_provider,
      connection.layout, connection.boundary_ref, connection.config
    from app cross join env
    left join account on true
    left join connection on true`;
  if (!row) throw new ProviderError('The application or environment no longer exists');
  const registry = typeof providers === 'function' ? await providers() : providers;
  const provider = registry.get(row.provider as Provider);
  if (!row.connection_id) {
    throw new ProviderError(
      `${row.environment_key} deploys to ${provider.name}, and no ${provider.name} connection exists. Connect one in Platform › Clouds.`,
      { provider: row.provider },
    );
  }
  return {
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
        ? { externalId: row.account_external_id, name: row.account_name ?? row.account_external_id }
        : null,
      application: {
        id: row.application_id,
        key: row.application_key,
        runtime: row.runtime as Runtime,
      },
    },
  };
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
