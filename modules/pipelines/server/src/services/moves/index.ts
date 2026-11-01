import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ProviderError } from '@bemmoly/shared';
import type { RuntimeMove, RuntimeMovesResponse } from '../../../../shared/moves.ts';
import type { RuntimeMoveRow } from '../../models/front-doors.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { routeOf } from '../front-doors/routing.ts';
import type { DeployVariable } from '../providers/contract.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { createMoveEngine } from './engine.ts';
import { LIVE_STATES, runtimeName, type Sides } from './moves.ts';
import { presentMove, requireMove, selectMoves } from './present.ts';

export { cancelPlanned, planMove } from './plan.ts';

/*
 * Runtime moves behind /api/v1/pipelines/runtime-moves: read a plan, then Start, Pause,
 * Continue or Roll back. Starting and continuing need the right to manage the application in
 * that environment; rolling back needs the right to roll back there. A move waits for any
 * deployment under way, and each action takes one step at once so the screen shows it.
 */

export interface MovesServiceDeps extends PipelinesServiceDeps {
  providers: ProviderSourceOrRegistry;
  now?: () => Date;
  wakeMove?: (id: string, at: Date) => Promise<void>;
  variables?: (applicationId: string, environmentId: string) => Promise<DeployVariable[]>;
}

const LIVE_DEPLOYMENTS = ['pending', 'deploying', 'canary', 'waiting'];

export function createMovesService(deps: MovesServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const sql = () => requireDatabase(deps);
  const engine = deps.database
    ? createMoveEngine({
        sql: deps.database,
        providers: deps.providers,
        now,
        ...(deps.wakeMove ? { wake: deps.wakeMove } : {}),
        ...(deps.variables ? { variables: deps.variables } : {}),
      })
    : null;
  const requireEngine = () => {
    if (!engine) throw new ProviderError('Runtime moves need the database');
    return engine;
  };
  const registry = async () =>
    typeof deps.providers === 'function' ? deps.providers() : deps.providers;

  async function read(id: string): Promise<RuntimeMove> {
    return presentMove(await requireMove(sql(), id), await registry());
  }

  async function authorize(
    ctx: RequestContext,
    row: RuntimeMoveRow,
    action: 'manage' | 'rollback',
  ) {
    await requireAccess(deps).authorizeAction(
      ctx,
      action,
      { application: row.application_id, environment: row.environment_id },
      { record: true },
    );
  }

  async function claimed(id: string, states: readonly string[]) {
    const row = await requireEngine().steps.claim(id, states, now());
    if (!row) {
      throw new ConflictError(
        'The move is not in a state for that, or is taking a step. Look again',
      );
    }
    return row;
  }

  /** What the old runtime serves from now: the revision the judge compares against. */
  async function servingRevision(row: RuntimeMoveRow, s: Sides): Promise<string | null> {
    if (requireEngine().steps.byRevision(s.from)) {
      const route = await routeOf(sql(), s.door.id, row.application_id);
      const heaviest = [...(route?.backends ?? [])].sort((a, b) => b.percent - a.percent)[0];
      return heaviest?.revision ?? null;
    }
    const live = await s.from.provider.targets?.describe(s.from.target).catch(() => null);
    return live?.traffic[0]?.revision ?? null;
  }

  /** A few steps at once while they are due, so Start shows the first share moving. */
  async function settle(id: string) {
    for (let i = 0; i < 3; i += 1) await requireEngine().advance(id);
  }

  return {
    engine,

    async list(
      ctx: RequestContext,
      query: { application: string; environment?: string | undefined },
    ): Promise<RuntimeMovesResponse> {
      await authorizePipelines(ctx);
      const rows = await selectMoves(sql(), query);
      const providers = await registry();
      return { items: rows.map((row) => presentMove(row, providers)) };
    },

    async get(ctx: RequestContext, id: string): Promise<RuntimeMove> {
      await authorizePipelines(ctx);
      return read(id);
    },

    async start(ctx: RequestContext, id: string): Promise<RuntimeMove> {
      const db = sql();
      const planned = await requireMove(db, id);
      await authorize(ctx, planned, 'manage');
      const [deploying] = await db<{ id: string }[]>`
        select id from pipeline_deployments
        where application_id = ${planned.application_id}
          and environment_id = ${planned.environment_id}
          and state = any(${LIVE_DEPLOYMENTS}::text[])`;
      if (deploying) {
        throw new ConflictError(
          `A deployment of ${planned.application_key} is under way in ${planned.environment_key}. Start the move once it finishes`,
        );
      }
      const row = await claimed(id, ['planned']);
      const steps = requireEngine().steps;
      try {
        const s = await steps.sides(row);
        const [current] = await db<{ release_id: string | null }[]>`
          select release_id from pipeline_current
          where application_id = ${row.application_id} and environment_id = ${row.environment_id}`;
        const releaseId = current?.release_id ?? row.release_id;
        if (!releaseId) {
          throw new ConflictError(
            `${planned.application_key} has nothing released in ${planned.environment_key} to move`,
          );
        }
        const at = now().toISOString();
        await db`
          update pipeline_runtime_moves set state = 'deploying', release_id = ${releaseId},
            from_revision = ${await servingRevision(row, s)}, started_by = ${personOf(ctx.actor)},
            message = ${`Deploying on ${runtimeName(row.to_runtime)}`},
            step_started_at = ${at}::timestamptz, next_action_at = ${at}::timestamptz,
            busy_until = null, updated_at = ${at}::timestamptz
          where id = ${id}`;
      } catch (error) {
        await steps.release(row);
        throw error;
      }
      await settle(id);
      return read(id);
    },

    async pause(ctx: RequestContext, id: string): Promise<RuntimeMove> {
      await authorize(ctx, await requireMove(sql(), id), 'manage');
      const row = await claimed(id, LIVE_STATES);
      await requireEngine().steps.pause(row, 'Paused by hand', now());
      return read(id);
    },

    async resume(ctx: RequestContext, id: string): Promise<RuntimeMove> {
      await authorize(ctx, await requireMove(sql(), id), 'manage');
      const row = await claimed(id, ['paused']);
      const at = now();
      await requireEngine().steps.write(
        row,
        {
          state: row.paused_state ?? 'shifting',
          message: 'Continued by hand',
          pausedState: null,
          failing: 0,
          waited: 0,
          stepStartedAt: at,
          nextActionAt: at,
        },
        at,
      );
      await settle(id);
      return read(id);
    },

    async rollback(ctx: RequestContext, id: string, reason?: string): Promise<RuntimeMove> {
      await authorize(ctx, await requireMove(sql(), id), 'rollback');
      const steps = requireEngine().steps;
      const row = await claimed(id, ['planned', 'paused', ...LIVE_STATES]);
      const at = now();
      if (row.state === 'planned') {
        const message = reason || 'Cancelled before it started';
        await steps.write(
          row,
          { state: 'cancelled', message, nextActionAt: null, finished: true },
          at,
        );
        return read(id);
      }
      try {
        await steps.rollBack(row, await steps.sides(row), reason || 'Rolled back by hand', at);
      } catch (error) {
        await steps.release(row);
        throw error;
      }
      return read(id);
    },
  };
}

export type MovesService = ReturnType<typeof createMovesService>;
