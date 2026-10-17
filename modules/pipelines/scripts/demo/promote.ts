import { insertMany } from './bulk.ts';
import { makeDeployment, makeRelease, makeRun, targetKey, type LiveState } from './make.ts';
import { HOUR, MINUTE, uuidv7 } from './rng.ts';
import { app, colleague, env, type AppInfo, type World } from './world.ts';

/*
 * The pieces For you is built from: a release shipped through Dev and Staging, a promotion to
 * Prod with its gates, the 11:00 Commerce train with the applications aboard it, and a
 * broken main on one of the demo person's teams.
 */

const PLAN = {
  waves: [
    { wave: 1, environments: ['prod-asia-south1'], steps: [5, 25, 100], holdMinutes: 10 },
    { wave: 2, environments: ['prod-us-east1', 'prod-eu-west1'], startsAfterMinutes: 30 },
  ],
  autoRollback: true,
};

const GATES = [
  'tests',
  'security_scan',
  'staging_healthy',
  'error_budget',
  'window',
  'freeze',
] as const;
const REASONS: Readonly<Record<string, string>> = {
  tests: '198 tests, 0 failed',
  security_scan: '0 high findings',
  staging_healthy: 'Healthy for 31 minutes, needs 30',
  error_budget: '62% left this month',
  window: 'Open until 16:00',
  freeze: 'Next freeze 20 December',
};

export function person(world: World, name: string): string | null {
  return world.people.find((p) => p.name === name)?.id ?? null;
}

/** A release built by `author` that reached Dev and Staging, ready for Prod. */
export async function shipThroughStaging(
  world: World,
  live: LiveState,
  input: {
    app: AppInfo;
    version: string;
    title: string;
    sha?: string;
    issueKey?: string;
    author: string | null;
    at: number;
  },
) {
  const run = await makeRun(world, {
    app: input.app,
    title: input.title,
    authorId: input.author,
    main: true,
    state: 'passed',
    createdAt: input.at,
    ...(input.sha ? { sha: input.sha } : {}),
    issueKey: input.issueKey ?? null,
  });
  const releaseId = await makeRelease(world, {
    app: input.app,
    version: input.version,
    runId: run.id,
    authorId: input.author,
    createdAt: run.finishedAt,
  });
  for (const [key, offset] of [
    ['dev', 2],
    ['staging', 25],
  ] as const) {
    const target = env(world, key);
    const done = await makeDeployment(world, {
      app: input.app,
      target,
      releaseId,
      state: 'succeeded',
      traffic: 100,
      startedAt: run.finishedAt + offset * MINUTE,
      authorId: input.author,
    });
    live.current.set(targetKey(input.app, target), {
      releaseId,
      version: input.version,
      deploymentId: done.id,
      deployedAt: done.at,
    });
  }
  return { runId: run.id, releaseId };
}

export async function promotion(
  world: World,
  input: {
    app: AppInfo;
    releaseId: string;
    state: string;
    requestedBy: string | null;
    at: number;
    mode?: string;
    departureId?: string;
  },
) {
  const id = uuidv7(world.rng, input.at);
  await insertMany(world.sql, 'pipeline_promotions', [
    {
      id,
      release_id: input.releaseId,
      application_id: input.app.id,
      environment_id: env(world, 'prod-asia-south1').id,
      mode: input.mode ?? 'approval',
      departure_id: input.departureId ?? null,
      state: input.state,
      plan: PLAN,
      requested_by: input.requestedBy,
      expires_at: new Date(input.at + 8 * HOUR),
      created_at: new Date(input.at),
    },
  ]);
  return id;
}

export async function gates(
  world: World,
  promotionId: string,
  pending: Readonly<Record<string, string>> = {},
) {
  await insertMany(world.sql, 'pipeline_gate_results', [
    ...GATES.map((gate) => ({
      promotion_id: promotionId,
      gate,
      state: pending[gate] ? 'pending' : 'pass',
      reason: pending[gate] ?? REASONS[gate] ?? 'Passed',
      recheck_at: pending[gate] ? new Date(world.now.getTime() + HOUR) : null,
    })),
    {
      promotion_id: promotionId,
      gate: 'approvals',
      state: 'pending',
      reason: 'Waiting for approvals',
      recheck_at: null,
    },
  ]);
}

/** The next 11:00 Commerce train (Asia/Kolkata, 05:30 UTC) with up to 14 applications aboard. */
export async function seedTrain(world: World, live: LiveState) {
  const { sql, now } = world;
  const departs = new Date(now);
  departs.setUTCHours(5, 30, 0, 0);
  if (departs.getTime() <= now.getTime()) departs.setTime(departs.getTime() + 24 * HOUR);
  const [train] = await sql<
    { id: string }[]
  >`select id from pipeline_trains where key = 'commerce-1100'`;
  if (!train) return;
  const departureId = uuidv7(world.rng, now.getTime() - HOUR);
  await insertMany(sql, 'pipeline_train_departures', [
    { id: departureId, train_id: train.id, departs_at: departs, state: 'awaiting_approval' },
  ]);
  const staging = env(world, 'staging');
  const taken = new Set([
    'checkout-api',
    'pricing-svc',
    'ledger-api',
    'payouts-worker',
    'refunds-api',
  ]);
  const aboard = world.apps
    .filter(
      (a) =>
        a.domainKey === 'commerce' &&
        a.tier === 1 &&
        !taken.has(a.key) &&
        live.current.has(targetKey(a, staging)),
    )
    .slice(0, 14);
  for (const [index, member] of aboard.entries()) {
    const releaseId = live.current.get(targetKey(member, staging))?.releaseId;
    if (!releaseId) continue;
    const id = await promotion(world, {
      app: member,
      releaseId,
      state: 'scheduled',
      requestedBy: colleague(world, member),
      at: now.getTime() - (index + 1) * 7 * MINUTE,
      mode: 'train',
      departureId,
    });
    await gates(world, id, index < 2 ? { error_budget: 'Waiting for metrics' } : {});
  }
}

/** Checkout web's main, broken twelve minutes ago by Jon Mathew in storefront-web's lint. */
export async function seedBrokenMain(world: World) {
  const storefront = app(world, 'storefront-web');
  await makeRun(world, {
    app: storefront,
    title: 'Move the banner into the header',
    sha: 'b81d7e2',
    issueKey: null,
    authorId: person(world, 'Jon Mathew'),
    main: true,
    state: 'failed',
    createdAt: world.now.getTime() - 12 * MINUTE,
    failKey: 'lint',
  });
}
