import { insertMany, type Row } from './bulk.ts';
import { DAY, HOUR, uuidv7 } from './rng.ts';
import type { EnvInfo, World } from './world.ts';

/*
 * The platform team's side of Acme: Google Cloud connected with one project per domain and
 * environment class, the five environments and each tier's path through them, runner pools
 * with fair shares, role bindings, the two Prod policies, a freeze, on-call, trains,
 * templates and the node-service v3 to v4 campaign.
 */

const PROD_PROTECTION = {
  protected: true,
  controlPlaneOnly: true,
  requiresApproval: true,
  window: 'Mon-Thu 10:00-16:00 Asia/Kolkata',
};

const ENVIRONMENTS = [
  ['dev', 'Dev', 'dev', 'asia-south1'],
  ['staging', 'Staging', 'staging', 'asia-south1'],
  ['prod-asia-south1', 'Prod · asia-south1', 'prod', 'asia-south1'],
  ['prod-us-east1', 'Prod · us-east1', 'prod', 'us-east1'],
  ['prod-eu-west1', 'Prod · eu-west1', 'prod', 'europe-west1'],
] as const;

async function seedClouds(world: World): Promise<EnvInfo[]> {
  const { sql, rng, now } = world;
  const at = now.getTime() - 300 * DAY;
  const connection = uuidv7(rng, at);
  await insertMany(sql, 'cloud_connections', [
    {
      id: connection,
      provider: 'gcp',
      name: 'Acme Google Cloud',
      status: 'connected',
      principal: 'bemmoly-control@acme-bemmoly.iam.gserviceaccount.com',
      boundary_ref: 'folders/417203886121',
      layout: 'per-domain-environment',
      config: { organizationId: '880211933104', billingAccountId: '01A2B3-C4D5E6-F7A8B9' },
      last_checked_at: new Date(now.getTime() - 5 * 60_000),
    },
  ]);
  const accounts: Row[] = [];
  const accountOf = new Map<string, string>();
  for (const domain of world.domains) {
    for (const cls of ['dev', 'staging', 'prod'] as const) {
      const id = uuidv7(rng, at + accounts.length + 1);
      const name = `acme-${domain.key}-${cls}`;
      accountOf.set(`${domain.id}/${cls}`, id);
      accounts.push({
        id,
        connection_id: connection,
        external_id: name,
        name,
        domain_id: domain.id,
        environment_class: cls,
        purpose: 'workload',
        status: 'ready',
      });
    }
  }
  const ci = uuidv7(rng, at + 999);
  accounts.push({
    id: ci,
    connection_id: connection,
    external_id: 'acme-ci',
    name: 'acme-ci',
    domain_id: null,
    environment_class: null,
    purpose: 'ci',
    status: 'ready',
  });
  await insertMany(sql, 'cloud_accounts', accounts);
  const resources = accounts.flatMap((account) =>
    ['network', 'deployer_identity', 'budget'].map((kind) => ({
      account_id: account['id'],
      kind,
      name: kind === 'deployer_identity' ? `deployer@${String(account['name'])}` : 'default',
      desired: { kind },
      observed: { kind },
      spec_hash: rng.hex(16),
      status: 'ready',
      last_reconciled_at: new Date(now.getTime() - rng.int(1, 20) * HOUR),
    })),
  );
  await insertMany(sql, 'cloud_resources', resources);
  const envs: EnvInfo[] = ENVIRONMENTS.map(([key, name, cls], index) => ({
    id: uuidv7(rng, at + 2000 + index),
    key,
    name,
    class: cls,
    position: index + 1,
  }));
  await insertMany(
    sql,
    'pipeline_environments',
    envs.map((env, index) => ({
      id: env.id,
      key: env.key,
      name: env.name,
      class: env.class,
      provider: 'gcp',
      region: ENVIRONMENTS[index]?.[3] ?? null,
      position: env.position,
      protection: env.class === 'prod' ? PROD_PROTECTION : { protected: false },
    })),
  );
  await insertMany(
    sql,
    'pipeline_environment_accounts',
    envs.flatMap((env) =>
      world.domains.map((domain) => ({
        environment_id: env.id,
        domain_id: domain.id,
        cloud_account_id: accountOf.get(`${domain.id}/${env.class}`),
      })),
    ),
  );
  return envs;
}

