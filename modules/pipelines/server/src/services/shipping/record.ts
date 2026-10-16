import type { SqlExecutor } from '@bemmoly/core';
import type { CurrentState, DeploymentState } from '../../../../shared/common.ts';
import { topicOf } from '../../../../shared/streams.ts';
import { publishStreamEvent } from '../streams/publish.ts';

/*
 * The one way a deployment changes state (architecture §18): the deployment row, an
 * append-only event and pipeline_current move together in the caller's transaction, so the
 * Release map, rewind and the deployment page never disagree. The event carries what was
 * current and what was moving, so rewind needs nothing but the events. Live viewers are told
 * in the same transaction and refetch after it commits.
 */

export interface DeploymentChange {
  state: DeploymentState;
  message: string;
  traffic?: number;
  phase?: 'deploy' | 'step' | 'watch' | 'paused' | 'done';
  revision?: string;
  stepIndex?: number;
  stepStartedAt?: Date | null;
  nextActionAt?: Date | null;
  failingSamples?: number;
  pauseReason?: string | null;
  reason?: string | null;
  plan?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

interface Updated {
  id: string;
  application_id: string;
  application_key: string;
  domain_id: string;
  domain_key: string;
  group_id: string;
  group_key: string;
  environment_id: string;
  environment_key: string;
  environment_class: string;
  kind: string;
  release_id: string;
  version: string;
  previous_release_id: string | null;
  previous_version: string | null;
  traffic_percent: number;
  started_by: string | null;
}

const TERMINAL = new Set<DeploymentState>(['succeeded', 'failed', 'rolled_back', 'cancelled']);

function currentOf(state: DeploymentState): CurrentState {
  if (state === 'pending' || state === 'deploying') return 'deploying';
  if (state === 'succeeded' || state === 'cancelled') return 'idle';
  return state;
}

export async function recordDeploymentEvent(
  tx: SqlExecutor,
  deploymentId: string,
  change: DeploymentChange,
  now: Date,
): Promise<void> {
  const at = now.toISOString();
  const has = (key: keyof DeploymentChange) => change[key] !== undefined;
  const opt = (value: Date | null | undefined) => (value ? value.toISOString() : null);
  const [row] = await tx<Updated[]>`
    with changed as (
      update pipeline_deployments set
        state = ${change.state},
        traffic_percent = coalesce(${change.traffic ?? null}::smallint, traffic_percent),
        phase = coalesce(${change.phase ?? null}, phase),
        revision = coalesce(${change.revision ?? null}, revision),
        step_index = coalesce(${change.stepIndex ?? null}::int, step_index),
        step_started_at = case when ${has('stepStartedAt')} then ${opt(change.stepStartedAt)}::timestamptz else step_started_at end,
        next_action_at = case when ${has('nextActionAt')} then ${opt(change.nextActionAt)}::timestamptz else next_action_at end,
        failing_samples = coalesce(${change.failingSamples ?? null}::int, failing_samples),
        pause_reason = case when ${has('pauseReason')} then ${change.pauseReason ?? null} else pause_reason end,
        reason = case when ${has('reason')} then ${change.reason ?? null} else reason end,
        plan = case when ${has('plan')} then ${JSON.stringify(change.plan ?? {})}::jsonb else plan end,
        started_at = coalesce(started_at, ${at}::timestamptz),
        finished_at = case when ${TERMINAL.has(change.state)} then ${at}::timestamptz else null end,
        updated_at = ${at}::timestamptz
      where id = ${deploymentId}
      returning *
    )
    select d.id, d.application_id, a.key as application_key, a.domain_id, dm.key as domain_key,
      a.group_id, g.key as group_key, d.environment_id, e.key as environment_key,
      e.class as environment_class, d.kind, d.release_id, r.version, d.previous_release_id,
      p.version as previous_version, d.traffic_percent, d.started_by
    from changed d
    join pipeline_applications a on a.id = d.application_id
    join pipeline_domains dm on dm.id = a.domain_id
    join pipeline_groups g on g.id = a.group_id
    join pipeline_environments e on e.id = d.environment_id
    join pipeline_releases r on r.id = d.release_id
    left join pipeline_releases p on p.id = d.previous_release_id`;
  if (!row) throw new Error(`Deployment ${deploymentId} does not exist`);

  const state = currentOf(change.state);
  const landed = change.state === 'succeeded';
  const moving = !TERMINAL.has(change.state);
  const current = landed
    ? { releaseId: row.release_id, version: row.version }
    : row.previous_release_id
      ? { releaseId: row.previous_release_id, version: row.previous_version }
      : null;
  const movingRelease = moving ? { releaseId: row.release_id, version: row.version } : null;
  const traffic = landed ? 100 : moving ? row.traffic_percent : current ? 100 : 0;

  await tx`
    insert into pipeline_deployment_events
      (deployment_id, application_id, environment_id, release_id, state, traffic_percent,
       message, data, occurred_at)
    values (${row.id}, ${row.application_id}, ${row.environment_id}, ${row.release_id},
      ${change.state}, ${row.traffic_percent}, ${change.message},
      ${JSON.stringify({ ...change.data, current, moving: movingRelease, phase: change.phase ?? null })}::jsonb,
      ${at}::timestamptz)`;
  await tx`
    insert into pipeline_current
      (application_id, environment_id, domain_id, group_id, release_id, version, deployment_id,
       state, moving_release_id, moving_version, traffic_percent, deployed_at, updated_at)
    values (${row.application_id}, ${row.environment_id}, ${row.domain_id}, ${row.group_id},
      ${current?.releaseId ?? null}, ${current?.version ?? null}, ${row.id}, ${state},
      ${movingRelease?.releaseId ?? null}, ${movingRelease?.version ?? null}, ${traffic},
      ${landed ? at : null}::timestamptz, ${at}::timestamptz)
    on conflict (application_id, environment_id) do update set
      release_id = excluded.release_id, version = excluded.version,
      deployment_id = excluded.deployment_id, state = excluded.state,
      moving_release_id = excluded.moving_release_id, moving_version = excluded.moving_version,
      traffic_percent = excluded.traffic_percent,
      deployed_at = coalesce(excluded.deployed_at, pipeline_current.deployed_at),
      domain_id = excluded.domain_id, group_id = excluded.group_id,
      updated_at = excluded.updated_at`;

  if (landed || change.state === 'rolled_back') {
    const rollback = change.state === 'rolled_back' || row.kind === 'rollback';
    const summary = rollback
      ? `Roll back · ${row.application_key} to ${current?.version ?? 'nothing'} in ${row.environment_key}`
      : `Deploy · ${row.application_key} ${row.version} to ${row.environment_key}`;
    await tx`
      insert into pipeline_changes
        (kind, application_id, environment_id, domain_id, group_id, actor_user_id, actor_label,
         summary, detail, ref_kind, ref_id, revertible, occurred_at)
      values (${rollback ? 'rollback' : 'deploy'}, ${row.application_id}, ${row.environment_id},
        ${row.domain_id}, ${row.group_id}, ${row.started_by},
        ${row.started_by ? null : 'Pipelines'}, ${summary}, ${change.reason ?? change.message},
        'deployment', ${row.id}, ${!rollback && row.previous_release_id !== null},
        ${at}::timestamptz)`;
    if (landed) {
      await tx`update pipeline_applications set last_deployed_at = ${at}::timestamptz
        where id = ${row.application_id}`;
    }
  }

  const application = topicOf.application(row.application_key);
  await publishStreamEvent(tx, {
    topic: application,
    kind: 'deployment.updated',
    data: { id: row.id, state: change.state, trafficPercent: row.traffic_percent },
  });
  await publishStreamEvent(tx, {
    topic: application,
    kind: 'current.updated',
    data: { application: row.application_key, environment: row.environment_key, state },
  });
  const scopes: Array<[string, string]> = [
    ['', row.domain_key],
    [row.domain_key, row.group_key],
    [`${row.domain_key}/${row.group_key}`, row.application_key],
  ];
  for (const [scope, cell] of scopes) {
    await publishStreamEvent(tx, {
      topic: topicOf.map(scope),
      kind: 'map.cell',
      data: { cells: [{ row: cell, column: row.environment_key }] },
    });
  }
}
