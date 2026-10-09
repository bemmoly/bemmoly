import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';
import type {
  BoardCard,
  BoardConfig,
  BoardView,
  BoardViewQuery,
} from '../../../../shared/boards.ts';
import { computeBoardMetrics } from '../metrics/index.ts';
import { activeSprint } from '../sprints/rows.ts';
import type { PlanningDeps, PlanningProject } from './context.ts';
import { groupBoard, type GroupCard, type LaneNames } from './group.ts';
import { toBoard, type BoardRow } from './rows.ts';

/*
 * The board in one read: the cards come from one statement in rank order with
 * their labels, blockers, subtask counts, epic and lane already resolved, and
 * the names the lane headers print from one more. No per-card queries.
 */

const DAY = 24 * 60 * 60 * 1000;

/** How long a Kanban card stays in a done column before it leaves the board. */
export const KANBAN_DONE_DAYS = 14;

interface CardRow {
  id: string;
  key: string;
  title: string;
  type_id: string;
  status_id: string;
  priority: string;
  assignee_id: string | null;
  estimate: string | null;
  rank: string;
  due_at: Date | string | null;
  parent_id: string | null;
  status_changed_at: Date | string;
  label_ids: string[];
  blocked_by: string[];
  subtasks: { done: number; total: number };
  epic_id: string | null;
  query_lane: number | null;
}

/** The lane index of the first named lane query a card matches, as one CASE. */
function laneExpression(sql: SqlClient, lanes: readonly SqlFragment[]): SqlFragment {
  if (lanes.length === 0) return sql`null::int`;
  const whens = lanes
    .map((where, index) => sql`when (${where}) then ${index}::int`)
    .reduce((acc, part) => sql`${acc} ${part}`);
  return sql`case ${whens} else null end`;
}

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

const toCard = (row: CardRow, now: number): GroupCard => {
  const card: BoardCard = {
    issueId: row.id,
    key: row.key,
    title: row.title,
    typeId: row.type_id,
    statusId: row.status_id,
    priority: row.priority,
    assigneeId: row.assignee_id,
    estimate: row.estimate === null ? null : Number(row.estimate),
    labelIds: row.label_ids,
    rank: row.rank,
    blockedBy: row.blocked_by,
    dueAt: row.due_at ? new Date(row.due_at).toISOString().slice(0, 10) : null,
    subtasks: row.subtasks.total > 0 ? row.subtasks : null,
    parentId: row.parent_id,
    docs: [],
    ageDays: Math.max(0, Math.floor((now - new Date(row.status_changed_at).getTime()) / DAY)),
  };
  return { card, epicId: row.epic_id, queryLane: row.query_lane };
};

async function loadCards(
  sql: SqlClient,
  project: PlanningProject,
  config: BoardConfig,
  scope: { sprintId: string | null; noSprint: boolean; filter: SqlFragment | null },
  lanes: SqlFragment,
): Promise<CardRow[]> {
  const statusIds = config.columns.flatMap((column) => column.statusIds);
  const sprint = scope.noSprint
    ? sql`false`
    : scope.sprintId
      ? sql`issues.sprint_id = ${scope.sprintId}::uuid`
      : sql`(not exists (select 1 from workflow_statuses ds
          where ds.id = issues.status_id and ds.category = 'done')
        or issues.status_changed_at > now() - make_interval(days => ${KANBAN_DONE_DAYS}))`;
  return sql<CardRow[]>`
    select issues.id, issues.key, issues.title, issues.type_id, issues.status_id,
      issues.priority, issues.assignee_id, issues.estimate, issues.rank, issues.due_at,
      issues.parent_id, issues.status_changed_at,
      coalesce((select array_agg(il.label_id order by il.id) from issue_labels il
        where il.issue_id = issues.id), '{}') as label_ids,
      coalesce((select array_agg(bi.key order by bi.key) from issue_links bl
        join issues bi on bi.id = bl.source_id
        join workflow_statuses bs on bs.id = bi.status_id
        where bl.target_id = issues.id and bl.kind = 'blocks' and bi.deleted_at is null
          and bs.category <> 'done'), '{}') as blocked_by,
      (select jsonb_build_object('done', count(*) filter (where cs.category = 'done'),
         'total', count(*)) from issues ci join workflow_statuses cs on cs.id = ci.status_id
        where ci.parent_id = issues.id and ci.deleted_at is null) as subtasks,
      (select ep.id from issues ep join issue_types et on et.id = ep.type_id
        where ep.id = issues.parent_id and et.level = 'epic') as epic_id,
      ${lanes} as query_lane
    from issues
    where issues.project_id = ${project.id} and issues.deleted_at is null
      and issues.status_id = any(${statusIds}::uuid[])
      and not exists (select 1 from issue_types it
        where it.id = issues.type_id and it.level = 'epic')
      and ${sprint}
      and ${scope.filter ?? sql`true`}
    order by issues.rank, issues.id`;
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
  const rows = await loadCards(
    sql,
    project,
    config,
    { sprintId, noSprint, filter },
    laneExpression(sql, lanes),
  );
  const cards = rows.map((row) => toCard(row, now.getTime()));
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
