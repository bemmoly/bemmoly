import { z } from 'zod';
import { smtpSecuritySchema } from '../email/api.ts';
import {
  backupEncryptionSettingsSchema,
  backupRetentionSettingsSchema,
  backupS3SettingsSchema,
  backupScheduleSettingsSchema,
  backupVerificationSettingsSchema,
} from '../system/backups.ts';
import { releaseChannelSchema } from '../system/release-manifest.ts';
import { hexColorSchema } from './common.ts';

export const themeFontSchema = z.enum(['plex', 'inter', 'source', 'geist']);
export const themeModeSchema = z.enum(['light', 'dark']);
export const surfaceToneSchema = z.enum(['neutral', 'tinted']);

/** The custom builder's inputs; buildTheme turns them into the full token set. */
export const customThemeSchema = z.object({
  brandColor: hexColorSchema,
  mode: themeModeSchema,
  surfaces: surfaceToneSchema,
  font: themeFontSchema,
});

/**
 * Keys under /api/v1/admin/settings/:key and the value each holds. Kernel
 * (workspace, appearance), email and system keys are confirmed by their
 * streams; the rest are the web shell's request and are marked as assumed.
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
  /** A preset id (the server calls Classic "classic"), or "custom". */
  'appearance.theme': z.string().min(1),
  'appearance.brandColor': hexColorSchema,
  'appearance.font': themeFontSchema,
  'appearance.logoKey': z.string().max(512),
  /** Assumed: the custom builder's mode and surface tone, and the member policy. */
  'appearance.mode': themeModeSchema,
  'appearance.surfaces': surfaceToneSchema,
  'appearance.memberModeSwitch': z.boolean(),
  'appearance.personalThemes': z.boolean(),
  /** Name and URL are the data kernel's; locale and timezone are assumed. */
  'workspace.name': z.string().trim().min(1).max(80),
  'workspace.url': z.union([z.literal(''), z.url()]),
  'workspace.locale': z.string().min(2),
  'workspace.timezone': z.string().min(1),
  /** Assumed: the wizard's AI step until the AI runtime owns its tables. */
  'ai.providerId': z.string().nullable(),
  'ai.shareContent': z.boolean(),
  'ai.allowActions': z.boolean(),
  /** The operations stream's keys for Storage and backups and Updates. */
  'system.backups.schedule': backupScheduleSettingsSchema,
  'system.backups.retention': backupRetentionSettingsSchema,
  /** Secret: the whole S3 destination is one write-only value. */
  'system.backups.s3': backupS3SettingsSchema.nullable(),
  'system.backups.encryption': backupEncryptionSettingsSchema,
  'system.backups.verification': backupVerificationSettingsSchema,
  'system.updates.channel': releaseChannelSchema,
  'system.updates.check': z.boolean(),
  /** Assumed: set by the wizard's last step; the shell resumes the wizard until it exists. */
  'setup.completedAt': z.string().nullable(),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export type ThemeFont = z.infer<typeof themeFontSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type SurfaceTone = z.infer<typeof surfaceToneSchema>;
export type CustomTheme = z.infer<typeof customThemeSchema>;
