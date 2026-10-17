import type { SqlExecutor } from '@bemmoly/core';
import type { ScopeKind, ScopeTarget } from '../../../../shared/reports.ts';
import { completions } from '../metrics/flow.ts';
import type { StatusSets } from '../metrics/load.ts';
import { controlPoints, type ControlIssue } from './control.ts';
import type { ScopeChange, ScopeField, ScopeIssue } from './scope.ts';
import type { StatusMove, StayIssue } from './time-in-status.ts';

/*
 * The reads behind the control chart, time in status and the epic and
 * version burnups: one or two statements each over a project's issues and
 * their history since the window opened.
 */

const time = (value: Date | string): number => new Date(value).getTime();
const iso = (instant: number) => new Date(instant).toISOString();
const asStatus = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Issues finished since `start`, with their cycle times. */
export async function loadControlPoints(
  sql: SqlExecutor,
  projectId: string,
  sets: StatusSets,
  start: number,
  now: number,
) {
  const issues = await sql<
    {
      id: string;
      key: string;
      title: string;
      created_at: Date;
      resolved_at: Date | null;
      status_id: string;
    }[]
  >`
    select id, key, title, created_at, resolved_at, status_id from issues
    where project_id = ${projectId} and deleted_at is null
      and status_id = any(${[...sets.done]}::uuid[]) and status_changed_at >= ${iso(start)}::timestamptz`;
  const changes = await sql<{ issue_id: string; to_value: unknown; created_at: Date }[]>`
    select issue_id, to_value, created_at from issue_history
    where issue_id = any(${issues.map((issue) => issue.id)}::uuid[]) and field = 'statusId'`;
  const done = completions({
    issues: issues.map((row) => ({
      id: row.id,
      createdAt: time(row.created_at),
      resolvedAt: row.resolved_at ? time(row.resolved_at) : null,
      statusId: row.status_id,
    })),
    changes: changes.map((row) => ({
      issueId: row.issue_id,
      to: asStatus(row.to_value) ?? '',
      at: time(row.created_at),
    })),
    done: sets.done,
    inProgress: sets.inProgress,
    now,
  });
  const meta = new Map<string, ControlIssue>(
    issues.map((row) => [row.id, { key: row.key, title: row.title }]),
  );
  return controlPoints(done, meta, start);
}

/** Issues alive at some point in the window, and their status moves inside it. */
export async function loadStays(sql: SqlExecutor, projectId: string, start: number, end: number) {
  const issues = await sql<
    { id: string; status_id: string; created_at: Date; deleted_at: Date | null }[]
  >`
    select id, status_id, created_at, deleted_at from issues
    where project_id = ${projectId} and created_at < ${iso(end)}::timestamptz
      and (deleted_at is null or deleted_at >= ${iso(start)}::timestamptz)`;
  const moves = await sql<
    { issue_id: string; from_value: unknown; to_value: unknown; created_at: Date }[]
  >`
    select h.issue_id, h.from_value, h.to_value, h.created_at from issue_history h
    join issues i on i.id = h.issue_id
    where i.project_id = ${projectId} and h.field = 'statusId'
      and h.created_at >= ${iso(start)}::timestamptz`;
  return {
    issues: issues.map((row): StayIssue => ({
      id: row.id,
      statusId: row.status_id,
      createdAt: time(row.created_at),
      deletedAt: row.deleted_at ? time(row.deleted_at) : null,
    })),
    moves: moves.map((row): StatusMove => ({
      issueId: row.issue_id,
      from: asStatus(row.from_value),
      to: asStatus(row.to_value),
      at: time(row.created_at),
    })),
  };
}

/** The project's epics or its versions that are not archived, open ones first. */
export async function loadScopeTargets(
  sql: SqlExecutor,
  projectId: string,
  kind: ScopeKind,
  sets: StatusSets,
): Promise<ScopeTarget[]> {
  const rows =
    kind === 'epic'
      ? await sql<{ id: string; label: string; done: boolean }[]>`
          select i.id, i.key || ' ' || i.title as label,
            i.status_id = any(${[...sets.done]}::uuid[]) as done
          from issues i join issue_types t on t.id = i.type_id
          where i.project_id = ${projectId} and i.deleted_at is null and t.level = 'epic'
          order by i.number desc`
      : await sql<{ id: string; label: string; done: boolean }[]>`
          select id, name as label, status = 'released' as done from versions
          where project_id = ${projectId} and status <> 'archived'
          order by release_at nulls last, lower(name)`;
  return [...rows.filter((row) => !row.done), ...rows.filter((row) => row.done)];
}

const MEMBER_FIELD: Record<ScopeKind, { column: 'parent_id' | 'fix_version_id'; field: string }> = {
  epic: { column: 'parent_id', field: 'parentId' },
  version: { column: 'fix_version_id', field: 'fixVersionId' },
};

/** Every issue in the target now or since `start`, and its tracked changes since then. */
export async function loadScopeHistory(
  sql: SqlExecutor,
  kind: ScopeKind,
  targetId: string,
  start: number,
) {
  const { column, field } = MEMBER_FIELD[kind];
  const marker = JSON.stringify(targetId);
  const issues = await sql<
    {
      id: string;
      member: string | null;
      status_id: string;
      estimate: string | null;
      created_at: Date;
      deleted_at: Date | null;
    }[]
  >`
    select i.id, i.${sql(column)} as member, i.status_id, i.estimate, i.created_at, i.deleted_at
    from issues i
    where i.${sql(column)} = ${targetId} or i.id in (
      select h.issue_id from issue_history h
      where h.field = ${field} and h.created_at >= ${iso(start)}::timestamptz
        and (h.from_value = ${marker}::jsonb or h.to_value = ${marker}::jsonb))`;
  const changes = await sql<
    { issue_id: string; field: string; from_value: unknown; created_at: Date }[]
  >`
    select issue_id, field, from_value, created_at from issue_history
    where issue_id = any(${issues.map((issue) => issue.id)}::uuid[])
      and field in (${field}, 'statusId', 'estimate')
      and created_at >= ${iso(start)}::timestamptz`;
  return {
    issues: issues.map((row): ScopeIssue => ({
      id: row.id,
      member: row.member,
      statusId: row.status_id,
      estimate: row.estimate === null ? null : Number(row.estimate),
      createdAt: time(row.created_at),
      deletedAt: row.deleted_at ? time(row.deleted_at) : null,
    })),
    changes: changes.map((row): ScopeChange => ({
      issueId: row.issue_id,
      field: (row.field === field ? 'member' : row.field) as ScopeField,
      from: row.from_value,
      at: time(row.created_at),
    })),
  };
}
