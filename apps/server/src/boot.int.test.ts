import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { modulesWithFixture } from './test-support.ts';

describe('the host boots the data kernel with the fixture module', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness({ available: await modulesWithFixture() });
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('starts a fresh install with no module enabled', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    expect((await app.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    expect((await app.inject({ url: '/api/v1/admin/modules' })).json()).toMatchObject({
      pinned: false,
      items: [
        { id: 'docs', enabled: false, defaultAccess: 'teams' },
        { id: 'people', enabled: false, defaultAccess: 'everyone' },
        { id: 'pipelines', enabled: false, defaultAccess: 'teams' },
        { id: 'work', enabled: false, defaultAccess: 'teams' },
        { id: 'fixture', enabled: false, defaultAccess: 'none' },
      ],
    });
    const gated = await app.inject({ url: '/api/v1/fixture/greeting' });
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });
    const enabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/fixture/enable',
      payload: { access: { mode: 'everyone' } },
    });
    expect(enabled.json()).toMatchObject({ id: 'fixture', enabled: true });
  });

  it('serves the enabled fixture end to end: route, setting, realtime, job', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    expect(
      (await app.inject({ url: '/api/v1/modules' })).json().items.map((m: { id: string }) => m.id),
    ).toEqual(['fixture']);
    expect((await app.inject({ url: '/api/v1/fixture/greeting' })).json()).toEqual({
      greeting: 'Hello from the fixture module',
    });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/fixture.greeting',
      payload: { value: 'Hi from the test' },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/items',
      payload: { label: 'one' },
    });
    expect(created.statusCode).toBe(201);
    const ping = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/pings',
      payload: { idempotencyKey: 'p1' },
    });
    expect(ping.json()).toMatchObject({ deduplicated: false });
    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/pings',
      payload: { idempotencyKey: 'p1' },
    });
    expect(again.json()).toEqual({ jobId: null, deduplicated: true });
    await expect
      .poll(
        async () =>
          (await app.inject({ url: '/api/v1/fixture/items' }))
            .json()
            .items.map((i: { label: string }) => i.label),
        {
          timeout: 15_000,
        },
      )
      .toContain('ping: Hi from the test');
  });

  it('disables the fixture live and keeps it disabled across a restart', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/fixture/disable',
    });
    expect(disabled.json()).toMatchObject({ id: 'fixture', enabled: false });
    expect((await app.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    const gated = await app.inject({ url: '/api/v1/fixture/items' });
    expect(gated.statusCode).toBe(404);
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });

    const restarted = await harness.boot();
    expect((await restarted.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    expect((await restarted.inject({ url: '/api/v1/admin/modules' })).json()).toMatchObject({
      pinned: false,
      items: [
        { id: 'docs', enabled: false, changelogState: 'pending' },
        { id: 'people', enabled: false, changelogState: 'pending' },
        { id: 'pipelines', enabled: false, changelogState: 'pending' },
        { id: 'work', enabled: false, changelogState: 'pending' },
        { id: 'fixture', enabled: false, changelogState: 'current' },
      ],
    });
  });

  it('follows BEMMOLY_MODULES and refuses changes through the API while pinned', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot('fixture');
    expect((await app.inject({ url: '/api/v1/modules' })).json().items).toHaveLength(1);
    const refused = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/fixture/disable',
    });
    expect(refused.statusCode).toBe(409);
  });
});
