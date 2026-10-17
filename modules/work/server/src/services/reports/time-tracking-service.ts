import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { TimeTrackingReport } from '../../../../shared/report-time-tracking.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { utcDate } from '../metrics/burndown.ts';
import { timeTracking, type TimeLog, type TimeWindow } from './time-tracking.ts';

/*
 * The time tracking report's read. Logs are summed in SQL per issue, person and week so the
 * row count stays bounded by the window rather than by how often people log; the pure
 * aggregation then builds the three lists from those sums.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK_SECONDS = 7 * 24 * 60 * 60;

interface SumRow {
  issue_id: string;
  key: string;
  title: string;
  estimate: string | number | null;
  user_id: string;
  name: string;
  week: number;
  minutes: number;
}

/** Sums of the logs in the window on the project's live issues, optionally one sprint's. */
async function loadLogSums(
  sql: SqlExecutor,
  projectId: string,
  sprintId: string | null,
  window: TimeWindow,
): Promise<TimeLog[]> {
  const start = new Date(window.start).toISOString();
  const end = new Date(window.end).toISOString();
  const rows = await sql<SumRow[]>`
    select i.id as issue_id, i.key, i.title, i.estimate, u.id as user_id, u.name,
      floor(extract(epoch from (w.started_at - ${start}::timestamptz)) / ${WEEK_SECONDS})::int
        as week,
      sum(w.minutes)::int as minutes
    from work_logs w
      join issues i on i.id = w.issue_id
      join users u on u.id = w.user_id
    where i.project_id = ${projectId} and i.deleted_at is null
      and (${sprintId}::uuid is null or i.sprint_id = ${sprintId}::uuid)
      and w.started_at >= ${start}::timestamptz and w.started_at <= ${end}::timestamptz
    group by i.id, u.id, week`;
  return rows.map((row) => ({
    issueId: row.issue_id,
    key: row.key,
    title: row.title,
    estimate: row.estimate === null ? null : Number(row.estimate),
    userId: row.user_id,
    name: row.name,
    minutes: row.minutes,
    startedAt: window.start + row.week * 7 * DAY,
  }));
}

/** A sprint's window: from its start to its close, or to now while it runs. */
async function sprintWindow(
  sql: SqlExecutor,
  projectId: string,
  sprintId: string,
  now: number,
): Promise<TimeWindow> {
  const [sprint] = await sql<
    { started_at: Date | string | null; closed_at: Date | string | null }[]
  >`
    select started_at, closed_at from sprints where id = ${sprintId} and project_id = ${projectId}`;
  if (!sprint) throw new NotFoundError(`Sprint ${sprintId} was not found`);
  // A sprint that has not started has no time in it yet: an empty window at now.
  const start = sprint.started_at ? new Date(sprint.started_at).getTime() : now;
  const end = sprint.closed_at ? new Date(sprint.closed_at).getTime() : now;
  return { start, end: Math.max(start, end) };
}

export function createTimeTrackingService(deps: Pick<PlanningDeps, 'database' | 'now'>) {
  const now = () => (deps.now?.() ?? new Date()).getTime();

  return {
    async report(
      ctx: RequestContext,
      ref: string,
      query: { days: number; sprintId?: string | undefined },
    ): Promise<TimeTrackingReport> {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const at = now();
      const window = query.sprintId
        ? await sprintWindow(sql, project.id, query.sprintId, at)
        : {
            start: Date.parse(`${utcDate(at)}T00:00:00.000Z`) - (query.days - 1) * DAY,
            end: at,
          };
      const logs = await loadLogSums(sql, project.id, query.sprintId ?? null, window);
      return timeTracking(logs, window);
    },
  };
}

export type TimeTrackingService = ReturnType<typeof createTimeTrackingService>;
