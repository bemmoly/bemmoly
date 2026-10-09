import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { CompleteSprintBody, Sprint, StartSprintBody } from '../../../../shared/sprints.ts';
import { completeSprintBodySchema } from '../../../../shared/sprints.ts';
import { audit, publishPlanningChange, type PlanningDeps } from '../boards/context.ts';
import { parseConfig, projectBoards } from '../boards/rows.ts';
import { recordHistory } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase } from '../issues/deps.ts';
import { statusSets } from '../metrics/load.ts';
import { loadSprint, SPRINT_COLUMNS, toSprint, type SprintRow } from './rows.ts';
import {
  commitmentOf,
  completionSnapshot,
  startDates,
  type Commitment,
  type SprintIssue,
} from './snapshot.ts';

/*
 * Starting and closing a sprint. Both lock the project row first, so two
 * starts in flight cannot leave a Scrum project with two active sprints, and
 * a close cannot race a start.
 */

async function lockProject(tx: SqlExecutor, projectId: string) {
  const [project] = await tx<{ id: string; method: string }[]>`
    select id, method from projects where id = ${projectId} for update`;
  if (!project) throw new NotFoundError('The project was not found');
  return project;
}

async function sprintIssues(tx: SqlExecutor, sprintId: string): Promise<SprintIssue[]> {
  const rows = await tx<{ id: string; key: string; estimate: string | null; status_id: string }[]>`
    select id, key, estimate, status_id from issues
    where sprint_id = ${sprintId} and deleted_at is null order by rank, id`;
  return rows.map((row) => ({
    issueId: row.id,
    key: row.key,
    estimate: row.estimate === null ? null : Number(row.estimate),
    statusId: row.status_id,
  }));
}

async function writeMetric(tx: SqlExecutor, sprintId: string, kind: string, data: unknown) {
  await tx`
    insert into sprint_metrics (scope_kind, scope_id, kind, data, computed_at)
    values ('sprint', ${sprintId}, ${kind}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (scope_kind, scope_id, kind)
    do update set data = excluded.data, computed_at = now(), updated_at = now()`;
}

export async function startSprint(
  deps: PlanningDeps,
  ctx: RequestContext,
  id: string,
  body: StartSprintBody,
): Promise<Sprint> {
  const sql = requireDatabase(deps);
  const found = await loadSprint(sql, id);
  await ctx.authz.authorize(ctx.actor, 'work.sprint.manage', projectResource(found.project_id));
  const row = await sql.begin(async (tx) => {
    const project = await lockProject(tx, found.project_id);
    if (project.method !== 'scrum') {
      throw new ValidationError('Kanban projects run without sprints');
    }
    const sprint = await loadSprint(tx, id, { lock: true });
    if (sprint.state !== 'future') throw new ConflictError(`${sprint.name} has already started`);
    const [running] = await tx<{ name: string }[]>`
      select name from sprints where project_id = ${project.id} and state = 'active'`;
    if (running) throw new ConflictError(`${running.name} is still active; close it first`);
    const boards = await projectBoards(tx, project.id);
    const cadence = boards[0] ? parseConfig(boards[0].config).cadenceDays : 14;
    const planned = toSprint(sprint);
    const dates = startDates(planned, body, deps.now?.() ?? new Date(), cadence);
    if (Date.parse(dates.endsAt) <= Date.parse(dates.startsAt)) {
      throw new ValidationError('A sprint ends after it starts', { details: { path: 'endsAt' } });
    }
    const [started] = await tx<SprintRow[]>`
      update sprints set state = 'active', started_at = now(), starts_at = ${dates.startsAt},
        ends_at = ${dates.endsAt}, updated_at = now()
      where id = ${id}
      returning ${tx.unsafe(SPRINT_COLUMNS)}`;
    await writeMetric(tx, id, 'commitment', commitmentOf(await sprintIssues(tx, id)));
    const after = toSprint(started as SprintRow);
    await audit(deps, ctx, tx, {
      action: 'sprint.started',
      target: { kind: 'sprint', id },
      before: planned,
      after,
    });
    await publishPlanningChange(deps, tx, project.id, {
      boardIds: boards.map((board) => board.id),
      sprintIds: [id],
    });
    return started as SprintRow;
  });
  return toSprint(row as SprintRow);
}

