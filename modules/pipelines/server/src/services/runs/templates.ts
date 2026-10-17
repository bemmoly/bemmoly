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
    const parsed = pipelineTemplateSchema.safeParse(asWritten(row.spec));
    return parsed.success ? parsed.data : null;
  };
}

/**
 * The application's stored definition, or null when it has none or it no longer parses. A
 * definition stored after parsing has `extends` as { ref, version }; it reads back the same.
 */
export function definitionOf(raw: unknown): PipelineDefinition | null {
  if (raw === null || raw === undefined) return null;
  const parsed = pipelineDefinitionSchema.safeParse(asWritten(raw));
  return parsed.success ? parsed.data : null;
}

type Shape = { extends?: unknown; inputs?: unknown };

const isObject = (value: unknown): value is Shape & Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A definition or template in the shape it is stored in: `extends` as "ref@version", and
 * `inputs` as a list of { name, ...input }. Postgres jsonb sorts an object's keys, and the
 * run form draws inputs in the order they were declared, so the order is kept as a list.
 */
export function storable(definition: unknown): unknown {
  if (!isObject(definition)) return definition;
  const ref = definition.extends as { ref?: unknown; version?: unknown } | undefined;
  const inputs = definition.inputs;
  return {
    ...definition,
    ...(ref && typeof ref === 'object' && typeof ref.ref === 'string'
      ? { extends: `${ref.ref}@${String(ref.version)}` }
      : {}),
    ...(isObject(inputs)
      ? {
          inputs: Object.entries(inputs).map(([name, input]) =>
            isObject(input) ? { name, ...input } : { name },
          ),
        }
      : {}),
  };
}

/**
 * A stored definition or template back in the shape it is written in, inputs as a mapping
 * in declared order. Rows stored before inputs were kept as a list read as they always did.
 */
export function asWritten(stored: unknown): unknown {
  const value = storable(stored);
  if (!isObject(value) || !Array.isArray(value.inputs)) return value;
  const entries = value.inputs.flatMap((entry: unknown) => {
    if (!isObject(entry) || typeof entry.name !== 'string') return [];
    const { name, ...input } = entry;
    return [[name, input] as const];
  });
  return { ...value, inputs: Object.fromEntries(entries) };
}
