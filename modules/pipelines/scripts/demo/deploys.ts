import { insertMany, type Row } from './bulk.ts';
import type { ReleaseInfo } from './history.ts';
import { MINUTE, HOUR, uuidv7 } from './rng.ts';
import { env, type AppInfo, type EnvInfo, type World } from './world.ts';

/*
 * Deployments drawn from the releases: every release to Dev, most to Staging, and about one
 * in six of those to Prod, where asia-south1 goes first through canary steps (5%, 25%, 100%)
 * and us-east1 and eu-west1 follow together 30 minutes later. A few fail, and about one in
 * seventy is rolled back, which restores the previous release as a deployment of its own.
 * Each state change is an event; the latest succeeded deployment is what runs where.
 */

export interface Current {
  releaseId: string;
  version: string;
  deploymentId: string;
  deployedAt: number;
}

export interface DeployResult {
  current: Map<string, Current>;
  /** Prod deployments of the last seven days, for the What changed? timeline. */
  prodChanges: Row[];
}

interface Ctx {
  world: World;
  deployments: Row[];
  events: Row[];
  promotions: Row[];
  current: Map<string, Current>;
  prodChanges: Row[];
  end: number;
}

const keyOf = (app: AppInfo, target: EnvInfo) => `${app.id}/${target.id}`;

function deploy(
  c: Ctx,
  release: ReleaseInfo,
  target: EnvInfo,
  start: number,
  outcome: 'succeeded' | 'failed' | 'rolled_back',
  options: {
    canary?: boolean;
    promotionId?: string;
    wave?: number;
    kind?: string;
    rollbackOf?: string;
  } = {},
): { id: string; finishedAt: number } {
  const { rng } = c.world;
  const id = uuidv7(rng, start);
  const previous = c.current.get(keyOf(release.app, target));
  const steps: [string, number][] = [
    ['pending', 0],
    ['deploying', 0],
  ];
  if (options.canary) steps.push(['canary', 5], ['canary', 25]);
  const stepGap = options.canary ? 10 * MINUTE : rng.int(1, 4) * MINUTE;
  if (outcome === 'succeeded') steps.push(['succeeded', 100]);
  else steps.push([outcome, 0]);
  let at = start;
  steps.forEach(([state, traffic], index) => {
    if (index > 0) at += index === 1 ? 20_000 : stepGap;
    c.events.push({
      deployment_id: id,
      application_id: release.app.id,
      environment_id: target.id,
      release_id: release.id,
      state,
      traffic_percent: traffic,
      message: null,
      data: {},
      occurred_at: new Date(at),
      created_at: new Date(at),
    });
  });
  c.deployments.push({
    id,
    promotion_id: options.promotionId ?? null,
    release_id: release.id,
    application_id: release.app.id,
    environment_id: target.id,
    kind: options.kind ?? 'deploy',
    wave: options.wave ?? 1,
    state: outcome,
    traffic_percent: outcome === 'succeeded' ? 100 : 0,
    revision: `${release.app.key}-${release.version.replace(/\./g, '-')}`,
    previous_release_id: previous?.releaseId ?? null,
    previous_revision: null,
    rollback_of_id: options.rollbackOf ?? null,
    started_by: release.authorId,
    started_at: new Date(start),
    finished_at: new Date(at),
    created_at: new Date(start),
    updated_at: new Date(at),
  });
  // Releases reach Prod hours after Dev, so deployments arrive out of order; the latest wins.
  if (outcome === 'succeeded' && (previous?.deployedAt ?? 0) <= at) {
    c.current.set(keyOf(release.app, target), {
      releaseId: release.id,
      version: release.version,
      deploymentId: id,
      deployedAt: at,
    });
  }
  if (target.class === 'prod' && at > c.end - 7 * 24 * HOUR) {
    c.prodChanges.push({
      kind: options.kind === 'rollback' ? 'rollback' : 'deploy',
      application_id: release.app.id,
      environment_id: target.id,
      domain_id: release.app.domainId,
      group_id: release.app.groupId,
      actor_user_id: release.authorId,
      summary: `${release.app.key} ${release.version} to ${target.name}`,
      detail: outcome === 'succeeded' ? null : outcome === 'failed' ? 'Failed' : 'Rolled back',
      ref_kind: 'deployment',
      ref_id: id,
      revertible: outcome === 'succeeded',
      occurred_at: new Date(at),
      created_at: new Date(at),
    });
  }
  return { id, finishedAt: at };
}

