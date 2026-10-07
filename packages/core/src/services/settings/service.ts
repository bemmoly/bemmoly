import { parseOrThrow, type SettingResponse } from '@bemmoly/shared';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { RealtimeMessage, RealtimePublisher } from '../../contracts/realtime.ts';
import type { SettingKey, SettingsKeys, SettingsService } from '../../contracts/settings.ts';
import type { SettingRow } from '../../models/settings.ts';
import type { CatalogEntry, SettingsCatalog } from './catalog.ts';
import type { SecretBox } from './crypto.ts';
import type { SettingsStore } from './store.ts';

export const SETTINGS_CHANGED = 'settings.changed';

export interface KernelSettingsService extends SettingsService {
  /** Untyped read by key, for keys only known at runtime (module settings). */
  read(key: string): Promise<unknown>;
  /** Untyped validated write, for the admin API. */
  write(key: string, value: unknown, actor: Actor): Promise<SettingRow>;
  /** Back to the default: deletes the stored row. */
  reset(key: string, actor: Actor): Promise<void>;
  /** The API view: secrets are write-only, so only `isSet` is shown. */
  view(key: string): Promise<SettingResponse>;
  viewAll(): Promise<SettingResponse[]>;
  /** Drops cached values named by a realtime message; wired to the LISTEN client. */
  handleRealtime(message: RealtimeMessage): void;
  catalog: SettingsCatalog;
}

export interface SettingsServiceDeps {
  store: SettingsStore;
  catalog: SettingsCatalog;
  secrets: SecretBox;
  realtime?: RealtimePublisher;
  logger: Logger;
}

function toView(entry: CatalogEntry, row: SettingRow | undefined): SettingResponse {
  const { definition } = entry;
  const secret = definition.secret ?? false;
  const view: SettingResponse = {
    key: definition.key,
    secret,
    isSet: secret ? Boolean(row?.encrypted) : true,
    isDefault: row === undefined,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
  if (!secret) view.value = (row ? row.value : definition.default) as SettingResponse['value'];
  return view;
}

export function createSettingsService(deps: SettingsServiceDeps): KernelSettingsService {
  const { store, catalog, secrets, logger } = deps;
  const cache = new Map<string, unknown>();

  function decode(entry: CatalogEntry, row: SettingRow | undefined): unknown {
    const { definition } = entry;
    if (!row) return definition.default;
    const raw =
      definition.secret && row.encrypted
        ? JSON.parse(secrets.open(row.encrypted, definition.key))
        : row.value;
    const parsed = definition.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    logger.warn(
      { key: definition.key },
      'stored setting no longer matches its schema; using the default',
    );
    return definition.default;
  }

  async function announce(entry: CatalogEntry): Promise<void> {
    cache.delete(entry.definition.key);
    await deps.realtime?.publish({
      kind: SETTINGS_CHANGED,
      ids: [entry.definition.key],
      ...(entry.moduleId ? { moduleId: entry.moduleId } : {}),
    });
  }

  async function read(key: string): Promise<unknown> {
    if (cache.has(key)) return cache.get(key);
    const entry = catalog.get(key);
    const value = decode(entry, await store.get(key));
    cache.set(key, value);
    return value;
  }

  async function write(key: string, value: unknown, actor: Actor): Promise<SettingRow> {
    const entry = catalog.get(key);
    const { definition } = entry;
    const valid = parseOrThrow(definition.schema, value);
    const secret = definition.secret ?? false;
    const row = await store.put({
      key,
      value: secret ? null : valid,
      isSecret: secret,
      encrypted: secret ? secrets.seal(JSON.stringify(valid), key) : null,
      updatedBy: `${actor.kind}:${actor.id}`,
    });
    await announce(entry);
    return row;
  }

  return {
    catalog,
    get: async <Key extends SettingKey>(key: Key) => (await read(key)) as SettingsKeys[Key],
    async set<Key extends SettingKey>(key: Key, value: SettingsKeys[Key], actor: Actor) {
      await write(key, value, actor);
    },
    read,
    write,
    async reset(key, actor) {
      const entry = catalog.get(key);
      await store.remove(key);
      logger.info({ key, actor: `${actor.kind}:${actor.id}` }, 'setting reset to default');
      await announce(entry);
    },
    async view(key) {
      return toView(catalog.get(key), await store.get(key));
    },
    async viewAll() {
      const rows = new Map((await store.list()).map((row) => [row.key, row]));
      return catalog.list().map((entry) => toView(entry, rows.get(entry.definition.key)));
    },
    handleRealtime(message) {
      if (message.kind !== SETTINGS_CHANGED) return;
      for (const key of message.ids) cache.delete(key);
    },
  };
}
