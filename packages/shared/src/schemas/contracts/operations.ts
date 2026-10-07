import { z } from 'zod';
import { idSchema, pageSchema, timestampSchema } from './common.ts';
import { healthCheckSchema } from './setup.ts';
import { updateChannelSchema } from './settings.ts';

export const backupSchema = z.object({
  id: idSchema,
  kind: z.enum(['scheduled', 'pre_upgrade', 'manual']),
  tier: z.enum(['hourly', 'daily', 'weekly', 'monthly']).nullable(),
  status: z.enum(['running', 'succeeded', 'failed', 'skipped']),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  appVersion: z.string(),
  destination: z.string(),
  verification: z.enum(['verified', 'pending', 'failed', 'not_run']),
  verifiedAt: timestampSchema.nullable(),
  error: z.string().nullable(),
});

export const backupsPageSchema = pageSchema(backupSchema).extend({
  summary: z.object({
    lastGoodAt: timestampSchema.nullable(),
    nextRunAt: timestampSchema.nullable(),
    /** Local-only backups live on the same disk as the data. */
    oneDisk: z.boolean(),
  }),
});

export const restoreBackupRequestSchema = z.object({
  /** The backup id typed back by the admin, as the confirmation. */
  confirm: idSchema,
});

export const rollbackModeSchema = z.enum(['code', 'schema', 'restore']);

export const updateStatusSchema = z.object({
  currentVersion: z.string(),
  channel: updateChannelSchema,
  /** in_app: the updater container runs it; otherwise the page shows `command`. */
  mode: z.enum(['in_app', 'cli', 'kubernetes']),
  command: z.string().nullable(),
  lastCheckedAt: timestampSchema.nullable(),
  latest: z
    .object({
      version: z.string(),
      publishedAt: timestampSchema,
      notes: z.string(),
      irreversible: z.boolean(),
      slowChangesets: z.array(z.string()),
    })
    .nullable(),
  previous: z
    .object({
      version: z.string(),
      updatedAt: timestampSchema,
      availableUntil: timestampSchema,
      rollbackMode: rollbackModeSchema,
      /** Restore rollbacks only: changes made since the pre-upgrade backup. */
      discardCount: z.number().int().nonnegative().nullable(),
      droppedFields: z.array(z.string()),
    })
    .nullable(),
  job: z
    .object({
      action: z.enum(['update', 'rollback']),
      state: z.enum(['running', 'succeeded', 'failed']),
      message: z.string(),
    })
    .nullable(),
});

export const applyUpdateRequestSchema = z.object({ version: z.string().min(1) });

export const systemStatusSchema = z.object({
  version: z.string(),
  health: z.array(healthCheckSchema),
  queue: z.object({
    queued: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative(),
  }),
  lastBackup: backupSchema.nullable(),
  /** Placeholder until the AI runtime ships. */
  aiSpend: z.object({ monthToDateUsd: z.number(), budgetUsd: z.number().nullable() }).nullable(),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupsPage = z.infer<typeof backupsPageSchema>;
export type RollbackMode = z.infer<typeof rollbackModeSchema>;
export type UpdateStatus = z.infer<typeof updateStatusSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
