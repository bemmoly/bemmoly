import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';

/*
 * Auto-promote: the fixture's Tier 1 path is Dev, Staging, then Prod in two regions. With Dev
 * and Staging marked auto-promote, a new release reaches Dev on the next sweep and Staging once
 * Dev has run it for its bake time; Prod waits for a person even when marked.
 */

describe('auto-promote', () => {
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
    await harness.sql`
      update pipeline_environment_path_steps set auto_promote = true,
        bake_minutes = case when environment_id = ${f.environments.dev} then 15 else bake_minutes end
      where environment_id = any(${[f.environments.dev, f.environments.staging, f.environments.prodAsia]}::uuid[])`;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const promotionsOf = (release: string) =>
    harness!.sql<{ key: string; state: string; mode: string; requested_by: string | null }[]>`
      select e.key, p.state, p.mode, p.requested_by from pipeline_promotions p
      join pipeline_environments e on e.id = p.environment_id
      where p.release_id = ${release} order by p.created_at`;

  it('takes a new release to Dev by itself, asked for by nobody', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const release = await f.release('v3.0.0');
    await f.service.engine.sweep();
    const [dev] = await promotionsOf(release);
    expect(dev).toMatchObject({ key: 'dev', mode: 'continuous', requested_by: null });
  });

  it('moves on to Staging only after Dev has run it for its bake time, and never to Prod', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [release] = await harness.sql<{ id: string }[]>`
      select id from pipeline_releases where version = 'v3.0.0'`;
    const id = release!.id;
    const landed = await f.runUntil(async () => {
      const rows = await promotionsOf(id);
      return rows.some((row) => row.key === 'dev' && row.state === 'succeeded');
    }, 10);
    expect(landed).toBe(true);
    expect((await promotionsOf(id)).map((row) => row.key)).toEqual(['dev']);

    await f.runUntil(async () => (await promotionsOf(id)).some((row) => row.key === 'staging'), 20);
    const rows = await promotionsOf(id);
    expect(rows.find((row) => row.key === 'staging')).toMatchObject({ mode: 'continuous' });
    const [dev] = await harness.sql<{ finished_at: string }[]>`
      select finished_at from pipeline_deployments
      where release_id = ${id} and environment_id = ${f.environments.dev} and state = 'succeeded'`;
    const [staging] = await harness.sql<{ created_at: string }[]>`
      select created_at from pipeline_promotions
      where release_id = ${id} and environment_id = ${f.environments.staging}`;
    const baked = new Date(staging!.created_at).getTime() - new Date(dev!.finished_at).getTime();
    expect(baked).toBeGreaterThanOrEqual(15 * 60_000);

    await f.runUntil(
      async () =>
        (await promotionsOf(id)).some((row) => row.key === 'staging' && row.state === 'succeeded'),
      20,
    );
    await f.runUntil(async () => false, 5);
    expect((await promotionsOf(id)).map((row) => row.key)).not.toContain('prod-asia-south1');
  });

  it('leaves an older release where it is once a newer one exists', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const older = await f.release('v3.0.1');
    const newer = await f.release('v3.0.2');
    await f.service.engine.sweep();
    expect(await promotionsOf(older)).toEqual([]);
    expect((await promotionsOf(newer)).map((row) => row.key)).toEqual(['dev']);
  });
});
