import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { richTextSchema } from '../../../../shared/common.ts';
import type { FieldKind, FieldOption } from '../../../../shared/index.ts';

/*
 * Custom field values are checked against the project's field definitions
 * before they land in issues.custom_fields, by kind, so the board, LQL and
 * the AI fill read values of the shape the definition promises.
 */

interface FieldRow {
  key: string;
  kind: FieldKind;
  options: FieldOption[];
  project_id: string | null;
}

const optionValues = (field: FieldRow) => field.options.map((option) => option.value);

const schemaFor = (field: FieldRow): z.ZodType => {
  switch (field.kind) {
    case 'text':
      return z.string().max(10_000);
    case 'richtext':
      return richTextSchema;
    case 'number':
      return z.number().finite();
    case 'select':
      return z.enum(optionValues(field) as [string, ...string[]]);
    case 'multiselect':
      return z.array(z.enum(optionValues(field) as [string, ...string[]])).max(100);
    case 'user':
    case 'doc':
      return z.uuid();
    case 'date':
      return z.iso.date();
    case 'datetime':
      return z.iso.datetime({ offset: true });
    case 'url':
      return z.url({ protocol: /^https?$/ });
  }
};

/**
 * A project's definitions: its own copies win over the org defaults with the
 * same key, which is what a scheme override means.
 */
export async function loadFieldDefinitions(
  sql: SqlExecutor,
  projectId: string,
): Promise<Map<string, FieldRow>> {
  const rows = await sql<FieldRow[]>`
    select key, kind, options, project_id from fields
    where project_id = ${projectId} or project_id is null
    order by project_id nulls first`;
  return new Map(rows.map((row) => [row.key, row]));
}

/** Throws a ValidationError naming every value that does not fit its field. */
export function validateCustomFields(
  definitions: Map<string, FieldRow>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const issues: { path: string; message: string }[] = [];
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const field = definitions.get(key);
    if (!field) {
      issues.push({ path: key, message: 'No such field in this project' });
      continue;
    }
    if (value === null) {
      clean[key] = null;
      continue;
    }
    const result = schemaFor(field).safeParse(value);
    if (result.success) clean[key] = result.data;
    else issues.push({ path: key, message: `Expected a ${field.kind} value` });
  }
  if (issues.length > 0) {
    throw new ValidationError('Some custom fields are not valid', { details: { issues } });
  }
  return clean;
}

/** The fields the type's create-form layout marks required, for a create. */
export async function requiredFieldKeys(sql: SqlExecutor, typeId: string): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`
    select f.key from issue_type_fields itf join fields f on f.id = itf.field_id
    where itf.issue_type_id = ${typeId} and itf.required`;
  return rows.map((row) => row.key);
}
