import type { SqlExecutor } from '@bemmoly/core';
import type { ReportFilters, ReportGroup } from '../../../../shared/ask-reports.ts';
import { loadFieldValues } from '../reports/stats-load.ts';
import type { FieldValues, StatValue } from '../reports/stats.ts';
import type { ReportIssue } from './compute.ts';

/*
 * The reads behind a report spec. Every piece of SQL here is written by hand, one fragment
 * per closed spec value, and every value the spec carries goes in as a bound parameter, so
 * nothing a model wrote is ever executed. Archived issues stay in, as they do in Reports.
 */

interface IssueRow {
  id: string;
  estimate: string | null;
  created_at: Date;
  resolved_at: Date | null;
  category: string;
}

function filterSql(
  sql: SqlExecutor,
  projectId: string,
  filters: ReportFilters,
  userId: string | null,
) {
  const parts = [sql`i.project_id = ${projectId} and i.deleted_at is null`];
  switch (filters.status) {
    case 'open':
      parts.push(sql`s.category <> 'done'`);
      break;
    case 'todo':
    case 'in_progress':
    case 'done':
      parts.push(sql`s.category = ${filters.status}`);
      break;
    default:
      break;
  }
  if (filters.sprint === 'active') {
    parts.push(sql`i.sprint_id in (
      select id from sprints where project_id = ${projectId} and state = 'active')`);
  }
  if (filters.assignee === 'me') {
    parts.push(sql`exists (select 1 from issue_assignees a
      where a.issue_id = i.id and a.removed_at is null and a.user_id = ${userId})`);
  } else if (filters.assignee === 'unassigned') {
    parts.push(sql`not exists (select 1 from issue_assignees a
      where a.issue_id = i.id and a.removed_at is null)`);
  }
  if (filters.types?.length) {
    const names = filters.types.map((name) => name.toLowerCase());
    parts.push(sql`i.type_id in (select id from issue_types where lower(name) = any(${names}))`);
  }
  if (filters.priorities?.length) {
    parts.push(sql`i.priority = any(${[...filters.priorities]})`);
  }
  if (filters.createdWithinDays) {
    parts.push(sql`i.created_at >= now() - make_interval(days => ${filters.createdWithinDays})`);
  }
  if (filters.resolvedWithinDays) {
    parts.push(sql`i.resolved_at >= now() - make_interval(days => ${filters.resolvedWithinDays})`);
  }
  return parts.reduce((all, part) => sql`${all} and ${part}`);
}

export async function loadReportIssues(
  sql: SqlExecutor,
  projectId: string,
  filters: ReportFilters,
  userId: string | null,
): Promise<ReportIssue[]> {
  const rows = await sql<IssueRow[]>`
    select i.id, i.estimate, i.created_at, i.resolved_at, s.category
    from issues i join workflow_statuses s on s.id = i.status_id
    where ${filterSql(sql, projectId, filters, userId)}`;
  return rows.map((row) => ({
    id: row.id,
    estimate: row.estimate === null ? null : Number(row.estimate),
    createdAt: new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
    done: row.category === 'done',
  }));
}

const SPRINT_ORDER: Record<string, number> = { active: 0, future: 1, closed: 2 };

async function sprintValues(sql: SqlExecutor, projectId: string): Promise<FieldValues> {
  const rows = await sql<{ issue_id: string; id: string; name: string; state: string }[]>`
    select i.id as issue_id, sp.id, sp.name, sp.state
    from issues i join sprints sp on sp.id = i.sprint_id
    where i.project_id = ${projectId} and i.deleted_at is null`;
  const values = new Map<string, StatValue[]>();
  for (const row of rows) {
    values.set(row.issue_id, [
      { id: row.id, label: row.name, order: SPRINT_ORDER[row.state] ?? null },
    ]);
  }
  return values;
}

/** Issue id to the values it holds in the grouping field. */
export async function loadGroupValues(
  sql: SqlExecutor,
  projectId: string,
  group: ReportGroup,
): Promise<FieldValues> {
  if (group === 'none') return new Map();
  if (group === 'sprint') return sprintValues(sql, projectId);
  return loadFieldValues(sql, projectId, group);
}
