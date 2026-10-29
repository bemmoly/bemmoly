import type { Actor, RequestContext } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  JourneyDetail,
  JourneyKind,
  Journey,
  ListJourneysQuery,
  MyTask,
  StartJourneyBody,
  UpdateJourneyTaskBody,
} from '../../../../shared/journeys.ts';
import {
  authorize,
  can,
  JOURNEYS_CAPABILITY,
  publishChange,
  recordAudit,
  requireDatabase,
  requireDirectory,
  requireUser,
  type PeopleServiceDeps,
} from '../common.ts';
import { JOURNEYS, toJourney, toTask, type JourneyRow, type TaskRow } from './rows.ts';
import { settleJourney, startJourney } from './runs.ts';
import { createJourneyTemplates, templateFor } from './templates.ts';

/** Who started a journey from a kernel event: People itself, not a person. */
const EVENT_ACTOR: Actor = { kind: 'system', id: 'people:journeys' };

/** Onboarding and offboarding: templates, the journeys they start, and the tasks in them. */
export function createJourneysService(deps: PeopleServiceDeps) {
  const templates = createJourneyTemplates(deps);

  async function journeyRow(id: string): Promise<JourneyRow> {
    const sql = requireDatabase(deps);
    const [row] = await sql<JourneyRow[]>`${JOURNEYS(sql)} where j.id = ${id}`;
    if (!row) throw new NotFoundError('That journey does not exist');
    return row;
  }

  /** Journey managers see every journey; others theirs, their reports' and any they work on. */
  async function mayView(ctx: RequestContext, journey: JourneyRow): Promise<boolean> {
    if (await can(ctx, JOURNEYS_CAPABILITY)) return true;
    const me = requireUser(ctx);
    if (journey.user_id === me) return true;
    const sql = requireDatabase(deps);
    const [owned] = await sql`
      select 1 from journey_tasks where journey_id = ${journey.id} and owner_id = ${me} limit 1`;
    if (owned) return true;
    const chain = await requireDirectory(deps).managerChain(journey.user_id);
    return chain.some((manager) => manager.userId === me);
  }

  async function detail(id: string): Promise<JourneyDetail> {
    const sql = requireDatabase(deps);
    const journey = toJourney(await journeyRow(id));
    const tasks = await sql<TaskRow[]>`
      select * from journey_tasks where journey_id = ${id} order by due_date, position`;
    return { ...journey, tasks: tasks.map(toTask) };
  }

  return {
    templates,

    async list(ctx: RequestContext, query: ListJourneysQuery): Promise<Journey[]> {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      const all = await can(ctx, JOURNEYS_CAPABILITY);
      const below = all
        ? []
        : (await requireDirectory(deps).reports(me, { all: true })).map((p) => p.userId);
      const rows = await sql<JourneyRow[]>`
        ${JOURNEYS(sql)}
        where (${query.kind ?? null}::text is null or j.kind = ${query.kind ?? null})
          and (${query.userId ?? null}::uuid is null or j.user_id = ${query.userId ?? null})
          and (${query.open ?? null}::boolean is null or (j.state = 'open') = ${query.open ?? null})
          and (${all} or j.user_id = ${me} or j.user_id = any(${below}::uuid[])
            or exists (select 1 from journey_tasks t where t.journey_id = j.id and t.owner_id = ${me}))
        order by j.anchor_date desc
        limit 200`;
      return rows.map(toJourney);
    },

    async get(ctx: RequestContext, id: string): Promise<JourneyDetail> {
      if (!(await mayView(ctx, await journeyRow(id)))) {
        throw new ForbiddenError('You are not part of this journey');
      }
      return detail(id);
    },

    async start(ctx: RequestContext, body: StartJourneyBody): Promise<JourneyDetail> {
      await authorize(ctx, JOURNEYS_CAPABILITY);
      const person = await requireDirectory(deps).get(body.userId);
      if (!person) throw new ValidationError('That person has no record yet');
      const template = await templates.get(body.templateId);
      const sql = requireDatabase(deps);
      const id = await sql.begin((tx) =>
        startJourney(deps, tx, ctx.actor, {
          person,
          kind: template.kind,
          template,
          anchorDate: body.anchorDate,
        }),
      );
      await publishChange(deps, 'people.journeys', [id]);
      return detail(id);
    },

    /**
     * Starts the matching template's journey when the kernel says someone joined or is
     * leaving. No template, or one already open, starts nothing.
     */
    async startForEvent(
      kind: JourneyKind,
      userId: string,
      anchorDate: string,
    ): Promise<string | null> {
      const sql = requireDatabase(deps);
      const person = await requireDirectory(deps).get(userId);
      if (!person) return null;
      const template = await templateFor(sql, kind, person);
      if (!template) return null;
      const [open] = await sql`
        select 1 from journeys where user_id = ${userId} and kind = ${kind} and state = 'open'`;
      if (open) return null;
      const id = await sql.begin((tx) =>
        startJourney(deps, tx, EVENT_ACTOR, { person, kind, template, anchorDate }),
      );
      await publishChange(deps, 'people.journeys', [id]);
      return id;
    },

    /** The owner ticks a task; journey managers tick or hand any task to someone else. */
    async updateTask(ctx: RequestContext, taskId: string, body: UpdateJourneyTaskBody) {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      const [task] = await sql<TaskRow[]>`select * from journey_tasks where id = ${taskId}`;
      if (!task) throw new NotFoundError('That task does not exist');
      const manager = await can(ctx, JOURNEYS_CAPABILITY);
      if (body.ownerId !== undefined && !manager) {
        throw new ForbiddenError('Only people who run journeys can hand a task on');
      }
      if (body.done !== undefined && !manager && task.owner_id !== me) {
        throw new ForbiddenError('Only the task’s owner can tick it');
      }
      const done = body.done ?? null;
      await sql.begin(async (tx) => {
        const [after] = await tx<TaskRow[]>`
          update journey_tasks set
            owner_id = ${body.ownerId ?? task.owner_id},
            done_at = case when ${done}::boolean is null then done_at
              when ${done}::boolean then coalesce(done_at, now()) end,
            done_by = case when ${done}::boolean is null then done_by
              when ${done}::boolean then coalesce(done_by, ${me}::uuid) end,
            updated_at = now()
          where id = ${taskId}
          returning *`;
        await settleJourney(tx, task.journey_id);
        await recordAudit(
          deps,
          ctx,
          {
            action: 'people.journey_task.updated',
            kind: 'journey_task',
            id: taskId,
            before: toTask(task),
            after: toTask(after!),
          },
          tx,
        );
      });
      await publishChange(deps, 'people.journeys', [task.journey_id]);
      return detail(task.journey_id);
    },

    /** Open tasks waiting on the caller, soonest due first. */
    async myTasks(ctx: RequestContext): Promise<MyTask[]> {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      const rows = await sql<(TaskRow & { journey_user_id: string; kind: JourneyKind })[]>`
        select t.*, j.user_id as journey_user_id, j.kind from journey_tasks t
        join journeys j on j.id = t.journey_id
        where t.owner_id = ${me} and t.done_at is null and j.state = 'open'
        order by t.due_date, t.position
        limit 100`;
      return rows.map((row) => ({
        ...toTask(row),
        journeyUserId: row.journey_user_id,
        kind: row.kind,
      }));
    },
  };
}

export type JourneysService = ReturnType<typeof createJourneysService>;
