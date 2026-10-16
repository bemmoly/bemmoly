import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capacitySchema, createdPoolSchema } from '../../../../shared/capacity.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';

describe('capacity and pools', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('creates a pool with a token shown once that registers a runner, and rotates it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const admin = harness.as(harness.users.admin);
    const created = createdPoolSchema.parse(
      await harness.services.capacity.create(admin, {
        key: 'laptop',
        name: 'Laptop',
        hosting: 'local',
        maxRunners: 2,
      }),
    );
    expect(created.pool).toMatchObject({ key: 'laptop', busy: 0, scaling: '0 to 2' });
    const runner = await harness.services.runner.register({
      poolToken: created.token.token,
      name: 'mac',
      version: '0.1.0',
    });
    expect(runner.pool.key).toBe('laptop');
    const rotated = await harness.services.capacity.rotateToken(admin, 'laptop');
    await expect(
      harness.services.runner.register({ poolToken: created.token.token, name: 'x', version: '1' }),
    ).rejects.toThrow('pool token');
    expect(rotated.token).not.toBe(created.token.token);
    await expect(
      harness.services.capacity.create(admin, {
        key: 'laptop',
        name: 'Again',
        hosting: 'local',
        maxRunners: 1,
      }),
    ).rejects.toThrow('already exists');
  });

  it('reads Capacity in one call, with the queue and why it waits', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const member = harness.as(harness.users.member);
    const capacity = capacitySchema.parse(await harness.services.capacity.read(member, {}));
    expect(capacity.pools.map((pool) => pool.key)).toContain('laptop');
    expect(capacity.stats.queued).toBe(2);
    expect(capacity.queue[0]?.why).toBe('No runner pool is set up yet');
    await expect(
      harness.services.capacity.create(member, {
        key: 'x',
        name: 'X',
        hosting: 'local',
        maxRunners: 1,
      }),
    ).rejects.toThrow();
  });
});
