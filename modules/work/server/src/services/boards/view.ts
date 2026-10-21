import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { pageBoardCards, readBoardCursor } from '../../../../shared/board-paging.ts';
import type { BoardConfig, BoardView, BoardViewQuery } from '../../../../shared/boards.ts';
import { compileListOrder } from '../backlog/order.ts';
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
      const epics = await sql<
        { id: string; key: string; title: string; due_at: Date | null; color: string | null }[]
      >`
        select id, key, title, due_at, color from issues
        where id = any(${ids((entry) => entry.epicId)}::uuid[])
        order by rank collate "C", id`;
      const named = epics.map(
        (epic) =>
          [
            epic.id,
            { key: epic.key, title: epic.title, dueAt: dueOf(epic.due_at), color: epic.color },
          ] as const,
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

/** The epics the cards roll up to, whatever the lanes, each once: the cards' statement read them. */
function cardEpics(cards: readonly GroupCard[]): BoardView['epics'] {
  const epics = new Map<string, BoardView['epics'][number]>();
  for (const { epic } of cards) if (epic && !epics.has(epic.id)) epics.set(epic.id, epic);
  return [...epics.values()];
}

type Placed = BoardView['cards'][number];

/**
 * The titles of the docs that link each card, asked of the other modules in one call per
 * source and only when the board shows linked docs. Work's own references are not docs. Only
 * the cards in the answer are asked about, so a long board costs one page of them.
 */
async function withLinkedDocs(
  deps: PlanningDeps,
  ctx: RequestContext,
  config: BoardConfig,
  cards: Placed[],
): Promise<Placed[]> {
  if (!deps.links || !config.cardFields.includes('docs') || cards.length === 0) return cards;
  const groups = await deps.links.referencesToMany(ctx, {
    kind: 'issue',
    ids: cards.map((card) => card.issueId),
  });
  const docs = new Map<string, string[]>();
  for (const group of groups) {
    if (group.moduleId === 'work') continue;
    for (const [issueId, items] of group.items) {
      docs.set(issueId, [...(docs.get(issueId) ?? []), ...items.map((item) => item.title)]);
    }
  }
  return cards.map((card) => {
    const titles = docs.get(card.issueId);
    return titles ? { ...card, docs: titles } : card;
  });
}

/**
 * The cards the answer carries: the named ones wherever they sit (a realtime patch), else a
 * page of every column, or the next page of one.
 */
function shownCards(cards: Placed[], columnIds: readonly string[], query: BoardViewQuery) {
  if (query.issueIds) {
    const wanted = new Set(query.issueIds);
    return { cards: cards.filter((card) => wanted.has(card.issueId)), next: new Map() };
  }
  if (query.cursor && !query.column) throw new ValidationError('A cursor pages one column');
  const cursor = query.cursor ? readBoardCursor(query.cursor) : null;
  if (query.cursor && !cursor) throw new ValidationError('The cursor is not one this board gave');
  return pageBoardCards(cards, columnIds, { limit: query.limit, column: query.column, cursor });
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
  const [lanes, order] = await Promise.all([
    compileLql(deps, ctx, project.id, laneTexts),
    compileListOrder(sql, deps.lql, ctx, project.id, [], query.q),
  ]);
  const noSprint = project.method === 'scrum' && !sprintId;
  const [cards, metrics] = await Promise.all([
    loadCards(
      sql,
      project,
      config,
      { sprintId, noSprint, filter: order.filter, sortKeys: order.keys },
      laneExpression(sql, lanes),
      now,
    ),
    computeBoardMetrics(sql, board, 6, now, project),
  ]);
  const names = await laneNames(sql, project, config.lanes.kind, cards);
  const grouped = groupBoard(config, cards, names);
  const shown = shownCards(
    grouped.cards,
    grouped.columns.map((column) => column.id),
    query,
  );
  return {
    board: view,
    sprintId,
    columns: grouped.columns.map((column) => ({
      ...column,
      nextCursor: shown.next.get(column.id) ?? null,
    })),
    lanes: grouped.lanes,
    cards: await withLinkedDocs(deps, ctx, config, shown.cards),
    epics: cardEpics(cards),
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
