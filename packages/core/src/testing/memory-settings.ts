import type { Actor } from '../contracts/authz.ts';
import type { SettingKey, SettingsKeys, SettingsService } from '../contracts/settings.ts';
import { KERNEL_SETTINGS } from '../services/settings/index.ts';

const DEFAULTS = new Map<string, unknown>(
  KERNEL_SETTINGS.map((definition) => [definition.key, definition.default]),
);

/**
 * An in-memory SettingsService for tests. Unset keys read as the kernel's
 * defaults, like the database-backed service; keys it does not know read as "".
 */
export function createMemorySettings(
  initial: Partial<SettingsKeys> = {},
): SettingsService & { writes: { key: string; actor: Actor }[] } {
  const values = new Map<string, unknown>(Object.entries(initial));
  const writes: { key: string; actor: Actor }[] = [];
  return {
    writes,
    async get<Key extends SettingKey>(key: Key): Promise<SettingsKeys[Key]> {
      const fallback = DEFAULTS.has(key) ? DEFAULTS.get(key) : '';
      const value = values.has(key) ? values.get(key) : fallback;
      return value as SettingsKeys[Key];
    },
    async set<Key extends SettingKey>(key: Key, value: SettingsKeys[Key], actor: Actor) {
      values.set(key, value);
      writes.push({ key, actor });
    },
  };
}
