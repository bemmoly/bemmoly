import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';
import type { BoardConfig, BoardView, BoardViewQuery } from '../../../../shared/boards.ts';
import { computeBoardMetrics } from '../metrics/index.ts';
import { activeSprint } from '../sprints/rows.ts';
import { laneExpression, loadCards } from './cards.ts';
import type { PlanningDeps, PlanningProject } from './context.ts';
import { groupBoard, type GroupCard, type LaneNames } from './group.ts';
import { toBoard, type BoardRow } from './rows.ts';

/*
 * The board in one read: the cards come from one statement in rank order with
 * their labels, blockers, subtask counts, epic and lane already resolved, the
 * metrics from their cache beside it, and only the names the board's lanes
 * print after. No per-card queries.
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

const NO_NAMES: LaneNames = { epics: new Map(), users: new Map(), types: new Map() };
const dueOf = (value: Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : null);

/** The names the lane headers print, read only for the kind of lanes the board has. */
async function laneNames(
  sql: SqlClient,
  project: PlanningProject,
  kind: BoardConfig['lanes']['kind'],
  cards: readonly GroupCard[],
): Promise<LaneNames> {
  const ids = (pick: (entry: GroupCard) => string | null) => [
    ...new Set(cards.map(pick).filter((id): id is string => id !== null)),
  ];
  switch (kind) {
    case 'epic': {
      const epics = await sql<{ id: string; key: string; title: string; due_at: Date | null }[]>`
        select id, key, title, due_at from issues
        where id = any(${ids((entry) => entry.epicId)}::uuid[])
        order by rank collate "C", id`;
      const named = epics.map(
        (epic) =>
          [epic.id, { key: epic.key, title: epic.title, dueAt: dueOf(epic.due_at) }] as const,
      );
      return { ...NO_NAMES, epics: new Map(named) };
    }
    case 'assignee': {
      const users = await sql<{ id: string; name: string }[]>`
        select id, name from users
        where id = any(${ids((entry) => entry.card.assigneeId)}::uuid[])`;
      return { ...NO_NAMES, users: new Map(users.map((user) => [user.id, user.name])) };
    }
    case 'type': {
      const types = await sql<{ id: string; name: string }[]>`
        select id, name from issue_types
        where project_id = ${project.id} or project_id is null
        order by project_id nulls last, position, id`;
      return { ...NO_NAMES, types: new Map(types.map((type) => [type.id, type.name])) };
    }
    default:
      return NO_NAMES;
  }
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
  const [cards, metrics] = await Promise.all([
    loadCards(
      sql,
      project,
      config,
      { sprintId, noSprint, filter },
      laneExpression(sql, lanes),
      now,
    ),
    computeBoardMetrics(sql, board, 6, now, project),
  ]);
  const names = await laneNames(sql, project, config.lanes.kind, cards);
  const grouped = groupBoard(config, cards, names);
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
