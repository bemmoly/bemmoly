import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { DeployRuntime, EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type {
  ApplicationRuntime,
  ApplicationRuntimesResponse,
  SetApplicationRuntimeBody,
} from '../../../../shared/runtimes.ts';
import { deployRuntimeSchema } from '../../../../shared/common.ts';
import type { RuntimeRow } from '../../models/clusters.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ProviderSource } from '../providers/index.ts';
import { runtimeProblem } from './fit.ts';

/*
 * The runtime an application runs on in each environment (shared/runtimes.ts): the choice
 * made in Pipelines wins, then the application file's, then the environment's default. A
 * switch is a row here and takes effect on the next deploy. Anyone who manages the
 * application in that environment may switch it; policies on Prod still apply.
 */

export interface RuntimesServiceDeps extends PipelinesServiceDeps {
  providers: ProviderSource;
}

const runtimeOr = (value: string | null): DeployRuntime | null => {
  const parsed = deployRuntimeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

async function requireApplication(sql: SqlExecutor, key: string) {
  const [row] = await sql<{ id: string; key: string }[]>`
    select id, key from pipeline_applications where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError(`No application is called ${key}`);
  return row;
}

async function selectRuntimes(sql: SqlExecutor, applicationId: string, environmentKey?: string) {
  return sql<RuntimeRow[]>`
    select e.id as environment_id, e.key as environment_key, e.name as environment_name,
      e.class as environment_class, e.provider, e.default_runtime, r.runtime as chosen,
      a.file_runtimes ->> e.key as file, k.id as cluster_id, k.name as cluster_name,
      k.mode as cluster_mode, k.origin as cluster_origin, k.status as cluster_status
    from pipeline_applications a
    cross join pipeline_environments e
    left join pipeline_application_runtimes r
      on r.application_id = a.id and r.environment_id = e.id
    left join cloud_clusters k on k.environment_id = e.id
    where a.id = ${applicationId} and e.archived_at is null
      and (${environmentKey ?? null}::text is null or e.key = ${environmentKey ?? null})
    order by e.position, e.id`;
}

export function createRuntimesService(deps: RuntimesServiceDeps) {
  const sql = () => requireDatabase(deps);

  async function present(key: string, rows: RuntimeRow[]): Promise<ApplicationRuntime[]> {
    const registry = await deps.providers();
    return rows.map((row) => {
      const chosen = runtimeOr(row.chosen);
      const file = runtimeOr(row.file);
      const environmentDefault = runtimeOr(row.default_runtime) ?? 'cloud-run';
      const runtime = chosen ?? file ?? environmentDefault;
      const cluster =
        row.cluster_id && row.cluster_name
          ? {
              id: row.cluster_id,
              name: row.cluster_name,
              mode:
                row.cluster_mode === 'standard' ? ('standard' as const) : ('autopilot' as const),
              origin:
                row.cluster_origin === 'attached' ? ('attached' as const) : ('created' as const),
              status: (row.cluster_status ?? 'creating') as 'creating' | 'ready' | 'failed',
            }
          : null;
      const provider = registry.list().find((entry) => entry.id === (row.provider as Provider));
      return {
        environment: {
          id: row.environment_id,
          key: row.environment_key,
          name: row.environment_name,
          class: row.environment_class as EnvironmentClass,
        },
        runtime,
        source: chosen ? 'pipelines' : file ? 'file' : 'environment',
        chosen,
        file,
        environmentDefault,
        cluster,
        problem: runtimeProblem({
          runtime,
          application: key,
          environment: row.environment_key,
          cluster,
          supported: runtime === 'cloud-run' || Boolean(provider?.runtimes?.[runtime]),
        }),
      };
    });
  }

  return {
    async list(ctx: RequestContext, key: string): Promise<ApplicationRuntimesResponse> {
      await authorizePipelines(ctx);
      const application = await requireApplication(sql(), key);
      return { items: await present(key, await selectRuntimes(sql(), application.id)) };
    },

    async set(
      ctx: RequestContext,
      key: string,
      environmentKey: string,
      body: SetApplicationRuntimeBody,
    ): Promise<ApplicationRuntime> {
      const db = sql();
      const application = await requireApplication(db, key);
      const [environment] = await selectRuntimes(db, application.id, environmentKey);
      if (!environment) throw new NotFoundError(`No environment is called ${environmentKey}`);
      await requireAccess(deps).authorizeAction(
        ctx,
        'manage',
        { application: application.id, environment: environment.environment_id },
        { record: true },
      );
      if (body.runtime === null) {
        await db`delete from pipeline_application_runtimes
          where application_id = ${application.id} and environment_id = ${environment.environment_id}`;
      } else {
        await db`
          insert into pipeline_application_runtimes (application_id, environment_id, runtime, set_by)
          values (${application.id}, ${environment.environment_id}, ${body.runtime},
            ${personOf(ctx.actor)})
          on conflict (application_id, environment_id) do update set
            runtime = excluded.runtime, set_by = excluded.set_by, updated_at = now()`;
      }
      const [item] = await present(key, await selectRuntimes(db, application.id, environmentKey));
      if (!item) throw new NotFoundError(`No environment is called ${environmentKey}`);
      return item;
    },
  };
}

export type RuntimesService = ReturnType<typeof createRuntimesService>;
