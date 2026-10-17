import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { TemplateInput } from '../../../../shared/pipeline-spec.ts';
import type { ApplicationPipeline, RunInputField } from '../../../../shared/tests.ts';
import { isoOrNull } from '../../utils/time.ts';
import { asWritten, definitionOf, templateLookup } from './templates.ts';

/*
 * GET /applications/:key/pipeline: what "Run pipeline…" draws (one field per input, the
 * template's first, then the application's own) and the application's schedules with when
 * each next starts a run.
 */

function field(name: string, input: TemplateInput, fromTemplate: boolean): RunInputField {
  return {
    name,
    type: input.type,
    default: input.default ?? null,
    description: input.description ?? null,
    required: input.required,
    options: input.options ?? null,
    fromTemplate,
  };
}

export async function applicationPipeline(
  sql: SqlExecutor,
  key: string,
): Promise<ApplicationPipeline> {
  const [app] = await sql<
    {
      id: string;
      key: string;
      name: string;
      tier: number;
      pipeline: unknown;
      pipeline_source: 'repository' | 'catalog' | null;
      default_branch: string | null;
    }[]
  >`
    select a.id, a.key, a.name, a.tier, a.pipeline, a.pipeline_source, p.default_branch
    from pipeline_applications a left join pipeline_repositories p on p.id = a.repository_id
    where a.key = ${key} and a.archived_at is null`;
  if (!app) throw new NotFoundError(`There is no application called ${key}`);
  const definition = definitionOf(app.pipeline);
  const inputs: RunInputField[] = [];
  let template: ApplicationPipeline['template'] = null;
  if (definition && 'extends' in definition) {
    template = definition.extends;
    const spec = await templateLookup(sql)(definition.extends);
    for (const [name, input] of Object.entries(spec?.inputs ?? {})) {
      if (definition.inputs[name]) continue;
      const passed = definition.with[name];
      inputs.push(field(name, passed === undefined ? input : { ...input, default: passed }, true));
    }
  }
  for (const [name, input] of Object.entries(definition?.inputs ?? {})) {
    inputs.push(field(name, input, false));
  }
  const schedules = await sql<
    {
      cron: string;
      time_zone: string;
      ref: string | null;
      inputs: Record<string, string | number | boolean>;
      next_run_at: Date | string | null;
    }[]
  >`
    select cron, time_zone, ref, inputs, next_run_at from pipeline_schedules
    where application_id = ${app.id} order by position`;
  return {
    application: { id: app.id, key: app.key, name: app.name, tier: app.tier as 0 | 1 | 2 },
    source: definition ? (app.pipeline_source ?? 'catalog') : 'none',
    template,
    defaultRef: app.default_branch ?? 'main',
    inputs,
    schedules: schedules.map((row) => ({
      cron: row.cron,
      timeZone: row.time_zone,
      ...(row.ref ? { ref: row.ref } : {}),
      inputs: row.inputs,
      nextRunAt: isoOrNull(row.next_run_at),
    })),
    definition: app.pipeline ? asWritten(app.pipeline) : null,
  };
}
