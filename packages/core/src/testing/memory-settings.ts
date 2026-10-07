import type { Actor } from '../contracts/authz.ts';
import type { SettingKey, SettingsKeys, SettingsService } from '../contracts/settings.ts';

/**
 * An in-memory SettingsService for tests, and TEMPORARILY for the dev server
 * until the database-backed settings service is wired. Values are lost on restart.
 */
export function createMemorySettings(
  initial: Partial<SettingsKeys> = {},
): SettingsService & { writes: { key: string; actor: Actor }[] } {
  const values = new Map<string, unknown>(Object.entries(initial));
  const writes: { key: string; actor: Actor }[] = [];
  return {
    writes,
    async get<Key extends SettingKey>(key: Key): Promise<SettingsKeys[Key]> {
      return (values.get(key) ?? '') as SettingsKeys[Key];
    },
    async set<Key extends SettingKey>(key: Key, value: SettingsKeys[Key], actor: Actor) {
      values.set(key, value);
      writes.push({ key, actor });
    },
  };
}
