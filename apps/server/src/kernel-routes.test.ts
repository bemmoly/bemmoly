import {
  createMemoryModuleStateStore,
  createModuleAdmin,
  createModuleState,
  createSecretBox,
  createSettingsAdmin,
  createSettingsCatalog,
  createSettingsService,
  KERNEL_SETTINGS,
  loadModules,
  type Actor,
  type SettingsStore,
} from '@bemmoly/core';
import { createLogger } from '@bemmoly/core/config';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from './app.ts';
import { importAvailableModules } from './config/modules.ts';
import { TEST_ENV } from './test-support.ts';

const admin: Actor = { kind: 'user', id: 'admin' };
const logger = createLogger({ LOG_LEVEL: 'fatal', LOG_FORMAT: 'json' });

function memorySettings(): SettingsStore {
  const rows = new Map<string, Awaited<ReturnType<SettingsStore['put']>>>();
  return {
    get: async (key) => rows.get(key),
    list: async () => [...rows.values()],
    async put(write) {
      const now = new Date();
      const row = {
        id: write.key,
        createdAt: now,
        updatedAt: now,
        ...write,
        value: write.isSecret ? null : write.value,
      };
      rows.set(write.key, row);
      return row;
    },
    remove: async (key) => void rows.delete(key),
  };
}

async function app(options: { signedIn: boolean }) {
  const registry = loadModules({ available: await importAvailableModules() });
  const store = createMemoryModuleStateStore();
  const state = createModuleState({ registry, store, contexts: ['test'], pinned: [], logger });
  await state.initialize({ migrate: false });
  const authorize = async () => undefined;
  const settings = createSettingsService({
    store: memorySettings(),
    catalog: createSettingsCatalog(registry, [
      ...KERNEL_SETTINGS,
      { key: 'email.smtp.password', schema: z.string(), default: '', secret: true },
    ]),
    secrets: createSecretBox(Buffer.alloc(32, 3).toString('base64')),
    logger,
  });
  return buildApp({
    env: TEST_ENV,
    modules: registry,
    logger: false,
    kernel: {
      moduleState: state,
      moduleAdmin: createModuleAdmin({ registry, state, store, contexts: ['test'], authorize }),
      settings: createSettingsAdmin({ settings, authorize }),
      ...(options.signedIn ? { authenticate: async () => admin } : {}),
    },
  });
}

describe('kernel admin routes', () => {
  it('answers 401 without a signed-in actor', async () => {
    const server = await app({ signedIn: false });
    const response = await server.inject({ url: '/api/v1/admin/settings/workspace.name' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthenticated' });
  });

  it('replaces a setting and keeps secrets write-only', async () => {
    const server = await app({ signedIn: true });
    const put = await server.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/email.smtp.password',
      payload: { value: 'hunter2' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual(expect.objectContaining({ secret: true, isSet: true }));
    expect(put.body).not.toContain('hunter2');
    const bad = await server.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/appearance.brandColor',
      payload: { value: 'blue' },
    });
    expect(bad.statusCode).toBe(400);
    const reset = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/settings/workspace.name',
    });
    expect(reset.statusCode).toBe(204);
    const missing = await server.inject({ url: '/api/v1/admin/settings/nope.key' });
    expect(missing.statusCode).toBe(404);
  });

  it('gates a disabled module with 404 module_not_enabled and re-opens it on enable', async () => {
    const server = await app({ signedIn: true });
    expect((await server.inject({ url: '/api/v1/sample/items' })).statusCode).toBe(502);
    const disabled = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/modules/sample/disable',
    });
    expect(disabled.json()).toMatchObject({ id: 'sample', enabled: false });
    const gated = await server.inject({ url: '/api/v1/sample/greeting' });
    expect(gated.statusCode).toBe(404);
    expect(gated.json()).toMatchObject({ code: 'module_not_enabled' });
    expect((await server.inject({ url: '/api/v1/modules' })).json()).toEqual({ items: [] });
    await server.inject({ method: 'POST', url: '/api/v1/admin/modules/sample/enable' });
    expect((await server.inject({ url: '/api/v1/modules' })).json().items).toHaveLength(1);
  });
});
