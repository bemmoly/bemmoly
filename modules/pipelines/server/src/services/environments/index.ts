import type { RequestContext } from '@bemmoly/core';
import type { EnvironmentClass, Provider, Tier } from '../../../../shared/common.ts';
import {
  environmentProtectionSchema,
  type Environment,
  type EnvironmentPath,
  type EnvironmentPathsResponse,
  type EnvironmentsResponse,
} from '../../../../shared/environments.ts';
import type { EnvironmentRow, PathStepRow } from '../../models/environments.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';

const toEnvironment = (row: EnvironmentRow): Environment => ({
  id: row.id,
  key: row.key,
  name: row.name,
  class: row.class as EnvironmentClass,
  provider: row.provider as Provider,
  region: row.region,
  position: row.position,
  cloudAccount:
    row.account_id && row.account_external_id && row.account_name
      ? { id: row.account_id, externalId: row.account_external_id, name: row.account_name }
      : null,
  // Stored jsonb may predate a field; parsing fills its default rather than sending undefined.
  protection: environmentProtectionSchema.parse(row.protection),
});

/** Environments left to right, and the path each tier takes through them. */
export function createEnvironmentsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext): Promise<EnvironmentsResponse> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const rows = await sql<EnvironmentRow[]>`
        select e.id, e.key, e.name, e.class, e.provider, e.region, e.position, e.protection,
          c.id as account_id, c.external_id as account_external_id, c.name as account_name
        from pipeline_environments e
        left join cloud_accounts c on c.id = e.cloud_account_id
        where e.archived_at is null
        order by e.position, e.id`;
      return { items: rows.map(toEnvironment) };
    },

    async paths(ctx: RequestContext): Promise<EnvironmentPathsResponse> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const rows = await sql<PathStepRow[]>`
        select p.id as path_id, p.tier, p.name as path_name, e.id as environment_id,
          e.key as environment_key, e.name as environment_name, e.class as environment_class,
          s.stage, s.bake_minutes, s.auto_promote
        from pipeline_environment_paths p
        join pipeline_environment_path_steps s on s.path_id = p.id
        join pipeline_environments e on e.id = s.environment_id
        order by p.tier, s.stage, e.position`;
      const paths = new Map<string, EnvironmentPath>();
      for (const row of rows) {
        let path = paths.get(row.path_id);
        if (!path) {
          path = { id: row.path_id, tier: row.tier as Tier, name: row.path_name, steps: [] };
          paths.set(row.path_id, path);
        }
        path.steps.push({
          environment: {
            id: row.environment_id,
            key: row.environment_key,
            name: row.environment_name,
            class: row.environment_class as EnvironmentClass,
          },
          stage: row.stage,
          bakeMinutes: row.bake_minutes,
          autoPromote: row.auto_promote,
        });
      }
      return { items: [...paths.values()] };
    },
  };
}

export type EnvironmentsService = ReturnType<typeof createEnvironmentsService>;
