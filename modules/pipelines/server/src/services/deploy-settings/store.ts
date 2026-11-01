import type { SqlExecutor } from '@bemmoly/core';
import {
  deploySettingsSchema,
  flattenDeploySettings,
  type DeploySettings,
} from '../../../../shared/deploy-settings.ts';

/*
 * The settings made in Pipelines for one application in one environment: one row in
 * pipeline_deploy_settings holding only what was set. These two functions are the whole
 * storage, for the API and for anything that copies settings between environments.
 */

/** What Pipelines holds for it; an empty object when nothing was set. */
export async function readDeploySettings(
  sql: SqlExecutor,
  applicationId: string,
  environmentId: string,
): Promise<DeploySettings> {
  const [row] = await sql<{ settings: unknown }[]>`
    select settings from pipeline_deploy_settings
    where application_id = ${applicationId} and environment_id = ${environmentId}`;
  const parsed = deploySettingsSchema.safeParse(row?.settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Replaces what Pipelines holds; settings that set nothing remove the row. */
export async function writeDeploySettings(
  sql: SqlExecutor,
  input: {
    applicationId: string;
    environmentId: string;
    settings: DeploySettings;
    by: string | null;
  },
): Promise<void> {
  if (Object.keys(flattenDeploySettings(input.settings)).length === 0) {
    await sql`delete from pipeline_deploy_settings
      where application_id = ${input.applicationId} and environment_id = ${input.environmentId}`;
    return;
  }
  await sql`
    insert into pipeline_deploy_settings (application_id, environment_id, settings, updated_by)
    values (${input.applicationId}, ${input.environmentId},
      ${JSON.stringify(input.settings)}::jsonb, ${input.by})
    on conflict (application_id, environment_id) do update set
      settings = excluded.settings, updated_by = excluded.updated_by, updated_at = now()`;
}
