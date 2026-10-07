import { z } from 'zod';

export const BACKUP_KINDS = ['scheduled', 'manual', 'pre_upgrade'] as const;
export const BACKUP_STATUSES = ['running', 'succeeded', 'failed', 'pruned'] as const;
export const BACKUP_VERIFICATION_STATES = ['pending', 'listed', 'restored', 'failed'] as const;
export const BACKUP_DESTINATION_KINDS = ['local', 's3'] as const;

export const backupKindSchema = z.enum(BACKUP_KINDS);
export const backupStatusSchema = z.enum(BACKUP_STATUSES);
export const backupVerificationStateSchema = z.enum(BACKUP_VERIFICATION_STATES);
export const backupDestinationKindSchema = z.enum(BACKUP_DESTINATION_KINDS);

export const backupLocationSchema = z.object({
  destination: backupDestinationKindSchema,
  /** Folder or key prefix that holds manifest.json and the parts. */
  location: z.string(),
});

/** One row of Settings › Storage and backups. */
export const backupSchema = z.object({
  id: z.string(),
  kind: backupKindSchema,
  status: backupStatusSchema,
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  appVersion: z.string(),
  changelogTag: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  attachmentMode: z.enum(['full', 'incremental']),
  baseBackupId: z.string().nullable(),
  encrypted: z.boolean(),
  locations: z.array(backupLocationSchema),
  verification: z.object({
    state: backupVerificationStateSchema,
    checkedAt: z.iso.datetime().nullable(),
    message: z.string().nullable(),
  }),
  error: z.string().nullable(),
});

export const backupListResponseSchema = z.object({
  items: z.array(backupSchema),
  nextCursor: z.string().nullable(),
});

export const backupIdParamsSchema = z.object({ id: z.uuid() });

export const backupListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  kind: backupKindSchema.optional(),
});

/** POST /admin/backups starts a manual backup; scheduled and pre-upgrade runs are internal. */
export const createBackupRequestSchema = z.object({}).strict();

export const restoreBackupRequestSchema = z.object({
  /** The person typed the confirmation; restore replaces the live database. */
  confirm: z.literal(true),
});

export const verifyBackupRequestSchema = z.object({
  /** `list` runs pg_restore --list; `restore` runs the full restore drill. */
  depth: z.enum(['list', 'restore']).default('restore'),
});

export const backupFrequencySchema = z.enum(['hourly', '6h', 'daily', 'weekly']);

export const backupScheduleSettingsSchema = z.object({
  frequency: backupFrequencySchema.default('daily'),
  /** Local time of day, HH:MM, in `timezone`; ignored for hourly. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('02:00'),
  timezone: z.string().min(1).default('UTC'),
  /** 0 = Sunday; used by the weekly frequency. */
  weekday: z.number().int().min(0).max(6).default(0),
});

export const backupRetentionSettingsSchema = z.object({
  hourly: z.number().int().min(0).max(168).default(24),
  daily: z.number().int().min(0).max(365).default(7),
  weekly: z.number().int().min(0).max(104).default(4),
  monthly: z.number().int().min(0).max(120).default(3),
  preUpgradeDays: z.number().int().min(1).max(90).default(7),
});

export const backupS3SettingsSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.url().optional(),
  region: z.string().min(1).default('us-east-1'),
  bucket: z.string().min(1),
  prefix: z.string().default('bemmoly/'),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean().default(false),
});

export const backupEncryptionSettingsSchema = z.object({
  /** Off-box copies are always encrypted; this covers the local copy. */
  local: z.boolean().default(false),
});

export const backupVerificationSettingsSchema = z.object({
  testRestore: z.enum(['weekly', 'off']).default('weekly'),
});

export type BackupKind = z.infer<typeof backupKindSchema>;
export type BackupStatus = z.infer<typeof backupStatusSchema>;
export type BackupVerificationState = z.infer<typeof backupVerificationStateSchema>;
export type BackupDestinationKind = z.infer<typeof backupDestinationKindSchema>;
export type BackupLocation = z.infer<typeof backupLocationSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type BackupListResponse = z.infer<typeof backupListResponseSchema>;
export type BackupListQuery = z.infer<typeof backupListQuerySchema>;
export type BackupIdParams = z.infer<typeof backupIdParamsSchema>;
export type BackupFrequency = z.infer<typeof backupFrequencySchema>;
export type BackupScheduleSettings = z.infer<typeof backupScheduleSettingsSchema>;
export type BackupRetentionSettings = z.infer<typeof backupRetentionSettingsSchema>;
export type BackupS3Settings = z.infer<typeof backupS3SettingsSchema>;
export type BackupEncryptionSettings = z.infer<typeof backupEncryptionSettingsSchema>;
export type BackupVerificationSettings = z.infer<typeof backupVerificationSettingsSchema>;
