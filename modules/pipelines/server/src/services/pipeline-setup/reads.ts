import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import {
  pipelineTriggerSchema,
  type PipelineSetup,
  type PipelineTrigger,
} from '../../../../shared/pipeline-setup.ts';
import type { TemplateContext, TemplateEnvironment } from './templates.ts';

/* What setting up a pipeline reads: the service, the path of environments, the build pool. */

export interface SetupApplicationRow {
  id: string;
  key: string;
  path: string;
  pipeline: unknown;
  pipeline_start: PipelineSetup['start'];
  pipeline_template: PipelineSetup['template'];
  pipeline_repository_file: string | null;
  pipeline_store: PipelineSetup['store'];
  version_scheme: PipelineSetup['versionScheme'];
  pipeline_triggers: unknown;
  source: string | null;
  file_path: string | null;
  group_key: string;
  repository_id: string | null;
  repository_full_name: string | null;
  repository_default_branch: string | null;
}

export async function setupApplication(
  sql: SqlExecutor,
  key: string,
): Promise<SetupApplicationRow> {
  const [row] = await sql<SetupApplicationRow[]>`
    select a.id, a.key, a.path, a.pipeline, a.pipeline_start, a.pipeline_template,
      a.pipeline_repository_file, a.pipeline_store, a.version_scheme, a.pipeline_triggers,
      a.source, a.file_path, g.key as group_key, a.repository_id,
      r.full_name as repository_full_name, r.default_branch as repository_default_branch
    from pipeline_applications a
    join pipeline_groups g on g.id = a.group_id
    left join pipeline_repositories r on r.id = a.repository_id
    where a.key = ${key} and a.archived_at is null`;
  if (!row) throw new NotFoundError(`There is no service called ${key}`);
  return row;
}

/** Stored triggers, keeping only the ones that still read; a damaged entry starts nothing. */
export function triggersOf(raw: unknown): PipelineTrigger[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = pipelineTriggerSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function toSetup(row: SetupApplicationRow): PipelineSetup {
  return {
    application: row.key,
    start: row.pipeline_start,
    template: row.pipeline_template,
    repositoryFile: row.pipeline_repository_file,
    store: row.pipeline_store,
    versionScheme: row.version_scheme,
    triggers: triggersOf(row.pipeline_triggers),
  };
}

/** The template context for one service: environments in path order and the build pool. */
export async function templateContext(sql: SqlExecutor, path = ''): Promise<TemplateContext> {
  const rows = await sql<
    { key: string; name: string; approval_rule: boolean; cloud_account_id: string | null }[]
  >`
    select key, name, approval_rule is not null as approval_rule, cloud_account_id
    from pipeline_environments where archived_at is null order by position, id`;
  const environments: TemplateEnvironment[] = rows.map((row) => ({
    key: row.key,
    name: row.name,
    approvalRule: row.approval_rule,
  }));
  // Jobs run by default as Cloud Build in the environment's own project: nothing to install.
  const account = rows[0]?.cloud_account_id ?? null;
  const [pool] = account
    ? await sql<{ key: string }[]>`
        select key from pipeline_runner_pools
        where hosting = 'cloud-build' and cloud_account_id = ${account}
        order by created_at, id limit 1`
    : [];
  return { environments, path, buildPool: pool?.key ?? null };
}
