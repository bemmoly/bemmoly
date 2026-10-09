import type { SqlExecutor } from '@bemmoly/core';
import type { DiffItem } from './diff.ts';

/*
 * Each scheme kind read as diff items for one scope: the org defaults (null)
 * or a project's own copies. Copies name their origin by key so a renamed
 * copy still pairs with the row it came from.
 */

interface TypeItemRow {
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  level: string;
  position: number;
  origin_key: string | null;
  layout: unknown;
}

export const TYPE_ATTRIBUTES = [
  'name',
  'description',
  'icon',
  'color',
  'level',
  'position',
  'layout',
];

export async function typeItems(sql: SqlExecutor, projectId: string | null): Promise<DiffItem[]> {
  const rows = await sql<TypeItemRow[]>`
    select t.key, t.name, t.description, t.icon, t.color, t.level, t.position,
      o.key as origin_key,
      coalesce((
        select jsonb_agg(jsonb_build_object('field', f.key, 'required', l.required,
          'onCard', l.on_card) order by l.position, l.id)
        from issue_type_fields l join fields f on f.id = l.field_id
        where l.issue_type_id = t.id), '[]'::jsonb) as layout
    from issue_types t left join issue_types o on o.id = t.origin_id
    where t.project_id is not distinct from ${projectId}::uuid
    order by t.position, t.id`;
  return rows.map(({ key, origin_key, ...value }) => ({
    key,
    label: value.name,
    originKey: origin_key,
    value,
  }));
}

interface FieldItemRow {
  key: string;
  name: string;
  kind: string;
  options: unknown;
  filterable: boolean;
  ai_fill: boolean;
  origin_key: string | null;
}

export const FIELD_ATTRIBUTES = ['name', 'kind', 'options', 'filterable', 'aiFill'];

export async function fieldItems(sql: SqlExecutor, projectId: string | null): Promise<DiffItem[]> {
  const rows = await sql<FieldItemRow[]>`
    select f.key, f.name, f.kind, f.options, f.filterable, f.ai_fill, o.key as origin_key
    from fields f left join fields o on o.id = f.origin_id
    where f.project_id is not distinct from ${projectId}::uuid
    order by f.key`;
  return rows.map((row) => ({
    key: row.key,
    label: row.name,
    originKey: row.origin_key,
    value: {
      name: row.name,
      kind: row.kind,
      options: row.options,
      filterable: row.filterable,
      aiFill: row.ai_fill,
    },
  }));
}

export const WORKFLOW_ATTRIBUTES = ['name', 'category', 'color', 'position', 'from', 'to', 'rules'];

/**
 * Statuses and transitions of one workflow. They carry no origin pointer, so
 * a project's status pairs with the org status of the same name.
 */
export async function workflowItems(sql: SqlExecutor, workflowId: string): Promise<DiffItem[]> {
  const statuses = await sql<
    { id: string; name: string; category: string; color: string | null; position: number }[]
  >`
    select id, name, category, color, position from workflow_statuses
    where workflow_id = ${workflowId} order by position, id`;
  const names = new Map(statuses.map((status) => [status.id, status.name]));
  const transitions = await sql<
    { name: string; from_status_id: string | null; to_status_id: string; rules: unknown }[]
  >`
    select name, from_status_id, to_status_id, rules from workflow_transitions
    where workflow_id = ${workflowId} order by position, id`;
  return [
    ...statuses.map(({ id: _id, ...status }) => {
      const key = `status:${status.name.toLowerCase()}`;
      return { key, label: status.name, originKey: key, value: status };
    }),
    ...transitions.map((transition) => {
      const key = `transition:${transition.name.toLowerCase()}`;
      return {
        key,
        label: transition.name,
        originKey: key,
        value: {
          name: transition.name,
          from: transition.from_status_id ? (names.get(transition.from_status_id) ?? null) : 'Any',
          to: names.get(transition.to_status_id) ?? null,
          rules: transition.rules,
        },
      };
    }),
  ];
}
