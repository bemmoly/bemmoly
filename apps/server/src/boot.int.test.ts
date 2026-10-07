import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@bemmoly/core';
import { parseEnv } from '@bemmoly/core/config';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type IsolatedDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApplication, type Booted } from './config/boot.ts';
import { importAvailableModules } from './config/modules.ts';

const admin: Actor = { kind: 'user', id: 'admin' };

describe('the host boots the data kernel with the sample module', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  const booted: Booted[] = [];

  beforeAll(async () => {
    server = await startTestDatabase();
    if (server.available) database = await createIsolatedDatabase(server.url);
  });

  afterAll(async () => {
    for (const instance of booted) await instance.app.close();
    for (const instance of booted) {
      await instance.kernel?.stop();
      await instance.database?.sql.end({ timeout: 5 });
    }
    await database?.drop();
    if (server.available) await server.stop();
  });

  async function boot(pinned = '') {
    if (!database) throw new Error('no database');
    const env = parseEnv({
      DATABASE_URL: database.url,
      BEMMOLY_SECRET_KEY: Buffer.alloc(32, 8).toString('base64'),
      BEMMOLY_PUBLIC_URL: 'http://localhost:8080',
      BEMMOLY_DATA_DIR: mkdtempSync(join(tmpdir(), 'bemmoly-data-')),
      BEMMOLY_DB_CONTEXTS: 'test',
      BEMMOLY_MODULES: pinned,
      LOG_LEVEL: 'fatal',
    });
    const instance = await bootApplication({
      env,
      available: await importAvailableModules(),
      identity: { authenticate: async () => admin, authorize: async () => undefined },
      logger: false,
    });
    booted.push(instance);
    await instance.kernel?.start();
    return instance.app;
  }

  it('serves the enabled sample end to end: route, setting, realtime, job', async (ctx) => {
    if (!database) return ctx.skip(server.available ? 'no database' : server.reason);
    const app = await boot();
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
    if (!database) return ctx.skip(server.available ? 'no database' : server.reason);
    const app = await boot();
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/disable',
    });
    expect(disabled.json()).toMatchObject({ id: 'sample', enabled: false });
    expect((await app.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    const gated = await app.inject({ url: '/api/v1/sample/items' });
    expect(gated.statusCode).toBe(404);
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });

    const restarted = await boot();
    expect((await restarted.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    expect((await restarted.inject({ url: '/api/v1/admin/modules' })).json()).toMatchObject({
      pinned: false,
      items: [{ id: 'sample', enabled: false, changelogState: 'current' }],
    });
  });

  it('follows BEMMOLY_MODULES and refuses changes through the API while pinned', async (ctx) => {
    if (!database) return ctx.skip(server.available ? 'no database' : server.reason);
    const app = await boot('sample');
    expect((await app.inject({ url: '/api/v1/modules' })).json().items).toHaveLength(1);
    const refused = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/disable',
    });
    expect(refused.statusCode).toBe(409);
  });
});
