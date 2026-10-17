import type { SqlExecutor } from '@bemmoly/core';
import { ISSUE_PRIORITIES } from '../../../../shared/enums.ts';
import type { StatField } from '../../../../shared/report-stats.ts';
import type { FieldValues, StatValue } from './stats.ts';

/*
 * The reads behind field statistics: the project's live issues, and per field
 * the values each of them holds. Values hanging off a deleted epic do not
 * count, the same as the epic not being there.
 */

interface ValueRow {
  issue_id: string;
  id: string;
  label: string;
  ord: number | null;
}

const PRIORITY_LABELS = (priority: string) => priority[0]!.toUpperCase() + priority.slice(1);

export async function loadStatIssues(sql: SqlExecutor, projectId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from issues where project_id = ${projectId} and deleted_at is null`;
  return rows.map((row) => row.id);
}

function valueRows(sql: SqlExecutor, projectId: string, field: StatField) {
  const live = sql`i.project_id = ${projectId} and i.deleted_at is null`;
  switch (field) {
    case 'status':
      return sql<ValueRow[]>`
        select i.id as issue_id, s.id, s.name as label, s.position as ord
        from issues i join workflow_statuses s on s.id = i.status_id where ${live}`;
    case 'assignee':
      return sql<ValueRow[]>`
        select i.id as issue_id, u.id, u.name as label, null::int as ord
        from issues i join issue_assignees a on a.issue_id = i.id and a.removed_at is null
        join users u on u.id = a.user_id where ${live}`;
    case 'type':
      return sql<ValueRow[]>`
        select i.id as issue_id, t.id, t.name as label, null::int as ord
        from issues i join issue_types t on t.id = i.type_id where ${live}`;
    case 'priority':
      return sql<ValueRow[]>`
        select i.id as issue_id, i.priority as id, i.priority as label, null::int as ord
        from issues i where ${live}`;
    case 'label':
      return sql<ValueRow[]>`
        select i.id as issue_id, l.id, l.name as label, null::int as ord
        from issues i join issue_labels il on il.issue_id = i.id
        join labels l on l.id = il.label_id where ${live}`;
    case 'epic':
      return sql<ValueRow[]>`
        select i.id as issue_id, p.id, p.key || ' ' || p.title as label, null::int as ord
        from issues i join issues p on p.id = i.parent_id and p.deleted_at is null
        join issue_types pt on pt.id = p.type_id and pt.level = 'epic' where ${live}`;
    case 'version':
      return sql<ValueRow[]>`
        select i.id as issue_id, v.id, v.name as label, null::int as ord
        from issues i join versions v on v.id = i.fix_version_id where ${live}`;
    case 'component':
      return sql<ValueRow[]>`
        select i.id as issue_id, c.id, c.name as label, null::int as ord
        from issues i join components c on c.id = i.component_id where ${live}`;
  }
}

export async function loadFieldValues(
  sql: SqlExecutor,
  projectId: string,
  field: StatField,
): Promise<FieldValues> {
  const rows = await valueRows(sql, projectId, field);
  const values = new Map<string, StatValue[]>();
  for (const row of rows) {
    // Priority is a fixed enum: its order and wording come from the code, not the table.
    const value: StatValue =
      field === 'priority'
        ? {
            id: row.id,
            label: PRIORITY_LABELS(row.id),
            order: ISSUE_PRIORITIES.indexOf(row.id as (typeof ISSUE_PRIORITIES)[number]),
          }
        : { id: row.id, label: row.label, order: row.ord };
    const list = values.get(row.issue_id) ?? [];
    list.push(value);
    values.set(row.issue_id, list);
  }
  return values;
}
