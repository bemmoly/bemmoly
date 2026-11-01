import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { autopilotPoolBodySchema, type AutopilotPoolBody } from '../../../../shared/autopilot.ts';
import type { PoolHosting } from '../../../../shared/capacity.ts';
import { cloudBuildPoolBodySchema, type CloudBuildPoolBody } from '../../../../shared/machines.ts';

/*
 * How a pool whose machines Pipelines starts keeps its settings: a Cloud Build pool its
 * project, region, image and service account; a GKE Autopilot pool its project, cluster,
 * image, size and service account, and the namespace its pods run in, named after the pool.
 * The project must be one Pipelines has, and only a managed connection may create a cluster.
 */

export interface MachineSettings {
  accountId: string;
  config: Record<string, unknown>;
}

/** "runners-<pool>", cut to the 63 characters a namespace may have. */
export const runnerNamespaceOf = (key: string) => `runners-${key}`.slice(0, 63).replace(/-+$/, '');

async function accountOf(sql: SqlExecutor, id: string) {
  const [account] = await sql<{ id: string; mode: string | null; connection: string }[]>`
    select a.id, c.config ->> 'mode' as mode, c.name as connection
    from cloud_accounts a join cloud_connections c on c.id = a.connection_id
    where a.id = ${id}`;
  if (!account) {
    throw new ValidationError(
      'That project is not attached to Pipelines; attach it in Clouds first',
    );
  }
  return account;
}

export async function cloudBuildSettings(
  sql: SqlExecutor,
  input: CloudBuildPoolBody,
): Promise<MachineSettings> {
  const body = cloudBuildPoolBodySchema.parse(input);
  await accountOf(sql, body.account);
  const { account: accountId, ...settings } = body;
  return { accountId, config: { cloudBuild: settings } };
}

export async function autopilotSettings(
  sql: SqlExecutor,
  key: string,
  input: AutopilotPoolBody,
): Promise<MachineSettings> {
  const body = autopilotPoolBodySchema.parse(input);
  const account = await accountOf(sql, body.account);
  if (body.cluster.create && account.mode === 'attached') {
    throw new ValidationError(
      `${account.connection} uses projects you already have, so Pipelines does not create clusters there. Name an Autopilot cluster that exists`,
    );
  }
  const { account: accountId, ...settings } = body;
  return {
    accountId,
    // A pool prepared before is prepared again for its new settings.
    config: { autopilot: { ...settings, namespace: runnerNamespaceOf(key) }, pods: null },
  };
}

/** The settings a create or update brings, after checking they fit the hosting. */
export async function machineSettings(
  sql: SqlExecutor,
  key: string,
  hosting: PoolHosting,
  body: { cloudBuild?: CloudBuildPoolBody; autopilot?: AutopilotPoolBody },
  had: { cloudBuild: boolean; autopilot: boolean } = { cloudBuild: false, autopilot: false },
): Promise<MachineSettings | null> {
  if (body.cloudBuild && hosting !== 'cloud-build') {
    throw new ValidationError(
      `${key} does not run on Cloud Build, so Cloud Build settings do not apply`,
    );
  }
  if (body.autopilot && hosting !== 'gke-autopilot') {
    throw new ValidationError(
      `${key} does not run on GKE Autopilot, so GKE Autopilot settings do not apply`,
    );
  }
  if (hosting === 'cloud-build' && !body.cloudBuild && !had.cloudBuild) {
    throw new ValidationError(
      'A Cloud Build pool needs its project, region, image and service account',
    );
  }
  if (hosting === 'gke-autopilot' && !body.autopilot && !had.autopilot) {
    throw new ValidationError(
      'A GKE Autopilot pool needs its project, cluster, image, size and service account',
    );
  }
  if (body.cloudBuild) return cloudBuildSettings(sql, body.cloudBuild);
  if (body.autopilot) return autopilotSettings(sql, key, body.autopilot);
  return null;
}
