import type { Field, IssueTypeField } from '@bemmoly/module-work/shared';
import { useMemo } from 'react';
import { useFields, useTypeLayout } from './projects-catalog.ts';

/**
 * Field keys the issue holds in its own columns. A type's layout may list them to place and
 * require them on the create form; they are never custom field values.
 */
export const BUILT_IN_FIELDS: Readonly<Record<string, string>> = {
  summary: 'title',
  title: 'title',
  description: 'description',
  assignee: 'assigneeId',
  priority: 'priority',
  labels: 'labelIds',
  epic: 'parentId',
  parent: 'parentId',
  sprint: 'sprintId',
  fix_version: 'fixVersionId',
  story_points: 'estimate',
  estimate: 'estimate',
  due_date: 'dueAt',
  component: 'componentId',
};

/** Kinds that read as a document in the main column rather than a value in the sidebar. */
const DOCUMENT_KINDS = new Set(['richtext']);
/** Kinds this release cannot edit yet: links to Docs pages arrive with the Docs module. */
const HIDDEN_KINDS = new Set(['doc']);

export interface LayoutField {
  field: Field;
  required: boolean;
  /** The issue column a built-in field writes, or null for a custom field. */
  column: string | null;
}

/** A type's create form, in layout order, joined with the field definitions. */
export function useLayoutFields(projectKey: string | undefined, typeId: string | undefined) {
  const layout = useTypeLayout(projectKey, typeId);
  const fields = useFields(projectKey);
  const rows = useMemo(() => {
    const byId = new Map((fields.data ?? []).map((field) => [field.id, field]));
    return [...(layout.data ?? [])]
      .sort((a: IssueTypeField, b: IssueTypeField) => a.position - b.position)
      .flatMap((row): LayoutField[] => {
        const field = byId.get(row.fieldId);
        if (!field || HIDDEN_KINDS.has(field.kind)) return [];
        return [{ field, required: row.required, column: BUILT_IN_FIELDS[field.key] ?? null }];
      });
  }, [layout.data, fields.data]);
  return {
    rows,
    fields: fields.data ?? [],
    isPending: layout.isPending || fields.isPending,
    error: layout.error ?? fields.error,
  };
}

/**
 * The custom fields an issue shows: its type's layout first, then any value it holds for a
 * field the layout no longer lists. Rich text goes to the main column, the rest to Details.
 */
export function useCustomFields(
  projectKey: string,
  typeId: string,
  values: Readonly<Record<string, unknown>>,
) {
  const { rows, fields } = useLayoutFields(projectKey, typeId);
  return useMemo(() => {
    const custom = rows.filter((row) => row.column === null);
    const listed = new Set(custom.map((row) => row.field.key));
    const extra = fields
      .filter((field) => !listed.has(field.key) && values[field.key] !== undefined)
      .filter((field) => !BUILT_IN_FIELDS[field.key] && !HIDDEN_KINDS.has(field.kind))
      .map((field) => ({ field, required: false, column: null }));
    const all = [...custom, ...extra];
    return {
      side: all.filter((row) => !DOCUMENT_KINDS.has(row.field.kind)),
      documents: all.filter((row) => DOCUMENT_KINDS.has(row.field.kind)),
    };
  }, [rows, fields, values]);
}
