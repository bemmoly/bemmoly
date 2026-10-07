import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { SettingDefinition } from '../../contracts/settings.ts';
import type { SettingRow } from '../../models/settings.ts';
import { capabilityForSettingKey, createSettingsAdmin } from './admin.ts';
import { EMAIL_SETTING_DEFINITIONS } from '../email/index.ts';
import { SYSTEM_SETTINGS } from '../system/index.ts';
import { createSettingsCatalog } from './catalog.ts';
import { KERNEL_SETTINGS } from './kernel-settings.ts';
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

function setup(extra: readonly SettingDefinition[] = []) {
  const store = memoryStore();
  const realtime = { publish: vi.fn(async () => undefined) };
  const settings = createSettingsService({
    store,
    catalog: createSettingsCatalog(undefined, [...definitions, ...extra]),
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

describe('settings admin by key group', () => {
  /** An authorize that grants exactly these workspace capabilities. */
  const holding =
    (...held: string[]): Authorize =>
    async (_actor, capability) => {
      if (!held.includes(capability)) throw new ForbiddenError();
    };

  it('maps each key group to the capability that owns it', () => {
    expect(capabilityForSettingKey('appearance.theme')).toBe('workspace.appearance.manage');
    expect(capabilityForSettingKey('email.smtp.host')).toBe('workspace.email.manage');
    expect(capabilityForSettingKey('system.backups.schedule')).toBe('workspace.system.manage');
    expect(capabilityForSettingKey('workspace.name')).toBe('workspace.settings.manage');
    expect(capabilityForSettingKey('auth.passwordLogin')).toBe('workspace.settings.manage');
  });

  it('lets an appearance manager read the list and save appearance, and nothing else', async () => {
    const { settings } = setup([
      { key: 'appearance.theme', schema: z.string(), default: 'classic' },
    ]);
    const designer = createSettingsAdmin({
      settings,
      authorize: holding('workspace.appearance.manage'),
    });
    expect((await designer.list(admin)).map((item) => item.key)).toContain('appearance.theme');
    expect((await designer.put(admin, 'appearance.theme', 'midnight')).value).toBe('midnight');
    await designer.reset(admin, 'appearance.theme');
    await expect(designer.put(admin, 'workspace.name', 'X')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(designer.put(admin, 'email.smtp.password', 'x')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('keeps general settings to settings managers and the list from people with no manage capability', async () => {
    const { settings } = setup([
      { key: 'appearance.theme', schema: z.string(), default: 'classic' },
    ]);
    const general = createSettingsAdmin({
      settings,
      authorize: holding('workspace.settings.manage'),
    });
    expect((await general.put(admin, 'workspace.name', 'X')).value).toBe('X');
    await expect(general.put(admin, 'appearance.theme', 'warm')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const auditor = createSettingsAdmin({ settings, authorize: holding('workspace.audit.view') });
    await expect(auditor.list(admin)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('passes on errors that are not refusals', async () => {
    const { settings } = setup();
    const broken = createSettingsAdmin({
      settings,
      authorize: async () => {
        throw new Error('database down');
      },
    });
    await expect(broken.list(admin)).rejects.toThrow('database down');
  });
});

describe('settings catalog', () => {
  it('refuses a key the API key schema would reject', () => {
    const bad = { key: 'system.updates.manifest_url', schema: z.string(), default: '' };
    expect(() => createSettingsCatalog(undefined, [bad])).toThrow(/must look like/);
  });

  it('accepts every key the kernel, email and system services register', () => {
    const all = [...KERNEL_SETTINGS, ...EMAIL_SETTING_DEFINITIONS, ...SYSTEM_SETTINGS];
    expect(() => createSettingsCatalog(undefined, all)).not.toThrow();
  });
});
