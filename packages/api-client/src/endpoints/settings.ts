import {
  aiProviderChoiceSchema,
  appearanceSchema,
  backupScheduleSchema,
  backupScheduleUpdateSchema,
  settingSchema,
  SETTING_KEYS,
  smtpSettingsSchema,
  smtpSettingsUpdateSchema,
  updatePreferencesSchema,
  workspaceSettingsSchema,
  type SettingKey,
} from '@bemmoly/shared';
import type { z } from 'zod';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

interface SettingDefinition<Read extends z.ZodType, Write extends z.ZodType> {
  key: SettingKey;
  read: Read;
  write: Write;
}

const define = <Read extends z.ZodType, Write extends z.ZodType>(
  key: SettingKey,
  read: Read,
  write: Write,
): SettingDefinition<Read, Write> => ({ key, read, write });

/** Each key pairs the shape the server returns with the shape the form sends. */
export const SETTINGS = {
  workspace: define(SETTING_KEYS.workspace, workspaceSettingsSchema, workspaceSettingsSchema),
  appearance: define(SETTING_KEYS.appearance, appearanceSchema, appearanceSchema),
  smtp: define(SETTING_KEYS.smtp, smtpSettingsSchema, smtpSettingsUpdateSchema),
  aiProvider: define(SETTING_KEYS.aiProvider, aiProviderChoiceSchema, aiProviderChoiceSchema),
  backups: define(SETTING_KEYS.backups, backupScheduleSchema, backupScheduleUpdateSchema),
  updates: define(SETTING_KEYS.updates, updatePreferencesSchema, updatePreferencesSchema),
} as const;

export type SettingName = keyof typeof SETTINGS;
export type SettingValue<N extends SettingName> = z.output<(typeof SETTINGS)[N]['read']>;
export type SettingInput<N extends SettingName> = z.input<(typeof SETTINGS)[N]['write']>;

export function settingsEndpoints(http: Http) {
  return {
    get: async <N extends SettingName>(name: N) => {
      const definition = SETTINGS[name];
      return http.request(
        `/api/v1/admin/settings/${enc(definition.key)}`,
        settingSchema(definition.read),
      ) as Promise<{ key: string; value: SettingValue<N>; updatedAt: string | null }>;
    },
    put: async <N extends SettingName>(name: N, value: SettingInput<N>) => {
      const definition = SETTINGS[name];
      return http.request(
        `/api/v1/admin/settings/${enc(definition.key)}`,
        settingSchema(definition.read),
        { method: 'PUT', body: { value: validated(definition.write, value) } },
      ) as Promise<{ key: string; value: SettingValue<N>; updatedAt: string | null }>;
    },
  };
}
