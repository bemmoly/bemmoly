import type { SqlExecutor } from '@bemmoly/core';
import { stringify } from 'yaml';
import { APPLICATION_FILE_PATH } from '../../../../shared/application-yaml.ts';
import type { PipelineSpec } from '../../../../shared/pipeline-spec.ts';
import type { PipelineSetup, PipelineTrigger } from '../../../../shared/pipeline-setup.ts';
import { openRepositoryChange, type ChangePorts } from '../catalog-writes/repo-change.ts';
import { storable } from '../runs/templates.ts';
import { refreshSchedules } from '../triggers/schedules.ts';
import type { SetupApplicationRow } from './reads.ts';

/*
 * Keeping a service's pipeline: always in Pipelines' own row, so Run works at once, and, when
 * the person chose the repository, also as a pull request that writes it into the service's
 * .bemmoly/application.yaml. Once that merges, every push to the default branch keeps the row
 * in step with the file (catalog sync), so the repository is the truth from then on.
 */

/** Schedule triggers become the pipeline's schedules; the minute job reads those. */
export function withSchedules(definition: PipelineSpec, triggers: PipelineTrigger[]): PipelineSpec {
  return {
    ...definition,
    schedules: triggers.flatMap((trigger) =>
      trigger.kind === 'schedule'
        ? [{ cron: trigger.cron, timeZone: trigger.timeZone, inputs: {} }]
        : [],
    ),
  };
}

export interface StoreInput {
  setup: Omit<PipelineSetup, 'application'>;
  definition: PipelineSpec;
  createdBy: string;
}

export async function storePipeline(
  sql: SqlExecutor,
  app: SetupApplicationRow,
  input: StoreInput,
): Promise<void> {
  const { setup } = input;
  const definition = withSchedules(input.definition, setup.triggers);
  await sql`
    update pipeline_applications set
      pipeline_start = ${setup.start}, pipeline_template = ${setup.template},
      pipeline_repository_file = ${setup.repositoryFile}, pipeline_store = ${setup.store},
      version_scheme = ${setup.versionScheme},
      pipeline_triggers = ${JSON.stringify(setup.triggers)}::jsonb,
      pipeline = ${JSON.stringify(storable(definition))}::jsonb,
      pipeline_source = ${setup.store === 'repository' ? 'repository' : 'catalog'},
      updated_at = now()
    where id = ${app.id}`;
  await refreshSchedules(sql, app.id);
}

export interface PullRequestOutcome {
  url: string | null;
  reason: string | null;
}

/** Opens the pull request that writes the pipeline into the repository, or says why not. */
export async function proposeToRepository(
  sql: SqlExecutor,
  ports: ChangePorts,
  app: SetupApplicationRow,
  definition: PipelineSpec,
  createdBy: string,
): Promise<PullRequestOutcome> {
  if (!app.repository_full_name) {
    return { url: null, reason: `${app.key} has no repository yet` };
  }
  const pipeline = storable(definition);
  const inFile = app.source === 'repository' && app.file_path;
  const filePath = inFile
    ? (app.file_path as string)
    : app.path
      ? `${app.path}/${APPLICATION_FILE_PATH}`
      : APPLICATION_FILE_PATH;
  const id = await openRepositoryChange(sql, ports, {
    kind: inFile ? 'update' : 'create',
    applicationId: app.id,
    applicationKey: app.key,
    repository: {
      id: app.repository_id,
      fullName: app.repository_full_name,
      defaultBranch: app.repository_default_branch ?? 'main',
    },
    filePath,
    fields: { pipeline },
    ...(inFile
      ? {}
      : {
          content: stringify({ name: app.key, group: app.group_key, pipeline }, { lineWidth: 100 }),
        }),
    summary: `Sets the pipeline of ${app.key}`,
    createdBy,
  });
  const [row] = await sql<{ pull_request_url: string | null; reason: string | null }[]>`
    select pull_request_url, reason from pipeline_catalog_changes where id = ${id}::uuid`;
  return { url: row?.pull_request_url ?? null, reason: row?.reason ?? null };
}
