import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { ApplicationRef } from '../../../../shared/catalog.ts';
import type { CurrentState, GlyphState, Tier } from '../../../../shared/common.ts';
import type { EnvironmentStrip, EnvironmentStripItem } from '../../../../shared/deployments.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { StripRecord } from '../../models/delivery.ts';
import { isoOrNull } from '../../utils/time.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';

const GLYPH: Record<CurrentState, GlyphState> = {
  idle: 'passed',
  deploying: 'running',
  canary: 'running',
  waiting: 'waiting',
  failed: 'failed',
  rolled_back: 'rolled_back',
};

/** "Prod · us-east1" waits for the region that has the same release in canary first. */
function nextWave(item: StripRecord, all: readonly StripRecord[]) {
  if (item.state !== 'waiting' || !item.moving_release_id) return null;
  const ahead = all.find(
    (other) =>
      other !== item &&
      other.environment_class === item.environment_class &&
      other.moving_release_id === item.moving_release_id &&
      (other.state === 'canary' || other.state === 'deploying'),
  );
  if (!ahead) return null;
  return { wave: 2, after: ahead.region?.split('-')[0] ?? ahead.environment_name };
}

function toItem(row: StripRecord, all: readonly StripRecord[]): EnvironmentStripItem {
  const state = (row.state ?? 'idle') as CurrentState;
  const wave = nextWave(row, all);
  const environment: EnvironmentRef = {
    id: row.environment_id,
    key: row.environment_key,
    name: row.environment_name,
    class: row.environment_class as EnvironmentRef['class'],
  };
  return {
    environment,
    protected: row.protection['protected'] === true,
    version: row.version,
    releaseId: row.release_id,
    deploymentId: row.deployment_id,
    commitSha: row.commit_sha,
    // Waiting for an earlier wave is queued, not waiting on a person.
    glyph: !row.version && !row.moving_version ? 'queued' : wave ? 'queued' : GLYPH[state],
    state,
    trafficPercent: row.traffic_percent ?? 0,
    movingVersion: row.moving_version,
    previousVersion: row.previous_version,
    deployedAt: isoOrNull(row.deployed_at),
    healthySince: state === 'idle' ? isoOrNull(row.deployed_at) : null,
    nextWave: wave,
  };
}

/**
 * One application across its path: the version in every environment, what is moving, and
 * what ran there before (for Roll back). Environments come from the application's tier path,
 * or every environment when the tier has none.
 */
export function createStripService(deps: PipelinesServiceDeps) {
  return {
    async get(ctx: RequestContext, key: string): Promise<EnvironmentStrip> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const [application] = await sql<(ApplicationRef & { id: string })[]>`
        select id, key, name, tier from pipeline_applications where key = ${key}`;
      if (!application) throw new NotFoundError(`No application called "${key}"`);
      const rows = await sql<StripRecord[]>`
        with path as (
          select s.environment_id, min(s.stage) as stage
          from pipeline_environment_paths p
          join pipeline_environment_path_steps s on s.path_id = p.id
          where p.tier = ${application.tier}
          group by s.environment_id),
        shown as (
          select e.* from pipeline_environments e
          where e.archived_at is null
            and (not exists (select 1 from path) or e.id in (select environment_id from path)))
        select e.id as environment_id, e.key as environment_key, e.name as environment_name,
          e.class as environment_class, e.region, e.protection,
          c.release_id, c.version, r.commit_sha, c.state, c.traffic_percent,
          c.moving_release_id, c.moving_version, c.deployment_id, c.deployed_at,
          coalesce(pr.version, (
            select r2.version from pipeline_deployments d2
            join pipeline_releases r2 on r2.id = d2.release_id
            where d2.application_id = ${application.id}::uuid and d2.environment_id = e.id
              and d2.state = 'succeeded' and d2.release_id is distinct from c.release_id
            order by d2.created_at desc limit 1)) as previous_version
        from shown e
        left join pipeline_current c
          on c.environment_id = e.id and c.application_id = ${application.id}::uuid
        left join pipeline_releases r on r.id = c.release_id
        left join pipeline_deployments d on d.id = c.deployment_id
        left join pipeline_releases pr on pr.id = d.previous_release_id
        left join path on path.environment_id = e.id
        order by path.stage nulls last, e.position, e.id`;
      return {
        application: {
          id: application.id,
          key: application.key,
          name: application.name,
          tier: application.tier as Tier,
        },
        items: rows.map((row) => toItem(row, rows)),
      };
    },
  };
}

export type StripService = ReturnType<typeof createStripService>;
