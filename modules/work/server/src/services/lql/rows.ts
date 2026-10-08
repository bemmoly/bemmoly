import type { SqlClient, SqlFragment } from '@bemmoly/core';
import type { Issue } from '../../../../shared/issues.ts';

/*
 * The issue row as this module's list statements select it. Dates and
 * numerics arrive as text from the raw client (see createSqlClient), so the
 * mapper converts them once here.
 */
export interface IssueRow {
  id: string;
  project_id: string;
  number: number;
  key: string;
  type_id: string;
  title: string;
  description: Issue['description'];
  description_text: string;
  status_id: string;
  priority: Issue['priority'];
  assignee_id: string | null;
  reporter_id: string | null;
  parent_id: string | null;
  sprint_id: string | null;
  estimate: string | number | null;
  due_at: string | Date | null;
  fix_version_id: string | null;
  component_id: string | null;
  custom_fields: Record<string, unknown>;
  label_ids: string[];
  rank: string;
  status_changed_at: Date | string;
  resolved_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const iso = (value: Date | string): string => new Date(value).toISOString();
export const isoOrNull = (value: Date | string | null): string | null =>
  value === null ? null : iso(value);
export const numberOrNull = (value: string | number | null): number | null =>
  value === null ? null : Number(value);
const dayOrNull = (value: string | Date | null): string | null =>
  value === null ? null : iso(value).slice(0, 10);

/** The columns of `issues` every list selects, with labels aggregated in place. */
export function issueColumns(sql: SqlClient): SqlFragment {
  return sql`issues.id, issues.project_id, issues.number, issues.key, issues.type_id,
    issues.title, issues.description, issues.description_text, issues.status_id,
    issues.priority, issues.assignee_id, issues.reporter_id, issues.parent_id,
    issues.sprint_id, issues.estimate, issues.due_at, issues.fix_version_id,
    issues.component_id, issues.custom_fields, issues.rank, issues.status_changed_at,
    issues.resolved_at, issues.deleted_at, issues.created_at, issues.updated_at,
    coalesce((select array_agg(il.label_id order by il.id) from issue_labels il
      where il.issue_id = issues.id), '{}'::uuid[]) as label_ids`;
}

export function toIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    key: row.key,
    typeId: row.type_id,
    title: row.title,
    description: row.description,
    descriptionText: row.description_text,
    statusId: row.status_id,
    priority: row.priority,
    assigneeId: row.assignee_id,
    reporterId: row.reporter_id,
    parentId: row.parent_id,
    sprintId: row.sprint_id,
    estimate: numberOrNull(row.estimate),
    dueAt: dayOrNull(row.due_at),
    fixVersionId: row.fix_version_id,
    componentId: row.component_id,
    customFields: row.custom_fields,
    labelIds: row.label_ids,
    rank: row.rank,
    statusChangedAt: iso(row.status_changed_at),
    resolvedAt: isoOrNull(row.resolved_at),
    deletedAt: isoOrNull(row.deleted_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
