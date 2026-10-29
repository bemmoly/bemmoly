import type { SqlClient } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { DeployRuntime } from '../../../../shared/common.ts';
import type { FrontDoorRow, RuntimeMoveRow } from '../../models/front-doors.ts';
import type { DeployVariable } from '../providers/contract.ts';
import type { FrontDoorBackend } from '../providers/front-door-contract.ts';
import { enabledDoor, writeRoute } from '../front-doors/routing.ts';
import { RUNTIME_NAMES } from '../runtimes/fit.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { resolveTarget, type ResolvedTarget } from '../shipping/targets.ts';

/*
 * The moves a runtime move makes, each a front door write (when it needs one) followed by one
 * recorded change. A step holds the row busy for a short lease, so a person's Pause or Roll
 * back never runs at the same moment as the engine's next step; a write clears the lease.
 */

export interface MoveEngineDeps {
  sql: SqlClient;
  providers: ProviderSourceOrRegistry;
  now: () => Date;
  /** Wakes the engine for a move at a time; without it the minute sweep does. */
  wake?: (id: string, at: Date) => Promise<void>;
  variables?: (applicationId: string, environmentId: string) => Promise<DeployVariable[]>;
}

export const LIVE_STATES = ['deploying', 'warming', 'shifting', 'holding'] as const;
const LEASE_MS = 2 * 60_000;

export interface Sides {
  from: ResolvedTarget;
  to: ResolvedTarget;
  door: FrontDoorRow;
}

export interface MoveChange {
  state: string;
  message: string | null;
  percent?: number;
  stepIndex?: number;
  stepStartedAt?: Date;
  nextActionAt: Date | null;
  failing?: number;
  waited?: number;
  pausedState?: string | null;
  toRevision?: string;
  finished?: boolean;
}

export const runtimeName = (runtime: string) => RUNTIME_NAMES[runtime as DeployRuntime];

