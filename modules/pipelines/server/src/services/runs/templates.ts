import type { SqlExecutor } from '@bemmoly/core';
import {
  pipelineDefinitionSchema,
  pipelineTemplateSchema,
  type PipelineDefinition,
} from '../../../../shared/pipeline-spec.ts';
import type { TemplateLookup } from '../orchestrator/resolve.ts';

/** Templates from the synced cache (pipeline_templates); a damaged row reads as missing. */
export function templateLookup(sql: SqlExecutor): TemplateLookup {
  return async ({ ref, version }) => {
    const [row] = await sql<{ spec: unknown }[]>`
      select spec from pipeline_templates where ref = ${ref} and version = ${version}`;
    if (!row) return null;
    const parsed = pipelineTemplateSchema.safeParse(row.spec);
    return parsed.success ? parsed.data : null;
  };
}

/** The application's stored definition, or null when it has none or it no longer parses. */
export function definitionOf(raw: unknown): PipelineDefinition | null {
  if (raw === null || raw === undefined) return null;
  const parsed = pipelineDefinitionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
