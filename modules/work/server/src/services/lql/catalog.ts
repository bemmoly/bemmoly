import type { SqlClient } from '@bemmoly/core';
import { createIssueFieldCatalog } from '@bemmoly/shared';
import type { FieldKind } from '../../../../shared/enums.ts';
import type { CompileCatalog } from './compile.ts';
import { LQL_KIND_OF, type CustomFieldDefinition } from './custom.ts';

interface FieldRow {
  key: string;
  name: string;
  kind: FieldKind;
  options: { value: string }[];
}

/**
 * The custom fields a query may name: the project's own definitions, with
 * the org defaults filling in every key the project did not override. With
 * no project (an org-wide saved filter) the defaults alone apply.
 */
export async function loadFieldDefinitions(
  sql: SqlClient,
  projectId: string | null,
): Promise<CustomFieldDefinition[]> {
  const rows = await sql<FieldRow[]>`
    select key, name, kind, options from fields
    where project_id is not distinct from ${projectId}::uuid
      or (project_id is null and key not in (
        select key from fields where project_id = ${projectId}::uuid))
    order by key`;
  return rows.map((row) => ({
    key: row.key,
    label: row.name,
    kind: LQL_KIND_OF[row.kind],
    storage: row.kind,
    ...(row.kind === 'select' || row.kind === 'multiselect'
      ? { options: row.options.map((option) => option.value) }
      : {}),
  }));
}

export function catalogOf(definitions: readonly CustomFieldDefinition[]): CompileCatalog {
  return {
    ...createIssueFieldCatalog(definitions),
    custom: new Map(definitions.map((definition) => [definition.key, definition])),
  };
}

export async function loadCatalog(
  sql: SqlClient,
  projectId: string | null,
): Promise<CompileCatalog> {
  return catalogOf(await loadFieldDefinitions(sql, projectId));
}
