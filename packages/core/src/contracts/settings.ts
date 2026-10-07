import type { z } from 'zod';
import type { Actor } from './authz.ts';

/**
 * Typed setting keys. Kernel services and modules add their keys with
 * declaration merging: `declare module '@bemmoly/core' { interface SettingsKeys { ... } }`.
 */
export interface SettingsKeys {
  'workspace.name': string;
}

export type SettingKey = keyof SettingsKeys & string;

export interface SettingDefinition<Value = unknown> {
  key: string;
  schema: z.ZodType<Value>;
  default: Value;
  /** Encrypted at rest with the install's secret key and write-only in the API. */
  secret?: boolean;
}

export interface SettingsService {
  get<Key extends SettingKey>(key: Key): Promise<SettingsKeys[Key]>;
  set<Key extends SettingKey>(key: Key, value: SettingsKeys[Key], actor: Actor): Promise<void>;
}
