import type { SqlClient } from '@bemmoly/core';
import { isBemmolyError } from '@bemmoly/shared';
import { z } from 'zod';
import { deployRuntimeSchema } from '../../../../shared/common.ts';
import type { ExportService } from '../providers/export-contract.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { loadRelease } from '../shipping/load.ts';
import { artifactOf, resolveTarget } from '../shipping/targets.ts';
import { resolutionFor } from '../deploy-settings/deploy.ts';

/*
 * What serves each application in each environment now: the release Pipelines counts as
 * current there, the revision its last deploy of that release made, and the variables that
 * deploy ran with. Where it runs comes from the same resolution every deploy uses, pinned to
 * the runtime that deploy ran on, so the export names the cloud the service is really in.
 */

const variablesSchema = z.array(
  z.discriminatedUnion('kind', [
    z.object({ name: z.string(), kind: z.literal('plain'), value: z.string() }),
    z.object({
      name: z.string(),
      kind: z.literal('secret'),
      account: z.string(),
      secret: z.string(),
      version: z.string(),
    }),
  ]),
);

const planSchema = z.object({ runtime: deployRuntimeSchema.optional() }).catch({});

interface CurrentRow {
  application_id: string;
  environment_id: string;
  application: string;
  environment: string;
  region: string | null;
  release_id: string;
  state: string;
  latest_release_id: string | null;
  revision: string | null;
  variables: unknown;
  plan: unknown;
}

export interface CurrentServices {
  /** By the id of the connection each one deploys through. */
  byConnection: Map<string, ExportService[]>;
  leftOut: string[];
}

export async function currentServices(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  application: string | undefined,
): Promise<CurrentServices> {
  const rows = await sql<CurrentRow[]>`
    select c.application_id, c.environment_id, a.key as application, e.key as environment,
      e.region, c.release_id, c.state, latest.release_id as latest_release_id,
      served.revision, served.variables, served.plan
    from pipeline_current c
    join pipeline_applications a on a.id = c.application_id
    join pipeline_environments e on e.id = c.environment_id
    left join pipeline_deployments latest on latest.id = c.deployment_id
    left join lateral (
      select d.revision, d.variables, d.plan from pipeline_deployments d
      where d.application_id = c.application_id and d.environment_id = c.environment_id
        and d.release_id = c.release_id and d.revision is not null
      order by (d.state = 'succeeded') desc, d.created_at desc
      limit 1
    ) served on true
    where c.release_id is not null and a.archived_at is null and e.archived_at is null
      and (${application ?? null}::text is null or a.key = ${application ?? null})
    order by a.key, e.position, e.key`;
  const byConnection = new Map<string, ExportService[]>();
  const leftOut: string[] = [];
  for (const row of rows) {
    const where = `${row.application} in ${row.environment}`;
    if (!row.revision) {
      leftOut.push(`${where}: Pipelines has no record of the revision serving it.`);
      continue;
    }
    const variables = variablesSchema.safeParse(row.variables ?? []);
    if (!variables.success) {
      leftOut.push(`${where}: the variables its last deploy ran with could not be read.`);
      continue;
    }
    const plan = planSchema.parse(row.plan ?? {});
    try {
      const { target } = await resolveTarget(
        sql,
        providers,
        row.application_id,
        row.environment_id,
        { runtime: plan.runtime, frontDoor: false },
      );
      if (!target.account || !target.placement) {
        leftOut.push(`${where}: it deploys to no project, so there is nothing to export.`);
        continue;
      }
      const artifact = artifactOf(await loadRelease(sql, row.release_id));
      // The settings as they stand now, which the next deploy there would also take.
      const { settings } = await resolutionFor(sql, target, artifact);
      const release = { ...artifact, settings };
      const service: ExportService = {
        application: row.application,
        environment: { key: row.environment, class: target.environment.class, region: row.region },
        account: { externalId: target.account.externalId, config: target.account.config ?? {} },
        placement: target.placement,
        release,
        revision: row.revision,
        variables: variables.data,
        moving: row.state !== 'idle' || row.latest_release_id !== row.release_id,
      };
      const id = target.connection.id;
      byConnection.set(id, [...(byConnection.get(id) ?? []), service]);
    } catch (error) {
      // A target that cannot resolve says why in a sentence; anything else is a real fault.
      if (!isBemmolyError(error)) throw error;
      leftOut.push(`${where}: ${(error as Error).message.replace(/\.?$/, '.')}`);
    }
  }
  return { byConnection, leftOut };
}
