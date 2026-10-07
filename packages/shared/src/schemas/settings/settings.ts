import { z } from 'zod';

/** `workspace.name`, `sample.greeting`: an owner (kernel area or module id), a dot, a name. */
export const SETTING_KEY_PATTERN = /^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+)+$/;

export const settingKeySchema = z
  .string()
  .max(128)
  .regex(SETTING_KEY_PATTERN, 'Setting keys look like "<area>.<name>"');

export const settingKeyParamsSchema = z.object({ key: settingKeySchema });

/**
 * One setting as the admin API returns it. Secrets are write-only: `value` is
 * absent and `isSet` says whether one is stored, so the UI shows "set" and a
 * replace field, never the value.
 */
export const settingResponseSchema = z.object({
  key: settingKeySchema,
  secret: z.boolean(),
  isSet: z.boolean(),
  isDefault: z.boolean(),
  value: z.json().optional(),
  updatedAt: z.iso.datetime().nullable(),
});

export const settingsListResponseSchema = z.object({
  items: z.array(settingResponseSchema),
});

/** PUT body: the whole new value ("replace"); for a secret, the new secret ("set"). */
export const putSettingBodySchema = z.object({ value: z.json() });

export type SettingResponse = z.infer<typeof settingResponseSchema>;
export type SettingsListResponse = z.infer<typeof settingsListResponseSchema>;
export type PutSettingBody = z.infer<typeof putSettingBodySchema>;
