import { z } from 'zod';
import { rollbackModeSchema } from './updates.ts';

/**
 * The updater's API on the internal network. Every call carries
 * `Authorization: Bearer <UPDATER_TOKEN>`; the updater publishes no port.
 */
export const UPDATER_STEPS = [
  'backup',
  'pull',
  'verify',
  'tag',
  'swap',
  'health',
  /** The updater moves itself to the release it just installed (ADR 0020). */
  'updater',
  'rollback',
  'restore',
  'done',
] as const;

export const updaterStepSchema = z.enum(UPDATER_STEPS);

export const updaterHistoryEntrySchema = z.object({
  operation: z.enum(['update', 'rollback']),
  from: z.string(),
  to: z.string(),
  at: z.iso.datetime(),
  outcome: z.enum(['succeeded', 'rolled_back', 'failed']),
  backupId: z.string().nullable(),
  mode: rollbackModeSchema.nullable(),
  verification: z.enum(['verified', 'unverified', 'local']).nullable(),
  message: z.string().nullable(),
});

/**
 * What became of the updater's own image after an update: moved to the release
 * (`updated`), left on the version it had because the new one could not be pulled,
 * verified or started (`kept`), or still being handed over to the new image (`handing_off`).
 */
export const updaterSelfUpdateSchema = z.object({
  outcome: z.enum(['updated', 'kept', 'handing_off']),
  from: z.string().nullable(),
  to: z.string(),
  message: z.string().nullable(),
});

export const updaterStatusSchema = z.object({
  state: z.enum(['idle', 'running', 'failed']),
  operation: z.enum(['update', 'rollback']).nullable(),
  step: updaterStepSchema.nullable(),
  message: z.string().nullable(),
  current: z.string().nullable(),
  previous: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  /** Pre-upgrade backup taken for the last update, used by a restore rollback. */
  preUpgradeBackupId: z.string().nullable(),
  history: z.array(updaterHistoryEntrySchema),
  /** The version the running or last operation moved to, and when it started. */
  target: z.string().nullable().default(null),
  startedAt: z.iso.datetime().nullable().default(null),
  /** The updater's own release; null from updaters that predate self-update. */
  updaterVersion: z.string().nullable().default(null),
  /** The updater's release before its last self-update, kept for a manual rollback. */
  updaterPrevious: z.string().nullable().default(null),
  selfUpdate: updaterSelfUpdateSchema.nullable().default(null),
});

export const updaterUpdateRequestSchema = z.object({
  tag: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, 'must be a release version'),
});

export const updaterRollbackRequestSchema = z.object({
  expectedMode: rollbackModeSchema.optional(),
  preferRestore: z.boolean().default(false),
});

export type UpdaterStep = z.infer<typeof updaterStepSchema>;
export type UpdaterHistoryEntry = z.infer<typeof updaterHistoryEntrySchema>;
export type UpdaterStatus = z.infer<typeof updaterStatusSchema>;
export type UpdaterSelfUpdate = z.infer<typeof updaterSelfUpdateSchema>;
export type UpdaterUpdateRequest = z.infer<typeof updaterUpdateRequestSchema>;
export type UpdaterRollbackRequest = z.infer<typeof updaterRollbackRequestSchema>;