export function createMoveSteps(deps: MoveEngineDeps) {
  const { sql } = deps;

  /** Takes the row for one step, if no one else holds it and it is in one of `states`. */
  async function claim(
    id: string,
    states: readonly string[],
    now: Date,
    due = false,
  ): Promise<RuntimeMoveRow | null> {
    const stamp = now.toISOString();
    const [row] = await sql<RuntimeMoveRow[]>`
      update pipeline_runtime_moves
      set busy_until = ${new Date(now.getTime() + LEASE_MS).toISOString()}::timestamptz
      where id = ${id} and state = any(${[...states]}::text[])
        and (busy_until is null or busy_until < ${stamp}::timestamptz)
        and (${!due} or next_action_at <= ${stamp}::timestamptz)
      returning *`;
    return row ?? null;
  }

  async function write(row: RuntimeMoveRow, change: MoveChange, now: Date): Promise<void> {
    const at = (value: Date | null | undefined) => (value ? value.toISOString() : null);
    await sql`
      update pipeline_runtime_moves set
        state = ${change.state},
        message = ${change.message},
        traffic_percent = coalesce(${change.percent ?? null}::int, traffic_percent),
        step_index = coalesce(${change.stepIndex ?? null}::int, step_index),
        step_started_at = coalesce(${at(change.stepStartedAt)}::timestamptz, step_started_at),
        next_action_at = ${at(change.nextActionAt)}::timestamptz,
        failing_samples = coalesce(${change.failing ?? null}::int, failing_samples),
        waited_samples = coalesce(${change.waited ?? null}::int, waited_samples),
        paused_state = case when ${change.pausedState !== undefined}
          then ${change.pausedState ?? null} else paused_state end,
        to_revision = coalesce(${change.toRevision ?? null}, to_revision),
        finished_at = case when ${Boolean(change.finished)}
          then ${now.toISOString()}::timestamptz else finished_at end,
        busy_until = null,
        updated_at = ${now.toISOString()}::timestamptz
      where id = ${row.id}`;
    if (change.nextActionAt) await deps.wake?.(row.id, change.nextActionAt);
  }

  /** Lets go of a row a step claimed but did not change. */
  const release = async (row: RuntimeMoveRow) => {
    await sql`update pipeline_runtime_moves set busy_until = null where id = ${row.id}`;
  };

  async function sides(row: RuntimeMoveRow): Promise<Sides> {
    const resolve = (runtime: string) =>
      resolveTarget(sql, deps.providers, row.application_id, row.environment_id, {
        runtime: runtime as DeployRuntime,
        frontDoor: false,
      });
    const door = await enabledDoor(sql, row.environment_id);
    if (!door) throw new ProviderError('The environment has no front door any more');
    return { from: await resolve(row.from_runtime), to: await resolve(row.to_runtime), door };
  }

  const byRevision = (side: ResolvedTarget) =>
    Boolean(
      side.provider.frontDoor?.routesRevisions.includes(
        side.target.placement?.runtime ?? 'cloud-run',
      ),
    );

  const share = (side: ResolvedTarget, revision: string | null, percent: number) => ({
    target: side.target,
    revision: byRevision(side) ? revision : null,
    percent,
  });

  /** `percent` on the new runtime and the rest on the old; both kept, even at 0. */
  async function split(row: RuntimeMoveRow, s: Sides, percent: number): Promise<void> {
    const backends: FrontDoorBackend[] = [
      share(s.to, row.to_revision, percent),
      share(s.from, row.from_revision, 100 - percent),
    ];
    await writeRoute(sql, s.to.provider, s.door, backends);
  }

  async function pause(row: RuntimeMoveRow, reason: string, now: Date): Promise<void> {
    await write(
      row,
      { state: 'paused', pausedState: row.state, message: reason, nextActionAt: null },
      now,
    );
  }

  /** Every request back on the old runtime, then the new runtime's revision removed. */
  async function rollBack(row: RuntimeMoveRow, s: Sides, reason: string, now: Date) {
    await writeRoute(sql, s.from.provider, s.door, [share(s.from, row.from_revision, 100)]);
    if (row.to_revision) await s.to.provider.frontDoor?.leave(s.to.target);
    await write(
      row,
      {
        state: 'rolled_back',
        message: reason,
        percent: 0,
        pausedState: null,
        nextActionAt: null,
        finished: true,
      },
      now,
    );
  }

  /** The new runtime alone in the front door, the old one left, and the choice recorded. */
  async function finish(row: RuntimeMoveRow, s: Sides, now: Date) {
    await writeRoute(sql, s.to.provider, s.door, [share(s.to, row.to_revision, 100)]);
    await s.from.provider.frontDoor?.leave(s.from.target);
    await sql.begin(async (tx) => {
      if (row.follows_default) {
        await tx`delete from pipeline_application_runtimes
          where application_id = ${row.application_id} and environment_id = ${row.environment_id}`;
      } else {
        await tx`
          insert into pipeline_application_runtimes (application_id, environment_id, runtime, set_by)
          values (${row.application_id}, ${row.environment_id}, ${row.to_runtime},
            ${row.started_by ?? row.requested_by})
          on conflict (application_id, environment_id) do update set
            runtime = excluded.runtime, set_by = excluded.set_by, updated_at = now()`;
      }
      // The release's last deploy now runs as the moved revision: the next deploy's canary
      // compares against it, and a roll back returns to it.
      await tx`
        update pipeline_deployments set revision = ${row.to_revision}
        where id = (
          select d.id from pipeline_deployments d
          join pipeline_current c on c.application_id = d.application_id
            and c.environment_id = d.environment_id and c.release_id = d.release_id
          where d.application_id = ${row.application_id} and d.environment_id = ${row.environment_id}
            and d.state = 'succeeded'
          order by d.finished_at desc nulls last limit 1)`;
    });
    await write(
      row,
      {
        state: 'succeeded',
        message: `Every request runs on ${runtimeName(row.to_runtime)}, and ${runtimeName(row.from_runtime)} was removed`,
        percent: 100,
        nextActionAt: null,
        finished: true,
      },
      now,
    );
  }

  return { claim, write, release, sides, byRevision, split, pause, rollBack, finish };
}

export type MoveSteps = ReturnType<typeof createMoveSteps>;
