import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  deployRuntimeSchema,
  type DeployRuntime,
  type EnvironmentClass,
} from '../../../../shared/common.ts';
import type { DeploySettings } from '../../../../shared/deploy-settings.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import { readDeploySettings } from '../deploy-settings/store.ts';

/*
 * What a copy between two environments starts from: both environments, and per application
 * its runtime on each side, the newest release's file (what the target's next deploy reads),
 * each side's own variables and the settings made in Pipelines on each side.
 */

export interface CopyEnvironment extends EnvironmentRef {
  protected: boolean;
}

export interface CopyVariableRow {
  name: string;
  kind: 'plain' | 'secret';
  value: string | null;
  secret_ref: string | null;
  secret_account_id: string | null;
  version: number;
  account: string | null;
}

export interface CopySide {
  runtime: DeployRuntime;
  variables: CopyVariableRow[];
  settings: DeploySettings;
}

export interface CopyApplicationState {
  id: string;
  key: string;
  name: string;
  resolvedConfig: Record<string, unknown>;
  from: CopySide;
  to: CopySide;
}

export async function loadCopyEnvironment(sql: SqlExecutor, key: string): Promise<CopyEnvironment> {
  const [row] = await sql<
    { id: string; key: string; name: string; class: string; protected: boolean }[]
  >`
    select id, key, name, class,
      coalesce((protection ->> 'protected')::boolean, class = 'prod') as protected
    from pipeline_environments where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError(`No environment is called ${key}`);
  return { ...row, class: row.class as EnvironmentClass };
}

async function sideOf(
  sql: SqlExecutor,
  applicationId: string,
  environmentId: string,
): Promise<CopySide> {
  const [runtime] = await sql<{ runtime: string }[]>`
    select coalesce(r.runtime, a.file_runtimes ->> e.key, e.default_runtime) as runtime
    from pipeline_applications a cross join pipeline_environments e
    left join pipeline_application_runtimes r
      on r.application_id = a.id and r.environment_id = e.id
    where a.id = ${applicationId} and e.id = ${environmentId}`;
  const variables = await sql<CopyVariableRow[]>`
    select v.name, v.kind, v.value, v.secret_ref, v.secret_account_id, v.version,
      a.external_id as account
    from pipeline_variables v left join cloud_accounts a on a.id = v.secret_account_id
    where v.application_id = ${applicationId} and v.environment_id = ${environmentId}
    order by v.name`;
  return {
    runtime: deployRuntimeSchema.catch('cloud-run').parse(runtime?.runtime),
    variables: [...variables],
    settings: await readDeploySettings(sql, applicationId, environmentId),
  };
}

export async function loadCopyApplications(
  sql: SqlExecutor,
  from: CopyEnvironment,
  to: CopyEnvironment,
  keys: readonly string[] | undefined,
): Promise<CopyApplicationState[]> {
  // Without a list, only applications with something set in the source can differ.
  const rows = await sql<
    { id: string; key: string; name: string; resolved_config: Record<string, unknown> | null }[]
  >`
    select a.id, a.key, a.name, rel.resolved_config
    from pipeline_applications a
    left join lateral (
      select resolved_config from pipeline_releases
      where application_id = a.id and source <> 'adopted'
      order by created_at desc, id desc limit 1) rel on true
    where a.archived_at is null
      and (${keys ?? null}::text[] is null or a.key = any(${keys ?? null}::text[]))
      and (${keys ?? null}::text[] is not null
        or exists (select 1 from pipeline_variables v
          where v.application_id = a.id and v.environment_id = ${from.id})
        or exists (select 1 from pipeline_deploy_settings s
          where s.application_id = a.id and s.environment_id = ${from.id}))
    order by a.key`;
  const missing = keys?.find((key) => !rows.some((row) => row.key === key));
  if (missing) throw new NotFoundError(`No application is called ${missing}`);
  if (from.id === to.id)
    throw new ValidationError('Choose two different environments to copy between');
  const applications: CopyApplicationState[] = [];
  for (const row of rows) {
    applications.push({
      id: row.id,
      key: row.key,
      name: row.name,
      resolvedConfig: row.resolved_config ?? {},
      from: await sideOf(sql, row.id, from.id),
      to: await sideOf(sql, row.id, to.id),
    });
  }
  return applications;
}