/** One release's way to Prod; stops where it would finish after now. */
function promoteToProd(
  c: Ctx,
  release: ReleaseInfo,
  ready: number,
  releasesByApp: Map<string, ReleaseInfo>,
) {
  const { rng } = c.world;
  const asia = env(c.world, 'prod-asia-south1');
  const start = ready + rng.int(60, 300) * MINUTE;
  if (start + 3 * HOUR > c.end) return;
  const roll = rng.next();
  const outcome = roll < 0.01 ? 'failed' : roll < 0.025 ? 'rolled_back' : 'succeeded';
  const promotionId = uuidv7(rng, start - MINUTE);
  const previous = c.current.get(keyOf(release.app, asia));
  const first = deploy(c, release, asia, start, outcome, { canary: true, promotionId });
  if (outcome === 'rolled_back' && previous) {
    const back = releasesByApp.get(previous.releaseId);
    if (back)
      deploy(c, back, asia, first.finishedAt + MINUTE, 'succeeded', {
        kind: 'rollback',
        rollbackOf: first.id,
        promotionId,
      });
  }
  let finished = first.finishedAt;
  if (outcome === 'succeeded') {
    for (const key of ['prod-us-east1', 'prod-eu-west1']) {
      const wave = deploy(
        c,
        release,
        env(c.world, key),
        first.finishedAt + 30 * MINUTE + rng.int(0, 120) * 1000,
        'succeeded',
        { promotionId, wave: 2 },
      );
      finished = Math.max(finished, wave.finishedAt);
    }
  }
  c.promotions.push({
    id: promotionId,
    release_id: release.id,
    application_id: release.app.id,
    environment_id: asia.id,
    mode: release.app.tier === 2 ? 'continuous' : 'approval',
    state: outcome,
    plan: {
      waves: [
        { wave: 1, environments: ['prod-asia-south1'], steps: [5, 25, 100] },
        { wave: 2, environments: ['prod-us-east1', 'prod-eu-west1'], startsAfterMinutes: 30 },
      ],
    },
    requested_by: release.authorId,
    finished_at: new Date(finished),
    created_at: new Date(start - MINUTE),
    updated_at: new Date(finished),
  });
}

export async function seedDeployments(
  world: World,
  releases: readonly ReleaseInfo[],
): Promise<DeployResult> {
  const { rng, sql } = world;
  const c: Ctx = {
    world,
    deployments: [],
    events: [],
    promotions: [],
    current: new Map(),
    prodChanges: [],
    end: world.now.getTime() - 5 * MINUTE,
  };
  const byId = new Map(releases.map((r) => [r.id, r]));
  const dev = env(world, 'dev');
  const staging = env(world, 'staging');
  for (const release of releases) {
    const devStart = release.createdAt + rng.int(1, 4) * MINUTE;
    if (devStart + 10 * MINUTE > c.end) continue;
    const devOutcome = rng.chance(0.02) ? 'failed' : 'succeeded';
    const inDev = deploy(c, release, dev, devStart, devOutcome);
    if (devOutcome === 'failed' || !rng.chance(0.7)) continue;
    const stagingStart = inDev.finishedAt + rng.int(10, 60) * MINUTE;
    if (stagingStart + 10 * MINUTE > c.end) continue;
    const stagingOutcome = rng.chance(0.02) ? 'failed' : 'succeeded';
    const inStaging = deploy(c, release, staging, stagingStart, stagingOutcome);
    if (stagingOutcome === 'succeeded' && rng.chance(0.17) && release.app.weight > 0) {
      promoteToProd(c, release, inStaging.finishedAt, byId);
    }
  }
  await insertMany(sql, 'pipeline_promotions', c.promotions);
  await insertMany(sql, 'pipeline_deployments', c.deployments);
  await insertMany(sql, 'pipeline_deployment_events', c.events);
  world.log(
    `${c.deployments.length} deployments, ${c.events.length} events, ${c.promotions.length} promotions`,
  );
  return { current: c.current, prodChanges: c.prodChanges };
}
