import { insertMany } from './bulk.ts';
import { makeDeployment, makeRelease, makeRun, targetKey, type LiveState } from './make.ts';
import { HOUR, MINUTE } from './rng.ts';
import {
  gates,
  person,
  promotion,
  seedBrokenMain,
  seedTrain,
  shipThroughStaging,
} from './promote.ts';
import { app, env, type World } from './world.ts';

/*
 * The demo person's own morning, as the For you screen in the product design draws it: three
 * changes in flight (a canary in asia-south1, one waiting for approval, a pull request with a
 * failing shard), three approvals waiting for them, and Checkout web's main broken by
 * someone else twelve minutes ago.
 */

export async function seedForYou(world: World, live: LiveState) {
  const { now, sql } = world;
  const t = now.getTime();
  const me = world.demo.id;
  const prod = ['prod-asia-south1', 'prod-us-east1', 'prod-eu-west1'].map((k) => env(world, k));

  // 1. checkout-api v1.43.0: approved, canary at 25% in asia-south1, the other regions next.
  const checkout = app(world, 'checkout-api');
  const shipped = await shipThroughStaging(world, live, {
    app: checkout,
    version: 'v1.43.0',
    title: 'Retry UPI collect on gateway timeout',
    sha: 'a1c9e3f',
    issueKey: 'ACME-212',
    author: me,
    at: t - 95 * MINUTE,
  });
  const rollout = await promotion(world, {
    app: checkout,
    releaseId: shipped.releaseId,
    state: 'rolling_out',
    requestedBy: me,
    at: t - 20 * MINUTE,
  });
  await insertMany(
    sql,
    'pipeline_approvals',
    [
      ['Ana Ruiz', 'owning_team'],
      ['Lin Tan', 'owning_team'],
      ['Ravi Kumar', 'oncall:sre'],
    ]
      .map(([name, requirement]) => ({
        promotion_id: rollout,
        user_id: person(world, name ?? ''),
        requirement,
        decision: 'approved',
        release_digest: 'sha256:approved',
      }))
      .filter((row) => row.user_id),
  );
  await makeDeployment(world, {
    app: checkout,
    target: env(world, 'prod-asia-south1'),
    releaseId: shipped.releaseId,
    state: 'canary',
    traffic: 25,
    startedAt: t - 14 * MINUTE,
    authorId: me,
    promotionId: rollout,
    steps: [
      ['pending', 0],
      ['deploying', 0],
      ['canary', 5],
      ['canary', 25],
    ],
  });
  for (const target of prod)
    live.moving.set(targetKey(checkout, target), {
      state: target.key === 'prod-asia-south1' ? 'canary' : 'waiting',
      releaseId: shipped.releaseId,
      version: 'v1.43.0',
      traffic: target.key === 'prod-asia-south1' ? 25 : 0,
    });
  const newer = await makeRun(world, {
    app: checkout,
    title: 'Show pending state on the order page',
    sha: 'b2d71f0',
    issueKey: 'ACME-219',
    authorId: person(world, 'Jon Mathew'),
    main: true,
    state: 'passed',
    createdAt: t - 16 * MINUTE,
  });
  const v144 = await makeRelease(world, {
    app: checkout,
    version: 'v1.44.0',
    runId: newer.id,
    authorId: person(world, 'Jon Mathew'),
    createdAt: newer.finishedAt,
  });
  const inDev = await makeDeployment(world, {
    app: checkout,
    target: env(world, 'dev'),
    releaseId: v144,
    state: 'succeeded',
    traffic: 100,
    startedAt: t - 7 * MINUTE,
    authorId: null,
  });
  live.current.set(targetKey(checkout, env(world, 'dev')), {
    releaseId: v144,
    version: 'v1.44.0',
    deploymentId: inDev.id,
    deployedAt: inDev.at,
  });

  // 2. pricing-svc v2.18.0: every gate passed, one Payments approver and SRE on call to go.
  const pricing = app(world, 'pricing-svc');
  const waiting = await shipThroughStaging(world, live, {
    app: pricing,
    version: 'v2.18.0',
    title: 'Cache tax rules per region',
    sha: '4be2a90',
    issueKey: 'ACME-230',
    author: me,
    at: t - 3 * HOUR,
  });
  const pricingPromotion = await promotion(world, {
    app: pricing,
    releaseId: waiting.releaseId,
    state: 'awaiting_approval',
    requestedBy: me,
    at: t - 40 * MINUTE,
  });
  await gates(world, pricingPromotion);
  const ana = person(world, 'Ana Ruiz');
  if (ana)
    await insertMany(sql, 'pipeline_approvals', [
      {
        promotion_id: pricingPromotion,
        user_id: ana,
        requirement: 'owning_team',
        decision: 'approved',
        release_digest: 'sha256:approved',
      },
    ]);
  live.moving.set(targetKey(pricing, prod[0] ?? env(world, 'prod-asia-south1')), {
    state: 'waiting',
    releaseId: waiting.releaseId,
    version: 'v2.18.0',
    traffic: 0,
  });

  // 3. refunds-api pull request: unit 2 of 3 failed on two idempotency tests.
  const refunds = app(world, 'refunds-api');
  await makeRun(world, {
    app: refunds,
    apps: [refunds, app(world, 'ledger-api')],
    title: 'Add idempotency key to refunds',
    sha: '77c1d0e',
    issueKey: 'ACME-241',
    authorId: me,
    main: false,
    pullRequest: 4418,
    state: 'failed',
    createdAt: t - 22 * MINUTE,
    shards: 3,
    failKey: 'unit-2',
  });
  const outcomes = (failures: readonly number[]) =>
    Array.from({ length: 50 }, (_, i) => (failures.includes(i) ? 'f' : 'p')).join('');
  await insertMany(sql, 'pipeline_test_timings', [
    {
      application_id: refunds.id,
      test_file: 'src/refunds/idempotency.spec.ts',
      duration_ms: 2100,
      samples: 50,
      recent_outcomes: outcomes([7, 23, 41]),
      last_failed_at: new Date(t - 2 * HOUR),
    },
    {
      application_id: refunds.id,
      test_file: 'src/refunds/create.spec.ts',
      duration_ms: 512,
      samples: 50,
      recent_outcomes: outcomes([]),
      last_failed_at: null,
    },
    {
      application_id: refunds.id,
      test_file: 'src/refunds/webhooks.spec.ts',
      duration_ms: 302,
      samples: 50,
      recent_outcomes: outcomes([]),
      last_failed_at: null,
    },
  ]);

  // Approvals waiting for the demo person: two Payments releases and the 11:00 Commerce train.
  for (const [key, version, requester, title, pending] of [
    ['ledger-api', 'v5.2.0', 'Lin Tan', 'Post refunds to the ledger in one batch', {}],
    [
      'payouts-worker',
      'v1.9.1',
      'Ravi Kumar',
      'Retry bank file uploads',
      { window: 'Window opens 10:00' },
    ],
  ] as const) {
    const target = app(world, key);
    const built = await shipThroughStaging(world, live, {
      app: target,
      version,
      title,
      author: person(world, requester),
      at: t - 4 * HOUR,
    });
    const id = await promotion(world, {
      app: target,
      releaseId: built.releaseId,
      state: 'awaiting_approval',
      requestedBy: person(world, requester),
      at: t - 50 * MINUTE,
    });
    await gates(world, id, pending);
    live.moving.set(targetKey(target, env(world, 'prod-asia-south1')), {
      state: 'waiting',
      releaseId: built.releaseId,
      version,
      traffic: 0,
    });
  }
  await seedTrain(world, live);
  await seedBrokenMain(world);
  world.log('the demo person: 3 changes in flight, 3 approvals waiting, on call');
}
