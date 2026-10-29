import type { RequestContext, SendJobOptions, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type {
  FrontDoor,
  FrontDoorsResponse,
  SetFrontDoorBody,
} from '../../../../shared/front-doors.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { applyFrontDoor } from './apply.ts';
import { selectFrontDoors } from './present.ts';

export { withFrontDoor } from './wrap.ts';

/*
 * Front doors behind /api/v1/pipelines: list them, and turn one on or off per environment
 * with the domain it answers under. A platform admin decides. The cloud work runs as a job;
 * a sweep each minute applies what is pending, retries what failed after a while, and gives
 * a host to each application deployed somewhere a front door serves since it last looked.
 */

export const FRONT_DOOR_APPLY_JOB = 'pipelines.front-door-apply';

export interface FrontDoorsServiceDeps extends PipelinesServiceDeps {
  providers: ProviderSourceOrRegistry;
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
}

const RETRY_FAILED = "interval '10 minutes'";

/** A new Prod environment gets a front door from the start; the sweep makes it. */
export async function openFrontDoor(sql: SqlExecutor, environmentId: string, by: string | null) {
  await sql`
    insert into pipeline_front_doors (environment_id, created_by) values (${environmentId}, ${by})
    on conflict (environment_id) do nothing`;
}

export function createFrontDoorsService(deps: FrontDoorsServiceDeps) {
  const sql = () => requireDatabase(deps);

  async function schedule(id: string): Promise<void> {
    if (deps.sendJob) {
      await deps.sendJob(
        FRONT_DOOR_APPLY_JOB,
        { id },
        { idempotencyKey: `front-door:${id}:${Date.now()}` },
      );
    } else await applyFrontDoor(sql(), deps.providers, id);
  }

  return {
    async list(ctx: RequestContext, query: { application?: string | undefined }) {
      await authorizePipelines(ctx);
      return { items: await selectFrontDoors(sql(), query) } satisfies FrontDoorsResponse;
    },

    async set(
      ctx: RequestContext,
      environmentKey: string,
      body: SetFrontDoorBody,
    ): Promise<FrontDoor> {
      await requireAccess(deps).authorizeAction(ctx, 'platform', {
        scope: { kind: 'organisation' },
      });
      const db = sql();
      const [environment] = await db<{ id: string }[]>`
        select id from pipeline_environments where key = ${environmentKey} and archived_at is null`;
      if (!environment) throw new NotFoundError(`No environment is called ${environmentKey}`);
      if (!body.enabled) {
        const [moving] = await db<{ count: number }[]>`
          select count(*)::int as count from pipeline_runtime_moves
          where environment_id = ${environment.id}
            and state in ('deploying', 'warming', 'shifting', 'holding', 'paused')`;
        if ((moving?.count ?? 0) > 0) {
          throw new ConflictError(
            `${moving?.count} applications are moving between runtimes in ${environmentKey}. Let the moves finish or roll them back first`,
          );
        }
        await db`update pipeline_runtime_moves set state = 'cancelled', finished_at = now(),
            message = 'The front door was turned off', updated_at = now()
          where environment_id = ${environment.id} and state = 'planned'`;
      }
      const [door] = await db<{ id: string }[]>`
        insert into pipeline_front_doors (environment_id, enabled, domain, status, created_by)
        values (${environment.id}, ${body.enabled}, ${body.domain}, 'pending', ${personOf(ctx.actor)})
        on conflict (environment_id) do update set enabled = excluded.enabled,
          domain = excluded.domain, status = 'pending', updated_at = now()
        returning id`;
      if (!door) throw new NotFoundError(`No environment is called ${environmentKey}`);
      await schedule(door.id);
      const [shown] = await selectFrontDoors(db, { environment: environmentKey });
      if (!shown) throw new NotFoundError(`No environment is called ${environmentKey}`);
      return shown;
    },

    /** The job's work: one front door made to match its row. */
    apply: (id: string) => applyFrontDoor(sql(), deps.providers, id),

    async sweep(): Promise<number> {
      const due = await sql()<{ id: string }[]>`
        select d.id from pipeline_front_doors d
        join pipeline_environments e on e.id = d.environment_id and e.archived_at is null
        where d.status = 'pending'
          or (d.status = 'failed' and d.updated_at < now() - ${sql().unsafe(RETRY_FAILED)})
          or (d.enabled and d.status = 'ready' and exists (
            select 1 from pipeline_current c
            where c.environment_id = d.environment_id and c.release_id is not null
              and (d.applied_at is null or c.deployed_at > d.applied_at)
              and not exists (
                select 1 from pipeline_front_door_routes r
                where r.front_door_id = d.id and r.application_id = c.application_id)))
        order by d.updated_at limit 20`;
      for (const { id } of due) await applyFrontDoor(sql(), deps.providers, id);
      return due.length;
    },
  };
}

export type FrontDoorsService = ReturnType<typeof createFrontDoorsService>;
