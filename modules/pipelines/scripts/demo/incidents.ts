import { insertMany, type Row } from './bulk.ts';
import { makeDeployment, makeRelease, targetKey, type LiveState } from './make.ts';
import { DAY, HOUR, MINUTE } from './rng.ts';
import { colleague, env, nextVersion, type World } from './world.ts';

/*
 * The things on-call looks at: Identity's roll back in asia-south1 at 09:12 India time this
 * morning, and the changes that are not deploys (config, environment, access, policy) on the
 * What changed? timeline for the last week.
 */

/** 09:12 in India (03:42 UTC) today, or yesterday when that is still ahead. */
function nineTwelve(now: Date): number {
  const at = new Date(now);
  at.setUTCHours(3, 42, 0, 0);
  if (at.getTime() > now.getTime() - 10 * MINUTE) at.setTime(at.getTime() - DAY);
  return at.getTime();
}

export async function seedIdentityRollback(world: World, live: LiveState) {
  const asia = env(world, 'prod-asia-south1');
  const candidate = world.apps.find(
    (a) => a.domainKey === 'identity' && a.weight > 0 && live.current.has(targetKey(a, asia)),
  );
  const previous = candidate ? live.current.get(targetKey(candidate, asia)) : undefined;
  if (!candidate || !previous) return;
  const at = nineTwelve(world.now) - 25 * MINUTE;
  const version = nextVersion(candidate, world.rng);
  const author = colleague(world, candidate);
  const bad = await makeRelease(world, {
    app: candidate,
    version,
    runId: null,
    authorId: author,
    createdAt: at - HOUR,
  });
  const failed = await makeDeployment(world, {
    app: candidate,
    target: asia,
    releaseId: bad,
    state: 'rolled_back',
    traffic: 0,
    startedAt: at,
    authorId: author,
    steps: [
      ['pending', 0],
      ['deploying', 0],
      ['canary', 5],
      ['canary', 25],
      ['rolled_back', 0],
    ],
  });
  const restored = await makeDeployment(world, {
    app: candidate,
    target: asia,
    releaseId: previous.releaseId,
    state: 'succeeded',
    traffic: 100,
    startedAt: failed.at + 30_000,
    authorId: null,
    kind: 'rollback',
    rollbackOf: failed.id,
    steps: [
      ['deploying', 0],
      ['succeeded', 100],
    ],
  });
  live.current.set(targetKey(candidate, asia), {
    ...previous,
    deploymentId: restored.id,
    deployedAt: restored.at,
  });
  live.moving.set(targetKey(candidate, asia), {
    state: 'rolled_back',
    releaseId: bad,
    version,
    traffic: 0,
  });
  await insertMany(world.sql, 'pipeline_changes', [
    {
      kind: 'rollback',
      application_id: candidate.id,
      environment_id: asia.id,
      domain_id: candidate.domainId,
      group_id: candidate.groupId,
      actor_user_id: null,
      actor_label: 'Automatic roll back',
      summary: `${candidate.key} ${version} rolled back in ${asia.name}`,
      detail: 'Error rate 2.4% against 0.3% on the stable revision, twice in a row',
      ref_kind: 'deployment',
      ref_id: failed.id,
      revertible: false,
      occurred_at: new Date(restored.at),
    },
  ]);
}

/** Config, environment, access and policy changes sprinkled over the last week. */
export async function seedOtherChanges(world: World) {
  const { rng, now } = world;
  const prod = world.envs.filter((e) => e.class === 'prod');
  const rows: Row[] = [];
  const add = (
    kind: string,
    summary: string,
    detail: string,
    hoursAgo: number,
    appKey?: string,
    revertible = true,
  ) => {
    const target = appKey ? world.appsByKey.get(appKey) : rng.pick(world.apps);
    rows.push({
      kind,
      application_id: kind === 'environment' || kind === 'policy' ? null : (target?.id ?? null),
      environment_id: rng.pick(prod).id,
      domain_id: target?.domainId ?? null,
      group_id: kind === 'environment' || kind === 'policy' ? null : (target?.groupId ?? null),
      actor_user_id: rng.pick(world.people).id,
      actor_label: null,
      summary,
      detail,
      ref_kind: kind,
      ref_id: null,
      revertible,
      occurred_at: new Date(now.getTime() - hoursAgo * HOUR),
    });
  };
  add(
    'config',
    'Config · checkout-api, Prod',
    'PAYMENT_TIMEOUT_MS 3000 to 4500',
    0.3,
    'checkout-api',
  );
  add(
    'access',
    'Access · Editor on acme-commerce-prod for 1 hour',
    'Investigate slow cart reads · approved by Priya S.',
    1.1,
    'cart-api',
    false,
  );
  add(
    'environment',
    'Environment · Prod us-east1 max instances 40 to 60',
    'Changed in Platform › Environments',
    1.2,
    'cart-api',
  );
  add('config', 'Config · checkout-api, Prod', 'UPI_MAX_RETRIES 2 to 3', 26, 'checkout-api');
  add(
    'policy',
    'Policy · Tier 1 to Prod',
    'Canary required in the first region',
    70,
    undefined,
    false,
  );
  for (let i = 0; i < Math.max(4, Math.round(60 * world.scale)); i += 1) {
    const target = rng.pick(world.apps);
    add(
      'config',
      `Config · ${target.key}`,
      `${rng.pick(['LOG_LEVEL', 'POOL_SIZE', 'CACHE_TTL_SECONDS', 'FEATURE_NEW_CHECKOUT'])} changed`,
      rng.int(1, 160),
      target.key,
    );
  }
  await insertMany(world.sql, 'pipeline_changes', rows);
}
