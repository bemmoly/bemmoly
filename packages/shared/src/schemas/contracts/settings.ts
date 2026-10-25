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
/** A mode choice: light, dark, or follow the device live (ADR 0021). */
export const modePreferenceSchema = z.enum(['light', 'dark', 'system']);
/** The retired custom builder's surface tone; kept while the previous minor reads it. */
export const surfaceToneSchema = z.enum(['neutral', 'tinted']);
/** Which built-in theme lends a custom theme its surfaces. */
export const surfaceStyleSchema = z.enum(['neutral', 'warm']);
/** The five built-in themes, and "custom" for a saved custom theme (ADR 0021). */
export const builtInThemeIds = ['bemmoly', 'graphite', 'sand', 'pine', 'contrast'] as const;
export const workspaceThemeSchema = z.enum([...builtInThemeIds, 'custom']);

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
  /** A built-in theme id, or "custom" with appearance.customThemeId naming which one. */
  'appearance.theme': z.string().min(1),
  /** The custom theme's brand, mirrored so the previous minor still renders something close. */
  'appearance.brandColor': hexColorSchema,
  'appearance.font': themeFontSchema,
  'appearance.logoKey': z.string().max(512),
  /** What people see until they choose a mode; new workspaces follow the device. */
  'appearance.defaultMode': modePreferenceSchema,
  /** The workspace custom theme in use when appearance.theme is "custom". */
  'appearance.customThemeId': z.uuid().nullable(),
  /** Retired with the presets; still written for the previous minor, read by nothing new. */
  'appearance.mode': themeModeSchema,
  'appearance.surfaces': surfaceToneSchema,
  'appearance.memberModeSwitch': z.boolean(),
  'appearance.personalThemes': z.boolean(),
  /** Name and URL are the data kernel's; locale and timezone are assumed. */
  'workspace.name': z.string().trim().min(1).max(80),
  'workspace.url': z.union([z.literal(''), z.url()]),
  'workspace.locale': z.string().min(2),
  'workspace.timezone': z.string().min(1),
  /** Whether a shared link's preview names the page or issue; on unless an admin turns it off. */
  'workspace.linkPreviews': z.boolean(),
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
  /** Settings › MCP: the built-in MCP server, off until an admin turns it on. */
  'mcp.enabled': z.boolean(),
  /** The modules MCP clients may reach; null exposes every enabled module. */
  'mcp.modules': z.array(z.string()).nullable(),
  /** Assumed: set by the wizard's last step; the shell resumes the wizard until it exists. */
  'setup.completedAt': z.string().nullable(),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export type ThemeFont = z.infer<typeof themeFontSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ModePreference = z.infer<typeof modePreferenceSchema>;
export type SurfaceTone = z.infer<typeof surfaceToneSchema>;
export type SurfaceStyle = z.infer<typeof surfaceStyleSchema>;
export type WorkspaceTheme = z.infer<typeof workspaceThemeSchema>;
