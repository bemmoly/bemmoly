import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';
import type { BoardView, BoardViewQuery } from '../../../../shared/boards.ts';
import { computeBoardMetrics } from '../metrics/index.ts';
import { activeSprint } from '../sprints/rows.ts';
import { laneExpression, loadCards } from './cards.ts';
import type { PlanningDeps, PlanningProject } from './context.ts';
import { groupBoard, type GroupCard, type LaneNames } from './group.ts';
import { toBoard, type BoardRow } from './rows.ts';

/*
 * The board in one read: the cards come from one statement in rank order with
 * their labels, blockers, subtask counts, epic and lane already resolved, and
 * the names the lane headers print from one more. No per-card queries.
 */

async function compileLql(
  deps: PlanningDeps,
  ctx: RequestContext,
  projectId: string,
  texts: readonly string[],
): Promise<SqlFragment[]> {
  if (texts.length === 0) return [];
  const catalog = await deps.lql.catalog(projectId);
  return texts.map((text) => deps.lql.where(ctx, deps.lql.parse(text, catalog), catalog));
}

async function laneNames(
  sql: SqlClient,
  project: PlanningProject,
  cards: readonly GroupCard[],
): Promise<LaneNames> {
  const epicIds = [...new Set(cards.map((entry) => entry.epicId).filter(Boolean))] as string[];
  const userIds = [...new Set(cards.map((entry) => entry.card.assigneeId).filter(Boolean))];
  const [epics, users, types] = await Promise.all([
    sql<{ id: string; key: string; title: string; due_at: Date | null }[]>`
      select id, key, title, due_at from issues where id = any(${epicIds}::uuid[])
      order by rank, id`,
    sql<{ id: string; name: string }[]>`
      select id, name from users where id = any(${userIds as string[]}::uuid[])`,
    sql<{ id: string; name: string }[]>`
      select id, name from issue_types
      where project_id = ${project.id} or project_id is null
      order by project_id nulls last, position, id`,
  ]);
  const dueOf = (value: Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : null);
  return {
    epics: new Map(
      epics.map((e) => [e.id, { key: e.key, title: e.title, dueAt: dueOf(e.due_at) }]),
    ),
    users: new Map(users.map((user) => [user.id, user.name])),
    types: new Map(types.map((type) => [type.id, type.name])),
  };
}

export async function buildBoardView(
  deps: PlanningDeps,
  ctx: RequestContext,
  sql: SqlClient,
  board: BoardRow,
  project: PlanningProject,
  query: BoardViewQuery,
): Promise<BoardView> {
  const view = toBoard(board);
  const config = view.config;
  const now = deps.now?.() ?? new Date();
  let sprintId = query.sprintId ?? null;
  if (!sprintId && project.method === 'scrum')
    sprintId = (await activeSprint(sql, project.id))?.id ?? null;
  const laneTexts = config.lanes.kind === 'query' ? config.lanes.queries.map((q) => q.query) : [];
  const compiled = await compileLql(deps, ctx, project.id, [
    ...(query.q ? [query.q] : []),
    ...laneTexts,
  ]);
  const filter = query.q ? (compiled[0] ?? null) : null;
  const lanes = query.q ? compiled.slice(1) : compiled;
  const noSprint = project.method === 'scrum' && !sprintId;
  const cards = await loadCards(
    sql,
    project,
    config,
    { sprintId, noSprint, filter },
    laneExpression(sql, lanes),
    now,
  );
  const grouped = groupBoard(config, cards, await laneNames(sql, project, cards));
  const metrics = await computeBoardMetrics(sql, board, 6, now);
  return {
    board: view,
    sprintId,
    ...grouped,
    metrics: {
      throughputPerWeek: metrics.throughputPerWeek,
      cycleTimeDays: metrics.cycleTimeDays,
      wipCount: metrics.wipCount,
      committedPoints: metrics.committedPoints,
      completedPoints: metrics.completedPoints,
      throughputHistory: metrics.throughputHistory,
    },
  };
}
