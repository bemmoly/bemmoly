import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promotionSchema } from '../../../../shared/promotions.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';

/*
 * The whole shipping path against real Postgres and the fake provider: Dev to Staging to
 * Prod with an approval, canary steps judged on metrics, a bake between waves, an automatic
 * roll back, a paused marginal canary, and a roll back by hand.
 */

describe('promotions and rollouts', () => {
  let harness: PipelinesHarness | undefined;
  let f: ShippingFixture;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const sql = () => {
    if (!harness) throw new Error('No database');
    return harness.sql;
  };
  const priya = () => harness?.as(harness.users.member) ?? ({} as never);
  const ravi = () => harness?.as(f.ravi) ?? ({} as never);

  async function current(environment: string) {
    const [row] =
      (await sql()<{ version: string | null; state: string }[]>`
      select version, state from pipeline_current
      where application_id = ${f.app} and environment_id = ${environment}`) ?? [];
    return row ?? null;
  }

  async function promotionState(id: string) {
    const [row] =
      (await sql()<{ state: string; outcome_reason: string | null }[]>`
      select state, outcome_reason from pipeline_promotions where id = ${id}`) ?? [];
    return row;
  }

  async function ship(version: string, to: string) {
    const { promotion } = await f.service.requestPromotion(priya(), {
      release: version,
      to,
      mode: 'approval',
    });
    return promotion;
  }

  it('ships a release through Dev and Staging without asking anyone', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const v1 = await f.release('v1.0.0');
    const dev = await ship(v1, 'dev');
    expect(promotionSchema.parse(dev).state).toBe('rolling_out');
    expect(
      await f.runUntil(async () => (await promotionState(dev.id))?.state === 'succeeded', 5),
    ).toBe(true);
    expect(await current(f.environments.dev)).toEqual({ version: 'v1.0.0', state: 'idle' });

    const staging = await ship(v1, 'staging');
    expect(
      await f.runUntil(async () => (await promotionState(staging.id))?.state === 'succeeded', 20),
    ).toBe(true);
    expect(await current(f.environments.staging)).toEqual({ version: 'v1.0.0', state: 'idle' });
  });

  it('refuses a release that skipped the stage before', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const skipped = await f.release('v1.0.1');
    await expect(ship(skipped, 'prod')).rejects.toThrow(/has not reached the stage before/);
  });

  it('waits for an approval from the owners, never the author, bound to the digest', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [{ id: v1 } = { id: '' }] = await harness.sql<{ id: string }[]>`
      select id from pipeline_releases where version = 'v1.0.0'`;
    const prod = await ship(v1, 'prod');
    expect(prod.state).toBe('awaiting_approval');
    expect(prod.plan.waves.map((wave) => wave.environments.map((e) => e.key))).toEqual([
      ['prod-asia-south1'],
      ['prod-us-east1'],
    ]);
    expect(prod.requirements[0]).toMatchObject({
      needed: 1,
      have: 0,
      excludesAuthors: true,
      canApprove: false,
    });
    await expect(
      f.service.decide(priya(), prod.id, {
        decision: 'approved',
        releaseDigest: prod.release.digest,
      }),
    ).rejects.toThrow(/cannot approve their own change/);
    await expect(
      f.service.decide(ravi(), prod.id, { decision: 'approved', releaseDigest: 'sha256:old' }),
    ).rejects.toThrow(/changed since you looked/);
    const approved = await f.service.decide(ravi(), prod.id, {
      decision: 'approved',
      releaseDigest: prod.release.digest,
    });
    expect(approved.state).toBe('rolling_out');
    expect(approved.gates.find((gate) => gate.gate === 'approvals')?.state).toBe('pass');

    // A first deploy has no stable to compare with, so asia goes to 100% under a ten-minute
    // watch; us follows after its 30-minute bake.
    expect(
      await f.runUntil(async () => (await promotionState(prod.id))?.state === 'succeeded', 120),
    ).toBe(true);
    expect(await current(f.environments.prodAsia)).toEqual({ version: 'v1.0.0', state: 'idle' });
    expect(await current(f.environments.prodUs)).toEqual({ version: 'v1.0.0', state: 'idle' });
    expect(
      f.world.log.filter((line) => line.includes('prod-asia-south1') && line.startsWith('shift')),
    ).toHaveLength(1);
    const [record] = await harness.sql<{ outcome: string }[]>`
      select outcome from pipeline_change_records where promotion_id = ${prod.id}`;
    expect(record?.outcome).toBe('succeeded');
  });

  it('rolls a failing canary back by itself after two bad samples', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const v2 = await f.release('v2.0.0', { 'fake.errorRate@prod-asia-south1': 0.3 });
    for (const to of ['dev', 'staging']) {
      const step = await ship(v2, to);
      expect(
        await f.runUntil(async () => (await promotionState(step.id))?.state === 'succeeded', 30),
      ).toBe(true);
    }
    const prod = await ship(v2, 'prod');
    await f.service.decide(ravi(), prod.id, {
      decision: 'approved',
      releaseDigest: prod.release.digest,
    });
    expect(
      await f.runUntil(async () => (await promotionState(prod.id))?.state === 'rolled_back', 30),
    ).toBe(true);
    expect((await promotionState(prod.id))?.outcome_reason).toMatch(
      /Rolled back in prod-asia-south1/,
    );
    expect(await current(f.environments.prodAsia)).toEqual({
      version: 'v1.0.0',
      state: 'rolled_back',
    });
    expect(await current(f.environments.prodUs)).toEqual({ version: 'v1.0.0', state: 'idle' });
    const [deployment] = await harness.sql<{ id: string }[]>`
      select id from pipeline_deployments where promotion_id = ${prod.id}`;
    const canary = await f.service.canary(priya(), deployment?.id ?? '');
    expect(canary.failingSamples).toBe(2);
    expect(canary.verdict).toBe('fail');
    expect(canary.samples.length).toBeGreaterThanOrEqual(2);
  });

  it('pauses a marginal canary for a person and rolls back on their word', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const v3 = await f.release('v3.0.0', { 'fake.errorRate@prod-asia-south1': 0.008 });
    for (const to of ['dev', 'staging']) {
      const step = await ship(v3, to);
      await f.runUntil(async () => (await promotionState(step.id))?.state === 'succeeded', 30);
    }
    const prod = await ship(v3, 'prod');
    await f.service.decide(ravi(), prod.id, {
      decision: 'approved',
      releaseDigest: prod.release.digest,
    });
    const paused = async () =>
      (
        await sql()<{ id: string }[]>`
        select id from pipeline_deployments where promotion_id = ${prod.id} and state = 'waiting'`
      )?.[0];
    expect(await f.runUntil(async () => Boolean(await paused()), 10)).toBe(true);
    const id = (await paused())?.id ?? '';
    const detail = await f.service.getDeployment(priya(), id);
    expect(detail.pauseReason).toMatch(/Marginal at 5%/);
    const after = await f.service.resume(priya(), id, {
      decision: 'rollback',
      reason: 'Not worth the risk',
    });
    expect(after.state).toBe('rolled_back');
    expect((await promotionState(prod.id))?.state).toBe('rolled_back');
  });

  it('rolls a finished deployment back by hand to the release before it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [latest] = await harness.sql<{ id: string }[]>`
      select id from pipeline_deployments
      where environment_id = ${f.environments.staging} and state = 'succeeded'
      order by finished_at desc limit 1`;
    const rolled = await f.service.rollback(priya(), latest?.id ?? '', {
      reason: 'Checkout errors',
    });
    expect(rolled.kind).toBe('rollback');
    expect(rolled.state).toBe('succeeded');
    expect(rolled.release.version).toBe('v2.0.0');
    expect(await current(f.environments.staging)).toEqual({ version: 'v2.0.0', state: 'idle' });
    const [change] = await harness.sql<{ kind: string; summary: string }[]>`
      select kind, summary from pipeline_changes order by occurred_at desc, id desc limit 1`;
    expect(change).toEqual({
      kind: 'rollback',
      summary: 'Roll back · checkout-api to v2.0.0 in staging',
    });
  });
});
