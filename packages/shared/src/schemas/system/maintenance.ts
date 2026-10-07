import { z } from 'zod';

/**
 * <data>/maintenance.json, written by the app during a restore and by the updater
 * during an update or rollback. While it exists the app refuses writes and both serve
 * the same message.
 */
export const MAINTENANCE_FILE = 'maintenance.json';

/**
 * <data>/updater/lock, held by the updater for a whole update or rollback, when it swaps
 * the app container and may restore the database. Nothing else replaces the database or
 * restarts the app while it is held. One older than the stale age was left by a crash.
 */
export const UPDATER_LOCK_FILE = 'updater/lock';
export const UPDATER_LOCK_STALE_MS = 2 * 3_600_000;

export const maintenanceStateSchema = z.object({
  reason: z.enum(['restore', 'update', 'rollback']),
  message: z.string(),
  step: z.string().nullable(),
  startedAt: z.iso.datetime(),
});

export type MaintenanceState = z.infer<typeof maintenanceStateSchema>;
