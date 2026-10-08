import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';

describe('the host boots the data kernel with the sample module', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
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
        { id: 'sample', enabled: false, defaultAccess: 'none' },
        { id: 'work', enabled: false, defaultAccess: 'teams' },
      ],
    });
    const gated = await app.inject({ url: '/api/v1/sample/greeting' });
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });
    const enabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/enable',
      payload: { access: { mode: 'everyone' } },
    });
    expect(enabled.json()).toMatchObject({ id: 'sample', enabled: true });
  });

  it('serves the enabled sample end to end: route, setting, realtime, job', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    expect(
      (await app.inject({ url: '/api/v1/modules' })).json().items.map((m: { id: string }) => m.id),
    ).toEqual(['sample']);
    expect((await app.inject({ url: '/api/v1/sample/greeting' })).json()).toEqual({
      greeting: 'Hello from the sample module',
    });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/sample.greeting',
      payload: { value: 'Hi from the test' },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/sample/items',
      payload: { label: 'one' },
    });
    expect(created.statusCode).toBe(201);
    const ping = await app.inject({
      method: 'POST',
      url: '/api/v1/sample/pings',
      payload: { idempotencyKey: 'p1' },
    });
    expect(ping.json()).toMatchObject({ deduplicated: false });
    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/sample/pings',
      payload: { idempotencyKey: 'p1' },
    });
    expect(again.json()).toEqual({ jobId: null, deduplicated: true });
    await expect
      .poll(
        async () =>
          (await app.inject({ url: '/api/v1/sample/items' }))
            .json()
            .items.map((i: { label: string }) => i.label),
        {
          timeout: 15_000,
        },
      )
      .toContain('ping: Hi from the test');
  });

  it('disables the sample live and keeps it disabled across a restart', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/disable',
    });
    expect(disabled.json()).toMatchObject({ id: 'sample', enabled: false });
    expect((await app.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    const gated = await app.inject({ url: '/api/v1/sample/items' });
    expect(gated.statusCode).toBe(404);
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });

    const restarted = await harness.boot();
    expect((await restarted.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    expect((await restarted.inject({ url: '/api/v1/admin/modules' })).json()).toMatchObject({
      pinned: false,
      items: [
        { id: 'sample', enabled: false, changelogState: 'current' },
        { id: 'work', enabled: false, changelogState: 'pending' },
      ],
    });
  });

  it('follows BEMMOLY_MODULES and refuses changes through the API while pinned', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot('sample');
    expect((await app.inject({ url: '/api/v1/modules' })).json().items).toHaveLength(1);
    const refused = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/disable',
    });
    expect(refused.statusCode).toBe(409);
  });
});