/** Where unfinished issues go: the backlog (null), the next future sprint, or a chosen one. */
async function carryOverTarget(
  tx: SqlExecutor,
  sprint: SprintRow,
  choice: CompleteSprintBody['moveUnfinishedTo'],
): Promise<string | null> {
  if (choice === undefined || choice === 'backlog') return null;
  if (choice === 'next') {
    const [next] = await tx<{ id: string }[]>`
      select id from sprints where project_id = ${sprint.project_id} and state = 'future'
      order by starts_at nulls last, id limit 1`;
    if (!next) throw new ValidationError('There is no future sprint to move unfinished work to');
    return next.id;
  }
  const [target] = await tx<{ id: string; project_id: string; state: string }[]>`
    select id, project_id, state from sprints where id = ${choice}`;
  if (!target || target.project_id !== sprint.project_id || target.id === sprint.id) {
    throw new ValidationError('Unfinished work can move only to another sprint of this project');
  }
  if (target.state !== 'future') throw new ValidationError('That sprint has already started');
  return target.id;
}

export async function completeSprint(
  deps: PlanningDeps,
  ctx: RequestContext,
  id: string,
  input: CompleteSprintBody,
): Promise<Sprint> {
  const body = completeSprintBodySchema.parse(input);
  const sql = requireDatabase(deps);
  const found = await loadSprint(sql, id);
  await ctx.authz.authorize(ctx.actor, 'work.sprint.manage', projectResource(found.project_id));
  const row = await sql.begin(async (tx) => {
    await lockProject(tx, found.project_id);
    const sprint = await loadSprint(tx, id, { lock: true });
    if (sprint.state !== 'active') throw new ConflictError(`${sprint.name} is not active`);
    const target = await carryOverTarget(tx, sprint, body.moveUnfinishedTo);
    const boards = await projectBoards(tx, sprint.project_id);
    const config = boards[0] ? parseConfig(boards[0].config) : null;
    const { done } = await statusSets(tx, sprint.project_id, config);
    const issues = await sprintIssues(tx, id);
    const [commitment] = await tx<{ data: Commitment }[]>`
      select data from sprint_metrics
      where scope_kind = 'sprint' and scope_id = ${id} and kind = 'commitment'`;
    const snapshot = completionSnapshot(issues, done, commitment?.data ?? null, target);
    const unfinished = issues.filter((issue) => !done.has(issue.statusId));
    const actorId = actorUserId(ctx);
    for (const issue of unfinished) {
      await tx`update issues set sprint_id = ${target}, updated_at = now()
        where id = ${issue.issueId}`;
      await recordHistory(tx, issue.issueId, actorId, [
        { field: 'sprintId', from: id, to: target },
      ]);
    }
    const [closed] = await tx<SprintRow[]>`
      update sprints set state = 'closed', closed_at = now(),
        completed_snapshot = ${JSON.stringify(snapshot)}::jsonb, updated_at = now()
      where id = ${id}
      returning ${tx.unsafe(SPRINT_COLUMNS)}`;
    await writeMetric(tx, id, 'completion', snapshot);
    await audit(deps, ctx, tx, {
      action: 'sprint.completed',
      target: { kind: 'sprint', id },
      before: toSprint(sprint),
      after: toSprint(closed as SprintRow),
    });
    await publishPlanningChange(deps, tx, sprint.project_id, {
      boardIds: boards.map((board) => board.id),
      sprintIds: target ? [id, target] : [id],
    });
    return closed as SprintRow;
  });
  return toSprint(row as SprintRow);
}
