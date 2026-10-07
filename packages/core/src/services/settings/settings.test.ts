import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { SettingDefinition } from '../../contracts/settings.ts';
import type { SettingRow } from '../../models/settings.ts';
import { createSettingsAdmin } from './admin.ts';
import { createSettingsCatalog } from './catalog.ts';
import { createSecretBox } from './crypto.ts';
import { createSettingsService } from './service.ts';
import type { SettingsStore } from './store.ts';

const KEY = Buffer.alloc(32, 9).toString('base64');
const admin: Actor = { kind: 'user', id: 'admin' };

function memoryStore(): SettingsStore & { rows: Map<string, SettingRow> } {
  const rows = new Map<string, SettingRow>();
  return {
    rows,
    get: async (key) => rows.get(key),
    list: async () => [...rows.values()],
    async put(write) {
      const now = new Date();
      const row: SettingRow = {
        id: write.key,
        key: write.key,
        value: write.value,
        isSecret: write.isSecret,
        encrypted: write.encrypted,
        updatedBy: write.updatedBy,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(write.key, row);
      return row;
    },
    remove: async (key) => void rows.delete(key),
  };
}

const definitions: SettingDefinition[] = [
  { key: 'workspace.name', schema: z.string().min(1), default: 'Bemmoly' },
  { key: 'email.smtp.password', schema: z.string().min(1), default: '', secret: true },
];

function setup() {
  const store = memoryStore();
  const realtime = { publish: vi.fn(async () => undefined) };
  const settings = createSettingsService({
    store,
    catalog: createSettingsCatalog(undefined, definitions),
    secrets: createSecretBox(KEY),
    realtime,
    logger: pino({ level: 'silent' }),
  });
  return { store, realtime, settings };
}

describe('secret box', () => {
  it('round-trips, binds the setting key and rejects another install key', () => {
    const box = createSecretBox(KEY);
    const sealed = box.seal('hunter2', 'email.smtp.password');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('hunter2');
    expect(box.open(sealed, 'email.smtp.password')).toBe('hunter2');
    expect(() => box.open(sealed, 'other.key')).toThrow(/cannot be decrypted/);
    const other = createSecretBox(Buffer.alloc(32, 1).toString('base64'));
    expect(() => other.open(sealed, 'email.smtp.password')).toThrow(/BEMMOLY_SECRET_KEY/);
  });
});

describe('settings service', () => {
  it('returns defaults, validates writes and announces changes', async () => {
    const { settings, realtime } = setup();
    expect(await settings.get('workspace.name')).toBe('Bemmoly');
    await expect(settings.write('workspace.name', '', admin)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await settings.set('workspace.name', 'Acme', admin);
    expect(await settings.get('workspace.name')).toBe('Acme');
    expect(realtime.publish).toHaveBeenCalledWith({
      kind: 'settings.changed',
      ids: ['workspace.name'],
    });
    await expect(settings.read('nope.key')).rejects.toThrow(/no setting/);
  });

  it('stores secrets encrypted and never shows them in the API view', async () => {
    const { settings, store } = setup();
    await settings.write('email.smtp.password', 's3cret', admin);
    const row = store.rows.get('email.smtp.password');
    expect(row?.value).toBeNull();
    expect(row?.encrypted).not.toContain('s3cret');
    expect(await settings.read('email.smtp.password')).toBe('s3cret');
    const view = await settings.view('email.smtp.password');
    expect(view).toMatchObject({ secret: true, isSet: true, isDefault: false });
    expect(view).not.toHaveProperty('value');
  });

  it('serves from cache until a realtime message invalidates the key', async () => {
    const { settings, store } = setup();
    await settings.set('workspace.name', 'One', admin);
    expect(await settings.get('workspace.name')).toBe('One');
    store.rows.set('workspace.name', { ...store.rows.get('workspace.name')!, value: 'Two' });
    expect(await settings.get('workspace.name')).toBe('One');
    settings.handleRealtime({ kind: 'settings.changed', ids: ['workspace.name'] });
    expect(await settings.get('workspace.name')).toBe('Two');
  });

  it('resets to the default', async () => {
    const { settings } = setup();
    await settings.set('workspace.name', 'Acme', admin);
    await settings.reset('workspace.name', admin);
    expect(await settings.view('workspace.name')).toMatchObject({
      value: 'Bemmoly',
      isDefault: true,
    });
  });
});

describe('settings admin', () => {
  it('authorizes every call before touching settings', async () => {
    const { settings } = setup();
    const deny: Authorize = async () => {
      throw new ForbiddenError();
    };
    const denied = createSettingsAdmin({ settings, authorize: deny });
    await expect(denied.put(admin, 'workspace.name', 'X')).rejects.toBeInstanceOf(ForbiddenError);
    expect(await settings.get('workspace.name')).toBe('Bemmoly');
    const authorize = vi.fn(async () => undefined);
    const allowed = createSettingsAdmin({ settings, authorize });
    expect((await allowed.put(admin, 'workspace.name', 'X')).value).toBe('X');
    expect(authorize).toHaveBeenCalledWith(admin, 'workspace.settings.manage', {
      kind: 'workspace',
    });
    expect((await allowed.list(admin)).map((item) => item.key)).toEqual([
      'email.smtp.password',
      'workspace.name',
    ]);
  });
});
