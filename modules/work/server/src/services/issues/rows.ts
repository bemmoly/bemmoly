import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { Issue } from '../../../../shared/issues.ts';
import { iso } from './deps.ts';

/** One issues row as postgres.js returns it, labels aggregated beside it. */
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
  rank: string;
  status_changed_at: Date | string;
  resolved_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  label_ids: string[] | null;
  color?: string | null;
}

export const ISSUE_COLUMNS = `
  i.id, i.project_id, i.number, i.key, i.type_id, i.title, i.description, i.description_text,
  i.status_id, i.priority, i.assignee_id, i.reporter_id, i.parent_id, i.sprint_id, i.estimate,
  i.due_at, i.fix_version_id, i.component_id, i.custom_fields, i.rank, i.status_changed_at,
  i.resolved_at, i.deleted_at, i.created_at, i.updated_at, i.color,
  (select array_agg(il.label_id order by il.id) from issue_labels il where il.issue_id = i.id)
    as label_ids`;

const dateOnly = (value: string | Date): string => iso(value).slice(0, 10);

export const toIssue = (row: IssueRow): Issue => ({
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
  estimate: row.estimate === null ? null : Number(row.estimate),
  dueAt: row.due_at === null ? null : dateOnly(row.due_at),
  fixVersionId: row.fix_version_id,
  componentId: row.component_id,
  customFields: row.custom_fields,
  labelIds: row.label_ids ?? [],
  color: row.color ?? null,
  rank: row.rank,
  statusChangedAt: iso(row.status_changed_at),
  resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
  deletedAt: row.deleted_at ? iso(row.deleted_at) : null,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export interface LoadOptions {
  /** Deleted issues are invisible except to restore and to the trash. */
  includeDeleted?: boolean;
  /** `for update` so an update sees the row it is about to change. */
  lock?: boolean;
}

/** The row behind a key, or NotFoundError; the key is already normalised by the schema. */
export async function loadIssueByKey(
  sql: SqlExecutor,
  key: string,
  options: LoadOptions = {},
): Promise<IssueRow> {
  const rows = await sql<IssueRow[]>`
    select ${sql.unsafe(ISSUE_COLUMNS)} from issues i
    where i.key = ${key} ${options.includeDeleted ? sql`` : sql`and i.deleted_at is null`}
    ${options.lock ? sql`for update of i` : sql``}`;
  const row = rows[0];
  if (!row) throw new NotFoundError(`Issue ${key} was not found`);
  return row;
}

export async function loadIssueById(
  sql: SqlExecutor,
  id: string,
  options: LoadOptions = {},
): Promise<IssueRow> {
  const rows = await sql<IssueRow[]>`
    select ${sql.unsafe(ISSUE_COLUMNS)} from issues i
    where i.id = ${id} ${options.includeDeleted ? sql`` : sql`and i.deleted_at is null`}
    ${options.lock ? sql`for update of i` : sql``}`;
  const row = rows[0];
  if (!row) throw new NotFoundError('The issue was not found');
  return row;
}
