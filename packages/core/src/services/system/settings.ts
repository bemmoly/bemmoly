import {
  backupEncryptionSettingsSchema,
  backupRetentionSettingsSchema,
  backupS3SettingsSchema,
  backupScheduleSettingsSchema,
  backupVerificationSettingsSchema,
  releaseChannelSchema,
  type BackupEncryptionSettings,
  type BackupRetentionSettings,
  type BackupS3Settings,
  type BackupScheduleSettings,
  type BackupVerificationSettings,
  type ReleaseChannel,
} from '@bemmoly/shared';
import { z } from 'zod';
import type { SettingDefinition, SettingsKeys, SettingsService } from '../../contracts/settings.ts';

declare module '../../contracts/settings.ts' {
  interface SettingsKeys {
    'system.backups.schedule': BackupScheduleSettings;
    'system.backups.retention': BackupRetentionSettings;
    'system.backups.s3': BackupS3Settings | null;
    'system.backups.encryption': BackupEncryptionSettings;
    'system.backups.verification': BackupVerificationSettings;
    'system.updates.channel': ReleaseChannel;
    'system.updates.check': boolean;
    'system.updates.manifest_url': string | null;
  }
}

/**
 * Where the newest release manifest of each channel lives. Stable is the latest GitHub
 * release's asset; beta needs a stable address for pre-releases (see the report).
 */
export const DEFAULT_MANIFEST_URLS = {
  stable: 'https://github.com/bemmoly/bemmoly/releases/latest/download/release-manifest.json',
  beta: 'https://get.bemmoly.dev/releases/beta/release-manifest.json',
} as const;

/** The manifest URL for a channel; an admin-set URL (an internal mirror) wins. */
export function manifestUrlFor(channel: 'stable' | 'beta', override: string | null): string {
  return override ?? DEFAULT_MANIFEST_URLS[channel];
}

const SYSTEM_DEFAULTS = {
  'system.backups.schedule': backupScheduleSettingsSchema.parse({}),
  'system.backups.retention': backupRetentionSettingsSchema.parse({}),
  'system.backups.s3': null,
  'system.backups.encryption': backupEncryptionSettingsSchema.parse({}),
  'system.backups.verification': backupVerificationSettingsSchema.parse({}),
  'system.updates.channel': 'stable',
  'system.updates.check': false,
  'system.updates.manifest_url': null,
} as const satisfies {
  [Key in SystemSettingKey]: unknown;
};

export type SystemSettingKey =
  | 'system.backups.schedule'
  | 'system.backups.retention'
  | 'system.backups.s3'
  | 'system.backups.encryption'
  | 'system.backups.verification'
  | 'system.updates.channel'
  | 'system.updates.check'
  | 'system.updates.manifest_url';

/**
 * The system settings, registered with the settings service at boot. The S3
 * destination is one secret value: write-only in the API, encrypted at rest.
 */
export const SYSTEM_SETTINGS: readonly SettingDefinition[] = [
  {
    key: 'system.backups.schedule',
    schema: backupScheduleSettingsSchema,
    default: SYSTEM_DEFAULTS['system.backups.schedule'],
  },
  {
    key: 'system.backups.retention',
    schema: backupRetentionSettingsSchema,
    default: SYSTEM_DEFAULTS['system.backups.retention'],
  },
  {
    key: 'system.backups.s3',
    schema: backupS3SettingsSchema.nullable(),
    default: null,
    secret: true,
  },
  {
    key: 'system.backups.encryption',
    schema: backupEncryptionSettingsSchema,
    default: SYSTEM_DEFAULTS['system.backups.encryption'],
  },
  {
    key: 'system.backups.verification',
    schema: backupVerificationSettingsSchema,
    default: SYSTEM_DEFAULTS['system.backups.verification'],
  },
  { key: 'system.updates.channel', schema: releaseChannelSchema, default: 'stable' },
  { key: 'system.updates.check', schema: z.boolean(), default: false },
  { key: 'system.updates.manifest_url', schema: z.url().nullable(), default: null },
];

/** Reads a system setting; the documented default when no settings service is wired. */
export async function readSetting<Key extends SystemSettingKey>(
  settings: SettingsService | undefined,
  key: Key,
): Promise<SettingsKeys[Key]> {
  if (!settings) return SYSTEM_DEFAULTS[key] as never;
  return settings.get(key);
}
