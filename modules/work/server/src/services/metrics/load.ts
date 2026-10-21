import type { SqlExecutor } from '@bemmoly/core';
import type { BoardConfig } from '../../../../shared/boards.ts';
import type { BurndownPoint, VelocityPoint } from '../../../../shared/metrics.ts';
import { burndown } from './burndown.ts';
import { handoffsByTarget, velocityPoint, type Handoffs } from './changes.ts';
import { flowMetrics, flowWindowStart, type Flow } from './flow.ts';
import { loadSprintInput, type ReportSprint } from './load-report.ts';

/*
 * The reads behind every metric. Each is one or two statements over a
 * project's issues and their history; the pure functions do the arithmetic.
 */

const time = (value: Date | string): number => new Date(value).getTime();

export interface StatusSets {
  done: ReadonlySet<string>;
  inProgress: ReadonlySet<string>;
}

/**
 * Done means the board's done columns when it flags any, else every status in
 * the done category; in progress is every status in that category.
 */
export async function statusSets(
  sql: SqlExecutor,
  projectId: string,
  config: BoardConfig | null,
): Promise<StatusSets> {
  const rows = await sql<{ id: string; category: string }[]>`
    select s.id, s.category from workflow_statuses s join workflows w on w.id = s.workflow_id
    where w.project_id = ${projectId} or w.project_id is null`;
  const flagged = (config?.columns ?? [])
    .filter((column) => column.done)
    .flatMap((column) => column.statusIds);
  const category = (name: string) => rows.filter((row) => row.category === name).map((r) => r.id);
  return {
    done: new Set(flagged.length > 0 ? flagged : category('done')),
    inProgress: new Set(category('in_progress')),
  };
}

/** The unfinished work closed sprints of the project handed to the given sprints. */
export async function loadHandoffs(
  sql: SqlExecutor,
  projectId: string,
  sprintIds: readonly string[],
): Promise<Handoffs> {
  if (sprintIds.length === 0) return new Map();
  const rows = await sql<{ snapshot: unknown }[]>`
    select completed_snapshot as snapshot from sprints
    where project_id = ${projectId} and state = 'closed'
      and completed_snapshot ->> 'carriedOverTo' = any(${[...sprintIds]}::text[])`;
  return handoffsByTarget(rows.map((row) => row.snapshot));
}

const issueIds = (commitment: unknown): string[] | null => {
  const ids = (commitment as { issueIds?: unknown } | null)?.issueIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : null;
};

/**
 * The last closed sprints, oldest first, read from their completion snapshots
 * and start commitments, with the spillover each one received.
 */
export async function loadVelocity(
  sql: SqlExecutor,
  projectId: string,
  count: number,
): Promise<VelocityPoint[]> {
  const rows = await sql<{ id: string; name: string; snapshot: unknown; commitment: unknown }[]>`
    select s.id, s.name, coalesce(m.data, s.completed_snapshot) as snapshot,
      c.data as commitment
    from sprints s
    left join sprint_metrics m
      on m.scope_kind = 'sprint' and m.scope_id = s.id and m.kind = 'completion'
    left join sprint_metrics c
      on c.scope_kind = 'sprint' and c.scope_id = s.id and c.kind = 'commitment'
    where s.project_id = ${projectId} and s.state = 'closed'
    order by s.closed_at desc nulls last, s.id desc
    limit ${count}`;
  const handoffs = await loadHandoffs(
    sql,
    projectId,
    rows.map((row) => row.id),
  );
  return rows.reverse().map((row) =>
    velocityPoint(
      {
        id: row.id,
        name: row.name,
        snapshot: row.snapshot,
        startIssueIds: issueIds(row.commitment),
      },
      handoffs,
    ),
  );
}

export async function loadBurndown(
  sql: SqlExecutor,
  sprint: ReportSprint,
  done: ReadonlySet<string>,
  now: Date,
): Promise<BurndownPoint[]> {
  const input = await loadSprintInput(sql, sprint, done, now);
  return input ? burndown(input) : [];
}

export async function loadFlow(
  sql: SqlExecutor,
  projectId: string,
  sets: StatusSets,
  now: Date,
): Promise<Flow> {
  const since = new Date(flowWindowStart(now.getTime())).toISOString();
  const done = [...sets.done];
  const issues = await sql<
    { id: string; created_at: Date; resolved_at: Date | null; status_id: string }[]
  >`
    select id, created_at, resolved_at, status_id from issues
    where project_id = ${projectId} and deleted_at is null
      and status_id = any(${done}::uuid[]) and status_changed_at >= ${since}::timestamptz`;
  const changes = await sql<{ issue_id: string; to_value: unknown; created_at: Date }[]>`
    select issue_id, to_value, created_at from issue_history
    where issue_id = any(${issues.map((issue) => issue.id)}::uuid[]) and field = 'statusId'`;
  return flowMetrics({
    issues: issues.map((row) => ({
      id: row.id,
      createdAt: time(row.created_at),
      resolvedAt: row.resolved_at ? time(row.resolved_at) : null,
      statusId: row.status_id,
    })),
    changes: changes.map((row) => ({
      issueId: row.issue_id,
      to: typeof row.to_value === 'string' ? row.to_value : '',
      at: time(row.created_at),
    })),
    done: sets.done,
    inProgress: sets.inProgress,
    now: now.getTime(),
  });
}

/** Work in progress on the board and the active sprint's committed and completed points. */
export async function loadWorkInProgress(
  sql: SqlExecutor,
  projectId: string,
  sprintId: string | null,
  sets: StatusSets,
) {
  const [row] = await sql<{ wip: number; committed: string; completed: string }[]>`
    select
      count(*) filter (where status_id = any(${[...sets.inProgress]}::uuid[]))::int as wip,
      coalesce(sum(estimate) filter (where sprint_id = ${sprintId}::uuid), 0) as committed,
      coalesce(sum(estimate) filter (where sprint_id = ${sprintId}::uuid
        and status_id = any(${[...sets.done]}::uuid[])), 0) as completed
    from issues
    where project_id = ${projectId} and deleted_at is null
      and (${sprintId}::uuid is null or sprint_id = ${sprintId}::uuid)`;
  return {
    wipCount: row?.wip ?? 0,
    committedPoints: Number(row?.committed ?? 0),
    completedPoints: Number(row?.completed ?? 0),
  };
}
