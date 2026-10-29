import { ConflictError } from '@bemmoly/shared';
import type { DeploymentRow } from '../../../models/shipping.ts';
import type { DeployVariable } from '../../providers/contract.ts';
import { LEASE_MS, type ShippingEngineDeps } from '../engine-deps.ts';
import { loadRelease } from '../load.ts';
import { recordDeploymentEvent } from '../record.ts';
import { artifactOf, resolveTarget } from '../targets.ts';
import { createRolloutEngine } from './engine.ts';

/*
 * What a person (or a stopped promotion) does to a deployment: roll it back, or decide on a
 * paused canary. Roll back is one action from anywhere (architecture §11): a live deployment
 * goes back to the revision it replaced; a finished one gets a new roll back deployment to
 * the earlier release, recorded like any other. Roll backs skip gates, freezes and windows.
 */

const LIVE = ['pending', 'deploying', 'canary', 'waiting'];

/** Takes a live deployment away from the engine; null when it is busy or already finished. */
async function hold(deps: ShippingEngineDeps, id: string): Promise<DeploymentRow | null> {
  const lease = new Date(deps.now().getTime() + LEASE_MS).toISOString();
  return deps.sql.begin(async (tx) => {
    const [row] = await tx<DeploymentRow[]>`
      select * from pipeline_deployments where id = ${id} and state = any(${LIVE}::text[])
      for update skip locked`;
    if (!row) return null;
    await tx`update pipeline_deployments set next_action_at = ${lease}::timestamptz where id = ${id}`;
    return row;
  });
}

export async function abortLiveDeployment(
  deps: ShippingEngineDeps,
  id: string,
  reason: string,
): Promise<boolean> {
  const row = await hold(deps, id);
  if (!row) return false;
  await createRolloutEngine(deps).stop(row, reason, false);
  return true;
}

export async function resumeDeployment(
  deps: ShippingEngineDeps,
  row: DeploymentRow,
  decision: 'continue' | 'rollback',
  reason: string,
): Promise<void> {
  if (row.state !== 'waiting')
    throw new ConflictError('Only a paused deployment waits for a decision');
  const held = await hold(deps, row.id);
  if (!held) throw new ConflictError('The deployment is busy; try again in a moment');
  const engine = createRolloutEngine(deps);
  if (decision === 'rollback') await engine.stop(held, reason, false);
  else await engine.resume(held, reason);
}

/** Rolls back a finished deployment by deploying the earlier release's revision again. */
export async function rollbackFinished(
  deps: ShippingEngineDeps,
  row: DeploymentRow,
  input: { toRelease: string | null; reason: string; by: string },
): Promise<string> {
  const { sql } = deps;
  const target = input.toRelease ?? row.previous_release_id;
  if (!target) throw new ConflictError('There is no earlier release here to roll back to');
  const [current] = await sql<{ deployment_id: string | null }[]>`
    select deployment_id from pipeline_current
    where application_id = ${row.application_id} and environment_id = ${row.environment_id}`;
  if (current?.deployment_id !== row.id) {
    throw new ConflictError('A newer deployment runs here now; roll that one back instead');
  }
  const [known] = await sql<{ revision: string; variables: DeployVariable[] | null }[]>`
    select revision, variables from pipeline_deployments
    where application_id = ${row.application_id} and environment_id = ${row.environment_id}
      and release_id = ${target} and state = 'succeeded' and revision is not null
    order by finished_at desc nulls last limit 1`;
  const now = deps.now();
  const plan = {
    steps: [],
    holdMinutes: 0,
    watchMinutes: 0,
    sampleSeconds: 60,
    autoRollback: false,
    checks: [],
  };
  const id = await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string }[]>`
      insert into pipeline_deployments
        (release_id, application_id, environment_id, kind, state, previous_release_id,
         previous_revision, rollback_of_id, started_by, plan, phase, reason)
      values (${target}, ${row.application_id}, ${row.environment_id}, 'rollback', 'pending',
        ${row.release_id}, ${row.revision}, ${row.id}, ${input.by}, ${JSON.stringify(plan)}::jsonb,
        'deploy', ${input.reason})
      returning id`;
    if (!created) throw new Error('The roll back was not recorded');
    await recordDeploymentEvent(tx, created.id, { state: 'deploying', message: input.reason }, now);
    return created.id;
  });
  try {
    const { provider, target: where } = await resolveTarget(
      sql,
      deps.providers,
      row.application_id,
      row.environment_id,
    );
    if (!provider.targets) throw new Error(`${provider.name} cannot deploy yet`);
    const targets = provider.targets;
    const remember = async (variables: DeployVariable[] | null | undefined) => {
      if (!variables) return;
      await sql`update pipeline_deployments set variables = ${JSON.stringify(variables)}::jsonb
        where id = ${id}`;
    };
    const redeploy = async (variables: DeployVariable[] | undefined) => {
      await remember(variables);
      const release = artifactOf(await loadRelease(sql, target));
      const { revision: made } = await targets.deploy(where, release, variables);
      await targets.shift(where, { revision: made, percent: 100, stable: row.revision });
      return made;
    };
    let revision = known?.revision ?? null;
    if (revision) {
      try {
        await targets.rollback(where, revision);
        await remember(known?.variables);
      } catch (error) {
        // The revision is gone: the release goes out again with the variables it ran with.
        if (!known?.variables) throw error;
        revision = await redeploy(known.variables);
      }
    } else {
      revision = await redeploy(await deps.variables?.(row.application_id, row.environment_id));
    }
    await sql.begin((tx) =>
      recordDeploymentEvent(
        tx,
        id,
        { state: 'succeeded', message: input.reason, revision, traffic: 100, phase: 'done' },
        deps.now(),
      ),
    );
    await deps.onRolledBack?.({
      deploymentId: id,
      applicationId: row.application_id,
      environmentId: row.environment_id,
      reason: input.reason,
      automatic: false,
    });
  } catch (error) {
    const message = `The roll back failed: ${(error as Error).message}`;
    await sql.begin((tx) =>
      recordDeploymentEvent(
        tx,
        id,
        { state: 'failed', message, phase: 'done', reason: message },
        deps.now(),
      ),
    );
  }
  return id;
}
