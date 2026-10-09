import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { BoardMetrics, BoardMetricsQuery } from '../../../../shared/metrics.ts';
import type { SprintReport } from '../../../../shared/sprints.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { loadBoard, parseConfig, type BoardRow } from '../boards/rows.ts';
import { activeSprint, loadSprint, toSprint } from '../sprints/rows.ts';
import { utcDate } from './burndown.ts';
import { loadBurndown, loadFlow, loadVelocity, loadWorkInProgress, statusSets } from './load.ts';

/*
 * Velocity, burndown, cycle time and throughput, computed from history and
 * the completion snapshots and cached per board in sprint_metrics. A cached
 * row is reused while nothing on the project has changed since it was
 * computed and the day has not turned; otherwise it is recomputed in place.
 */

const FLOW_KIND = 'flow';

interface Cached {
  key: string;
  metrics: BoardMetrics;
}

/** The latest change that can move a board's numbers; part of the cache key. */
async function changeStamp(sql: SqlExecutor, board: BoardRow, projectId: string) {
  const [row] = await sql<{ stamp: Date | null }[]>`
    select greatest(
      (select max(updated_at) from issues where project_id = ${projectId}),
      (select max(updated_at) from sprints where project_id = ${projectId}),
      (select updated_at from boards where id = ${board.id})) as stamp`;
  return row?.stamp ? new Date(row.stamp).toISOString() : '';
}

export async function computeBoardMetrics(
  sql: SqlExecutor,
  board: BoardRow,
  sprints: number,
  now: Date,
): Promise<BoardMetrics> {
  if (!board.project_id) throw new ValidationError('The org default board has no issues');
  const project = await resolveProject(sql, board.project_id);
  const key = `${await changeStamp(sql, board, project.id)}|${utcDate(now.getTime())}|${sprints}`;
  const [cached] = await sql<{ data: Cached }[]>`
    select data from sprint_metrics
    where scope_kind = 'board' and scope_id = ${board.id} and kind = ${FLOW_KIND}`;
  if (cached?.data.key === key) return cached.data.metrics;

  const sets = await statusSets(sql, project.id, parseConfig(board.config));
  const active = project.method === 'scrum' ? await activeSprint(sql, project.id) : undefined;
  const [velocity, burndown, flow, wip] = await Promise.all([
    loadVelocity(sql, project.id, sprints),
    active ? loadBurndown(sql, active, sets.done, now) : Promise.resolve([]),
    loadFlow(sql, project.id, sets, now),
    loadWorkInProgress(sql, project.id, active?.id ?? null, sets),
  ]);
  const metrics: BoardMetrics = {
    boardId: board.id,
    velocity,
    burndown,
    sprintId: active?.id ?? null,
    ...flow,
    ...wip,
    computedAt: now.toISOString(),
  };
  await sql`
    insert into sprint_metrics (scope_kind, scope_id, kind, data, computed_at)
    values ('board', ${board.id}, ${FLOW_KIND}, ${JSON.stringify({ key, metrics })}::jsonb, now())
    on conflict (scope_kind, scope_id, kind)
    do update set data = excluded.data, computed_at = now(), updated_at = now()`;
  return metrics;
}

export function createMetricsService(deps: PlanningDeps) {
  const now = () => deps.now?.() ?? new Date();

  return {
    async board(
      ctx: RequestContext,
      boardId: string,
      query: BoardMetricsQuery,
    ): Promise<BoardMetrics> {
      const sql = requireDatabase(deps);
      const board = await loadBoard(sql, boardId);
      if (!board.project_id) throw new ValidationError('The org default board has no issues');
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(board.project_id));
      return computeBoardMetrics(sql, board, query.sprints, now());
    },

    /** A sprint's burndown and the project's velocity up to it, for the sprint report. */
    async sprintReport(ctx: RequestContext, sprintId: string): Promise<SprintReport> {
      const sql = requireDatabase(deps);
      const row = await loadSprint(sql, sprintId);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
      const sets = await statusSets(sql, row.project_id, null);
      const [burndown, velocity] = await Promise.all([
        loadBurndown(sql, row, sets.done, now()),
        loadVelocity(sql, row.project_id, 6),
      ]);
      return {
        sprint: toSprint(row),
        burndown,
        velocity: velocity.map(({ sprintId: id, name, completedPoints }) => ({
          sprintId: id,
          name,
          completedPoints,
        })),
      };
    },
  };
}

export type MetricsService = ReturnType<typeof createMetricsService>;
