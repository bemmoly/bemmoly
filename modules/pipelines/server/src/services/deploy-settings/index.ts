import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { deployRuntimeSchema, type EnvironmentClass } from '../../../../shared/common.ts';
import type {
  ApplicationDeploySettings,
  ApplicationDeploySettingsResponse,
  DeploySettings,
  EnvironmentRuntimesResponse,
} from '../../../../shared/deploy-settings.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { fileLayersOf, resolveDeploySettings } from './resolve.ts';
import { readDeploySettings, writeDeploySettings } from './store.ts';

/*
 * Deploy settings per application and environment (shared/deploy-settings.ts). Reading shows
 * every setting's value and where it came from, with the file read from the application's
 * newest release, since that is what the next deploy most likely takes. Setting replaces what
 * Pipelines holds there; it needs `manage` on the application in that environment, and a
 * protected environment keeps it for the roles that may deploy there.
 */

export { readDeploySettings, writeDeploySettings } from './store.ts';

interface SettingsRow {
  application_id: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  runtime: string;
  release_id: string | null;
  release_version: string | null;
  resolved_config: Record<string, unknown> | null;
  protected: boolean;
}

async function requireApplication(sql: SqlExecutor, key: string) {
  const [row] = await sql<{ id: string }[]>`
    select id from pipeline_applications where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError(`No application is called ${key}`);
  return row;
}

function selectRows(sql: SqlExecutor, applicationId: string, environmentKey?: string) {
  return sql<SettingsRow[]>`
    select a.id as application_id, e.id as environment_id, e.key as environment_key,
      e.name as environment_name, e.class as environment_class,
      coalesce(r.runtime, a.file_runtimes ->> e.key, e.default_runtime) as runtime,
      rel.id as release_id, rel.version as release_version, rel.resolved_config,
      coalesce((e.protection ->> 'protected')::boolean, e.class = 'prod') as protected
    from pipeline_applications a
    cross join pipeline_environments e
    left join pipeline_application_runtimes r
      on r.application_id = a.id and r.environment_id = e.id
    left join lateral (
      select id, version, resolved_config from pipeline_releases
      where application_id = a.id order by created_at desc, id desc limit 1) rel on true
    where a.id = ${applicationId} and e.archived_at is null
      and (${environmentKey ?? null}::text is null or e.key = ${environmentKey ?? null})
    order by e.position, e.id`;
}

function present(row: SettingsRow, settings: DeploySettings): ApplicationDeploySettings {
  const runtime = deployRuntimeSchema.catch('cloud-run').parse(row.runtime);
  const environmentClass = row.environment_class as EnvironmentClass;
  const { file, fileEnvironment, extras } = fileLayersOf(
    row.resolved_config ?? {},
    row.environment_key,
  );
  const resolution = resolveDeploySettings({
    layers: { pipelines: settings, file, fileEnvironment },
    runtime,
    environmentClass,
    environmentKey: row.environment_key,
    extras,
  });
  return {
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: environmentClass,
    },
    runtime,
    settings,
    effective: resolution.entries,
    disruptionBudget: resolution.disruptionBudget,
    release:
      row.release_id && row.release_version
        ? { id: row.release_id, version: row.release_version }
        : null,
    problem: resolution.problem,
  };
}

export function createDeploySettingsService(deps: PipelinesServiceDeps) {
  const sql = () => requireDatabase(deps);

  async function one(applicationId: string, environmentKey: string) {
    const [row] = await selectRows(sql(), applicationId, environmentKey);
    if (!row) throw new NotFoundError(`No environment is called ${environmentKey}`);
    return row;
  }

  /**
   * Who may change settings here: `manage` on the application in that environment, and in a
   * protected environment also `deploy`, since the settings reach it only with a deploy that
   * just those roles may make there.
   */
  async function authorize(ctx: RequestContext, row: SettingsRow) {
    const target = { application: row.application_id, environment: row.environment_id };
    const access = requireAccess(deps);
    await access.authorizeAction(ctx, 'manage', target, { record: true });
    if (row.protected) await access.authorizeAction(ctx, 'deploy', target, { record: true });
  }

  return {
    async list(ctx: RequestContext, key: string): Promise<ApplicationDeploySettingsResponse> {
      await authorizePipelines(ctx);
      const application = await requireApplication(sql(), key);
      await requireAccess(deps).authorizeAction(ctx, 'view', { application: application.id });
      const rows = await selectRows(sql(), application.id);
      const items = [];
      for (const row of rows) {
        items.push(
          present(row, await readDeploySettings(sql(), row.application_id, row.environment_id)),
        );
      }
      return { items };
    },

    async set(
      ctx: RequestContext,
      key: string,
      environmentKey: string,
      body: DeploySettings,
    ): Promise<ApplicationDeploySettings> {
      await authorizePipelines(ctx);
      const application = await requireApplication(sql(), key);
      const row = await one(application.id, environmentKey);
      await authorize(ctx, row);
      const item = present(row, body);
      if (item.problem) throw new ValidationError(item.problem);
      await writeDeploySettings(sql(), {
        applicationId: row.application_id,
        environmentId: row.environment_id,
        settings: body,
        by: personOf(ctx.actor),
      });
      return present(row, await readDeploySettings(sql(), row.application_id, row.environment_id));
    },

    async clear(ctx: RequestContext, key: string, environmentKey: string): Promise<void> {
      await authorizePipelines(ctx);
      const application = await requireApplication(sql(), key);
      const row = await one(application.id, environmentKey);
      await authorize(ctx, row);
      await writeDeploySettings(sql(), {
        applicationId: row.application_id,
        environmentId: row.environment_id,
        settings: {},
        by: personOf(ctx.actor),
      });
    },

    /** Every application's runtime in one environment, and whether it follows the default. */
    async environmentRuntimes(
      ctx: RequestContext,
      environmentKey: string,
    ): Promise<EnvironmentRuntimesResponse> {
      await authorizePipelines(ctx);
      const rows = await sql()<
        {
          key: string;
          name: string;
          chosen: string | null;
          file: string | null;
          fallback: string;
        }[]
      >`
        select a.key, a.name, r.runtime as chosen, a.file_runtimes ->> e.key as file,
          e.default_runtime as fallback
        from pipeline_environments e
        cross join pipeline_applications a
        left join pipeline_application_runtimes r
          on r.application_id = a.id and r.environment_id = e.id
        where e.key = ${environmentKey} and e.archived_at is null and a.archived_at is null
        order by a.key`;
      return {
        items: rows.map((row) => ({
          application: { key: row.key, name: row.name },
          runtime: deployRuntimeSchema
            .catch('cloud-run')
            .parse(row.chosen ?? row.file ?? row.fallback),
          source: row.chosen ? 'pipelines' : row.file ? 'file' : 'environment',
        })),
      };
    },
  };
}

export type DeploySettingsService = ReturnType<typeof createDeploySettingsService>;