async function seedPaths(world: World, envs: EnvInfo[]) {
  const { sql, rng, now } = world;
  const key = (k: string) => envs.find((e) => e.key === k)?.id;
  for (const tier of [0, 1, 2]) {
    const pathId = uuidv7(rng, now.getTime() - 200 * DAY + tier);
    await insertMany(sql, 'pipeline_environment_paths', [
      { id: pathId, tier, name: `Tier ${tier}` },
    ]);
    const regional = tier < 2;
    await insertMany(sql, 'pipeline_environment_path_steps', [
      {
        path_id: pathId,
        environment_id: key('dev'),
        stage: 0,
        bake_minutes: 0,
        auto_promote: true,
      },
      {
        path_id: pathId,
        environment_id: key('staging'),
        stage: 1,
        bake_minutes: tier === 0 ? 30 : 0,
        auto_promote: tier > 0,
      },
      {
        path_id: pathId,
        environment_id: key('prod-asia-south1'),
        stage: 2,
        bake_minutes: regional ? 30 : 0,
        auto_promote: tier === 2,
      },
      {
        path_id: pathId,
        environment_id: key('prod-us-east1'),
        stage: regional ? 3 : 2,
        bake_minutes: regional ? 30 : 0,
        auto_promote: tier === 2,
      },
      {
        path_id: pathId,
        environment_id: key('prod-eu-west1'),
        stage: regional ? 3 : 2,
        bake_minutes: regional ? 30 : 0,
        auto_promote: tier === 2,
      },
    ]);
  }
}

async function seedPools(world: World) {
  const { sql, rng, now } = world;
  const pools = [
    ['linux-x64', 'linux-x64', 'kubernetes', 'GKE Autopilot · asia-south1', 40, 240, 20],
    ['linux-x64-large', 'linux-x64-large', 'kubernetes', 'GKE · asia-south1 · 8 vCPU', 0, 30, 2],
    ['linux-arm64', 'linux-arm64', 'kubernetes', 'GKE · asia-south1', 0, 80, 4],
    ['gpu', 'gpu', 'vm', 'Instance group · us-central1', 0, 8, 0],
  ] as const;
  const rows = pools.map(([k, name, hosting, location, min, max, warm], i) => ({
    id: uuidv7(rng, now.getTime() - 250 * DAY + i),
    key: k,
    name,
    hosting,
    location,
    labels: [k],
    min_runners: min,
    max_runners: max,
    warm_runners: warm,
    token_hash: rng.hex(64),
    token_rotated_at: new Date(now.getTime() - 20 * DAY),
  }));
  await insertMany(sql, 'pipeline_runner_pools', rows);
  const shares = [...world.teams.values()]
    .filter((t) => world.apps.some((a) => a.ownerTeam?.id === t.id))
    .map((t) => ({
      pool_id: rows[0]?.id,
      team_id: t.id,
      weight: t.name === 'Logistics core' || t.name === 'Payments' ? 40 : 10 + rng.int(0, 20),
    }));
  await insertMany(sql, 'pipeline_team_shares', shares);
  return rows.map((row) => ({ id: row.id, key: row.key }));
}

export async function seedPlatform(world: World) {
  const envs = await seedClouds(world);
  world.envs = envs;
  world.envByKey = new Map(envs.map((e) => [e.key, e]));
  await seedPaths(world, envs);
  world.pools = await seedPools(world);
  world.log(
    `5 environments, ${world.domains.length * 3 + 1} cloud projects, ${world.pools.length} runner pools`,
  );
}
