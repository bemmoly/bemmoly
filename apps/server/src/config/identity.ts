import {
  createIdentityDependencies,
  type EventBus,
  type IdentityDependencies,
  type ModuleRegistry,
  type SettingKey,
  type SettingsKeys,
  type SettingsService,
  type SqlClient,
} from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';

/**
 * TEMPORARY until the database-backed settings service is wired here: keeps
 * workspace settings in memory, so they reset on restart. Replace with the
 * kernel settings service; nothing else in identity changes.
 */
function inMemorySettings(): SettingsService {
  const values = new Map<string, unknown>();
  return {
    async get<Key extends SettingKey>(key: Key) {
      return (values.get(key) ?? '') as SettingsKeys[Key];
    },
    async set<Key extends SettingKey>(key: Key, value: SettingsKeys[Key]) {
      values.set(key, value);
    },
  };
}

/** Identity needs Postgres; without a database the server runs with only health and modules. */
export function identityFor(
  env: Pick<Env, 'BEMMOLY_PUBLIC_URL'>,
  database: DatabaseConnection | undefined,
  modules: ModuleRegistry,
  events: EventBus,
): (IdentityDependencies & { sql: SqlClient }) | undefined {
  if (!database) return undefined;
  return createIdentityDependencies({
    sql: database.sql,
    modules,
    events,
    settings: inMemorySettings(),
    publicUrl: env.BEMMOLY_PUBLIC_URL,
  });
}
