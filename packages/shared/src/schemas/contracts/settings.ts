import { z } from 'zod';
import { hexColorSchema, timestampSchema } from './common.ts';

/** Keys under /api/v1/admin/settings/:key that the web shell reads and writes. */
export const SETTING_KEYS = {
  workspace: 'workspace',
  appearance: 'appearance',
  smtp: 'email.smtp',
  aiProvider: 'ai.provider',
  backups: 'backups.schedule',
  updates: 'updates',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export function settingSchema<T extends z.ZodType>(value: T) {
  return z.object({ key: z.string(), value, updatedAt: timestampSchema.nullable() });
}

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name the workspace').max(80),
  url: z.string().trim().min(1),
  locale: z.string().min(2),
  timezone: z.string().min(1),
});

export const themeFontSchema = z.enum(['plex', 'inter', 'source', 'geist']);
export const themeModeSchema = z.enum(['light', 'dark']);
export const surfaceToneSchema = z.enum(['neutral', 'tinted']);

export const customThemeSchema = z.object({
  brandColor: hexColorSchema,
  mode: themeModeSchema,
  surfaces: surfaceToneSchema,
  font: themeFontSchema,
});

/** `preset` is a preset id from @bemmoly/ui tokens, or "custom" to use `custom`. */
export const appearanceSchema = z.object({
  preset: z.string().min(1),
  custom: customThemeSchema.nullable(),
  logoUrl: z.string().nullable(),
  policy: z.object({
    memberModeSwitch: z.boolean(),
    personalThemes: z.boolean(),
  }),
});

export const smtpSecuritySchema = z.enum(['starttls', 'tls', 'none']);

/** What the server returns: secrets are write-only, so only whether one is set. */
export const smtpSettingsSchema = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  security: smtpSecuritySchema,
  username: z.string(),
  passwordSet: z.boolean(),
  fromAddress: z.string(),
  replyTo: z.string().nullable(),
});

/** What the form sends: omit `password` to keep the stored one. */
export const smtpSettingsUpdateSchema = z.object({
  host: z.string().trim().min(1, 'Enter the SMTP host'),
  port: z.number().int().min(1).max(65535),
  security: smtpSecuritySchema,
  username: z.string().trim(),
  password: z.string().min(1).optional(),
  fromAddress: z.email('Enter the address mail is sent from'),
  replyTo: z.email().nullable(),
});

/** The setup wizard's AI step: which catalog provider was chosen, and the privacy toggles. */
export const aiProviderChoiceSchema = z.object({
  providerId: z.string().min(1).nullable(),
  shareContent: z.boolean(),
  allowActions: z.boolean(),
});

export const backupFrequencySchema = z.enum(['hourly', 'every_6_hours', 'daily', 'weekly']);

export const backupScheduleSchema = z.object({
  frequency: backupFrequencySchema,
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'),
  timezone: z.string().min(1),
  retention: z.object({
    hourly: z.number().int().min(0).max(168),
    daily: z.number().int().min(0).max(365),
    weekly: z.number().int().min(0).max(104),
    monthly: z.number().int().min(0).max(120),
  }),
  localPath: z.string().min(1),
  s3: z
    .object({
      endpoint: z.string(),
      bucket: z.string(),
      region: z.string(),
      prefix: z.string(),
      accessKeyIdSet: z.boolean(),
      secretSet: z.boolean(),
    })
    .nullable(),
  encryption: z.boolean(),
  verification: z.enum(['weekly', 'daily', 'off']),
});

export const backupScheduleUpdateSchema = backupScheduleSchema.extend({
  s3: z
    .object({
      endpoint: z.string().trim().min(1),
      bucket: z.string().trim().min(1),
      region: z.string().trim(),
      prefix: z.string().trim(),
      accessKeyId: z.string().min(1).optional(),
      secretAccessKey: z.string().min(1).optional(),
    })
    .nullable(),
});

export const updateChannelSchema = z.enum(['stable', 'beta']);

export const updatePreferencesSchema = z.object({
  channel: updateChannelSchema,
  checkForUpdates: z.boolean(),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export type ThemeFont = z.infer<typeof themeFontSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type SurfaceTone = z.infer<typeof surfaceToneSchema>;
export type CustomTheme = z.infer<typeof customThemeSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type SmtpSecurity = z.infer<typeof smtpSecuritySchema>;
export type SmtpSettings = z.infer<typeof smtpSettingsSchema>;
export type SmtpSettingsUpdate = z.infer<typeof smtpSettingsUpdateSchema>;
export type AiProviderChoice = z.infer<typeof aiProviderChoiceSchema>;
export type BackupFrequency = z.infer<typeof backupFrequencySchema>;
export type BackupSchedule = z.infer<typeof backupScheduleSchema>;
export type BackupScheduleUpdate = z.infer<typeof backupScheduleUpdateSchema>;
export type UpdateChannel = z.infer<typeof updateChannelSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
