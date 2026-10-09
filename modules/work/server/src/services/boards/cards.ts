import type { SqlClient, SqlFragment } from '@bemmoly/core';
import type { BoardCard, BoardConfig } from '../../../../shared/boards.ts';
import type { PlanningProject } from './context.ts';
import type { GroupCard } from './group.ts';

/*
 * The cards of a board in one statement. The board's issues are read once,
 * then their labels, open blockers and subtask counts are aggregated as sets
 * and joined back, so the cost is a few hash joins whatever the board's size
 * instead of four correlated lookups per card.
 */

const DAY = 24 * 60 * 60 * 1000;

/** How long a Kanban card stays in a done column before it leaves the board. */
const KANBAN_DONE_DAYS = 14;

export interface CardScope {
  sprintId: string | null;
  noSprint: boolean;
  filter: SqlFragment | null;
}

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
  subtasks_done: number;
  subtasks_total: number;
  epic_id: string | null;
  query_lane: number | null;
}

/** The lane index of the first named lane query a card matches, as one CASE. */
export function laneExpression(sql: SqlClient, lanes: readonly SqlFragment[]): SqlFragment {
  if (lanes.length === 0) return sql`null::int`;
  const whens = lanes
    .map((where, index) => sql`when (${where}) then ${index}::int`)
    .reduce((acc, part) => sql`${acc} ${part}`);
  return sql`case ${whens} else null end`;
}

const isoDay = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

function toCard(row: CardRow, now: number): GroupCard {
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
    dueAt: row.due_at ? isoDay(row.due_at) : null,
    subtasks:
      row.subtasks_total > 0 ? { done: row.subtasks_done, total: row.subtasks_total } : null,
    parentId: row.parent_id,
    docs: [],
    ageDays: Math.max(0, Math.floor((now - new Date(row.status_changed_at).getTime()) / DAY)),
  };
  return { card, epicId: row.epic_id, queryLane: row.query_lane };
}

/**
 * Ranks hold only a to z, so the C collation orders them exactly as the
 * default one does, and as the client compares them, without the cost of a
 * locale-aware comparison per pair.
 */
export async function loadCards(
  sql: SqlClient,
  project: PlanningProject,
  config: BoardConfig,
  scope: CardScope,
  lanes: SqlFragment,
  now: Date,
): Promise<GroupCard[]> {
  const statusIds = config.columns.flatMap((column) => column.statusIds);
  const sprint = scope.noSprint
    ? sql`false`
    : scope.sprintId
      ? sql`issues.sprint_id = ${scope.sprintId}::uuid`
      : sql`(not exists (select 1 from workflow_statuses ds
          where ds.id = issues.status_id and ds.category = 'done')
        or issues.status_changed_at > now() - make_interval(days => ${KANBAN_DONE_DAYS}))`;
  const rows = await sql<CardRow[]>`
    with board as materialized (
      select issues.id, issues.key, issues.title, issues.type_id, issues.status_id,
        issues.priority, issues.assignee_id, issues.estimate, issues.rank, issues.due_at,
        issues.parent_id, issues.status_changed_at, ${lanes} as query_lane
      from issues
      where issues.project_id = ${project.id} and issues.deleted_at is null
        and issues.status_id = any(${statusIds}::uuid[])
        and not exists (select 1 from issue_types it
          where it.id = issues.type_id and it.level = 'epic')
        and ${sprint}
        and ${scope.filter ?? sql`true`}
    ),
    labels as (
      select il.issue_id, array_agg(il.label_id order by il.id) as label_ids
      from issue_labels il join board on board.id = il.issue_id
      group by il.issue_id
    ),
    blockers as (
      select bl.target_id, array_agg(bi.key order by bi.key) as keys
      from issue_links bl
      join board on board.id = bl.target_id
      join issues bi on bi.id = bl.source_id and bi.deleted_at is null
      join workflow_statuses bs on bs.id = bi.status_id and bs.category <> 'done'
      where bl.kind = 'blocks'
      group by bl.target_id
    ),
    children as (
      select ci.parent_id, count(*) filter (where cs.category = 'done')::int as done,
        count(*)::int as total
      from issues ci
      join board on board.id = ci.parent_id
      join workflow_statuses cs on cs.id = ci.status_id
      where ci.deleted_at is null
      group by ci.parent_id
    )
    select board.*, coalesce(labels.label_ids, '{}') as label_ids,
      coalesce(blockers.keys, '{}') as blocked_by,
      coalesce(children.done, 0) as subtasks_done, coalesce(children.total, 0) as subtasks_total,
      epic.id as epic_id
    from board
    left join labels on labels.issue_id = board.id
    left join blockers on blockers.target_id = board.id
    left join children on children.parent_id = board.id
    left join issues epic on epic.id = board.parent_id
      and exists (select 1 from issue_types et where et.id = epic.type_id and et.level = 'epic')
    order by board.rank collate "C", board.id`;
  const at = now.getTime();
  return rows.map((row) => toCard(row, at));
}
