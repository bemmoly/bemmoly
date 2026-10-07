import { z } from 'zod';
import { hexColorSchema } from './common.ts';

export const themeFontSchema = z.enum(['plex', 'inter', 'source', 'geist']);
export const themeModeSchema = z.enum(['light', 'dark']);
export const surfaceToneSchema = z.enum(['neutral', 'tinted']);
export const smtpSecuritySchema = z.enum(['starttls', 'tls', 'none']);
export const updateChannelSchema = z.enum(['stable', 'beta']);
export const backupFrequencySchema = z.enum(['hourly', 'every_6_hours', 'daily', 'weekly']);

/** The custom builder's inputs; buildTheme turns them into the full token set. */
export const customThemeSchema = z.object({
  brandColor: hexColorSchema,
  mode: themeModeSchema,
  surfaces: surfaceToneSchema,
  font: themeFontSchema,
});

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
    .object({ endpoint: z.string(), bucket: z.string(), region: z.string(), prefix: z.string() })
    .nullable(),
  encryption: z.boolean(),
  verification: z.enum(['weekly', 'daily', 'off']),
});

/**
 * Keys under /api/v1/admin/settings/:key and the value each holds. The email
 * and appearance keys are confirmed by the email stream; the rest are the web
 * shell's request to the data kernel stream and are marked so.
 */
export const SETTING_SCHEMAS = {
  'email.provider': z.enum(['smtp', 'log']),
  'email.smtp.host': z.string(),
  'email.smtp.port': z.number().int().min(1).max(65535),
  'email.smtp.security': smtpSecuritySchema,
  'email.smtp.username': z.string(),
  /** Secret: write-only; reads say only whether it is set. */
  'email.smtp.password': z.string(),
  'email.from': z.string(),
  'email.replyTo': z.string().nullable(),
  'email.digestMinutes': z.number().int().min(1).max(1440),
  /** A preset id from @bemmoly/ui tokens, or "custom". */
  'appearance.theme': z.string().min(1),
  'appearance.brandColor': hexColorSchema.nullable(),
  'appearance.font': themeFontSchema,
  'appearance.logoKey': z.string().nullable(),
  /** Assumed: the custom builder's mode and surface tone, and the member policy. */
  'appearance.mode': themeModeSchema,
  'appearance.surfaces': surfaceToneSchema,
  'appearance.memberModeSwitch': z.boolean(),
  'appearance.personalThemes': z.boolean(),
  /** Assumed: workspace details. */
  'workspace.name': z.string().trim().min(1).max(100),
  'workspace.url': z.string(),
  'workspace.locale': z.string().min(2),
  'workspace.timezone': z.string().min(1),
  /** Assumed: the wizard's AI step until the AI runtime owns its tables. */
  'ai.providerId': z.string().nullable(),
  'ai.shareContent': z.boolean(),
  'ai.allowActions': z.boolean(),
  /** Assumed: Settings › Storage and backups and Settings › Updates. */
  'backups.schedule': backupScheduleSchema,
  /** Assumed secrets for the S3 destination: write-only. */
  'backups.s3.accessKeyId': z.string(),
  'backups.s3.secretAccessKey': z.string(),
  'updates.channel': updateChannelSchema,
  'updates.checkForUpdates': z.boolean(),
  /** Assumed: set by the wizard's last step; the shell resumes the wizard until it exists. */
  'setup.completedAt': z.string().nullable(),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

/** Lenient envelope: secrets come back without a value and with `isSet`. */
export const settingEnvelopeSchema = z.looseObject({
  key: z.string(),
  value: z.unknown().optional(),
  isSet: z.boolean().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type ThemeFont = z.infer<typeof themeFontSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type SurfaceTone = z.infer<typeof surfaceToneSchema>;
export type CustomTheme = z.infer<typeof customThemeSchema>;
export type SmtpSecurity = z.infer<typeof smtpSecuritySchema>;
export type UpdateChannel = z.infer<typeof updateChannelSchema>;
export type BackupFrequency = z.infer<typeof backupFrequencySchema>;
export type BackupSchedule = z.infer<typeof backupScheduleSchema>;
