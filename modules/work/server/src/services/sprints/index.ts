import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ValidationError } from '@bemmoly/shared';
import {
  createSprintBodySchema,
  type CompleteSprintBody,
  type CreateSprintBody,
  type ListSprintsQuery,
  type Sprint,
  type StartSprintBody,
  type UpdateSprintBody,
} from '../../../../shared/sprints.ts';
import {
  audit,
  publishPlanningChange,
  resolveProject,
  type PlanningDeps,
} from '../boards/context.ts';
import { recordHistory } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase } from '../issues/deps.ts';
import { completeSprint, startSprint } from './lifecycle.ts';
import { loadSprint, SPRINT_COLUMNS, toSprint, type SprintRow } from './rows.ts';

/** Sprints of a Scrum project: plan, edit, start, close, and drop a future one. */
export function createSprintsService(deps: PlanningDeps) {
  const manage = (ctx: RequestContext, projectId: string) =>
    ctx.authz.authorize(ctx.actor, 'work.sprint.manage', projectResource(projectId));

  return {
    async list(
      ctx: RequestContext,
      projectRef: string,
      query: ListSprintsQuery,
    ): Promise<Sprint[]> {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, projectRef);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const rows = await sql<SprintRow[]>`
        select ${sql.unsafe(SPRINT_COLUMNS)} from sprints
        where project_id = ${project.id}
          and (${query.state ?? null}::text is null or state = ${query.state ?? null})
        order by array_position(array['active', 'future', 'closed'], state),
          coalesce(closed_at, starts_at) desc nulls last, id`;
      return rows.map(toSprint);
    },

    async get(ctx: RequestContext, id: string): Promise<Sprint> {
      const row = await loadSprint(requireDatabase(deps), id);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
      return toSprint(row);
    },

    async create(
      ctx: RequestContext,
      projectRef: string,
      input: CreateSprintBody,
    ): Promise<Sprint> {
      const body = createSprintBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, projectRef);
      await manage(ctx, project.id);
      const row = await sql.begin(async (tx) => {
        const [created] = await tx<SprintRow[]>`
          insert into sprints (project_id, name, goal, starts_at, ends_at, capacity_points)
          values (${project.id}, ${body.name}, ${body.goal ?? null}, ${body.startsAt},
            ${body.endsAt}, ${body.capacityPoints ?? null})
          returning ${tx.unsafe(SPRINT_COLUMNS)}`;
        const sprint = toSprint(created as SprintRow);
        await audit(deps, ctx, tx, {
          action: 'sprint.created',
          target: { kind: 'sprint', id: sprint.id },
          after: sprint,
        });
        await publishPlanningChange(deps, tx, project.id, { sprintIds: [sprint.id] });
        return created as SprintRow;
      });
      return toSprint(row as SprintRow);
    },

    /** Name, goal, dates and capacity; a closed sprint is history and stays as it was. */
    async update(ctx: RequestContext, id: string, body: UpdateSprintBody): Promise<Sprint> {
      const sql = requireDatabase(deps);
      const found = await loadSprint(sql, id);
      await manage(ctx, found.project_id);
      const row = await sql.begin(async (tx) => {
        const current = await loadSprint(tx, id, { lock: true });
        if (current.state === 'closed') throw new ConflictError('A closed sprint cannot change');
        const before = toSprint(current);
        const startsAt = body.startsAt === undefined ? before.startsAt : body.startsAt;
        const endsAt = body.endsAt === undefined ? before.endsAt : body.endsAt;
        if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
          throw new ValidationError('A sprint ends after it starts', {
            details: { path: 'endsAt' },
          });
        }
        const [updated] = await tx<SprintRow[]>`
          update sprints set name = ${body.name ?? before.name},
            goal = ${body.goal === undefined ? before.goal : body.goal},
            starts_at = ${startsAt}, ends_at = ${endsAt},
            capacity_points = ${body.capacityPoints === undefined ? before.capacityPoints : body.capacityPoints},
            updated_at = now()
          where id = ${id}
          returning ${tx.unsafe(SPRINT_COLUMNS)}`;
        await audit(deps, ctx, tx, {
          action: 'sprint.updated',
          target: { kind: 'sprint', id },
          before,
          after: toSprint(updated as SprintRow),
        });
        await publishPlanningChange(deps, tx, current.project_id, { sprintIds: [id] });
        return updated as SprintRow;
      });
      return toSprint(row as SprintRow);
    },

    /** Drops a sprint that has not started; its issues return to the backlog. */
    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const found = await loadSprint(sql, id);
      await manage(ctx, found.project_id);
      await sql.begin(async (tx) => {
        const current = await loadSprint(tx, id, { lock: true });
        if (current.state !== 'future') {
          throw new ConflictError('Only a sprint that has not started can be deleted');
        }
        const moved = await tx<{ id: string }[]>`
          update issues set sprint_id = null, updated_at = now()
          where sprint_id = ${id} returning id`;
        for (const issue of moved) {
          await recordHistory(tx, issue.id, actorUserId(ctx), [
            { field: 'sprintId', from: id, to: null },
          ]);
        }
        await tx`delete from sprint_metrics where scope_kind = 'sprint' and scope_id = ${id}`;
        await tx`delete from sprints where id = ${id}`;
        await audit(deps, ctx, tx, {
          action: 'sprint.deleted',
          target: { kind: 'sprint', id },
          before: toSprint(current),
        });
        await publishPlanningChange(deps, tx, current.project_id, { sprintIds: [id] });
      });
    },

    start: (ctx: RequestContext, id: string, body: StartSprintBody) =>
      startSprint(deps, ctx, id, body),
    complete: (ctx: RequestContext, id: string, body: CompleteSprintBody) =>
      completeSprint(deps, ctx, id, body),
  };
}

export type SprintsService = ReturnType<typeof createSprintsService>;
