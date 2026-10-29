import type { SettingsRegistry, SqlExecutor } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type { DeployRuntime } from '../../../../shared/common.ts';
import { SHIPPING_DEFAULTS } from '../../config/shipping-settings.ts';

/*
 * Planning a move: what a switch on the runtime card writes where a front door serves the
 * application. A plan takes no traffic until someone starts it; switching again replaces
 * it, and switching back to where it runs cancels it. Its steps are 10, 50 and 100 percent,
 * each held as long as a Prod canary step, sampled as often.
 */

export const MOVE_STEPS = [10, 50, 100] as const;

type Settings = Pick<SettingsRegistry, 'get'> | undefined;

async function setting(settings: Settings, key: string, fallback: number): Promise<number> {
  try {
    const value = await settings?.get(key as never);
    return typeof value === 'number' ? value : fallback;
  } catch {
    return fallback;
  }
}

export interface PlanInput {
  applicationId: string;
  environmentId: string;
  from: DeployRuntime;
  to: DeployRuntime;
  /** Chosen as "Default": once moved, the application follows the defaults again. */
  followsDefault: boolean;
  person: string | null;
}

export async function planMove(sql: SqlExecutor, settings: Settings, input: PlanInput) {
  const hold = await setting(
    settings,
    'pipelines.rollout.holdMinutes',
    SHIPPING_DEFAULTS.holdMinutes,
  );
  const sample = await setting(
    settings,
    'pipelines.rollout.sampleSeconds',
    SHIPPING_DEFAULTS.sampleSeconds,
  );
  const [open] = await sql<{ id: string; state: string }[]>`
    select id, state from pipeline_runtime_moves
    where application_id = ${input.applicationId} and environment_id = ${input.environmentId}
      and state in ('planned', 'deploying', 'warming', 'shifting', 'holding', 'paused')`;
  if (open && open.state !== 'planned') {
    throw new ConflictError(
      'A runtime move is under way here. Let it finish or roll it back, then switch again',
    );
  }
  const [current] = await sql<{ release_id: string | null }[]>`
    select release_id from pipeline_current
    where application_id = ${input.applicationId} and environment_id = ${input.environmentId}`;
  if (open) {
    await sql`
      update pipeline_runtime_moves set from_runtime = ${input.from}, to_runtime = ${input.to},
        follows_default = ${input.followsDefault}, release_id = ${current?.release_id ?? null},
        requested_by = ${input.person}, hold_minutes = ${hold}, sample_seconds = ${sample},
        updated_at = now()
      where id = ${open.id}`;
    return;
  }
  await sql`
    insert into pipeline_runtime_moves
      (application_id, environment_id, release_id, from_runtime, to_runtime, follows_default,
       steps, hold_minutes, sample_seconds, requested_by)
    values (${input.applicationId}, ${input.environmentId}, ${current?.release_id ?? null},
      ${input.from}, ${input.to}, ${input.followsDefault}, ${JSON.stringify(MOVE_STEPS)}::jsonb,
      ${hold}, ${sample}, ${input.person})`;
}

/** A plan nobody started, dropped because the runtime was switched back. */
export async function cancelPlanned(
  sql: SqlExecutor,
  applicationId: string,
  environmentId: string,
) {
  await sql`
    update pipeline_runtime_moves set state = 'cancelled', finished_at = now(), updated_at = now(),
      message = 'Switched back before it started'
    where application_id = ${applicationId} and environment_id = ${environmentId}
      and state = 'planned'`;
}
