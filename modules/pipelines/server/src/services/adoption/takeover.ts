import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type { CloudProvider, DeployTarget } from '../providers/contract.ts';

/*
 * No surprise takeover. The first deploy of an application to an environment on the default
 * runtime would replace a service of the same name that someone else deployed there. Unless
 * Pipelines adopted that service (release zero) or deployed there before, the deploy stops.
 */

export async function refuseTakeover(
  sql: SqlExecutor,
  provider: CloudProvider,
  target: DeployTarget,
): Promise<void> {
  const runtime = target.placement?.runtime ?? 'cloud-run';
  if (runtime !== 'cloud-run' || !provider.adopt || !target.account) return;
  const [known] = await sql<{ id: string }[]>`
    select id from pipeline_deployments
    where application_id = ${target.application.id} and environment_id = ${target.environment.id}
      and revision is not null
    limit 1`;
  if (known) return;
  const configured = target.connection.config['region'];
  const found = await provider.adopt.hasService(
    target.connection,
    {
      account: target.account.externalId,
      region:
        target.environment.region ?? (typeof configured === 'string' ? configured : 'us-central1'),
      accountConfig: target.account.config ?? {},
    },
    target.application.key,
  );
  if (found) {
    throw new ConflictError(
      `A Cloud Run service called ${target.application.key} already runs in ${target.environment.key}, deployed outside Pipelines: adopt it first, or rename the application`,
    );
  }
}
