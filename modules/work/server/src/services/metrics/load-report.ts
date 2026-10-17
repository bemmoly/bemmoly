import type { SqlExecutor } from '@bemmoly/core';
import type { FlowReportDay } from '../../../../shared/reports.ts';
import type { FieldChange, TrackedField } from './burndown.ts';
import type { ReportIssue, SprintReportInput } from './burnup.ts';
import { flowReportDays, reportCutoffs } from './cfd.ts';
import type { StatusSets } from './load.ts';

/*
 * The history behind the sprint report and the project reports. A sprint
 * reads every issue that was in it at any point since it started; a project
 * reads its issues alive at some point in the window and their status moves.
 */

const DAY = 24 * 60 * 60 * 1000;
const time = (value: Date | string): number => new Date(value).getTime();

export interface ReportSprint {
  id: string;
  started_at: Date | string | null;
  closed_at: Date | string | null;
}

/** A started sprint's issues and their tracked changes since the start; null before it starts. */
export async function loadSprintInput(
  sql: SqlExecutor,
  sprint: ReportSprint,
  done: ReadonlySet<string>,
  now: Date,
): Promise<SprintReportInput | null> {
  if (!sprint.started_at) return null;
  const start = time(sprint.started_at);
  const since = new Date(start).toISOString();
  const marker = JSON.stringify(sprint.id);
  const issues = await sql<
    {
      id: string;
      key: string;
      title: string;
      created_at: Date;
      deleted_at: Date | null;
      sprint_id: string | null;
      status_id: string;
      estimate: string | null;
    }[]
  >`
    select i.id, i.key, i.title, i.created_at, i.deleted_at, i.sprint_id, i.status_id, i.estimate
    from issues i
    where i.sprint_id = ${sprint.id} or i.id in (
      select h.issue_id from issue_history h
      where h.field = 'sprintId' and h.created_at >= ${since}::timestamptz
        and (h.from_value = ${marker}::jsonb or h.to_value = ${marker}::jsonb))`;
  const ids = issues.map((issue) => issue.id);
  const history = await sql<
    { issue_id: string; field: TrackedField; from_value: unknown; created_at: Date }[]
  >`
    select issue_id, field, from_value, created_at from issue_history
    where issue_id = any(${ids}::uuid[]) and field in ('sprintId', 'statusId', 'estimate')
      and created_at >= ${since}::timestamptz`;
  return {
    sprintId: sprint.id,
    issues: issues.map((row): ReportIssue => ({
      id: row.id,
      key: row.key,
      title: row.title,
      createdAt: time(row.created_at),
      deletedAt: row.deleted_at ? time(row.deleted_at) : null,
      sprintId: row.sprint_id,
      statusId: row.status_id,
      estimate: row.estimate === null ? null : Number(row.estimate),
    })),
    changes: history.map((row): FieldChange => ({
      issueId: row.issue_id,
      field: row.field,
      from: row.from_value,
      at: time(row.created_at),
    })),
    done,
    start,
    end: sprint.closed_at ? time(sprint.closed_at) - 1 : now.getTime(),
  };
}

const asStatus = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** The cumulative flow and created-against-resolved series over the last `days` days. */
export async function loadFlowReport(
  sql: SqlExecutor,
  projectId: string,
  sets: StatusSets,
  days: number,
  now: Date,
): Promise<FlowReportDay[]> {
  const firstCutoff = reportCutoffs(now.getTime(), days)[0] ?? now.getTime();
  const since = new Date(firstCutoff - DAY + 1);
  const issues = await sql<
    { id: string; status_id: string; created_at: Date; deleted_at: Date | null }[]
  >`
    select id, status_id, created_at, deleted_at from issues
    where project_id = ${projectId}
      and (deleted_at is null or deleted_at >= ${since.toISOString()}::timestamptz)`;
  const changes = await sql<
    { issue_id: string; from_value: unknown; to_value: unknown; created_at: Date }[]
  >`
    select h.issue_id, h.from_value, h.to_value, h.created_at from issue_history h
    join issues i on i.id = h.issue_id
    where i.project_id = ${projectId} and h.field = 'statusId'
      and h.created_at >= ${since.toISOString()}::timestamptz`;
  return flowReportDays({
    issues: issues.map((row) => ({
      id: row.id,
      statusId: row.status_id,
      createdAt: time(row.created_at),
      deletedAt: row.deleted_at ? time(row.deleted_at) : null,
    })),
    changes: changes.map((row) => ({
      issueId: row.issue_id,
      from: asStatus(row.from_value),
      to: asStatus(row.to_value),
      at: time(row.created_at),
    })),
    done: sets.done,
    inProgress: sets.inProgress,
    now: now.getTime(),
    days,
  });
}
