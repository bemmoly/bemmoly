import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { IssueType, IssueTypeField } from '../../../../shared/issue-types.ts';
import { iso } from '../projects/rows.ts';

export interface IssueTypeRow {
  id: string;
  project_id: string | null;
  origin_id: string | null;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  level: IssueType['level'];
  position: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface IssueTypeFieldRow {
  id: string;
  issue_type_id: string;
  field_id: string;
  required: boolean;
  on_card: boolean;
  position: number;
}

export const ISSUE_TYPE_COLUMNS = `id, project_id, origin_id, key, name, description, icon, color,
  level, position, created_at, updated_at`;

export const toIssueType = (row: IssueTypeRow): IssueType => ({
  id: row.id,
  projectId: row.project_id,
  originId: row.origin_id,
  key: row.key,
  name: row.name,
  description: row.description,
  icon: row.icon,
  color: row.color,
  level: row.level,
  position: row.position,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export const toIssueTypeField = (row: IssueTypeFieldRow): IssueTypeField => ({
  id: row.id,
  issueTypeId: row.issue_type_id,
  fieldId: row.field_id,
  required: row.required,
  onCard: row.on_card,
  position: row.position,
});

/** The rows of one scope, in display order. */
export async function issueTypesOf(
  sql: SqlExecutor,
  projectId: string | null,
): Promise<IssueTypeRow[]> {
  return sql<IssueTypeRow[]>`
    select ${sql.unsafe(ISSUE_TYPE_COLUMNS)} from issue_types
    where project_id is not distinct from ${projectId}::uuid
    order by position, id`;
}

/** A type by id, but only inside the scope the caller resolved. */
export async function issueTypeIn(
  sql: SqlExecutor,
  projectId: string | null,
  id: string,
): Promise<IssueTypeRow> {
  const [row] = await sql<IssueTypeRow[]>`
    select ${sql.unsafe(ISSUE_TYPE_COLUMNS)} from issue_types
    where id = ${id} and project_id is not distinct from ${projectId}::uuid`;
  if (!row) throw new NotFoundError('The issue type was not found');
  return row;
}
